#!/usr/bin/env node
/** Fail if AGENTS.md exceeds line budget. Usage: node scripts/guard-agents-line-budget.mjs */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const MAX = Number(process.env.AGENTS_MD_MAX_LINES || 120)
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const file = path.join(root, 'AGENTS.md')
const lines = fs.readFileSync(file, 'utf8').split('\n').length
if (lines > MAX) {
  console.error(`AGENTS.md line budget exceeded: ${lines} > ${MAX}`)
  process.exit(1)
}
console.log(`AGENTS.md line budget ok (${lines}/${MAX})`)
