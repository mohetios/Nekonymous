import type { Environment } from "../../types";
import { incrementPlatformStat } from "../platform/platform-stats-service";

const nowMs = (): number => Date.now();

export const upsertConversationSummary = async (
  env: Environment,
  conversationId: string,
  userAId: string,
  userBId: string
): Promise<void> => {
  const now = nowMs();
  await env.DB.prepare(
    `INSERT INTO conversations (
      id, type, user_a_id, user_b_id, status,
      message_count, report_count, last_event_at,
      created_at, updated_at
    ) VALUES (?, 'anonymous_relay', ?, ?, 'active', 1, 0, ?, ?, ?)
    ON CONFLICT(user_a_id, user_b_id, type) DO UPDATE SET
      message_count = message_count + 1,
      last_event_at = excluded.last_event_at,
      updated_at = excluded.updated_at`
  )
    .bind(conversationId, userAId, userBId, now, now, now)
    .run();

  await incrementPlatformStat(env, "messages_relayed");
};

export { getPlatformStats as getPublicStats } from "../platform/platform-stats-service";
