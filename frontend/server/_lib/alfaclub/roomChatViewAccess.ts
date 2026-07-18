import type { Address } from 'viem'

import {
  ALFACLUB,
  FRIEND_KEY_ABI,
  getAlfaClubPublicClient,
  type AlfaClubPublicClientLike,
} from '../wallet/alfaclub.js'
import { resolveAuthorizedWalletProfile } from '../wallet/canonicalWalletResolver.js'
import {
  readUserStakedKeysFromStorage,
  resolveStakingPoolAddress,
} from './alfaclubStakeReads.js'
import {
  evaluateAlfaClubRoomCoinEligibility,
  readAlfaClubRoomAccessMembership,
  readAlfaClubRoomAccessPolicy,
} from './roomAccessPolicy.js'

export type RoomChatViewAccessReason =
  | 'anonymous'
  | 'no_wallet'
  | 'room_key'
  | 'staked_key'
  | 'membership'
  | 'coin_equivalent'
  | 'insufficient'
  | 'check_failed'

export type RoomChatViewAccess = {
  allowed: boolean
  reason: RoomChatViewAccessReason
  walletAddress: `0x${string}` | null
}

const EVM_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/i

type RoomChatViewAccessDependencies = {
  resolveWallets?: (sessionAddress: string) => Promise<`0x${string}`[]>
  getPublicClient?: () => Promise<AlfaClubPublicClientLike>
  readWalletKeyBalance?: (params: {
    client: AlfaClubPublicClientLike
    wallet: Address
    tokenId: bigint
  }) => Promise<bigint | null>
  readWalletStakedKeys?: (params: {
    client: AlfaClubPublicClientLike
    wallet: Address
    tokenId: bigint
  }) => Promise<number | null>
  readMembership?: typeof readAlfaClubRoomAccessMembership
  readPolicy?: typeof readAlfaClubRoomAccessPolicy
  evaluateCoinEligibility?: typeof evaluateAlfaClubRoomCoinEligibility
}

function normalizeAddress(value: unknown): `0x${string}` | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim().toLowerCase()
  if (!EVM_ADDRESS_RE.test(trimmed)) return null
  return trimmed as `0x${string}`
}

function parseTokenId(roomId: string, policyTokenId?: string | null): bigint | null {
  const candidates = [policyTokenId, roomId]
  for (const raw of candidates) {
    if (typeof raw !== 'string') continue
    const trimmed = raw.trim()
    if (!/^\d+$/.test(trimmed)) continue
    try {
      return BigInt(trimmed)
    } catch {
      continue
    }
  }
  return null
}

async function resolveViewerWallets(sessionAddress: string): Promise<`0x${string}`[]> {
  const session = normalizeAddress(sessionAddress)
  if (!session) return []

  const wallets = new Set<`0x${string}`>([session])
  try {
    const authority = await resolveAuthorizedWalletProfile(session)
    const canonical = normalizeAddress(authority?.canonicalSmartWalletAddress)
    if (canonical) wallets.add(canonical)
  } catch {
    // Session wallet alone is enough for key/membership checks.
  }
  return [...wallets]
}

async function readFriendKeyBalance(params: {
  client: AlfaClubPublicClientLike
  wallet: Address
  tokenId: bigint
}): Promise<bigint | null> {
  try {
    const balance = (await params.client.readContract({
      address: ALFACLUB.friendKey,
      abi: FRIEND_KEY_ABI,
      functionName: 'balanceOf',
      args: [params.wallet, params.tokenId],
    })) as bigint
    return typeof balance === 'bigint' ? balance : null
  } catch {
    return null
  }
}

async function readStakedKeysFast(params: {
  client: AlfaClubPublicClientLike
  wallet: Address
  tokenId: bigint
}): Promise<number | null> {
  const pool = await resolveStakingPoolAddress(params.client, params.tokenId)
  if (!pool) return 0
  const staked = await readUserStakedKeysFromStorage(params.client, pool, params.wallet)
  if (staked == null) return null
  if (staked > BigInt(Number.MAX_SAFE_INTEGER)) return Number.MAX_SAFE_INTEGER
  return Number(staked)
}

/**
 * Chat text is visible only when the viewer holds a room FriendKey (wallet or staked)
 * or meets the room's creator-coin / LP-equivalent access threshold.
 *
 * Sudoswap ERC-1155/ERC-20 LP equivalence can extend the coin path later; today that
 * lane uses `room_access_policies` + the pinned official Sudoswap pair buy quote.
 */
export async function resolveRoomChatViewAccess(params: {
  roomId: string
  sessionAddress?: string | null
  dependencies?: RoomChatViewAccessDependencies
}): Promise<RoomChatViewAccess> {
  const session = normalizeAddress(params.sessionAddress)
  if (!session) {
    return { allowed: false, reason: 'anonymous', walletAddress: null }
  }

  const deps = params.dependencies ?? {}
  const wallets = await (deps.resolveWallets ?? resolveViewerWallets)(session)
  if (wallets.length === 0) {
    return { allowed: false, reason: 'no_wallet', walletAddress: null }
  }

  const readMembership = deps.readMembership ?? readAlfaClubRoomAccessMembership
  for (const wallet of wallets) {
    const membership = await readMembership({ roomId: params.roomId, walletAddress: wallet }).catch(
      () => null,
    )
    if (membership && (membership.status === 'active' || membership.status === 'grace')) {
      return { allowed: true, reason: 'membership', walletAddress: wallet }
    }
  }

  const readPolicy = deps.readPolicy ?? readAlfaClubRoomAccessPolicy
  const policy = await readPolicy(params.roomId).catch(() => null)
  const tokenId = parseTokenId(params.roomId, policy?.tokenId ?? null)

  if (tokenId != null) {
    try {
      const client = await (deps.getPublicClient ?? getAlfaClubPublicClient)()
      const readBalance = deps.readWalletKeyBalance ?? readFriendKeyBalance
      const readStaked = deps.readWalletStakedKeys ?? readStakedKeysFast

      for (const wallet of wallets) {
        const held = await readBalance({ client, wallet, tokenId })
        if (held != null && held > 0n) {
          return { allowed: true, reason: 'room_key', walletAddress: wallet }
        }
      }

      for (const wallet of wallets) {
        const staked = await readStaked({ client, wallet, tokenId })
        if (staked != null && staked > 0) {
          return { allowed: true, reason: 'staked_key', walletAddress: wallet }
        }
      }
    } catch {
      // Fall through to coin eligibility / deny.
    }
  }

  if (policy?.enabled) {
    const evaluate = deps.evaluateCoinEligibility ?? evaluateAlfaClubRoomCoinEligibility
    for (const wallet of wallets) {
      const eligibility = await evaluate({ walletAddress: wallet, policy }).catch(() => null)
      if (eligibility?.canEnter || eligibility?.canStayActive) {
        return { allowed: true, reason: 'coin_equivalent', walletAddress: wallet }
      }
      if (eligibility?.reason === 'onchain_read_failed') {
        return { allowed: false, reason: 'check_failed', walletAddress: wallet }
      }
    }
  }

  return { allowed: false, reason: 'insufficient', walletAddress: wallets[0] ?? session }
}
