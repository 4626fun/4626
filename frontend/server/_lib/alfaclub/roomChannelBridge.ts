import { enableCswAgent } from '../messaging/creatorXmtpAgents.js'
import {
  enqueueKeeprAction,
  getKeeprVaultByVaultAddress,
  upsertKeeprVault,
} from '../keepr/keeprRegistry.js'
import {
  hasProtocolCswRuntimeConfig,
  readProtocolCswChainIdEnv,
  readProtocolCswPrivyWalletIdEnv,
  resolveServerAgentCswAddress,
} from '../wallet/canonicalCswEnv.js'
import { resolveAuthorizedWalletProfile } from '../wallet/canonicalWalletResolver.js'
import { getDb } from '../db/postgres.js'
import { logger } from '../infra/logger.js'
import {
  claimAlfaClubCrossChannelIngress,
  linkAlfaClubCrossChannelIngress,
} from './crossChannelIngress.js'
import {
  listEnabledAlfaClubRoomChannelBindings,
  lookupEnabledAlfaClubRoomChannelBindingByRoom,
  upsertAlfaClubRoomChannelBinding,
  type AlfaClubRoomChannelBinding,
} from './roomChannelBindings.js'
import type { ChatBridgeMessageOrigin } from './chatBridgeMessageOrigin.js'

export type RoomChannelBridgeMessage = {
  roomId: string
  messageId: string
  text: string
  origin?: ChatBridgeMessageOrigin
}

export type RoomChannelMembershipSyncAction = 'add' | 'remove'

type SendRoomText = (params: {
  roomId: string
  text: string
  origin: 'xmtp'
  clientMessageId: string
}) => Promise<{ messageId: string | null; lane: string }>

function pendingGroupId(roomId: string): string {
  return `pending-bootstrap:alfaclub-room:${roomId}`
}

function isUsableXmtpBinding(
  binding: AlfaClubRoomChannelBinding | null,
): binding is AlfaClubRoomChannelBinding {
  return Boolean(
    binding?.enabled
      && binding.rolloutStatus !== 'disabled'
      && binding.xmtp.enabled
      && binding.xmtp.syntheticKeeprVaultAddress,
  )
}

export async function ensureRoomChannelBridgeVaultConfigured(
  binding: AlfaClubRoomChannelBinding,
): Promise<boolean> {
  const vaultAddress = binding.xmtp.syntheticKeeprVaultAddress
  if (!isUsableXmtpBinding(binding) || !vaultAddress || !hasProtocolCswRuntimeConfig()) return false
  const cswAddress = resolveServerAgentCswAddress()
  const privyWalletId = readProtocolCswPrivyWalletIdEnv().trim()
  if (!privyWalletId) return false

  try {
    await enableCswAgent({
      creatorAddress: cswAddress,
      cswAddress,
      privyWalletId,
      listedPublicly: false,
    })
    const existing = await getKeeprVaultByVaultAddress(vaultAddress)
    if (existing) return true
    await upsertKeeprVault({
      config: {
        version: 1,
        chainId: readProtocolCswChainIdEnv(),
        vault: {
          vaultAddress,
          creatorCoinAddress: cswAddress,
          canonicalOwnerAddress: cswAddress,
        },
        xmtp: { groupId: binding.xmtp.groupId ?? pendingGroupId(binding.roomId) },
        gating: {
          enabled: false,
          joinLocked: false,
          mode: 'none',
          failClosed: false,
        },
        roles: { owner: cswAddress },
      },
    })
    return true
  } catch (error) {
    logger.warn('[alfaclub-room-channel] vault_configuration_failed', {
      roomId: binding.roomId,
      error: error instanceof Error ? error.message : String(error),
    })
    return false
  }
}

