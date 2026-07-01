# AGENTS.md

## Cursor Cloud specific instructions

### Architecture overview

4626 (4626.fun) is a monorepo with two primary dev loops:

| Component                     | Directory           | Toolchain                      | Dev command                  |
| ----------------------------- | ------------------- | ------------------------------ | ---------------------------- |
| **Frontend SPA + Vercel API** | `frontend/`         | Vite 7 + React 19 + TypeScript | `pnpm -C frontend dev`       |
| **Solidity contracts**        | `contracts/` (root) | Foundry (forge)                | `forge build` / `forge test` |

Optional components: XMTP Keepr Agent (`frontend/server/agents/eliza/`), KPR automation (`kpr/`), Docs site (`apps/docs-site/`), Solana program (`programs/creator-share-hook/`).

### Default working style

Use `.cursor/rules/product-builder-workflow.mdc` as the generic feature-shaping workflow: clarify the problem, reduce the MVP, design a simple system, choose the smallest proven stack, break work into steps, then implement and iterate. Prefer speed, clarity, and maintainability over enterprise-style overengineering.

### Rule precedence

`AGENTS.md` is the repo-level authority for architecture, operations, and cross-cutting product invariants.

Path-scoped or topic-scoped rules in `.cursor/rules/*.mdc` are authoritative inside their scope and override the generic builder workflow when they conflict. In particular:

- `.cursor/rules/product-builder-workflow.mdc` owns the generic feature-shaping workflow when no stricter domain rule applies.
- `.cursor/rules/4626 secur-agent guardrails for repo-native implementation.mdc` adds generic secure-automation process guidance without overriding product-specific invariants.
- `.cursor/rules/ERC-4337-Wallet-Invariants.mdc` owns canonical wallet/account selection (`profiles.csw_address`, `CANONICAL_CSW_ADDRESS` policy pin).
- `.cursor/rules/csw-agent-lifecycle.mdc` owns CSW delegation, XMTP identity, ERC-8004 identity, and deploy-session wallet mechanics.
- `.cursor/rules/waitlist-onboarding-simplicity.mdc` owns waitlist/signup simplification inside its scoped auth and waitlist files.
- `.cursor/rules/frontend-seo-core.mdc` and `.cursor/rules/frontend-seo-internal-linking.mdc` own frontend SEO policy inside `frontend/`.
- **`docs/_internal/ACCOUNT_MODEL.md` is the canonical reference for the 4626 account model** — user populations, identity invariants, the `command_issuer_execution_context` schema, and the existing-flows inventory (e.g. `setPayoutRecipient` is already part of the deploy phase-2 batch). Read it before writing any design doc that touches account, wallet, signer, sub-account, or paymaster behaviour.

Do not preserve legacy routes, aliases, or compatibility shims just for backward compatibility. When replacing a path or interface, migrate active callers and remove the old surface unless product explicitly requires a staged rollout.

### Security and trust-boundary rules

These are repo-level guardrails for internal automation, deploy orchestration, and Telegram identity flows.

Canonical maintainer references:

- `docs/security/mutable-surface-inventory.md` — authoritative write-surface map (auth model, guardrails, rollback posture).
- `docs/security/historical-risk-review.md` — quarterly historical-drift checklist for env/authority/schema/runbook drift.

- **Deploy status and preflight paths must be read-only.** They may gather config, build payloads, and report readiness, but they must not provision infrastructure, register tokens, or perform onchain mutation as a side effect.
- **Internal Solana mutation paths must require machine auth.** Do not fall back to ambient user sessions, cookies, wallet auth headers, or admin login state for route provisioning, token registration, or other mutating Solana setup.
- **Telegram Mini App link completion must require fresh Mini App session proof.** Shared secrets or server-side toggles must not bypass Telegram session verification for public Telegram-launched linking flows.
- **Telegram link-start tokens must be single-use, claim-bound, and consumed on success.** Do not leave link intents replayable across users or sessions until expiry.
- **Group-scoped Telegram message actions must be owner-scoped.** Deletion, refresh, pause, or other controls on shared bot messages and live cards must only be executable by the actor who created or owns that surface, unless product explicitly wants collaborative controls.

