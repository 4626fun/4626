#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')

const guardCommands = [
  ['node', ['scripts/check-server-core-boundary.mjs', '--json']],
  ['node', ['scripts/check-frontend-boundaries.mjs', '--json']],
  ['node', ['scripts/guard-no-raw-schema-ddl.mjs', '--json']],
]

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: 'utf8',
  })
  return {
    code: result.status ?? 1,
    stdout: String(result.stdout ?? ''),
    stderr: String(result.stderr ?? ''),
  }
}

function ensureGuardJsonShape(output, label) {
  let payload
  try {
    payload = JSON.parse(output)
  } catch {
    throw new Error(`${label}: output is not valid JSON`)
  }
  if (typeof payload.guard !== 'string') throw new Error(`${label}: missing string guard`)
  if (!['pass', 'fail', 'error'].includes(payload.status)) {
    throw new Error(`${label}: invalid status`)
  }
  if (typeof payload.counts !== 'object' || typeof payload.counts.violations !== 'number') {
    throw new Error(`${label}: missing counts.violations`)
  }
  if (!Array.isArray(payload.violations)) throw new Error(`${label}: violations must be array`)
}

function main() {
  const failures = []
  for (const [cmd, args] of guardCommands) {
    const label = `${cmd} ${args.join(' ')}`
    const result = run(cmd, args)
    const out = result.stdout.trim()
    if (!out) {
      failures.push(`${label}: empty stdout`)
      continue
    }
    try {
      ensureGuardJsonShape(out, label)
    } catch (error) {
      failures.push(String(error instanceof Error ? error.message : error))
    }
  }

  if (failures.length > 0) {
    process.stderr.write('guard output contract failed:\n')
    for (const failure of failures) process.stderr.write(`- ${failure}\n`)
    process.exit(1)
  }
  process.stdout.write('guard output contract: PASS\n')
}

main()
