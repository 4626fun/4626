#!/usr/bin/env tsx
/**
 * Railway Keepr Primary Doctor
 *
 * Run this locally (with the same env vars you intend to use on Railway) to validate
 * that the Keepr primary will actually boot instead of hard-exiting on misconfigured env.
 *
 * Usage:
 *   pnpm -C frontend exec tsx ../scripts/agent/railway-keepr-primary-doctor.ts
 *
 * Or with env:
 *   env $(cat .env | xargs) pnpm -C frontend exec tsx ../scripts/agent/railway-keepr-primary-doctor.ts
 */

import { isDbConfigured } from '../../frontend/server/_lib/db/postgres.js'
import { hasDedicatedMount, findMountedAncestorPath } from '../../frontend/server/_lib/messaging/xmtpDbDirectory.js'
import {
  hasCanonicalCswRuntimeConfig,
  listRetiredCanonicalCswEnvKeys,
  readCanonicalCswAddressEnv,
  readCanonicalCswPrivyWalletIdEnv,
} from '../../frontend/server/_lib/wallet/canonicalCswEnv.js'
import { isKeeprRailwayAlfaClubSplit } from '../../frontend/server/_lib/alfaclub/keeprAlfaClubSplit.js'
import path from 'node:path'

const RED = '\x1b[31m'
const GREEN = '\x1b[32m'
const YELLOW = '\x1b[33m'
const RESET = '\x1b[0m'

function check(name: string, condition: boolean, required: boolean = true) {
  const icon = condition ? `${GREEN}✓${RESET}` : required ? `${RED}✗${RESET}` : `${YELLOW}?${RESET}`
  console.log(`${icon} ${name}`)
  return condition
}

console.log('\n=== Keepr Railway Primary Doctor ===')
console.log('This script checks the most common things that cause the primary to hard-crash on Railway.')
console.log('On Railway itself you will also see very early [eliza][early] diagnostics (a table) during module load.\n')

const AGENT_RUNTIME_ROLE = (process.env.AGENT_RUNTIME_ROLE ?? 'primary').trim().toLowerCase() as 'primary' | 'standby'
const AGENT_CONSUME_XMTP = ['1', 'true', 'yes'].includes((process.env.AGENT_CONSUME_XMTP ?? '').trim().toLowerCase())
const RUNNING_ON_RAILWAY = Object.keys(process.env).some(k => k.startsWith('RAILWAY_'))

const hasDb = isDbConfigured()
const hasEncKey = !!(process.env.XMTP_AGENT_KEY_ENCRYPTION_KEY ?? '').trim()
const hasPrivateKey = !!(process.env.XMTP_AGENT_PRIVATE_KEY ?? '').trim()
const hasCswAddress = !!readCanonicalCswAddressEnv()
const hasCswPrivyWallet = !!readCanonicalCswPrivyWalletIdEnv()
const hasCswConfig = hasCanonicalCswRuntimeConfig()
const hasSingleAgentCsw = hasCswAddress && hasCswPrivyWallet

const multiAgentConfigured = hasDb && hasEncKey

console.log('--- Core Role & Consumption ---')
check('AGENT_RUNTIME_ROLE=primary', AGENT_RUNTIME_ROLE === 'primary')
check('AGENT_CONSUME_XMTP=true (or default when role=primary)', AGENT_CONSUME_XMTP || AGENT_RUNTIME_ROLE === 'primary')

if (RUNNING_ON_RAILWAY) {
  console.log('\n--- Railway Primary Requirements ---')
  check('Running in Railway context (RAILWAY_* vars present)', true)
  check('AGENT_RUNTIME_ROLE must be primary on Railway', AGENT_RUNTIME_ROLE === 'primary')
  check('AGENT_CONSUME_XMTP must be true on Railway primary', AGENT_CONSUME_XMTP || AGENT_RUNTIME_ROLE === 'primary')
}

console.log('\n--- Database & Encryption ---')
check('DATABASE_URL (Supabase preferred) or POSTGRES_URL (legacy)', hasDb)
check(
  'XMTP_AGENT_KEY_ENCRYPTION_KEY present (multi-agent only)',
  hasEncKey || !hasDb || hasSingleAgentCsw,
)
if (hasSingleAgentCsw && !hasEncKey) {
  console.log('   Single-agent CSW mode — encryption key not required')
}

console.log('\n--- XMTP Storage (Critical on Railway) ---')
const xmptDbDir = process.env.XMTP_DB_DIRECTORY || '/data/xmtp'
const isPersistent = !xmptDbDir.startsWith('/tmp')
check('XMTP_DB_DIRECTORY is not /tmp (persistent storage)', isPersistent)

