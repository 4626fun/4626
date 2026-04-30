# AGENTS.md

## Cursor Cloud specific instructions

### Architecture overview

4626 (4626.fun) is a monorepo with two primary dev loops:

| Component                     | Directory           | Toolchain                      | Dev command                  |
| ----------------------------- | ------------------- | ------------------------------ | ---------------------------- |
| **Frontend SPA + Vercel API** | `frontend/`         | Vite 7 + React 19 + TypeScript | `pnpm -C frontend dev`       |
| **Solidity contracts**        | `contracts/` (root) | Foundry (forge)                | `forge build` / `forge test` |

Optional components: XMTP Keepr Agent (`frontend/server/agent/eliza/`), CRE automation (`cre/`), Docs site (`apps/docs-site/`), Solana program (`programs/creator-share-hook/`).

### Default working style

Use `.cursor/rules/product-builder-workflow.mdc` as the generic feature-shaping workflow: clarify the problem, reduce the MVP, design a simple system, choose the smallest proven stack, break work into steps, then implement and iterate. Prefer speed, clarity, and maintainability over enterprise-style overengineering.

### Rule precedence

`AGENTS.md` is the repo-level authority for architecture, operations, and cross-cutting product invariants.

Path-scoped or topic-scoped rules in `.cursor/rules/*.mdc` are authoritative inside their scope and override the generic builder workflow when they conflict. In particular:

- `.cursor/rules/product-builder-workflow.mdc` owns the generic feature-shaping workflow when no stricter domain rule applies.
- `.cursor/rules/4626 secur-agent guardrails for repo-native implementation.mdc` adds generic secure-automation process guidance without overriding product-specific invariants.
- `.cursor/rules/ERC-4337-Wallet-Invariants.mdc` owns canonical wallet/account selection.
- `.cursor/rules/csw-agent-lifecycle.mdc` owns CSW delegation, XMTP identity, ERC-8004 identity, and deploy-session wallet mechanics.
- `.cursor/rules/waitlist-onboarding-simplicity.mdc` owns waitlist/signup simplification inside its scoped auth and waitlist files.
- `.cursor/rules/frontend-seo-core.mdc` and `.cursor/rules/frontend-seo-internal-linking.mdc` own frontend SEO policy inside `frontend/`.

Do not preserve legacy routes, aliases, or compatibility shims just for backward compatibility. When replacing a path or interface, migrate active callers and remove the old surface unless product explicitly requires a staged rollout.

### Security and trust-boundary rules

These are repo-level guardrails for internal automation, deploy orchestration, and Telegram identity flows.

- **Deploy status and preflight paths must be read-only.** They may gather config, build payloads, and report readiness, but they must not provision infrastructure, register tokens, or perform onchain mutation as a side effect.
- **Internal Solana mutation paths must require machine auth.** Do not fall back to ambient user sessions, cookies, wallet auth headers, or admin login state for route provisioning, token registration, or other mutating Solana setup.
- **Telegram Mini App link completion must require fresh Mini App session proof.** Shared secrets or server-side toggles must not bypass Telegram session verification for public Telegram-launched linking flows.
- **Telegram link-start tokens must be single-use, claim-bound, and consumed on success.** Do not leave link intents replayable across users or sessions until expiry.
- **Group-scoped Telegram message actions must be owner-scoped.** Deletion, refresh, pause, or other controls on shared bot messages and live cards must only be executable by the actor who created or owns that surface, unless product explicitly wants collaborative controls.

### Running services

- **Frontend**: `cd frontend && pnpm dev` starts Vite at `http://localhost:5173/`. Hot-reloads on file changes. The app is in waitlist mode by default — unauthenticated routes redirect to `/` or show the waitlist modal.
- **Contracts**: `forge build` to compile, `forge test` to run all 72+ Solidity unit tests. Foundry must be on PATH (`$HOME/.foundry/bin`).
- **XMTP Keepr agent**: production runs on Railway only, as a single primary XMTP consumer. Do not introduce a standby or second live deploy target unless product explicitly changes that operating model.
- **Telegram is not the live Eliza transport.** Telegram bot updates and Mini App flows remain separate from the Railway XMTP runtime, even when they reuse shared agent-core helpers.

### Lint / test / typecheck

Standard commands are documented in `frontend/package.json` scripts:

- `pnpm -C frontend lint` — ESLint (clean — 0 warnings, 0 errors)
- `pnpm -C frontend typecheck` — TypeScript (clean — 0 errors)
- `pnpm -C frontend test` — Vitest (289 tests, all passing)
- `forge test` — Foundry unit tests (72 tests, all passing)
- `pnpm security:local` — optional sweep: `forge test`, frontend lint/typecheck/test, Semgrep on `frontend/api` + `frontend/server/_lib` (needs Docker). Script: `scripts/security-audit-local.sh`.
- **Security CI:** `.github/workflows/security-scanning.yml` — gitleaks, pnpm audit summaries, **blocking** Semgrep on that API surface, Slither (report-only). PRs: `.github/workflows/dependency-review.yml` (high+ vulns, runtime **and** development scopes; enable Dependency graph per `docs/audits/github-supply-chain-setup.md`). Index: `docs/audits/README.md`.

### Non-obvious caveats

- **Git submodules are required** for Foundry compilation. Run `git submodule update --init --recursive` after cloning. The submodule tree is deep (Uniswap CCA/Liquidity Launcher pull in many transitive submodules) and takes ~2 minutes.
- **Two separate pnpm lockfiles**: root `pnpm-lock.yaml` (Solidity deps like OpenZeppelin, LayerZero) and `frontend/pnpm-lock.yaml` (frontend deps). Install both: `pnpm install` at root, then `pnpm -C frontend install`.
- **Foundry path**: After installing via `foundryup`, binaries are at `$HOME/.foundry/bin`. Add to PATH or invoke directly.
- **`.env` files**: Copy `.env.example` at root and `frontend/.env.example` for local dev. Most env vars are optional for basic frontend dev — the app runs without external service credentials but wallet/auth features require Privy, Supabase, etc.
- **API routing**: Vercel API routes go through `frontend/api/[...path].ts` dispatching to `frontend/api/_handlers/_routes.ts`. New endpoints must be registered in the static route map (no dynamic imports).
- **`pnpm.onlyBuiltDependencies`** is configured in `frontend/package.json` to avoid interactive `pnpm approve-builds` prompts.
- **Waitlist/marketing page on localhost**: By default, `localhost` is treated as the "app" domain and redirects unauthenticated users to `4626.fun`. To test the waitlist/marketing page locally, set `VITE_HOST_MODE_OVERRIDE=marketing` and `VITE_MARKETING_ORIGIN=http://localhost:5173` in `frontend/.env`. This is already configured in the Cloud Agent `.env`.
- **Railway-only XMTP primary**: the Eliza/XMTP runtime is intended to have exactly one live Railway primary with `AGENT_RUNTIME_ROLE=primary`, `AGENT_CONSUME_XMTP=true`, and `numReplicas = 1`. Local standby mode is for inspection only. If a Railway redeploy crashes, expect downtime until restart or rollback; there is no default standby failover.
- **Keep app-shell providers quiet by default**: route-scoped or user-intent-gated mounts are preferred over eager global mounts. Current examples: `/api/auth/admin` only resolves on `/admin`, `AccountContextProvider` is mounted in the layout subtree rather than the outer app root, and chat/XMTP only mounts after explicit chat intent or deep-link context.
- **`/swap` should not background-refresh idle quotes**: quote on input changes, then rebuild stale quotes during review/submit if needed. Avoid reintroducing timer-driven idle re-quote loops.
- **Do not add new ad hoc session polling around `useSiweAuth()`**: session restoration already dedupes shared `/api/auth/me` work. New auth consumers should reuse the existing hook/provider path instead of layering separate refresh effects.
- **Railway primary must fail fast if misconfigured**: standby mode or `AGENT_CONSUME_XMTP=false` on Railway is a startup error, not a healthy passive mode. When Postgres is configured, the DB-backed runtime lease lock is expected to stay enabled for the Railway primary.
- **Transaction routing has two `executionMode` values and four send modes.** User-initiated frontend code paths branch on `executionMode: 'canonical' | 'eoa'` (exported from `frontend/src/lib/uniswap/walletMode.ts`). `txRouter` (`frontend/src/lib/tx/txRouter.ts`) selects one of: `sendCalls` (EIP-5792 atomic batching on CSW sub-account connectors), `canonical4337` (ERC-4337 UserOp via CDP paymaster — strongest fallback for CSW), `canonicalDirect` (direct `executeBatch` on the CSW contract), or `eoaDirect` (standard `eth_sendTransaction`, one tx at a time). Only `eoaDirect` is non-atomic (approval and swap sequential). Canonical approval+swap and parent-CSW fallback paths must stay locked to `canonical4337`; do not fall back to direct gas sends when sponsorship is denied. Full routing table: Section 5 of `docs/4626-connection-methods.md`.

### Token identity invariants

Creator Coins and Share tokens are separate assets and must never be treated as interchangeable.

- **Creator Coin address != Share token address.** Do not infer one from the other without explicit contract lookup.
- **Creator Coin UI must use creator-coin artwork.** Never apply Share-token (vault-framed) branding to Creator Coin token rows, selectors, or quote surfaces.
- **Share token UI may use vault-branded renders.** Share token imagery can include framed/derived branding from vault context.
- **Token-kind intent must be explicit in image pipelines.** When requesting token images, pass token kind context (`creator` vs `share`) so caches and fallbacks do not cross-contaminate.
- **Token search/dedup logic must preserve token type.** If symbol/name collides, keep token-kind metadata so rendering and labels remain correct.

### Account and auth invariants

These are product-level rules, not implementation suggestions. Future auth/onboarding work must preserve them unless product explicitly changes direction.

Canonical wallet/account selection is defined in `.cursor/rules/ERC-4337-Wallet-Invariants.mdc`, and delegated signer / agent lifecycle mechanics are defined in `.cursor/rules/csw-agent-lifecycle.mdc`. This section defines the product-facing account states layered on top of those rules.

Canonical architecture reference: `docs/4626-connection-methods.md` — describes the three connection methods (CSW, external EOA, Telegram), the three-tier CSW address model (`profiles.csw_address` → `profiles.base_sub_account` → `profiles.primary_embedded_eoa`), and the `executionMode` / send-mode routing table.

Wallet-role model for user-facing docs and copy:

- **Canonical CSW (parent) = identity + custody source of truth.**
- **Base sub-account = default user execution sender on app surfaces.**
- **Privy embedded EOA = primary signer for the sub-account lane.**
- **Connected external EOA = fallback/override signer lane.**
- **Privy server wallet = delegated server-side signer for automation/deploy-session tracks.**
- Keep this role split explicit in docs and UI copy; do not collapse signer role into canonical identity language.

