import type { Address, Hex } from 'viem'
import { decodeAbiParameters, encodeAbiParameters, getAddress, isAddress } from 'viem'
import { getProductionBaseReadClient } from '@/lib/base/productionBaseReadClient'
import {
  clearPersistedCswOwnerIndex,
  readPersistedCswOwnerIndex,
  writePersistedCswOwnerIndex,
} from './cswOwnerIndexPersistence'
import { isRpcRateLimitError } from './coinbaseErc4337ErrorUtils'

const RPC_READ_TIMEOUT_MS = 20_000
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

function isRetryableRpcReadError(error: unknown): boolean {
  if (isRpcRateLimitError(error)) return true
  const msg = String(error instanceof Error ? error.message : error).toLowerCase()
  return msg.includes('timed out') || msg.includes('timeout')
}

export function resolveOwnersReadClient(publicClient: OwnersPublicClientLike): OwnersPublicClientLike {
  const chainId = Number((publicClient as any)?.chain?.id ?? 0)
  if (chainId === 8453 && typeof window !== 'undefined') {
    return getProductionBaseReadClient() as OwnersPublicClientLike
  }
  return publicClient
}

export async function readContractWithRpcRetry<T>(
  label: string,
  read: () => Promise<T>,
  maxAttempts = 3,
): Promise<T> {
  let lastError: unknown = null
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      return await withTimeout(read(), RPC_READ_TIMEOUT_MS, label)
    } catch (error: unknown) {
      lastError = error
      if (!isRetryableRpcReadError(error) || attempt >= maxAttempts - 1) throw error
      await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)))
    }
  }
  throw lastError ?? new Error(`${label} failed`)
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
  const readClient = resolveOwnersReadClient(publicClient)
  const cacheKey = getOwnerIndexCacheKey({ chainId, smartWallet, ownerAddress })
  if (!useCache) OWNER_INDEX_CACHE.delete(cacheKey)

  const scanLimit = Math.max(1, maxScan)
  const expected = asOwnerBytes(ownerAddress).toLowerCase()

  async function verifyOwnerAtIndex(index: number): Promise<boolean> {
    const atIndex = (await readContractWithRpcRetry(`ownerAtIndex(${index}) verify`, () =>
      readClient.readContract({
        address: smartWallet,
        abi: COINBASE_SMART_WALLET_OWNERS_ABI,
        functionName: 'ownerAtIndex',
        args: [BigInt(index)],
      }),
    )) as Hex
    return String(atIndex).toLowerCase() === expected
  }

  if (useCache) {
    const cached = OWNER_INDEX_CACHE.get(cacheKey)
    if (cached && cached.expiresAt > Date.now() && cached.ownerIndex >= 0 && cached.ownerIndex < scanLimit) {
      try {
        if (await verifyOwnerAtIndex(cached.ownerIndex)) {
          return { ownerIndex: cached.ownerIndex, ownerCount: cached.ownerCountSnapshot }
        }
      } catch {
        // fall through to persisted / full scan
      }
      OWNER_INDEX_CACHE.delete(cacheKey)
    }

    const persisted = readPersistedCswOwnerIndex({ chainId, smartWallet, ownerAddress })
    if (persisted && persisted.ownerIndex >= 0 && persisted.ownerIndex < scanLimit) {
      try {
        if (await verifyOwnerAtIndex(persisted.ownerIndex)) {
          OWNER_INDEX_CACHE.set(cacheKey, {
            ownerIndex: persisted.ownerIndex,
            ownerCountSnapshot: persisted.ownerCountSnapshot,
            expiresAt: Date.now() + OWNER_INDEX_CACHE_TTL_MS,
          })
          return { ownerIndex: persisted.ownerIndex, ownerCount: persisted.ownerCountSnapshot }
        }
        clearPersistedCswOwnerIndex({ chainId, smartWallet, ownerAddress })
      } catch {
        clearPersistedCswOwnerIndex({ chainId, smartWallet, ownerAddress })
      }
    }
  }

  const countRaw = (await readContractWithRpcRetry('ownerCount read', () =>
    readClient.readContract({
      address: smartWallet,
      abi: COINBASE_SMART_WALLET_OWNERS_ABI,
      functionName: 'ownerCount',
    }),
  )) as bigint
  const count = Number(countRaw)
  if (!Number.isFinite(count) || count <= 0) {
    OWNER_INDEX_CACHE.delete(cacheKey)
    return { ownerIndex: null, ownerCount: 0 }
  }

  // Use nextOwnerIndex when available to avoid missing owners after removals.
  let upperBound = count
  try {
    const nextRaw = (await readContractWithRpcRetry('nextOwnerIndex read', () =>
      readClient.readContract({
        address: smartWallet,
        abi: COINBASE_SMART_WALLET_OWNERS_ABI,
        functionName: 'nextOwnerIndex',
      }),
    )) as bigint
    const next = Number(nextRaw)
    if (Number.isFinite(next) && next > 0) upperBound = next
  } catch {
    // ignore; fallback to ownerCount
  }

  const limit = Math.min(upperBound, scanLimit)
  for (let i = 0; i < limit; i += 1) {
    const b = (await readContractWithRpcRetry(`ownerAtIndex(${i}) read`, () =>
      readClient.readContract({
        address: smartWallet,
        abi: COINBASE_SMART_WALLET_OWNERS_ABI,
        functionName: 'ownerAtIndex',
        args: [BigInt(i)],
      }),
    )) as Hex
    if (String(b).toLowerCase() === expected) {
      if (useCache) {
        OWNER_INDEX_CACHE.set(cacheKey, {
          ownerIndex: i,
          ownerCountSnapshot: count,
          expiresAt: Date.now() + OWNER_INDEX_CACHE_TTL_MS,
        })
        writePersistedCswOwnerIndex({
          chainId,
          smartWallet,
          ownerAddress,
          ownerIndex: i,
          ownerCountSnapshot: count,
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
  const readClient = resolveOwnersReadClient(publicClient)
  const countRaw = (await readClient.readContract({
    address: smartWallet,
    abi: COINBASE_SMART_WALLET_OWNERS_ABI,
    functionName: 'ownerCount',
  })) as bigint
  const count = Number(countRaw)
  if (!Number.isFinite(count) || count <= 0) return []

  let upperBound = count
  try {
    const nextRaw = (await readClient.readContract({
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
      const raw = (await readClient.readContract({
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
