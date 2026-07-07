# Threat Model

**Scope:** Nekonymous V1 — Persian-first Telegram-bot-only hosted anonymous relay on Cloudflare.

**Status:** release candidate. This document describes the **current** implementation.

See also [README](../../README.md) and [SECURITY.md](../../SECURITY.md).

## Scope

This model covers:

- Anonymous deep-link messaging and replies
- Inbox sealed-ticket storage and delivery
- Block, report, private nickname, pause/resume
- Assessment v1 and optional conversation suggestions
- Account hard reset
- Storage in D1, Durable Objects, KV, Queues, Vectorize

This model does **not** cover Telegram client security, user device compromise, or Cloudflare platform guarantees beyond configured bindings.

## Non-goals

V1 intentionally does **not** provide:

- E2EE or zero-knowledge delivery
- Perfect anonymity or untraceability
- Hiding message plaintext from Telegram
- Hiding plaintext from the Worker during processing
- Clinical, personality, or psychological inference products
- Dating compatibility or exact relationship matching
- Payment or subscription security (not in V1)

## Actors

| Actor | Role |
|-------|------|
| Message sender | Opens deep link or replies; may abuse rate limits |
| Recipient | Reads inbox, replies, blocks, reports, sets nicknames |
| Telegram | Delivers updates and messages; sees plaintext in transit |
| Worker / runtime operator | Processes webhooks; sees plaintext during handling |
| Database / storage attacker | Exports D1, DO SQLite, KV, or Vectorize metadata |
| Abusive user | Floods, harasses, retries after blocks |
| External attacker | Webhook forgery, secret theft, binding misuse |

## Trust boundaries

| Boundary | Trust assumption |
|----------|------------------|
| **Telegram** | Sees messages and metadata for accounts using Telegram |
| **Worker** | Sees plaintext while validating, encrypting, decrypting, and relaying |
| **D1** | Structural and workflow data; no anonymous message bodies |
| **Durable Objects** | Authoritative per-user hot state and sealed tickets |
| **KV** | Eventually consistent routing cache only — not inbox authority |
| **Queues** | At-least-once delivery for outbox/stats jobs |
| **Workers AI / Vectorize** | Receives sanitized summary text for embedding; not raw answers in metadata |
| **User device** | Recipient or sender may screenshot, forward, or leak content |

## Data classes

| Class | Where it lives | Notes |
|-------|----------------|-------|
| Telegram user id | HMAC → `telegram_user_hash` in D1 | Raw id not stored |
| Telegram chat id | AES ciphertext in D1 | Decrypted only in Worker |
| Public link slug | D1 `public_links` | Shareable by design |
| Anonymous message payload | TicketVault DO `payload_enc` | Cleared after inbox delivery |
| Route metadata | TicketVault DO `route_enc` | Encrypted; kept until expiry for actions |
| `ticketRef` | Telegram callback buttons only | Not stored raw; hash or sealed pointer in storage |
| `ticketHash` | Vault + inbox pointers | Lookup key |
| Display name | UserState DO ciphertext | Shown to link visitors |
| Private nickname | UserState DO ciphertext | Recipient-only |
| Assessment answers | D1 + UserState session | Session in DO; answers in D1 until hard delete |
| Assessment profile | D1 `assessment_profiles` | Dimension scores + controlled summary |
| Suggestion request | D1 `match_requests` + encrypted intro | Workflow state |
| Report signal | ReportLedger DO blind tags | No D1 sender–recipient report graph |
| Aggregate stats | D1 `platform_daily_stats` (+ unique daily actives) | No user ids |

## Storage model (current)

```text
D1          → users, links, assessment, match workflow, platform_daily_stats
UserStateDO → inbox pointers, drafts, blocks, labels, rate limits, assessment session
TicketVaultDO → sealed route + payload capsules per ticket hash
ReportLedgerDO → blind abuse tags
TelegramOutboxDO → idempotent outbound send log
KV          → tg:{hash}, link:{slug} cache only
Vectorize   → profile embeddings + filter metadata
```

D1 does **not** store anonymous message bodies or a plaintext sender–recipient graph for relay messages.

## What is encrypted at rest

Where implemented in V1:

- Telegram chat ids (AES-256-GCM, `APP_MASTER_KEY`)
- Message payloads and route capsules (per-ticket HKDF-derived keys)
- Inbox pointer sealed refs
- Display names and private nicknames
- Match intro text in D1 (`intro_ciphertext`)
- Telegram chat routing in outbox jobs (`chatCiphertext`)

Encryption at rest does **not** mean Telegram or the Worker never see plaintext during delivery.

## What is visible while processing

Explicitly visible to **Telegram** during normal use:

- Message text and supported media traveling through Bot API
- Chat and user identifiers on Telegram’s side

Explicitly visible to the **Worker** during processing:

- Plaintext message content while encrypting, decrypting, or relaying
- Decrypted route metadata for authorized actions
- Assessment answers during the assessment flow

## Abuse controls (V1)

| Control | Implementation |
|---------|----------------|
| Global action throttle | 1 s per user (`UserStateDO.rate_limits`) |
| Inbox cap | 50 unread pointers per user |
| Private nicknames cap | 200 per user |
| Block before send/reply | UserState `blocks` |
| Blind reports | ReportLedger DO |
| Match search limit | 50 / hour |
| Match request limit | 300 / day |
| Pair cooldown | 30 days after accept/decline |
| Webhook auth | `BOT_SECRET_KEY` secret token |
| Webhook idempotency | `processed_events` in UserState DO |

## Protected (design intent)

- Casual D1 inspection does not reveal message bodies or raw Telegram ids
- Delivered payloads cleared from vault after successful inbox render
- Raw callback ticket refs not persisted in D1/KV
- Matching embeddings use sanitized summaries, not raw answers in Vectorize metadata

## Known limitations

- Telegram and Worker plaintext visibility by design
- Recipient screenshots and off-platform leaks
- Secret or platform compromise exposes ciphertext that keys can decrypt
- Matching is approximate — not a safety or identity guarantee
- KV eventual consistency — not used for inbox ordering
- Aggregate stats survive account hard delete (by design)

## D1-only leak scenario

If an attacker exports **D1 only** (no `APP_MASTER_KEY`, `APP_HMAC_PEPPER`, DO storage, KV, Vectorize, Telegram):

**Cannot directly read:** raw Telegram ids, chat ids, message bodies, match intro plaintext, Telegram usernames.

**Can read:** internal user ids, public slugs, assessment scores/answers, match workflow edges by internal id, controlled summaries, anonymous aggregate stats.

With **application secrets**, additional D1/DO ciphertext becomes decryptable. Normal **delivered** message bodies are still not in D1.

Run `pnpm audit:d1` for a repeatable read-only check.

## D1 vs Vectorize (matching)

- **D1** — source of truth for profiles, workflow, deterministic scoring inputs, hard deletes
- **Vectorize** — candidate discovery only (`topK`); final ranking in TypeScript

Intentional overlap: sanitized `profile_summary_text` in D1 and its embedding in Vectorize. Embedding is not reversible to exact text.

## Future improvements (not V1)

- Shorter retention for `assessment_answers` after profile completion
- Tighter expiry on resolved `match_requests` / `match_suggestions`
- Stronger moderation tooling
- Deployment provenance documentation

## Forbidden public claims

Do not claim: perfect anonymity, E2EE, zero-knowledge, exact compatibility, clinical/personality diagnosis, dating compatibility, or «secure messenger» positioning.
