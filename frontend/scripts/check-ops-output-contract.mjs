#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')

const helpCommands = [
  ['pnpm', ['exec', 'tsx', 'scripts/ops/verify-batcher-pipe-a-readiness.ts', '--help']],
  ['pnpm', ['exec', 'tsx', 'scripts/ops/verify-bytecode-store-seeded.ts', '--help']],
  ['pnpm', ['exec', 'tsx', 'scripts/ops/verify-phase3-helper-create2-auth.ts', '--help']],
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

function main() {
  const failures = []
  for (const [cmd, args] of helpCommands) {
    const label = `${cmd} ${args.join(' ')}`
    const result = run(cmd, args)
    if (result.code !== 0) {
      failures.push(`${label}: exited ${result.code}`)
      continue
    }
    const output = result.stdout
    if (!output.includes('--json')) failures.push(`${label}: missing --json help flag`)
    if (!output.includes('--markdown')) failures.push(`${label}: missing --markdown help flag`)
  }

  if (failures.length > 0) {
    process.stderr.write('ops output contract failed:\n')
    for (const failure of failures) process.stderr.write(`- ${failure}\n`)
    process.exit(1)
  }
  process.stdout.write('ops output contract: PASS\n')
}

main()
