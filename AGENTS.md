# AGENTS.md

## Cursor Cloud specific instructions

### Architecture overview

4626 (4626.fun) is a monorepo with two primary dev loops:

| Component | Directory | Toolchain | Dev command |
|-----------|-----------|-----------|-------------|
| **Frontend SPA + Vercel API** | `frontend/` | Vite 7 + React 19 + TypeScript | `pnpm -C frontend dev` |
| **Solidity contracts** | `contracts/` (root) | Foundry (forge) | `forge build` / `forge test` |

Optional: XMTP Keepr (`frontend/server/agents/eliza/`), KPR (`kpr/`), docs (`apps/docs-site/`), Solana hook (`programs/creator-share-hook/`).

### Default working style

Use `.cursor/rules/product-builder-workflow.mdc` for feature-shaping. Prefer speed, clarity, and maintainability over overengineering.

### Rule precedence

`AGENTS.md` is repo-level authority. Path-scoped `.cursor/rules/*.mdc` override the generic builder workflow in their scope:

- `product-builder-workflow.mdc` — generic feature shaping
- `4626 secur-agent guardrails for repo-native implementation.mdc` — secure automation process
- `ERC-4337-Wallet-Invariants.mdc` — wallet/account selection (`profiles.csw_address`, `PROTOCOL_CSW_*`, `CANONICAL_CSW_*`)
- `csw-agent-lifecycle.mdc` — CSW delegation, XMTP, ERC-8004, deploy-session
- `waitlist-onboarding-simplicity.mdc` — waitlist/signup in scoped auth/waitlist files
- `telegram-mini-app.mdc` — Telegram Mini App link/onboarding flows
- `agent-context-budget.mdc` — Tier 1 prefs + on-demand archives
- `swap-execution.mdc`, `deploy-ops.mdc`, `wallet-auth-checkpoint.mdc` — path-scoped domain rules
- `frontend-seo-core.mdc` / `frontend-seo-internal-linking.mdc` — SEO inside `frontend/`

**Account model authority:** `docs/_internal/ACCOUNT_MODEL.md` — read before design docs touching wallet, signer, or paymaster behaviour.

Do not preserve legacy routes or compatibility shims without explicit product requirement.

### Security and trust-boundary rules

References: `docs/security/mutable-surface-inventory.md`, `docs/security/historical-risk-review.md`.

- Deploy status/preflight paths are **read-only** (no infra provisioning or onchain mutation as side effect).
- Internal Solana mutation requires **machine auth** — not ambient user sessions.
- Telegram Mini App link requires **fresh Mini App session proof**; link-start tokens are single-use and claim-bound.
- Group-scoped Telegram message actions are **owner-scoped**.

### Agent validation and editing discipline

**Validation honesty:** Report every command with exit code. Never claim pass on failure. Targeted test pass does not imply full suite pass.

**Pre-edit checkpoint** (wallet / auth / XMTP / deploy / swap / canonical-CSW): before edit, summarize invariant, files inspected, proposed diff, test-only vs prod, and targeted validation command. See `wallet-auth-checkpoint.mdc`.

**Regression tests:** Prefer concrete assertions (routing mode, sender, called/not-called mocks) over string/debug prose.

**Local LLM isolation:** HF Router / Cursor BYOK config must not change Hermit, Eliza, XMTP, deploy-session, or production env names.

### Running services

- **Frontend:** `pnpm -C frontend dev` → `http://localhost:5173/`
- **Contracts:** `forge build` / `forge test` (Foundry at `$HOME/.foundry/bin`)
- **XMTP Keepr:** Railway only, single primary consumer (`AGENT_RUNTIME_ROLE=primary`)
- **Telegram** is not the live Eliza transport — separate from Railway XMTP runtime

### Lint / test / typecheck

| Command | Purpose |
|---------|---------|
| `pnpm -C frontend lint` | ESLint (0 warnings/errors) |
| `pnpm -C frontend typecheck` | TypeScript |
| `pnpm -C frontend test` | Vitest full suite (~3.5 min) |
| `pnpm -C frontend exec vitest run <file>` | **Scoped** test (preferred for agents) |
| `pnpm -C frontend validate:swap` / `validate:waitlist` / `validate:deploy-guards` / `validate:agent-quick` | Task-type shortcuts |
| `forge test` | Solidity — **~65 pre-existing Rebalance failures**; scope with `--no-match-path 'test/vault/strategies/CreatorOVaultStrategies.Rebalance.*'` |
| `pnpm -C frontend guard:schema` | No raw DDL in server code |
| `pnpm -C frontend guard:canonical-csw` | Retired env / CSW drift guard |
| `pnpm -C frontend guard:registry4626-naming` | Infra env naming |
| `pnpm -C frontend guard:contracts-folder-paths` | Retired contract paths |

Security CI: `.github/workflows/security-scanning.yml`. Audit index: `docs/audits/README.md`.

