#!/usr/bin/env tsx
/**
 * One-shot: Send a message as hermit4626 to room 1659
 * using the live JWT from Supabase (alfaclub_runtime_secret.chat_jwt).
 *
 * This is a hardened direct version for when the normal DB layer has SSL issues.
 */

import { Pool } from 'pg'
import { sendAlfaClubRoomText } from '../../server/_lib/alfaclub/chatBridge.js'
import { existsSync, readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

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
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    if (key && process.env[key] === undefined) process.env[key] = value
  }
}

loadEnvFile(resolve(FRONTEND_ROOT, '.env.local'))
loadEnvFile(resolve(FRONTEND_ROOT, '.env'))

const ROOM_ID = '1659'
const MESSAGE = 'gmeow cat laugh from the Hermit cave. cant help you here'

async function getChatJwtFromSupabase(): Promise<string | null> {
  const cs = process.env.DATABASE_URL
  if (!cs) {
    console.error('❌ DATABASE_URL not set')
    return null
  }

  // Force relaxed SSL – this is the common fix for Supabase self-signed cert issues in ops contexts
  const pool = new Pool({
    connectionString: cs,
    ssl: { rejectUnauthorized: false },
  })

  try {
    const res = await pool.query(
      `SELECT secret_value FROM alfaclub_runtime_secret WHERE secret_key = $1 LIMIT 1`,
      ['chat_jwt']
    )
    await pool.end()
    if (res.rows.length === 0) return null
    return res.rows[0].secret_value
  } catch (e: any) {
    console.error('❌ Failed to read from Supabase:', e.message)
    await pool.end().catch(() => {})
    return null
  }
}

async function main() {
  console.log(`\nFetching live JWT from Supabase for room ${ROOM_ID}...`)

  const jwt = await getChatJwtFromSupabase()
  if (!jwt) {
    console.error('❌ Could not retrieve chat_jwt from alfaclub_runtime_secret')
    process.exit(1)
  }

  console.log('✅ Got fresh JWT from Supabase')
  console.log(`\nSending as hermit4626 to room ${ROOM_ID}:`)
  console.log(`"${MESSAGE}"\n`)

  try {
    const result = await sendAlfaClubRoomText({
      roomId: ROOM_ID,
      text: MESSAGE,
      jwt, // force the live Supabase token
    })
    console.log('✅ Message sent successfully via lane:', result.lane)
  } catch (err: any) {
    console.error('❌ Send failed:', err?.message || err)
    process.exit(1)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
