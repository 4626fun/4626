#!/usr/bin/env tsx
/**
 * Operator helper: show where the daily digest posts and optionally force a test post.
 *
 *   pnpm -C frontend exec tsx scripts/ops/alfaclub-digest-room-setup.ts
 *   pnpm -C frontend exec tsx scripts/ops/alfaclub-digest-room-setup.ts --post-test
 */

import {
  listDailyBriefCommandRoomIds,
  listDailyBriefPostRoomIds,
  resolveAlfaClubBridgeRoomId,
  resolveDailyBriefRoomId,
  runAlfaClubDailyBrief,
} from '../../server/_lib/alfaclub/dailyBrief.js'
import { readAlfaClubChatBridgeFlags } from '../../server/_lib/alfaclub/chatBridge.js'

declare const process: { env: Record<string, string | undefined>; argv: string[]; exit: (code: number) => void }

function hasFlag(name: string): boolean {
  return process.argv.slice(2).includes(`--${name}`)
}

async function main(): Promise<void> {
  const bridgeRoom = resolveAlfaClubBridgeRoomId()
  const bridgeFlags = readAlfaClubChatBridgeFlags()
  const commandRooms = listDailyBriefCommandRoomIds(bridgeFlags)
  const postRooms = listDailyBriefPostRoomIds(bridgeFlags)

  console.log('AlfaClub daily digest')
  console.log('')
  console.log(`  Bridge room:      ${bridgeRoom}`)
  console.log(`  Command rooms:    ${commandRooms.join(', ')}`)
  console.log(`  Posts to:         ${postRooms.join(', ')}`)
  console.log('')
  console.log('Production env:')
  console.log('  ALFACLUB_CHAT_ROOM_ID=1043')
  console.log('  ALFACLUB_HERMIT_COMMAND_ROOMS=1043,1659')
  console.log('  ALFACLUB_DAILY_BRIEF_ROOM_ID=1659   # digest only in 1659; commands still work in both')
  console.log('')

  if (hasFlag('post-test')) {
    console.log('Posting test digest (forceSend)…')
    const result = await runAlfaClubDailyBrief({
      flags: {
        enabled: true,
        roomId: commandRooms[0] ?? bridgeRoom,
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
