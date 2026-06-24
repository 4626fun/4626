---
title: Wallet Architecture
sidebar_position: 2
slug: /wallet-architecture
---

# Wallet Architecture

> **Canonical reference:** [docs/ACCOUNT_MODEL.md](./ACCOUNT_MODEL.md) is the single source of truth for the 4626 account model (populations, invariants, schema, existing flows). This page is a longer-form companion focused on the wallet roles in isolation; if the two ever conflict, ACCOUNT_MODEL.md wins.

This page explains every wallet role used for one 4626 user and how those roles fit together.

## Why this architecture exists

4626 did not start with a five-wallet mental model. This setup emerged from balancing three constraints:

1. **Canonical continuity:** users need one stable identity/custody anchor across Base, Zora, and app surfaces.
2. **Low-friction execution:** passkey prompts on every action are too expensive for normal app usage.
3. **Headless automation:** server-side deploy/session/agent operations must execute without browser-bound signers.

The resulting split is intentional:

- Parent CSW preserves canonical identity, custody, and default sponsored swap execution.
- Embedded signer authorizes parent-CSW sponsored UserOps without repeated passkey prompts — this is the default user execution path (`legacy-owner-install`).
- Sub-account is a **dormant, flag-gated, swap-only fallback** (enabled only when `WAITLIST_SUBACCOUNT_FLOW_ENABLED=1` / `VITE_WAITLIST_SUBACCOUNT_FLOW_ENABLED=1`). It is **not** created during onboarding and is **never** the deploy sender.
- External EOA remains a fallback/override path.
- Server wallet enables automation on the parent CSW without redefining canonical ownership.

:::note Current model

Onboarding and deploy use the **parent CSW + Privy embedded-owner signer**. The Base sub-account lane is off by default and only activates as a swap-only fallback behind an explicit feature flag — you will not encounter it in standard account setup or vault deployment.

:::

## Unified wallet-role chart

```mermaid
flowchart LR
  subgraph Identity["User-visible identity (Zora/Base CSW [You])"]
    CSW["Canonical CSW (parent)"]:::identity
  end

  subgraph AppExecution["Sponsored app execution"]
    Embedded["Privy embedded EOA"]:::execution
    External["Connected external EOA"]:::fallback
  end

  subgraph OptionalExecution["Optional app-scoped lane"]
    Sub["Base sub-account"]:::optional
  end

  subgraph Automation["Server automation"]
    Server["Privy server wallet"]:::automation
  end

  Embedded -->|"signs sponsored UserOps"| CSW
  External -.->|"fallback / override"| CSW
  CSW -.->|"may derive app sender"| Sub
  Embedded -.->|"can sign opt-in routes"| Sub
  Server -->|"delegated owner signs UserOps"| CSW

  classDef identity fill:#DBEAFE,stroke:#2563EB,stroke-width:2px,color:#1E3A8A;
  classDef execution fill:#DCFCE7,stroke:#16A34A,stroke-width:2px,color:#14532D;
  classDef optional fill:#ECFEFF,stroke:#0891B2,stroke-width:2px,color:#164E63;
  classDef fallback fill:#FEF3C7,stroke:#D97706,stroke-width:2px,color:#78350F;
  classDef automation fill:#F3E8FF,stroke:#9333EA,stroke-width:2px,color:#581C87;
```

## Wallet model table

The role badge in the `Wallet` column matches the Mermaid node color.

| Wallet | Functions | Why | Assumptions | Risks | Mitigations |
|---|---|---|---|---|---|
| <span style="background:#DBEAFE;color:#1E3A8A;border:1px solid #2563EB;border-radius:999px;padding:2px 8px;font-size:12px;font-weight:600;">Identity + Execution</span><br/>Canonical CSW (parent) | Identity, custody source of truth, and default sponsored swap sender | Stable ownership, no balance split, and cross-surface continuity (Base/Zora/app) | Coinbase/Base owner validation and parent semantics are correct; canonical mapping remains consistent | Canonical drift; ownership confusion; wrong account shown as primary | Enforce canonical CSW invariants; explicit canonical fields; canonical repair/verification flows |
| <span style="background:#DCFCE7;color:#14532D;border:1px solid #16A34A;border-radius:999px;padding:2px 8px;font-size:12px;font-weight:600;">Signer</span><br/>Privy embedded EOA | Primary signer for parent-CSW sponsored UserOps | Reduce repeated passkey prompts for normal usage | Embedded key custody and owner status are reliable | Signer lane interruption; signer-role confusion in sessions/UI | Explicit signer status messaging; reconnect handling; keep custody vs signer copy clearly separated |
| <span style="background:#ECFEFF;color:#164E63;border:1px solid #0891B2;border-radius:999px;padding:2px 8px;font-size:12px;font-weight:600;">Dormant / flag-gated</span><br/>Base sub-account | Swap-only fallback sender, **off by default** (flag-gated; never created during onboarding or used for deploy) | Reserved high-frequency execution lane for if/when provider support is reliable | Only routed when `WAITLIST_SUBACCOUNT_FLOW_ENABLED=1`; stored `base_sub_account` matches live execution account | Balance split; wrong execution address; visible account confusion | Keep hidden unless the active route actually sends from it; verify provider readiness before routing |
| <span style="background:#FEF3C7;color:#78350F;border:1px solid #D97706;border-radius:999px;padding:2px 8px;font-size:12px;font-weight:600;">Fallback</span><br/>Connected external EOA | Fallback signer and explicit override path | Recovery path and user-controlled manual signing | Wallet connector integrity and session binding are correct | Multi-signer race/collision; accidental use as unintended primary signer | Treat as fallback/override in routing/copy; signer diagnostics; explicit user confirmation cues |
| <span style="background:#F3E8FF;color:#581C87;border:1px solid #9333EA;border-radius:999px;padding:2px 8px;font-size:12px;font-weight:600;">Automation</span><br/>Privy server wallet | Delegated signer for server-side operations on parent CSW | Headless automation without changing canonical custody | Server key custody is secure; API authorization/policy scope is correctly enforced | Unauthorized server-side mutation if delegated path is abused | Scoped delegated-owner model; strict auth gates; audit logs and privileged-path monitoring |

## Related docs

- [Account Primitive](/primitives/account)
- [4626 Connection Methods](/4626-connection-methods)
- [ERC-4337 Debugging](/reference/erc4337-debugging)
- [Owner-Install Reference Methods](/operations/owner-install-reference-methods)