- **Verified email is the canonical 4626 identity and recovery key.**
- **No 4626 account is considered fully created until email OTP verification completes.**
- **All entry points converge to the same account model**: website, Base app, and Telegram must resolve into one 4626 account model keyed by verified email.
- **Privy remains the auth/session backend** for email OTP and account sessions, so the embedded EOA is created through Privy during signup/auth.
- **Normal web auth should present three entry paths**:
  - email OTP first/default
  - Base Account as the wallet-native path
  - Zora cross-app as the Zora-native path
- **Telegram is a linked identity and acquisition channel, not the canonical recovery key.**
- **Telegram Mini App verification must stay enabled for Telegram-launched flows.** Its role is to prove Telegram user/chat context, not to replace verified email as the canonical account key.
- **Telegram onboarding must collect and verify email inside the Mini App.** After OTP success:
  - if the email is new, create the 4626 account through Privy
  - if the email already exists, attach Telegram to that existing account
- **Base and Zora are login/linking paths, not separate account systems.** They must still resolve into the same verified-email-based 4626 account model.
- **The Base referral flow is an acquisition path into the same canonical-wallet policy, not a second canonical-wallet model.** If a user is routed through Base app to finish CSW setup, they still return to the single canonical wallet/account rules defined in `.cursor/rules/ERC-4337-Wallet-Invariants.mdc`.
- **`linked` / `waitlist-joined` is not the same as wallet-ready.** Verified email plus successful channel binding or waitlist join can complete without immediate CSW owner confirmation.
- **`execution-ready` / wallet-ready is defined per execution track.** Product features that require wallet execution must check the right track for the user's connection method:
  - **User-initiated frontend execution-ready (CSW path, `executionMode === 'canonical'`)**: canonical parent CSW recorded in `profiles.csw_address`, Privy embedded EOA present in `profiles.primary_embedded_eoa`, and an app-scoped sub-account created via `wallet_addSubAccount` with its signer configured to the embedded EOA via `setToOwnerAccount()` — persisted in `profiles.base_sub_account` through `POST /onboarding/register-sub-account`. The sub-account is the `msg.sender` for user-initiated swaps and vault interactions; the parent CSW remains the asset-holding account visible on Base/Zora.
  - **User-initiated frontend execution-ready (external EOA path, `executionMode === 'eoa'`)**: external wallet connected via wagmi, `profiles.primary_wallet` populated, no sub-account (EOAs are not smart contract wallets). The EOA address is the execution address.
  - **Server-side agent / deploy-session execution-ready**: unchanged — follows the direct owner delegation path in `.cursor/rules/csw-agent-lifecycle.mdc`. The parent CSW is the ERC-4337 sender with a Privy server wallet delegated via `addOwnerAddress`. This track is orthogonal to the user-initiated frontend path above.
- **Features that require wallet execution must stay gated until the account is `execution-ready` on the correct track.**
- **If the user does not yet have a CSW, route them to Base app with the referral flow, then resume user-initiated sub-account setup (or, for server-side automation, owner-installation) when they return.**
- **Cross-account Telegram conflicts must not auto-merge silently.** If a Telegram identity is already attached elsewhere, force explicit recovery/merge UX.
- **Website sign-in should use email OTP by default.** Do not assume Telegram is the primary website login flow unless product explicitly changes this rule later.
- **Do not preserve legacy auth paths just for backward compatibility.** If an old path conflicts with these invariants, remove or migrate it.

### Canonical Lane Terminology

All docs, UI copy, commit messages, and code comments that reference 4626's value lanes must use the canonical terms defined in `docs/audits/creatorvault-business-logic-core-structure-audit.md`. These lanes have separate triggers, units, custody domains, and authorities — using generic terms creates product-truth ambiguity.

- **`tradeFeeCollector`** — destination domain for ShareOFT/hook **trade-fee** routing (native ShareOFT `SwapOnly -> non-SwapOnly` plane and the optional hook fee plane).
- **`creatorCoinPayoutRecipient`** — CreatorCoin **external earnings** routing (`payoutRecipient`). In router mode this feeds `PayoutRouter.convertAndQueue(...)` and ends in holder PPS accretion, not a direct creator treasury spend.
- **`creatorTreasury`** — destination for the **creator ongoing lane** from `CreatorGaugeController.creatorShareBps`. This lane is disabled by default (`creatorShareBps = 0`). If enabled, `creatorTreasury != 0x0` is enforced by `setFeeSplit(...)` / `setCreatorTreasury(...)`.
- **`jackpotCustodian`** — the gauge (`CreatorGaugeController.jackpotReserve`, vault-share units). Gauge custodies reserves but does not select winners.
- **`jackpotPayoutAuthority`** — `CreatorLotteryManager`. Manager selects winners and calls `payJackpot(...)` into the gauge. Custody vs authority must always be split in docs and code.
- **Voter/protocol branch** — `protocolShareBps` from gauge split. Preferred route: `VoterRewardsDistributor.notifyRewards(...)`. Fallbacks: protocol treasury, then jackpot fallback. Do not call this "protocol share = treasury only".

**Naming policy:**

- **Never** use bare `payoutRecipient` in docs/UI; always qualify as `tradeFeeCollector` or `creatorCoinPayoutRecipient`. Onchain identifiers named `payoutRecipient` are fine in contract code but must be contextualized in docs.
- **Never** use "externalRevenueRecipient"; say `creatorCoinPayoutRecipient`.
- **Never** say "creator earnings" without naming the lane (`creator ongoing treasury lane` or `external revenue accretion lane`).
- **Never** conflate jackpot custody and payout authority into a single "lottery wallet".
- "Buy+sell fee" claims are **conditional on active hook configuration**. Do not present ShareOFT native transfer fees as guaranteeing a sell fee; the sell-side fee plane requires the hook to be enabled and aligned.

**Canonical completion truth:** vault settlement completion lives in `/api/cre/keeper/sweep` (`frontend/api/_handlers/cre/keeper/_sweep.ts`). `cre/actions/cca-finalization.action.ts` is non-canonical and must not write DB `settledAt`. The five mandatory invariants in the audit §5.1 gate `settledAt`:

1. `CCALaunchStrategy.feeRecipient == expected tradeFeeCollector` and `CreatorShareOFT.gaugeController == expected tradeFeeCollector`.
2. CreatorCoin `payoutRecipient` equals expected mode target; in router mode `PayoutRouter.burnStream` matches expected burn stream.
3. If `creatorShareBps > 0`, `creatorTreasury != 0x0`.
4. `sweepCurrency` + `migrate` both succeed; hook config either applied or explicit `awaiting_owner_hook_config` stage with no settled mark.
5. DB `settledAt` is only written when the completion stage is `completed`.

Keep `KEEPER_ENFORCE_COMPLETION_INVARIANTS` and `DEPLOY_ENFORCE_PHASE2_INVARIANTS` enabled in production. Any override must emit an operational alert and must not be accompanied by public "fully live" claims.

## Telegram Mini App Flow Rules

The Telegram Mini App account-link/onboarding flow must follow strict architectural rules to remain reliable inside Telegram WebView.

### State Management

- The Telegram flow must use a **single authoritative state machine**.
- Keep one reducer-backed source of truth plus one **state-scoped effect layer**.
- Multiple `useEffect`s are acceptable when they are keyed by explicit machine state and guarded against re-entry.
- Route/bootstrap helpers may admit the Telegram surface, but they must not mutate machine state mid-session.
- UI must render directly from explicit machine state.
- Do not use derived booleans like `isVerified`, `isReady`, etc. across multiple sources.

### Authentication & OTP

- OTP must be handled **inline inside the Mini App**.
- Do NOT use Privy modal or popup flows inside Telegram WebView.
- OTP verification success is **not equivalent** to account/session readiness or `execution-ready` wallet status.
- A distinct `wait_for_privy_sync` phase must exist.

### State Integrity

- Do not allow regression from post-verification states back to email collection unless explicitly triggered by failure/expiry.
- Do not reset email or OTP input due to unrelated auth/session updates.
- Do not remount or key major UI trees on unstable async values.

### Routing

- `/telegram/link` must not fall back into normal waitlist-gated app logic when valid Telegram context is present.
- Telegram flows must remain isolated from generic app routing decisions.

### Telegram Identity

- Telegram session proof must be verified before entering the flow.
- Telegram identity must only be bound **after canonical account resolution via verified email**.

### Current Preserved Link Path

The currently working Telegram -> Privy -> canonical-account path is preserved in
`docs/operations/telegram-canonical-link-preservation.md`.

Any simplification must keep this semantic order:

1. verify fresh Telegram Mini App proof
2. perform inline email OTP inside the Mini App
3. wait for verified-email account readiness + Privy sync explicitly
4. ensure the active Privy user is linked to Telegram
5. complete backend persistence and consume any single-use, claim-bound link-start token on success when that tokenized path is in play
6. keep canonical CSW / embedded-EOA rules intact without requiring immediate CSW owner confirmation for link success

`Link success` here means the account/channel link can complete and the user can continue the Telegram or waitlist flow.

It does **not** mean the account is `execution-ready`. Features that require wallet execution remain gated until the correct track completes per the Account and auth invariants and `.cursor/rules/ERC-4337-Wallet-Invariants.mdc` — sub-account setup for the user-initiated frontend CSW path, connected EOA for the user-initiated EOA path, or owner delegation for server-side agent/deploy-session automation per `.cursor/rules/csw-agent-lifecycle.mdc`.

Do not replace this with hidden provider magic, modal auth, webhook-only
binding, or a shortcut that binds Telegram before verified-email account
resolution.

### Anti-Patterns (STRICTLY FORBIDDEN)

- Privy popup/modal usage inside Telegram WebView
- Multiple competing sources of truth for verification state
- Hidden retries masking state transitions
- Rendering “verified” UI before canonical account state is confirmed
- Route guards mutating flow state mid-session

Authoritative implementation notes live in:

- `docs/operations/telegram-canonical-link-preservation.md`
- `frontend/docs/account-auth-invariants.md`
- `frontend/docs/waitlist-accounts-architecture.md`

### Solana program deployment

The `creator-share-hook` Anchor program lives at `programs/creator-share-hook/`. It is deployed to Solana **mainnet**.

| Detail              | Value                                                                             |
| ------------------- | --------------------------------------------------------------------------------- |
| Program ID          | `EjpziSWGRcEiDHLXft5etbUtcJiZxEttkwz1tqiuzzWU`                                    |
| Upgrade authority   | `7Qi3WW7q4kmqXcMBca76b3WjNMdRmjjjrpG5FTc8htxY` (from `SOLANA_PRIVATE_KEY` secret) |
| ProgramData         | `DojrYy5obEk2w9ZMpX1bLFHU4rrZqYQsZJZaXFxFGKFU`                                    |
| Binary              | `programs/creator-share-hook/target/deploy/creator_share_hook.so`                 |
| Data capacity       | 372,488 bytes (extended with 80KB headroom beyond current 345KB binary)           |
| Anchor.toml cluster | `mainnet` (see `[provider]` section)                                              |

