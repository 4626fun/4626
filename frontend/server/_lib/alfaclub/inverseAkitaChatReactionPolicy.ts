import type { Address } from 'viem'

import { getAlfaClubPublicClient } from '../wallet/alfaclub.js'
import { getAlfaClubHoldings } from '../wallet/alfaclub.js'
import { readUserStakedKeys, resolveStakingPoolAddress } from './alfaclubStakeReads.js'

declare const process: { env: Record<string, string | undefined> }

export const INVERSE_AKITA_SHARED_EXECUTOR_ROOM_ID = '1659'
/** Extra rooms Hermit may listen on for chat opinions (stake-gated like 1659). */
export const INVERSE_AKITA_EXTRA_REACTION_ROOM_IDS = ['1484', '1660', '2', '1043'] as const
/** @deprecated Use INVERSE_AKITA_EXTRA_REACTION_ROOM_IDS — rooms are stake-gated, not owner-only. */
export const INVERSE_AKITA_OWNER_ONLY_ROOM_IDS = INVERSE_AKITA_EXTRA_REACTION_ROOM_IDS

const MIN_STAKED_KEYS = 1
const AUTO_DISCOVERY_CACHE_MS = 5 * 60_000
const MAX_AUTO_DISCOVERY_ROOMS = 80
let runtimeRoomIdsOverride: string[] = []
let cachedAutoDiscoveredRooms:
  | { walletFingerprint: string; roomIds: string[]; expiresAt: number }
  | null = null

export type InverseAkitaChatAuthorAccessReason =
  | 'staker'
  | 'insufficient_stake'
  | 'stake_read_failed'
  | 'invalid_sender'
  | 'room_listen_only'
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

function normalizeRoomIds(values: Iterable<string | null | undefined>): string[] {
  return Array.from(
    new Set(
      Array.from(values)
        .map((value) => normalizeRoomId(value))
        .filter((value) => value.length > 0),
    ),
  )
}

function readWalletsFromChatJwt(jwt: string | null | undefined): Address[] {
  const token = String(jwt ?? '').trim()
  if (!token) return []
  const parts = token.split('.')
  if (parts.length !== 3 || !parts[1]) return []
  try {
    const payload = JSON.parse(
      Buffer.from(parts[1], 'base64url').toString('utf8'),
    ) as Record<string, unknown>
    const linkedRaw = payload.linked_accounts
    const linked =
      typeof linkedRaw === 'string'
        ? (JSON.parse(linkedRaw) as unknown)
        : linkedRaw
    if (!Array.isArray(linked)) return []
    const wallets: Address[] = []
    for (const entry of linked) {
      if (!entry || typeof entry !== 'object') continue
      const candidate = normalizeAddress((entry as { address?: unknown }).address as string | undefined)
      if (candidate) wallets.push(candidate)
    }
    return wallets
  } catch {
    return []
  }
}

function readAutoDiscoveryWallets(): Address[] {
  const envWallets = String(process.env.ALFACLUB_INVERSE_AKITA_ROOM_WALLETS ?? '')
    .split(/[,\s]+/g)
    .map((entry) => normalizeAddress(entry))
    .filter((entry): entry is Address => Boolean(entry))
  if (envWallets.length > 0) return Array.from(new Set(envWallets))
  return Array.from(new Set(readWalletsFromChatJwt(process.env.ALFACLUB_CHAT_JWT)))
}

export function setInverseAkitaRuntimeReactionRoomIds(roomIds: string[]): void {
  runtimeRoomIdsOverride = normalizeRoomIds(roomIds)
}

function readConfiguredInverseAkitaChatReactionRoomIds(): string[] {
  const configured = String(
    process.env.ALFACLUB_INVERSE_AKITA_CHAT_REACTION_ROOM_IDS ?? '',
  ).trim()
  return configured
    ? normalizeRoomIds(configured.split(','))
    : [INVERSE_AKITA_SHARED_EXECUTOR_ROOM_ID]
}

function readDiscoveredTradeAllowlistRoomIds(): string[] {
  return normalizeRoomIds(
    String(process.env.ALFACLUB_INVERSE_AKITA_DISCOVERED_TRADE_ROOM_IDS ?? '').split(','),
  )
}

function isInverseAkitaTradeEnabledRoom(roomId: string): boolean {
  const normalizedRoomId = normalizeRoomId(roomId)
  if (!normalizedRoomId) return false
  if (readConfiguredInverseAkitaChatReactionRoomIds().includes(normalizedRoomId)) return true
  return readDiscoveredTradeAllowlistRoomIds().includes(normalizedRoomId)
}

export function readInverseAkitaChatReactionRoomIds(): string[] {
  const configuredRoomIds = readConfiguredInverseAkitaChatReactionRoomIds()
  return normalizeRoomIds([...configuredRoomIds, ...runtimeRoomIdsOverride])
}

export function isInverseAkitaChatReactionRoom(
  roomId: string | null | undefined,
  configuredRoomIds = readInverseAkitaChatReactionRoomIds(),
): boolean {
  const normalized = normalizeRoomId(roomId)
  return normalized.length > 0 && configuredRoomIds.includes(normalized)
}

export async function resolveInverseAkitaRuntimeReactionRoomIds(
  configuredRoomIds = readInverseAkitaChatReactionRoomIds(),
): Promise<string[]> {
  const fallback = normalizeRoomIds(configuredRoomIds)
  const wallets = readAutoDiscoveryWallets()
  if (wallets.length === 0) return fallback

  const walletFingerprint = wallets.join(',')
  const now = Date.now()
  if (
    cachedAutoDiscoveredRooms
    && cachedAutoDiscoveredRooms.walletFingerprint === walletFingerprint
    && cachedAutoDiscoveredRooms.expiresAt > now
  ) {
    return normalizeRoomIds([...fallback, ...cachedAutoDiscoveredRooms.roomIds])
  }

  try {
    const client = await getAlfaClubPublicClient()
    const holdingsResults = await Promise.all(
      wallets.map((wallet) => getAlfaClubHoldings(wallet, client)),
    )
    const discoveredRoomIds = normalizeRoomIds(
      holdingsResults.flatMap((result) => result.holdings.map(({ tokenId }) => tokenId.toString())),
    ).slice(0, MAX_AUTO_DISCOVERY_ROOMS)
    cachedAutoDiscoveredRooms = {
      walletFingerprint,
      roomIds: discoveredRoomIds,
      expiresAt: now + AUTO_DISCOVERY_CACHE_MS,
    }
    return normalizeRoomIds([...fallback, ...discoveredRoomIds])
  } catch {
    return fallback
  }
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
 * Eligible when the sender has ≥1 FriendKey staked in the message room.
 * Auto-discovered rooms are listen-only unless explicitly allowlisted for trade.
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
  if (!isInverseAkitaTradeEnabledRoom(roomId)) {
    return { eligible: false, reason: 'room_listen_only', stakedKeys: null }
  }

  const stakedKeys = await readStakedKeysInRoom(sender, roomId)
  if (stakedKeys == null) {
    return { eligible: false, reason: 'stake_read_failed', stakedKeys: null }
  }
  if (stakedKeys >= MIN_STAKED_KEYS) {
    return {
      eligible: true,
      reason: 'staker',
      stakedKeys,
      stakeRoomId: roomId,
    }
  }

  return {
    eligible: false,
    reason: 'insufficient_stake',
    stakedKeys,
  }
}
