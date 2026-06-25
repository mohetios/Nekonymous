# Contributing

Thanks for helping improve Nekonymous.

Before opening a large pull request, please open an issue or discussion first.

## Principles

- Keep security claims precise.
- Do not claim E2EE, zero-knowledge, perfect anonymity, dating compatibility, or clinical/personality diagnosis.
- Keep Persian-first UX.
- Keep callback data language-independent.
- Prefer small focused changes.
- Do not store plaintext message bodies, raw Telegram ids, raw chat ids, or raw callback capabilities in D1 or KV.
- Do not use KV as source of truth for inbox, profiles, assessment, or matching.
- Add or update tests when touching ticketing, crypto, matching, assessment, account reset, storage, or i18n.

## Local checks

Use the real scripts from `package.json`:

```bash
pnpm install
pnpm typecheck
pnpm lint
pnpm knip
pnpm test
pnpm check
```

`pnpm check` runs typecheck, lint, knip, and all verify scripts (`test:ticketing`, `test:assessment`, `test:matching`).

Additional useful scripts:

```bash
pnpm audit:d1
pnpm audit:d1:local
pnpm db:migrations:apply:local
```

Read [AGENTS.md](./AGENTS.md) before editing Worker hot paths.

## Security issues

Do not open public issues for vulnerabilities.
Use [SECURITY.md](./SECURITY.md).
