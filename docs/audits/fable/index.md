---
title: Fable audit (June 2026)
sidebar_label: Fable audit
sidebar_position: 1
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

# Fable audit — June 2026

**4626 was audited in June 2026 using Cursor Fable 5** (`claude-fable-5-thinking-high`), a high-reasoning agent model used for multi-hour codebase review sessions in Cursor.

## What was reviewed

| Layer | Coverage |
| --- | --- |
| **Smart contracts** | `CreatorOVault`, impairment side-pocket, ShareOFT, DeploymentBatcher, lottery/gauge modules |
| **Frontend** | Swap, deploy, waitlist/auth, wallet execution (`canonical4337` / EOA tracks) |
| **API / server** | ~350 Vercel handlers, paymaster, keeper jobs, creator-strategy payments (Stripe / x402) |
| **Infrastructure** | GitHub Actions CI, Semgrep/Slither gates, cron workflows, dependency posture |
| **Cross-chain** | Solana share-mesh program, bridge adapter, KPR keeper workflows |
| **Agents** | Railway XMTP/Eliza runtime, Hermit, Telegram Mini App flows |

Review method: **read-only**, multi-pass. Baseline lint/typecheck/test/forge commands, parallel explore subagents per subsystem, then manual verification of high-severity candidates with file:line evidence.

## Primary deliverable

The canonical written report from the main audit session:

**→ [Full-codebase review (June 2026)](/audits/fable/full-repo-review-2026-06)**

Executive summary (as of review date):

- No remotely-exploitable unauthenticated RCE or fund-drain in the web tier was found.
- Material findings included impairment side-pocket contract issues (manager/keeper trust assumptions), x402 payment ordering, CI guard wiring gaps, and working-tree test drift.
- **Release-readiness verdict at review time:** not ready for a clean release tag from the then-current dirty working tree; impairment and x402 paths needed resolution or explicit risk acceptance.

See the full report for prioritized findings (C/H/M/L), test-coverage gaps, and recommended fixes.

## Session materials

All Fable runs for the **4626 repository** are published:

| Resource | Link |
| --- | --- |
| Session chronology & opening prompts | [Session index](/audits/fable/sessions-index) |
| Readable transcript pages (99 sessions) | [Transcript archive](/audits/fable/transcripts) |
| Raw JSONL + manifest (4626 only) | [Download ZIP](/audits/fable-chats-4626-2026-06.zip) |

The ZIP contains parent and subagent `.jsonl` logs plus `MANIFEST.txt` and the internal session index used to correlate billing clusters to transcripts.

## Methodology

1. **Primary audit** — Session `0a513245…` ran the full-codebase review template with eight parallel subagents (architecture, CI/CD, frontend, data layer, security, contracts, and supporting passes).
2. **Security follow-up** — Session `c603521c…` dedicated a security-focused pass on the same review scope.
3. **Production readiness** — Session `6318a55b…` and follow-ups (`059adbec…`, etc.) traced launch blockers from the review into remediation planning.
4. **Operational sessions** — Additional Fable threads through Jun 12–13 covered swap failures, Privy CSP, deploy UX, Solana verified builds, and vault production checks.

Subagent turns typically billed separately as `composer-2.5-fast`; parent reasoning used Fable 5.

## How to cite

```text
4626 Fable Audit (June 2026). Full-codebase review — wenakita/4626.
Published at https://docs.4626.fun/audits/fable/full-repo-review-2026-06
```

## Related disclosures

- [Impairment v1 disclosures](/reference/impairment-v1-disclosures) — on-chain impairment behavior (some Fable findings targeted gaps vs. these disclosures)
