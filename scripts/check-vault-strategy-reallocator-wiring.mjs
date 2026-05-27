#!/usr/bin/env node

import { readFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function read(relPath) {
  return readFileSync(path.join(ROOT, relPath), 'utf8')
}

function assertIncludes(relPath, needle, label) {
  const text = read(relPath)
  if (!text.includes(needle)) {
    throw new Error(`${label}: expected ${relPath} to include ${JSON.stringify(needle)}`)
  }
}

function assertNotIncludes(relPath, needle, label) {
  const text = read(relPath)
  if (text.includes(needle)) {
    throw new Error(`${label}: expected ${relPath} NOT to include stale ${JSON.stringify(needle)}`)
  }
}

function main() {
  const checks = [
    () => assertIncludes(
      'frontend/api/_handlers/keeper/jobs/_enqueueActiveVaults.ts',
      "'rebalance'",
      'keeper_jobs rebalance workflow',
    ),
    () => assertIncludes(
      'frontend/api/_handlers/keeper/jobs/_enqueueActiveVaults.ts',
      'parseMinDeviationBps',
      'enqueue minDeviationBps parsing',
    ),
    () => assertIncludes(
      'frontend/api/_handlers/_routes.ts',
      "'keeper/rebalance-strategies'",
      'rebalance-strategies route',
    ),
    () => assertIncludes(
      'kpr/runner.ts',
      "case 'vault-strategy-reallocator'",
      'KPR runner workflow',
    ),
    () => assertIncludes(
      'kpr/workflows/4626.workflow.ts',
      'executeVaultStrategyReallocator',
      'unified 4626 workflow step 8',
    ),
    () => assertIncludes(
      'kpr/actions/vault-strategy-reallocator.action.ts',
      'runRebalancePassLoop',
      'multi-pass reallocator loop',
    ),
    () => assertIncludes(
      'kpr/actions/vault-strategy-reallocator.action.ts',
      'maxPassesHit',
      'batch maxPassesHit metric',
    ),
    () => assertIncludes(
      'docs/operations/vault-strategy-reallocation.md',
      'Regression gates',
      'ops runbook regression section',
    ),
    () => assertNotIncludes(
      'kpr/README.md',
      'Rebalance roadmap:',
      'stale KPR README roadmap copy',
    ),
    () => assertIncludes(
      'AGENTS.md',
      'KEEPER_ACTIVE_VAULT_WORKFLOWS=...,rebalance',
      'AGENTS keeper_jobs rebalance enablement',
    ),
  ]

  for (const check of checks) check()
  console.log('[guard:vault-strategy-reallocator] OK')
}

try {
  main()
} catch (error) {
  console.error(`[guard:vault-strategy-reallocator] ${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
}
