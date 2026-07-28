/**
 * Room 1659 chat canary ops helper.
 *
 * Verifies the creator-coin read policy, optionally enables the XMTP channel
 * binding, and optionally backfills FriendKey-qualified XMTP members.
 *
 * Usage (from frontend/):
 *   pnpm exec tsx --env-file=.env scripts/ops/enable-room1659-chat-canary.ts
 *   pnpm exec tsx --env-file=.env scripts/ops/enable-room1659-chat-canary.ts --enable-xmtp
 *   pnpm exec tsx --env-file=.env scripts/ops/enable-room1659-chat-canary.ts --enable-xmtp --backfill
 *
 * Notes:
 * - Write stays FriendKey-only in app code; coin holders are read-only.
 * - XMTP backfill skips coin-only active memberships.
 * - Does not send proof messages — verify bidirectional chat manually after enable.
 */
import { isDbConfigured } from '../../server/_lib/db/postgres.js'
import {
  backfillActiveAlfaClubRoomAccessMembersToXmtp,
  readAlfaClubRoomAccessPolicy,
} from '../../server/_lib/alfaclub/roomAccessPolicy.js'
import {
  readAlfaClubRoomChannelBinding,
  upsertAlfaClubRoomChannelBinding,
} from '../../server/_lib/alfaclub/roomChannelBindings.js'

declare const process: {
  env: Record<string, string | undefined>
  argv: string[]
  exit: (code?: number) => never
}

const ROOM_ID = '1659'
const SYNTHETIC_KEEPR_VAULT = '0x0000000000000000000000000000000000001659' as const

function hasFlag(name: string): boolean {
  return process.argv.includes(name)
}

async function main(): Promise<void> {
  if (!isDbConfigured()) {
    console.error(JSON.stringify({ ok: false, error: 'DATABASE_URL is not configured' }))
    process.exit(1)
  }

  const enableXmtp = hasFlag('--enable-xmtp')
  const backfill = hasFlag('--backfill')

  const policy = await readAlfaClubRoomAccessPolicy(ROOM_ID)
  if (!policy) {
    console.error(
      JSON.stringify({
        ok: false,
        error: 'room_access_policy_missing',
        hint: 'Apply migration 20260728010000_alfaclub_room_1659_access_policy_enable.sql',
      }),
    )
    process.exit(1)
  }

  const beforeBinding = await readAlfaClubRoomChannelBinding(ROOM_ID)
  let afterBinding = beforeBinding

  if (enableXmtp) {
    afterBinding = await upsertAlfaClubRoomChannelBinding({
      roomId: ROOM_ID,
      enabled: true,
      rolloutStatus: beforeBinding?.rolloutStatus === 'enabled' ? 'enabled' : 'canary',
      telegramEnabled: beforeBinding?.telegram.enabled ?? false,
      telegramChatId: beforeBinding?.telegram.chatId ?? null,
      telegramThreadId: beforeBinding?.telegram.threadId ?? null,
      xmtpEnabled: true,
      xmtpGroupId: beforeBinding?.xmtp.groupId ?? null,
      syntheticKeeprVaultAddress:
        beforeBinding?.xmtp.syntheticKeeprVaultAddress ?? SYNTHETIC_KEEPR_VAULT,
    })
    if (!afterBinding) {
      console.error(JSON.stringify({ ok: false, error: 'binding_upsert_failed' }))
      process.exit(1)
    }
  }

  let backfillResult: { rooms: number; enqueued: number; skipped: number } | null = null
  if (backfill) {
    if (!afterBinding?.enabled || !afterBinding.xmtp.enabled) {
      console.error(
        JSON.stringify({
          ok: false,
          error: 'xmtp_binding_not_enabled',
          hint: 'Pass --enable-xmtp before --backfill (and ensure PROTOCOL_CSW/Keepr are ready).',
        }),
      )
      process.exit(1)
    }
    backfillResult = await backfillActiveAlfaClubRoomAccessMembersToXmtp({
      roomId: ROOM_ID,
      limit: 500,
    })
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        roomId: ROOM_ID,
        policy: {
          enabled: policy.enabled,
          enterThresholdBps: policy.enterThresholdBps,
          exitThresholdBps: policy.exitThresholdBps,
          creatorCoinAddress: policy.creatorCoinAddress,
          poolAddress: policy.poolAddress,
        },
        binding: afterBinding
          ? {
              enabled: afterBinding.enabled,
              rolloutStatus: afterBinding.rolloutStatus,
              xmtpEnabled: afterBinding.xmtp.enabled,
              xmtpGroupId: afterBinding.xmtp.groupId,
              telegramEnabled: afterBinding.telegram.enabled,
            }
          : null,
        actions: {
          enableXmtp,
          backfill,
        },
        backfill: backfillResult,
        manualProof: [
          'FriendKey wallet: POST /api/v1/alfaclub/room-chat succeeds; message fans out to XMTP',
          'FriendKey wallet: send in XMTP group; message appears in AlfaClub ingest / RoomChatPanel',
          'Coin-only wallet: GET room-chat succeeds with canWrite=false; POST returns friendkey_required',
          'Coin-only wallet: not added to XMTP group',
        ],
      },
      null,
      2,
    ),
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
