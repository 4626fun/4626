import { getAlfaClubHoldings, getAlfaClubPublicClient } from '../wallet/alfaclub.js'

declare const process: { env: Record<string, string | undefined> }

function isAddressLike(value: string): value is `0x${string}` {
  return /^0x[a-fA-F0-9]{40}$/.test(value)
}

function asTrimmed(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

export function getHermitOwnerAddress(): `0x${string}` | null {
  const value = asTrimmed(process.env.HERMIT_OWNER_ADDRESS).toLowerCase()
  return isAddressLike(value) ? (value as `0x${string}`) : null
}

export function isHermitOwner(address: string): boolean {
  const owner = getHermitOwnerAddress()
  if (!owner) return false
  return address.trim().toLowerCase() === owner
}

export function readHermitAllowedRoomIds(): Set<string> {
  const raw = asTrimmed(process.env.HERMIT_ALLOWED_ROOM_IDS)
  if (!raw) return new Set<string>()
  return new Set(
    raw
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean),
  )
}

export function isHermitRoomAllowed(roomId: string): boolean {
  const room = roomId.trim()
  if (!room) return false
  const allowlist = readHermitAllowedRoomIds()
  if (allowlist.size === 0) return true
  return allowlist.has(room)
}

type OwnerRoomCacheEntry = {
  expiresAtMs: number
  tokenIds: Set<string>
}

const OWNER_ROOM_CACHE_TTL_MS = 60_000
const ownerRoomCache = new Map<string, OwnerRoomCacheEntry>()

async function readOwnerRoomTokenIds(ownerAddress: `0x${string}`): Promise<Set<string>> {
  const cacheKey = ownerAddress.toLowerCase()
  const cached = ownerRoomCache.get(cacheKey)
  if (cached && cached.expiresAtMs > Date.now()) return cached.tokenIds

  try {
    const client = await getAlfaClubPublicClient()
    const holdings = await getAlfaClubHoldings(ownerAddress, client)
    const tokenIds = new Set(holdings.holdings.map((entry) => entry.tokenId.toString()))
    ownerRoomCache.set(cacheKey, {
      expiresAtMs: Date.now() + OWNER_ROOM_CACHE_TTL_MS,
      tokenIds,
    })
    return tokenIds
  } catch {
    return new Set<string>()
  }
}

export async function isHermitRoomAllowedForOwner(params: {
  roomId: string
  ownerAddress: string
}): Promise<boolean> {
  const room = params.roomId.trim()
  if (!room) return false

  // Explicit allowlist takes priority when configured.
  const explicitAllowlist = readHermitAllowedRoomIds()
  if (explicitAllowlist.size > 0) return explicitAllowlist.has(room)

  const owner = params.ownerAddress.trim().toLowerCase()
  if (!isAddressLike(owner)) return false
  if (!/^\d+$/.test(room)) return false

  const tokenIds = await readOwnerRoomTokenIds(owner as `0x${string}`)
  return tokenIds.has(room)
}

export function _resetHermitRoomOwnerCacheForTests(): void {
  ownerRoomCache.clear()
}

export function resolveHermitGatewayUrl(cid: string): string | null {
  const trimmedCid = cid.trim()
  if (!trimmedCid) return null
  const base = asTrimmed(process.env.HERMIT_PINATA_GATEWAY_BASE)
  if (!base) return null
  return `${base.replace(/\/+$/, '')}/ipfs/${trimmedCid}`
}
