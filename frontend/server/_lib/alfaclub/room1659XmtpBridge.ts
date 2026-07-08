/**
 * AlfaClub Room 1659 <-> XMTP group bridge.
 *
 * Hub-and-spoke sync: AlfaClub room 1659 is the hub. New room messages
 * (whose origin isn't already 'xmtp', see chatBridgeMessageOrigin.ts) are
 * mirrored into a dedicated XMTP group via the Keepr action queue, executed
 * on the Keepr Railway primary's already-live `XmtpService` connection
 * (`xmtp.group.send_message`, see xmtpQueueExecutor.ts). Inbound XMTP group
 * messages are mirrored back into the room by the Eliza XmtpService handler
 * calling `relayXmtpBridgeTextToAlfaClubRoom` below. Membership is kept in
 * sync with `alfaclub.room_access_memberships` via `xmtp.group.add_member` /
 * `xmtp.group.remove_member` (see roomAccessPolicy.ts hooks).
 *
 * Sending identity is the existing protocol 4626 agent CSW (`PROTOCOL_CSW_*`)
 * — no new wallet. See ERC-4337-Wallet-Invariants.mdc.
 */

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
import { logger } from '../infra/logger.js'
import { getChatBridgeMessageOrigins, recordChatBridgeMessageOrigin } from './chatBridgeMessageOrigin.js'

declare const process: { env: Record<string, string | undefined> }

/** The only room wired to the XMTP bridge today. Extend to a list if more rooms opt in later. */
export const ROOM_1659_XMTP_BRIDGE_ROOM_ID = '1659' as const

/** Synthetic keepr_vaults key for the bridge group, mirroring the waitlist chat's synthetic vault address. */
export const ROOM_1659_XMTP_BRIDGE_VAULT_ADDRESS =
  '0x0000000000000000000000000000000000001659' as const

/**
 * Placeholder group id stored until the first Keepr action bootstraps a real
 * XMTP group (`bootstrapMissingGroupForVault` in xmtpQueueExecutor.ts) and
 * persists its id back onto this vault row. Distinct from any real XMTP
 * group id (hex install ids), so it can never collide.
 */
const PENDING_BOOTSTRAP_GROUP_ID = 'pending-bootstrap:room-1659-xmtp-bridge'

function normalizeEnvScalar(raw: string | undefined): string {
  const value = String(raw ?? '').trim()
  if (!value) return ''
  const first = value[0]
  const last = value[value.length - 1]
  if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
    return value.slice(1, -1).trim()
  }
  return value
}

function parseBool(value: string | undefined): boolean {
  const raw = normalizeEnvScalar(value).toLowerCase()
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on'
}

/** Master on/off switch. Default off until rollout (see plan's Rollout section). */
export function isRoom1659XmtpBridgeEnabled(): boolean {
  return parseBool(process.env.ROOM_1659_XMTP_BRIDGE_ENABLED) && hasProtocolCswRuntimeConfig()
}

export type Room1659XmtpBridgeGroupIdResolution = {
  groupId: string | null
  isBootstrapped: boolean
}

let vaultConfiguredOnce = false

/** Test-only: clears the in-memory "already bootstrapped this process" latch. */
export function _resetRoom1659XmtpBridgeStateForTests(): void {
  vaultConfiguredOnce = false
}

/** Mirrors resolveWaitlistGroupId(): prefer the vault row's live group_id over any placeholder. */
export async function resolveRoom1659XmtpBridgeGroupId(): Promise<Room1659XmtpBridgeGroupIdResolution> {
  if (!vaultConfiguredOnce) {
    vaultConfiguredOnce = await ensureRoom1659XmtpBridgeVaultConfigured()
  }
  const vault = await getKeeprVaultByVaultAddress(ROOM_1659_XMTP_BRIDGE_VAULT_ADDRESS)
  const groupId = vault?.groupId?.trim() ? vault.groupId.trim() : null
  // Intentionally still returns the placeholder id (not null) when not yet
  // bootstrapped: xmtpQueueExecutor.ts's bootstrapMissingGroupForVault only
  // fires on a real action attempt against a group id that can't be
  // resolved, then self-heals by persisting the freshly created group id
  // back onto this vault row. Returning null here instead would mean no
  // action is ever enqueued to trigger that bootstrap in the first place.
  return {
    groupId,
    isBootstrapped: Boolean(groupId && groupId !== PENDING_BOOTSTRAP_GROUP_ID),
  }
}

/**
 * Idempotently provision the `creator_infrastructure` self-referential row
 * (protocol CSW signs for itself) and the `keepr_vaults` row for the bridge
 * group, so the existing Keepr action-queue executor
 * (`xmtpQueueExecutor.ts`) can resolve a signer and target group the same
 * way it does for the waitlist chat. Safe to call repeatedly (cold start,
 * cron tick); never overwrites an already-bootstrapped group id.
 */