**Upgrade procedure:**

1. Decode `SOLANA_PRIVATE_KEY` (base58) to a Solana CLI JSON keypair file (64-byte secret key array).
2. `solana config set --url https://api.mainnet-beta.solana.com --keypair <deployer-keypair.json>`
3. If the new `.so` is larger than the current program data, run `solana program extend EjpziSWGRcEiDHLXft5etbUtcJiZxEttkwz1tqiuzzWU <extra-bytes>` first.
4. `solana program deploy programs/creator-share-hook/target/deploy/creator_share_hook.so --program-id EjpziSWGRcEiDHLXft5etbUtcJiZxEttkwz1tqiuzzWU`
5. The deployer wallet needs enough SOL for the temporary buffer (~2.4 SOL for a ~345KB binary, refunded after upgrade) plus any extension rent.

**Non-obvious caveats:**

- `SOLANA_PRIVATE_KEY` is a **base58-encoded** secret key, not a JSON array. Convert before use with Solana CLI (the CLI expects `[u8; 64]` JSON array format).
- The program keypair at `target/deploy/creator_share_hook-keypair.json` does **not** match the deployed program ID — do not pass it as `--program-id`. The deployed program ID is hardcoded in `declare_id!()` in `src/lib.rs`.
- Solana CLI 3.x is installed at `~/.local/share/solana/install/active_release/bin/solana`; Anchor CLI 0.31.1 is at `/usr/local/cargo/bin/anchor`.
- The Anchor IDL is at `target/idl/creator_share_hook.json`. Regenerate with `cd programs/creator-share-hook && anchor idl build > ../../target/idl/creator_share_hook.json`.

### Solana bridge on-chain config (Base mainnet)

The deployment batcher is configured for Solana bridging:

| Contract                              | Config                | Value                                         |
| ------------------------------------- | --------------------- | --------------------------------------------- |
| Batcher (`0xB87CBb...c84`)            | `solanaBridgeAdapter` | `0x2414b595c4f18532A5836B6e2E6d536832c572e8`  |
|                                       | `solanaDestination`   | `0x5f38e34e...d4d1`                           |
| SolanaBridgeAdapter (`0x2414b5...e8`) | `owner`               | `0xB05Cf0...FdD` (= `PRIVATE_KEY` secret)     |
| Protocol treasury (Safe 1-of-2)       | address               | `0x7d429e...f2d3`                             |
|                                       | owners                | `0xB05Cf0...` (`PRIVATE_KEY`), `0x2C1Af6B...` |

**Key access:** `PRIVATE_KEY` secret is owner of both the adapter and the treasury Safe. To call `setSolanaConfig` on the batcher, execute via the Safe (threshold=1, so single-owner signature suffices). See git history for the `cast send` pattern used.

**Deploy behavior (current):** Solana transfer setup is handled out-of-band. `finalizePhase2` does not require `meteoraAlphaVault`/`solanaIxs`, and deployment flow should pass `bytes32(0)` + empty ixs for those fields.

**Out-of-band Solana path:** Route provisioning, token registration, and Meteora ix payload generation run via the provisioner and `/api/deploy/registerSolanaBridgeToken`, separate from phase-2 finalize.

**Planned model:** treat Solana allocation as strategy-stage orchestration (alongside Charm/Ajna) rather than phase-2 finalize logic.

### Provisioner operations

Operational access details for the Solana route provisioner (hostnames, IPs, SSH users, service names, and filesystem paths) are intentionally excluded from this repository.

- **Access management:** Use team-managed secrets and approved access channels only.
- **Operational runbook:** Use the internal runbook for restart/status procedures and environment locations.
- **Repo hygiene:** Do not commit live infrastructure endpoints, SSH commands, or root-level host details.

### Solana integration: per-creator setup

The Solana route provisioner (`frontend/server/solana-provisioner/`) handles the full Solana-side setup via HTTP endpoints:

| Endpoint              | Purpose                                                                                                    |
| --------------------- | ---------------------------------------------------------------------------------------------------------- |
| `POST /provision`     | Creates bridge route via `wrap-token` CLI; with `SOLANA_AUTO_POOL=1`, also creates DLMM pool + Alpha Vault |
| `POST /setup-creator` | Creates Token-2022 mint with Transfer Hook + TransferFeeConfig, initializes PDAs                           |
| `POST /create-pool`   | Creates Meteora DLMM pool for the creator's share token                                                    |
| `POST /meteora-ixs`   | Builds Meteora Alpha Vault deposit instructions                                                            |

**Single-token architecture:** Meteora DLMM rejects Token-2022 mints with TransferHook extension (`UnsupportedMintExtension`). The deploy uses only the bridge-wrapped standard SPL token (created by `wrap-token`) for DLMM pools, Alpha Vault deposits, and trading. Transfer Hook functionality (lottery entries, fees) requires a separate Token-2022 mint if needed.

**Full per-creator Solana setup sequence (with `SOLANA_AUTO_POOL=1`):**

1. `POST /provision` — creates bridge-wrapped SPL token + route, then auto-creates DLMM pool + Alpha Vault
2. (Optional) `POST /setup-creator` — creates Token-2022 mint with Transfer Hook, inits CreatorConfig/PendingEntries/WinnerRecord PDAs
3. Register Meteora vault config in DB or `METEORA_CREATOR_ALPHA_VAULT_MAP_JSON` env

**Meteora vault config** is resolved via `frontend/server/_lib/meteoraAlphaVaultConfig.ts`:

- Priority 1: DB table `creator_meteora_alpha_vaults` (auto-created on first query)
- Priority 2: `METEORA_CREATOR_ALPHA_VAULT_MAP_JSON` env var (JSON map keyed by creator token address)

### CRE keeper bots

Keeper bots in `cre/` relay data between Solana and Base. Install: `cd cre && npm ci`.

**Solana-specific workflows:**

- `keepr-solana-relay-entries` — relays lottery entries from Solana → Base (every 30s)
- `keepr-solana-settle-fees` — settles Solana fees → Base gauge (every 5min)
- `keepr-solana-winner-relay` — relays Base lottery wins → records on Solana
- `keepr-solana-price-monitor` — monitors Solana vs Base price deviation

**Start:** `cd cre && tsx runner.ts` (runs all workflows). Dry-run: `DRY_RUN=true tsx runner.ts`.

**Required secrets** (see `cre/secrets.example.env`):

- `KEEPR_PRIVATE_KEY` — Base signer (EOA or ERC-4337 owner)
- `SOLANA_KEEPER_KEYPAIR` — Solana payer/authority (base58)
- `SOLANA_RPC_URL`, `BASE_RPC_URL` — RPC endpoints
- `SOLANA_BRIDGE_ADAPTER` — Base bridge adapter address
- `SOLANA_CREATOR_MINTS` — comma-separated Solana mints to monitor
- `SOLANA_SHARE_OFT_MAPPING` — JSON: Solana mint → Base ShareOFT
- `SOLANA_CREATOR_COIN_TO_MINT_MAPPING` — JSON: Base creator coin → Solana mint
- `SOLANA_TWIN_TO_PUBKEY_MAPPING` — JSON: Base Twin contract → Solana pubkey

**CRE TypeScript baseline is currently clean** (`pnpm -C cre typecheck` passes). Keep this as a no-regression launch gate.

## Learned User Preferences

