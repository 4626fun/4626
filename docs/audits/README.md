---
title: Audits
sidebar_position: 4
---

# Audits

Published security and trust artifacts. For working papers and in-progress reviews, see `docs/_internal/` in the repo (not on this site).

| Doc | Purpose |
|-----|---------|
| [Charm audits](./charm/) | Charm V2 adversarial review and executive brief |
| [Codex reconciliation](./codex/AUDIT_RECONCILIATION) | Codex findings and remediation status |
| [Ajna findings](./codex/audit_findings_factories_batchers_ajna) | Factory/batcher/Ajna audit export |
| [Token image research](./token-image/) | Renderer research notes |
| [x-ray contract pass (June 2026)](./x-ray/contract-audit-pass-2026-06.md) | Latest full contract checklist execution |
| [CreatorVault business logic audit](./creatorvault-business-logic-core-structure-audit.md) | Lane terminology and completion invariants |

**Related (Security lane):** [mutable surface inventory](../security/mutable-surface-inventory.md) · [historical risk review](../security/historical-risk-review.md)

**Automation:** `.github/workflows/security-scanning.yml`, `pnpm security:local` at repo root.
