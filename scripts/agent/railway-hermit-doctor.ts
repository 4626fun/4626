#!/usr/bin/env tsx
/**
 * Railway Hermit (AlfaClub creative) Doctor
 *
 * Run locally with the same env you intend to set on the hermit.4626.fun Railway service.
 * This validates the things that most often cause the Hermit process to die during
 * static import (before the health server in server/agents/hermit/index.ts can bind).
 *
 * The dedicated Hermit service is intentionally lighter than Keepr primary, but it still
 * transitively imports a lot of alfaclub stores + the full command surface (for /hermit,
 * /gmeow, room-1659 theatrical injection, etc.). Missing DATABASE_URL or AlfaClub secrets
 * will kill it silently before /healthz responds.
 *
 * Usage:
 *   pnpm agent:railway-hermit-doctor
 *
 * Or with env file:
 *   env $(cat .env | xargs) pnpm agent:railway-hermit-doctor
 */

import { isDbConfigured } from '../../frontend/server/_lib/db/postgres.js'

const RED = '\x1b[31m'
const GREEN = '\x1b[32m'
const YELLOW = '\x1b[33m'
const RESET = '\x1b[0m'

function check(name: string, condition: boolean, required = true) {
  const icon = condition ? `${GREEN}✓${RESET}` : required ? `${RED}✗${RESET}` : `${YELLOW}?${RESET}`
  console.log(`${icon} ${name}`)
  return condition
}

console.log('\n=== Hermit Railway Doctor (hermit.4626.fun) ===')
console.log('This checks the common causes of "service unavailable" on /healthz after a successful image push.')
console.log('Death before the health server binds is almost always a missing critical env var in the import graph.\n')

const RUNNING_ON_RAILWAY = Object.keys(process.env).some((k) => k.startsWith('RAILWAY_'))

const hasDb = isDbConfigured()
const hasAlfaClubJwt = !!(process.env.ALFACLUB_CHAT_JWT ?? '').trim()
const hasAlfaClubPrivyAccess = !!(process.env.ALFACLUB_CHAT_PRIVY_ACCESS_TOKEN ?? '').trim()
const hasAlfaClubPrivyRefresh = !!(process.env.ALFACLUB_CHAT_PRIVY_REFRESH_TOKEN ?? '').trim()
const hasPinataEndpoint = !!(process.env.HERMIT_PINATA_CHAT_ENDPOINT ?? '').trim()
const hasPinataBearer = !!(process.env.HERMIT_PINATA_BEARER_TOKEN ?? '').trim()
const hasRoom = !!(process.env.ALFACLUB_CHAT_ROOM_ID ?? '').trim() || !!(process.env.ALFACLUB_HERMIT_COMMAND_ROOMS ?? '').trim()

const hasAlfaClubBootstrap = hasAlfaClubJwt || (hasAlfaClubPrivyAccess && hasAlfaClubPrivyRefresh)

console.log('--- Core Database (required — many alfaclub stores + schema bootstrap are pulled at import time) ---')
check('DATABASE_URL or POSTGRES_URL present (Supabase pooler recommended)', hasDb)

console.log('\n--- AlfaClub Auth (chat bridge + token stores) ---')
check('ALFACLUB_CHAT_JWT present (or the three Privy tokens for auto-refresh)', hasAlfaClubBootstrap)
if (!hasAlfaClubJwt && hasAlfaClubPrivyAccess && hasAlfaClubPrivyRefresh) {
  console.log('   (Privy refresh triplet detected — refresher can bootstrap the identity token)')
}
if (hasAlfaClubJwt && !hasAlfaClubPrivyAccess) {
  console.log('   (Only raw JWT present — bridge will work until expiry; refresher will not be able to rotate it)')
}

console.log('\n--- Hermit Creative (Pinata OpenClaw) ---')
check('HERMIT_PINATA_CHAT_ENDPOINT present', hasPinataEndpoint, false)
check('HERMIT_PINATA_BEARER_TOKEN present', hasPinataBearer, false)
if (hasPinataEndpoint && !hasPinataBearer) {
  console.log('   Pinata endpoint without bearer token will cause creative commands to fail at runtime (not boot).')
}

