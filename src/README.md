# Source Map

`src/` is a single Cloudflare Worker codebase. The Worker receives Telegram
webhooks, delegates product behavior to feature modules, and consumes queues.

The folder layout is intentionally shallow. Product areas live directly under
`src/`, and shared `types/` and `storage/` files are flat so import paths stay
easy to scan.

## Runtime Entry

- `index.ts` exports the Worker `fetch` handler, queue dispatcher, and Durable
  Object classes.
- `bot/` owns grammY setup, command/callback registration, reply keyboards,
  input navigation, and Telegram webhook validation.
- `queues/` owns Queue consumers and Queue-specific policies.

## Product Features

- `identity/` resolves Telegram users, public links, display names,
  and account reset helpers.
- `ticketing/` creates and delivers sealed anonymous tickets, inbox
  actions, reply/block/report flows, and ticket crypto helpers.
- `settings/` renders settings, privacy controls, statistics, and
  account actions.
- `profile/` owns the conversation-style assessment,
  profile building, encrypted profile lifecycle, profile readiness, and
  profile UI.
- `suggestions/` owns suggestion retrieval, deterministic
  ranking, suggestion tickets, conversation requests, and the suggestion hub.
- `moderation/` contains report creation helpers that feed Safety
  state.

## Types And Storage

- `types/` contains runtime DTOs and branded domain types. Prefer adding a
  shared type here before passing a shape across storage, queues, and product
  folders.
- Type file naming is `domain.role.ts`, such as `ticketing.model.ts`,
  `inbox.events.ts`, or `conversation.profile.ts`. This keeps the folder flat
  while grouping related files together in sorted file lists.
- `storage/` contains typed Durable Object clients and Durable Object
  implementations.
- Storage file naming is:
  - `name.client.ts` for typed clients that call a Durable Object.
  - `name.do.ts` for Durable Object implementations.
  - `name.types.ts` for local storage-only types.
  - `name.policy.ts` and `name.transitions.ts` for local storage policies and
    state transitions.
- Feature files use kebab-case nouns with an explicit role suffix where useful:
  `*-service.ts`, `*-handlers.ts`, `*-keyboards.ts`, `*-callbacks.ts`,
  `*-policy.ts`, `*-transitions.ts`, `*-summary.ts`.

## Shared Support

- `i18n/` contains user-facing copy and button labels. Keep Persian-first copy
  consistent with the product vocabulary in `AGENTS.md`.
- `stats/` contains aggregate event emission and read formatting only.
- `utils/` contains small runtime-safe helpers with no product authority.

## Boundary Rules

- Feature modules should call Durable Objects through `storage/*.client.ts`
  files, not raw DO stubs.
- Queue bodies and callback data should stay validated at the boundary.
- D1 remains authority only for users, public links, and aggregate statistics.
- Do not add a public HTTP product surface without an explicit product and
  security review.