export async function ensureRoom1659XmtpBridgeVaultConfigured(): Promise<boolean> {
  if (!hasProtocolCswRuntimeConfig()) return false
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
  } catch (error) {
    logger.warn('[room1659-xmtp-bridge] failed to provision creator_infrastructure row', {
      error: error instanceof Error ? error.message : String(error),
    })
    return false
  }

  const existing = await getKeeprVaultByVaultAddress(ROOM_1659_XMTP_BRIDGE_VAULT_ADDRESS)
  if (existing) return true

  try {
    await upsertKeeprVault({
      config: {
        version: 1,
        chainId: readProtocolCswChainIdEnv(),
        vault: {
          vaultAddress: ROOM_1659_XMTP_BRIDGE_VAULT_ADDRESS,
          creatorCoinAddress: cswAddress,
          canonicalOwnerAddress: cswAddress,
        },
        xmtp: { groupId: PENDING_BOOTSTRAP_GROUP_ID },
        gating: {
          // Membership is driven by alfaclub.room_access_memberships (see
          // roomAccessPolicy.ts hooks), not Keepr's own share-based gating.
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
    logger.warn('[room1659-xmtp-bridge] failed to provision keepr_vaults row', {
      error: error instanceof Error ? error.message : String(error),
    })
    return false
  }
}

export type Room1659InsertedRoomMessage = {
  roomId: string
  messageId: string
  text: string
}

/**
 * Room 1659 -> XMTP (outbound). For each newly-ingested room message not
 * already tagged origin='xmtp' (i.e. not an echo of something we just
 * mirrored in from the XMTP side), enqueue a `xmtp.group.send_message`
 * Keepr action. Native/Hermit-authored and Telegram-origin messages are
 * intentionally relayed here too (hub-and-spoke cross-propagation).
 */
export async function relayNewRoom1659MessagesToXmtpBridge(
  messages: Room1659InsertedRoomMessage[],
): Promise<{ enqueued: number; skipped: number }> {
  const candidates = messages.filter((m) => m.roomId === ROOM_1659_XMTP_BRIDGE_ROOM_ID && m.text.trim())
  if (candidates.length === 0) return { enqueued: 0, skipped: 0 }
  if (!isRoom1659XmtpBridgeEnabled()) return { enqueued: 0, skipped: candidates.length }

  const { groupId } = await resolveRoom1659XmtpBridgeGroupId()
  if (!groupId) return { enqueued: 0, skipped: candidates.length }

  const origins = await getChatBridgeMessageOrigins({
    roomId: ROOM_1659_XMTP_BRIDGE_ROOM_ID,
    messageIds: candidates.map((m) => m.messageId),
  })

  let enqueued = 0
  let skipped = 0
  for (const message of candidates) {
    if (origins.get(message.messageId) === 'xmtp') {
      skipped += 1
      continue
    }
    try {
      await enqueueKeeprAction({
        vaultAddress: ROOM_1659_XMTP_BRIDGE_VAULT_ADDRESS,
        groupId,
        actionType: 'xmtp.group.send_message',
        action: { action: 'xmtp.group.send_message', message: message.text },
        dedupeKey: `room1659-xmtp-bridge:send:${message.messageId}`,
      })
      enqueued += 1
    } catch (error) {
      skipped += 1
      logger.warn('[room1659-xmtp-bridge] failed to enqueue outbound send', {
        messageId: message.messageId,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }
  return { enqueued, skipped }
}

/**
 * XMTP -> Room 1659 (inbound). Called by the Eliza XmtpService handler when
 * it sees a message on the bridge's group conversation. Posts into the room
 * with origin='xmtp' tagged on success so the outbound relay above doesn't
 * echo it straight back to XMTP.
 */
export async function relayXmtpBridgeTextToAlfaClubRoom(text: string): Promise<boolean> {
  const trimmed = text.trim()
  if (!trimmed) return false
  if (!isRoom1659XmtpBridgeEnabled()) return false

  try {
    // Dynamic import avoids a static import cycle: chatBridge.ts imports
    // from this module's outbound relay (via ingestLiveMessages), so this
    // module cannot statically import chatBridge.ts back.
    const { sendAlfaClubRoomText } = await import('./chatBridge.js')
    const result = await sendAlfaClubRoomText({
      roomId: ROOM_1659_XMTP_BRIDGE_ROOM_ID,
      text: trimmed,
      origin: 'xmtp',
    })
    return Boolean(result.messageId) || result.lane != null
  } catch (error) {
    logger.warn('[room1659-xmtp-bridge] failed to relay inbound xmtp message to room', {
      error: error instanceof Error ? error.message : String(error),
    })
    return false
  }
}

export type Room1659MembershipSyncAction = 'add' | 'remove'

/**
 * Keep the bridge XMTP group's membership in sync with a room-1659
 * `alfaclub.room_access_memberships` status transition. No-ops for any
 * other room (roomAccessPolicy.ts calls this unconditionally on every
 * room's transitions; only room 1659 is currently wired to a bridge).
 */
export async function syncRoom1659XmtpBridgeMembership(params: {
  roomId: string
  walletAddress: `0x${string}`
  action: Room1659MembershipSyncAction
}): Promise<boolean> {
  if (params.roomId !== ROOM_1659_XMTP_BRIDGE_ROOM_ID) return false
  if (!isRoom1659XmtpBridgeEnabled()) return false

  const { groupId } = await resolveRoom1659XmtpBridgeGroupId()
  if (!groupId) return false

  const actionType = params.action === 'add' ? 'xmtp.group.add_member' : 'xmtp.group.remove_member'
  try {
    await enqueueKeeprAction({
      vaultAddress: ROOM_1659_XMTP_BRIDGE_VAULT_ADDRESS,
      groupId,
      actionType,
      action: { action: actionType, wallet: params.walletAddress },
      dedupeKey: `room1659-xmtp-bridge:member:${params.walletAddress.toLowerCase()}:${params.action}`,
    })
    return true
  } catch (error) {
    logger.warn('[room1659-xmtp-bridge] failed to enqueue membership sync', {
      wallet: params.walletAddress,
      action: params.action,
      error: error instanceof Error ? error.message : String(error),
    })
    return false
  }
}

/** Re-exported for callers/tests that want the ledger helper alongside the bridge. */
export { recordChatBridgeMessageOrigin, getChatBridgeMessageOrigins }
