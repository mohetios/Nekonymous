# Nekonymous Documentation

This directory contains the canonical technical documentation for Nekonymous.

The documentation is intentionally small. Each document owns one subject and should be updated with the implementation that it describes.

## Start here

| Document | Owns |
|---|---|
| [Architecture](./architecture.md) | Worker runtime, Cloudflare planes, bot interaction, queues, statistics, and source boundaries |
| [Sealed Ticketing](./sealed-ticketing.md) | Anonymous message capability, TicketVault, inbox lifecycle, actions, expiry, and report routing |
| [Conversation Suggestions](./conversation-suggestions.md) | Conversation profile, Vectorize retrieval, deterministic ranking, suggestions, and requests |
| [Threat Model](./threat-model.md) | Security assumptions, stored data, threats, mitigations, limitations, and reset semantics |
| [Development](./development.md) | Setup, configuration, checks, deployment, manual QA, and documentation maintenance |

Repository-level documents:

- [`README.md`](../README.md): public project front door
- [`SECURITY.md`](../SECURITY.md): private vulnerability reporting
- [`CONTRIBUTING.md`](../CONTRIBUTING.md): contributor workflow
- [`AGENTS.md`](../AGENTS.md): maintainer and coding-agent constraints
- [`LICENSE`](../LICENSE): MIT license

## Source-of-truth order

When documents disagree, use this order:

1. Current code and tests
2. `wrangler.jsonc`, migrations, and package scripts
3. Canonical documents in this directory
4. Root README summaries
5. Git history and removed design drafts

## Documentation rules

- Keep product and security claims conservative.
- Describe current behavior, not an intended future implementation.
- Use `Nekonymous` for the product name.
- Use Persian product terms such as «پیشنهاد گفت‌وگو», not dating or compatibility language.
- Do not call the relay E2EE, zero-knowledge, fully private, or perfectly anonymous.
- Keep callback values, internal table names, and code identifiers in code formatting.
- Link to code areas instead of duplicating large implementation listings.
- Update tests and docs in the same change when an invariant changes.
- Keep deployment-specific secrets and identifiers out of documentation.

## What was consolidated

The canonical set replaces overlapping architecture notes for bot interaction, platform statistics, sealed ticketing, and Conversation Suggestions V2.

Bot commands, keyboards, callback families, queue routing, and statistics now live in [Architecture](./architecture.md). Sealed ticketing and conversation suggestions remain separate because they are core product protocols with their own storage and privacy models.

Persian voice constraints belong in visible copy, tests, contribution rules, and `AGENTS.md`; they do not require a separate public architecture document.
