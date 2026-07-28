import {
  evaluateAlfaClubRoomCoinEligibility,
  readAlfaClubRoomAccessMembership,
  readAlfaClubRoomAccessPolicy,
} from './roomAccessPolicy.js'
import {
  expandFriendKeyCheckWallets,
  resolveRoomFriendKeyAccess,
  type RoomFriendKeyAccessDependencies,
} from './roomFriendKeyAccess.js'

export type RoomChatViewAccessReason =
  | 'anonymous'
  | 'no_wallet'
  | 'room_key'
  | 'staked_key'
  | 'membership'
  | 'coin_equivalent'
  | 'insufficient'
  | 'check_failed'

export type RoomChatWriteAccessReason =
  | 'anonymous'
  | 'no_wallet'
  | 'room_key'
  | 'staked_key'
  | 'insufficient'
  | 'check_failed'
  | 'friendkey_required'

export type RoomChatViewAccess = {
  allowed: boolean
  reason: RoomChatViewAccessReason
  walletAddress: `0x${string}` | null
  /** True only when the viewer holds or stakes a FriendKey for the room. */
  canWrite: boolean
}

export type RoomChatWriteAccess = {
  allowed: boolean
  reason: RoomChatWriteAccessReason
  walletAddress: `0x${string}` | null
}

const EVM_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/i

type RoomChatViewAccessDependencies = RoomFriendKeyAccessDependencies & {
  resolveWallets?: (sessionAddress: string) => Promise<`0x${string}`[]>
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

async function resolveViewerWallets(sessionAddress: string): Promise<`0x${string}`[]> {
  const session = normalizeAddress(sessionAddress)
  if (!session) return []
  // Include linked CSW + active owner so FriendKey on the owner EOA still writes.
  return expandFriendKeyCheckWallets(session)
}

function friendKeyDeps(
  deps: RoomChatViewAccessDependencies,
): RoomFriendKeyAccessDependencies {
  return {
    getPublicClient: deps.getPublicClient,
    readWalletKeyBalance: deps.readWalletKeyBalance,
    readWalletStakedKeys: deps.readWalletStakedKeys,
  }
}

/**
 * Chat text is visible when the viewer holds a room FriendKey (wallet or staked),
 * has an active/grace membership row, or meets the creator-coin buy-quote threshold.
 *
 * Write remains FriendKey-only via `resolveRoomChatWriteAccess` / `canWrite`.
 */
export async function resolveRoomChatViewAccess(params: {
  roomId: string
  sessionAddress?: string | null
  dependencies?: RoomChatViewAccessDependencies
}): Promise<RoomChatViewAccess> {
  const session = normalizeAddress(params.sessionAddress)
  if (!session) {
    return { allowed: false, reason: 'anonymous', walletAddress: null, canWrite: false }
  }

  const deps = params.dependencies ?? {}
  const wallets = await (deps.resolveWallets ?? resolveViewerWallets)(session)
  if (wallets.length === 0) {
    return { allowed: false, reason: 'no_wallet', walletAddress: null, canWrite: false }
  }

  const readPolicy = deps.readPolicy ?? readAlfaClubRoomAccessPolicy
  const policy = await readPolicy(params.roomId).catch(() => null)
  const tokenIdHint = policy?.tokenId ?? null

  const friendKey = await resolveRoomFriendKeyAccess({
    roomId: params.roomId,
    wallets,
    tokenIdHint,
    dependencies: friendKeyDeps(deps),
  })
  const canWrite = friendKey.allowed

  const readMembership = deps.readMembership ?? readAlfaClubRoomAccessMembership
  for (const wallet of wallets) {
    const membership = await readMembership({ roomId: params.roomId, walletAddress: wallet }).catch(
      () => null,
    )
    if (membership && (membership.status === 'active' || membership.status === 'grace')) {
      return { allowed: true, reason: 'membership', walletAddress: wallet, canWrite }
    }
  }

  if (friendKey.allowed && (friendKey.reason === 'room_key' || friendKey.reason === 'staked_key')) {
    return {
      allowed: true,
      reason: friendKey.reason,
      walletAddress: friendKey.walletAddress,
      canWrite: true,
    }
  }

  if (policy?.enabled) {
    const evaluate = deps.evaluateCoinEligibility ?? evaluateAlfaClubRoomCoinEligibility
    for (const wallet of wallets) {
      const eligibility = await evaluate({ walletAddress: wallet, policy }).catch(() => null)
      if (eligibility?.canEnter || eligibility?.canStayActive) {
        return { allowed: true, reason: 'coin_equivalent', walletAddress: wallet, canWrite }
      }
      if (eligibility?.reason === 'onchain_read_failed') {
        return { allowed: false, reason: 'check_failed', walletAddress: wallet, canWrite: false }
      }
    }
  }

  if (friendKey.reason === 'check_failed') {
    return {
      allowed: false,
      reason: 'check_failed',
      walletAddress: friendKey.walletAddress,
      canWrite: false,
    }
  }

  return {
    allowed: false,
    reason: 'insufficient',
    walletAddress: wallets[0] ?? session,
    canWrite: false,
  }
}

/**
 * Posting into room chat requires a live FriendKey hold or stake.
 * Creator-coin equivalence and coin-derived membership rows are read-only.
 */
export async function resolveRoomChatWriteAccess(params: {
  roomId: string
  sessionAddress?: string | null
  dependencies?: RoomChatViewAccessDependencies
}): Promise<RoomChatWriteAccess> {
  const session = normalizeAddress(params.sessionAddress)
  if (!session) {
    return { allowed: false, reason: 'anonymous', walletAddress: null }
  }

  const deps = params.dependencies ?? {}
  const wallets = await (deps.resolveWallets ?? resolveViewerWallets)(session)
  if (wallets.length === 0) {
    return { allowed: false, reason: 'no_wallet', walletAddress: null }
  }

  const readPolicy = deps.readPolicy ?? readAlfaClubRoomAccessPolicy
  const policy = await readPolicy(params.roomId).catch(() => null)

  const friendKey = await resolveRoomFriendKeyAccess({
    roomId: params.roomId,
    wallets,
    tokenIdHint: policy?.tokenId ?? null,
    dependencies: friendKeyDeps(deps),
  })

  if (friendKey.allowed && (friendKey.reason === 'room_key' || friendKey.reason === 'staked_key')) {
    return {
      allowed: true,
      reason: friendKey.reason,
      walletAddress: friendKey.walletAddress,
    }
  }

  if (friendKey.reason === 'check_failed') {
    return {
      allowed: false,
      reason: 'check_failed',
      walletAddress: friendKey.walletAddress,
    }
  }

  return {
    allowed: false,
    reason: 'friendkey_required',
    walletAddress: friendKey.walletAddress ?? wallets[0] ?? session,
  }
}
