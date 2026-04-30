---
title: Wallet Architecture
sidebar_position: 2
slug: /wallet-architecture
---

# Wallet Architecture

This page explains every wallet role used for one 4626 user and how those roles fit together.

## Why this architecture exists

4626 did not start with a five-wallet mental model. This setup emerged from balancing three constraints:

1. **Canonical continuity:** users need one stable identity/custody anchor across Base, Zora, and app surfaces.
2. **Low-friction execution:** passkey prompts on every action are too expensive for normal app usage.
3. **Headless automation:** server-side deploy/session/agent operations must execute without browser-bound signers.

The resulting split is intentional:

- Parent CSW preserves canonical identity and custody.
- Sub-account handles day-to-day user execution.
- Embedded signer makes that execution lane practical.
- External EOA remains a fallback/override path.
- Server wallet enables automation on the parent CSW without redefining canonical ownership.

## Unified wallet-role chart

```mermaid
flowchart LR
  subgraph Identity["User-visible identity (Zora/Base CSW [You])"]
    CSW["Canonical CSW (parent)"]:::identity
  end

  subgraph AppExecution["App execution"]
    Sub["Base sub-account"]:::execution
    Embedded["Privy embedded EOA"]:::execution
    External["Connected external EOA"]:::fallback
  end

  subgraph Automation["Server automation"]
    Server["Privy server wallet"]:::automation
  end

  CSW -->|"derives app sender"| Sub
  Embedded -->|"primary signer"| Sub
  External -.->|"fallback / override"| Sub
  Server -->|"delegated owner signs UserOps"| CSW

  classDef identity fill:#DBEAFE,stroke:#2563EB,stroke-width:2px,color:#1E3A8A;
  classDef execution fill:#DCFCE7,stroke:#16A34A,stroke-width:2px,color:#14532D;
  classDef fallback fill:#FEF3C7,stroke:#D97706,stroke-width:2px,color:#78350F;
  classDef automation fill:#F3E8FF,stroke:#9333EA,stroke-width:2px,color:#581C87;
```

## Wallet model table

The role badge in the `Wallet` column matches the Mermaid node color.

| Wallet | Functions | Why | Assumptions | Risks | Mitigations |
|---|---|---|---|---|---|
| <span style="background:#DBEAFE;color:#1E3A8A;border:1px solid #2563EB;border-radius:999px;padding:2px 8px;font-size:12px;font-weight:600;">Identity</span><br/>Canonical CSW (parent) | Identity and custody source of truth; parent account in the model | Stable ownership and cross-surface continuity (Base/Zora/app) | Coinbase/Base owner validation and parent semantics are correct; canonical mapping remains consistent | Canonical drift; ownership confusion; wrong account shown as primary | Enforce canonical CSW invariants; explicit canonical fields; canonical repair/verification flows |
| <span style="background:#DCFCE7;color:#14532D;border:1px solid #16A34A;border-radius:999px;padding:2px 8px;font-size:12px;font-weight:600;">Execution</span><br/>Base sub-account | Default sender for user-initiated app actions | App-scoped execution lane with better day-to-day UX | Sub-account derivation and enforcement are correct; stored `base_sub_account` matches live execution account | Sub-account mismatch; transactions sent from wrong execution address | Persist and verify `base_sub_account`; surface execution address in UI; verification endpoints |
| <span style="background:#DCFCE7;color:#14532D;border:1px solid #16A34A;border-radius:999px;padding:2px 8px;font-size:12px;font-weight:600;">Execution</span><br/>Privy embedded EOA | Primary signer for sub-account execution | Reduce repeated passkey prompts for normal usage | Embedded key custody and signing isolation are reliable | Signer lane interruption; signer-role confusion in sessions/UI | Explicit signer status messaging; reconnect handling; keep custody vs signer copy clearly separated |
| <span style="background:#FEF3C7;color:#78350F;border:1px solid #D97706;border-radius:999px;padding:2px 8px;font-size:12px;font-weight:600;">Fallback</span><br/>Connected external EOA | Fallback signer and explicit override path | Recovery path and user-controlled manual signing | Wallet connector integrity and session binding are correct | Multi-signer race/collision; accidental use as unintended primary signer | Treat as fallback/override in routing/copy; signer diagnostics; explicit user confirmation cues |
| <span style="background:#F3E8FF;color:#581C87;border:1px solid #9333EA;border-radius:999px;padding:2px 8px;font-size:12px;font-weight:600;">Automation</span><br/>Privy server wallet | Delegated signer for server-side operations on parent CSW | Headless automation without changing canonical custody | Server key custody is secure; API authorization/policy scope is correctly enforced | Unauthorized server-side mutation if delegated path is abused | Scoped delegated-owner model; strict auth gates; audit logs and privileged-path monitoring |

## Related docs

- [Account Primitive](/primitives/account)
- [4626 Connection Methods](/4626-connection-methods)
- [ERC-4337 Debugging](/reference/erc4337-debugging)
- [Canonical CSW Owner Approval](/operations/canonical-csw-owner-approval)
