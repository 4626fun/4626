import type { Address } from 'viem'

import { getAlfaClubPublicClient } from '../wallet/alfaclub.js'
import { readUserStakedKeys, resolveStakingPoolAddress } from './alfaclubStakeReads.js'

declare const process: { env: Record<string, string | undefined> }

export const INVERSE_AKITA_SHARED_EXECUTOR_ROOM_ID = '1659'
/** Extra rooms Hermit may listen on for chat opinions (stake-gated like 1659). */
export const INVERSE_AKITA_EXTRA_REACTION_ROOM_IDS = ['1484', '1660', '2', '1043'] as const
/** @deprecated Use INVERSE_AKITA_EXTRA_REACTION_ROOM_IDS — rooms are stake-gated, not owner-only. */
export const INVERSE_AKITA_OWNER_ONLY_ROOM_IDS = INVERSE_AKITA_EXTRA_REACTION_ROOM_IDS

const MIN_STAKED_KEYS = 1

const SUPPORTED_REACTION_ROOM_IDS = new Set<string>([
  ...INVERSE_AKITA_EXTRA_REACTION_ROOM_IDS,
  INVERSE_AKITA_SHARED_EXECUTOR_ROOM_ID,
])

export type InverseAkitaChatAuthorAccessReason =
  | 'staker'
  | 'insufficient_stake'
  | 'stake_read_failed'
  | 'invalid_sender'
  | 'wrong_room'

export type InverseAkitaChatAuthorAccess = {
  eligible: boolean
  reason: InverseAkitaChatAuthorAccessReason
  stakedKeys: number | null
  /** Room where the qualifying stake was found (when eligible). */
  stakeRoomId?: string | null
}

function normalizeRoomId(value: string | null | undefined): string {
  const roomId = String(value ?? '').trim()
  return /^\d+$/.test(roomId) ? roomId : ''
}

function normalizeAddress(value: string | null | undefined): Address | null {
  const address = String(value ?? '').trim().toLowerCase()
  return /^0x[a-f0-9]{40}$/.test(address) ? (address as Address) : null
}

export function readInverseAkitaChatReactionRoomIds(): string[] {
  const configured = String(
    process.env.ALFACLUB_INVERSE_AKITA_CHAT_REACTION_ROOM_IDS ?? '',
  ).trim()
  if (!configured) return [INVERSE_AKITA_SHARED_EXECUTOR_ROOM_ID]

  return Array.from(
    new Set(
      configured
        .split(',')
        .map(normalizeRoomId)
        .filter((roomId) => SUPPORTED_REACTION_ROOM_IDS.has(roomId)),
    ),
  )
}

export function isInverseAkitaChatReactionRoom(
  roomId: string | null | undefined,
  configuredRoomIds = readInverseAkitaChatReactionRoomIds(),
): boolean {
  const normalized = normalizeRoomId(roomId)
  return normalized.length > 0 && configuredRoomIds.includes(normalized)
}

async function readStakedKeysInRoom(
  sender: Address,
  roomId: string,
): Promise<number | null> {
  try {
    const client = await getAlfaClubPublicClient()
    const tokenId = BigInt(roomId)
    const stakingPool = await resolveStakingPoolAddress(client, tokenId)
    return await readUserStakedKeys(client, stakingPool, sender, { tokenId })
  } catch {
    return null
  }
}

/**
 * Eligible when the sender has ≥1 FriendKey staked in **any** configured
 * reaction room (message room checked first). Accidental opinions from
 * stakers count — there is no room-owner gate.
 */
export async function resolveInverseAkitaChatAuthorAccess(params: {
  roomId: string | null | undefined
  senderAddress: string
  configuredRoomIds?: string[]
}): Promise<InverseAkitaChatAuthorAccess> {
  const roomId = normalizeRoomId(params.roomId)
  const configuredRoomIds =
    params.configuredRoomIds ?? readInverseAkitaChatReactionRoomIds()
  if (!isInverseAkitaChatReactionRoom(roomId, configuredRoomIds)) {
    return { eligible: false, reason: 'wrong_room', stakedKeys: null }
  }

  const sender = normalizeAddress(params.senderAddress)
  if (!sender) {
    return { eligible: false, reason: 'invalid_sender', stakedKeys: null }
  }

  const roomsToCheck = [
    roomId,
    ...configuredRoomIds.filter((candidate) => candidate !== roomId),
  ]

  let sawSuccessfulRead = false
  let maxStakedKeys = 0

  for (const candidate of roomsToCheck) {
    const stakedKeys = await readStakedKeysInRoom(sender, candidate)
    if (stakedKeys == null) continue
    sawSuccessfulRead = true
    if (stakedKeys >= MIN_STAKED_KEYS) {
      return {
        eligible: true,
        reason: 'staker',
        stakedKeys,
        stakeRoomId: candidate,
      }
    }
    if (stakedKeys > maxStakedKeys) maxStakedKeys = stakedKeys
  }

  if (sawSuccessfulRead) {
    return {
      eligible: false,
      reason: 'insufficient_stake',
      stakedKeys: maxStakedKeys,
    }
  }

  return { eligible: false, reason: 'stake_read_failed', stakedKeys: null }
}
