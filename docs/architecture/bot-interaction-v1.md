# Bot Interaction V1

**Status:** current Telegram UX reference — implemented in V1 release candidate.

How commands, reply keyboards, inline keyboards, drafts, and callback routing work. For sealed-ticket actions see [sealed-ticket-routing-and-inbox.md](./sealed-ticket-routing-and-inbox.md). For conversation suggestions see [matching-v1.md](./matching-v1.md).

## Canonical commands

Source of truth: `src/bot/commands.ts` (`BOT_COMMANDS`, `BOT_COMMAND_DEFINITIONS`).

| Command | Purpose |
|---------|---------|
| `/start` | Create or resume user; show personal deep link |
| `/inbox` | Deliver pending inbox pointers |
| `/settings` | Settings home (inline) |
| `/assessment` | Assessment dashboard (inline) |
| `/match` | Suggestion hub (inline) |

BotFather tooling (`tools/set-telegram-bot-profile.sh`) reads `BOT_COMMAND_DEFINITIONS` and verifies `getMyCommands`.

Unknown slash commands receive the generic Persian reply from `UNKNOWN_COMMAND_MESSAGE` in `src/i18n/messages.ts`.

## Main reply keyboard (persistent)

Four buttons only — defined in `src/bot/keyboards.ts`:

```text
🔗 لینک من          📥 صندوق پیام‌ها
🧭 پیشنهاد گفت‌وگو   ⚙️ تنظیمات
```

Routing: `src/bot/menu.ts` → `handleMainMenuCommand`.

| Label | Action |
|-------|--------|
| `🔗 لینک من` | Reply with personal `t.me/...?start={slug}` link |
| `📥 صندوق پیام‌ها` | Same as `/inbox` |
| `🧭 پیشنهاد گفت‌وگو` | `renderSuggestionHub` |
| `⚙️ تنظیمات` | `renderSettingsHome` (inline) |

## Draft input mode

When the user is composing text (message, reply, nickname, display name, match intro), the reply keyboard shows **only**:

```text
↩️ لغو
```

Implemented in `src/bot/input-navigation.ts`. Cancel clears the draft and restores the main menu.

`handleMessage` in `messaging-commands.ts` routes **draft input before main menu labels** so menu text cannot hijack an active draft.

## Inline surfaces

| Surface | Renderer | Callback prefix |
|---------|----------|-----------------|
| Settings home + confirmations | `renderSettingsHome`, `renderScreen` | `s:` |
| Suggestion hub + search results | `renderSuggestionHub`, match handlers | `m:` (active set only) |
| Assessment flow | `sendAssessmentDashboard`, question UI | `t:` |
| Inbox message actions | `createMessageKeyboard` | `r:`, `b:`, `u:`, `n:`, `rp:` |
| Inbox pagination | `buildInboxPaginationKeyboard` | `ib:m:{offset}` |
| Open inbox from inline | `INBOX_MENU_CALLBACK.open` | `ib:open` |

Settings, suggestion hub, and assessment use **inline keyboards only** — not reply keyboards.

## Suggestion hub entry points

All three render `renderSuggestionHub` in `src/features/matching/suggestion-hub.ts`:

- `/match`
- Main menu `🧭 پیشنهاد گفت‌وگو`
- Inline callback `m:hub`

Search is triggered by `m:search` only.

## Active match callbacks

Registered via `matchCallbackQueryRegex()` in `src/features/matching/constants.ts`:

| Callback | Action |
|----------|--------|
| `m:hub` | Suggestion hub |
| `m:search` | Run candidate search |
| `m:pending` | List pending requests |
| `m:profile` | Match profile screen |
| `m:disc:on` / `m:disc:off` | Discoverability toggle |
| `m:assess` | Open assessment dashboard |
| `m:req:{id}` | Start intro draft for suggestion |
| `m:acc:{id}` | Accept incoming request |
| `m:dec:{id}` | Decline incoming request |
| `m:can:{id}` | Cancel outgoing request |

## Active inbox ticket callbacks

| Callback | Action |
|----------|--------|
| `r:{ref}` | Reply draft |
| `b:{ref}` | Block sender |
| `u:{ref}` | Unblock sender |
| `n:{ref}` | Private nickname draft |
| `rp:{ref}` | Report flow |

`{ref}` is a 32-character base64url ticket ref. Length and format enforced in `src/utils/telegram-callbacks.ts`.

## Unknown callbacks

`register-handlers.ts` registers specific handlers first, then a final catch-all:

- Answers every unmatched `callback_query`
- Replies with `EXPIRED_CALLBACK_MESSAGE` (`این دکمه دیگر در دسترس نیست.`)
- Does **not** translate legacy callback values or branch on removed payloads
- Does **not** log raw callback data

Ticket-specific expiry messages inside active handlers are unchanged.

## Handler wiring

| Concern | File |
|---------|------|
| Command + callback registration | `src/bot/register-handlers.ts` |
| Command list | `src/bot/commands.ts` |
| Main menu labels | `src/i18n/labels.ts`, `src/bot/menu.ts` |
| Inline screen edits | `src/bot/render-screen.ts` |
| Flow verification | `tools/verify-bot-flow.ts` |

## Manual QA (current model only)

Test commands: `/start`, `/inbox`, `/settings`, `/assessment`, `/match`.

Test main menu labels and suggestion hub callbacks: `m:hub`, `m:search`, request accept/decline/cancel, discoverability, profile, assessment entry.

Test inbox actions: reply, block, unblock, nickname, report.

Deliberately tap an unsupported old inline button (if any remain in chat history) and confirm loading stops, generic unavailable message appears, and no current action runs.

Do **not** QA removed commands (`/match_system`) or removed callbacks (`m:refresh`, `m:back`) as supported behavior.
