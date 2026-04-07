---
name: solana-provisioner
description: Covers Solana route provisioner code, bridge token setup, and machine-auth mutation boundaries.
triggers:
  - solana provisioner
  - bridge token
  - meteora
scope:
  - frontend/server/solana-provisioner/
  - programs/creator-share-hook/
  - cre/
verification:
  - pnpm -C frontend typecheck
  - pnpm -C frontend test
  - forge test
---

# solana-provisioner

Use this skill when work touches Solana-side provisioning, bridge registration, or keeper flows that rely on Solana route state.

Guardrails:

- Keep read-only preflight/status endpoints side-effect free.
- Do not fall back to ambient user auth for provisioning or token-registration mutations.
- Preserve the current out-of-band Solana setup model documented in `AGENTS.md`.
