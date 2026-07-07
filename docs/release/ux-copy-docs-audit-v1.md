# V1 UX, Copy, Docs Release Audit

> Historical release-audit note.
> Some paths in this file refer to the repository state before final docs canonicalization.
> See `docs/release/final-docs-canonicalization-v1.md` and `docs/release/public-surface-verification-v1.md` for the current release state.

**Date:** 2026-07-07  
**Scope:** Release polish only — no V1 feature or architecture changes.

## Phase 0 — Repository inspection

### Entrypoint and routing

| Item | Path |
|------|------|
| Worker entry | `src/index.ts` |
| Bot router | `src/bot/router.ts` |
| Handler registration | `src/bot/register-handlers.ts` |
| Commands list | `src/bot/commands.ts` |

### Handlers

| Surface | Path |
|---------|------|
| `/start`, `/inbox`, messages | `src/features/messaging/messaging-commands.ts` |
| Inbox callbacks | `src/features/messaging/messaging-actions.ts` |
| `/settings` | `src/features/settings/settings-handlers.ts` |
| `/assessment` | `src/features/assessment/assessment-handlers.ts` |
| `/match` | `src/features/matching/match-handlers.ts` |
| `/match_system` | `src/features/matching/match-system-handlers.ts` |

### Keyboards and copy

| Item | Path |
|------|------|
| Reply/inline keyboards | `src/bot/keyboards.ts` |
| Menu labels | `src/i18n/labels.ts` |
| Core messages | `src/i18n/messages.ts` |
| Settings copy | `src/i18n/settings.ts` |
| Matching copy | `src/i18n/matching.ts` |
| Assessment UI | `src/i18n/assessment-ui.ts` |
| Callback encoding | `src/utils/telegram-callbacks.ts` |

### Docs

| File | Status |
|------|--------|
| `README.md` | Rewritten for V1 release structure |
| `SECURITY.md` | Reviewed — accurate |
| `CONTRIBUTING.md` | Reviewed — accurate |
| `AGENTS.md` | Reviewed — accurate (internal) |
| `docs/security/threat-model.md` | Reviewed — negative E2EE/dating claims OK |
| `docs/architecture/matching-v1.md` | Reviewed — technical "compatibility" in limitations OK |
| `docs/onboarding.md` | Reviewed — current |
| `.env.example` | Reviewed — placeholders only |
| `wrangler.jsonc.example` | Reviewed — REPLACE_ME placeholders |
| `nekonymous-anonymous-messaging-technical-lab.md` | Rewritten (Mohetios Lab) |

### Stale / not deleted

| Path | Decision |
|------|----------|
| `site/index.html` | Outside Worker bot copy; landing page — not modified in this pass |
| `AGENTS.md` | References older `UserStateDO.inbox_tickets` naming in places; code uses ticket vault — doc drift noted for future AGENTS sync, not blocking V1 |

---

## Phase 1–2 — UX and copy changes made

### UX (already aligned; minor adjustments)

- Main menu: `🔗 لینک من` / `🧭 پیشنهاد گفت‌وگو` / `⚙️ تنظیمات` — unchanged
- Settings reply keyboard reordered: blocks/reset before about/technical (stats retained as implemented feature)
- Inbox actions remain inline-only with short callback prefixes
- Destructive confirmations use `✅ تأیید` / `❌ لغو`; hard reset uses `بله، حسابم را پاک کن`

### Copy files changed

| File | Changes |
|------|---------|
| `src/i18n/messages.ts` | Welcome, link, empty inbox, unread notifications (singular/plural), viewed-ticket privacy note, rate-limit wording |
| `src/i18n/labels.ts` | Confirmation button labels |
| `src/i18n/settings.ts` | Hard-reset warning; settings home bullet order |
| `src/i18n/assessment-ui.ts` | Assessment intro |
| `src/i18n/matching.ts` | Hub intro, no-candidates message |
| `src/bot/keyboards.ts` | Settings menu order |
| `src/features/messaging/messaging-service.ts` | Unread notification helper (removed unused import) |

---

## Phase 3 — Flow audit (code review)