### Agent validation and editing discipline

These are repo-level process rules for any agent (cloud or local) editing this codebase. They exist to prevent the repeatable failure modes observed during model confidence tests.

#### Validation honesty

Agents must report validation results exactly.

- If a command fails, say it failed. Include the exact command, exit code, and error text.
- If the failure appears unrelated or pre-existing, identify it as "failed with likely pre-existing error" and include the exact file, line, and error message. Do not claim the gate passed.
- Do not summarize a failed gate as passed, even if the failure is in a file you did not touch. A targeted test passing does not imply `typecheck`, `lint`, or the full suite passed.
- Do not omit failed validation commands from the final report. Every validation command run must appear in the results section with its actual outcome.
- When a multi-stage command (e.g. `tsc ... && tsc ...`) short-circuits, fixing the first stage can surface previously-masked errors in the second stage. Report the newly-surfaced errors honestly as pre-existing if they predate your change, and do not claim the overall command passed until both stages are clean.

#### Pre-edit checkpoint for wallet / auth / XMTP / deploy / swap / canonical-CSW changes

Before editing files in wallet, auth, XMTP, deploy-session, swap execution, or canonical CSW code, an agent must summarize (in its response or plan, before any edit):

1. Exact invariant being changed or tested.
2. Files inspected (with paths).
3. File(s) proposed for modification (with paths).
4. Why the change is the smallest safe diff.
5. Whether the change is test-only or production code.
6. Targeted validation command to run first (e.g. `pnpm -C frontend exec vitest run <file>`).

Do not edit until this checkpoint is complete. This is especially important in 4626 because user-initiated frontend execution and server-side deploy-session execution are intentionally orthogonal (see `.cursor/rules/ERC-4337-Wallet-Invariants.mdc` § Execution address depends on the execution track). A change that blurs that boundary can route sponsored swaps through the wrong sender or gate legitimate frontend execution behind server-session checks.

#### Regression test quality

For invariant tests, prefer concrete behavior assertions over prose/string assertions.

Strong assertions include:

- return value shape (e.g. `{ name, avatar } | null`)
- routing mode and fallback mode
- sender identity and execution method
- called/not-called boundary mocks (e.g. `sendCoinbaseSmartWalletUserOperation` not called for sub-account sends)
- env precedence (override honored, invalid override ignored)
- consumer behavior (e.g. `getAgentIdentity` returns `null` for a Privy embedded EOA)

Weak assertions include:

- checking only that a debug `reason` string contains or omits words
- testing comments, labels, or incidental wording
- adding broad tests that do not fail for the intended regression

If a resolver is already tested, prefer testing an untested consumer of that resolver rather than duplicating resolver-level coverage. For routing boundaries, assert mode / sender / method / called-not-called behavior where the code under test supports it.

#### Local LLM / provider configuration isolation

Local development model configuration for Cursor, Aider, Hugging Face Router, OpenAI-compatible endpoints, or BYOK must not modify production runtime behavior.

Do not change:

- Hermit runtime model config (`HERMIT_AGENT_*`, `/api/hermit/draft` provider wiring)
- Eliza runtime model config
- XMTP production agent behavior
- deploy-session runtime model/provider settings
- production env names for canonical CSW, Privy, XMTP, or paymaster behavior

If a user asks to configure a local coding assistant, limit changes to local docs, ignored local env examples, or user-specific editor settings. This matches the existing distinction: the Hugging Face Inference Router is for local Cursor/Aider only (`OPENAI_API_BASE=https://router.huggingface.co/v1` in shell profile or Cursor Settings), not for production Hermit/Eliza lanes.

### Running services