if (RUNNING_ON_RAILWAY) {
  const hasVolume = hasDedicatedMount(xmptDbDir)
  check('Dedicated Railway volume mounted at XMTP_DB_DIRECTORY', hasVolume)
  if (!hasVolume) {
    const ancestor = findMountedAncestorPath(xmptDbDir)
    console.log(`   Current path resolves to ephemeral storage. Closest mount: ${ancestor || 'none'}`)
    console.log(`   → You must attach a Railway Volume and mount it at ${xmptDbDir}`)
  }
}

console.log('\n--- Agent Identity (Recommended: CSW + Privy Server Wallet) ---')
const retiredCanonicalCswEnv = listRetiredCanonicalCswEnvKeys()
check(
  'No retired XMTP_AGENT_CSW_* / VITE_AGENT_XMTP_* env keys',
  retiredCanonicalCswEnv.length === 0,
)
if (retiredCanonicalCswEnv.length > 0) {
  console.log(`   Remove ignored legacy keys and use CANONICAL_CSW_*: ${retiredCanonicalCswEnv.join(', ')}`)
}
check('CANONICAL_CSW_ADDRESS present', hasCswAddress)
check('CANONICAL_CSW_PRIVY_WALLET_ID present (the signer for the CSW)', hasCswPrivyWallet)

if (hasCswAddress && !hasCswPrivyWallet) {
  console.log('   Missing PRIVY_WALLET_ID for the agent\'s CSW')
}

console.log('\n--- Privy Server Auth (required for CSW signing) ---')
const hasPrivyApp = !!(process.env.PRIVY_APP_ID && process.env.PRIVY_APP_SECRET)
const hasPrivyWalletAuth = !!(process.env.PRIVY_WALLET_AUTHORIZATION_KEY && process.env.PRIVY_WALLET_OWNER_ID)
check('PRIVY_APP_ID + PRIVY_APP_SECRET', hasPrivyApp)
check('PRIVY_WALLET_AUTHORIZATION_KEY + PRIVY_WALLET_OWNER_ID', hasPrivyWalletAuth || hasSingleAgentCsw)
if (hasSingleAgentCsw && !(hasPrivyApp && hasPrivyWalletAuth)) {
  console.log('   Optional for single-agent CSW — Keepr signs via CANONICAL_CSW_PRIVY_WALLET_ID')
}

console.log('\n--- AlfaClub split (Keepr vs Hermit) ---')
if (isKeeprRailwayAlfaClubSplit()) {
  console.log(`${GREEN}✓${RESET} AlfaClub in-process bridge skipped on Railway Keepr (separate Hermit/Vercel bot)`)
} else if (RUNNING_ON_RAILWAY) {
  console.log(`${YELLOW}?${RESET} ALFACLUB_CHAT_BRIDGE_ALLOW_RAILWAY=1 — in-process bridge allowed on this Railway service`)
} else {
  console.log(`${GREEN}✓${RESET} Not Railway — AlfaClub boot follows ALFACLUB_CHAT_BRIDGE_ENABLED`)
}

console.log('\n--- Summary ---')
const criticalErrors = []

if (RUNNING_ON_RAILWAY) {
  if (AGENT_RUNTIME_ROLE !== 'primary') criticalErrors.push('AGENT_RUNTIME_ROLE must be "primary"')
  if (!AGENT_CONSUME_XMTP && AGENT_RUNTIME_ROLE === 'primary') criticalErrors.push('AGENT_CONSUME_XMTP must be true')
}

if (!hasDb) criticalErrors.push('DATABASE_URL (Supabase) / POSTGRES_URL (legacy) is required')
if (!hasEncKey && hasDb && !hasSingleAgentCsw && !hasPrivateKey) {
  criticalErrors.push('XMTP_AGENT_KEY_ENCRYPTION_KEY is required for multi-agent (or configure single-agent CSW / XMTP_AGENT_PRIVATE_KEY)')
}

if (RUNNING_ON_RAILWAY && !hasDedicatedMount(xmptDbDir)) {
  criticalErrors.push(`Dedicated volume required at ${xmptDbDir}`)
}

if (criticalErrors.length > 0) {
  console.log(`${RED}CRITICAL ISSUES FOUND:${RESET}`)
  criticalErrors.forEach(e => console.log(`  - ${e}`))
  console.log('\nFix these on your Railway service and redeploy.')
  process.exit(1)
} else {
  console.log(`${GREEN}Basic requirements look good for Railway primary.${RESET}`)
  console.log('If it still crashes, check the detailed logs from the early [eliza][early] output.')
}

console.log('\nTip: On Railway, add these two temporarily for maximum visibility:')
console.log('  ELIZA_HEALTH_VERBOSE=true')
console.log('  XMTP_SUPPRESS_LOG_NOISE=0')
console.log('')