export async function resolveRoomChannelBridgeGroupId(
  binding: AlfaClubRoomChannelBinding,
): Promise<string | null> {
  if (!isUsableXmtpBinding(binding)) return null
  await ensureRoomChannelBridgeVaultConfigured(binding)
  const vaultAddress = binding.xmtp.syntheticKeeprVaultAddress
  if (!vaultAddress) return null
  const vault = await getKeeprVaultByVaultAddress(vaultAddress).catch(() => null)
  const groupId = vault?.groupId?.trim() || binding.xmtp.groupId?.trim() || null
  if (
    groupId &&
    groupId !== pendingGroupId(binding.roomId) &&
    groupId !== binding.xmtp.groupId
  ) {
    await upsertAlfaClubRoomChannelBinding({
      roomId: binding.roomId,
      enabled: binding.enabled,
      rolloutStatus: binding.rolloutStatus,
      telegramEnabled: binding.telegram.enabled,
      telegramChatId: binding.telegram.chatId,
      telegramThreadId: binding.telegram.threadId,
      xmtpEnabled: binding.xmtp.enabled,
      xmtpGroupId: groupId,
      syntheticKeeprVaultAddress: vaultAddress,
    }).catch(() => null)
  }
  return groupId && groupId !== pendingGroupId(binding.roomId) ? groupId : groupId
}

