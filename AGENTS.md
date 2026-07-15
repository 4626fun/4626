# AGENTS.md

## Cursor Cloud specific instructions

### Architecture

| Component | Directory | Dev command |
|-----------|-----------|-------------|
| **Frontend SPA + Vercel API** | `frontend/` | `pnpm -C frontend dev` |
| **Solidity contracts** | `contracts/` | `forge build` / `forge test` |

Optional: XMTP Keepr (`frontend/server/agents/eliza/`), KPR (`kpr/`), Solana hook (`programs/creator-share-hook/`).

### Rule precedence

`AGENTS.md` is repo authority. Path-scoped `.cursor/rules/*.mdc` override generic workflow in scope:

- `ERC-4337-Wallet-Invariants.mdc` — wallet/account + pre-edit checkpoint (path-scoped)
- `csw-agent-lifecycle.mdc` — server CSW delegation, XMTP, deploy-session
- `agent-context-budget.mdc` — compact Tier 1 + archive routing
- `swap-execution.mdc`, `deploy-ops.mdc`, `contracts-scope.mdc`, `alfaclub-ops.mdc`, `telegram-mini-app.mdc`, `token-identity.mdc`
- `waitlist-onboarding-simplicity.mdc`, `frontend-seo-*.mdc`

Account model: `docs/_internal/ACCOUNT_MODEL.md`. Context index: `docs/agent-context/INDEX.md`.

### Security (trust boundaries)

- Deploy status/preflight: **read-only** (no infra/onchain side effects).
- Solana mutation: **machine auth** only.
- Telegram link: fresh Mini App proof; link-start tokens single-use.
- Group Telegram actions: **owner-scoped**.

### Agent discipline

- Report every validation command with exit code; never claim pass on failure.
- Prefer concrete test assertions (mode, sender, called/not-called).
- Local LLM/BYOK must not change Hermit, Eliza, XMTP, or production env names.

### Bootstrap

- Submodules: `git submodule update --init --recursive`
- Two lockfiles: root + `frontend/` — install both
- Foundry: `$HOME/.foundry/bin` on PATH
- API: `frontend/api/[...path].ts` → static route map in `_routes.ts`

### Account and auth (summary)

- Verified **email** is canonical identity; all channels converge on one account model.
- **`linked` ≠ execution-ready** — gate wallet features per track.
- User frontend: parent CSW + embedded EOA → `canonical4337`; or external EOA → `eoaDirect`.
- Deploy-session: creator's `profiles.csw_address` + temporary server owner.
- Railway/Keepr/ERC-8004: sender = **`PROTOCOL_CSW_ADDRESS`**.
- Detail: `ERC-4337-Wallet-Invariants.mdc`, `waitlist-auth-core.md` archive.

### CSW identity

- `profiles.csw_address` — per-account custody + user `canonical4337` sender.
- `PROTOCOL_CSW_ADDRESS` — protocol agent (XMTP, Railway, ERC-8004).
- `CANONICAL_CSW_ADDRESS` — operator personal custody.
- `4626.base.eth` — display only.

### Product pointers

- **Lanes / payout terminology:** `docs/audits/creatorvault-business-logic-core-structure-audit.md`
- **Telegram Mini App:** `.cursor/rules/telegram-mini-app.mdc`
- **Solana / KPR:** `docs/agent-context/archives/infra-ops.md`
- **AlfaClub / swap / waitlist caveats:** matching `docs/agent-context/archives/` sub-archives

### Learned facts

Tiered under `docs/agent-context/` — see [INDEX.md](docs/agent-context/INDEX.md). Do not bloat this file.
