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
- **Transaction routing has two `executionMode` values and four send modes.** User-initiated frontend code paths branch on `executionMode: 'canonical' | 'eoa'` (exported from `frontend/src/lib/uniswap/walletMode.ts`). `txRouter` (`frontend/src/lib/tx/txRouter.ts`) selects one of: `sendCalls` (EIP-5792 atomic batching on CSW sub-account connectors), `canonical4337` (ERC-4337 UserOp via CDP paymaster — strongest fallback for CSW), `canonicalDirect` (direct `executeBatch` on the CSW contract), or `eoaDirect` (standard `eth_sendTransaction`, one tx at a time). Only `eoaDirect` is non-atomic (approval and swap sequential). Full routing table: Section 5 of `docs/4626-connection-methods.md`.

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
- Loading and progress labels must match the actual action context — reserve action verbs (e.g., "Deploying...") for when the action is executing, not for page navigation or initial load, and keep unrelated controls (for example `Reset`) from switching labels during other in-flight actions.
- For waitlist and account-setup loading states, prefer `PixelWaveLoader`-style motion and avoid text-scramble or four-square placeholder loaders that feel laggy or off-brand.
- For nav bars, prefer edge-to-edge layout over centered max-width, text-only links without hover backgrounds, and no visual separators between nav and content.
- Prefer aggressive simplification passes in large folders: identify and remove or archive unnecessary files (including `.ts`/`.tsx`), not just documentation, to reduce complexity.
- During broad cleanup/refactor sweeps, prefer sustained autonomous execution with minimal pause-and-confirm loops, and parallelize with subagents to expedite when the sweep spans many files or folders.

## Learned Workspace Facts

- Isolated feature work often uses `git worktree add` under `/.worktrees/` at the repo root; that directory is gitignored via `.gitignore`.
- `frontend/src/config/wagmi.ts` sets `multiInjectedProviderDiscovery: false` on `createConfig` to avoid eager EIP-6963 multi-provider discovery that can trigger extension `requestProvider` races against non-writable `window.ethereum` getters when several wallets are installed.
- Perplexity-ready skill packages live under `docs/perplexity/perplexity-skills/` as one-folder-per-skill bundles with a `SKILL.md` entrypoint, and are commonly shared as `.zip` archives.
- Feature flags are centralized in `frontend/src/lib/featureFlags.ts` using a typed `FeatureFlag<T>` registry (11 flags across 4 categories), with `FlagToolbarBridge` in Layout for Vercel Toolbar integration and `/api/flags/evaluate` + `/api/flags/discover` endpoints for Vercel Flags dashboard resolution.
- `/api/uniswap/quote` and `/api/uniswap/swap` proxy endpoints require an authenticated 4626 session principal; `useSwapExecution` gates quote requests behind session hydration to avoid 401 errors.
- `GET /api/waitlist/stats` serves live waitlist count data for urgency display; waitlist capacity uses configurable 100-slot tiers with dynamic "Only X spots remaining!" messaging.
- Canonical CSW owner-install sponsorship accepts `addOwnerAddress` self-calls for the authenticated Privy embedded EOA without requiring deploy-session signer state; keep deploy-session checks scoped to deploy-session automation paths.
- `frontend/src/lib/aa/` and `frontend/src/lib/uniswap/` are cross-cutting client utilities with multiple feature consumers; keep them under `src/lib/` rather than relocating into individual `src/features/*` folders.
- `pnpm -C frontend guard:frontend-boundaries` enforces that `frontend/src/components/ui` has no imports from `src/features/`, complementing the existing `guard:server-core-boundary` check (`scripts/check-frontend-boundaries.mjs` / `scripts/check-server-core-boundary.mjs`).
- Mega-file decomposition pattern: extract pure, side-effect-free logic into sibling `*Helpers.ts` / `*Utils.ts` modules next to the parent file (e.g. `deployVaultHelpers.ts`, `telegramLinkHelpers.ts`, `adminOpsHelpers.ts`, `coinbaseErc4337Telemetry.ts`, `xmtpHelpers.ts`, `telegramTradingHelpers.ts`, `elizaSwarmRoles.ts`) rather than moving across feature boundaries; keep runtime-bound state (React hooks, DB clients, XMTP/Eliza lifecycle) in the parent.
- `/swap` wallet gating uses a pure state machine `deriveSwapConnectGate` in `frontend/src/lib/swap/connectGate.ts` plus a `SwapConnectGate` component; the `wallet-required` state triggers `privyLogin({ loginMethods: ['wallet'] })` (same pattern `DeployVault` uses) and `<SwapCard>` only mounts when the gate resolves to `ready`.