- For waitlist and account-setup surfaces, stay on the product brand palette (blue primaries with dark charcoal or near-black backgrounds) rather than purple or ad hoc accent colors unless design explicitly calls for something else.
- Prefer progressive disclosure in multi-step onboarding: emphasize the active step, collapse or quiet completed steps, and avoid duplicate titles or redundant headers on loading screens.
- Nest optional substeps (for example extra channel binding) under the primary step with a compact expandable affordance instead of introducing separate numbered steps when the flow is still one phase.
- Keep secondary actions such as Previous Step and Retry visually quieter than primary blue actions.
- When Zora linking is the active context, prefer showing the Zora handle as the human-readable identity label over a truncated wallet address that does not match what the user expects for their canonical smart wallet.
- For waitlist/onboarding UI, prefer cleaner card treatments with minimal framing; remove heavy outer borders when they add visual noise.
- For exported skill/context documentation packs, prefer comprehensive self-contained writeups that assume the reader does not have direct repository access.
- Loading and progress labels must match the actual action context — reserve action verbs (e.g., "Deploying...") for when the action is executing, not for page navigation or initial load, keep unrelated controls (for example `Reset`) from switching labels during other in-flight actions, and prefer `PixelWaveLoader`-style motion for waitlist/account-setup loading over text-scramble or four-square placeholders that feel laggy or off-brand.
- For metric/analytics charts on content-detail and vault surfaces, prefer a single multi-series chart with toggleable series (price/liquidity/volume/fees) over separate per-metric charts — render volume as bars, fees as cumulative bars, and liquidity as bars split by the two pool tokens. Charts must fill the full component area without feeling cramped, and axis value labels must sit on the correct axis (Y-axis values along the vertical axis, not rendered as a horizontal row below).
- For waitlist/account surfaces, consolidate closely related panels (for example "Linked Identities" and the link-to-earn points panel) into one compact section and use real platform icons instead of text labels for channel rows.
- For nav bars, prefer edge-to-edge layout over centered max-width, text-only links without hover backgrounds, and no visual separators between nav and content.
- Prefer aggressive simplification passes in large folders: identify and remove or archive unnecessary files (including `.ts`/`.tsx`), not just documentation, to reduce complexity.
- During broad cleanup/refactor sweeps, prefer sustained autonomous execution with minimal pause-and-confirm loops, and parallelize with subagents to expedite when the sweep spans many files or folders.
- When a task comes with an attached implementation plan and pre-created todos, execute against that plan without editing the plan document, and use the existing todo set (marking items in-progress/completed) instead of recreating tasks.
- Keep waitlist point awards as even integers so the 50% referral passthrough stays whole, and prefer framing the recurring daily earn action as a social share on X / Farcaster / Telegram rather than a "lottery check-in"; per-submission AMOE entry points should stay removed.
- Rename user-facing labels that describe CSW owner-install flows to match the sub-account-first architecture (e.g. "Enable 4626 signing" rather than "Connect Coinbase Smart Wallet"), and keep this sub-account activation the highest-value waitlist points milestone.
- Do not rewrite or redesign the premium token icon renderer — keep the existing deterministic Sharp-based pipeline, composition, premium bezel, soft glow, and recessed inner chamber, and make targeted refinements only. Never let a rectangular crop block, white background patch, or broad banner escape the frame; keep the ticker/signature bottom-right in black and always inside the frame; optically center the subject inside the chamber without flattening its depth.
- Do not redesign `/swap` into a new layout — keep the Uniswap-like information architecture and only improve hierarchy, spacing, microcopy, states, accessibility, and responsiveness within it. Prefer token/protocol logos (Coinbase, Base, Uniswap) over text labels for wallet/chain affordances, surface a "Powered by Uniswap" mark, keep wallet/address rows to one line, and use a draggable percent slider (DeFiLlama-style) rather than 25/50/75/100 buttons.
- For Telegram bot multi-step or progress responses, prefer a single editable message (e.g. one deploy progress list with per-contract green-check updates and basescan-hyperlinked addresses) over spamming new messages; menu selections should replace the prior message and provide a Back affordance. Keep command naming consistent across features (`/help`, not `/fullhelp`) and avoid gating Telegram-native flows on the Mini App when not required.
- For Hermit/AlfaChat creative commands, prefer clean replacement over legacy aliases — `/meme` replaces `/hermitimg`, and old Hermit command surfaces should be removed rather than kept as compatibility shims unless product explicitly asks for a staged transition.
- For agent-facing / share / OG endpoints, prefer structured JSON with short, deterministic, high-signal strings and an explicit missing-context fallback envelope (`ok: false`, `error`, `missing: [...]`) instead of guessing fields.
- Use "waitlist" for app-access queue copy and "whitelist" for vault-deployment eligibility copy; surface the one-deploy-per-wallet-per-deployment-version cap explicitly in deploy UI.
- Agent-install / delegate-signing surfaces (Zora content coin, landing page, in-app prompts) must avoid alarming verbs like "install", "connect", or "drain"; prefer softer framing such as "delegate signing authority to the 4626 agent", "add co-signer", "authorize", or a neutral queue/process term instead of "drain" — keep ticker/title choices in that register too (e.g. `$agent` / "agent 4626" rather than "AGENT INSTALL").
- In the top-right account chrome, the primary identity shown should be the connected external EOA (Rabby / MetaMask / Base App wallet) rendered with ENS or Basename and the matching profile picture, with the canonical CSW surfaced separately (via its own basename where one exists). Do not display the Privy embedded EOA as the primary identity — it is a delegated signer, not the user-facing account.
- After shipping requested changes, the user frequently expects immediate `commit` + `push` execution (and often asks for merge/PR follow-through) rather than stopping at a local diff summary.
- For CSW owner-setup and deploy flows, prefer click-first Base App deep-link/prolink or canonical self-auth signing lanes; avoid external-EOA fallback paths, and if canonical signing is unavailable, fail with explicit guidance rather than forcing long manual EOA signature sequences.
- On Deploy UI surfaces, prefer a canonical always-visible stage timeline with plain-language phase labels/status and explicit disabled states, rather than hiding or ambiguously marking stages as "optional."
- For bonding-curve visualizations, prefer green candlestick bodies for the bonding-curve spread with Sudoswap overlays, and keep direct chart interactions (mouse-wheel zoom around cursor plus click-drag horizontal panning).
- When requesting infrastructure migrations/cutovers, the user may explicitly prefer a hard cutover over staged coexistence and accepts downtime if it simplifies execution.

## Learned Workspace Facts

- Isolated feature work often uses `git worktree add` under `/.worktrees/` at the repo root; that directory is gitignored via `.gitignore`.
- `frontend/src/config/wagmi.ts` sets `multiInjectedProviderDiscovery: false` on `createConfig` to avoid eager EIP-6963 multi-provider discovery that can trigger extension `requestProvider` races against non-writable `window.ethereum` getters when several wallets are installed.
- Perplexity-ready skill packages live under `docs/perplexity/perplexity-skills/` as one-folder-per-skill bundles with a `SKILL.md` entrypoint, and are commonly shared as `.zip` archives.
- Feature flags are centralized in `frontend/src/lib/featureFlags.ts` using a typed `FeatureFlag<T>` registry (11 flags across 4 categories), with `FlagToolbarBridge` in Layout for Vercel Toolbar integration and `/api/flags/evaluate` + `/api/flags/discover` endpoints for Vercel Flags dashboard resolution.
- `/api/uniswap/quote` and `/api/uniswap/swap` proxy endpoints require an authenticated 4626 session principal; `useSwapExecution` gates quote requests behind session hydration to avoid 401 errors. `/swap` quote display is read-only and should require session + execution address, not full `executionReady`; submit/build remains gated on `executionReady`.
- `GET /api/waitlist/stats` serves live waitlist count data for urgency display; waitlist capacity uses configurable 100-slot tiers with dynamic "Only X spots remaining!" messaging.
- Canonical CSW owner-install sponsorship accepts `addOwnerAddress` self-calls for the authenticated Privy embedded EOA without requiring deploy-session signer state; keep deploy-session checks scoped to deploy-session automation paths.
- `frontend/src/lib/aa/` and `frontend/src/lib/uniswap/` are cross-cutting client utilities with multiple feature consumers; keep them under `src/lib/` rather than relocating into individual `src/features/*` folders.
- `pnpm -C frontend guard:frontend-boundaries` enforces that `frontend/src/components/ui` has no imports from `src/features/`, complementing the existing `guard:server-core-boundary` check (`scripts/check-frontend-boundaries.mjs` / `scripts/check-server-core-boundary.mjs`).
- Mega-file decomposition pattern: extract pure, side-effect-free logic into sibling `*Helpers.ts` / `*Utils.ts` modules next to the parent file (e.g. `deployVaultHelpers.ts`, `telegramLinkHelpers.ts`, `adminOpsHelpers.ts`, `coinbaseErc4337Telemetry.ts`, `xmtpHelpers.ts`, `telegramTradingHelpers.ts`, `elizaSwarmRoles.ts`) rather than moving across feature boundaries; keep runtime-bound state (React hooks, DB clients, XMTP/Eliza lifecycle) in the parent.
- `/swap` wallet gating uses a pure state machine `deriveSwapConnectGate` in `frontend/src/lib/swap/connectGate.ts` plus a `SwapConnectGate` component; the connect CTA is a native `<button class="btn-accent">` (CDS `Button` can swallow `onClick` in this path), and the wallet-required path uses wagmi `connectAsync` with the shared preferred-connector helper instead of Privy `connectWallet`/`login`. `<SwapCard>` only mounts when the gate resolves to `ready`. Balance labels in canonical mode read from the canonical CSW (`profiles.csw_address`) even when the execution sender is the app-scoped sub-account.
- Sponsored canonical/paymaster swaps cannot sell native ETH directly because the paymaster path cannot sponsor `tx.value`; `/swap` blocks that embedded canonical path and offers `Switch Sell to WETH` so the sponsored ERC-20 approval/swap path can continue. Native ETH sells still require a funded external signer or explicit wrapping first.
- `/api/onboarding/bootstrap` and `/api/accounts/me` both expose `executionTrack`, `baseSubAccount`, and `privyEmbeddedEoaIsOwnerOfCanonicalCsw` as the source of truth for execution-track decisions; clients must read these fields rather than recompute canonical-vs-sub-account routing from wallet state.
- `/accounts` redirects to `/waitlist`; the advanced account-setup controls live in `WaitlistAdvancedSection` mounted inside the waitlist page (no separate `/accounts` UI).
- `referral_passthrough` is a first-class `waitlist_points` source written by `recordReferralPassthrough` in `frontend/server/_lib/onboarding/waitlistPoints.ts`; it credits referrers with 50% of every point the referee earns, and every scoring query (`waitlistLeaderboard.ts`, `waitlist/_position.ts`, `waitlist/_referrer.ts`, `accountsIdentity.ts`) must include this source. Invariants, all enforced in code:
  - **One hop only.** The exempt set is derived from the exhaustive `REFERRAL_FAMILY_EXEMPT: Record<Extract<WaitlistPointSource, 'referral_${string}'>, true>` map — adding a new `referral_*` source to the union without listing it there is a TypeScript compile error, not a runtime regression.
  - **50% floor.** `Math.floor(amount * REFERRAL_PASSTHROUGH_FRACTION)` — keep caller amounts even integers (the AGENTS.md user preference) so no point is lost to the floor.
  - **Bounded amount.** Both `awardWaitlistPoints` and `recordReferralPassthrough` reject anything above `MAX_AWARD_AMOUNT = 10_000`; callers passing larger values are treated as bugs.
  - **Strict integer IDs.** `signupId` / `referrerId` / `refereeSignupId` must pass `Number.isInteger(...) > 0`; fractional or string-coerced values are rejected before touching the DB.
  - **Collision-safe `source_id`.** Use `buildPassthroughSourceKey(refereeSignupId, source, sourceId)`; it returns the natural composite when it fits in 256 chars and falls back to `<prefix>#<sha256>` otherwise. Never `.slice(0, 256)` a composite key — distinct awards could dedupe under `ON CONFLICT DO NOTHING`.
  - **Observable failures.** Passthrough errors do not block the referee's award, but they emit a structured `console.warn('waitlist_points.passthrough_failed', { refereeSignupId, source, message })` instead of being silently swallowed — a persistent failure should be alertable.
  - **Reciprocal referrals are allowed.** A↔B pairs each earn passthrough on the other's organic awards, never on passthrough rows (compile-time exempt), so there is no compounding. Block at referral-code claim time if product ever wants to forbid this.
