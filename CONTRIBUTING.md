# Contributing

Thanks for helping improve Nekonymous.

Small, focused pull requests are preferred. Open an issue or discussion before a large feature, storage migration, cryptographic change, product-scope change, or broad refactor.

Security vulnerabilities must be reported privately through [SECURITY.md](./SECURITY.md).

## Before editing

Read:

- [Architecture](./docs/architecture.md)
- [Sealed Ticketing](./docs/sealed-ticketing.md) when touching anonymous messaging or inbox behavior
- [Conversation Suggestions](./docs/conversation-suggestions.md) when touching profiles, retrieval, ranking, suggestions, or requests
- [Threat Model](./docs/threat-model.md) when touching storage, identity, cryptography, logging, reset, or public claims
- [Development](./docs/development.md)
- [AGENTS.md](./AGENTS.md) for maintainer and coding-agent constraints

## Architecture principles

- The bot is the product surface; do not add a public web application or plugin system.
- Keep `src/index.ts` limited to webhook entry, queue dispatch, and Durable Object exports.
- Sealed ticketing is a first-class domain, not a generic helper.
- D1 stores structural account data and aggregate statistics, not anonymous transcripts or profile graphs.
- KV is routing/cache only.
- Vectorize retrieves bounded candidates only; final ranking is deterministic TypeScript.
- Durable Objects own atomic state transitions.
- Queues and alarms are at-least-once; operations must be idempotent.
- Keep Worker CPU, subrequests, decryptions, and list sizes bounded.
- Prefer direct readable code over generic service/repository/plugin abstractions.
- Do not add dependencies when the platform or a small local function already solves the problem.

## Privacy and security rules

Do not store:

```text
plaintext anonymous message body in D1 or KV
plaintext anonymous route in D1 or inbox pointers
raw Telegram user or chat ID in D1, KV, or Vectorize metadata
raw ticket/suggestion/request capability in storage
request intro in D1
reversible pair graph in D1
sensitive request/error objects in production logs
```

Callback data must remain short, language-independent, and free of raw IDs or content.

Public copy must not claim:

```text
E2EE
zero-knowledge
perfect anonymity
Telegram cannot see messages
the Worker cannot see messages
fully private
dating compatibility
personality diagnosis
exact compatibility percentage
```

## Local workflow

```bash
pnpm install
cp .env.example .dev.vars
pnpm db:migrations:apply:local
./tools/setup-conversation-v2-resources.sh
pnpm check
pnpm dev
```

Review the setup script before targeting any remote Cloudflare environment.

## Required checks

Before submitting:

```bash
pnpm check
git diff --check
```

Run focused checks for the area you changed.

Examples:

```bash
pnpm test:ticketing
pnpm test:idempotency
pnpm test:bot-flow
pnpm test:conversation-profile
pnpm test:conversation-ranking
pnpm test:conversation-requests
pnpm test:release-hardening
pnpm audit:d1
```

When changing an invariant, update or add a verification script. Do not rely only on manual Telegram testing.

## Code style

- Use TypeScript and existing project conventions.
- Keep functions small enough to understand, but do not create one file per trivial function.
- Use explicit domain names instead of `helpers`, `manager`, `processor`, or `common`.
- Keep pure calculations free of Cloudflare bindings.
- Use functions for product logic and classes only where the platform requires them, primarily Durable Objects.
- Await, return, or explicitly defer every promise.
- Do not use request-scoped mutable module globals.
- Preserve command names, callback prefixes, binding names, Durable Object migrations, and visible Persian terminology unless the change explicitly includes the complete compatibility work.

## Documentation changes

Update the document that owns the behavior:

| Change | Document |
|---|---|
| runtime, storage plane, queue, bot interaction, stats | `docs/architecture.md` |
| tickets, inbox, reply, block, report, expiry | `docs/sealed-ticketing.md` |
| profile, ranking, suggestions, requests | `docs/conversation-suggestions.md` |
| trust boundary, retention, reset, keys | `docs/threat-model.md` |
| setup, scripts, bindings, deployment | `docs/development.md` |
| public product summary | `README.md` |

## Pull request checklist

- [ ] Scope is focused.
- [ ] User-facing behavior is described.
- [ ] Storage and privacy impact is reviewed.
- [ ] CPU, subrequest, and retention impact is bounded.
- [ ] State transitions and retries are idempotent.
- [ ] Relevant verification scripts were added or updated.
- [ ] `pnpm check` passes.
- [ ] `git diff --check` passes.
- [ ] Documentation is synchronized.
- [ ] No secrets, production data, or generated local state are included.
- [ ] No deploy, remote migration, flush, or BotFather mutation was run unintentionally.
