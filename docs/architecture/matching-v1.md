# Nekonymous Matching V1

See also [README](../../README.md) and [docs/security/threat-model.md](../security/threat-model.md).

Nekonymous matching is approximate and opt-in. It is a conversation-style product signal for starting anonymous Telegram conversations, not a diagnosis, dating mode, or exact compatibility system.

## Data Flow

1. User completes the `v1` assessment.
2. Scores are normalized to `0..1` for the frozen 14 dimensions.
3. A lightweight confidence score is stored in `result_summary_json`.
4. A sanitized deterministic summary is generated for embedding.
5. Workers AI creates an embedding and Vectorize stores one vector: `profile:{userId}:v1`.
6. Discoverability is off by default and can only be enabled for match-eligible profiles.
7. Match search uses Vectorize for discovery and bounded D1 fallback when the index is sparse.
8. Final ranking is deterministic TypeScript.
9. A match request stores an encrypted intro.
10. Candidate decline creates no ticket.
11. Candidate accept creates a normal anonymous inbox ticket through the existing messaging system.

## Scoring

The assessment keeps the V1 dimension keys unchanged. Raw Likert answers are `1..5`; reverse items use `6 - raw`; dimension scores are normalized with `(avg - 1) / 4`.

Matching uses:

- frozen trait weights that sum to `1.00`
- `closeness`, `floorFit`, and `mixedFit`
- semantic similarity from Vectorize as a discovery signal, not the final decision
- confidence and freshness as small ranking signals
- low-confidence, stale-profile, repeated-exposure, and recent-dismiss penalties

Raw final scores are not shown as compatibility percentages. User copy uses labels such as “سبک گفت‌وگوی نزدیک” and “پیشنهاد گفت‌وگو”.

## Retrieval

Requester requirements:

- completed `v1` profile
- discoverable enabled
- match eligible

Vectorize query:

- `topK = 30`
- `returnValues = false`
- metadata filters: `profileVersion`, `discoverable`, `matchEligible`, `locale`

D1 fallback:

- recent discoverable profiles
- same V1 profile version
- match eligible through stored confidence
- updated in the last 180 days
- bounded to 20 rows

All candidates pass the same hard filters before ranking.

## Ticketing Integration

Pending match requests do not create inbox tickets. Accepted requests create normal anonymous inbox tickets using the same encryption, inbox delivery, reply, block, report, nickname, and capability callback flow as public-link anonymous messages.

## V1 Deferred

- no deep assessment
- no adaptive questions
- no exact compatibility
- no dating mode
- no LLM final decision
- no paid matching
- no advanced feedback learning
