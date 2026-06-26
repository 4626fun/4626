# 4626 Skills Master Context

## Project Snapshot

- Monorepo with two primary loops:
  - Frontend SPA + Vercel API in `frontend/` (Vite 7, React 19, TypeScript)
  - Solidity contracts at repo root (`contracts/`) with Foundry
- Optional subsystems: XMTP Keepr agent, KPR automation, Solana program, docs site.

## Rule Precedence

1. `AGENTS.md` is the repo-level authority.
2. Path/topic scoped `.cursor/rules/*.mdc` override within their scope.
3. For skill duplication, `.cursor/skills` is canonical over `frontend/skills`.

## Non-Negotiable Product Invariants

- Verified email is canonical identity and recovery key.
- Website/Base/Telegram converge into one account model.
- Canonical wallet policy is preserved across login/linking paths.
- `execution-ready` is separate from `linked`/`waitlist-joined`.
- Creator Coin and Share token identity must never be conflated.

## Security And Trust Boundaries

- Deploy preflight/status paths are read-only.
- Internal Solana mutation paths require machine auth (no ambient user/admin/session fallback).
- Telegram link completion requires fresh Mini App proof.
- Telegram link-start tokens are single-use, claim-bound, consumed on success.
- Group-scoped Telegram controls are owner-scoped unless product explicitly allows collaboration.

## Telegram Mini App Flow (Canonical Sequence)

1. verify Telegram session proof
2. perform inline email OTP inside Mini App
3. wait for Privy sync/account readiness
4. bind Telegram identity to resolved canonical account
5. persist backend state and consume tokenized link intent where applicable

Strictly forbidden:
- Privy modal/popup auth inside Telegram WebView
- multi-source verification state races
- route guards mutating flow state mid-session

## Runtime And Verification Commands

- Frontend dev: `pnpm -C frontend dev`
- Frontend quality:
  - `pnpm -C frontend lint`
  - `pnpm -C frontend typecheck`
  - `pnpm -C frontend test`
- Contracts:
  - `forge build`
  - `forge test`
- Security sweep: `pnpm security:local`
- Runtime guardrail checks:
  - `pnpm docs:check`
  - `node --test script/agent-runtime/__tests__/skills.test.js`

## Domain Capsules

### Product And Frontend

- Preserve route/provider topology and static API route map patterns.
- Avoid ad hoc polling around `useSiweAuth()`.
- Keep `/swap` quote behavior input-driven.
- See `skills.product-and-frontend.md`.

### Onchain And Vaults

- Vault deploy paths: Foundry infra, frontend AA deploy flow, multi-phase batchers.
- OFT and VRF require explicit read-only preflight and post-state verification.
- Strategy ops depend on debt/accounting awareness and approval readiness.
- See `skills.onchain-and-vaults.md`.

### Solana And KPR

- Solana provisioning is out-of-band and machine-auth protected.
- KPR bots sync Solana/Base state and run under `kpr/`.
- Keep shared context sanitized from host-level operational internals.
- See `skills.solana-and-cre.md`.

### Agent Runtime Guardrails

- Use skill routing by surface (`frontend-change`, `contracts-change`, `telegram-linking`, etc.).
- Run verification command set mapped to touched scope.
- See `skills.agent-runtime-guardrails.md`.

### Integrations

- Creator profile enrichment and Zora CLI workflows.
- Keep third-party API keys server-side and keep write paths confirmation-gated.
- Treat integrations as optional and degrade gracefully with explicit provenance.
- See `skills.integrations.md`.

## Source Paths

- `AGENTS.md`
- `.cursor/skills/*/SKILL.md`
- `frontend/skills/*/SKILL.md` (deduped where overlapping)
- `script/agent-runtime/skills/*/SKILL.md`