- **Frontend**: `cd frontend && pnpm dev` starts Vite at `http://localhost:5173/`. Hot-reloads on file changes. The app is in waitlist mode by default — unauthenticated routes redirect to `/` or show the waitlist modal.
- **Contracts**: `forge build` to compile, `forge test` to run all 72+ Solidity unit tests. Foundry must be on PATH (`$HOME/.foundry/bin`).
- **XMTP Keepr agent**: production runs on Railway only, as a single primary XMTP consumer. Do not introduce a standby or second live deploy target unless product explicitly changes that operating model.
- **Telegram is not the live Eliza transport.** Telegram bot updates and Mini App flows remain separate from the Railway XMTP runtime, even when they reuse shared agent-core helpers.

### Lint / test / typecheck

Standard commands are documented in `frontend/package.json` scripts:

- `pnpm -C frontend lint` — ESLint (clean — 0 warnings, 0 errors)
- `pnpm -C frontend lint:a11y` — jsx-a11y rules at **error** (alias of `lint`; see `frontend/eslint.config.js`)
- `pnpm -C frontend smoke:a11y -- --serve` — Playwright + axe on `/faq`, `/faq/how-it-works`, `/waitlist`, `/swap` (fails on serious/critical). With `--serve`, `frontend/scripts/a11y-smoke.ts` restarts Vite per host shell (`marketing` for FAQ/waitlist, `app` for swap). CI: `.github/workflows/accessibility.yml` (non-blocking until repo var `A11Y_CI_BLOCKING=true`). Checklist: `frontend/docs/accessibility.md`
- **Marketing-host a11y + wagmi:** `4626.fun` has no `WagmiProvider` — do not use `TokenImage` / wagmi hooks on `MARKETING_ONLY_ROUTES` (e.g. `/faq/how-it-works` uses static story badges). Secondary copy on dark cards should use `text-zinc-400` (not `zinc-500`/`zinc-600`) for WCAG contrast; audit with `A11Y_BASE_URL=https://4626.fun pnpm -C frontend smoke:a11y`.
- `pnpm -C frontend typecheck` — TypeScript (clean — 0 errors)
- `pnpm -C frontend test` — Vitest (289 tests, all passing)
- `forge test` — Foundry unit tests (72 tests, all passing)
- `pnpm -C frontend guard:schema` — blocks raw `CREATE TABLE` / `ADD COLUMN IF NOT EXISTS` strings in `frontend/server/` production code (enforced in CI; see schema rule below and `frontend/scripts/guard-no-raw-schema-ddl.mjs`).
- `pnpm -C frontend guard:canonical-csw` — blocks retired `XMTP_AGENT_CSW_*` / `VITE_AGENT_XMTP_ADDRESS` env reads, stray pre-migration `0x4beabd…` CSW literals, direct `process.env.CANONICAL_CSW_*` outside `canonicalCswEnv.ts`, and retired keys in `.env.example` (enforced in CI; self-test: `pnpm -C frontend test:guard:canonical-csw`).
- `pnpm security:local` — optional sweep: `forge test`, frontend lint/typecheck/test, Semgrep on `frontend/api` + `frontend/server/_lib` (needs Docker). Script: `scripts/security-audit-local.sh`.
- **Security CI:** `.github/workflows/security-scanning.yml` — gitleaks, pnpm audit summaries, **blocking** Semgrep on that API surface, Slither (report-only). PRs: `.github/workflows/dependency-review.yml` (high+ vulns, runtime **and** development scopes; enable Dependency graph per `docs/audits/github-supply-chain-setup.md`). Index: `docs/audits/README.md`.