export async function relayRoomMessagesToXmtp(
  messages: RoomChannelBridgeMessage[],
): Promise<{ enqueued: number; skipped: number }> {
  let enqueued = 0
  let skipped = 0
  const byRoom = new Map<string, RoomChannelBridgeMessage[]>()
  for (const message of messages) {
    if (!message.roomId.trim() || !message.messageId.trim() || !message.text.trim()) continue
    byRoom.set(message.roomId, [...(byRoom.get(message.roomId) ?? []), message])
  }

  for (const [roomId, roomMessages] of byRoom) {
    const lookup = await lookupEnabledAlfaClubRoomChannelBindingByRoom(roomId)
    const binding = lookup.binding
    if (!lookup.available || !isUsableXmtpBinding(binding)) {
      skipped += roomMessages.length
      continue
    }
    const groupId = await resolveRoomChannelBridgeGroupId(binding)
    const vaultAddress = binding.xmtp.syntheticKeeprVaultAddress
    if (!groupId || !vaultAddress) {
      skipped += roomMessages.length
      continue
    }
    for (const message of roomMessages) {
      if (message.origin === 'xmtp') {
        skipped += 1
        continue
      }
      try {
        await enqueueKeeprAction({
          vaultAddress,
          groupId,
          actionType: 'xmtp.group.send_message',
          action: { action: 'xmtp.group.send_message', message: message.text },
          dedupeKey: `alfaclub-room:${roomId}:xmtp:send:${message.messageId}`,
        })
        enqueued += 1
      } catch (error) {
        skipped += 1
        logger.warn('[alfaclub-room-channel] xmtp_send_enqueue_failed', {
          roomId,
          messageId: message.messageId,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }
  }
  return { enqueued, skipped }
}

export async function relayXmtpMessageToAlfaClubRoom(params: {
  binding: AlfaClubRoomChannelBinding
  text: string
  messageId: string
  conversationId: string
  senderInboxId: string
  senderAddress: string
  sentAtMs?: number | null
  sendRoomText: SendRoomText
}): Promise<boolean> {
  const text = params.text.trim()
  if (!text || !isUsableXmtpBinding(params.binding)) return false
  if (params.binding.xmtp.groupId !== params.conversationId) return false

  const authority = await resolveAuthorizedWalletProfile(params.senderAddress).catch(() => null)
  const canonicalIssuer = authority?.canonicalSmartWalletAddress?.toLowerCase() ?? null
  if (!authority || !canonicalIssuer) return false
  const db = await getDb()
  if (!db) return false
  const membership = await db.sql`
    SELECT 1
    FROM alfaclub.room_access_memberships
    WHERE room_id = ${params.binding.roomId}
      AND LOWER(wallet_address) = ${canonicalIssuer}
      AND status = 'active'
    LIMIT 1;
  `.catch(() => null)
  if (!membership?.rows?.[0]) return false

  const claim = await claimAlfaClubCrossChannelIngress({
    sourceChannel: 'xmtp',
    sourceMessageId: params.messageId,
    sourceConversationId: params.conversationId,
    targetRoomId: params.binding.roomId,
    originalText: text,
  })
  if (!claim?.claimed) return false

  try {
    const send = await params.sendRoomText({
      roomId: params.binding.roomId,
      text,
      origin: 'xmtp',
      clientMessageId: `xmtp:${params.conversationId}:${params.messageId}`,
    })
    if (send.messageId) {
      await linkAlfaClubCrossChannelIngress({
        sourceChannel: 'xmtp',
        sourceMessageId: params.messageId,
        alfaclubRoomId: params.binding.roomId,
        alfaclubMessageId: send.messageId,
        validatedProfileId: authority.profileId,
        validatedIssuer: canonicalIssuer,
      })
    }
    return Boolean(send.messageId) || Boolean(send.lane)
  } catch (error) {
    logger.warn('[alfaclub-room-channel] xmtp_ingress_failed', {
      roomId: params.binding.roomId,
      messageId: params.messageId,
      senderInboxId: params.senderInboxId,
      sentAtMs: params.sentAtMs ?? null,
      error: error instanceof Error ? error.message : String(error),
    })
    return false
  }
}

export async function syncRoomChannelBridgeMembership(params: {
  roomId: string
  walletAddress: `0x${string}`
  action: RoomChannelMembershipSyncAction
  reasonKey?: string
}): Promise<boolean> {
  const lookup = await lookupEnabledAlfaClubRoomChannelBindingByRoom(params.roomId)
  const binding = lookup.binding
  if (!lookup.available || !isUsableXmtpBinding(binding)) return false
  const groupId = await resolveRoomChannelBridgeGroupId(binding)
  const vaultAddress = binding.xmtp.syntheticKeeprVaultAddress
  if (!groupId || !vaultAddress) return false
  const actionType = params.action === 'add' ? 'xmtp.group.add_member' : 'xmtp.group.remove_member'
  try {
    await enqueueKeeprAction({
      vaultAddress,
      groupId,
      actionType,
      action: { action: actionType, wallet: params.walletAddress },
      dedupeKey: [
        'alfaclub-room',
        binding.roomId,
        'xmtp',
        'member',
        params.walletAddress.toLowerCase(),
        params.action,
        params.reasonKey ?? 'transition',
      ].join(':'),
    })
    return true
  } catch {
    return false
  }
}

export async function backfillActiveRoomChannelBridgeMembers(params?: {
  roomId?: string
  limit?: number
}): Promise<{ rooms: number; enqueued: number; skipped: number }> {
  const bindings = params?.roomId
    ? [(await lookupEnabledAlfaClubRoomChannelBindingByRoom(params.roomId)).binding].filter(
        (binding): binding is AlfaClubRoomChannelBinding => isUsableXmtpBinding(binding),
      )
    : (await listEnabledAlfaClubRoomChannelBindings()).filter(isUsableXmtpBinding)
  const db = await getDb()
  if (!db) return { rooms: 0, enqueued: 0, skipped: 0 }
  const limit = Math.max(1, Math.min(1_000, Math.floor(params?.limit ?? 500)))
  let enqueued = 0
  let skipped = 0
  for (const binding of bindings) {
    const result = await db.sql`
      SELECT wallet_address
      FROM alfaclub.room_access_memberships
      WHERE room_id = ${binding.roomId}
        AND status = 'active'
      ORDER BY wallet_address ASC
      LIMIT ${limit};
    `.catch(() => null)
    for (const row of result?.rows ?? []) {
      const walletAddress = String(row.wallet_address ?? '').toLowerCase()
      if (!/^0x[a-f0-9]{40}$/.test(walletAddress)) {
        skipped += 1
        continue
      }
      const ok = await syncRoomChannelBridgeMembership({
        roomId: binding.roomId,
        walletAddress: walletAddress as `0x${string}`,
        action: 'add',
        reasonKey: 'backfill',
      })
      if (ok) enqueued += 1
      else skipped += 1
    }
  }
  return { rooms: bindings.length, enqueued, skipped }
}
