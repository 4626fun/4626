#!/usr/bin/env tsx
/**
 * Probe Hermit room welcome ledger for a (room, wallet) pair.
 *
 * Default is read-only: shows eligibility, existing ledger row, and preview copy.
 * Does not post to AlfaClub unless you pass --send.
 *
 * Usage:
 *   pnpm -C frontend exec tsx scripts/ops/hermit-room-welcome-probe.ts --room=1659 --wallet=0x...
 *
 *   # Insert ledger claim only (no room post) — useful to test dedupe
 *   pnpm -C frontend exec tsx scripts/ops/hermit-room-welcome-probe.ts --room=1659 --wallet=0x... --claim
 *
 *   # Post welcome to the room (requires AlfaClub bridge env)
 *   pnpm -C frontend exec tsx scripts/ops/hermit-room-welcome-probe.ts --room=1659 --wallet=0x... --send
 *
 *   # Clear ledger row so the wallet can be welcomed again (ops testing)
 *   pnpm -C frontend exec tsx scripts/ops/hermit-room-welcome-probe.ts --room=1659 --wallet=0x... --reset --confirm=RESET
 *
 * Load production creds locally:
 *   cd frontend && vercel env pull .env.local --environment=production
 */

import { existsSync, readFileSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

import {
  formatHermitRoomWelcome,
  isHermitRoomWelcomeEnabled,
  tryInsertHermitRoomWelcomeSent,
} from '../../server/_lib/alfaclub/hermitRoomWelcome.js'
import {
  isHermitCommandRoom,
  readAlfaClubChatBridgeFlags,
  sendAlfaClubRoomText,
} from '../../server/_lib/alfaclub/chatBridge.js'
import { getDb } from '../../server/_lib/db/postgres.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FRONTEND_ROOT = resolve(__dirname, '../..')

function loadEnvFile(path: string): void {
  if (!existsSync(path)) return
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq < 0) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (key && process.env[key] === undefined) {
      process.env[key] = value
    }
  }
}

loadEnvFile(resolve(FRONTEND_ROOT, '.env.local'))
loadEnvFile(resolve(FRONTEND_ROOT, '.env'))

type ParsedArgs = {
  roomId: string
  wallet: string
  username: string | null
  claim: boolean
  send: boolean
  reset: boolean
  confirm: string | null
  help: boolean
}

function parseArgs(): ParsedArgs {
  const raw = process.argv.slice(2)
  const out: Record<string, string> = {}
  for (let i = 0; i < raw.length; i++) {
    const arg = raw[i]
    if (arg === '--help' || arg === '-h') {
      out.help = 'true'
      continue
    }
    if (!arg.startsWith('--')) continue
    let key = arg.slice(2)
    let val = 'true'
    if (key.includes('=')) {
      const parts = key.split('=')
      key = parts[0]
      val = parts.slice(1).join('=') || 'true'
    } else if (raw[i + 1] && !raw[i + 1].startsWith('--')) {
      val = raw[i + 1]
      i++
    }
    out[key] = val
  }

  return {
    roomId: String(out.room ?? '').trim(),
    wallet: String(out.wallet ?? '').trim().toLowerCase(),
    username: out.username ? String(out.username).trim() : null,
    claim: out.claim === 'true',
    send: out.send === 'true',
    reset: out.reset === 'true',
    confirm: out.confirm ? String(out.confirm).trim() : null,
    help: out.help === 'true',
  }
}

function normalizeWallet(value: string): string | null {
  const trimmed = value.trim().toLowerCase()
  if (!/^0x[a-f0-9]{40}$/.test(trimmed)) return null
  return trimmed
}

function printUsage(): void {
  console.log(`Hermit room welcome probe

Required:
  --room=<id>       AlfaClub room id (e.g. 1659, 1043)
  --wallet=<0x...>  Participant wallet to check

Optional:
  --username=<name> Preview welcome with a display name
  --claim           Insert ledger row if absent (no room post)
  --send            Post welcome to the room (uses bridge env)
  --reset           Delete ledger row (--confirm=RESET required)

Examples:
  pnpm -C frontend exec tsx scripts/ops/hermit-room-welcome-probe.ts --room=1659 --wallet=0xabc...
`)
}