**June 2026 x-ray contract audit pass (full "for all" execution) + follow-ups completed:** 
- Complete P0/P1 review of `review-todo.md` (DeploymentBatcher, CreatorOVault + modules, ShareOFT/Oracle/Lottery, Solana NAV, invariants, cross-contract).
- P2 test gaps closed (new `test_partialPhase1Stuck_thenReset_allowsRetry` in `DeploymentBatcher.ThreeWaySplit.t.sol` + references to existing hostile withdraw/replay coverage).
- Follow-ups executed and verified: CLM size warn-guard hardened (24,450 threshold + PR "size budget review" policy), SC hygiene guard added to `security-audit-local.sh` (CLM headroom + contracts canonical terminology), lint fixes in `TacticalTokenMap.tsx`, docs updated.
- Re-run of `scripts/security-audit-local.sh` (post-fixes) exit 0; hygiene/lint/typecheck clean.
See `docs/audits/x-ray/contract-audit-pass-2026-06.md`, updated `review-todo.md`, and `docs/operations/contract-size-gate.md`.

### Non-obvious caveats

- **Git submodules are required** for Foundry compilation. Run `git submodule update --init --recursive` after cloning. The submodule tree is deep (Uniswap CCA/Liquidity Launcher pull in many transitive submodules) and takes ~2 minutes.
- **Two separate pnpm lockfiles**: root `pnpm-lock.yaml` (Solidity deps like OpenZeppelin, LayerZero) and `frontend/pnpm-lock.yaml` (frontend deps). Install both: `pnpm install` at root, then `pnpm -C frontend install`.
- **Foundry path**: After installing via `foundryup`, binaries are at `$HOME/.foundry/bin`. Add to PATH or invoke directly.
- **`.env` files**: Copy `.env.example` at root and `frontend/.env.example` for local dev. Most env vars are optional for basic frontend dev — the app runs without external service credentials but wallet/auth features require Privy, Supabase, etc.
- **API routing**: Vercel API routes go through `frontend/api/[...path].ts` dispatching to `frontend/api/_handlers/_routes.ts`. New endpoints must be registered in the static route map (no dynamic imports).
- **`/alfaclub/key-safety` must stay on the marketing host (`4626.fun`), not `app.4626.fun`.** Keep this page surfaced from the marketing shell unless product explicitly changes host strategy.
- **AlfaClub key-safety distribution vote threshold is 66% (not 50%).** Keep `keyDefense` policy/default math and related UX copy aligned to the 66% requirement.
- **`pnpm.onlyBuiltDependencies`** is configured in `frontend/package.json` to avoid interactive `pnpm approve-builds` prompts.
- **Waitlist/marketing page on localhost**: By default, `localhost` is treated as the "app" domain and redirects unauthenticated users to `4626.fun`. To test the waitlist/marketing page locally, set `VITE_HOST_MODE_OVERRIDE=marketing` and `VITE_MARKETING_ORIGIN=http://localhost:5173` in `frontend/.env`. This is already configured in the Cloud Agent `.env`.
- **Railway-only XMTP primary**: the Eliza/XMTP runtime is intended to have exactly one live Railway primary with `AGENT_RUNTIME_ROLE=primary`, `AGENT_CONSUME_XMTP=true`, and `numReplicas = 1`. Local standby mode is for inspection only. If a Railway redeploy crashes, expect downtime until restart or rollback; there is no default standby failover.
- **Keep app-shell providers quiet by default**: route-scoped or user-intent-gated mounts are preferred over eager global mounts. Current examples: `/api/auth/admin` only resolves on `/admin`, `AccountContextProvider` is mounted in the layout subtree rather than the outer app root, and chat/XMTP only mounts after explicit chat intent or deep-link context. **`Layout` must gate `useSiweAuth()` and `useAccountTrayPortfolio()` behind the app interactive layout only** — marketing shells (`/faq`, `/waitlist`, and public `/add` before the account route) render outside `PrivyClientProvider`; calling Privy hooks in the default `Layout` crashes with "must be used within PrivyProvider". **Exception:** marketing `/waitlist` group chat must wrap `XmtpChatProvider` in `AccountContextProvider` inside `WaitlistGroupChatPanel` — that route is outside `AuthenticatedAppLayout`, and `XmtpChatProvider` calls `useAccountContext()` internally.
- **`/swap` should not background-refresh idle quotes**: quote on input changes, then rebuild stale quotes during review/submit if needed. Avoid reintroducing timer-driven idle re-quote loops.
- **Do not add new ad hoc session polling around `useSiweAuth()`**: session restoration already dedupes shared `/api/auth/me` work and keeps a short-lived shared in-memory session snapshot so SPA route/provider remounts do not briefly fall back to signed out. New auth consumers should reuse the existing hook/provider path instead of layering separate refresh effects.
- **Railway primary must fail fast if misconfigured**: standby mode or `AGENT_CONSUME_XMTP=false` on Railway is a startup error, not a healthy passive mode. When Postgres is configured, the DB-backed runtime lease lock is expected to stay enabled for the Railway primary.
- **Transaction routing has two `executionMode` values and four send modes.** User-initiated frontend code paths branch on `executionMode: 'canonical' | 'eoa'` (exported from `frontend/src/lib/uniswap/walletMode.ts`). `txRouter` (`frontend/src/lib/tx/txRouter.ts`) selects one of: `sendCalls` (EIP-5792 atomic batching on CSW sub-account connectors), `canonical4337` (ERC-4337 UserOp via CDP paymaster — strongest fallback for CSW), `canonicalDirect` (direct `executeBatch` on the CSW contract), or `eoaDirect` (standard `eth_sendTransaction`, one tx at a time). Only `eoaDirect` is non-atomic (approval and swap sequential). Canonical approval+swap and parent-CSW fallback paths must stay locked to `canonical4337`; do not fall back to direct gas sends when sponsorship is denied. Full routing table: Section 5 of `docs/_internal/4626-connection-methods.md`.
- **Known-good sponsored ETH→token canonical swap shape:** `canonical4337` + `eth_sendUserOperation`; canonical CSW is the sender/asset owner; Privy embedded EOA signs as CSW owner; calls are `WETH.deposit()` → `WETH.approve(...)` → Uniswap swap proxy `execute(address,address,uint256,bytes,bytes[],uint256)` at `0x02E5be68D46DAc0B524905bfF209cf47EE6dB2a9` (`0x2894adf9`). The router/proxy call must have zero native value; native ETH enters only via WETH deposit. Runbook: `docs/_internal/operations/operations/wallet/sponsored-canonical-swap-pattern.md`.

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

