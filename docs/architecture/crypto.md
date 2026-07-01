# Ticketing crypto (V1)

All ticketing cryptography lives under **`src/ticketing/`** (flat modules + `ticketing-service.ts`). Web Crypto only — no Node `crypto`, no third-party libs.

Secrets: `APP_MASTER_KEY` (encryption IKM), `APP_HMAC_PEPPER` (HMAC for hashes and Telegram user hashing).

## Module map

| File | Role |
|------|------|
| `base64url.ts` | Base64url encode/decode + `randomBase64Url` |
| `hkdf.ts` | HKDF-SHA-256 key derivation (cached IKM import) |
| `hmac.ts` | HMAC-SHA-256 → base64url, `constantTimeEqual` |
| `aes-gcm.ts` | AES-256-GCM with AAD (12-byte IV) |
| `envelope.ts` | JSON wire `{ v, kid, iv, ct }` for sealed tickets |
| `keys.ts` | Ticket ref/hash, pair tags, owner proof, ticket keys, AAD strings |
| `ticketing-service.ts` | Chat-id sealing, match intro, display names, dedupe/block HMACs |

Sealed ticket flows (`create-sealed-ticket.ts`, `resolve-ticket-action.ts`, `inbox-pointer.ts`) use **`envelope.ts`** + **`keys.ts`**.

Identity and matching import **`keys.ts`** or **`ticketing-service.ts`** for HMAC tags and scoped encryption.

## Wire envelope

Type: `CipherEnvelope` in `types.ts`.

```json
{ "v": 1, "kid": "…", "iv": "…", "ct": "…" }
```

Sealed tickets pass **AAD** context strings (`routeAad`, `payloadAad`, `inboxPointerAad` in `keys.ts`).

`ticketing-service.ts` uses a separate no-AAD AES-GCM path for Telegram chat ids, display names, and match intros — same wire shape, different derivation.

## Ticket routing (`keys.ts`)

| Export | Purpose |
|--------|---------|
| `randomTicketRef` | 32-char callback ref (24 random bytes, base64url) |
| `createTicketHash` | Vault lookup HMAC |
| `createOwnerProofTag` | Recipient ownership check on vault row |
| `createPairTag` | Anonymous pair id (blocks, reports) |
| `createReportTag` | Blind report ledger tags |
| `deriveTicketKey` | AES key for route + payload ciphertext |

## Product helpers (`ticketing-service.ts`)

| Export | Purpose |
|--------|---------|
| `hmacTelegramUserId` | D1 `telegram_user_hash` |
| `encryptTelegramChatId` / `decryptTelegramChatId` | D1 chat ciphertext |
| `createMessageDedupeKey` | Inbox dedupe |
| `createBlockHash` | UserState block list |
| `getSenderAlias` | Private per-sender label handle |
| `encryptMatchIntro` / `decryptMatchIntro` | Match request intro in D1 |
| `encryptDisplayName` / `decryptDisplayName` | UserState display name |
| `generateOpaqueId` | Random D1 / DO ids |

## What never gets logged

Ticket refs, master/pepper secrets, decrypted payloads, raw Telegram tokens, or callback capabilities.

## Related docs

- [messaging.md](./messaging.md) — vault + inbox pointer flow
- [threat-model.md](../security/threat-model.md)
- [AGENTS.md](../../AGENTS.md)
