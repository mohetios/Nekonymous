import { DurableObject } from "cloudflare:workers";
import type { Environment } from "../types/runtime.env";
import type { UserDraft } from "../types/user-state.model";
import type { UserDraftMode } from "../types/user-state.model";
import type {
  UnreadDeliveryClaim,
  UnreadSummary,
} from "../types/inbox.model";
import { resolveProcessedEventClaim } from "./processed-events.policy";
import { INBOX_MAX_UNREAD } from "../types/inbox.constants";

const INBOX_CLEANUP_LIMIT = 10;
const UNREAD_DELIVERY_LEASE_MS = 60 * 1000;
/** Minimum gap between user actions (messages, commands, inline buttons). */
const RATE_LIMIT_MS = 1000;
const RATE_LIMIT_SCOPE = "user_action";
/** Default TTL when a draft is stored without an explicit expiresAt. */
const DEFAULT_DRAFT_TTL_MS = 24 * 60 * 60 * 1000;
const PROCESSED_EVENT_LEASE_MS = 30 * 1000;
const PROCESSED_EVENT_DONE_TTL_MS = 24 * 60 * 60 * 1000;
const PROCESSED_EVENT_CLEANUP_LIMIT = 100;
const PROFILE_SESSION_ID = "active";
const PROFILE_SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const SUGGESTION_SEARCH_SCOPE = "suggestion_search";
const SUGGESTION_SEARCH_LIMIT = 50;
const SUGGESTION_SEARCH_WINDOW_MS = 60 * 60 * 1000;
const EXPOSURE_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const EXPOSURE_TOKEN_BATCH_LIMIT = 10;
const EXPOSURE_TOKEN_MAX = 500;

type UserStateRow = {
  user_id: string;
  locale: string;
  locale_source: string;
  onboarding_completed: number;
  paused: number;
  display_name_ciphertext: string | null;
  discoverable: number;
  profile_capability_enc: string | null;
  created_at: number;
  updated_at: number;
};

type ContactEntryRow = {
  paused: number;
  display_name_ciphertext: string | null;
  blocked: number;
};

type ReceiveGateRow = {
  paused: number;
  blocked: number;
};

type DraftRow = {
  id: string;
  mode: string;
  to_user_id: string | null;
  link_slug: string | null;
  parent_message_id: number | null;
  reply_to_message_id: number | null;
  pending_nickname_contact_tag: string | null;
  pending_settings: string | null;
  created_at: number;
  updated_at: number;
  expires_at: number | null;
};

type ProcessedEventRow = {
  key: string;
  status: "processing" | "done" | "failed";
  lease_until: number | null;
  attempts: number;
  created_at: number;
  updated_at: number;
  expires_at: number;
};

type ProfileSessionRow = {
  id: string;
  version: string;
  status: string;
  current_index: number;
  total_questions: number;
  answers_enc: string;
  started_at: number;
  updated_at: number;
  expires_at: number | null;
};

type UnreadInboxItemSqlRow = {
  item_id: string;
  sealed_capability_enc: string;
  dedupe_tag: string;
  delivery_state: "active" | "delivering";
  delivery_attempt_id: string | null;
  delivery_lease_until: number | null;
  created_at: number;
  expires_at: number;
};

const rowToDraft = (row: DraftRow): UserDraft => ({
  id: row.id,
  mode: row.mode as UserDraftMode,
  ...(row.to_user_id ? { toUserId: row.to_user_id } : {}),
  ...(row.link_slug ? { linkSlug: row.link_slug } : {}),
  ...(row.parent_message_id !== null
    ? { parent_message_id: row.parent_message_id }
    : {}),
  ...(row.reply_to_message_id !== null
    ? { reply_to_message_id: row.reply_to_message_id }
    : {}),
  ...(row.pending_nickname_contact_tag
    ? { pendingNicknameContactTag: row.pending_nickname_contact_tag }
    : {}),
  ...(row.pending_settings !== null
    ? {
        pendingSettings: row.pending_settings as NonNullable<
          UserDraft["pendingSettings"]
        >,
      }
    : {}),
  ...(row.expires_at !== null ? { expiresAt: row.expires_at } : {}),
});

const isUnreadDedupeConflict = (error: unknown): boolean => {
  if (!(error instanceof Error)) {
    return false;
  }
  const message = error.message.toLowerCase();
  return message.includes("unique constraint") && message.includes("dedupe_tag");
};

export class UserStateDurableObject extends DurableObject<Environment> {
  constructor(ctx: DurableObjectState, env: Environment) {
    super(ctx, env);
    void ctx.blockConcurrencyWhile(() => {
      this.ensureSchema();
      return Promise.resolve();
    });
  }

  private sqlChanges(): number {
    return this.ctx.storage.sql
      .exec<{ changes: number }>("SELECT changes() AS changes")
      .one().changes;
  }