- AMOE ↔ waitlist points bridge: `awardAmoeCheckinPoints` in `frontend/server/_lib/lottery/amoeWaitlistPoints.ts` is called from `claimDailyTwitterCheckin` in `frontend/server/_lib/lottery/lotteryAmoe.ts`; AMOE entry submissions no longer award waitlist points.
- Uniswap pool-history fetch falls back to Zora `getCoinSwaps` via `/api/zora/coinHistory` (handler `frontend/api/_handlers/zora/_coinHistory.ts`) to derive OHLCV candles when the Uniswap subgraph has no data points; the fallback is built into `fetchPoolHistory` in `frontend/server/_lib/uniswap/hooks.ts`, and the endpoint must stay registered in both `_routes.zora.ts` and the Vite dev proxy in `frontend/vite.config.ts`.
- CDS (`@coinbase/cds-web@8.66`) gotchas — all are recurring crash/perf footguns, treat as no-regression: (a) `GradientStop` offsets must be strictly ascending (`domain.min` first, `domain.max` second) and degenerate `min === max` domains must nudge `max` slightly higher, otherwise the library emits a `Gradient: stop offsets must be in ascending order` spam that tanks the browser (hit on `/portfolio` and content-detail charts); (b) `Tag` `colorScheme` is restricted to a small set of valid values, so `Badge.tsx` remaps `info`→`blue` and `warning`→`yellow` — passing `teal`/`orange` destructures undefined and triggers an infinite render loop; (c) Vitest requires `server.deps.inline: [/@coinbase\/cds-/]` in `vitest.config.ts` because CDS ships extension-less ESM imports that Node's strict ESM loader rejects; (d) `pnpm.overrides` in `frontend/package.json` pin React 19 and Framer Motion 12 onto every `@coinbase/cds-*` package (which declare React 18 peer deps).
- Run targeted Vitest files with `npx vitest run <file>` — `pnpm -C frontend test -- --run <file>` still executes the full suite in this workspace.
- The waitlist wallet-readiness gate still lives in `ownerInstallMapping.ts` and predates the sub-account-first model in `docs/4626-connection-methods.md`; migrating this controller from owner-install to sub-account-first is a known outstanding gap between the rules/docs and live code, and should be treated as feature work rather than a docs fix.
- The production Vercel project for this app is `akita-llc/4626` (https://vercel.com/akita-llc/4626/deployments); the docs site is a separate project. Verify the linked Vercel project before triggering deploys — cloud agents have repeatedly deployed to the wrong project.
- Vercel CLI deploys for this monorepo should use archive upload (`vercel deploy --archive=tgz`, plus `--prod` for production) because raw file upload can exceed Vercel's file-count/size limits before build starts.
- `/api/deploy/config` must remain available to any authenticated deploy user, not admin-only; the Deploy page uses this public runtime config to replace stale build-time contract addresses such as legacy `DeploymentBatcher` values after env/config cutovers. The response now includes `creatorVaultBatcherConfigError: string | null` — when non-null, `DeployVault` surfaces a dismissible runtime warning banner before dry-run; consumers of this endpoint should surface this field rather than failing silently.
- Vault-deploy product invariants: the Deploy UI currently enforces a 100,000,000 Creator Coin first deposit for new vault launches (stricter than the 50,000,000 onchain floor), and initial CCA seeding is 99% creatorCoin / 1% USDC (not a balanced pair); each wallet is capped to one deploy per `deployment version` (current copy: "v1.2.3x"), enforced on the Deploy page.
- Accounts page is expected to list all owners of the canonical Zora CSW (`profiles.csw_address`) with an optional revoke control; any canonical-CSW automation must reuse the existing deploy-session Privy embedded-EOA signer pattern rather than silently calling `addOwnerAddress` to add new owners — the "why is the deploy flow trying to add a new owner to my CSW?" complaint is a recurring regression signal.
- XMTP new-conversation search resolves a Basename suffix (e.g. typing `akita` matches `akita.base.eth`) and should render the Base App display name and profile picture for the canonical Coinbase Smart Wallet address, not a shortened hex address. Canonical CSW remains preferred for DMs, but if production XMTP says the canonical CSW has no inbox and the original Basename-resolved address does, fall back to that original reachable address and keep it as the chat peer.
- ETHOS score display in the chat rail is currently availability-cache scoped: scores render for `/api/v1/chat/availability` rows after `POST /api/v1/chat/presence/heartbeat` or chat search caches `chat_directory_profiles.ethos_score`. Recent XMTP conversations and curated agent rows need separate score hydration before showing `ScorePill`.
- Curated external XMTP/Base agents are not 4626 account peers. `.base.eth` agent entries must resolve directly to the Basename owner address and direct-address agents should open as-is; do not run them through canonical CSW remapping meant for human 4626/Zora profiles.
- `InboxValidationFailed` and XMTP sync-success exceptions indicate a broken local XMTP installation/inbox state, not a normal send failure. Close the client, mark messaging as requiring `Reset local XMTP state`, and clear this browser's XMTP OPFS cache/signing hints instead of repeatedly retrying with the same bad client. After reset/reconnect, stale DM windows can separately hit `conversation_not_found`; recover those by reopening the DM from the peer address/inbox id, rekeying the window, and retrying once.
- Base App CSW owner-action probes and self-call owner-add flows should use the prepared-calls lane (`wallet_prepareCalls` → sign the replay-safe/prepared payload → `wallet_sendPreparedCalls`). Signing the raw `userOpHash` directly is not sufficient for Coinbase Smart Wallet owner validation.
- The deterministic premium token icon renderer is a production TypeScript + Sharp module that exports `renderPremiumTokenIcon({ size, sourceImage?, symbol? }): Promise<Buffer>`; composition (black rounded card, blue aura glow, white-to-blue bezel, recessed inner chamber, subtle top-breakout for suitable subjects, deterministic output) is considered stable — edits must be targeted refinement passes, not rewrites.
- ShareOFT is no longer bridged to Solana; the Solana side uses a standard SPL token created by the bridge `wrap-token` path, routed via `SolanaBridgeAdapter`, and consumers/docs should not reintroduce a ShareOFT→Solana bridge path.
- **Profile-merge infrastructure** is installed (`supabase/migrations/20260419200000_profile_merge_infra.sql`): `privy_user_aliases(privy_user_id PK → profile_id)` + `profiles.merged_into_profile_id` tombstone column. Every profile lookup by privy_user_id or wallet MUST chase `merged_into_profile_id` via the pattern:
  ```sql
  WITH matched AS (SELECT id, email, merged_into_profile_id FROM profiles WHERE <predicate> LIMIT 1)
  SELECT p.id, p.email FROM matched m
  JOIN profiles p ON p.id = COALESCE(m.merged_into_profile_id, m.id)
  WHERE p.merged_into_profile_id IS NULL LIMIT 1;
  ```
  Without this, wallet-match queries can resurrect tombstones (fragmented identity comes back from the dead when wallet sync writes `privy_user_id` onto a tombstoned row). Current tombstone-aware lookups: `accountsIdentity.listProfileIdsForPrivyUser`, `accountsIdentity.readUnifiedScore`, `walletSync.findExistingProfile`, `walletSync.findProfileByProfileColumns`, `profileSync.upsertProfileByWallet`, `lotteryAmoe.resolveOrCreateProfileForWallet`. Any new profile-lookup code must follow this pattern.
- **`INSERT INTO profiles` must be preceded by a canonical-collision check** whenever the call site has a Privy user id in scope. Use `assertNoWalletPrivyCollision({ db, privyUserId, privyUser })` (or `{ ..., evmAddresses }` when you already have a classified address list). Current guard sites: `api/_handlers/waitlist/_bootstrap.ts` (runs before upsert), `wallet/walletSync.ts:insertOrUpdateProfile` (runs before new-row INSERT only). Skipping this guard re-opens the split-identity bug where a wallet-login Privy user creates a fragment while a canonical email-verified profile already owns the same EOA.
- **`assertNoWalletPrivyCollision` must filter synthetic shells.** Emails matching `%@wallet.4626.fun` or `%@noemail.4626.fun` are pseudo-accounts (AMOE wallet-first claims, legacy wallet-login synthesis). They do NOT count as canonical — a real-email signup that shares a wallet with a shell must be allowed to proceed. The guard has this filter inline; do not remove it.
- **Admin profile-merge lives at `POST /api/admin/profiles/merge`** with dual auth: admin session + `CRON_SECRET`. Dry-run by default; `{ mode: 'execute', confirm: 'MERGE-PROFILES' }` required to write. CLI operator: `pnpm -C frontend exec tsx scripts/merge-profiles.ts --from=<id> --to=<id>`. Merge primitive in `frontend/server/_lib/identity/profileMerge.ts` is idempotent per step; re-running is safe.
- **New public tables require RLS.** Supabase's linter (`rls_disabled_in_public`) blocks on any public table without RLS. Pattern: `ALTER TABLE public.<name> ENABLE ROW LEVEL SECURITY;` in the migration, plus a restrictive deny-all policy `CREATE POLICY "deny_public_rest" ... AS RESTRICTIVE FOR ALL TO public USING (false) WITH CHECK (false);` to document "server-only" intent and satisfy the `rls_enabled_no_policy` info-level lint. Never use `FORCE ROW LEVEL SECURITY` — the table owner is `postgres` which is the same role our server connects as, and forcing breaks server writes. Server `DATABASE_URL` connections come in as `postgres` via the Supabase pooler and bypass RLS; `anon`/`authenticated` (PostgREST) default-deny when no permissive policies exist.
- **Profile merge moves arch-b tables too.** `executeProfileMerge` in `frontend/server/_lib/identity/profileMerge.ts` moves `points`, `referral_conversions`, `profile_wallets` (Step 3b, counted as `walletRowsSwept` in `ProfileMergeResult`), `command_issuer_execution_context` (re-key or drop based on whether `to` already has one), and `command_issuer_daily_spend` (sum per-ymd) in addition to the referee repointing. Any NEW table that has `profile_id` as FK and represents per-profile state must be added to the merge primitive, otherwise merges leave orphaned rows on tombstones.
- **`profile_wallets` role flags must be forced FALSE on any sweep/salvage INSERT.** Partial unique indexes (`profile_wallets_one_canonical`, `_one_embedded_eoa`, `_one_primary`, `_one_canonical_solana`, `_one_operational_solana`) enforce at most one canonical row per profile. When moving rows from a tombstone (or any non-authoritative profile) onto the canonical target, set `is_primary`, `is_canonical_smart_wallet`, `is_embedded_eoa`, `is_canonical_solana_wallet`, and `is_operational_solana_wallet` to FALSE on the migrated rows, tag with `metadata.salvagedFromTombstoneId` for audit, and use `ON CONFLICT (profile_id, address) DO NOTHING`. The target's own canonical row stays authoritative; never displace it from a secondary attachment.
- **`walletSync.findExistingProfile` is alias-aware.** It consults `privy_user_aliases` before falling back to `profiles.privy_user_id`, mirroring `accountsIdentity.listProfileIdsForPrivyUser`. Without this, Rabby/EOA-first sign-in whose fresh Privy user id is aliased onto a canonical email-verified profile will create a new fragment instead of resolving back to the canonical row. Any future profile-lookup-by-privy-user-id code path must go through the alias cascade, not a direct `profiles.privy_user_id = ?` query.
- **Solana bridge-wrapped mint naming is lowercase-coerced, strict-parity.** `normalizeWrapTokenName` / `normalizeWrapTokenSymbol` in `frontend/server/_lib/onchain/solanaBridgeTokenMetadata.ts` lowercase the Base ERC-20 `name()` / `symbol()` before passing them to `wrap-token`, so every creator's Solana display ends up uniformly lowercase (e.g. `"akita"` / `"akita"`) regardless of Base casing. The mint pubkey is a PDA of those seeds, so the lowercase form IS the on-chain Solana identity — changing casing later would require a different mint address and full re-provisioning (new adapter, new DLMM pool, new Alpha Vault). The provisioner request body does NOT accept `tokenName` / `tokenSymbol` overrides; `ProvisionBody` in `frontend/server/solana-provisioner/index.ts` intentionally omits them. Byte-length checks run both BEFORE and AFTER lowercasing to guard against Unicode case folding that changes UTF-8 byte count (e.g. Turkish dotted I). Old name aliases `normalizeExactWrapTokenName` / `normalizeExactWrapTokenSymbol` remain as deprecated re-exports for import stability.
- **`SolanaBridgeAdapter` is plain `Ownable` (not upgradeable); Solana-side rebrands deploy a fresh adapter and swap the default.** `SolanaBridgeAdapter.registerToken` hard-reverts if `tokenToSolanaMint[baseToken] != 0`, so re-registering a creator is impossible on an existing adapter. Canonical address is the `solanaBridgeAdapter` in `BASE_DEFAULTS` (`frontend/src/config/contracts.defaults.ts`) / `VITE_SOLANA_BRIDGE_ADAPTER`. One historical predecessor at `0x90F578A4e23c1cB8DDFE63fd496ED7F4474f2b00` carries a legacy AKITA→`HuY4…9ouR` mapping from the pre-strict-parity era and is left on-chain for auditability; `docs/operations/solana-bridge-naming-invariant.md` has the full migration record. No live code references it.
- **Solana naming invariant is canonical-documented and parity-verifiable.** `docs/operations/solana-bridge-naming-invariant.md` is the single source of truth for the lowercase-coerced Solana mint naming policy, PDA derivation formula, AKITA v1→v2 migration history, per-drift runbook, and Meteora integration runbook. Shared PDA derivation lives in `frontend/server/_lib/onchain/solanaWrappedMintPda.ts` (`deriveWrappedMintPda`) with golden fixtures pinned to live mainnet state (legacy `HuY4…9ouR` and strict-parity `9JWh…LJdp` for AKITA). To check any creator's parity end-to-end (Base ERC-20 → adapter mapping → Solana on-chain metadata), run `pnpm -C frontend exec tsx scripts/verify-solana-mint-parity.ts --creator 0x<creator>` — exit 0 = parity, exit 2 = drift with a named reason. The programmatic entry point `verifyCreatorSolanaMintParity` in the same `_lib/onchain` folder returns a structured `{matched, drift[]}` result and is safe to call from scripts, CI, or status endpoints.
- **Premium strategy features are opt-in per creator, paid, gated by server-verified proof-of-payment.** `docs/operations/creator-strategy-features.md` is the canonical spec. Every productive strategy is a $100 paid feature: Charm (`charm_active_lp`), Ajna (`ajna_sleeve`), and Solana bridge (`solana_bridge_strategy`) are **deploy-gating** and must be paid BEFORE deploy; `solana_meteora_alpha_vault` is a **post-deploy** $100 add-on that requires `solana_bridge_strategy` to be active first. **Three payment paths**, all landing in the same `creator_strategy_features` row with a `payment_source` discriminator: (1) `usdc_base` — creator sends a plain USDC `transfer` + POSTs tx hash to `/api/creator/strategy/activate`; verifier matches `Transfer(from=session,to=treasury,value>=effective)` log regardless of tx shape. (2) `x402_base` — creator POSTs `/api/creator/strategy/x402-activate` without a tx hash; server replies HTTP 402 with payment requirements; client signs EIP-3009 `TransferWithAuthorization`, base64s it into `X-PAYMENT` header, resubmits; server relayer (`X402_RELAYER_PRIVATE_KEY` or fallback `PRIVATE_KEY`) broadcasts `usdc.transferWithAuthorization(...)` and pays Base gas — single round trip, gasless for creator; `UNIQUE (payment_from, x402_authorization_nonce)` prevents replay. (3) `stripe` — creator POSTs `/api/creator/strategy/stripe/checkout`, server creates a Stripe Checkout Session (USDC price → USD cents via `floor(priceUsdc / 10_000)`), client redirects, Stripe webhook `checkout.session.completed` hits `/api/creator/strategy/stripe/webhook` which finalizes the row; Stripe fees apply (~$3.20 on a $100 sale). **Discounts are supported operator-side** via `creator_strategy_price_overrides`: insert a row scoped to `creator_token` (per-vault) or `wallet_address` (per-buyer) with a `price_usdc_override` (and optional `expires_at`). `findActivePriceOverride` prefers creator-scoped match first then wallet-scoped; `applyPriceOverride` clamps effective price to `min(override, catalog)` so a malformed override can never raise prices. All three payment paths honour overrides: USDC clamps `minAmount`, x402 clamps `max_amount_required` in the 402 response, Stripe converts the discounted USDC into cents. **At least one deploy-gating feature is required** — `DeploymentBatcher.deployPhase3Strategies` reverts with `InvalidWeight` when `charm+ajna+solana == 0`, `computeStrategyWeights` returns `{ok:false, reason:'no_paid_strategies'}`, and `/api/creator/strategy/list` returns `deployPlan.deployable = false` with `blockedReason = 'no_paid_strategies'`. **Weight scaling:** paid strategies split a fixed `PRODUCTIVE_ALLOCATION_BPS = 9_000` budget evenly, idle stays at `DEFAULT_IDLE_RESERVE_BPS = 1_000` regardless of count — so 1 strategy = 9_000 bps (90 %), 2 = 4_500 each, 3 = 3_000 each. 9_000 is cleanly divisible by 1/2/3 so there are never rounding remainders; totals always sum to exactly 10_000. Payment: client sends USDC `transfer` on Base to `protocolTreasury` (overridable via `CREATOR_STRATEGY_FEATURE_USDC_TREASURY`), POSTs `{creatorToken, featureKey, paymentTxHash}` to `/api/creator/strategy/activate`. `verifyUsdcPayment` is authoritative on the decoded `Transfer(from=session, to=treasury, value>=price)` log — tx shape (multicall, UserOp, router) doesn't matter, only the log. Deploy-side: `resolveCreatorStrategyPlan(db, creatorToken)` in `frontend/server/_lib/creatorStrategy/resolveWeights.ts` returns a tagged `{ok:true,plan}` or `{ok:false,reason:'no_paid_strategies',...}`. The patched `DeploymentBatcher.deployPhase3Strategies` skips the factory call + strategy deploy + `addStrategy` for any strategy with `weightBps == 0`; `StrategyCodeIds` for skipped strategies may be `bytes32(0)`; `solanaKeeper`/`solanaBridgeAddress` are only required when Solana is paid. Uniswap V3 CREATOR/USDC pool creation stays unconditional so future Charm activation has a pool ready, so single-strategy deploys must still pass `initialSqrtPriceX96 > 0` when the pool doesn't pre-exist. DB is `creator_strategy_features` with `UNIQUE (creator_token, feature_key) WHERE status IN ('pending','active')` and `UNIQUE (payment_tx_hash)`. `pending` == "paid but provisioner hasn't run yet"; the resolver counts both `pending` and `active` as paid so creators can deploy immediately after their USDC clears. **Post-deploy strategy addition is supported by vault + script + dispatcher.** A creator who starts with 1 strategy can add more later: operator runs `pnpm -C frontend exec tsx scripts/activate-strategy-post-deploy.ts --creator 0x… --feature <key>` which prints the Safe calldata (CREATE2-deploy the missing strategy + `setStrategyWeight(existing, newLowerWeight)` + `addStrategy(newStrategy, newWeight)`). Operator submits via app.safe.global from the protocolTreasury Safe, then the normal rebalance keeper handles TVL redistribution over the next few ticks (over-allocated strategy deallocates, vault idle grows, keeper pushes idle into the new strategy). Expected convergence 1-4 h depending on strategy liquidity. All three payment handlers (`_activate.ts`, `_x402-activate.ts`, `stripe/_webhook.ts`) call `dispatchProvisioning` in `server/_lib/creatorStrategy/provisioner.ts` after row insertion — for v1 that's an enqueue-only stub that logs intent + returns an operator-targeted note; any failure is non-fatal (the `pending` row is the source of truth, operator polls). **Creator-facing UI is live at `/creator/strategy/features`** ([`frontend/src/pages/CreatorStrategyFeatures.tsx`](frontend/src/pages/CreatorStrategyFeatures.tsx)) — reads `/api/creator/strategy/list`, renders a card per catalog feature with USDC-tx-hash / x402 / Stripe-checkout payment buttons; unpaid deploys show an amber "activate at least one" blocker. **Mainnet state (CreatorOVault redeploy, 2026-04-29):** active `DeploymentBatcher` is `0x004684670d284EF607E1B2424fcf8ccBda8ef828`, paired with `UniversalBytecodeStoreV2` `0x77e53f656Ee3c5A962e9DA2Fc97EA1A35ae9b4d5`, `UniversalCreate2DeployerFromStore` `0x808f2Cf1b7e7afaC561dd9d2A2aA20be15EEb3fd`, `CreatorOVaultCoreModule` `0xF670590D1070B1C30E8da76176E841b6e753fDb9`, `CreatorOVaultStrategiesModule` `0x7cCFA3E1c7eF5ADab9C9676430c27244f8c8ec7A`, `CreatorOVaultAdminModule` `0x48512Db9cDddC3f259036605A8eBD3C8e5dE1598`, `Phase3Helper` `0x7e4b2dd557bA62FD1Dd5f72CBf5FFAAaaB8A468c`, `DeploymentBatcherPhase2Module` `0x9794735D53dA4f0884eA43E2764A7E4dd2a38826`, `UniV4Helper` `0xCd10BEcd96c13b63cEff49A646Eca1fe6D2f2CC7`, and `UtilsHelper` `0xb79615C6B128E953347fcd6061DeaEc867482EEC`. All three OVault modules report `CreatorOVaultModuleStorage.current`, the new bytecode store is seeded with the frontend deploy code IDs, and the previous split batcher `0x32403a647e73e04ae42b02bdd1ade9c88698fd0c` remains a broken predecessor/remapped fallback. Paymaster-side `gateRequestedStrategyWeights` IS now wired into `api/_handlers/paymaster/_paymaster.ts`: Phase 3 UserOps are rejected with `paywall_weight_gate:<reason>` or `paywall_db_not_configured` before sponsorship if requested weights don't match the resolved paid plan; skipped strategies' codeId/keeper args may be zero. AKITA stays pinned to the v1.8.3 batcher at `0xcDbEeB76…C4F` (grandfathered, unaffected). **Still pending:** (a) Stripe end-to-end test against a real Stripe signature (signature verification path is confirmed; real payload handling depends on body-parser behavior), (b) x402 in-dapp wallet-signing helper (currently the UI surfaces raw 402 requirements for manual EIP-3009 signing), (c) automated Safe broadcast from the activation script (today the script prints calldata; operator submits via Safe UI). Adding a new feature = catalog entry + union member + runbook subsection in the doc; no migration.
- **`strategyMaxAssets` is a governance trust ceiling, not an allocation target.** Treat it as "maximum valuation the vault is willing to trust until governance/operator review updates the cap" and avoid static policy formulas like "30% of initial TVL + buffer" as durable guidance.
- **`solana_ovault_mesh` is not a Phase 3 vault strategy allocation.** Treat it as a Phase 2b routing entitlement; there is no `setStrategyMaxAssets` or `addStrategy` calldata to apply for this non-strategy entitlement.
- **Active chunked bytecode store seeding must include frontend deploy bytecode IDs as well as Forge artifacts.** The deploy page/paymaster use `frontend/src/deploy/bytecode.generated.ts` `DEPLOY_BYTECODE` code IDs; if the store is seeded only from current Forge artifacts, preflight can report missing bytecodes for contracts such as `OFTBootstrapRegistry`, `CreatorShareOFT`, `PayoutRouter`, `CreatorOVaultWrapper`, `CreatorGaugeController`, `CCALaunchStrategy`, `CreatorOracle`, `VaultShareBurnStream`, `AjnaERC4626Vault`, `ERC4626StrategyAdapter`, and `SolanaStrategy` even when similar artifact bytecode is present. `OFTBootstrapRegistry` must implement `getEidForChainId` because `CreatorShareOFT` resolves its LayerZero EID in the constructor.
- **UniversalCreate2DeployerFromStore is ACL-gated.** Direct deploy calls are allowed only from its owner or `authorizedDeployers`; Base App/canonical-CSW deploy flows must authorize the CSW with `setAuthorizedDeployer(csw, true)` or rotate to a deploy-capable batcher before retrying. The `/dev/csw-signature-probe` page includes a Create2 deployer authorization section for this owner action.
- **Deploy preflight bytecode/config reads may fall back to Base public RPC, but execution must not.** `DeployVault.tsx` uses a read-only `https://mainnet.base.org` fallback when the browser wallet RPC returns empty bytecode for live Base contracts; actual deploy transactions still route through the normal wallet/UserOp path.
- **AlfaClub Creator Coin/FriendKey LP is a secondary-market ERC20/ERC1155 AMM, not an AlfaClub primary-curve writer.** `contracts/alfaclub/AlfaCreatorKeyLPFactory.sol` and `AlfaCreatorKeyPool.sol` pair Creator Coins with AlfaClub FriendKey tokenIds using xy=k LP shares; they should transfer existing keys/coins only and must not call `FriendKey.buyShares`, `sellShares`, stake/unstake, or `FriendPool` write methods. The exploratory curve/LP convergence chart lives at `docs/alfaclub-lp-vs-bonding-curve-chart.html`. **Pool fee bps are room-type-scoped:** Social rooms = 3 bps, Trading rooms = 690 bps (6.9%); apply the correct fee constant when computing LP cost quotes or pool invariant checks.
- **Bridge ↔ Meteora integration is two decoupled hops.** `SolanaStrategy.rebalanceToSolana` only moves CREATOR tokens from the strategy contract to the `SolanaBridgeAdapter` on Base — it does NOT cross the bridge. The actual bridge + Solana-side destination routing is the `keepr-solana-rebalance` keeper workflow (`cre/actions/keepr-solana-rebalance.action.ts` + `cre/workflows/keepr-solana-rebalance.workflow.ts`, currently a stub gated behind `KEEPR_SOLANA_REBALANCE_EXECUTE=1`). Routing policy: if a creator has an `enabled=true` row in `creator_meteora_alpha_vaults`, dispatch `adapter.bridgeToSolanaWithIxs(creator, amount, alphaVault, ixs[])` for atomic bridge + Alpha Vault deposit; otherwise dispatch plain `adapter.bridgeToSolana(creator, amount, destination)` to a custody wallet. Per-creator Meteora infra (DLMM pool + Alpha Vault) costs ~3.5 SOL and is optional — creators without Meteora still bridge successfully; their SolanaStrategy accounting uses keeper NAV reports rather than on-chain DLMM valuation. Runbook in the canonical doc.
- **`resolveCommandIssuerContext*` in `frontend/server/_lib/wallet/commandIssuerContext.ts` is tombstone-aware.** Both `ByAddress` and `ByProfileId` chase `merged_into_profile_id` and filter tombstones. Future arch-b sub-account rollout (`docs/arch-b-sub-account-design-addendum.md`) will add `sub_account_address` / `parent_csw_address` / `spend_permission_*` columns to this table — the resolver's tombstone filter must be preserved through that migration. The addendum is design-only today; when implementing, gate behind `ARCH_B_SUB_ACCOUNTS_ENABLED` and keep the `smart_wallet_address = sub_account_address, parent_csw_address = funding CSW` invariant so legacy rows (sub_account_address IS NULL) continue to work unchanged.
- **Production host split is two SPA shells, not one.** `https://4626.fun/*` serves `index.html` (marketing-mode shell that waitlist-routes unauthenticated users) and `https://app.4626.fun/*` serves `app.html` (app-mode shell where Deploy, Portfolio, and other authenticated routes actually mount). Deploy/app deep links must use `https://app.4626.fun/...` — pointing users to the bare `4626.fun` host for `/deploy/vault` or similar authenticated routes is a recurring regression that silently lands them on the marketing shell. Auth uses the HttpOnly `cv_auth_session` cookie with `Domain=.4626.fun` on production hosts so sessions survive marketing-shell ↔ app-shell navigation; localhost/dev remains host-only, and session reads tolerate duplicate legacy host-only cookies during rollout. The canonical origin pair is documented in `frontend/.env.example` via `VITE_PRIVY_ALLOWED_ORIGINS` and `DEPLOY_SOLANA_REGISTRATION_ORIGINS`.
- **Waitlist UI must never synthesize a "full" state from missing stats.** `/api/waitlist/stats` returning null/500 or a zero capacity is an unknown state, not a "0 / 0 — Current round full" state. `frontend/src/features/waitlist/WaitlistFlow.tsx` must hide progress/urgency copy when stats are unavailable rather than fabricating a full-round banner — the "Current round full. Next approvals unlock the next batch." regression came from defaulting to 0/0 when the stats endpoint was 500ing.
- **Zora-provisioned Coinbase Smart Wallets are owned by the Privy embedded EOA inside Zora's Privy app — NOT by the user's external Rabby/MetaMask EOA, and NOT necessarily by our app's Privy embedded EOA.** `CoinbaseSmartWallet.addOwnerAddress(address)` is `MultiOwnable.onlyOwner` (`msg.sender == address(this)`), so adding a new owner requires a self-UserOp signed by an existing owner — a plain `eth_sendTransaction` from any external EOA reverts, even if that EOA is "connected". The natural client-side shape would be Privy's cross-app connect (`@privy-io/cross-app-connect`'s `toPrivyWalletProvider({ providerAppId, chains, smartWalletMode: true })` as a wagmi v2 connector), but in the current Zora configuration that path is **Bucket 2 — read-only**: `privy.zora.co/cross-app/connect` accepts the Connect handshake (wallet-address disclosure) and then `privy.zora.co/cross-app/transact` fails silently because the Zora provider has read-only enabled for our requester app. The wagmi connector in `frontend/src/lib/wallet/zoraGlobalWalletConnector.ts` (constant `ZORA_GLOBAL_WALLET_CONNECTOR_ID`, conditionally registered in `frontend/src/config/wagmi.ts`) and the diagnostic probe at `/dev/zora-connector-probe` (`frontend/src/pages/dev/ZoraConnectorProbe.tsx`, routed via `ACCOUNT_ROUTES`) exist to diagnose this — keep the feature flag `zoraGlobalWalletConnectorFlag` (env `VITE_ZORA_GLOBAL_WALLET_CONNECTOR`) **off by default** and do not ship a signing path through this connector until Zora opens transact for our app id. Do not reintroduce "plain Base tx calling `addOwnerAddress`" language in UI copy or docs — it silently misleads users about what the flow actually does. The canonical owner-install flow is the pre-wired Base-Account / UserOp path: `POST /api/onboarding/preview-agent-owner` (unauth, iframe-safe, returns `txRequest`) and `POST /api/onboarding/provision-agent-owner` (authenticated) drive the state machine in `frontend/src/lib/wallet/onboardingWallet.ts` (stages: `prepare_calls`, `userop_typed`, `userop_nontyped`, `send_calls`, `add_sub_account`, `confirm_owner`), consumed via `useAccountSetupController`. Also: **never assume a Zora CSW needs an owner install just because it's Zora-linked.** Some users already have our app's Privy embedded EOA as an owner (from earlier direct flows); the install CTA must be gated on an on-chain `CoinbaseSmartWallet.isOwnerAddress(embeddedEoa)` check against `profiles.csw_address`, not on "Zora linked + CSW known."
- **Signer-gate consumers must source live Privy wallets from `useWallets()`, not from `extractPrivyWalletsFromUser(privyUser)`.** The `privyUser` object only carries `{ address, walletClientType }` metadata; the runtime provider state that the `privyEmbeddedEoaCanSign` / `canonicalSignerGate` logic needs (e.g. to know whether the embedded EOA is currently active and can actually sign) only surfaces through the `useWallets()` React hook. `frontend/src/pages/Swap.tsx` was the outlier — it derived the embedded-EOA signer from the metadata-only extraction and got stuck in `embedded-wallet-cannot-sign` even when the embedded EOA was already a confirmed owner of the canonical CSW — and has been switched to `useWallets()` as primary source (metadata extraction kept as fallback). `DeployVault.tsx` and `LaunchCoinCard.tsx` already followed this pattern. Any new page that gates on "can the embedded EOA sign right now?" must read from `useWallets()`, expose a recovery CTA that calls `setActiveWallet(embeddedWallet)`, and treat the metadata extraction as a snapshot-only fallback.
- **`zora-enable/` hosts single-file static HTML artifacts uploaded as Zora content coins (e.g. `agent install`, `feedback`, `signal`, `probe`).** These render inside an iframe on `https://magic.decentralized-content.com/ipfs/<cid>` **without** the `allow-same-origin` sandbox flag, which means: `localStorage` / `sessionStorage` / `document.cookie` all throw, `parent`/`top` are `SecurityError`, the Privy React SDK cannot run (it needs same-origin), WalletConnect's broadcast-channel plumbing frequently fails, and Cloudflare Insights/beacon scripts are blocked by Zora's `script-src-elem` CSP. Only EIP-6963 injected providers (Rabby, MetaMask, Coinbase Wallet extension, Brave) are reachable from inside. Zora's "Link" field on a content coin only accepts a fixed platform list: X, YouTube, TikTok, GitHub (gists work), Substack, Bluesky, Instagram, Farcaster, Wikipedia, Zora, Truth Social, Are.na, arXiv. Thumbnails are generated per-folder via `make-thumbnail.py`; `.glb` uploads require a separate raster thumbnail (Zora rejects `.glb` as its own thumbnail). Keep these artifacts sandbox-compatible — do not add dependencies that assume same-origin, React, Vite, or Privy. Because the sandbox blocks Privy/WalletConnect, the agent-install signing flow itself cannot live inside the Zora artifact — the content coin must only advertise + deep-link into the main `app.4626.fun` install page, which owns the actual `addOwnerAddress` transaction.
- **`indexer/` is the `@4626/zora-csw-indexer` standalone service** that powers targeted agent-install outreach. It scans `ZoraSmartWalletCreated` events on `ZoraAccountManager` (`0x0Ba958A449701907302e28F5955fa9d16dDC45c3` on Base), upserts into Supabase `zora_csw_owners` (`csw_address` PK, `initial_owners`, `current_owners` re-read via `ownerAtIndex(i)` since owners can drift after `addOwnerAddress`), and classifies each owner EOA into `zora_csw_owner_class` via `src/classifyOwners.ts` using a nonce heuristic: `base_nonce == 0 AND mainnet_nonce == 0 → likely_privy_embedded`, otherwise `likely_extension_eoa`. `src/crossReferenceFarcaster.ts` joins each EOA with Neynar verified-addresses to populate `farcaster_fid` / `farcaster_username`. Both tables are RLS-enabled, service-role-only; the indexer owns the sole write path. Prefer classifying top-N-by-`mainnet_nonce` extension owners first when running campaigns. `mainnet.base.org` caps `eth_getLogs` at 10k blocks and rate-limits enrichment — use a paid `BASE_RPC_URL` (Alchemy/QuickNode/matrixed.link). Entry points: `pnpm poc` (recent 100 CSWs), `pnpm enrich` (refresh `current_owners`), plus classify/cross-reference runners in `src/`. Do not reintroduce a Privy-based signing flow inside the Zora content coin — the indexer exists specifically because the sandbox path was abandoned; see `README.md` and `docs/design/sub-account-lifecycle-spec.md`.
- **Production onboarding owner-preview depends on `PRIVY_WALLET_POLICY_ID`.** `createAgentWallet` in `frontend/server/_lib/wallet/privyWalletApi.ts` fail-closes in production when this env var is missing, which causes `/api/onboarding/preview-agent-owner` to error even before owner/install checks. Keep `PRIVY_WALLET_POLICY_ID` set on the live `4626-keepr-agent` service whenever rotating Privy config.
- **`/api/onboarding/preview-agent-owner` now has a CSW-self proof path via ERC-1271.** When `connectedEoa`/`connectedAddress` equals `cswAddress`, callers can provide `ownershipProof { issuedAtMs, message, signature }`; the handler enforces a short freshness window and validates `isValidSignature` (`0x1626ba7e`) against a deterministic message template. The prior EOA-owner path remains unchanged.
- **The Zora outreach pipeline in `indexer/` now includes name/profile enrichment and export scripts.** `pnpm -C indexer names` resolves Basename/ENS into `zora_csw_owner_class`, `pnpm -C indexer zora-profiles` adds Zora handles/display names/creator-coin addresses, and `pnpm -C indexer export:outreach` emits ranked triple-signal CSV/JSON cohorts under `indexer/exports/` for outreach planning. The operator dashboard surface is Google Sheets driven by `indexer/scripts/sheetsOutreachSetup.gs.js` (Google Apps Script) — Sheets is the preferred operating surface over Looker Studio, with Notion sync as an optional destination rather than a replacement.
- **Zora Explore list data does not expose canonical ERC-20 ticker/name fields for creator coins.** In `indexer` workflows, `name`/`symbol` from list responses can mirror creator handles (for example `jessepollak`) instead of on-chain token metadata (for example `$jesse`), so ticker/name truth must come from on-chain `name()`/`symbol()` reads (`fix-profile-metadata`) before outreach ranking/export.
- **Base App in-app browsers can suppress native `window.confirm(...)` dialogs, which makes critical owner actions appear as no-ops.** For account-setup owner flows (notably `Add co-owner`), desktop-only confirm gates are safer than universal confirms; in-app/mobile paths should execute directly and surface explicit inline errors instead.
- **AlfaClub chat bridge supports runtime JWT rotation without process restart.** `alfaclub_runtime_secret` stores short-lived JWT state, admin route `POST/GET/DELETE /api/v1/alfaclub/chat-token` manages rotation metadata, and chat bridge ticks prefer DB token with fallback to `ALFACLUB_CHAT_JWT`.
- **AlfaClub live-room ingest now lands in `alfaclub.chat_ingest` (schema `alfaclub`, not `public`).** `chatBridge` ingests incoming WS room messages into this table via `chatIngestStore`, and schema bootstrap includes a one-time copy path from legacy `public.alfaclub_chat_ingest`.
- **Hermit is the AlfaChat creative/meme lane, distinct from Keepr-critical agent paths.** Keep Hermit flows scoped to creative/meme generation and Pinata/IPFS publishing; do not mix Hermit command behavior into Keepr, deploy, wallet, or other critical automation surfaces.
- **Hermit meme assets should publish through Pinata/IPFS for production.** Do not rely on local `frontend/public` assets as the durable production source. Public Hermit URLs should use `https://4626.fun/ipfs/<cid>`; Vercel rewrites that path through the Pinata gateway origin `https://pinata.4626.fun/ipfs/<cid>`. Public gateway reads do not require gateway keys or IP allowlists.
- **Telegram link-readiness command surface is `/status` (not `/linked`).** Command registry/webhook/menu callback wiring uses `head: 'status'` and `menu:status`, with no backward-compat alias.
- **`svix` must stay pinned to CJS-compatible `uuid` resolution.** To prevent Vercel runtime failures in `@privy-io/server-auth` (`svix` requiring ESM-only `uuid@14`), keep `svix>uuid` overridden to `10.0.0` in both root and frontend package overrides.
- **Base App owner-action prolinks are centralized and wired across setup surfaces.** `frontend/src/lib/base/prolink.ts` is the shared encoder for `wallet_sendCalls`; owner-add flows in `AdminAgentSetup`, `DeployVault` one-time approval, and waitlist advanced `Add co-owner` use this path, and waitlist prefers backend-prepared `txRequest` payloads when available.
- **Single-agent XMTP runtime now enforces one active DB per env.** In `frontend/server/agent/eliza/index.ts`, `makeDbPath({ enforceSingleFileForEnv: true })` archives stale `xmtp-<env>-*.db3` files and orphaned sidecars (`-wal`, `-shm`, `.sqlcipher_salt`) so startup keeps a single active local database path.
- **Privy XMTP signer must not silently trust stale owner-index hints.** `frontend/server/_lib/wallet/privyXmtpSigner.ts` resolves owner index with `allowConfiguredOwnerIndexFallback: false`; invalid `XMTP_AGENT_CSW_OWNER_INDEX` values are treated as advisory and ignored in `eliza/index.ts` so runtime auto-detects the actual owner slot.
- **DeployVault vanity prefix search is track-specific.** In `frontend/src/pages/deploy/DeployVault.tsx`, vault-prefix-only searches use `VITE_VAULT_VANITY_MAX_TRIES` (default 250,000), while combined vault+share vanity search remains capped for bounded runtime.
- **Known split Phase-1 batchers can reject nonzero salt overrides.** `0xe3F9490CfD6bd3D68010405d18Bf772C167E7178` and `0xF941Bb68e4f083f3F531cc598d5C08d0b8FfbA7E` may revert phase-1 calls with `SaltOverrideDisabled()` (`0xe7fdf838`), so deploy planners/session builders must avoid nonzero share salt overrides. Server-side stale-payload normalization must keep the same `...WithSalt` selector family and zero only the override argument; rewriting to an unsalted selector can hit missing entrypoints on deployed batchers.
- **Creator-vault batcher config now fail-closes on deprecated aliases.** `normalizeCreatorVaultBatcherAddress` and `isDeprecatedCreatorVaultBatcherAddress` in `frontend/src/config/contracts.defaults.ts` reject `LEGACY_DEPLOYMENT_BATCHER` (`0x56E8527Bf0824155e1556aED5740366f248B68ca`), `MODULE_MISMATCH_DEPLOYMENT_BATCHER` (`0x32403a647e73e04ae42b02bdd1ade9c88698fd0c`), and `PRE_CURRENT_MODULE_DEPLOYMENT_BATCHER` (`0xe3F9490CfD6bd3D68010405d18Bf772C167E7178`); UI and server paths now share `deploymentBatcherNotConfiguredMessage` from `frontend/src/lib/deploy/deploymentBatcherConfigError.ts` (server re-export in `frontend/server/_lib/onchain/deploymentBatcherConfigError.ts`) so stale env values hard-fail and point to canonical `SPLIT_PHASE1_DEPLOYMENT_BATCHER` (`0x004684670d284EF607E1B2424fcf8ccBda8ef828`). Ops scripts (`frontend/scripts/deploy-local-batcher.ts` and `frontend/scripts/ops/propose-batcher-solana-config-safe.ts`) are also wired to reject deprecated-alias env values so the validation boundary covers all call sites.
- Local dev URL stability expectation: keep app flows on `localhost:5173`/`localhost:5174`; redirects to random localhost ports are treated as regressions to investigate.
- **Deploy dry-run local forks are shared and stateful.** `pnpm -C frontend run dev:deploy-dry-run` uses a local Anvil fork and `frontend/.env.deploy-dry-run.local`; failed or overlapping dry-runs can leave stale listeners, stale env-derived batcher addresses, CREATE2 phase contracts, or dropped impersonation state. Dry-run code should reset/snapshot the fork, reassert impersonation before calls, skip already-complete deterministic phase core only when all expected contracts exist, and fail partial phase state with reset/new-version guidance instead of surfacing raw `No Signer available` or `DeployFailed()` noise.
- **Privy-returned counterfactual smart-wallet addresses must not overwrite `profiles.csw_address`.** The persisted canonical CSW remains the deployed Zora/Coinbase Smart Wallet; bootstrap/wallet-sync paths should preserve it when Privy exposes an undeployed smart-wallet candidate with no Base code, and use Privy wallets as signer/sub-account identities rather than promoting them to the asset-holding CSW.
- **Frontend brand assets are centralized in `frontend/public/favicons/`, `frontend/public/logo/`, and `frontend/public/social/`.** Do not reintroduce root-level generated legacy assets such as `app-icon.png`, `miniapp-hero.png`, `pwa-512.png`, or screenshot PNGs; Mini App/Farcaster hero uses `social/og-image-1200x630.png`, splash/avatar uses `social/social-profile-avatar-1080x1080.png`, and the top-left nav mark uses `/logo/icon-transparent-512.png`.