### Identity and link

| Flow | Current state | Issue | Change | Files | Manual TG? |
|------|---------------|-------|--------|-------|------------|
| New user `/start` | Welcome + link + main menu | Copy tone | Updated welcome/privacy boundary | `messages.ts` | yes |
| Returning `/start` | Same | — | — | — | yes |
| Personal link button | `USER_LINK_MESSAGE` | Wording | Updated bilateral username hiding | `messages.ts` | yes |
| Deep link compose | `StartConversationMessage` | — | — | — | yes |
| Invalid link | `NoUserFoundMessage` | — | — | — | yes |
| Paused recipient | `RECIPIENT_PAUSED_MESSAGE` | — | — | — | yes |

### Messaging

| Flow | Issue | Change | Manual TG? |
|------|-------|--------|------------|
| Empty inbox | Short copy | `فعلاً پیام ناشناسی در صندوقت نیست.` | yes |
| New message notify | Count-based Persian | Singular/plural fixed strings | yes |
| Viewed ticket open | Short summary | Added payload-clearing privacy note | yes |
| Expired ticket | `EXPIRED_TICKET_MESSAGE` | — | no |
| Reply/block/report/nickname | Inline keyboards | — | yes |

### Settings

| Flow | Issue | Change | Manual TG? |
|------|-------|--------|------------|
| Hard reset warning | Wording | Aligned to spec | yes |
| Menu order | Blocks after pause | Reordered keyboard | yes |
| Confirm buttons | Labels | Updated | yes |

### Assessment

| Flow | Issue | Change | Manual TG? |
|------|-------|--------|------------|
| Dashboard intro | Personality framing | «شناخت سبک گفت‌وگو، نه تشخیص شخصیت» | yes |
| Continue/start/retry labels | State-aware | Already in `match-service.ts` | yes |

### Conversation suggestions

| Flow | Issue | Change | Manual TG? |
|------|-------|--------|------------|
| Hub intro | Dating/compatibility risk | Opt-in + negative claims | yes |
| No candidates | Old wording | Spec message | yes |
| Accept/decline/cancel | Inline labels | Already correct | yes |

---

## Phase 4 — Technical constraints (verified)

- Callback data: short prefixes (`r:`, `n:`, `b:`, `rp:`, `t:`, `m:`, `ms:`, `s:`) — no Persian, no raw IDs in data
- `encodeInboxCallbackData` enforces 64-byte limit (`telegram-limits.ts`)
- Ticket model: TicketVault + inbox pointers; payload cleared after delivery — unchanged
- Max 10 decrypts per inbox request — `render-inbox.ts`
- No architecture changes in this pass

---

## Phase 5–7 — Docs and Lab

| Artifact | Action |
|----------|--------|
| `README.md` | Full rewrite per V1 release template |
| `nekonymous-anonymous-messaging-technical-lab.md` | 15-section Persian RTL rewrite |
| `SECURITY.md`, `CONTRIBUTING.md` | No change required |
| Deleted files | None |

---

## Phase 8 — Grep review notes

**Persian forbidden terms in `src/`:** Only negative disclaimers (e.g. «درصد سازگاری نیستند», «تشخیص شخصیت نیست») — allowed.

**English forbidden terms:** Present only as negations in docs/README/SECURITY — allowed.

**`site/index.html`:** Contains negation examples for landing — not bot copy.

---

## Remaining manual verification

- [ ] Telegram BotFather commands/descriptions (`pnpm bot:profile`)
- [ ] Bot short/long description in production
- [ ] End-to-end flows on real Telegram (start, inbox, reply, assessment, match, reset)
- [ ] Landing page `site/index.html` copy sync (optional, out of Worker scope)
- [ ] GitHub release draft

---

## Checks run

| Command | Result |
|---------|--------|
| `pnpm check` | **pass** (typecheck, lint, knip, test, audit:ticket-storage) |
| Persian forbidden-term grep (`src`, docs) | **pass** — only negative disclaimers |
| English forbidden-claim grep | **pass** — only negations and internal field names |
| Callback pattern review | **pass** — short language-independent prefixes |
