#!/usr/bin/env tsx
/**
 * 1659 Theatrical Stack Doctor
 *
 * One command to verify that ALL the .env variables are up for the full
 * 1659 hype / theatrical marketing setup:
 *   - Hermit creative agent (rich /gmeow /hermit replies in room 1659)
 *   - 1659 Risk Watcher (automatic alerts to private relay + @fun4626)
 *   - Rich 1659 context (Hyperliquid + on-chain FriendKey curve + AlfaClub PnL)
 *
 * This is the single source of truth checker for everything related to room 1659.
 *
 * Usage:
 *   pnpm 1659:doctor
 *
 * Or with your env file:
 *   env $(cat /tmp/1659.env | xargs) pnpm 1659:doctor
 *
 * For Railway: Run this locally with the exact vars you plan to set on
 * the hermit.4626.fun service (and/or your watcher service). The script
 * will output clean copy-paste blocks at the end.
 */

import { isDbConfigured } from '../../frontend/server/_lib/db/postgres.js'

const RED = '\x1b[31m'
const GREEN = '\x1b[32m'
const YELLOW = '\x1b[33m'
const RESET = '\x1b[0m'
const BOLD = '\x1b[1m'

function check(name: string, condition: boolean, required = true) {
  const icon = condition ? `${GREEN}✓${RESET}` : required ? `${RED}✗${RESET}` : `${YELLOW}?${RESET}`
  console.log(`${icon} ${name}`)
  return condition
}

console.log('\n' + '='.repeat(70))
console.log(`${BOLD}1659 Theatrical Stack Doctor${RESET}`)
console.log('Verifies every env var needed for the full room 1659 hype machine.')
console.log('Hermit creative + Risk Watcher + rich Hyperliquid / on-chain / PnL context.')
console.log('='.repeat(70) + '\n')

const RUNNING_ON_RAILWAY = Object.keys(process.env).some((k) => k.startsWith('RAILWAY_'))

// === Shared Core (required for rich 1659 context) ===
const hasDb = isDbConfigured()
const hasAlfaClubJwt = !!(process.env.ALFACLUB_CHAT_JWT ?? '').trim()
const hasAlfaClubPrivyAccess = !!(process.env.ALFACLUB_CHAT_PRIVY_ACCESS_TOKEN ?? '').trim()
const hasAlfaClubPrivyRefresh = !!(process.env.ALFACLUB_CHAT_PRIVY_REFRESH_TOKEN ?? '').trim()
const hasAlfaClubBootstrap = hasAlfaClubJwt || (hasAlfaClubPrivyAccess && hasAlfaClubPrivyRefresh)

// === Hermit-specific ===
const hasPinataEndpoint = !!(process.env.HERMIT_PINATA_CHAT_ENDPOINT ?? '').trim()
const hasPinataBearer = !!(process.env.HERMIT_PINATA_BEARER_TOKEN ?? '').trim()
const hasHermitRooms = !!(process.env.ALFACLUB_HERMIT_COMMAND_ROOMS ?? '').trim() || !!(process.env.ALFACLUB_CHAT_ROOM_ID ?? '').trim()

// === Watcher-specific (Telegram) ===
const hasBotToken = !!(process.env.ALFACLUB_TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN)
const hasPrivateRelay = !!(process.env.ALFACLUB_TELEGRAM_RELAY_CHAT_ID || process.env.TELEGRAM_TARGET_CHAT_ID)
const hasPublicChannel = !!(
  process.env.ALFACLUB_RADAR_TELEGRAM_CHAT_ID ||
  process.env.FUN4626_TELEGRAM_CHAT_ID ||
  process.env.TARGET_CHAT_ID
)

// === Optional but nice for 1659 context ===
const hasBaseRpc = !!(process.env.BASE_RPC_URL)
const hasRoomOverrides = !!(process.env.ROOM_1659_FRIENDKEY_TOKEN || process.env.ROOM_1659_FRIENDKEY_ID)

// === Reports ===

console.log('--- 1. Shared Core (required for rich 1659 context in both services) ---')
check('DATABASE_URL (Supabase) / POSTGRES_URL (legacy)', hasDb)
check('AlfaClub auth (JWT or full Privy refresh triplet)', hasAlfaClubBootstrap)

if (!hasAlfaClubJwt && hasAlfaClubPrivyAccess && hasAlfaClubPrivyRefresh) {
  console.log('   → Privy refresh triplet detected (good for long-lived services)')
}

console.log('\n--- 2. Hermit Creative Agent (hermit.4626.fun) ---')
check('HERMIT_PINATA_CHAT_ENDPOINT + BEARER_TOKEN', hasPinataEndpoint && hasPinataBearer, false)
check('ALFACLUB_HERMIT_COMMAND_ROOMS (or ALFACLUB_CHAT_ROOM_ID) includes 1659', hasHermitRooms, false)
console.log('   (Recommended: ALFACLUB_CHAT_PRIVY_REFRESHER_ENABLED=1 on this service only)')