async function readLedgerRow(roomId: string, wallet: string): Promise<{ welcomedAt: string } | null> {
  const db = await getDb()
  if (!db) return null
  const result = await db.sql`
    SELECT welcomed_at
    FROM alfaclub.room_welcome_sent
    WHERE room_id = ${roomId}
      AND sender_address = ${wallet}
    LIMIT 1;
  `
  const row = result.rows?.[0] as { welcomed_at?: string | Date } | undefined
  if (!row?.welcomed_at) return null
  const welcomedAt =
    row.welcomed_at instanceof Date ? row.welcomed_at.toISOString() : String(row.welcomed_at)
  return { welcomedAt }
}

async function deleteLedgerRow(roomId: string, wallet: string): Promise<boolean> {
  const db = await getDb()
  if (!db) return false
  const result = await db.sql`
    DELETE FROM alfaclub.room_welcome_sent
    WHERE room_id = ${roomId}
      AND sender_address = ${wallet}
    RETURNING room_id;
  `
  return Boolean(result.rows?.length)
}

async function main(): Promise<void> {
  const args = parseArgs()
  if (args.help) {
    printUsage()
    return
  }

  const wallet = normalizeWallet(args.wallet)
  if (!args.roomId || !wallet) {
    printUsage()
    console.error('\nError: --room and --wallet (valid 0x address) are required.')
    process.exit(1)
  }

  const hermitRooms = String(process.env.ALFACLUB_HERMIT_COMMAND_ROOMS ?? '(unset)').trim()
  const welcomeEnabled = isHermitRoomWelcomeEnabled()
  const hermitRoom = isHermitCommandRoom(args.roomId)
  const preview = formatHermitRoomWelcome({
    roomId: args.roomId,
    username: args.username,
  })

  console.log('\nHermit room welcome probe')
  console.log('-------------------------')
  console.log(`room:              ${args.roomId}`)
  console.log(`wallet:            ${wallet}`)
  console.log(`welcome enabled:   ${welcomeEnabled}`)
  console.log(`hermit command room: ${hermitRoom}`)
  console.log(`ALFACLUB_HERMIT_COMMAND_ROOMS: ${hermitRooms}`)
  console.log(`DATABASE_URL:      ${process.env.DATABASE_URL ? 'set' : 'missing'}`)
  console.log(`ALFACLUB_API_KEY:  ${process.env.ALFACLUB_API_KEY ? 'set' : 'missing'}`)

  if (!welcomeEnabled) {
    console.log('\nResult: welcome disabled (HERMIT_ROOM_WELCOME_ENABLED=0).')
    return
  }
  if (!hermitRoom) {
    console.log('\nResult: room is not in ALFACLUB_HERMIT_COMMAND_ROOMS — bridge will skip welcomes.')
  }

  let existing = await readLedgerRow(args.roomId, wallet)
  if (existing) {
    console.log(`\nLedger: already welcomed at ${existing.welcomedAt}`)
  } else {
    console.log('\nLedger: no row yet — wallet would receive a first-time welcome.')
  }

  console.log('\nPreview message:')
  console.log('---')
  console.log(preview)
  console.log('---')
  console.log(`chars: ${preview.length}`)

  if (args.reset) {
    if (args.confirm !== 'RESET') {
      console.error('\nRefusing --reset without --confirm=RESET')
      process.exit(1)
    }
    const deleted = await deleteLedgerRow(args.roomId, wallet)
    console.log(deleted ? '\nLedger row deleted.' : '\nNo ledger row to delete (or DATABASE_URL missing).')
    existing = await readLedgerRow(args.roomId, wallet)
  }

  if (args.claim || args.send) {
    const claimed = await tryInsertHermitRoomWelcomeSent({
      roomId: args.roomId,
      senderAddress: wallet,
    })
    console.log(`\nClaim insert: ${claimed ? 'inserted (first claim)' : 'skipped (already claimed or DB unavailable)'}`)
    existing = await readLedgerRow(args.roomId, wallet)
    if (existing) {
      console.log(`Ledger now: welcomed at ${existing.welcomedAt}`)
    }
  }

  if (args.send) {
    if (!hermitRoom) {
      console.error('\nRefusing --send: not a Hermit command room.')
      process.exit(1)
    }
    const flags = readAlfaClubChatBridgeFlags()
    if (!flags.botToken && !flags.websocketUrl) {
      console.error('\nRefusing --send: AlfaClub bridge env missing (ALFACLUB_API_KEY / websocket).')
      process.exit(1)
    }
    await sendAlfaClubRoomText({
      roomId: args.roomId,
      text: preview,
      flags,
    })
    console.log('\nSent welcome to room via AlfaClub bridge.')
    return
  }

  if (!args.claim && !args.reset) {
    console.log('\nDry-run only. Pass --claim to test ledger insert, or --send to post to the room.')
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
