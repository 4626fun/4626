#!/usr/bin/env node
/**
 * Sync Tier 1 from preferences-active.md into agent-context-budget.mdc.
 * Always-on rule gets COMPACT bullets; full prose stays in preferences-active.md only.
 *
 * Usage: node scripts/sync-agent-context-rule.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const prefsPath = path.join(root, 'docs/agent-context/preferences-active.md')
const rulePath = path.join(root, '.cursor/rules/agent-context-budget.mdc')

const COMPACT = `## Tier 1 active preferences (compact)

- **Execute:** smallest safe diff; do not edit attached plans; commit+push when done; kill **background jobs** not all terminals; run local ops directly; broad sweeps use subagents.
- **Validate:** \`pnpm -C frontend exec vitest run <file>\` (not \`pnpm test -- --run\`); report every command with exit code; scope \`forge test\` away from Rebalance suite when unrelated.
- **Copy:** waitlist ≠ whitelist; never Base/Coinbase sub-accounts; identity order Zora → Basename → ENS → 0x; avoid "scrape"/"crawl" in user copy.
- **Credentials:** \`ALFACLUB_API_KEY\` only bot token; scoped env reads (no \`railway variables --json\`); HF Router is Cursor-only — never production OpenAI/Hermit lanes.
- **Infra:** no Vercel PR previews (\`main\` only); hard cutover when user says continue/fix all; lane-neutral naming when no live vaults; arms ≠ strategies (legs = Charm/Ajna).
- **Share-mesh LZ:** before Pipe A / share bridge, \`pnpm -C frontend ops:verify-share-mesh-lz\` exit 0 — template \`[15, 32]\` (never Base default 10 vs Solana inbound 15); load \`oft-chain-config\`.
- **UI/docs:** shadcn brand palette on waitlist; no /swap IA redesign; token icon targeted refinements only; public docs exclude \`docs/_internal/\`.
- **Learning:** append to \`docs/agent-context/\` not AGENTS.md; Tier 1 cap 80 lines in preferences-active.md.
- **Search:** built-in codebase Grep is unreliable here — use shell \`rg\` scoped to \`frontend/src\`, \`frontend/server\`, or \`contracts/\` (never unscoped over repo root).

Full editable source: \`docs/agent-context/preferences-active.md\`.

## Wallet / deploy checkpoint (tombstone)

Before editing wallet, auth, XMTP, deploy-session, swap, or paymaster paths: load **\`ERC-4337-Wallet-Invariants.mdc\`** and run \`pnpm -C frontend validate:wallet\` first.`

const rule = fs.readFileSync(rulePath, 'utf8')
const startMarker = '## Tier 1 active preferences'
const endMarker = '## Archives (load on demand only)'
const startIdx = rule.indexOf(startMarker)
const endIdx = rule.indexOf(endMarker)
if (startIdx < 0 || endIdx < 0 || endIdx <= startIdx) {
  console.error('Markers missing in agent-context-budget.mdc')
  process.exit(1)
}

// Verify preferences-active.md exists and cap
const prefs = fs.readFileSync(prefsPath, 'utf8')
const prefLines = prefs.split('\n').length
if (prefLines > 80) {
  console.warn(`warn: preferences-active.md is ${prefLines} lines (cap 80)`)
}

const before = rule.slice(0, startIdx)
const after = rule.slice(endIdx)
const synced = `${before}${COMPACT}\n\n${after}`
if (synced === rule) {
  console.log('agent-context-budget.mdc already in sync')
  process.exit(0)
}
fs.writeFileSync(rulePath, synced)
console.log('Synced compact Tier 1 into agent-context-budget.mdc')
