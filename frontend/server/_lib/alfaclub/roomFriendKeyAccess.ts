import type { Address } from 'viem'

import {
  ALFACLUB,
  FRIEND_KEY_ABI,
  getAlfaClubPublicClient,
  type AlfaClubPublicClientLike,
} from '../wallet/alfaclub.js'
import { resolveAuthorizedWalletProfile } from '../wallet/canonicalWalletResolver.js'
import { readUserStakedKeysFromStorage } from './alfaclubStakeReads.js'

export type RoomFriendKeyAccessReason =
  | 'anonymous'
  | 'no_wallet'
  | 'room_key'
  | 'staked_key'
  | 'insufficient'
  | 'check_failed'

export type RoomFriendKeyAccess = {
  allowed: boolean
  reason: RoomFriendKeyAccessReason
  walletAddress: `0x${string}` | null
}

const EVM_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/i

export type RoomFriendKeyAccessDependencies = {
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
}

function normalizeAddress(value: unknown): `0x${string}` | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim().toLowerCase()
  if (!EVM_ADDRESS_RE.test(trimmed)) return null
  return trimmed as `0x${string}`
}

export function parseRoomFriendKeyTokenId(
  roomId: string,
  policyTokenId?: string | null,
): bigint | null {
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

async function readStakingPoolForFriendKeyCheck(
  client: AlfaClubPublicClientLike,
  tokenId: bigint,
): Promise<{ status: 'none' } | { status: 'ok'; pool: Address } | { status: 'failed' }> {
  try {
    const pool = (await client.readContract({
      address: ALFACLUB.friendKey,
      abi: FRIEND_KEY_ABI,
      functionName: 'stakingPoolByTokenId',
      args: [tokenId],
    })) as Address
    const normalized = String(pool ?? '').toLowerCase()
    if (!normalized || normalized === '0x0000000000000000000000000000000000000000') {
      return { status: 'none' }
    }
    return { status: 'ok', pool: normalized as Address }
  } catch {
    return { status: 'failed' }
  }
}

async function readStakedKeysFast(params: {
  client: AlfaClubPublicClientLike
  wallet: Address
  tokenId: bigint
}): Promise<number | null> {
  const resolved = await readStakingPoolForFriendKeyCheck(params.client, params.tokenId)
  if (resolved.status === 'failed') return null
  // No pool means stake is conclusively impossible for this room key.
  if (resolved.status === 'none') return 0
  const staked = await readUserStakedKeysFromStorage(params.client, resolved.pool, params.wallet)
  if (staked == null) return null
  if (staked > BigInt(Number.MAX_SAFE_INTEGER)) return Number.MAX_SAFE_INTEGER
  return Number(staked)
}

/**
 * Live FriendKey hold/stake check for a set of wallets (no coin-equivalence path).
 * Used for write gating and XMTP membership sync.
 */
export async function resolveRoomFriendKeyAccess(params: {
  roomId: string
  wallets: `0x${string}`[]
  tokenIdHint?: string | null
  dependencies?: RoomFriendKeyAccessDependencies
}): Promise<RoomFriendKeyAccess> {
  const wallets = params.wallets
    .map((wallet) => normalizeAddress(wallet))
    .filter((wallet): wallet is `0x${string}` => Boolean(wallet))
  if (wallets.length === 0) {
    return { allowed: false, reason: 'no_wallet', walletAddress: null }
  }

  const tokenId = parseRoomFriendKeyTokenId(params.roomId, params.tokenIdHint ?? null)
  if (tokenId == null) {
    return { allowed: false, reason: 'insufficient', walletAddress: wallets[0] ?? null }
  }

  const deps = params.dependencies ?? {}
  try {
    const client = await (deps.getPublicClient ?? getAlfaClubPublicClient)()
    const readBalance = deps.readWalletKeyBalance ?? readFriendKeyBalance
    const readStaked = deps.readWalletStakedKeys ?? readStakedKeysFast

    // Confirmed absence requires both hold and stake to be conclusive zeros
    // for every wallet. A partial RPC miss must not evict staked-only writers.
    let allWalletsConfirmedAbsent = true

    for (const wallet of wallets) {
      const held = await readBalance({ client, wallet, tokenId })
      if (held != null && held > 0n) {
        return { allowed: true, reason: 'room_key', walletAddress: wallet }
      }

      const staked = await readStaked({ client, wallet, tokenId })
      if (staked != null && staked > 0) {
        return { allowed: true, reason: 'staked_key', walletAddress: wallet }
      }

      if (held == null || staked == null) {
        allWalletsConfirmedAbsent = false
      }
    }

    if (!allWalletsConfirmedAbsent) {
      return { allowed: false, reason: 'check_failed', walletAddress: wallets[0] ?? null }
    }
  } catch {
    return { allowed: false, reason: 'check_failed', walletAddress: wallets[0] ?? null }
  }

  return { allowed: false, reason: 'insufficient', walletAddress: wallets[0] ?? null }
}

/**
 * Expand a membership/sender wallet to the linked CSW + active owner set so
 * FriendKey checks do not miss keys held on a related profile address.
 */
export async function expandFriendKeyCheckWallets(
  walletAddress: `0x${string}`,
): Promise<`0x${string}`[]> {
  const wallets = new Set<`0x${string}`>()
  const primary = normalizeAddress(walletAddress)
  if (primary) wallets.add(primary)
  try {
    const authority = await resolveAuthorizedWalletProfile(walletAddress)
    const canonical = normalizeAddress(authority?.canonicalSmartWalletAddress)
    if (canonical) wallets.add(canonical)
    const owner = normalizeAddress(authority?.activeOwnerWalletAddress)
    if (owner) wallets.add(owner)
  } catch {
    // Membership/sender wallet alone is enough for a best-effort check.
  }
  return [...wallets]
}

export async function walletHoldsOrStakesRoomFriendKey(params: {
  roomId: string
  walletAddress: `0x${string}`
  tokenIdHint?: string | null
  dependencies?: RoomFriendKeyAccessDependencies
}): Promise<boolean> {
  const wallet = normalizeAddress(params.walletAddress)
  if (!wallet) return false
  const wallets = await expandFriendKeyCheckWallets(wallet)
  const access = await resolveRoomFriendKeyAccess({
    roomId: params.roomId,
    wallets,
    tokenIdHint: params.tokenIdHint,
    dependencies: params.dependencies,
  })
  return access.allowed
}