Canonical architecture reference: `docs/_internal/4626-connection-methods.md` — describes the three connection methods (CSW, external EOA, Telegram), the CSW address model, and the `executionMode` / send-mode routing table.

Wallet-role model for user-facing docs and copy:

- **Canonical CSW (parent) = identity + custody source of truth** (`profiles.csw_address`).
- **Canonical CSW (parent) = primary execution sender for sponsored canonical swaps** (`canonical4337` + embedded EOA owner on that same address).
- **One wallet, many roles** — for the 4626 canonical account, `profiles.csw_address` === `CANONICAL_CSW_ADDRESS`: XMTP agent 4626 inbox, Railway Keepr, AKITA vault owner, and swap/owner-install are **labels on the same CSW**, not separate accounts. Do not reintroduce "agent CSW" as a second wallet.
- **Privy embedded EOA = primary signer for parent-CSW sponsored UserOps.**
- **Base sub-account = optional app-scoped execution lane; keep hidden unless a route is actively using it as sender** (flag-gated swap-only fallback, not deploy).
- **Connected external EOA = fallback/override signer lane.**
- **Privy server wallet = delegated server-side signer for automation/deploy-session tracks** (signer identity, not the asset-holding CSW).
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
  - **User-initiated frontend execution-ready (CSW path, `executionMode === 'canonical'`)**: canonical parent CSW recorded in `profiles.csw_address`, Privy embedded EOA present in `profiles.primary_embedded_eoa`, and the embedded EOA confirmed as an owner/signing authority for the parent CSW. Sponsored swaps use `canonical4337` with the parent CSW as ERC-4337 sender and the embedded EOA as signer. An app-scoped sub-account may still exist in `profiles.base_sub_account`, but it is optional infrastructure and must not be shown as the primary execution account unless the active route actually sends from it.
  - **User-initiated frontend execution-ready (external EOA path, `executionMode === 'eoa'`)**: external wallet connected via wagmi, `profiles.primary_wallet` populated, no sub-account (EOAs are not smart contract wallets). The EOA address is the execution address.
  - **Server-side agent / deploy-session execution-ready**: follows the direct owner delegation path in `.cursor/rules/csw-agent-lifecycle.mdc`. **Deploy-session** uses the **creator's canonical CSW** (`profiles.csw_address`) as ERC-4337 sender with a temporary Privy server wallet via `addOwnerAddress`. **Railway XMTP / Keepr / ERC-8004** use the **4626 canonical CSW** (`CANONICAL_CSW_ADDRESS`, same as that account's `profiles.csw_address`) with the long-lived delegated Privy server wallet. Both tracks are orthogonal to user-initiated frontend execution above.
