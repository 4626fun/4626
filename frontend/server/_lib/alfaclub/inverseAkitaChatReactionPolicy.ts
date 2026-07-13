import type { Address } from 'viem'

import {
  ALFACLUB,
  FRIEND_KEY_ABI,
  getAlfaClubPublicClient,
  ZERO_ADDRESS,
} from '../wallet/alfaclub.js'
import { resolveInverseAkitaStakerPilotAccess } from './inverseAkitaStakerPilot.js'

declare const process: { env: Record<string, string | undefined> }

export const INVERSE_AKITA_SHARED_EXECUTOR_ROOM_ID = '1659'
export const INVERSE_AKITA_OWNER_ONLY_ROOM_IDS = ['1484', '1660', '2', '1043'] as const

const SUPPORTED_REACTION_ROOM_IDS = new Set<string>([
  ...INVERSE_AKITA_OWNER_ONLY_ROOM_IDS,
  INVERSE_AKITA_SHARED_EXECUTOR_ROOM_ID,
])

export type InverseAkitaChatAuthorAccessReason =
  | 'owner'
  | 'staker'
  | 'insufficient_stake'
  | 'stake_read_failed'
  | 'not_room_owner'
  | 'owner_read_failed'
  | 'invalid_sender'
  | 'wrong_room'

export type InverseAkitaChatAuthorAccess = {
  eligible: boolean
  reason: InverseAkitaChatAuthorAccessReason
  stakedKeys: number | null
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

export async function resolveInverseAkitaChatAuthorAccess(params: {
  roomId: string | null | undefined
  senderAddress: string
}): Promise<InverseAkitaChatAuthorAccess> {
  const roomId = normalizeRoomId(params.roomId)
  if (!isInverseAkitaChatReactionRoom(roomId)) {
    return { eligible: false, reason: 'wrong_room', stakedKeys: null }
  }

  const sender = normalizeAddress(params.senderAddress)
  if (!sender) {
    return { eligible: false, reason: 'invalid_sender', stakedKeys: null }
  }

  if (roomId === INVERSE_AKITA_SHARED_EXECUTOR_ROOM_ID) {
    const pilotAccess = await resolveInverseAkitaStakerPilotAccess({
      senderAddress: sender,
      roomId,
      isTrustedOperator: false,
    })
    if (pilotAccess.eligible && pilotAccess.reason === 'staker') {
      return {
        eligible: true,
        reason: 'staker',
        stakedKeys: pilotAccess.stakedKeys,
      }
    }
    return {
      eligible: false,
      reason:
        pilotAccess.reason === 'insufficient_stake'
          ? 'insufficient_stake'
          : 'stake_read_failed',
      stakedKeys: pilotAccess.stakedKeys,
    }
  }

  try {
    const client = await getAlfaClubPublicClient()
    const creator = (await client.readContract({
      address: ALFACLUB.friendKey,
      abi: FRIEND_KEY_ABI,
      functionName: 'creatorByTokenId',
      args: [BigInt(roomId)],
    })) as Address
    const normalizedCreator = normalizeAddress(creator)
    if (!normalizedCreator || normalizedCreator === ZERO_ADDRESS) {
      return { eligible: false, reason: 'owner_read_failed', stakedKeys: null }
    }
    return normalizedCreator === sender
      ? { eligible: true, reason: 'owner', stakedKeys: null }
      : { eligible: false, reason: 'not_room_owner', stakedKeys: null }
  } catch {
    return { eligible: false, reason: 'owner_read_failed', stakedKeys: null }
  }
}
