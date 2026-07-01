---
title: "Nekonymous Cloudflare-Native Infra Pattern"
title_fa: "الگوی زیرساخت Cloudflare-native نکونیموس"
project: "Nekonymous"
status: "architecture pattern"
version: "0.1"
date: "2026-07-01"
suggested_path: "docs/architecture/cloudflare-native-infra-pattern.md"
---

# Nekonymous Cloudflare-Native Infra Pattern

## 0. Purpose

This document defines the infrastructure and data-flow pattern for Nekonymous.

The goal is to keep the bot stable, resilient, low-CPU, privacy-conscious, and Cloudflare-native without changing visible product behavior.

Nekonymous remains:

```txt
A Persian-first anonymous Telegram relay with sealed ticket routing,
conversation-style assessment, optional conversation suggestions,
and honest privacy boundaries.
```

---

## 1. Core Principle

Target model:

```txt
Webhook Worker = thin and fast
Durable Objects = authoritative hot state
D1 = structural data and aggregate stats
KV = routing cache only
Queues = retryable background work
Vectorize = discovery only
Workers AI = bounded embedding helper
Web Crypto = privacy/security primitives
```

Short version:

```txt
Do critical state transitions synchronously.
Move retryable/non-critical work to queues.
Never scan private vaults for stats.
Never store anonymous conversations as user-linked rows.
```

---

## 2. Runtime Surfaces

### 2.1 Webhook Worker

```txt
POST /bot
```

Responsibilities:

```txt
- verify Telegram webhook secret token
- parse and validate update
- run global actor rate limit
- claim webhook update idempotently (processing lease)
- route through grammY
- perform critical state transitions
- enqueue non-critical background jobs
- mark update done after success
- return fast 2xx
```

Forbidden in webhook path:

```txt
- global cleanup scans
- stats aggregation scans
- abuse aggregation scans
- broad Durable Object scans
- long Telegram retry loops
```

### 2.2 Durable Objects

Main objects:

```txt
UserStateDO
TicketVaultShardDO
ReportLedgerDO
TelegramOutboxDO
```

### 2.3 D1

D1 is structural truth and aggregate stats store.

Allowed:

```txt
users
public_links
assessment_profiles
assessment_attempts
assessment_answers
match_requests
match_events
match_blocks
profile_vector_index_events
platform_stats
platform_daily_stats
platform_daily_stats_by_key
platform_daily_unique_stats
```

Forbidden for anonymous messaging:

```txt
raw Telegram user id
raw Telegram chat id
raw ticketRef
message body
sender_id -> recipient_id anonymous graph
route plaintext
payload plaintext
```

### 2.4 KV

KV is cache/routing only.

Allowed examples:

```txt
tg:{telegram_user_hash} -> internal user id
link:{slug} -> internal user id
```

Forbidden:

```txt
ticket state
inbox state
report state
message payload
route capsule
stats authority
assessment authority
matching authority
```

### 2.5 Queues

Current practical set in production:

```txt
NEKO_OUTBOX_QUEUE
NEKO_STATS_QUEUE
NEKO_DLQ
```

Planned queue names for expanded background flows:

```txt
NEKO_VECTOR_QUEUE
NEKO_REPORT_QUEUE
NEKO_MAINTENANCE_QUEUE
```

Queue failures must not corrupt critical bot state.

---

## 3. Request Lifecycle

```txt
Telegram update
→ POST /bot
→ verify secret
→ parse update
→ actor rate limit
→ idempotency claim: processing
→ grammY route
→ critical state transition
→ enqueue non-critical jobs
→ idempotency mark: done
→ return 2xx
```

Failure rule:

```txt
If critical processing fails, do not mark done.
Telegram may retry.
Retry must not duplicate committed side effects.
```

---

## 4. Webhook Idempotency

Behavior:

```txt
No duplicate side effects.
Safe retry on failure.
```

State model:

```txt
processing → done
```

Failure handling:

```txt
failed/released claim allows retry
```

Event key:

```txt
tg:update:{update_id}
```

Table shape in `UserStateDO`:

```sql
CREATE TABLE IF NOT EXISTS processed_events (
  key TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'processing',
  lease_until INTEGER,
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_processed_events_lease
ON processed_events(status, lease_until);
```

Critical reminder: webhook-level idempotency is necessary but not sufficient; critical side effects must also be operation-idempotent.

---

## 5. Sealed Ticket Routing

Canonical model:

```txt
anonymous message = sealed ticket capability
```

Concepts:

```txt
ticketRef: short callback capability, never stored raw
ticketHash: HMAC lookup key for storage
ownerProofTag: actor-bound proof over actorHash + ticketHash
route_enc: encrypted route capsule, kept until expiry
payload_enc: encrypted payload, cleared after first inbox render
```

Ticket shard naming:

```ts
function ticketVaultShardName(ticketHash: string): string {
  return `ticket:${ticketHash.slice(0, 2)}`
}
```

Ticket schema:

