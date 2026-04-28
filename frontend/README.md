# 4626

Turn creator coins into earnings. Built on Base.

Launch vaults. Reward holders. Win jackpots. All onchain.

## What It Does

- **Launch Vaults** - One transaction deploys your vault
- **Cross-Chain** - Works on Base + Solana via bridge
- **Earn From Trades** - 6.9% fee policy with configurable gauge split (default: 69% jackpot, 21.39% burn/PPS, 9.61% voter/protocol branch)
- **Verifiable Randomness** - Chainlink VRF for fair winner selection
- **Mobile-First** - Built for [Base App](https://docs.base.org/mini-apps)

## Quick Start

```bash
# Install dependencies
pnpm install

# Set up environment
cp .env.example .env
# Edit .env with your CDP API key

# Run development server
pnpm dev
```

## Local deploy dry-run

Use this when you want `/deploy` to hit a local Base fork for the new dry-run flow.
This flow is local-fork-only, and `https://app.4626.fun` does not expose the dry-run action.

```bash
cd frontend
cp .env.deploy-dry-run.example .env.deploy-dry-run.local
# set BASE_FORK_UPSTREAM_RPC_URL in .env.deploy-dry-run.local
pnpm -C frontend dev:deploy-dry-run
```

What it does:

- starts an Anvil Base fork on `127.0.0.1:8545`
- deploys a local `DeploymentBatcher` copy onto that fork and points `/deploy` at the local batcher by default
- exports `BASE_RPC_URL` and `VITE_BASE_RPC` to that local fork for the process
- enables the `Run dry-run` action in `/deploy` (only when `VITE_BASE_RPC` is localhost/127.0.0.1)
- forces `VITE_ALLOW_CONTRACT_OVERRIDES=0` and `ALLOW_API_CONTRACT_OVERRIDES=0`
- runs the frontend dev server in the foreground

Required input:

- `BASE_FORK_UPSTREAM_RPC_URL` must point at a real Base mainnet RPC endpoint for forking.

## Build workflow (fast vs full)

- **Frontend-only (fast)**: `pnpm build` (Vite build for the SPA)
- **Clean frontend build**: `pnpm build:clean` (clears generated `dist`/`build` first)
- **Type safety (fast)**: `pnpm typecheck`
- **Contracts (slow)**: done from repo root via Foundry (`forge build`, `forge test`) when you’re actively changing Solidity

This mirrors the “build vs build:js” split described in Zora’s monorepo architecture doc: keep the default loop fast, and only pay the heavy compile cost when you need it.
## Why multiple config files exist

Several files share extensions but target different runtimes/tools:

- `tsconfig.base.json` - shared TypeScript defaults used across frontend configs.
- `tsconfig.app.json` - browser app typecheck scope (`src/**`).
- `tsconfig.node.json` - Node/Vite/API/server typecheck scope.
- `tsconfig.docs.json` - docs/TypeDoc extraction scope.
- `tsconfig.json` - root/editor entry that points at app + node configs.
- `index.html` - default SPA shell for marketing/public host routing.
- `app.html` - app-origin shell (for app host and miniapp-specific metadata).
- `telegram-link.html` - standalone Telegram link/auth entry document.
- `stale-chunk-recovery.js` - shared stale-chunk reload/cache-buster script used by both `index.html` and `app.html`.
- `html-shells/` - source templates/partials for generated app + marketing shell HTML.
- `.env.example` - primary local/server env template.
- `.env.deploy-dry-run.example` - local Base-fork deploy dry-run preset template.

`index.html`, `app.html`, and `telegram-link.html` are generated from `html-shells/templates/*.tpl` via `pnpm generate:html-shells` (auto-run before `dev` and `build` scripts). Use `pnpm check:html-shells` to verify generated files are in sync.

## Brand, Social, And Mini App Assets

Static public assets in `frontend/public/` are served directly and copied into `dist/` at build time. Treat `dist/manifest.json` as generated output; the linked source manifest is [`public/site.webmanifest`](./public/site.webmanifest).

- Keep creative master assets under [`assets/brand/master/`](./assets/brand/master/) instead of `tmp/` or `public/`.
- Canonical SEO favicons, PWA icons, logo exports, and social cards come from the 4626.fun SEO brand kit. Lightweight kit docs live under [`brand/4626fun-seo-brand-kit/`](./brand/4626fun-seo-brand-kit/); deployable assets live under `public/favicons/`, `public/logo/`, and `public/social/`.
- Marketing social card: replace the committed brand-kit files in `public/social/`, then run `pnpm -C frontend generate:social-preview` to verify required files exist.
- Base miniapp and Telegram preview hero: run `pnpm -C frontend capture:app-screens` to refresh `public/miniapp-hero.png` from the live UI.
- Brand-kit favicons and install icons: replace the committed files under `public/favicons/`, then run `pnpm -C frontend generate:brand-icons` to verify required files exist.
- Manifest screenshots: `pnpm -C frontend capture:app-screens` refreshes `public/screenshot-swap.png`, `public/screenshot-explore.png`, and `public/screenshot-deploy.png`.
- To clear legacy derived image outputs before a full refresh, run `pnpm -C frontend clean:derived-assets`. This removes generated legacy PNGs plus `dist/` and `build/`, but preserves `public/site.webmanifest` and the canonical brand-kit directories.
- To verify the static, non-screenshot brand assets after a reset, run `pnpm -C frontend generate:brand-assets:static`.
- Full workflow: see [`frontend/docs/brand-refresh-checklist.md`](./docs/brand-refresh-checklist.md).

These pipelines are intentionally separate:

- `public/social/og-image-1200x630.png` is the curated Open Graph card.
- `public/social/twitter-summary-large-image-1200x675.png` is the curated Twitter card.
- `miniapp-hero.png` is the UI-derived miniapp/Telegram preview image.
- `miniapp-splash.png` is the splash screen used by Base miniapp metadata.
- `assets/brand/master/` is the long-term intake area for design masters before they are converted into repo-owned SVG sources.
- Shell-level social/meta URLs and IDs are centralized in `frontend/scripts/html-shells.config.mjs`.

## Runtime boundary guardrails

- `pnpm guard:server-core-boundary` enforces shared API primitives to flow through `packages/server-core` instead of direct `server/auth/_shared` or `server/_lib/*` imports.
- `pnpm guard:runtime-boundaries` enforces that browser code in `frontend/src/*` does not import server/api/service runtime modules.
- `pnpm guard:generated-output` enforces `dist`/`build` as generated-only outputs (untracked by git).

## Tech Stack

- **React 19** + TypeScript
- **Vite 7** - Fast builds
- **Wagmi v2** + **viem** - Wallet integration
- **Tailwind CSS** - Styling
- **Framer Motion** - Animations

## Project Structure

```
frontend/
  packages/
    server-core/         # Staged shared server-core exports
  public/                # Static asset source (copied to dist at build)
  src/                   # Browser app source
  api/                   # Canonical API handlers/runtime source
  server/                # Node/server runtime source shared by API handlers and long-lived workers
  dist/                  # Generated build output (do not treat as source)
```

Testing placement conventions live in:

- `frontend/docs/testing-structure.md`

## API routing & bundling (important)

Vercel routes most API traffic through `frontend/api/[...path].ts`, which dispatches to handlers under `frontend/api/_handlers/*`.
Two heavy endpoints remain standalone functions:

- `frontend/api/agent/process.ts`
- `frontend/api/keepr/actions/execute.ts`

- **Do not** add new API handlers and rely on dynamic imports.
- **Do** register new endpoints in `frontend/api/_handlers/_routes.ts` (static loader map) so Vercel’s bundler includes them.
- The client prefers the `/__api/*` alias and falls back to `/api/*` when needed.
- For local dev, `frontend/vite.config.ts` maps both `/api/*` and `/__api/*` to the API runtime.

### Zora CLI compatibility endpoints

`/api/zora/cli/*` provides CLI-shaped, read-only JSON contracts for agent/tooling use:

- `/api/zora/cli/explore`
- `/api/zora/cli/get`
- `/api/zora/cli/profile`
- `/api/zora/cli/priceHistory`
- `/api/zora/cli/authStatus`

Guardrails:

- keep these endpoints GET-only and read-only
- keep buy/sell/send execution on the existing `/api/zora/coin` path and canonical signer model
- do not introduce `ZORA_PRIVATE_KEY` server execution paths for production API flows

## Runtime split (important)

- Vercel hosts the SPA plus request/response API handlers.
- The long-lived XMTP / Eliza primary runtime does not run on Vercel in production.
- Production XMTP consumes from exactly one Railway primary using `frontend/Dockerfile.agent` and `frontend/server/agent/eliza/index.ts`.
- Do not add or re-enable a Vercel cron for `/api/agent/process`; that path is not part of the production Vercel topology.

## Pages

| Route             | Description                         |
| ----------------- | ----------------------------------- |
| `/`               | Landing page with features          |
| `/deploy`         | Deploy + activate vault (canonical) |
| `/waitlist`       | Collect emails for early access     |
| `/vault/:address` | Deposit/withdraw from vault         |

## Deployed Contracts (Base)

Base mainnet defaults live in `frontend/src/config/contracts.defaults.ts` (and are used by both the SPA and Vercel functions).

## Mini App Integration

This app follows [Base Mini App guidelines](https://docs.base.org/mini-apps/quickstart/building-for-the-base-app):

1. **Manifest** - `public/manifest.json` with Mini App config
2. **Mobile-First** - Responsive design with bottom nav
3. **Simple Flow** - Focus on one action: launch vault
4. **Low Friction** - Coinbase Smart Wallet for gasless txs

## Deployment

### Vercel (Recommended)

For the real launch path, start with:

- `docs/operations/deployment/launch/ship-checklist.md`
- `docs/guides/deploy-vault.md`

Frontend build:

```bash
pnpm build
```

### Manual

```bash
pnpm build
# Deploy dist/ folder
```

## Environment Variables

| Variable                         | Required           | Scope  | Description                                                                                        |
| -------------------------------- | ------------------ | ------ | -------------------------------------------------------------------------------------------------- |
| `VITE_CDP_PAYMASTER_URL`         | Recommended        | client | Paymaster/bundler endpoint override (set to `/api/paymaster` to use same-origin proxy)             |
| `CDP_PAYMASTER_URL`              | Recommended (prod) | server | Real CDP paymaster/bundler endpoint used by `/api/paymaster` (keep secret)                         |
| `VITE_ZORA_PUBLIC_API_KEY`       | Recommended        | client | Zora public key (restrict allowed origins)                                                         |
| `ZORA_SERVER_API_KEY`            | Recommended        | server | Zora server key for Vercel Functions (also powers read-only `/api/zora/cli/*` compatibility routes) |
| `VITE_BASE_RPC`                  | No                 | client | Base RPC used by the browser (default: public)                                                     |
| `BASE_RPC_URL`                   | No                 | server | Base RPC used by Vercel Functions (defaults to `https://mainnet.base.org`)                         |
| `DATABASE_URL`                   | Optional           | server | Postgres connection string for local dev                                                           |
| `AUTH_SESSION_SECRET`            | Recommended        | server | SIWE session secret (stable in production)                                                         |
| `CREATOR_ACCESS_ADMIN_ADDRESSES` | Optional           | server | Admin wallets allowed to approve/deny creator access                                               |
| `CREATOR_ACCESS_ADMIN_EMAILS`    | Optional           | server | Admin emails allowed to approve/deny creator access (looked up by wallet)                          |
| `CREATOR_ALLOWLIST`              | Optional           | server | Legacy fallback allowlist (env-based, only used if DB is not configured)                           |
| `PRIVY_APP_ID`                   | Optional           | server | Privy App ID (server-side). Used by server-side Privy auth/sync handlers                           |
| `PRIVY_APP_SECRET`               | Optional           | server | Privy App Secret (server-side). Used by server-side Privy auth/sync handlers                       |

## Base Builder Codes Attribution

This app uses a **wagmi-first** Builder Codes integration (ERC-8021 suffix) so attribution is configured once and then applied automatically.

For Base Build registration and ownership verification:

- Use **App URL** `https://app.4626.fun`
- Do not use `https://4626.fun` for Base Build; that host is the marketing origin
- The app homepage advertises ownership via `<meta name="base:app_id" content="695a49dc4d3a403912ed8ca5" />`
- Production verification should confirm the live app homepage returns app-origin metadata, not marketing-origin metadata

- **Setup**
  - Set `VITE_BASE_BUILDER_CODES` in `frontend/.env` (preferred, comma-separated if multiple codes).
  - Optional fallback: set `VITE_BASE_DATA_SUFFIX` with a precomputed hex suffix.
  - Run `pnpm -C frontend builder-codes:verify` to print the computed `DATA_SUFFIX` and marker checks.
- **Automatic coverage**
  - EOA sends via wagmi use global `createConfig({ dataSuffix })`.
  - ERC-4337 sends append suffix to `userOp.callData` through the shared attribution helper.
  - Raw `eth_sendTransaction` fallback paths append the same suffix before submission.
- **Chain scope**
  - Base rewards are scoped to **Base mainnet** and **Base Sepolia**.
  - Wagmi `dataSuffix` is a global client setting and can append on non-Base chains.
  - Direct payload-composition paths are chain-gated to Base/Base Sepolia.
  - Privy `dataSuffix` plugin is intentionally not used in this app path (see Privy note about `@privy-io/wagmi` support).
- **Verification**
  - Check attribution counts on [base.dev](https://base.dev/) (Onchain transaction view).
  - Inspect tx input data on Basescan and confirm the ERC-8021 repeating `8021` marker tail.
  - Optionally validate tx/UserOp hash with [builder-code-checker](https://builder-code-checker.vercel.app/).
- **Governance guardrails**
  - Production Vercel builds run `builder-codes:assert-env` and fail hard if `VITE_BASE_BUILDER_CODES` is missing/empty.
  - A source-scan guard test (`src/lib/ethSendTransactionAttribution.guard.test.ts`) blocks new raw `.request({ method: 'eth_sendTransaction' })` paths that bypass `appendBuilderSuffixToHex`.
  - Dependency and attribution-sensitive changes trigger `.github/workflows/builder-codes-guardrails.yml`, which reruns `builder-codes:verify` plus targeted attribution tests.
  - Keep server wrapper exceptions explicit and minimal via the guard test allowlist.
- **Local command set**
  - `pnpm -C frontend builder-codes:verify`
  - `pnpm -C frontend test src/lib/baseBuilderCodes.test.ts src/lib/ethSendTransactionAttribution.guard.test.ts src/lib/txRouter.test.ts src/lib/aa/coinbaseErc4337.builderCodes.test.ts`
  - `VERCEL_ENV=production VITE_BASE_BUILDER_CODES=bc_local_guardrail pnpm -C frontend builder-codes:assert-env`

## Swap Routing Compatibility (Base App + CSW)

Swap execution now uses capability-based routing in `src/lib/txRouter.ts` (not address-equality routing).

- **Routing priority**
  - Prefer `wallet_sendCalls` when the connected wallet advertises EIP-5792 capabilities (or Coinbase smart-wallet hints in canonical mode).
  - Fall back to canonical ERC-4337 (`eth_sendUserOperation`) for canonical-owner flows.
  - Fall back to connector-native direct sends when canonical owner UserOp is not applicable.
  - Use direct `sendTransaction` path for EOA mode.
- **Sender consistency**
  - Approval + swap are routed through the same route family.
  - In canonical mode, approval + swap can be batched together.
  - In EOA mode, approval + swap are sent sequentially with the same signer route.
- **Debugging**
  - Enable with `VITE_DEBUG_LOGS=true` or in browser devtools:
    - `localStorage.setItem('cv:debug', 'true')`
    - refresh the page
  - On `/swap`, a dev panel shows connector, addresses, capability snapshot, selected mode, last RPC method, and approval-vs-swap sender comparison.
- **Healthy patterns**
  - Base App CSW should generally show `wallet_sendCalls` (or explicit canonical ERC-4337 fallback).
  - Approval and swap should report matching sender semantics in the debug panel.

## Swap runtime posture

`/swap` is intentionally kept quieter than the rest of the app shell:

- `useSiweAuth()` owns shared session restoration; do not add separate `/api/auth/me` polling around swap surfaces.
- Canonical account lookup is deferred until a signer exists; `AccountContextProvider` should not eagerly fetch `/api/waitlist/me` for disconnected sessions.
- Chat is lazy-activated and should not mount `XmtpChatProvider` on idle route load.
- Stale quotes are rebuilt when the user reviews or submits a trade. Idle pages should not auto-refresh quotes just because the TTL expired.

If a future change makes `/swap` feel like it is hard-refreshing, inspect these first:

1. session token churn / repeated `useSiweAuth()` bridges
2. eager provider mounts in the app shell
3. account-context queries before a signer is present
4. background quote refresh loops

## Waitlist (DB)

See also: `frontend/docs/waitlist-entry-scenarios.md` for entry-path and email-rule behavior (including CSW-first flows).

The waitlist API stores signups in Postgres. Create the table once:

```sql
CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  primary_wallet TEXT NULL,
  privy_user_id TEXT NULL,
  embedded_wallet TEXT NULL,
  base_sub_account TEXT NULL,
  persona TEXT NULL,
  has_creator_coin BOOLEAN NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

## Admin: approve creator access

- Approvals are managed at `/admin/creator-access`.
- Requests are submitted from `/deploy`.
- Admin access is controlled by:
  - `CREATOR_ACCESS_ADMIN_ADDRESSES` - comma/space separated wallet addresses
  - `CREATOR_ACCESS_ADMIN_EMAILS` - comma/space separated emails (looked up from `users` or `creator_wallets` by signed-in wallet)

## License

MIT - AKITA, LLC
