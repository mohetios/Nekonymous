# Security Policy

## Supported version

| Version | Status |
|---------|--------|
| V1 (`main`, `0.1.0`) | Release candidate — security reports accepted |

Older experimental branches and pre-V1 drafts are not supported.

## Reporting a vulnerability

**Do not** open public GitHub issues for security vulnerabilities.

Email: [hi@mohetios.dev](mailto:hi@mohetios.dev)

Include:

- affected area or file path
- reproduction steps if available
- expected impact
- whether secrets, Telegram identities, message payloads, D1, Durable Objects, KV, Vectorize, or deployment credentials may be involved

## Privacy and security boundaries

Nekonymous V1 is a **hosted anonymous Telegram relay**. It is:

- **Not** end-to-end encrypted (E2EE)
- **Not** zero-knowledge
- **Not** a perfect anonymity system

**By design:**

- Telegram sees messages while users send and receive through Telegram.
- The Worker sees plaintext while processing delivery, encryption, and decryption.
- Stored sensitive data is encrypted at rest **where implemented** (payloads, chat ids, route capsules, nicknames, match intros).
- Raw Telegram user ids are not stored in D1, KV, or Vectorize metadata.

For the full threat model, see [docs/security/threat-model.md](./docs/security/threat-model.md).

## What not to report as a vulnerability

The following are **documented product boundaries**, not defects:

- Telegram visibility of messages in transit
- Worker plaintext processing during relay
- Absence of E2EE or zero-knowledge guarantees
- Documented rate limits, inbox caps, and cooldowns
- Recipient ability to screenshot or forward messages
- Approximate (non-clinical) conversation suggestions

## Sensitive data handling

| Data | Storage |
|------|---------|
| Anonymous message bodies | TicketVault DO encrypted; cleared from payload after inbox delivery |
| Sender–recipient graph (relay) | Not stored in D1 as plaintext edges |
| Telegram user id | HMAC hash in D1 |
| Telegram chat id | AES ciphertext in D1 |
| Callback ticket refs | Short refs in Telegram only; hashes/sealed pointers in storage |
| Assessment answers | D1 + in-progress session in UserState DO |
| Reports | Blind tags in ReportLedger DO |

Details: [docs/security/threat-model.md](./docs/security/threat-model.md) and [docs/architecture/sealed-ticket-routing-and-inbox.md](./docs/architecture/sealed-ticket-routing-and-inbox.md).

## Known limitations

- Endpoint, secret, or Cloudflare/Telegram platform compromise is out of scope for application-layer guarantees.
- Matching suggestions are product-level signals, not safety or identity guarantees.
- V1 has no payment flow; Telegram Stars are not implemented.

## Response expectations

This is an independent open-source project. Reports are reviewed as soon as practical; no formal SLA is provided.
