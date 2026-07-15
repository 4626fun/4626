# infra-ops preferences

Cross-cutting operator prefs: [preferences-active.md](../preferences-active.md).
Parent index: [infra-ops.md](./infra-ops.md). **Read one sub-archive only**.

## Learned User Preferences

- Nest optional substeps (for example extra channel binding) under the primary step with a compact expandable affordance instead of introducing separate numbered steps when the flow is still one phase.

- When inspecting production envs or service variables (Railway, Vercel, Supabase, AlfaClub, etc.), avoid unredacted full dumps such as `railway variables --json`; query scoped keys or redact output, and rotate any secret material that was printed.

- For continual-learning runs, the user expects the full `agents-memory-updater` flow with strict incremental transcript processing and index refresh (new/updated mtimes only), high-signal updates applied per `docs/agent-context/INDEX.md` routing (not bloating `AGENTS.md`), plus a concise run report.

- In user-facing communication for this workspace, avoid using the words "scrape" or "crawl" unless the user explicitly asks for those terms.

- Run nginx, certbot, and `systemctl` for the Solana keeper orchestrator on the remote Solana ops host over SSH with sudo, not from the local dev checkout — Vultr web login alone is not enough for checkpoint resets, orchestrator env edits, or `systemctl restart`; use `VULTR_USERNAME` + `VULTR_IP_ADDRESS` from local env when available (`pnpm -C frontend ops:verify-akita-prelaunch --production --ssh-vultr` probes orchestrator health over SSH).

- Prefer `hello@4626.fun` as the Let's Encrypt contact email when issuing new `*.4626.fun` nginx certificates on the Solana ops host.

- Immersive multi-panel scroll sections should use consistent vertical spacing between panels — match the hero-to-"One vault, two tokens" gap rather than large uneven gaps.

- After X linking (skippable), offer an optional external-EOA wallet connect step before entering the app.

- User prefers **Matrixed RPC endpoints over Alchemy for Base** ("better specs"), so default to keeping Base RPC on Matrixed unless Matrixed is actually down — but be aware Matrixed Base (`eu.endpoints.matrixed.link`) has previously returned **426 Upgrade Required** on `app.4626.fun`, which the `/api/rpc` proxy treats as a failover trigger. When syncing RPC env across `.env` / `frontend/.env` / Vercel, leave `kpr/.env` and `indexer/.env` on their current provider unless the user asks to switch them too.

- For keeper/automation wallet optimization work, **ignore grandfathered AKITA vault on-chain rewiring** — focus on the forward-looking wallet/role model (keeper EOA, hot automation Safe, cold treasury Safe, isolated signer resolvers) rather than legacy vault manager/admin migrations.

- In shared protocol Solidity identifiers and comments, use lane-specific subjects (**AGENT**, **CREATOR**) rather than **AKITA** branding unless the AKITA product lane is explicit (e.g. do not label `AgentOracle` paths as AKITA).