### Bootstrap caveats

- **Git submodules required** for Foundry: `git submodule update --init --recursive` (~2 min).
- **Two pnpm lockfiles:** root + `frontend/` — install both.
- **Foundry:** `$HOME/.foundry/bin` on PATH.
- **Env:** copy `.env.example` at root and `frontend/.env.example`.
- **API routing:** `frontend/api/[...path].ts` → `frontend/api/_handlers/_routes.ts` (static route map).

Product-specific caveats (AlfaClub, swap, XMTP, waitlist localhost): see `docs/agent-context/archives/`.

### Token identity invariants

Creator Coins and Share tokens are **separate assets** — never interchangeable.

- Creator Coin address != Share token address (explicit lookup required).
- Creator Coin UI uses creator-coin artwork; Share token UI may use vault-branded renders.
- Pass explicit token kind (`creator` vs `share`) in image pipelines and search/dedup.

### Account and auth invariants

Product-level rules — preserve unless product explicitly changes direction.

**Architecture:** `docs/_internal/4626-connection-methods.md`, `ERC-4337-Wallet-Invariants.mdc`, `csw-agent-lifecycle.mdc`, `ACCOUNT_MODEL.md`.

**Summary:**

- Verified **email** is canonical identity and recovery key; no account until OTP completes.
- All entry points (web, Base app, Telegram) converge on one account model keyed by verified email.
- **`linked` / waitlist-joined ≠ execution-ready** — gate wallet features per track.
- **User-initiated frontend:** parent CSW (`profiles.csw_address`) + embedded EOA owner → `canonical4337`; or external EOA → `eoaDirect`.
- **Deploy-session:** creator's `profiles.csw_address` + temporary Privy server owner.
- **Railway XMTP / Keepr / ERC-8004:** sender = **`PROTOCOL_CSW_ADDRESS`** (protocol agent), not operator custody CSW.
- Telegram is linked channel, not recovery key; email OTP inside Mini App. Conflicts require explicit merge UX.

Execution-track detail: `docs/agent-context/archives/waitlist-auth.md`.

### CSW identity (user account vs protocol agent)

- **`profiles.csw_address`** — each account's parent CSW: custody + user-initiated `canonical4337` sender.
- **`PROTOCOL_CSW_ADDRESS`** (`0x793c…c145`) — protocol agent: XMTP Agent 4626 inbox, Railway sender, ERC-8004 #2205, AMOE publishers.
- **`CANONICAL_CSW_ADDRESS`** (`0xAb6d5…967b5`) — operator personal account: custody, swaps, AKITA vault owner.
- **`4626.base.eth`** — operator display only, not custody or agent inbox.
- Guards: `pnpm -C frontend guard:canonical-csw`; verify: `scripts/ops/verify-protocol-csw-cutover.ts`.
- Deep wiring: `docs/agent-context/archives/wallet-identity.md`.

### Canonical lane terminology

Use canonical terms from `docs/audits/creatorvault-business-logic-core-structure-audit.md` — never bare `payoutRecipient`, never conflate jackpot custody (`jackpotCustodian`) with payout authority (`jackpotPayoutAuthority` / `LotteryManager4626`). Vault settlement truth: `/api/keeper/sweep` gates `settledAt` (five audit §5.1 invariants). Full lane definitions and naming policy live in that audit doc.

### Telegram Mini App

Strict state machine, inline OTP (no Privy modal in WebView), verified-email-before-Telegram-bind. Full rules: `.cursor/rules/telegram-mini-app.mdc` and `docs/_internal/operations/operations/messaging/telegram-canonical-link-preservation.md`.

### Solana and KPR (pointers)

- **ShareOFT mesh:** LayerZero only — per-creator `Registry4626.setRemoteOFTPeerBytes32` before finalize. No Twin adapter. Runbooks: `docs/_internal/operations/solana/`.
- **Solana hook program:** `programs/creator-share-hook/` on mainnet — upgrade/runbook in `docs/agent-context/archives/infra-ops.md`.
- **KPR:** `cd kpr && tsx runner.ts` — Twin relay workflows retired July 2026. Details: `docs/agent-context/archives/infra-ops.md`.

Provisioner host/SSH details are intentionally out of repo — use team secrets and internal runbooks.

## Learned Facts and Preferences

Tiered under **`docs/agent-context/`**:

- [INDEX.md](docs/agent-context/INDEX.md) — tier map, MCP/skills, validation shortcuts
- [preferences-active.md](docs/agent-context/preferences-active.md) — Tier 1 (~80 lines, inlined in `agent-context-budget.mdc`)
- [archives/](docs/agent-context/archives/) — on-demand domain runbooks
- [prompt-templates.md](docs/agent-context/prompt-templates.md) — copy-paste task templates (also `.cursor/commands/`)

Legacy [docs/agent-learned-facts.md](docs/agent-learned-facts.md) redirects to the index.
