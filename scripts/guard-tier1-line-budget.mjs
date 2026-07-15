#!/usr/bin/env node
/** Fail if preferences-active.md exceeds line budget. Usage: node scripts/guard-tier1-line-budget.mjs */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const MAX = Number(process.env.TIER1_MAX_LINES || 80)
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const file = path.join(root, 'docs/agent-context/preferences-active.md')
const lines = fs.readFileSync(file, 'utf8').split('\n').length
if (lines > MAX) {
  console.error(`preferences-active.md line budget exceeded: ${lines} > ${MAX}`)
  process.exit(1)
}
console.log(`preferences-active.md line budget ok (${lines}/${MAX})`)
