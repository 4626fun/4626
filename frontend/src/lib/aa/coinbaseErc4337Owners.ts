import type { Address, Hex } from 'viem'
import { decodeAbiParameters, encodeAbiParameters, getAddress, isAddress } from 'viem'

const RPC_READ_TIMEOUT_MS = 8_000
const OWNER_INDEX_CACHE_TTL_MS = 5 * 60_000
const ZERO_ADDRESS = getAddress('0x0000000000000000000000000000000000000000')

const COINBASE_SMART_WALLET_OWNERS_ABI = [
  {
    type: 'function',
    name: 'ownerCount',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'ownerAtIndex',
    stateMutability: 'view',
    inputs: [{ name: 'index', type: 'uint256' }],
    outputs: [{ type: 'bytes' }],
  },
  {
    type: 'function',
    name: 'nextOwnerIndex',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
] as const

export type OwnersPublicClientLike = {
  chain?: { id: number }
  readContract: (args: any) => Promise<any>
} & Record<string, any>

type OwnerIndexCacheEntry = {
  ownerIndex: number
  ownerCountSnapshot: number
  expiresAt: number
}

const OWNER_INDEX_CACHE = new Map<string, OwnerIndexCacheEntry>()

function getOwnerIndexCacheKey(params: {
  chainId: number
  smartWallet: Address
  ownerAddress: Address
}): string {
  return `${params.chainId}:${params.smartWallet.toLowerCase()}:${params.ownerAddress.toLowerCase()}`
}

function asOwnerBytes(owner: Address): Hex {
  // Coinbase Smart Wallet stores EOA owners as 32-byte left-padded address bytes.
  return encodeAbiParameters([{ type: 'address' }], [owner]) as Hex
}

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${Math.round(ms / 1000)}s`))
    }, ms)
  })
  try {
    return await Promise.race([promise, timeout])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

export function resetOwnerIndexCacheForTests(): void {
  OWNER_INDEX_CACHE.clear()
}

export async function findCoinbaseSmartWalletOwnerIndex(params: {
  publicClient: OwnersPublicClientLike
  smartWallet: Address
  ownerAddress: Address
  maxScan?: number
  useCache?: boolean
}): Promise<{ ownerIndex: number | null; ownerCount: number }> {
  const { publicClient, smartWallet, ownerAddress, maxScan = 256, useCache = true } = params
  const chainId = Number((publicClient as any)?.chain?.id ?? 0)
  const cacheKey = getOwnerIndexCacheKey({ chainId, smartWallet, ownerAddress })
  if (!useCache) OWNER_INDEX_CACHE.delete(cacheKey)

  const countRaw = (await withTimeout(
    publicClient.readContract({
      address: smartWallet,
      abi: COINBASE_SMART_WALLET_OWNERS_ABI,
      functionName: 'ownerCount',
    }),
    RPC_READ_TIMEOUT_MS,
    'ownerCount read',
  )) as bigint
  const count = Number(countRaw)
  if (!Number.isFinite(count) || count <= 0) {
    OWNER_INDEX_CACHE.delete(cacheKey)
    return { ownerIndex: null, ownerCount: 0 }
  }

  const scanLimit = Math.max(1, maxScan)
  if (useCache) {
    const cached = OWNER_INDEX_CACHE.get(cacheKey)
    if (cached && cached.expiresAt > Date.now()) {
      if (cached.ownerCountSnapshot === count && cached.ownerIndex >= 0 && cached.ownerIndex < scanLimit) {
        return { ownerIndex: cached.ownerIndex, ownerCount: count }
      }
      OWNER_INDEX_CACHE.delete(cacheKey)
    }
  }

  // Use nextOwnerIndex when available to avoid missing owners after removals.
  let upperBound = count
  try {
    const nextRaw = (await withTimeout(
      publicClient.readContract({
        address: smartWallet,
        abi: COINBASE_SMART_WALLET_OWNERS_ABI,
        functionName: 'nextOwnerIndex',
      }),
      RPC_READ_TIMEOUT_MS,
      'nextOwnerIndex read',
    )) as bigint
    const next = Number(nextRaw)
    if (Number.isFinite(next) && next > 0) upperBound = next
  } catch {
    // ignore; fallback to ownerCount
  }

  const expected = asOwnerBytes(ownerAddress).toLowerCase()
  const limit = Math.min(upperBound, scanLimit)
  for (let i = 0; i < limit; i += 1) {
    const b = (await withTimeout(
      publicClient.readContract({
        address: smartWallet,
        abi: COINBASE_SMART_WALLET_OWNERS_ABI,
        functionName: 'ownerAtIndex',
        args: [BigInt(i)],
      }),
      RPC_READ_TIMEOUT_MS,
      `ownerAtIndex(${i}) read`,
    )) as Hex
    if (String(b).toLowerCase() === expected) {
      if (useCache) {
        OWNER_INDEX_CACHE.set(cacheKey, {
          ownerIndex: i,
          ownerCountSnapshot: count,
          expiresAt: Date.now() + OWNER_INDEX_CACHE_TTL_MS,
        })
      }
      return { ownerIndex: i, ownerCount: count }
    }
  }
  OWNER_INDEX_CACHE.delete(cacheKey)
  return { ownerIndex: null, ownerCount: count }
}

export async function fetchCoinbaseSmartWalletOwners(params: {
  publicClient: OwnersPublicClientLike
  smartWallet: Address
  maxOwners?: number
}): Promise<Address[]> {
  const { publicClient, smartWallet, maxOwners = 32 } = params
  const countRaw = (await publicClient.readContract({
    address: smartWallet,
    abi: COINBASE_SMART_WALLET_OWNERS_ABI,
    functionName: 'ownerCount',
  })) as bigint
  const count = Number(countRaw)
  if (!Number.isFinite(count) || count <= 0) return []

  let upperBound = count
  try {
    const nextRaw = (await publicClient.readContract({
      address: smartWallet,
      abi: COINBASE_SMART_WALLET_OWNERS_ABI,
      functionName: 'nextOwnerIndex',
    })) as bigint
    const next = Number(nextRaw)
    if (Number.isFinite(next) && next > 0) upperBound = next
  } catch {
    // ignore; fallback to ownerCount
  }

  const limit = Math.min(upperBound, Math.max(1, maxOwners))
  const owners: Address[] = []
  for (let i = 0; i < limit; i += 1) {
    try {
      const raw = (await publicClient.readContract({
        address: smartWallet,
        abi: COINBASE_SMART_WALLET_OWNERS_ABI,
        functionName: 'ownerAtIndex',
        args: [BigInt(i)],
      })) as `0x${string}`
      const decoded = decodeAbiParameters([{ type: 'address' }], raw)[0] as string
      if (!isAddress(decoded)) continue
      const addr = getAddress(decoded)
      if (addr === ZERO_ADDRESS) continue
      if (!owners.includes(addr)) owners.push(addr)
    } catch {
      continue
    }
  }
  return owners
}