- **Features that require wallet execution must stay gated until the account is `execution-ready` on the correct track.**
- **If the user does not yet have a CSW, route them to Base app with the referral flow, then resume embedded-owner signing setup for the canonical parent CSW when they return. Do not make waitlist onboarding explicitly create a sub-account.**
- **Cross-account Telegram conflicts must not auto-merge silently.** If a Telegram identity is already attached elsewhere, force explicit recovery/merge UX.
- **Website sign-in should use email OTP by default.** Do not assume Telegram is the primary website login flow unless product explicitly changes this rule later.
- **Do not preserve legacy auth paths just for backward compatibility.** If an old path conflicts with these invariants, remove or migrate it.

### Canonical CSW identity (one wallet per account)

- **`profiles.csw_address`** is the canonical parent Coinbase Smart Wallet for each 4626 account — identity, custody, and (when execution-ready) the default `canonical4337` sender.
- **`CANONICAL_CSW_ADDRESS`** (`0xAb6d5C10b03300326cd7fab7267ae192842967b5`) is the **same wallet** for the 4626 canonical account: policy in `frontend/src/wallet/canonicalWalletPolicy.ts`, runtime env via `frontend/server/_lib/wallet/canonicalCswEnv.ts`, client inbox via `frontend/src/lib/xmtp/agentXmtpAddress.ts`. XMTP agent 4626 inbox, Railway Keepr ERC-4337 sender, AKITA vault owner, sponsored swaps, and owner-install all use this address — not a parallel "agent CSW." Hard cutover **2026-04-23** from `0x4beabd0afbcc2f0440cdef1c3c745d43fae704ef`; retired env `XMTP_AGENT_CSW_*`, `XMTP_AGENT_PRIVY_WALLET_ID`, `VITE_AGENT_XMTP_ADDRESS` → `CANONICAL_CSW_*` and optional `VITE_CANONICAL_CSW_ADDRESS`. **Regression guard:** `pnpm -C frontend guard:canonical-csw` (CI); Railway `validateStartupEnv` **errors** on retired keys; doctor + Eliza early logs flag drift.
- **Other accounts** (creators on 4626) have their **own** `profiles.csw_address` — same canonical-CSW role, different on-chain address. Deploy-session and creator flows use that row.
- **`4626.base.eth`** resolves to operator **display** context (`0xB05Cf01231cF2fF99499682E64D3780d57c80FdD`), not the canonical CSW — do not use Basename resolution as custody or swap truth.

### Canonical Lane Terminology

All docs, UI copy, commit messages, and code comments that reference 4626's value lanes must use the canonical terms defined in `docs/audits/creatorvault-business-logic-core-structure-audit.md`. These lanes have separate triggers, units, custody domains, and authorities — using generic terms creates product-truth ambiguity.