console.log('\n--- 3. 1659 Risk Watcher (Telegram alerts) ---')
check('Telegram bot token (ALFACLUB_TELEGRAM_BOT_TOKEN or TELEGRAM_BOT_TOKEN)', hasBotToken)
check('Private ops relay destination', hasPrivateRelay, false)
check('Public channel destination (@fun4626)', hasPublicChannel, false)

console.log('\n--- 4. Rich 1659 Context Extras (Hyperliquid + on-chain curve) ---')
check('BASE_RPC_URL (optional, has good default)', hasBaseRpc, false)
check('ROOM_1659_* overrides (optional, good defaults exist)', hasRoomOverrides, false)

if (RUNNING_ON_RAILWAY) {
  console.log('\n--- Railway notes ---')
  console.log('   You are running inside a Railway context.')
}

// === Critical blockers summary ===
const critical: string[] = []
if (!hasDb) critical.push('DATABASE_URL (Supabase preferred) or POSTGRES_URL — needed for alfaclub stores + rich context')
if (!hasAlfaClubBootstrap) critical.push('AlfaClub auth (JWT or Privy triplet) — needed for PnL + bridge')
if (!hasBotToken) critical.push('Telegram bot token — watcher cannot send alerts without it')

console.log('\n' + '='.repeat(70))
if (critical.length > 0) {
  console.log(`${RED}${BOLD}CRITICAL BLOCKERS (${critical.length})${RESET}`)
  critical.forEach((c) => console.log(`  ${RED}✗${RESET} ${c}`))
  console.log('\nThe stack will not work correctly until these are fixed.')
} else {
  console.log(`${GREEN}${BOLD}CORE REQUIREMENTS SATISFIED${RESET}`)
  console.log('The main pieces for rich 1659 theatrical marketing are present.')
}

const richContextReady = hasDb && hasAlfaClubBootstrap
console.log(`\nRich 1659 context (Hyperliquid + curve + PnL): ${richContextReady ? `${GREEN}READY${RESET}` : `${YELLOW}LIMITED${RESET}`}`)

// === Copy-paste blocks ===
console.log('\n' + '='.repeat(70))
console.log(`${BOLD}COPY-PASTE BLOCKS FOR RAILWAY${RESET}`)
console.log('')

console.log('--- For hermit.4626.fun service (Hermit + rich 1659 context) ---')
const hermitBlock = [
  `DATABASE_URL=${process.env.DATABASE_URL ?? 'postgresql://...'}`,
  '',
  '# AlfaClub auth (one of these two paths)',
  `ALFACLUB_CHAT_JWT=${process.env.ALFACLUB_CHAT_JWT ?? ''}`,
  `ALFACLUB_CHAT_PRIVY_ACCESS_TOKEN=${process.env.ALFACLUB_CHAT_PRIVY_ACCESS_TOKEN ?? ''}`,
  `ALFACLUB_CHAT_PRIVY_REFRESH_TOKEN=${process.env.ALFACLUB_CHAT_PRIVY_REFRESH_TOKEN ?? ''}`,
  '',
  '# Creative brain',
  `HERMIT_PINATA_CHAT_ENDPOINT=${process.env.HERMIT_PINATA_CHAT_ENDPOINT ?? ''}`,
  `HERMIT_PINATA_BEARER_TOKEN=${process.env.HERMIT_PINATA_BEARER_TOKEN ?? ''}`,
  '',
  '# Room targeting',
  `ALFACLUB_HERMIT_COMMAND_ROOMS=${process.env.ALFACLUB_HERMIT_COMMAND_ROOMS ?? '1659'}`,
].join('\n')
console.log(hermitBlock)

console.log('\n--- For 1659 risk watcher service (or same env as above) ---')
const watcherBlock = [
  `ALFACLUB_TELEGRAM_BOT_TOKEN=${process.env.ALFACLUB_TELEGRAM_BOT_TOKEN ?? ''}`,
  `ALFACLUB_TELEGRAM_RELAY_CHAT_ID=${process.env.ALFACLUB_TELEGRAM_RELAY_CHAT_ID ?? '-1003709479662'}`,
  `ALFACLUB_TELEGRAM_RELAY_THREAD_ID=${process.env.ALFACLUB_TELEGRAM_RELAY_THREAD_ID ?? '2'}`,
  `ALFACLUB_RADAR_TELEGRAM_CHAT_ID=${process.env.ALFACLUB_RADAR_TELEGRAM_CHAT_ID ?? '@fun4626'}`,
].join('\n')
console.log(watcherBlock)

console.log('\nTip: After setting these on Railway, redeploy and search logs for:')
console.log('  [hermit][early]')
console.log('  [1659-risk-watcher][early]')
console.log('These blocks will confirm the variables were actually picked up.\n')

console.log('='.repeat(70) + '\n')