```sql
CREATE TABLE IF NOT EXISTS tickets (
  ticket_hash TEXT PRIMARY KEY,
  owner_proof_tag TEXT NOT NULL,
  route_enc TEXT NOT NULL,
  payload_enc TEXT,
  meta_enc TEXT,
  status TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
```

Forbidden columns:

```txt
recipient_id
sender_id
user_id
telegram_user_id
telegram_chat_id
chat_id
ticket_ref
message_body
conversation_id
```

---

## 6. Inbox Pattern

Inbox keeps pointers, not plaintext payloads.

Rules:

```txt
INBOX_RETENTION_DAYS = 30
max 10 payload decrypts per inbox request
no full 30-day scans
no payload in notification text
```

On successful first delivery:

```txt
payload_enc = null
ticket.status = viewed
inbox_pointer.status = viewed
```

Route capsule remains for reply/block/report/nickname until expiry.

---

## 7. Callback Resolver

All ticket actions flow through:

```txt
resolveTicketAction(ctx, action, ticketRef)
```

Core steps:

```txt
validate callback
derive actorHash
derive ticketHash
derive owner proof candidate
load ticket
constant-time owner proof check
reject expired
derive ticket key
decrypt route when needed
execute action
```

Actions:

```txt
reply
block
report
private nickname
```

---

## 8. Outbox Pattern

Core rule:

```txt
same event key → send once
different event key → allow separate sends
```

Current key example:

```txt
outbox:message-created:{ticketHash}
```

Never include:

```txt
raw ticketRef
raw Telegram IDs
message text
plaintext route/payload
```

---

## 9. Stats Pattern

Event-driven flow:

```txt
bot event
→ emitStat(eventName, optional key)
→ NEKO_STATS_QUEUE
→ queue consumer batch aggregation
→ D1 daily tables
→ stats reads from aggregate tables only
```

No stats scan over TicketVault/UserState/ReportLedger.

---

## 10. Report Pattern

Flow:

```txt
rp:{ticketRef}
→ resolve ticket
→ decrypt route_enc
→ derive blind tags
→ write ReportLedgerDO event
→ optional secondary queue work later
```

Report schema:

```sql
CREATE TABLE IF NOT EXISTS report_events (
  report_id TEXT PRIMARY KEY,
  sender_abuse_tag TEXT NOT NULL,
  pair_abuse_tag TEXT,
  link_abuse_tag TEXT,
  reporter_proof_tag TEXT NOT NULL,
  reason_code TEXT NOT NULL,
  evidence_ref TEXT,
  created_at INTEGER NOT NULL
);
```

No sender-recipient user graph in report storage.

---

## 11. Vector / Matching Pattern

Vectorize is discovery only:

```txt
assessment_completed
→ controlled summary
→ embedding
→ Vectorize upsert
→ deterministic TypeScript ranking
```

No raw answers, Telegram IDs, or message content in vector metadata.

---

## 12. Maintenance Pattern

Use bounded opportunistic cleanup:

```txt
on /inbox: remove expired pointers
on ticket access: expire stale tickets
optional bounded maintenance queue jobs later
```

Forbidden:

```txt
global ticket scans
namespace-wide DO scans
dashboard-triggered cleanup scans
```

---

## 13. Queue Roles

### NEKO_OUTBOX_QUEUE

```txt
retryable/non-critical Telegram sends
```

### NEKO_STATS_QUEUE

```txt
event counters and daily aggregate stats
```

### NEKO_DLQ

```txt
dead-letter storage for failed background jobs
```

### Planned (not yet active in this repo)

```txt
NEKO_VECTOR_QUEUE
NEKO_REPORT_QUEUE
NEKO_MAINTENANCE_QUEUE
```

---

## 14. Logging Rules

Never log:

```txt
raw Telegram IDs
message text
ticketRef
decrypted payload/route
```

Allowed log shape:

```txt
action, status, error code, queue batch size, ticketHash prefix
```

---

## 15. Performance Rules

```txt
bounded queries
short callback_data
no broad scans
no floating promises
batch queue writes where possible
prepared D1 statements
```

Inbox path target:

```txt
max 10 payload decrypts/request
```

---

## 16. Acceptance Criteria

Implementation target:

```txt
✅ secret verification when configured
✅ fast/bounded webhook
✅ webhook update_id idempotency
✅ outbox dedupe per stable event identity
✅ no raw ticketRef storage
✅ no anonymous message body in D1
✅ no anonymous sender-recipient graph in D1
✅ route_enc required on tickets
✅ payload_enc cleared after successful inbox render
✅ report flow uses blind tags
✅ stats are queue-driven aggregates
✅ queue consumers use retry + DLQ
✅ no critical work depends only on waitUntil
```

---

## 17. Final Rule

```txt
Keep Nekonymous small, honest, bounded, and Cloudflare-native.

Webhook accepts work.
DOs protect hot state.
Queues absorb retryable work.
D1 stores structure + aggregates.
KV routes, never owns.
Tickets seal anonymous messages.
Payloads are temporary.
Reports are blind.
Stats are aggregate.
```
