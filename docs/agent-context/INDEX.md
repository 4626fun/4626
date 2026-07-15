# Agent Context Index

Tiered context budget for Cursor agents. Reduces always-on token load while preserving invariant access.

## Tier map

| Tier | File(s) | Always-on? | When to load |
|------|---------|-------------|--------------|
| **0** | [AGENTS.md](../AGENTS.md), `.cursor/rules/*.mdc` | Yes | Every session (automatic) |
| **1** | [preferences-active.md](./preferences-active.md) | Compact only | Full source editable; always-on copy is compact bullets in `agent-context-budget.mdc` |
| **2** | [archives/](./archives/) | No | When task touches that domain — `@` mention or explicit "load archive" |
| **3** | [prompt-templates.md](./prompt-templates.md) | No | User pastes template into chat |

## Archives (Tier 2)

**Load the index file first, then one sub-archive only** — never load full split sets.

| Index | Sub-archives | Load when |
|-------|--------------|-----------|
| [waitlist-auth.md](./archives/waitlist-auth.md) | [core](./archives/waitlist-auth-core.md) · [ui](./archives/waitlist-auth-ui.md) · [ops](./archives/waitlist-auth-ops.md) | Privy, OTP, session, bootstrap, `/waitlist` |
| [deploy-cutovers.md](./archives/deploy-cutovers.md) | [core](./archives/deploy-cutovers-core.md) · [vault](./archives/deploy-cutovers-vault.md) · [prefs](./archives/deploy-cutovers-prefs.md) | Cutover scripts, DeployVault, bytecode store |
| [swap-execution.md](./archives/swap-execution.md) | — | `/swap`, paymaster, txRouter |
| [alfaclub-ops.md](./archives/alfaclub-ops.md) | — | Hermit, `/h`, room 1659 |
| [wallet-identity.md](./archives/wallet-identity.md) | — | PROTOCOL vs CANONICAL CSW |
| [wallet-relay-owner-install.md](./archives/wallet-relay-owner-install.md) | — | Relay, owner-install |
| [infra-ops.md](./archives/infra-ops.md) | — | Supabase, Vercel, Railway, Solana |
| [ui-shipped-preferences.md](./archives/ui-shipped-preferences.md) | — | **Reference only — do not load for new work** |
| [historical-audits.md](./archives/historical-audits.md) | — | Retired epoch history |

## Continual-learning routing (`agents-memory-updater`)

When processing transcript deltas:

1. **Classify** each new fact:
   - **Tier 1** — affects most sessions (operator habit, cross-cutting constraint)
   - **Tier 2** — domain-specific (route to matching `archives/*.md`)
   - **Skip** — duplicate of AGENTS.md, shipped UI detail, or one-off incident with no recurrence

2. **Tier 1 cap:** `preferences-active.md` must stay ≤ 80 lines. When full, move oldest/lowest-signal bullet to the best-matching archive.

3. **Never** append incident essays or full address dumps to Tier 1.

4. **Incremental index** unchanged: `.cursor/hooks/state/continual-learning-index.json` (mtime-based transcript processing).

5. **Do not** bloat AGENTS.md with observational notes — AGENTS.md stays authoritative invariants only.

## Migration note

Content migrated from monolithic `docs/agent-learned-facts.md` (July 2026). That file is now a redirect stub.

## Related

- Prompt cheat sheet: [prompt-templates.md](./prompt-templates.md) and `.cursor/commands/` (deploy-cutover, waitlist-auth-debug, swap-bug, alfaclub-ops, wallet-csw, fast-bugfix, contracts-test)
- Account model authority: [docs/_internal/ACCOUNT_MODEL.md](../_internal/ACCOUNT_MODEL.md)
- Wallet policy code: `frontend/src/wallet/canonicalWalletPolicy.ts`
- Sync Tier 1 into rule: `node scripts/sync-agent-context-rule.mjs`

## Validation shortcuts per task type

| Task | Command |
|------|---------|
| Swap / txRouter / paymaster | `pnpm -C frontend validate:swap` |
| Waitlist / onboarding (full) | `pnpm -C frontend validate:waitlist` |
| Waitlist smoke (fast) | `pnpm -C frontend validate:waitlist:smoke` |
| Wallet / CSW identity | `pnpm -C frontend validate:wallet` |
| Contracts (scoped) | `pnpm -C frontend validate:contracts` |
| AlfaClub server | `pnpm -C frontend validate:alfaclub` |
| Telegram handlers | `pnpm -C frontend validate:telegram` |
| Deploy guards / CSW env drift | `pnpm -C frontend validate:deploy-guards` |
| Quick agent gate (no full test) | `pnpm -C frontend validate:agent-quick` |
| Context line budgets | `pnpm -C frontend guard:agent-context` |

Scoped single file: `pnpm -C frontend exec vitest run <path>`. Full suite: `pnpm -C frontend test` (~3.5 min).

## MCP decision table

| Symptom | MCP | When not to use |
|---------|-----|-----------------|
| Prod error / latency / incident | `tierzero_ask` | Local unit tests, doc-only edits |
| Railway env / logs / deploy | `user-railway` | Never dump full `variables --json`; redact secrets |
| Schema / data / migrations | `user-supabase` | Read-only unless explicitly migrating |
| Browser repro / UI flow | `cursor-ide-browser` | Logic covered by unit tests |
| Vercel deploy / runtime logs | `plugin-vercel-vercel` | Local Vite dev issues |

## Curated repo skills

Use these for 4626 work; ignore the 90+ global plugin skills unless the task explicitly needs them:

| Skill | Use when |
|-------|----------|
| `deploy-vault-operator` | Vault deploy orchestration |
| `vault-deployment` | Creator vault lifecycle |
| `swap-integration` | Uniswap / swap wiring |
| `creator-profile-enrichment` | Creator metadata pipelines |
| `agents-memory-updater` | Transcript → Tier 1/archive updates |
| `oft-chain-config` | LayerZero ShareOFT peers |
| `lottery-vrf-ops` | Jackpot / VRF operations |
| `yield-strategy-management` | Vault strategy config |
| `farcaster-agent` | Farcaster agent surfaces |
| `moltbook` | Moltbook integration |
| `zora-cli` | Zora CLI operations |
| `modern-python` | Python tooling in repo |

## Operator settings (outside repo)

Optional Cursor Settings tweaks: shorten global user rules, disable TierZero `alwaysApply` for non-prod sessions, prune installed plugin skills to the curated list above.
