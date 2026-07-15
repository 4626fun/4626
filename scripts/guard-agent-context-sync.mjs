#!/usr/bin/env node
/**
 * Verify agent-context-budget.mdc is synced (compact Tier 1 present).
 * Run after editing preferences-active.md or the rule directly.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const rulePath = path.join(root, '.cursor/rules/agent-context-budget.mdc')
const rule = fs.readFileSync(rulePath, 'utf8')

const required = [
  '## Tier 1 active preferences (compact)',
  '## Wallet / deploy checkpoint (tombstone)',
  '## Archives (load on demand only)',
  'Full editable source: `docs/agent-context/preferences-active.md`',
]

for (const needle of required) {
  if (!rule.includes(needle)) {
    console.error(`agent-context-budget.mdc missing: ${needle}`)
    console.error('Run: node scripts/sync-agent-context-rule.mjs')
    process.exit(1)
  }
}

if (rule.includes('## Execution discipline')) {
  console.error('agent-context-budget.mdc still has full Tier 1 prose — run sync script for compact form')
  process.exit(1)
}

console.log('agent-context-budget.mdc sync structure ok')
