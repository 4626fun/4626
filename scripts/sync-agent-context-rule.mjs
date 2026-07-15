#!/usr/bin/env node
/**
 * Sync Tier 1 preferences from docs/agent-context/preferences-active.md
 * into .cursor/rules/agent-context-budget.mdc (between marker comments).
 *
 * Usage: node scripts/sync-agent-context-rule.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const prefsPath = path.join(root, 'docs/agent-context/preferences-active.md')
const rulePath = path.join(root, '.cursor/rules/agent-context-budget.mdc')

const prefs = fs.readFileSync(prefsPath, 'utf8')
const lines = prefs.split('\n')
const bodyStart = lines.findIndex((l) => l.startsWith('## Execution'))
if (bodyStart < 0) {
  console.error('Could not find ## Execution in preferences-active.md')
  process.exit(1)
}
const tier1Body = lines.slice(bodyStart).join('\n').trim()

const rule = fs.readFileSync(rulePath, 'utf8')
const startMarker = '## Tier 1 active preferences'
const endMarker = '## Archives (load on demand only)'
const startIdx = rule.indexOf(startMarker)
const endIdx = rule.indexOf(endMarker)
if (startIdx < 0 || endIdx < 0 || endIdx <= startIdx) {
  console.error('Markers missing in agent-context-budget.mdc')
  process.exit(1)
}

const before = rule.slice(0, startIdx + startMarker.length)
const after = rule.slice(endIdx)
const synced = `${before}\n\n${tier1Body}\n\n${after}`
if (synced === rule) {
  console.log('agent-context-budget.mdc already in sync')
  process.exit(0)
}
fs.writeFileSync(rulePath, synced)
console.log('Synced Tier 1 into agent-context-budget.mdc')