  private ensureSchema(): void {
    this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS _sql_schema_migrations (
        id INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS user_state (
        user_id TEXT PRIMARY KEY,
        locale TEXT NOT NULL DEFAULT 'fa',
        locale_source TEXT NOT NULL DEFAULT 'default',
        onboarding_completed INTEGER NOT NULL DEFAULT 0,
        paused INTEGER NOT NULL DEFAULT 0,
        display_name_ciphertext TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS drafts (
        id TEXT PRIMARY KEY,
        mode TEXT NOT NULL,
        to_user_id TEXT,
        link_slug TEXT,
        parent_message_id INTEGER,
        reply_to_message_id INTEGER,
        pending_nickname_contact_tag TEXT,
        pending_settings TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        expires_at INTEGER
      );

      CREATE INDEX IF NOT EXISTS idx_drafts_updated ON drafts(updated_at);

      CREATE TABLE IF NOT EXISTS unread_inbox_items (
        item_id TEXT PRIMARY KEY,
        sealed_capability_enc BLOB NOT NULL,
        dedupe_tag TEXT NOT NULL UNIQUE,
        delivery_state TEXT NOT NULL,
        delivery_attempt_id TEXT,
        delivery_lease_until INTEGER,
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_unread_inbox_items_state_created
        ON unread_inbox_items(delivery_state, created_at, item_id);

      CREATE INDEX IF NOT EXISTS idx_unread_inbox_items_expires
        ON unread_inbox_items(expires_at);

      CREATE TABLE IF NOT EXISTS blocks (
        block_tag TEXT PRIMARY KEY,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS contact_labels (
        contact_tag TEXT PRIMARY KEY,
        nickname_ciphertext TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS rate_limits (
        scope TEXT PRIMARY KEY,
        tokens REAL,
        last_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS processed_events (
        key TEXT PRIMARY KEY,
        status TEXT NOT NULL DEFAULT 'processing',
        lease_until INTEGER,
        attempts INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_processed_events_expires
        ON processed_events(expires_at);

      INSERT OR IGNORE INTO _sql_schema_migrations (id) VALUES (1);
    `);

    this.ctx.storage.sql.exec(
      `CREATE INDEX IF NOT EXISTS idx_processed_events_lease
       ON processed_events(status, lease_until)`
    );

    this.ensureConversationUserStateSchema();
    this.dropRemovedNotificationCycleTable();
  }

  private ensureConversationUserStateSchema(): void {
    const applied = this.ctx.storage.sql
      .exec<{ id: number }>(
        "SELECT id FROM _sql_schema_migrations WHERE id = 2 LIMIT 1"
      )
      .toArray();
    if (applied.length > 0) {
      return;
    }

    this.ctx.storage.sql.exec(`
      ALTER TABLE user_state ADD COLUMN discoverable INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE user_state ADD COLUMN profile_capability_enc TEXT;

      CREATE TABLE IF NOT EXISTS profile_sessions (
        id TEXT PRIMARY KEY,
        version TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        current_index INTEGER NOT NULL DEFAULT 0,
        total_questions INTEGER NOT NULL,
        answers_enc TEXT NOT NULL DEFAULT '',
        profile_capability_enc TEXT,
        started_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        expires_at INTEGER
      );

      CREATE INDEX IF NOT EXISTS idx_profile_sessions_status
        ON profile_sessions(status, updated_at);

      CREATE TABLE IF NOT EXISTS exposure_tokens (
        token_hash TEXT PRIMARY KEY,
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_exposure_tokens_expires
        ON exposure_tokens(expires_at);

      INSERT OR IGNORE INTO _sql_schema_migrations (id) VALUES (2);
    `);
  }

  private dropRemovedNotificationCycleTable(): void {
    const applied = this.ctx.storage.sql
      .exec<{ id: number }>(
        "SELECT id FROM _sql_schema_migrations WHERE id = 3 LIMIT 1"
      )
      .toArray();
    if (applied.length > 0) {
      return;
    }
    this.ctx.storage.sql.exec(`
      DROP TABLE IF EXISTS inbox_notification_cycle;
      INSERT OR IGNORE INTO _sql_schema_migrations (id) VALUES (3);
    `);
  }

  private getUserId(): string | null {
    const rows = this.ctx.storage.sql
      .exec<{ user_id: string }>("SELECT user_id FROM user_state LIMIT 1")
      .toArray();
    return rows[0]?.user_id ?? null;
  }

  initState(userId: string, displayNameCiphertext?: string): {
    ok: boolean;
    existing?: boolean;
  } {
    if (
      !userId ||
      userId.length > 80 ||
      (displayNameCiphertext !== undefined &&
        (typeof displayNameCiphertext !== "string" ||
          !displayNameCiphertext ||
          displayNameCiphertext.length > 4096))
    ) {
      return { ok: false };
    }

    const existing = this.getUserId();
    if (existing) {
      if (existing !== userId) {
        return { ok: false };
      }
      if (displayNameCiphertext) {
        this.ctx.storage.sql.exec(
          `UPDATE user_state
           SET display_name_ciphertext = ?, updated_at = ?
           WHERE user_id = ? AND display_name_ciphertext IS NULL`,
          displayNameCiphertext,
          Date.now(),
          userId
        );
      }
      return { ok: true, existing: true };
    }

    const now = Date.now();
    this.ctx.storage.sql.exec(
      `INSERT INTO user_state (
        user_id, display_name_ciphertext, created_at, updated_at
      ) VALUES (?, ?, ?, ?)`,
      userId,
      displayNameCiphertext ?? null,
      now,
      now
    );

    return { ok: true };
  }

  getState(): {
    paused: boolean;
    displayNameCiphertext: string | null;
    discoverable: boolean;
    profileCapabilityEnc: string | null;
    draft: UserDraft | null;
    blockTags: string[];
    lastMessageAt?: number;
  } | null {
    const rows = this.ctx.storage.sql
      .exec<UserStateRow>("SELECT * FROM user_state LIMIT 1")
      .toArray();
    const state = rows[0];
    if (!state) {
      return null;
    }

    const draftRows = this.ctx.storage.sql
      .exec<DraftRow>(
        `SELECT * FROM drafts
         WHERE expires_at IS NULL OR expires_at > ?
         ORDER BY updated_at DESC LIMIT 1`,
        Date.now()
      )
      .toArray();

    const blocks = this.ctx.storage.sql
      .exec<{ block_tag: string }>(
        "SELECT block_tag FROM blocks ORDER BY created_at ASC"
      )
      .toArray()
      .map((row) => row.block_tag);

    const rateRow = this.ctx.storage.sql
      .exec<{ last_at: number }>(
        "SELECT last_at FROM rate_limits WHERE scope = ?",
        RATE_LIMIT_SCOPE
      )
      .toArray()[0];

    return {
      paused: !!state.paused,
      displayNameCiphertext: state.display_name_ciphertext,
      discoverable: !!state.discoverable,
      profileCapabilityEnc: state.profile_capability_enc,
      draft: draftRows[0] ? rowToDraft(draftRows[0]) : null,
      blockTags: blocks,
      ...(rateRow?.last_at !== undefined ? { lastMessageAt: rateRow.last_at } : {}),
    };
  }

  setPaused(paused: boolean): void {
    const now = Date.now();
    this.ctx.storage.sql.exec(
      "UPDATE user_state SET paused = ?, updated_at = ?",
      paused ? 1 : 0,
      now
    );
  }

  setDisplayName(ciphertext: string): void {
    const now = Date.now();
    this.ctx.storage.sql.exec(
      "UPDATE user_state SET display_name_ciphertext = ?, updated_at = ?",
      ciphertext,
      now
    );
  }

  setDraft(body: UserDraft & { id?: string }): void {
    const now = Date.now();
    const draftId = body.id ?? "primary";
    const expiresAt =
      typeof body.expiresAt === "number" && Number.isSafeInteger(body.expiresAt)
        ? body.expiresAt
        : now + DEFAULT_DRAFT_TTL_MS;

    this.ctx.storage.sql.exec("DELETE FROM drafts");

    this.ctx.storage.sql.exec(
      `INSERT INTO drafts (
        id, mode, to_user_id, link_slug,
        parent_message_id, reply_to_message_id,
        pending_nickname_contact_tag, pending_settings,
        expires_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      draftId,
      body.mode,
      body.toUserId ?? null,
      body.linkSlug ?? null,
      body.parent_message_id ?? null,
      body.reply_to_message_id ?? null,
      body.pendingNicknameContactTag ?? null,
      body.pendingSettings ?? null,
      expiresAt,
      now,
      now
    );
  }

  getDraft(): UserDraft | null {
    const now = Date.now();
    this.ctx.storage.sql.exec(
      `DELETE FROM drafts
       WHERE expires_at IS NOT NULL
         AND expires_at <= ?`,
      now
    );
    const rows = this.ctx.storage.sql
      .exec<DraftRow>(
        `SELECT * FROM drafts
         WHERE expires_at IS NULL OR expires_at > ?
         ORDER BY updated_at DESC
         LIMIT 1`,
        now
      )
      .toArray();
    return rows[0] ? rowToDraft(rows[0]) : null;
  }

  clearDraft(): void {
    this.ctx.storage.sql.exec("DELETE FROM drafts");
  }

  private ensureAccountState(userId: string): boolean {
    if (!userId || userId.length > 80) {
      return false;
    }

    const existingUserId = this.getUserId();
    if (!existingUserId) {
      return this.initState(userId).ok;
    }
    return existingUserId === userId;
  }

  private getContactEntryRow(blockTag: string): ContactEntryRow | null {
    return (
      this.ctx.storage.sql
        .exec<ContactEntryRow>(
          `SELECT
             paused,
             display_name_ciphertext,
             EXISTS (
               SELECT 1 FROM blocks WHERE block_tag = ?
             ) AS blocked
           FROM user_state
           LIMIT 1`,
          blockTag
        )
        .toArray()[0] ?? null
    );
  }

  private getReceiveGateRow(blockTag: string): ReceiveGateRow | null {
    return (
      this.ctx.storage.sql
        .exec<ReceiveGateRow>(
          `SELECT
             paused,
             EXISTS (
               SELECT 1 FROM blocks WHERE block_tag = ?
             ) AS blocked
           FROM user_state
           LIMIT 1`,
          blockTag
        )
        .toArray()[0] ?? null
    );
  }

  checkCanReceive(
    userId: string,
    blockTag: string
  ): { ok: boolean; reason?: string } {
    if (
      !blockTag ||
      blockTag.length > 86 ||
      !this.ensureAccountState(userId)
    ) {
      return { ok: false, reason: "invalid" };
    }

    const state = this.getReceiveGateRow(blockTag);
    if (!state) {
      return { ok: false, reason: "invalid" };
    }

    if (state.paused) {
      return { ok: false, reason: "paused" };
    }

    if (state.blocked) {
      return { ok: false, reason: "blocked" };
    }

    return { ok: true };
  }

  getContactEntryState(userId: string, blockTag: string): {
    paused: boolean;
    blocked: boolean;
    displayNameCiphertext: string | null;
  } | null {
    if (
      !blockTag ||
      blockTag.length > 86 ||
      !this.ensureAccountState(userId)
    ) {
      return null;
    }

    const state = this.getContactEntryRow(blockTag);
    if (!state) {
      return null;
    }

    return {
      paused: !!state.paused,
      blocked: !!state.blocked,
      displayNameCiphertext: state.display_name_ciphertext,
    };
  }

  consumeRateLimit(userId: string): { limited: boolean } {
    if (!this.ensureAccountState(userId)) {
      return { limited: true };
    }

    const now = Date.now();
    const row = this.ctx.storage.sql
      .exec<{ last_at: number }>(
        "SELECT last_at FROM rate_limits WHERE scope = ?",
        RATE_LIMIT_SCOPE
      )
      .toArray()[0];

    if (row !== undefined && now - row.last_at < RATE_LIMIT_MS) {
      return { limited: true };
    }

    this.ctx.storage.sql.exec(
      `INSERT INTO rate_limits (scope, tokens, last_at, updated_at)
       VALUES (?, 0, ?, ?)
       ON CONFLICT(scope) DO UPDATE SET last_at = excluded.last_at, updated_at = excluded.updated_at`,
      RATE_LIMIT_SCOPE,
      now,
      now
    );
    return { limited: false };
  }

  private cleanupProcessedEvents(now: number): void {
    this.ctx.storage.sql.exec(
      `DELETE FROM processed_events
       WHERE key IN (
         SELECT key FROM processed_events
         WHERE expires_at <= ?
         ORDER BY expires_at ASC
         LIMIT ${PROCESSED_EVENT_CLEANUP_LIMIT}
       )`,
      now
    );
  }

  claimProcessedEvent(
    rawEventKey: string,
    leaseMsInput?: number
  ): { state: "acquired" | "processing" | "done" } | { error: "invalid_event_key" } {
    const eventKey = rawEventKey?.trim();
    const leaseMs =
      typeof leaseMsInput === "number" && Number.isFinite(leaseMsInput)
        ? Math.max(1000, Math.min(24 * 60 * 60 * 1000, Math.floor(leaseMsInput)))
        : PROCESSED_EVENT_LEASE_MS;

    if (!eventKey || eventKey.length > 128) {
      return { error: "invalid_event_key" };
    }

    const now = Date.now();
    this.cleanupProcessedEvents(now);
    const leaseUntil = now + leaseMs;
    const expiresAt = now + PROCESSED_EVENT_DONE_TTL_MS;
    const existing = this.ctx.storage.sql
      .exec<ProcessedEventRow>(
        `SELECT key, status, lease_until, attempts, created_at, updated_at, expires_at
         FROM processed_events
         WHERE key = ?`,
        eventKey
      )
      .toArray()[0];

    const claimState = resolveProcessedEventClaim(
      existing
        ? {
            status: existing.status,
            leaseUntil: existing.lease_until,
            expiresAt: existing.expires_at,
          }
        : null,
      now
    );

    if (claimState === "done") {
      return { state: "done" as const };
    }

    if (claimState === "processing") {
      return { state: "processing" as const };
    }

    if (!existing) {
      this.ctx.storage.sql.exec(
        `INSERT INTO processed_events (
          key, status, lease_until, attempts, created_at, updated_at, expires_at
        ) VALUES (?, 'processing', ?, 1, ?, ?, ?)`,
        eventKey,
        leaseUntil,
        now,
        now,
        expiresAt
      );
      return { state: "acquired" as const };
    }

    this.ctx.storage.sql.exec(
      `UPDATE processed_events
       SET status = 'processing',
           lease_until = ?,
           attempts = attempts + 1,
           updated_at = ?,
           expires_at = ?
       WHERE key = ?`,
      leaseUntil,
      now,
      expiresAt,
      eventKey
    );
    return { state: "acquired" as const };
  }

  completeProcessedEvent(rawEventKey: string): void {
    const eventKey = rawEventKey?.trim();
    if (!eventKey || eventKey.length > 128) {
      return;
    }
    const now = Date.now();
    this.ctx.storage.sql.exec(
      `UPDATE processed_events
       SET status = 'done',
           lease_until = NULL,
           updated_at = ?,
           expires_at = ?
       WHERE key = ?`,
      now,
      now + PROCESSED_EVENT_DONE_TTL_MS,
      eventKey
    );
  }

  failProcessedEvent(rawEventKey: string): void {
    const eventKey = rawEventKey?.trim();
    if (!eventKey || eventKey.length > 128) {
      return;
    }
    this.ctx.storage.sql.exec(
      `DELETE FROM processed_events WHERE key = ?`,
      eventKey
    );
  }

  private recoverExpiredUnreadLeases(now = Date.now()): void {
    this.ctx.storage.sql.exec(
      `UPDATE unread_inbox_items
       SET delivery_state = 'active',
           delivery_attempt_id = NULL,
           delivery_lease_until = NULL
       WHERE delivery_state = 'delivering'
         AND delivery_lease_until IS NOT NULL
         AND delivery_lease_until <= ?`,
      now
    );
  }

  private prepareUnreadInbox(now: number): void {
    this.ctx.storage.sql.exec(
      `DELETE FROM unread_inbox_items
       WHERE item_id IN (
         SELECT item_id
         FROM unread_inbox_items
         WHERE expires_at <= ?
         ORDER BY expires_at ASC, item_id ASC
         LIMIT ${INBOX_CLEANUP_LIMIT}
       )`,
      now
    );
    this.recoverExpiredUnreadLeases(now);
  }

  private countActiveUnread(now: number): number {
    return this.ctx.storage.sql
      .exec<{ count: number }>(
        `SELECT COUNT(*) AS count FROM unread_inbox_items
         WHERE expires_at > ?
           AND delivery_state IN ('active', 'delivering')`,
        now
      )
      .one().count;
  }

  cleanupExpiredUnreadItems(): UnreadSummary {
    const now = Date.now();
    this.prepareUnreadInbox(now);
    return { unreadCount: this.countActiveUnread(now) };
  }

  private activeUnreadCount(): number {
    const now = Date.now();
    this.recoverExpiredUnreadLeases(now);
    return this.countActiveUnread(now);
  }

  getUnreadSummary(): UnreadSummary {
    return {
      unreadCount: this.activeUnreadCount(),
    };
  }

  addUnreadItem(
    userId: string,
    body: {
      itemId: string;
      sealedCapabilityEnc: string;
      dedupeTag: string;
      createdAt: number;
      expiresAt: number;
    }
  ): {
    ok: boolean;
    reason?: "full" | "invalid";
    unreadCount?: number;
    duplicate?: boolean;
    notification: { required: true; eventId: string } | { required: false };
  } {
    const now = Date.now();
    if (
      !userId ||
      userId.length > 80 ||
      this.getUserId() !== userId ||
      !body.itemId ||
      body.itemId.length > 80 ||
      !body.sealedCapabilityEnc ||
      !body.dedupeTag ||
      body.dedupeTag.length > 86 ||
      !Number.isSafeInteger(body.createdAt) ||
      !Number.isSafeInteger(body.expiresAt) ||
      body.expiresAt <= body.createdAt ||
      body.expiresAt <= now
    ) {
      return {
        ok: false,
        reason: "invalid",
        notification: { required: false },
      };
    }

    this.prepareUnreadInbox(now);
    const existing = this.ctx.storage.sql
      .exec<{ item_id: string }>(
        "SELECT item_id FROM unread_inbox_items WHERE dedupe_tag = ?",
        body.dedupeTag
      )
      .toArray()[0];
    if (existing) {
      return {
        ok: true,
        duplicate: true,
        unreadCount: this.countActiveUnread(now),
        notification: { required: false },
      };
    }

    const active = this.countActiveUnread(now);
    if (active >= INBOX_MAX_UNREAD) {
      return {
        ok: false,
        reason: "full",
        notification: { required: false },
      };
    }

    try {
      this.ctx.storage.sql.exec(
        `INSERT INTO unread_inbox_items (
          item_id, sealed_capability_enc, dedupe_tag, delivery_state,
          delivery_attempt_id, delivery_lease_until, created_at, expires_at
        ) VALUES (?, ?, ?, 'active', NULL, NULL, ?, ?)`,
        body.itemId,
        body.sealedCapabilityEnc,
        body.dedupeTag,
        body.createdAt,
        body.expiresAt
      );
    } catch (error) {
      if (isUnreadDedupeConflict(error)) {
        return {
          ok: true,
          duplicate: true,
          unreadCount: this.countActiveUnread(now),
          notification: { required: false },
        };
      }
      throw error;
    }

    // One independent notice event per newly accepted unread (idempotency = eventId).
    return {
      ok: true,
      unreadCount: active + 1,
      notification: {
        required: true,
        eventId: crypto.randomUUID(),
      },
    };
  }

  private claimUnreadRows(limit: number): UnreadDeliveryClaim[] {
    const cappedLimit = Math.min(5, Math.max(1, Math.floor(limit)));
    const now = Date.now();
    this.prepareUnreadInbox(now);
    const rows = this.ctx.storage.sql
      .exec<UnreadInboxItemSqlRow>(
        `SELECT item_id, sealed_capability_enc, dedupe_tag, delivery_state,
                delivery_attempt_id, delivery_lease_until, created_at, expires_at
         FROM unread_inbox_items
         WHERE delivery_state = 'active'
           AND expires_at > ?
         ORDER BY created_at ASC, item_id ASC
         LIMIT ?`,
        now,
        cappedLimit
      )
      .toArray();

    const claims: UnreadDeliveryClaim[] = [];
    for (const row of rows) {
      const attemptId = crypto.randomUUID();
      const leaseUntil = now + UNREAD_DELIVERY_LEASE_MS;
      this.ctx.storage.sql.exec(
        `UPDATE unread_inbox_items
         SET delivery_state = 'delivering',
             delivery_attempt_id = ?,
             delivery_lease_until = ?
         WHERE item_id = ?
           AND delivery_state = 'active'`,
        attemptId,
        leaseUntil,
        row.item_id
      );
      const updated = this.ctx.storage.sql
        .exec<UnreadInboxItemSqlRow>(
          `SELECT item_id, sealed_capability_enc, dedupe_tag, delivery_state,
                  delivery_attempt_id, delivery_lease_until, created_at, expires_at
           FROM unread_inbox_items
           WHERE item_id = ?
             AND delivery_attempt_id = ?`,
          row.item_id,
          attemptId
        )
        .toArray()[0];
      if (updated) {
        claims.push({
          itemId: updated.item_id,
          sealedCapabilityEnc: updated.sealed_capability_enc,
          dedupeTag: updated.dedupe_tag,
          deliveryAttemptId: attemptId,
          expiresAt: updated.expires_at,
        });
      }
    }
    return claims;
  }

  claimNextUnreadItem(): UnreadDeliveryClaim | null {
    return this.claimUnreadRows(1)[0] ?? null;
  }

  completeUnreadDelivery(body: {
    itemId: string;
    deliveryAttemptId: string;
  }): { ok: boolean; summary: UnreadSummary } {
    if (!body.itemId || !body.deliveryAttemptId) {
      return { ok: false, summary: this.getUnreadSummary() };
    }
    this.ctx.storage.sql.exec(
      `DELETE FROM unread_inbox_items
       WHERE item_id = ?
         AND delivery_attempt_id = ?`,
      body.itemId,
      body.deliveryAttemptId
    );
    return {
      ok: this.sqlChanges() === 1,
      summary: this.getUnreadSummary(),
    };
  }

  releaseUnreadDelivery(body: {
    itemId: string;
    deliveryAttemptId: string;
  }): { ok: boolean } {
    if (!body.itemId || !body.deliveryAttemptId) {
      return { ok: false };
    }
    this.ctx.storage.sql.exec(
      `UPDATE unread_inbox_items
       SET delivery_state = 'active',
           delivery_attempt_id = NULL,
           delivery_lease_until = NULL
       WHERE item_id = ?
         AND delivery_attempt_id = ?`,
      body.itemId,
      body.deliveryAttemptId
    );
    return { ok: this.sqlChanges() === 1 };
  }

  listUnreadItemsForReset(): Array<{
    itemId: string;
    sealedCapabilityEnc: string;
    dedupeTag: string;
  }> {
    return this.ctx.storage.sql
      .exec<UnreadInboxItemSqlRow>(
        `SELECT item_id, sealed_capability_enc, dedupe_tag, delivery_state,
                delivery_attempt_id, delivery_lease_until, created_at, expires_at
         FROM unread_inbox_items`
      )
      .toArray()
      .map((row) => ({
        itemId: row.item_id,
        sealedCapabilityEnc: row.sealed_capability_enc,
        dedupeTag: row.dedupe_tag,
      }));
  }

  deleteUnreadItem(itemId: string): void {
    if (!itemId || itemId.length > 80) {
      return;
    }
    this.ctx.storage.sql.exec("DELETE FROM unread_inbox_items WHERE item_id = ?", itemId);
  }

  addBlock(blockTag: string): { ok: boolean; inserted: boolean } {
    if (!blockTag || blockTag.length > 86) {
      return { ok: false, inserted: false };
    }
    const now = Date.now();
    this.ctx.storage.sql.exec(
      `INSERT OR IGNORE INTO blocks (block_tag, created_at) VALUES (?, ?)`,
      blockTag,
      now
    );
    return { ok: true, inserted: this.sqlChanges() === 1 };
  }

  removeBlock(blockTag: string): { ok: boolean; removed: boolean } {
    if (!blockTag || blockTag.length > 86) {
      return { ok: false, removed: false };
    }
    this.ctx.storage.sql.exec(
      "DELETE FROM blocks WHERE block_tag = ?",
      blockTag
    );
    return { ok: true, removed: this.sqlChanges() === 1 };
  }

  clearBlocks(): void {
    this.ctx.storage.sql.exec("DELETE FROM blocks");
  }

  getLabel(contactTag: string): { nicknameCiphertext: string } | null {
    if (!contactTag || contactTag.length > 86) {
      return null;
    }
    const row = this.ctx.storage.sql
      .exec<{ nickname_ciphertext: string }>(
        "SELECT nickname_ciphertext FROM contact_labels WHERE contact_tag = ?",
        contactTag
      )
      .toArray()[0];
    return row ? { nicknameCiphertext: row.nickname_ciphertext } : null;
  }

  setLabel(
    contactTag: string,
    nicknameCiphertext: string | null
  ): { ok: boolean; limited?: boolean } {
    const now = Date.now();

    if (!nicknameCiphertext) {
      this.ctx.storage.sql.exec(
        "DELETE FROM contact_labels WHERE contact_tag = ?",
        contactTag
      );
      return { ok: true };
    }

    const count = this.ctx.storage.sql
      .exec<{ count: number }>("SELECT COUNT(*) AS count FROM contact_labels")
      .one().count;

    const exists = this.ctx.storage.sql
      .exec<{ contact_tag: string }>(
        "SELECT contact_tag FROM contact_labels WHERE contact_tag = ?",
        contactTag
      )
      .toArray();

    if (!exists.length && count >= 200) {
      return { ok: false, limited: true };
    }

    this.ctx.storage.sql.exec(
      `INSERT INTO contact_labels (contact_tag, nickname_ciphertext, created_at, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(contact_tag) DO UPDATE SET
         nickname_ciphertext = excluded.nickname_ciphertext,
         updated_at = excluded.updated_at`,
      contactTag,
      nicknameCiphertext,
      now,
      now
    );

    return { ok: true };
  }

  private parseProfileSession(row: ProfileSessionRow) {
    return {
      id: row.id,
      version: row.version,
      status: row.status,
      currentIndex: row.current_index,
      totalQuestions: row.total_questions,
      answersEnc: row.answers_enc,
      startedAt: row.started_at,
      updatedAt: row.updated_at,
      expiresAt: row.expires_at,
    };
  }

  private deleteProfileSessionIfExpired(
    row: Pick<ProfileSessionRow, "id" | "expires_at">
  ): boolean {
    if (row.expires_at === null || Date.now() <= row.expires_at) {
      return false;
    }
    this.ctx.storage.sql.exec(
      "DELETE FROM profile_sessions WHERE id = ?",
      row.id
    );
    return true;
  }

  private getActiveProfileSessionRow(): ProfileSessionRow | null {
    const rows = this.ctx.storage.sql
      .exec<ProfileSessionRow>(
        `SELECT
           id, version, status, current_index, total_questions,
           answers_enc, started_at, updated_at, expires_at
         FROM profile_sessions
         WHERE status IN ('active', 'ready_to_submit')
         ORDER BY updated_at DESC
         LIMIT 1`
      )
      .toArray();

    const row = rows[0];
    if (!row) {
      return null;
    }

    if (this.deleteProfileSessionIfExpired(row)) {
      return null;
    }

    return row;
  }

  private hasActiveProfileSession(): boolean {
    const row = this.ctx.storage.sql
      .exec<Pick<ProfileSessionRow, "id" | "expires_at">>(
        `SELECT id, expires_at
         FROM profile_sessions
         WHERE status IN ('active', 'ready_to_submit')
         ORDER BY updated_at DESC
         LIMIT 1`
      )
      .toArray()[0];
    return !!row && !this.deleteProfileSessionIfExpired(row);
  }

  startProfileSession(body: {
    version: string;
    totalQuestions: number;
    answersEnc: string;
  }): { ok: boolean } {
    if (!body.version || !body.totalQuestions || !body.answersEnc) {
      return { ok: false };
    }

    const now = Date.now();
    this.ctx.storage.sql.exec("DELETE FROM profile_sessions");

    this.ctx.storage.sql.exec(
      `INSERT INTO profile_sessions (
        id, version, status, current_index, total_questions, answers_enc,
        profile_capability_enc, started_at, updated_at, expires_at
      ) VALUES (?, ?, 'active', 0, ?, ?, NULL, ?, ?, ?)`,
      PROFILE_SESSION_ID,
      body.version,
      body.totalQuestions,
      body.answersEnc,
      now,
      now,
      now + PROFILE_SESSION_TTL_MS
    );

    return { ok: true };
  }

  getActiveProfileSession():
    | {
        id: string;
        version: string;
        status: string;
        currentIndex: number;
        totalQuestions: number;
        answersEnc: string;
        startedAt: number;
        updatedAt: number;
        expiresAt: number | null;
      }
    | null {
    const row = this.getActiveProfileSessionRow();
    if (!row) {
      return null;
    }

    return this.parseProfileSession(row);
  }

  updateProfileSession(body: {
    answersEnc?: string;
    currentIndex: number;
    status?: string;
  }):
    | { ok: true; updatedAt: number }
    | { ok: false; reason: "not_found" | "invalid" } {
    const row = this.getActiveProfileSessionRow();
    if (!row) {
      return { ok: false, reason: "not_found" };
    }

    if (
      !Number.isInteger(body.currentIndex) ||
      (body.answersEnc !== undefined && !body.answersEnc)
    ) {
      return { ok: false, reason: "invalid" };
    }

    const now = Date.now();
    const status = body.status ?? row.status;
    this.ctx.storage.sql.exec(
      `UPDATE profile_sessions
       SET answers_enc = ?, current_index = ?, status = ?, updated_at = ?
       WHERE id = ?`,
      body.answersEnc ?? row.answers_enc,
      Math.max(0, Math.min(body.currentIndex, row.total_questions)),
      status,
      now,
      row.id
    );

    return { ok: true, updatedAt: now };
  }

  deleteProfileSession(): void {
    this.ctx.storage.sql.exec("DELETE FROM profile_sessions");
  }

  getProfileMeta(): {
    discoverable: boolean;
    profileCapabilityEnc: string | null;
    hasActiveSession: boolean;
  } | null {
    const rows = this.ctx.storage.sql
      .exec<{
        discoverable: number;
        profile_capability_enc: string | null;
      }>(
        `SELECT discoverable, profile_capability_enc FROM user_state LIMIT 1`
      )
      .toArray();

    const state = rows[0];
    if (!state) {
      return null;
    }

    return {
      discoverable: !!state.discoverable,
      profileCapabilityEnc: state.profile_capability_enc,
      hasActiveSession: this.hasActiveProfileSession(),
    };
  }

  setDiscoverable(discoverable: boolean): void {
    const now = Date.now();
    this.ctx.storage.sql.exec(
      "UPDATE user_state SET discoverable = ?, updated_at = ?",
      discoverable ? 1 : 0,
      now
    );
  }

  setProfileCapabilityEnc(ciphertext: string | null): void {
    const now = Date.now();
    this.ctx.storage.sql.exec(
      "UPDATE user_state SET profile_capability_enc = ?, updated_at = ?",
      ciphertext,
      now
    );
  }

  getActiveExposureTokens(): { tokenHashes: string[] } {
    const now = Date.now();
    this.ctx.storage.sql.exec(
      "DELETE FROM exposure_tokens WHERE expires_at <= ?",
      now
    );
    const rows = this.ctx.storage.sql
      .exec<{ token_hash: string }>(
        `SELECT token_hash
         FROM exposure_tokens
         WHERE expires_at > ?
         ORDER BY expires_at DESC, token_hash ASC
         LIMIT ${EXPOSURE_TOKEN_MAX}`,
        now
      )
      .toArray();

    return { tokenHashes: rows.map((row) => row.token_hash) };
  }

  recordExposureTokens(tokenHashes: string[]): {
    ok: boolean;
    recorded: number;
  } {
    if (
      !Array.isArray(tokenHashes) ||
      tokenHashes.length > EXPOSURE_TOKEN_BATCH_LIMIT ||
      tokenHashes.some(
        (tokenHash) =>
          typeof tokenHash !== "string" ||
          !tokenHash ||
          tokenHash.length > 86
      )
    ) {
      return { ok: false, recorded: 0 };
    }

    const now = Date.now();
    this.ctx.storage.sql.exec(
      "DELETE FROM exposure_tokens WHERE expires_at <= ?",
      now
    );

    const uniqueTokenHashes = [...new Set(tokenHashes)];
    for (const tokenHash of uniqueTokenHashes) {
      this.ctx.storage.sql.exec(
        `INSERT INTO exposure_tokens (token_hash, created_at, expires_at)
         VALUES (?, ?, ?)
         ON CONFLICT(token_hash) DO UPDATE SET
           created_at = excluded.created_at,
           expires_at = excluded.expires_at`,
        tokenHash,
        now,
        now + EXPOSURE_TOKEN_TTL_MS
      );
    }

    this.ctx.storage.sql.exec(
      `DELETE FROM exposure_tokens
       WHERE token_hash IN (
         SELECT token_hash
         FROM exposure_tokens
         ORDER BY created_at DESC, token_hash ASC
         LIMIT -1 OFFSET ${EXPOSURE_TOKEN_MAX}
       )`
    );

    return { ok: true, recorded: uniqueTokenHashes.length };
  }

  consumeSuggestionSearch(): { limited: boolean; remaining?: number } {
    const now = Date.now();
    const row = this.ctx.storage.sql
      .exec<{ tokens: number; updated_at: number }>(
        "SELECT tokens, updated_at FROM rate_limits WHERE scope = ?",
        SUGGESTION_SEARCH_SCOPE
      )
      .toArray()[0];

    if (!row || now - row.updated_at > SUGGESTION_SEARCH_WINDOW_MS) {
      this.ctx.storage.sql.exec(
        `INSERT INTO rate_limits (scope, tokens, last_at, updated_at)
         VALUES (?, 1, ?, ?)
         ON CONFLICT(scope) DO UPDATE SET
           tokens = 1,
           last_at = excluded.last_at,
           updated_at = excluded.updated_at`,
        SUGGESTION_SEARCH_SCOPE,
        now,
        now
      );
      return {
        limited: false,
        remaining: SUGGESTION_SEARCH_LIMIT - 1,
      };
    }

    if (row.tokens >= SUGGESTION_SEARCH_LIMIT) {
      return { limited: true };
    }

    this.ctx.storage.sql.exec(
      "UPDATE rate_limits SET tokens = tokens + 1, updated_at = ? WHERE scope = ?",
      now,
      SUGGESTION_SEARCH_SCOPE
    );

    return {
      limited: false,
      remaining: SUGGESTION_SEARCH_LIMIT - row.tokens - 1,
    };
  }

  async purge(): Promise<{ ok: boolean }> {
    this.ctx.storage.sql.exec(`
      DELETE FROM processed_events;
      DELETE FROM rate_limits;
      DELETE FROM contact_labels;
      DELETE FROM blocks;
      DELETE FROM unread_inbox_items;
      DELETE FROM drafts;
      DELETE FROM profile_sessions;
      DELETE FROM exposure_tokens;
      DELETE FROM user_state;
    `);
    await this.ctx.storage.deleteAlarm();
    await this.ctx.storage.deleteAll();
    return { ok: true };
  }
}
