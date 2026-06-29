---
title: Security & audits
sidebar_label: Audits
sidebar_position: 90
last_updated: '2026-06-28'
audience:
  - developers
  - protocols
  - operators
stage: use
owner: docs-team
last_reviewed: '2026-06-28'
status: current
---

# Security & audits

4626 publishes audit materials for transparency. This section covers third-party and agent-assisted review work performed on the protocol and application stack.

## Fable audit (June 2026)

In June 2026 the **4626 monorepo was reviewed using Cursor Fable 5** (`claude-fable-5-thinking-high`), an agentic code-review model. The engagement included:

- A **full-codebase read-only review** across contracts, frontend, API handlers, keepers, Solana, and CI
- **Parallel subsystem subagents** (architecture, security, contracts, frontend, data layer, CI/CD)
- Follow-on sessions on production readiness, swap routing, deploy UX, and operational hardening

| Deliverable | Description |
| --- | --- |
| [Fable audit overview](/audits/fable) | Scope, methodology, and how to read the materials |
| [Full review report](/audits/fable/full-repo-review-2026-06) | Primary findings with severity, evidence, and release-readiness verdict |
| [Session index](/audits/fable/sessions-index) | Chronological index of all Fable sessions (Jun 9–13, 2026) |
| [Transcript archive](/audits/fable/transcripts) | Readable exports of every parent and subagent session |
| [Raw JSONL download](/audits/fable-chats-4626-2026-06.zip) | Complete machine-readable transcript archive (4626 repo only) |

:::info Disclaimer
Fable sessions are **agent-assisted engineering reviews**, not a formal smart-contract audit certificate from a traditional security firm. Findings reflect the repository state at review time; some items may have been remediated since publication. Always verify against current code and disclosures before launch decisions.
:::