console.log('\n--- Room Targeting (for 1659 theatrical marketing etc.) ---')
check('ALFACLUB_CHAT_ROOM_ID or ALFACLUB_HERMIT_COMMAND_ROOMS present', hasRoom, false)

if (RUNNING_ON_RAILWAY) {
  console.log('\n--- Railway-specific notes ---')
  console.log('   Railway sets PORT automatically. The Hermit entry defaults to 8080 when PORT is absent.')
  console.log('   Attach a volume only if you intend to persist local state (usually not needed for Hermit).')
}

console.log('\n--- Summary ---')
const critical: string[] = []
if (!hasDb) critical.push('DATABASE_URL / POSTGRES_URL is required (alfaclub stores + schema bootstrap are imported early)')
if (!hasAlfaClubBootstrap) critical.push('ALFACLUB_CHAT_JWT (or the three ALFACLUB_CHAT_PRIVY_* tokens) is required for the chat bridge')

if (critical.length > 0) {
  console.log(`${RED}Critical blockers for boot:${RESET}`)
  critical.forEach((c) => console.log(`  - ${c}`))
  console.log('\nWithout these the process will throw during static import of chatBridge / command surface and die before startHealthServer() runs.')
  console.log('Railway will report "service unavailable" on every /healthz probe.')
} else {
  console.log(`${GREEN}Core requirements appear present.${RESET}`)
  console.log('If the service is still "unavailable", check the actual Railway application logs for the first [hermit][early] line (after the next deploy with the hardened entrypoint).')
}

console.log('\nTip: After setting the vars on Railway, redeploy and look for the raw console table that starts with "[hermit][early]".')
console.log('That table is emitted at module evaluation time — the only reliable signal when the process dies before the normal health server binds.\n')

// --- Railway dashboard copy-paste helper ---
console.log('=== Copy-paste ready block for Railway (hermit.4626.fun → Variables) ===')
console.log('# Paste these as individual variables in the Railway UI (or via railway CLI)')
console.log('# DATABASE_URL and the AlfaClub auth block are the ones that usually cause the "service unavailable" death.')
console.log('')

const railwayBlock = [
  `DATABASE_URL=${process.env.DATABASE_URL ?? 'postgresql://...'}`,
  '',
  '# --- AlfaClub auth (at least one path) ---',
  `ALFACLUB_CHAT_JWT=${process.env.ALFACLUB_CHAT_JWT ?? ''}`,
  '',
  '# Or the Privy refresh triplet (recommended for long-lived service):',
  `ALFACLUB_CHAT_PRIVY_ACCESS_TOKEN=${process.env.ALFACLUB_CHAT_PRIVY_ACCESS_TOKEN ?? ''}`,
  `ALFACLUB_CHAT_PRIVY_REFRESH_TOKEN=${process.env.ALFACLUB_CHAT_PRIVY_REFRESH_TOKEN ?? ''}`,
  '',
  '# --- Creative brain (Pinata) + 1659 targeting ---',
  `HERMIT_PINATA_CHAT_ENDPOINT=${process.env.HERMIT_PINATA_CHAT_ENDPOINT ?? ''}`,
  `HERMIT_PINATA_BEARER_TOKEN=${process.env.HERMIT_PINATA_BEARER_TOKEN ?? ''}`,
  `ALFACLUB_CHAT_ROOM_ID=${process.env.ALFACLUB_CHAT_ROOM_ID ?? '1659'}`,
  `ALFACLUB_HERMIT_COMMAND_ROOMS=${process.env.ALFACLUB_HERMIT_COMMAND_ROOMS ?? '1659'}`,
].join('\n')

console.log(railwayBlock)
console.log('')
console.log('After pasting into Railway Variables, hit "Redeploy" (or let the change trigger one).')
console.log('Then search the new deployment logs for the string: [hermit][early]')
console.log('=============================================================================\n')
