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
| [vault-deployment-ops.md](./archives/vault-deployment-ops.md) | — | Foundry/AA/batcher deploy runbook |
| [deploy-vault-operator.md](./archives/deploy-vault-operator.md) | — | Deploy-session autopilot |
| [ajna-vault-ops.md](./archives/ajna-vault-ops.md) | — | Nested Ajna sleeve + **v1.20.0 launch expectations** (buffer vs LP, dust, Safe handoff) |
| [lottery-vrf-ops.md](./archives/lottery-vrf-ops.md) | — | VRF hub, integrator, lottery manager |
| [swap-execution.md](./archives/swap-execution.md) | — | `/swap`, paymaster, txRouter |
| [alfaclub-ops.md](./archives/alfaclub-ops.md) | [core](./archives/alfaclub-ops-core.md) · [ops](./archives/alfaclub-ops-ops.md) · [prefs](./archives/alfaclub-ops-prefs.md) | Hermit, `/h`, room 1659, counter-trade, ETH→FriendKey quote |
| [wallet-identity.md](./archives/wallet-identity.md) | — | PROTOCOL vs CANONICAL CSW |
| [wallet-csw-lifecycle.md](./archives/wallet-csw-lifecycle.md) | — | Server CSW delegation, XMTP, ERC-8004, deploy-session steps |
| [wallet-relay-owner-install.md](./archives/wallet-relay-owner-install.md) | — | Relay, owner-install |
| [infra-ops.md](./archives/infra-ops.md) | [core](./archives/infra-ops-core.md) · [ops](./archives/infra-ops-ops.md) · [prefs](./archives/infra-ops-prefs.md) | Supabase, Vercel, Railway, Solana |
| [tribe-run.md](./archives/tribe-run.md) | — | Tribe.run token launch, `4626fun/4626` public face, sponsor badge, permissionless swaps |
| [ui-shipped-preferences.md](./archives/ui-shipped-preferences.md) | — | **Reference only — excluded from index** |
| [historical-audits.md](./archives/historical-audits.md) | — | Retired epoch history |

## Keyword router (symptom → one sub-archive)

| Keywords / symptom | Load |
|--------------------|------|
| OTP, Privy loop, bootstrap 500, wallet sign-in | `waitlist-auth-core.md` |
| Waitlist tray, social proof, loading UX | `waitlist-auth-ui.md` |
| Collision merge, localhost Privy, grep zero hits | `waitlist-auth-ops.md` |
| Greenfield cutover, bytecode store, epoch script | `deploy-cutovers-core.md` |
| DeployVault, strategy features, Phase 3 | `deploy-cutovers-vault.md` |
| DeploymentBatcher / Foundry deploy paths | `vault-deployment-ops.md` |
| Deploy-session autopilot / continue | `deploy-vault-operator.md` |
| Ajna buffer empty pool, moveFromBuffer, v1.20.0 sleeve launch | `ajna-vault-ops.md` |
| VRF, lottery randomness, integrator | `lottery-vrf-ops.md` |
| AA25, paymaster, txRouter, canonical4337 | `swap-execution.md` |
| EIP-8130, native AA, Base Cobalt, EntryPoint migration | [docs/_internal/eip-8130-native-aa-readiness.md](../_internal/eip-8130-native-aa-readiness.md) |
| `/h pos`, counter-trade, room 1659, Hermit | `alfaclub-ops-core.md` |
| ETH→FriendKey, buyWithEth, Zora tradeQuote, Sudoswap ERC-1155 quote | `alfaclub-ops-core.md` |
| Railway Hermit health, daily brief bot | `alfaclub-ops-ops.md` |
| PROTOCOL vs CANONICAL, XMTP inbox | `wallet-identity.md` |
| Deploy-session owner delegation, ERC-8004, Privy agent wallet | `wallet-csw-lifecycle.md` |
| Solana hook upgrade, KPR, Vercel deploy | `infra-ops-core.md` |
| Supabase migration, feature flags | `infra-ops-ops.md` |
| Tribe.run, sponsor badge, `4626fun/4626` public repo | `tribe-run.md` |

**Search tip:** Cursor Grep often returns zero hits — use shell `rg` scoped to `frontend/src`, `frontend/server`, or `contracts/`.

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

- **Open threads / next prompts:** [OPEN_THREADS.md](./OPEN_THREADS.md)
- Prompt cheat sheet: [prompt-templates.md](./prompt-templates.md) and `.cursor/commands/` (swap-bug, deploy-cutover, wallet-csw, waitlist-auth-debug, alfaclub-ops, fast-bugfix, contracts-test). SEO commands in `.cursor/commands/optional/`.
- Account model authority: [docs/_internal/ACCOUNT_MODEL.md](../_internal/ACCOUNT_MODEL.md)
- Native AA (EIP-8130 / Base Cobalt) readiness + migration plan: [docs/_internal/eip-8130-native-aa-readiness.md](../_internal/eip-8130-native-aa-readiness.md)
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
| Marketing SEO / a11y smoke | `pnpm -C frontend validate:seo-smoke` (needs running dev server or `--serve`) |
| Deploy guards / CSW env drift | `pnpm -C frontend validate:deploy-guards` |
| Quick agent gate (no full test) | `pnpm -C frontend validate:agent-quick` |
| Context line budgets | `pnpm -C frontend guard:agent-context` |
| Native AA (EIP-8130) rollout tripwire | `pnpm -C frontend ops:check-native-aa` |

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
| `deploy-vault-operator` | Vault deploy orchestration (path-scoped) |
| `vault-deployment` | Creator vault lifecycle (path-scoped) |
| `swap-integration` | **4626 thin skill** — txRouter/paymaster; not generic Uniswap |
| `creator-profile-enrichment` | Creator metadata pipelines |
| `oft-chain-config` | LayerZero ShareOFT peers |
| `lottery-vrf-ops` | Jackpot / VRF operations |
| `yield-strategy-management` | Vault strategy config |
| `ajna-vault-ops` | Nested Ajna sleeve / buffer lend / v1.20.0 expectations |
| `zora-cli` | Zora CLI — slash-only |
| `modern-python` | Python tooling — slash-only |

`agents-memory-updater` is a cursor-team-kit **subagent**, not a project skill file.

## Disabled / optional skills

Removed from repo: `moltbook`, `farcaster-agent` (no integration). Generic Uniswap doc removed from git — recover via `git show 0fb1b733f:.cursor/skills/swap-integration/references/uniswap-generic-archived.md` if needed.

## Operator settings (outside repo)

See [OPERATOR_CURSOR.md](./OPERATOR_CURSOR.md). Summary:

- `.cursor/settings.json` — third-party import **off**; supabase + cursor-team-kit on; vercel/tierzero/continual-learning/create-plugin off
- `.cursor/mcp.json` — **empty** (optional servers in `.cursor/mcp.optional.json`)
- `.cursor/rules/tierzero-incident-only.mdc` — blocks proactive TierZero when plugin re-enabled
- Global `~/.cursor/mcp.json` — pruned to **railway + supabase** (backup: `mcp.json.backup-*`)
- Re-run: `bash scripts/apply-operator-cursor-efficiency.sh`

**Manual (Cursor UI):** Replace User Rules with paste block in [`.cursor/USER_RULES_REPLACEMENT.md`](../.cursor/USER_RULES_REPLACEMENT.md) (~5 lines vs ~100+).

Curated skills: [`.cursor/skills/CURATED_SKILLS.md`](../.cursor/skills/CURATED_SKILLS.md) — ignore 90+ global plugin skills unless task needs them.
