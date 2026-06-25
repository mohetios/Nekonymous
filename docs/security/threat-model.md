# Nekonymous V1 Threat Model

Nekonymous V1 is a hosted anonymous Telegram relay.

It hides users from each other and avoids storing a plain anonymous message transcript. Stored message payloads and route metadata are encrypted at rest. Reply routing uses short-lived capabilities held in Telegram private chat buttons.

Telegram and the Worker runtime still process delivery metadata and plaintext while delivering messages, so Nekonymous is not E2EE or zero-knowledge.

## Protected

- Raw Telegram user ids are not stored in D1, KV, DO, or Vectorize metadata.
- Telegram chat ids are encrypted at rest.
- Anonymous message payloads are encrypted in UserStateDO and cleared after delivery.
- Raw callback capabilities are not stored; lookup hashes are stored instead.
- Matching embeddings use sanitized profile summaries, not raw answers.
- Vectorize metadata does not include raw answers, Telegram ids, chat ids, or display names.

## Not Protected

- Telegram can see messages sent through Telegram.
- The Worker runtime sees plaintext while processing delivery.
- Cloudflare platform services process encrypted storage and vector data as configured bindings.
- Matching is approximate and product-level; it is not a safety, clinical, or identity guarantee.

## Matching Boundary

Workers AI and Vectorize are used for profile embedding and candidate discovery only. Final ranking, hard rejections, penalties, and tie breakers are deterministic TypeScript.

Accepted matches enter the same anonymous ticketing system as normal messages. Declined requests create no ticket.

## Forbidden Claims

Do not claim:

- perfect anonymity
- exact compatibility
- clinical/personality diagnosis
- dating compatibility
- E2EE
- zero-knowledge delivery