- **`tradeFeeCollector`** — destination domain for ShareOFT/hook **trade-fee** routing (native ShareOFT `SwapOnly -> non-SwapOnly` plane and the optional hook fee plane).
- **`creatorCoinPayoutRecipient`** — CreatorCoin **external earnings** routing (`payoutRecipient`). In router mode this points to per-vault `PayoutRouter`. **Share-holder-biased split:** non-creator-coin inputs (WETH, ZORA, protocol rewards) swap to ShareOFT → `CreatorOVaultWrapper.unwrap` → vault shares queued on `VaultShareBurnStream`; **direct creator-coin payouts** use `vault.deposit(creatorCoin)` unchanged. Deploy must whitelist the router on the wrapper for atomic post-swap unwrap. Non-CC paths use on-chain `swapPathToShareOFT` with keeper/API `minOut` slippage guards — no legacy `swapPathToCreator` / `minCreatorOut` shims. ShareOFT market buys may incur OFT trade fees; unwrap/deposit paths are untaxed. When `PayoutRouter` constructor immutables change, regenerate deploy bytecode manifests and re-seed the on-chain bytecode store before production deploys.
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

**Canonical completion truth:** vault settlement completion lives in `/api/keeper/sweep` (`frontend/api/_handlers/keeper/_sweep.ts`, delegating to the legacy KPR handler during sunset). `kpr/actions/cca-finalization.action.ts` is non-canonical and must not write DB `settledAt`. The five mandatory invariants in the audit §5.1 gate `settledAt`:

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
`docs/_internal/operations/operations/messaging/telegram-canonical-link-preservation.md`.

Any simplification must keep this semantic order:

1. verify fresh Telegram Mini App proof
2. perform inline email OTP inside the Mini App
3. wait for verified-email account readiness + Privy sync explicitly
4. ensure the active Privy user is linked to Telegram
5. complete backend persistence and consume any single-use, claim-bound link-start token on success when that tokenized path is in play
6. keep canonical CSW / embedded-EOA rules intact without requiring immediate CSW owner confirmation for link success

`Link success` here means the account/channel link can complete and the user can continue the Telegram or waitlist flow.

It does **not** mean the account is `execution-ready`. Features that require wallet execution remain gated until the correct track completes per the Account and auth invariants and `.cursor/rules/ERC-4337-Wallet-Invariants.mdc` — embedded-owner signing for the user-initiated parent-CSW path, connected EOA for the user-initiated EOA path, or owner delegation for server-side agent/deploy-session automation per `.cursor/rules/csw-agent-lifecycle.mdc`.

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

- `docs/_internal/operations/operations/messaging/telegram-canonical-link-preservation.md`
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
- The program keypair at `programs/creator-share-hook/target/deploy/creator_share_hook-keypair.json` does **not** match the deployed program ID — do not pass it as `--program-id`. The deployed program ID is hardcoded in `declare_id!()` in `src/lib.rs`.
- Solana CLI 3.x is installed at `~/.local/share/solana/install/active_release/bin/solana`; Anchor CLI 0.31.1 is at `/usr/local/cargo/bin/anchor`.
- The Anchor IDL is at `programs/creator-share-hook/target/idl/creator_share_hook.json`. Regenerate with `cd programs/creator-share-hook && anchor idl build > target/idl/creator_share_hook.json`.

### Solana bridge on-chain config (Base mainnet)

The deployment batcher is configured for Solana bridging:

