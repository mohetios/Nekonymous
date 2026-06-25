# Security Policy

Nekonymous is a hosted anonymous Telegram relay. It is not end-to-end encrypted, zero-knowledge, or a perfect anonymity system.

Please do not report vulnerabilities through public GitHub issues.

To report a security issue, contact:

[hi@mohetios.dev](mailto:hi@mohetios.dev)

Please include:

- affected area or file
- reproduction steps if available
- expected impact
- whether secrets, Telegram identities, message payloads, D1 data, Durable Object state, KV routing, Vectorize metadata, or deployment credentials may be involved

## Security boundaries

- Telegram can see messages sent through Telegram.
- The Worker runtime sees plaintext while processing delivery.
- Stored payloads and route metadata are encrypted at rest where implemented.
- Raw Telegram user ids should not be stored in D1, KV, Durable Objects, or Vectorize metadata.
- Matching is approximate and product-level; it is not a safety, clinical, identity, or compatibility guarantee.

For the detailed threat model, see [docs/security/threat-model.md](./docs/security/threat-model.md).

## Response expectations

This is an independent open-source project. Security reports will be reviewed as soon as practical, but no formal SLA is currently provided.
