# Conversation Suggestions V1

**Status:** implemented in V1 release candidate.

See also [README](../../README.md) and [docs/security/threat-model.md](../security/threat-model.md).

The codebase still uses `match` internally for historical and implementation reasons (routes, tables, handlers). Visible product copy uses **conversation suggestions** / «پیشنهاد گفت‌وگو».

## What V1 includes

- Optional conversation suggestions after assessment completion
- Discoverability **off by default** — user must opt in
- Vectorize + Workers AI for **candidate discovery only**
- Deterministic TypeScript ranking (`match-scoring.ts`, `match-selection.ts`)
- Hard filters (blocks, cooldowns, eligibility) override ranking
- Requester writes an intro message
- Candidate **accepts or declines** — no automatic conversation
- Accept creates a normal anonymous inbox ticket (same sealed-ticket path as deep-link messages)
- Decline creates no ticket
- Reset suggestion history in settings (does not delete account)

## What V1 does not claim

- Exact compatibility or compatibility percentages
- Dating or relationship matching
- Personality or clinical diagnosis
- Safety guarantees from similarity scores

User-facing labels use phrases like «سبک گفت‌وگوی نزدیک» and «پیشنهاد گفت‌وگو», not matchmaking or percent scores.

## Data flow

1. User completes assessment version `v1`.
2. Scores normalize to `0..1` across 14 dimensions; confidence stored in `result_summary_json`.
3. A controlled summary is generated for embedding (not raw answers).
4. Workers AI embeds; Vectorize stores one vector: `profile:{userId}:v1`.
5. User enables discoverability only when match-eligible.
6. Search: Vectorize `topK=30` + bounded D1 fallback when index is sparse.
7. Hard filters run before deterministic ranking; top suggestions shown.
8. Requester sends encrypted intro → `match_requests` (pending).
9. Candidate decline → no ticket.
10. Candidate accept → `createSealedTicket` / normal inbox flow.

## Scoring (deterministic)

- Frozen trait weights (sum `1.00`)
- `closeness`, `floorFit`, `mixedFit`
- Vectorize similarity is a discovery signal, not the final decision
- Confidence, freshness, dismiss, and stale-profile penalties
- Raw scores are **not** shown as compatibility percentages

## Retrieval

Requester requirements:

- completed `v1` profile
- discoverability enabled
- match eligible

Vectorize query: `topK = 30`, metadata filters `profileVersion`, `discoverable`, `matchEligible`, `locale`.

D1 fallback: recent discoverable profiles, same V1 version, match eligible, updated within 180 days, bounded to 20 rows.

## Rate limits and cooldowns (V1)

| Limit | Value |
|-------|-------|
| Match searches | 50 / hour (`match_events`) |
| Match requests created | 300 / day |
| Pair cooldown after accept/decline | 30 days |
| Match dismiss block | 30 days |
| Pending request TTL | 7 days |

## Ticketing integration

Pending match requests do **not** create inbox tickets. Accepted requests use the same encryption, inbox delivery, reply, block, report, nickname, and callback flow as public-link messages. See [sealed-ticket-routing-and-inbox.md](./sealed-ticket-routing-and-inbox.md).

## Telegram entry points

Canonical suggestion hub (`renderSuggestionHub`):

- `/match`
- Main menu `🧭 پیشنهاد گفت‌وگو`
- Inline `m:hub`

Search: `m:search`. Full callback list: [bot-interaction-v1.md](./bot-interaction-v1.md).

## Out of scope for V1

- Deep or adaptive assessment
- LLM final ranking decision
- Paid matching / Telegram Stars
- Advanced feedback learning
- Dating mode positioning

## Future backlog (not implemented)

- Richer moderation for suggestion abuse
- Tighter retention on old `match_suggestions` rows
- Optional intro rewrite assistance
