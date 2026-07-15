# Agent Context Index

Tiered context budget for Cursor agents. Reduces always-on token load while preserving invariant access.

## Tier map

| Tier | File(s) | Always-on? | When to load |
|------|---------|-------------|--------------|
| **0** | [AGENTS.md](../AGENTS.md), `.cursor/rules/*.mdc` | Yes | Every session (automatic) |
| **1** | [preferences-active.md](./preferences-active.md) | Yes | Every session (via `agent-context-budget.mdc`) |
| **2** | [archives/](./archives/) | No | When task touches that domain — `@` mention or explicit "load archive" |
| **3** | [prompt-templates.md](./prompt-templates.md) | No | User pastes template into chat |

## Archives (Tier 2)

| Archive | Load when |
|---------|-----------|
| [waitlist-auth.md](./archives/waitlist-auth.md) | Privy, OTP, OAuth, session, bootstrap, `/waitlist`, accounts link |
| [swap-execution.md](./archives/swap-execution.md) | `/swap`, `canonical4337`, paymaster, AA25, Permit2, txRouter |
| [deploy-cutovers.md](./archives/deploy-cutovers.md) | Greenfield cutover, bytecode store, DeploymentBatcher, vault deploy |
| [alfaclub-ops.md](./archives/alfaclub-ops.md) | Hermit, `/h`, room 1659, counter-trade, daily brief |
| [wallet-identity.md](./archives/wallet-identity.md) | PROTOCOL vs CANONICAL CSW, XMTP agent inbox, ERC-8004 |
| [wallet-relay-owner-install.md](./archives/wallet-relay-owner-install.md) | Relay Part 1/2, Base App UserOp, owner-install |
| [infra-ops.md](./archives/infra-ops.md) | Supabase, Vercel, Railway, Solana, indexer, cron |
| [ui-shipped-preferences.md](./archives/ui-shipped-preferences.md) | UI polish already implemented — reference only |
| [historical-audits.md](./archives/historical-audits.md) | Past audit passes, retired epoch history |

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

- Prompt cheat sheet: [prompt-templates.md](./prompt-templates.md)
- Account model authority: [docs/_internal/ACCOUNT_MODEL.md](../_internal/ACCOUNT_MODEL.md)
- Wallet policy code: `frontend/src/wallet/canonicalWalletPolicy.ts`
