#!/usr/bin/env tsx
/**
 * Operator helper: plan or test AlfaClub daily-digest room split from the command bridge.
 *
 *   pnpm -C frontend exec tsx scripts/ops/alfaclub-digest-room-setup.ts
 *   pnpm -C frontend exec tsx scripts/ops/alfaclub-digest-room-setup.ts --room=2001
 *   pnpm -C frontend exec tsx scripts/ops/alfaclub-digest-room-setup.ts --post-test --room=2001
 */

import {
  isDailyBriefRoomSameAsBridgeRoom,
  listDailyBriefPostRoomCandidates,
  readAlfaClubDailyBriefSeparateFromBridge,
  resolveAlfaClubBridgeRoomId,
  resolveDailyBriefRoomId,
  runAlfaClubDailyBrief,
} from '../../server/_lib/alfaclub/dailyBrief.js'
import { readAlfaClubChatBridgeFlags } from '../../server/_lib/alfaclub/chatBridge.js'

declare const process: { env: Record<string, string | undefined>; argv: string[]; exit: (code: number) => void }

function readArg(name: string): string | null {
  const prefix = `--${name}=`
  for (const raw of process.argv.slice(2)) {
    if (raw.startsWith(prefix)) return raw.slice(prefix.length).trim() || null
  }
  return null
}

function hasFlag(name: string): boolean {
  return process.argv.slice(2).includes(`--${name}`)
}

async function main(): Promise<void> {
  const roomOverride = readArg('room')
  if (roomOverride) {
    process.env.ALFACLUB_DAILY_BRIEF_ROOM_ID = roomOverride
  }

  const bridgeRoom = resolveAlfaClubBridgeRoomId()
  const briefRoom = resolveDailyBriefRoomId()
  const separate = readAlfaClubDailyBriefSeparateFromBridge()
  const sameAsBridge = isDailyBriefRoomSameAsBridgeRoom(briefRoom)
  const bridgeFlags = readAlfaClubChatBridgeFlags()
  const postCandidates = listDailyBriefPostRoomCandidates(bridgeFlags)

  console.log('AlfaClub digest room setup')
  console.log('')
  console.log(`  Bridge (commands):     ${bridgeRoom}`)
  console.log(`  Digest preference:     ${briefRoom}`)
  console.log(`  Post candidates:       ${postCandidates.join(' → ')}`)
  console.log(`  Separate-from-bridge:  ${separate ? 'on' : 'off'}`)
  console.log(`  Same room as bridge:   ${sameAsBridge ? 'yes' : 'no'}`)
  console.log('')
  console.log('Recommended Vercel production env:')
  console.log(`  ALFACLUB_CHAT_ROOM_ID=1043`)
  console.log(`  ALFACLUB_HERMIT_COMMAND_ROOMS=1043,1659`)
  console.log(`  # ALFACLUB_DAILY_BRIEF_ROOM_ID optional — cron tries candidates until bot key works`)
  console.log('')
  console.log('After deploy, test from the bridge room:')
  console.log('  /alfa brief post')
  console.log('')

  if (separate && sameAsBridge && briefRoom === resolveDailyBriefRoomId()) {
    const explicitBrief = Boolean(process.env.ALFACLUB_DAILY_BRIEF_ROOM_ID?.trim())
    if (explicitBrief) {
      console.log(
        'WARN: SEPARATE_FROM_BRIDGE is on but ALFACLUB_DAILY_BRIEF_ROOM_ID equals bridge — cron will skip (brief_room_same_as_bridge).',
      )
      console.log('Unset ALFACLUB_DAILY_BRIEF_ROOM_ID to use dynamic bot-reachable rooms.')
      console.log('')
    }
  }

  if (hasFlag('post-test')) {
    console.log('Posting test digest (forceSend, dynamic room)…')
    const result = await runAlfaClubDailyBrief({
      flags: {
        enabled: true,
        roomId: briefRoom,
        topRows: 3,
        moverRows: 2,
        majorRows: 3,
        compact: true,
        forceSend: true,
        marketTimeoutMs: 12_000,
      },
    })
    console.log(JSON.stringify(result, null, 2))
    process.exit(result.ok && result.sent ? 0 : 1)
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
