#!/usr/bin/env node

import fs from 'node:fs/promises'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

function git(args, { allowFailure = false } = {}) {
  try {
    return execFileSync('git', args, { encoding: 'utf8' }).trim()
  } catch (error) {
    if (allowFailure) return ''
    throw error
  }
}

function lines(output) {
  return output
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

async function readUtf8(filePath) {
  return await fs.readFile(filePath, 'utf8')
}

async function exists(filePath) {
  try {
    await fs.stat(filePath)
    return true
  } catch {
    return false
  }
}

function resolveBaseline() {
  const candidates = [
    ['merge-base', 'HEAD', 'origin/main'],
    ['merge-base', 'HEAD', 'main'],
    ['rev-parse', 'HEAD~1'],
  ]
  for (const args of candidates) {
    const value = git(args, { allowFailure: true })
    if (value) return value
  }
  return ''
}

function isWatchedRepoPath(repoPath) {
  const exact = new Set([
    'frontend/.env.example',
    'frontend/db/migrations/028_arch_b_sub_accounts.sql',
    'frontend/server/_lib/wallet/commandIssuerContext.ts',
    'frontend/server/_lib/wallet/userOperationSubmitter.ts',
    'frontend/server/_lib/wallet/spendPermission.ts',
    'frontend/server/_lib/wallet/commandIssuerContext.test.ts',
    'frontend/api/__tests__/arch-b/spendPermission.test.ts',
    'frontend/api/__tests__/arch-b/userOperationSubmitter.subAccount.test.ts',
    'frontend/api/__tests__/arch-b/status.test.ts',
  ])
  if (exact.has(repoPath)) return true
  return repoPath.startsWith('frontend/api/__tests__/arch-b/')
}

async function main() {
  const repoRoot = git(['rev-parse', '--show-toplevel'])
  const frontendRoot = path.join(repoRoot, 'frontend')

  const changedRepoPaths = new Set()
  const baseline = resolveBaseline()
  if (baseline) {
    for (const file of lines(git(['diff', '--name-only', '--diff-filter=ACMR', `${baseline}...HEAD`], { allowFailure: true }))) {
      changedRepoPaths.add(file)
    }
  }
  for (const file of lines(git(['diff', '--name-only', '--diff-filter=ACMR'], { allowFailure: true }))) {
    changedRepoPaths.add(file)
  }
  for (const file of lines(git(['diff', '--cached', '--name-only', '--diff-filter=ACMR'], { allowFailure: true }))) {
    changedRepoPaths.add(file)
  }

  const touchedWatched = [...changedRepoPaths].filter((repoPath) => isWatchedRepoPath(repoPath)).sort()

  if (touchedWatched.length === 0) {
    console.log('ok: no touched Arch-B sub-account watched paths; skipping invariant checks')
    return
  }

  const failures = []
  const requireContains = (text, needle, context) => {
    if (!text.includes(needle)) {
      failures.push(`${context}: missing \`${needle}\``)
    }
  }

  // 1) .env.example default remains off.
  const envPath = path.join(frontendRoot, '.env.example')
  if (!(await exists(envPath))) {
    failures.push('frontend/.env.example is missing')
  } else {
    const envText = await readUtf8(envPath)
    const match = envText.match(/^ARCH_B_SUB_ACCOUNTS_ENABLED=(.*)$/m)
    if (!match) {
      failures.push('frontend/.env.example must define ARCH_B_SUB_ACCOUNTS_ENABLED=0')
    } else if (match[1].trim() !== '0') {
      failures.push(
        `frontend/.env.example must keep ARCH_B_SUB_ACCOUNTS_ENABLED=0 (found ${match[1].trim()})`,
      )
    }
  }

  // 2) Migration contract remains present.
  const migrationPath = path.join(frontendRoot, 'db/migrations/028_arch_b_sub_accounts.sql')
  if (!(await exists(migrationPath))) {
    failures.push('frontend/db/migrations/028_arch_b_sub_accounts.sql is missing')
  } else {
    const migrationText = (await readUtf8(migrationPath)).toLowerCase()
    const migrationNeedles = [
      'alter table public.command_issuer_execution_context',
      'add column if not exists sub_account_address',
      'add column if not exists parent_csw_address',
      'add column if not exists spend_permission_payload',
      'add column if not exists spend_permission_signature',
      'add column if not exists spend_permission_hash',
      'add column if not exists spend_allowance_wei',
      'add column if not exists spend_period_seconds',
      'add column if not exists spend_permission_end_at',
      'add column if not exists spend_permission_revoked_at',
      'create index if not exists idx_ciec_sub_account_address',
    ]
    for (const needle of migrationNeedles) {
      if (!migrationText.includes(needle)) {
        failures.push(`028_arch_b_sub_accounts.sql: missing \`${needle}\``)
      }
    }
  }

  // 3) Wallet-layer symbols/invariants.
  const contextPath = path.join(frontendRoot, 'server/_lib/wallet/commandIssuerContext.ts')
  if (!(await exists(contextPath))) {
    failures.push('frontend/server/_lib/wallet/commandIssuerContext.ts is missing')
  } else {
    const text = await readUtf8(contextPath)
    requireContains(text, 'export type CommandIssuerSubAccount', 'commandIssuerContext.ts')
    requireContains(text, 'subAccount: CommandIssuerSubAccount | null', 'commandIssuerContext.ts')
    requireContains(text, 'function parseSubAccount(', 'commandIssuerContext.ts')
    requireContains(text, 'export async function provisionSubAccountSpendPermission(', 'commandIssuerContext.ts')
    requireContains(text, 'sub_account_address', 'commandIssuerContext.ts')
    requireContains(text, 'parent_csw_address', 'commandIssuerContext.ts')
    requireContains(text, 'spend_permission_payload', 'commandIssuerContext.ts')
  }

  const submitterPath = path.join(frontendRoot, 'server/_lib/wallet/userOperationSubmitter.ts')
  if (!(await exists(submitterPath))) {
    failures.push('frontend/server/_lib/wallet/userOperationSubmitter.ts is missing')
  } else {
    const text = await readUtf8(submitterPath)
    requireContains(text, "code: 'sub_account_feature_disabled'", 'userOperationSubmitter.ts')
    requireContains(text, "code: 'sub_account_spend_permission_revoked'", 'userOperationSubmitter.ts')
    requireContains(text, "code: 'sub_account_spend_permission_expired'", 'userOperationSubmitter.ts')
    requireContains(text, "code: 'sub_account_parent_insufficient_funds'", 'userOperationSubmitter.ts')
    requireContains(text, 'buildSpendPermissionCalls', 'userOperationSubmitter.ts')
    requireContains(text, 'isSpendPermissionApproved', 'userOperationSubmitter.ts')
    requireContains(text, 'const balanceSource: Address = issuer.subAccount', 'userOperationSubmitter.ts')
    requireContains(text, 'issuer.subAccount.parentCswAddress', 'userOperationSubmitter.ts')
    requireContains(text, 'submitWallet = issuer.subAccount.subAccountAddress', 'userOperationSubmitter.ts')
    requireContains(text, 'export function isArchBSubAccountsEnabled()', 'userOperationSubmitter.ts')
  }

  const spendPermissionPath = path.join(frontendRoot, 'server/_lib/wallet/spendPermission.ts')
  if (!(await exists(spendPermissionPath))) {
    failures.push('frontend/server/_lib/wallet/spendPermission.ts is missing')
  } else {
    const text = await readUtf8(spendPermissionPath)
    requireContains(text, 'export const SPEND_PERMISSION_MANAGER_BASE', 'spendPermission.ts')
    requireContains(text, 'export function buildSpendPermissionCalls(', 'spendPermission.ts')
    requireContains(text, 'export async function isSpendPermissionApproved(', 'spendPermission.ts')
    requireContains(text, 'if (args.amountWei > 0n)', 'spendPermission.ts')
  }

  // 4) Required regression test files and signal assertions.
  const requiredTests = [
    {
      path: 'frontend/api/__tests__/arch-b/spendPermission.test.ts',
      mustContain: ['hashSpendPermission', 'buildSpendPermissionCalls', 'amountWei: 0n'],
      allowedPrefix: 'frontend/api/__tests__/',
    },
    {
      path: 'frontend/api/__tests__/arch-b/userOperationSubmitter.subAccount.test.ts',
      mustContain: [
        'sub_account_feature_disabled',
        'sub_account_spend_permission_revoked',
        'sub_account_spend_permission_expired',
        'sub_account_parent_insufficient_funds',
        'valueWei: 0n',
        'does not prepend spend call when valueWei is 0',
      ],
      allowedPrefix: 'frontend/api/__tests__/',
    },
    {
      path: 'frontend/server/_lib/wallet/commandIssuerContext.test.ts',
      mustContain: ['preserves sub-account columns when re-provisioned with subAccount=undefined (legacy)'],
      allowedPrefix: 'frontend/server/_lib/wallet/',
    },
    {
      path: 'frontend/api/__tests__/arch-b/status.test.ts',
      mustContain: ['subAccount: null'],
      allowedPrefix: 'frontend/api/__tests__/',
    },
  ]

  for (const testSpec of requiredTests) {
    if (!testSpec.path.startsWith(testSpec.allowedPrefix)) {
      failures.push(`${testSpec.path} must stay under ${testSpec.allowedPrefix}`)
      continue
    }
    const absolutePath = path.join(repoRoot, testSpec.path)
    if (!(await exists(absolutePath))) {
      failures.push(`${testSpec.path} is missing`)
      continue
    }
    const text = await readUtf8(absolutePath)
    for (const needle of testSpec.mustContain) {
      requireContains(text, needle, testSpec.path)
    }
  }

  if (failures.length > 0) {
    console.error('error: Arch-B sub-account alignment guard failed')
    console.error('Touched watched paths:')
    for (const file of touchedWatched) {
      console.error(`- ${file}`)
    }
    console.error('Violations:')
    for (const failure of failures) {
      console.error(`- ${failure}`)
    }
    process.exit(1)
  }

  console.log('ok: Arch-B sub-account alignment invariants satisfied')
  console.log('Touched watched paths:')
  for (const file of touchedWatched) {
    console.log(`- ${file}`)
  }
}

main().catch((error) => {
  console.error(`error: ${String(error?.message ?? error)}`)
  process.exit(1)
})
