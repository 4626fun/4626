# Deploy Cutovers — cutover & infra

Cross-cutting operator prefs: [preferences-active.md](../preferences-active.md).
Parent index: [deploy-cutovers.md](./deploy-cutovers.md). **Read one sub-archive only**.

## Learned Workspace Facts

- **GitHub Actions floor posture (July 2026):** Tests / Security / A11y / Guards / Orphan / Docs-drift are **PR or manual only** (no main-push re-run); full vitest + a11y Playwright are manual/monthly; auth-health + control-plane stuck-scan are manual-only; security heavy jobs monthly; Docs Deploy is `workflow_dispatch`; bun Dependabot disabled; path-filtered guards live in consolidated `guards.yml`. Branch protection must require PR checks — direct `main` pushes no longer re-validate.

- `frontend/src/config/wagmi.ts` sets `multiInjectedProviderDiscovery: false` on `createConfig` to avoid eager EIP-6963 multi-provider discovery that can trigger extension `requestProvider` races against non-writable `window.ethereum` getters when several wallets are installed. Keep targeted Rabby/MetaMask discovery explicit via manual EIP-6963 provider lookup, and keep `WagmiProvider` reconnection enabled so app/deploy route-boundary remounts restore an already-approved external EOA connection instead of appearing to disconnect it. A startup `detectEthereumProviderCollision()` check additionally skips EIP-6963 `requestProvider` dispatch entirely when `window.ethereum` is locked/getter-only or multiple injected providers collide; `DeployVault` gates its heavy mount behind `useDeferUntilAfterCommit()` to avoid setState-during-`Hydrate` warnings.

- Mega-file decomposition pattern: extract pure, side-effect-free logic into sibling `*Helpers.ts` / `*Utils.ts` modules next to the parent file (e.g. `deployVaultHelpers.ts`, `telegramLinkHelpers.ts`, `adminOpsHelpers.ts`, `coinbaseErc4337Telemetry.ts`, `xmtpHelpers.ts`, `telegramTradingHelpers.ts`, `elizaSwarmRoles.ts`) rather than moving across feature boundaries; keep runtime-bound state (React hooks, DB clients, XMTP/Eliza lifecycle) in the parent.

- AMOE ZK submit/publish/retry API paths fail closed when `LOTTERY_AMOE_ROUTER` is empty or undefined; runtime readers return a 503-style disabled/misconfigured response rather than falling back to a default router address, so production deploys that enable AMOE must configure this env var explicitly.

- AMOE protocol-entry target resolution is explicit request, then `LOTTERY_AMOE_PROTOCOL_CREATOR_COIN`, then legacy `LOTTERY_AMOE_DEFAULT_CREATOR_COIN`, then the current AKITA creator coin fallback until the new 4626 stack is deployed; submit requests must reuse the nonce-selected `creatorCoin` so env changes between nonce and submit cannot trigger `creator_mismatch` for a valid signed message.

- **`AMOE_SIGNUP_SALT` must be set on production Vercel** for ZK signup linkage — see `docs/operations/deployment/amoe-signup-salt-provisioning.md`.

- The production Vercel project for this app is `akita-llc/4626` (https://vercel.com/akita-llc/4626/deployments); the docs site is a separate project. **Production deploys are `main`-only** — `frontend/vercel.json` (`deploymentEnabled`) and `frontend/scripts/vercel-ignore.sh` skip non-`main` refs and empty/no-`frontend/` commits; use `[force-vercel]` in a `main` commit message to force a rebuild. Verify the linked project before triggering deploys — cloud agents have repeatedly deployed to the wrong project.

- Vercel CLI deploys for this monorepo should use archive upload (`vercel deploy --archive=tgz`, plus `--prod` for production) because raw file upload can exceed Vercel's file-count/size limits before build starts.

- **Release env cutover:** the v1.15.0 scripts under `scripts/ops/` are retired fail-closed stubs and must not be used for execution. Use the epoch-parameterized `./script/run-greenfield-cutover.sh <epoch>`, validate its handoff with `./script/validate-greenfield-handoff.sh <handoff-env-path>`, and sync local env files with `./script/sync-greenfield-env-from-handoff.sh <handoff-env-path>`. Follow the current epoch release runbook for deployment-provider env updates.

- `/api/deploy/config` must remain available to any authenticated deploy user, not admin-only; the Deploy page uses this public runtime config to replace stale build-time contract addresses such as legacy `DeploymentBatcher` values after env/config cutovers. The response now includes `deploymentBatcherConfigError: string | null` — when non-null, `DeployVault` surfaces a dismissible runtime warning banner before dry-run; consumers of this endpoint should surface this field rather than failing silently.
