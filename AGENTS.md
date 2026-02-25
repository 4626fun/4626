# AGENTS.md

## Cursor Cloud specific instructions

### Architecture overview

CreatorVault (4626.fun) is a monorepo with two primary dev loops:

| Component | Directory | Toolchain | Dev command |
|-----------|-----------|-----------|-------------|
| **Frontend SPA + Vercel API** | `frontend/` | Vite 7 + React 19 + TypeScript | `pnpm -C frontend dev` |
| **Solidity contracts** | `contracts/` (root) | Foundry (forge) | `forge build` / `forge test` |

Optional components: XMTP Keepr Agent (`frontend/server/agent/eliza/`), CRE automation (`cre/`), Docs site (`apps/docs-site/`), Solana program (`programs/creator-share-hook/`).

### Running services

- **Frontend**: `cd frontend && pnpm dev` starts Vite at `http://localhost:5173/`. Hot-reloads on file changes. The app is in waitlist mode by default — unauthenticated routes redirect to `/` or show the waitlist modal.
- **Contracts**: `forge build` to compile, `forge test` to run all 72+ Solidity unit tests. Foundry must be on PATH (`$HOME/.foundry/bin`).

### Lint / test / typecheck

Standard commands are documented in `frontend/package.json` scripts:

- `pnpm -C frontend lint` — ESLint (has 1 pre-existing warning; `--max-warnings 0` causes exit code 1)
- `pnpm -C frontend typecheck` — TypeScript (has 1 pre-existing error in `DeployVault.tsx` — `meteoraAlphaVault` type mismatch)
- `pnpm -C frontend test` — Vitest (267 tests, all passing)
- `forge test` — Foundry unit tests (72 tests, all passing)

### Non-obvious caveats

- **Git submodules are required** for Foundry compilation. Run `git submodule update --init --recursive` after cloning. The submodule tree is deep (Uniswap CCA/Liquidity Launcher pull in many transitive submodules) and takes ~2 minutes.
- **Two separate pnpm lockfiles**: root `pnpm-lock.yaml` (Solidity deps like OpenZeppelin, LayerZero) and `frontend/pnpm-lock.yaml` (frontend deps). Install both: `pnpm install` at root, then `pnpm -C frontend install`.
- **Foundry path**: After installing via `foundryup`, binaries are at `$HOME/.foundry/bin`. Add to PATH or invoke directly.
- **`.env` files**: Copy `.env.example` at root and `frontend/.env.example` for local dev. Most env vars are optional for basic frontend dev — the app runs without external service credentials but wallet/auth features require Privy, Supabase, etc.
- **API routing**: Vercel API routes go through `frontend/api/[...path].ts` dispatching to `frontend/api/_handlers/_routes.ts`. New endpoints must be registered in the static route map (no dynamic imports).
- **`pnpm.onlyBuiltDependencies`** is configured in `frontend/package.json` to avoid interactive `pnpm approve-builds` prompts.
- **Waitlist/marketing page on localhost**: By default, `localhost` is treated as the "app" domain and redirects unauthenticated users to `4626.fun`. To test the waitlist/marketing page locally, set `VITE_HOST_MODE_OVERRIDE=marketing` and `VITE_MARKETING_ORIGIN=http://localhost:5173` in `frontend/.env`. This is already configured in the Cloud Agent `.env`.
