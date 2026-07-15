# Deploy Cutovers — preferences

Cross-cutting operator prefs: [preferences-active.md](../preferences-active.md).
Parent index: [deploy-cutovers.md](./deploy-cutovers.md). **Read one sub-archive only**.

## Learned User Preferences

- When a task comes with an attached implementation plan, pre-created todos, or a high-stakes deployment runbook, execute against that source of truth without editing it, preserve branch/version/checkpoint state exactly across pauses or resumes, and use the existing todo set (marking items in-progress/completed) instead of recreating tasks.

- After rotating Hermit creative-brain env (`HERMIT_AGENT_CHAT_ENDPOINT` / `HERMIT_AGENT_BEARER_TOKEN` and provider/model keys), expect a Vercel production redeploy (and local `frontend/.env` sync) before treating creative Hermit as live in prod.

- During Base infra greenfield cutover work, **continue** or **fix all** means completing post-broadcast repo sync end-to-end (handoff validation, release guard, addresses/inventory/defaults, env sync, production env pushes when in scope) — not stopping at partial doc-only updates.

- Prefer **correct lane-neutral contract/file naming** over preserving deployment compatibility when there are **no live vaults** — accept manifest regeneration, CREATE2 address changes, module identity-string updates, and `UniversalBytecodeStore` re-seed rather than keeping historical `Creator*`-prefixed names on lane-shared infra.

- When asked to restart local dev servers or complete local ops (kill old Vite/Anvil, run `pnpm -C frontend run dev:deploy-dry-run`, verify WASM/ports), execute those steps directly rather than only pasting commands.

- For deploy/Solana product docs and UI copy, state the current architecture directly (ShareOFT mesh at finalize, Charm + Ajna at Phase 3) — avoid "legacy", "retired", or "removed" framing and do not name deleted contracts in user-facing copy.

- Creator strategy feature activation (deploy gate only — **no address-vanity UI**) belongs **in the deploy flow** on `/deploy/vault` — embed `CreatorStrategyFeaturesPanel` there (`variant="deploy"`) and redirect legacy `/creator/strategy/features?creator=…` to `/deploy/vault?creator=…`; hide optional vault-prefix / share-suffix vanity tiers from the deploy page (free default `4626` prefix/suffix only).

- On Deploy UI surfaces, prefer a canonical always-visible stage timeline with plain-language phase labels/status and explicit disabled states, rather than hiding or ambiguously marking stages as "optional." The Deploy Vault page uses the premium dark redesign (`DeployHero` with pills — top-right Base `NetworkBadge` removed, restyled deploy card, structured `role="alert"` "Deployment failed" card instead of raw red error dumps, presentation-only toasts watching existing state transitions) — styling passes must stay presentation-only and never touch deploy logic. Pre-deploy **choice cards**: coin card uses the **Zora logo** (not a generic wireframe); vault card reuses the landing **obsidian `VaultModel`** (`/immersive/assets/vault/ethereum_vault.glb`, same lighting/poster fallback as `4626.fun` hero). Address rows render the **full untruncated address** (mono, wrapping) with copy/BaseScan icons — no click-to-expand. Separate **"Your contracts"** from protocol shared infrastructure structurally as **side-by-side two-column layouts** (protocol factories/modules/helpers in one column, the user's contracts in the other, with row baselines aligned across columns — pad missing per-column descriptions so rows line up); the emergency-safety wiring section uses the same two-column split. Attach **protocol/brand logos wherever possible** on contract rows (Base, Solana, Chainlink, Safe for treasury rows, Uniswap near the CCA auction phase) via `frontend/public/protocols/` + `PROTOCOL_LOGOS`/`manifest.json`. During dry-run/deploy, contract rows should update dynamically (green check per contract as it lands) and completed phases show a green **complete** pill. **Phase 5 (`phase5SolanaMeteora`)** follows Phase 4 for Solana share-mesh + Meteora DLMM provisioning — show contract name, full address, and Meteora/LZ/4626 logos like earlier phases; include pool pair, quote mint (SOL/USDC), creation tx link, OFT store when known, **Meteora Alpha Vault (bundle · operator step)** as a required bundle lane (not "legacy optional"), Token-2022 transfer-hook rows when applicable, and a static **LP seeding** manual-step row (pool created ≠ tradable until liquidity is seeded; disclose SOL seeding spend where relevant). Keep the page borderless — separation via background tint, spacing, and typography; borders only on functional affordances (inputs, timeline nodes).

- **Do not enable or pursue Vercel PR preview deployments** — product ships via **`main` production only**; canceled Preview rows from `vercel-ignore.sh` are intentional skips, not build failures to fix.

- Newcomer onboarding copy must be **accessible and professional** (formal product-documentation tone, complete FAQ answers, plain-language first) — not casual hero CTAs or insider jargon up front; use one spine across pages: Home → Getting started → Launch checklist → Step 1 Bundle / Step 2 Deploy / Step 3 Activate, with milestone clarity that **Activated ≠ trading live** (Deployed → Activated → Trading live after CCA completes).

- When the user asks to **redo docs entirely** or **start fresh**, favor structural IA resets (curated publish sets, Product → Deploy → Contracts → Legal) over another incremental Docusaurus skin pass.