| Contract                              | Config                | Value                                         |
| ------------------------------------- | --------------------- | --------------------------------------------- |
| Batcher (`0x660B25…61c1`, v1.14.1)   | `solanaBridgeAdapter` | `0x8e99bb0270bbdf2d64ff6854509CD2410A28fBae`  |
|                                       | `solanaDestination`   | `0x5f38e34e...d4d1`                           |
| SolanaBridgeAdapter (`0x8e99bb…fBae`) | `owner`               | `0xB05Cf0...FdD` (= `PRIVATE_KEY` secret)     |
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
| `POST /provision`     | Creates bridge route via `wrap-token` CLI (legacy creator SPL adapter lane only) |
| `POST /setup-creator` | Creates Token-2022 mint with Transfer Hook + TransferFeeConfig, initializes PDAs                           |
| `POST /create-pool`   | Creates Meteora DLMM pool for the creator's share token                                                    |
| `POST /meteora-ixs`   | Builds Meteora Alpha Vault deposit instructions                                                            |

**Single-token architecture:** Meteora DLMM rejects Token-2022 mints with TransferHook extension (`UnsupportedMintExtension`). The deploy uses only the bridge-wrapped standard SPL token (created by `wrap-token`) for DLMM pools, Alpha Vault deposits, and trading. Transfer Hook functionality (lottery entries, fees) requires a separate Token-2022 mint if needed.

**Legacy adapter registration (optional):** `POST /provision` registers bridge-wrapped creator SPL on `SolanaBridgeAdapter`. **Do not use `SOLANA_AUTO_POOL`** — it is retired. Share-mesh Meteora pools use the LZ mint runbook in `docs/operations/solana-share-mesh-budget-paths.md`.

1. (Optional) `POST /setup-creator` — creates Token-2022 mint with Transfer Hook, inits CreatorConfig/PendingEntries/WinnerRecord PDAs
2. Register Meteora vault config in DB or `METEORA_CREATOR_ALPHA_VAULT_MAP_JSON` env (legacy creator-SPL Alpha Vault lane only)

**Meteora vault config** is resolved via `frontend/server/_lib/meteoraAlphaVaultConfig.ts`:

- Priority 1: DB table `creator_meteora_alpha_vaults` (auto-created on first query)
- Priority 2: `METEORA_CREATOR_ALPHA_VAULT_MAP_JSON` env var (JSON map keyed by creator token address)

### KPR keeper bots

Keeper bots in `kpr/` relay data between Solana and Base. Install: `cd kpr && npm ci`.

**Solana-specific workflows:**

- `keepr-solana-relay-entries` — relays lottery entries from Solana → Base (every 30s)
- `keepr-solana-settle-fees` — settles Solana fees → Base gauge (every 5min)
- `keepr-solana-winner-relay` — relays Base lottery wins → records on Solana
- `keepr-solana-price-monitor` — monitors Solana vs Base price deviation

**Start:** `cd kpr && tsx runner.ts` (runs all workflows). Dry-run: `DRY_RUN=true tsx runner.ts`.

**Required secrets** (see `kpr/secrets.example.env`):

- `KPR_PRIVATE_KEY` — Base signer (EOA or ERC-4337 owner)
- `SOLANA_KEEPER_KEYPAIR` — Solana payer/authority (base58)
- `SOLANA_RPC_URL`, `BASE_RPC_URL` — RPC endpoints
- `SOLANA_BRIDGE_ADAPTER` — Base bridge adapter address
- `SOLANA_CREATOR_MINTS` — comma-separated Solana mints to monitor
- `SOLANA_SHARE_OFT_MAPPING` — JSON: Solana mint → Base ShareOFT
- `SOLANA_CREATOR_COIN_TO_MINT_MAPPING` — JSON: Base creator coin → Solana mint
- `SOLANA_TWIN_TO_PUBKEY_MAPPING` — JSON: Base Twin contract → Solana pubkey

**KPR TypeScript baseline is currently clean** (`pnpm -C kpr typecheck` passes). Keep this as a no-regression launch gate.

## Learned Facts & Preferences

Accumulated workspace facts and user preferences have been moved to `docs/agent-learned-facts.md` to keep this file focused on authoritative repo instructions. Refer there for observational implementation notes, runtime quirks, and user design preferences.
