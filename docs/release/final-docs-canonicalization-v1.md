# Final Docs Canonicalization (V1)

**Date:** 2026-07-07  
**Pass type:** canonicalization — not feature work.

## Documentation inventory

| File | Role | Action | Current? | Notes |
|------|------|--------|----------|-------|
| `README.md` | README / entry document | **Rewrite** | Yes | Single repo entrypoint; links only to live docs |
| `SECURITY.md` | Security contact/process | **Rewrite** | Yes | Process + boundaries; links to threat model |
| `CONTRIBUTING.md` | Contributing | **Rewrite** | Yes | Accurate `pnpm check`; code map; no duplicate onboarding |
| `LICENSE` | License | **Keep** | Yes | MIT |
| `AGENTS.md` | AI/editor instruction | **Keep** (minor tree update) | Yes | Maintainer rules; not public product copy |
| `.env.example` | Setup template | **Keep** | Yes | Placeholders only |
| `wrangler.jsonc` | Deploy config | **Keep** | Yes | Committed binding IDs |
| `wrangler.jsonc.example` | Setup template | **Keep** | Yes | `REPLACE_ME` placeholders |
| `docs/security/threat-model.md` | Threat model | **Rewrite** | Yes | Primary privacy/security reference |
| `docs/architecture/sealed-ticket-routing-and-inbox.md` | Sealed ticket/inbox | **Create** (from `messaging.md`) | Yes | Implementation status table; V1 current |
| `docs/architecture/matching-v1.md` | Conversation suggestions | **Rewrite** | Yes | Product language; internal `match` note |
| `docs/mohetios/lab/nekonymous-fa.md` | Mohetios Lab article | **Move** from root | Yes | Narrative; Persian; not duplicate README |
| `docs/release/ux-copy-docs-audit-v1.md` | Release audit | **Keep** | Yes | Prior UX/copy pass record |
| `docs/release/final-docs-canonicalization-v1.md` | Release audit | **Create** | Yes | This file |
| `docs/archive/v1-pre-release/messaging.md` | Old architecture | **Archive** | No | Superseded by `sealed-ticket-routing-and-inbox.md` |
| `docs/archive/v1-pre-release/crypto.md` | Implementation reference | **Archive** | No | Merged into sealed-ticket doc + `src/ticketing/` |
| `docs/archive/v1-pre-release/onboarding.md` | Developer onboarding | **Archive** | No | Merged into `CONTRIBUTING.md` + `AGENTS.md` |
| `docs/archive/v1-pre-release/cloudflare-native-infra-pattern.md` | Architecture pattern | **Archive** | No | Duplicated README/AGENTS; historical |
| `nekonymous-anonymous-messaging-technical-lab.md` (root) | Lab draft | **Delete** | No | Moved to `docs/mohetios/lab/nekonymous-fa.md` |
| `site/index.html` | Landing page | **Update links** | Yes | Points to live docs paths |

## Live docs set (final)

```txt
README.md
SECURITY.md
CONTRIBUTING.md
LICENSE
.env.example
wrangler.jsonc.example
AGENTS.md

docs/
  architecture/
    matching-v1.md
    sealed-ticket-routing-and-inbox.md
  security/
    threat-model.md
  mohetios/lab/
    nekonymous-fa.md
  release/
    final-docs-canonicalization-v1.md
    ux-copy-docs-audit-v1.md

docs/archive/v1-pre-release/   # archived only — not source of truth
```

## Source-of-truth map

| Topic | Primary document |
|-------|------------------|
| Product overview | `README.md` |
| Install / setup / deploy | `README.md` |
| Security reporting | `SECURITY.md` |
| Threat model / privacy limits | `docs/security/threat-model.md` |
| Conversation suggestions | `docs/architecture/matching-v1.md` |
| Sealed ticket / inbox | `docs/architecture/sealed-ticket-routing-and-inbox.md` |
| Public narrative (Persian) | `docs/mohetios/lab/nekonymous-fa.md` |
| Contribution | `CONTRIBUTING.md` |
| Agent/maintainer rules | `AGENTS.md` |

## Forbidden-claim grep — allowed exceptions

| Location | Phrase | Reason |
|----------|--------|--------|
| `src/i18n/*.ts` | `درصد سازگاری`, `تست شخصیت`, `تشخیص شخصیت`, `دوستیابی`, `ناشناسی کامل`, `رمزنگاری سرتاسری` | Negative limitation in user copy |
| `docs/mohetios/lab/nekonymous-fa.md` | Same + `dating` | Narrative negatives |
| `site/index.html` | `رمزنگاری سرتاسری نیست`, `تست شخصیت` | Landing negatives |
| `README.md`, `SECURITY.md`, `threat-model.md` | `E2EE`, `zero-knowledge`, `dating`, `compatibility` | Explicit non-goals |
| `AGENTS.md` | `compatibility` in `conversationId` field name | Internal code identifier |
| `docs/archive/**` | Various | Archived banner present |
| Internal routes/tables | `match`, `match_*` | Code identifiers — explained once in `matching-v1.md` |

## Links checked

| Link | Status |
|------|--------|
| `https://github.com/mohetios/Nekonymous` | Intended — repo |
| `https://mohetios.github.io/Nekonymous/` | Intended — static project home |
| `https://mohetios.dev` | Intended — maintainer |
| `hi@mohetios.dev` | Intended — security contact |
| `https://mohetios.github.io/Nekonymous/` (site) | Present in landing — verify before public release |
| Relative doc links in README | Updated to live paths |

## Commands / scripts verified

All commands in `README.md` and `CONTRIBUTING.md` exist in `package.json`:

- `pnpm install`, `dev`, `deploy`, `check`, `typecheck`, `lint`, `knip`, `test`
- `pnpm db:migrations:apply:local`, `db:migrations:apply:remote`
- `pnpm audit:d1`, `bot:profile`

## Persian terminology

No bot copy changes in this pass. Prior pass aligned terms. Remaining forbidden words in `src/i18n` are negative disclaimers only (listed above).

## Checks run

| Command | Result |
|---------|--------|
| `pnpm check` | **pass** |
| Persian forbidden-term grep | **reviewed** — exceptions documented above |
| English forbidden-claim grep | **reviewed** — exceptions documented above |

## Remaining manual verification

- [ ] Telegram BotFather command descriptions (`pnpm bot:profile`)
- [ ] Telegram bot short/long description
- [ ] Real Telegram flow test
- [ ] `https://mohetios.github.io/Nekonymous/` if used publicly
- [ ] Mohetios Lab publish path for `docs/mohetios/lab/nekonymous-fa.md`
- [ ] GitHub release draft
