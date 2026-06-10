#!/usr/bin/env tsx
/**
 * Ad-hoc sender for hermit4626 into AlfaClub rooms.
 *
 * Usage:
 *   pnpm -C frontend exec tsx scripts/ops/send-as-hermit-to-room.ts --room=1659 --intro
 *
 *   # Emergency stupid mode for stressed rooms
 *   pnpm -C frontend exec tsx scripts/ops/send-as-hermit-to-room.ts --room=1659 --stupid
 *
 * Requires the normal AlfaClub bridge env (especially ALFACLUB_API_KEY / bot token).
 *
 * To load production credentials locally:
 *   cd frontend && vercel env pull .env.local --environment=production
 *   Then re-run this script from the repo root.
 */

import { existsSync, readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { sendAlfaClubRoomText } from '../../server/_lib/alfaclub/chatBridge.js'
import { readAlfaClubChatToken } from '../../server/_lib/alfaclub/chatTokenStore.js'
import { formatHermitRoomIntro } from '../../server/_lib/hermit/hermitAlfaClubHelp.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FRONTEND_ROOT = resolve(__dirname, '../../..')

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

// Load local env files (same pattern as other ops scripts)
loadEnvFile(resolve(FRONTEND_ROOT, '.env.local'))
loadEnvFile(resolve(FRONTEND_ROOT, '.env'))

function parseArgs() {
  const args = process.argv.slice(2)
  const out: Record<string, string> = {}
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a.startsWith('--')) {
      let key = a.slice(2)
      let val = 'true'

      // Support both --key value and --key=value
      if (key.includes('=')) {
        const parts = key.split('=')
        key = parts[0]
        val = parts.slice(1).join('=') || 'true'
      } else if (args[i + 1] && !args[i + 1].startsWith('--')) {
        val = args[i + 1]
        i++
      }

      out[key] = val
    }
  }
  return out
}

function getStupidMessageForStressedRoom(): string {
  const options = [
    "67 hype. 69 liq. the market is currently 69ing itself while only being 67% ready. i'm scared but also weirdly proud of it",
    "hype at 67, liquidation at 69. the numbers are fucking and we're just standing here watching like it's normal. this is fine. i'm fine",
    "room is stressed because hype is 67 and liq is 69? yeah that tracks. the chart is trying to 69 us but we're not even at second base yet. lfg i guess",
    "attention: the market is currently at 67% horny and 69% dangerous. this is not financial advice this is a cry for help and also a mating call",
    "67 hype. 69 liquidation. i've never been more confident in my decision to be a professional idiot. who else is buying more while the numbers have sex",
    "guys the hype and liquidation are doing 69 while only being 67% emotionally available. i'm going to go scream into a pillow and then buy the dip",
    "hype 67. liq 69. the only thing more stressed than this room is my therapist's notes about me. anyway gm degenerates",
    "the numbers are 67 and 69 which means the market is in a toxic situationship with itself. i'm rooting for them. also buying more",
  ]
  return options[Math.floor(Math.random() * options.length)]
}

async function main() {
  const args = parseArgs()
  const roomId = args.room || args.roomId || process.env.ALFACLUB_CHAT_ROOM_ID
  let text = args.text || args.msg || args.message

  if (!roomId) {
    console.error('Missing --room=<id> (or ALFACLUB_CHAT_ROOM_ID in env)')
    process.exit(1)
  }

  if (args.intro) {
    text = formatHermitRoomIntro(String(roomId))
    console.log('📣 Using canned Hermit room intro')
  }

  if (args.stupid || args.dumb || args.stressed) {
    text = getStupidMessageForStressedRoom()
    console.log('🧠 Using emergency stupid mode for stressed room')
  }

  if (!text) {
    console.error('Missing --text="your message here", --intro, or --stupid for emergency dumb mode')
    process.exit(1)
  }

  console.log(`\nSending as hermit4626 to room ${roomId}:`)
  console.log(`"${text}"\n`)

  // Prefer the live token from Supabase (alfaclub_runtime_secret.chat_jwt)
  // This is what the user means by "its on supabase".
  let jwtFromSupabase: string | null = null
  try {
    const tokenRecord = await readAlfaClubChatToken()
    if (tokenRecord?.jwt) {
      jwtFromSupabase = tokenRecord.jwt
      console.log('🔑 Using live JWT from Supabase (alfaclub_runtime_secret.chat_jwt)')
      console.log(`   Last updated: ${tokenRecord.updatedAt} by ${tokenRecord.updatedBy ?? 'unknown'}`)
      if (tokenRecord.expiresAt) {
        console.log(`   Expires: ${tokenRecord.expiresAt}`)
      }
    }
  } catch (e) {
    console.warn('⚠️  Could not read token from Supabase, will fall back to env vars.')
  }

  const sendParams: any = {
    roomId,
    text,
    replyToMessageId: args['reply-to'] || args.replyTo || undefined,
  }

  // Allow explicit JWT override (useful when DB connection has SSL issues)
  if (args.jwt) {
    sendParams.jwt = args.jwt
    console.log('🔑 Using JWT provided via --jwt flag')
  } else if (jwtFromSupabase) {
    sendParams.jwt = jwtFromSupabase
  }

  try {
    const result = await sendAlfaClubRoomText(sendParams)
    console.log('✅ Sent successfully via lane:', result.lane)
  } catch (err: any) {
    const errorMsg = err?.message || String(err)

    console.error('❌ Failed to send:', errorMsg)

    if (errorMsg.includes('jwt_missing') || errorMsg.includes('alfaclub') || errorMsg.includes('token')) {
      console.log('\n🔑 Could not get a valid AlfaClub token from Supabase automatically.')
      console.log('')
      console.log('Fastest manual way (recommended right now):')
      console.log('  1. Go to your Supabase dashboard → Table Editor')
      console.log('  2. Open table: alfaclub_runtime_secret')
      console.log('  3. Find the row where secret_key = \'chat_jwt\'')
      console.log('  4. Copy the value from the secret_value column')
      console.log('')
      console.log('  Then run:')
      console.log(`    pnpm -C frontend exec tsx scripts/ops/send-as-hermit-to-room.ts \\`)
      console.log(`      --room=${roomId} \\`)
      console.log(`      --text="${text.replace(/"/g, '\\"')}" \\`)
      console.log(`      --jwt="PASTE_THE_SECRET_VALUE_HERE"`)
      console.log('')
      console.log('This uses the live token the actual bridge is using.')
    } else {
      console.log('\nIf you have the env loaded, the exact command was:')
      console.log(`pnpm -C frontend exec tsx scripts/ops/send-as-hermit-to-room.ts --room=${roomId} --text="${text.replace(/"/g, '\\"')}"`)
    }

    process.exit(1)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
