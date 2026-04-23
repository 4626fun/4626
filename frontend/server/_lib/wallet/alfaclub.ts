/**
 * AlfaClub on-chain reader.
 *
 * AlfaClub (https://alfaclub.app) deploys three core contracts on Base,
 * sourced from https://github.com/FriendDotSpace/contracts:
 *
 *   FriendKey          — ERC-1155 UUPS proxy. Every "key" is a tokenId.
 *                        Each tokenId has a creator (public mapping).
 *   FriendStake beacon — Beacon proxy template for per-tokenId staking pools.
 *   FriendPool         — Custom bonding-curve reserve + cross-chain pool.
 *
 * This module exposes read-only helpers. It does NOT call alfaclub.app
 * APIs, mint sessions, or post to their chat — per their developer docs,
 * direct third-party API integration is not supported.
 *
 * Primary use case: `getAlfaClubHoldings(addr)` feeds the wallet labeler
 * so Keepr's `/labels` and `/intel` commands can flag keyholders/creators.
 */

import { type Abi, type Address, parseAbi } from 'viem'

declare const process: { env: Record<string, string | undefined> }

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const ALFACLUB = {
  friendKey: '0xAF0Bf8593dC6CA973DF2132731B0F9B5F974FA9F' as Address,
  friendStakeBeacon: '0x53BdEfB3E2faEB90b766B459AF96F3E357D3c3f9' as Address,
  friendPool: '0xa1bf9bb17C283CF17F01516f78f3127D2C84C79d' as Address,
  chainId: 8453,
} as const

/** Lowercased set of the three core AlfaClub contract addresses. */
export const ALFACLUB_CORE_ADDRESSES: ReadonlySet<string> = new Set([
  ALFACLUB.friendKey.toLowerCase(),
  ALFACLUB.friendStakeBeacon.toLowerCase(),
  ALFACLUB.friendPool.toLowerCase(),
])

export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as const

/**
 * Minimal FriendKey ABI. Captures only the view functions + events we read.
 * Full ABI lives in https://github.com/FriendDotSpace/contracts.
 */
export const FRIEND_KEY_ABI = parseAbi([
  'function balanceOf(address account, uint256 id) view returns (uint256)',
  'function balanceOfBatch(address[] accounts, uint256[] ids) view returns (uint256[])',
  'function creatorByTokenId(uint256 tokenId) view returns (address)',
  'function stakingPoolByTokenId(uint256 tokenId) view returns (address)',
  'function totalSupply(uint256 id) view returns (uint256)',
  'function exists(uint256 id) view returns (bool)',
  'function getBuyPriceAfterFee(uint256 id, uint256 amount) view returns (uint256)',
  'function bondingToken() view returns (address)',
  'function buyShares(uint256 tokenId, uint256 amount, uint256 maxSpend)',
  'function canRegisterRoom(address creator, uint8 roomType, uint8 tier) view returns (bool)',
  'function registerCreator(uint8 tier, uint256 additionalKeys, string metadata, bytes signature) returns (uint256)',
  'function registerSocialCreator(uint8 tier, uint256 additionalKeys, string metadata, bytes signature) returns (uint256)',
  'event TransferSingle(address indexed operator, address indexed from, address indexed to, uint256 id, uint256 value)',
  'event TransferBatch(address indexed operator, address indexed from, address indexed to, uint256[] ids, uint256[] values)',
])

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AlfaClubHolding = {
  /** FriendKey tokenId (one per room/creator). */
  tokenId: bigint
  /** Current ERC-1155 balance of the queried address for this tokenId. */
  balance: bigint
  /** Creator address resolved via creatorByTokenId(tokenId). */
  creator: Address
}

export type AlfaClubHoldingsResult = {
  address: Address
  holdings: AlfaClubHolding[]
  /** True if the queried address is the creator of at least one held key. */
  isCreator: boolean
  /** True if the queried address holds any AlfaClub keys at all. */
  isHolder: boolean
}

/** Narrow viem-like interface so call sites can inject mock clients in tests. */
export type AlfaClubPublicClientLike = {
  getLogs: (args: unknown) => Promise<ReadonlyArray<unknown>>
  readContract: (args: unknown) => Promise<unknown>
  multicall?: (args: unknown) => Promise<ReadonlyArray<unknown>>
}

type TransferSingleLog = {
  args?: { from?: Address; to?: Address; id?: bigint; value?: bigint }
}
type TransferBatchLog = {
  args?: { from?: Address; to?: Address; ids?: readonly bigint[]; values?: readonly bigint[] }
}

// ---------------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------------

/**
 * Default lower bound for event scanning. FriendKey went live on Base
 * well after block 20M, so this is a safe floor that skips pre-deploy
 * history entirely. Callers can override via options.
 */
const DEFAULT_FROM_BLOCK = 20_000_000n

/** Cap per getLogs call; public Base RPCs typically refuse > ~10k blocks. */
const DEFAULT_BLOCK_CHUNK = 9_900n

/** Max tokenIds we'll resolve via creatorByTokenId in one call. */
const MAX_TOKEN_IDS_RESOLVED = 128

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizeAddress(value: string): string {
  return value.toLowerCase()
}

function dedupeTokenIds(ids: Iterable<bigint>): bigint[] {
  const seen = new Set<string>()
  const out: bigint[] = []
  for (const id of ids) {
    const key = id.toString()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(id)
  }
  return out
}

// ---------------------------------------------------------------------------
// Event scanning
// ---------------------------------------------------------------------------

/**
 * Return the set of distinct FriendKey tokenIds an address has ever received.
 *
 * Uses TransferSingle + TransferBatch logs filtered by `to = address`.
 * Does not guarantee current balance > 0; caller must filter with balanceOf.
 */
export async function scanAddressTransferredTokenIds(
  address: Address,
  client: AlfaClubPublicClientLike,
  opts?: { fromBlock?: bigint; toBlock?: bigint | 'latest'; blockChunk?: bigint },
): Promise<bigint[]> {
  const fromBlock = opts?.fromBlock ?? DEFAULT_FROM_BLOCK
  const toBlock = opts?.toBlock ?? 'latest'
  const chunk = opts?.blockChunk ?? DEFAULT_BLOCK_CHUNK

  // If the caller allows "latest" we issue a single call — the RPC
  // handles its own ceiling. For pinned ranges we chunk to stay under
  // public-RPC log caps.
  const ranges: Array<{ fromBlock: bigint; toBlock: bigint | 'latest' }> =
    toBlock === 'latest'
      ? [{ fromBlock, toBlock: 'latest' }]
      : (() => {
          const out: Array<{ fromBlock: bigint; toBlock: bigint | 'latest' }> = []
          for (let start = fromBlock; start <= toBlock; start += chunk + 1n) {
            const end = start + chunk > toBlock ? toBlock : start + chunk
            out.push({ fromBlock: start, toBlock: end })
          }
          return out
        })()

  const seen = new Set<string>()

  for (const r of ranges) {
    const singleLogs = (await client.getLogs({
      address: ALFACLUB.friendKey,
      event: FRIEND_KEY_ABI.find(
        (x: Abi[number]) => x.type === 'event' && x.name === 'TransferSingle',
      ),
      args: { to: address },
      fromBlock: r.fromBlock,
      toBlock: r.toBlock,
    })) as ReadonlyArray<TransferSingleLog>

    for (const log of singleLogs) {
      const id = log.args?.id
      if (typeof id === 'bigint') seen.add(id.toString())
    }

    const batchLogs = (await client.getLogs({
      address: ALFACLUB.friendKey,
      event: FRIEND_KEY_ABI.find(
        (x: Abi[number]) => x.type === 'event' && x.name === 'TransferBatch',
      ),
      args: { to: address },
      fromBlock: r.fromBlock,
      toBlock: r.toBlock,
    })) as ReadonlyArray<TransferBatchLog>

    for (const log of batchLogs) {
      const ids = log.args?.ids
      if (Array.isArray(ids)) {
        for (const id of ids) {
          if (typeof id === 'bigint') seen.add(id.toString())
        }
      }
    }
  }

  return Array.from(seen, (s) => BigInt(s))
}

// ---------------------------------------------------------------------------
// Public reads
// ---------------------------------------------------------------------------

/**
 * Resolve current AlfaClub FriendKey holdings for `address`.
 *
 * Algorithm:
 *   1. Scan TransferSingle/TransferBatch logs (to=address) for candidate tokenIds.
 *   2. Read current balanceOf(address, tokenId) for each candidate, in parallel.
 *   3. Drop zero balances.
 *   4. Resolve creatorByTokenId(tokenId) for the surviving set.
 *
 * Returns an empty result on any RPC error (fail-open; labeling is optional).
 */
export async function getAlfaClubHoldings(
  address: Address,
  client: AlfaClubPublicClientLike,
  opts?: { fromBlock?: bigint; toBlock?: bigint | 'latest' },
): Promise<AlfaClubHoldingsResult> {
  const normalized = normalizeAddress(address) as Address
  const empty: AlfaClubHoldingsResult = {
    address: normalized,
    holdings: [],
    isCreator: false,
    isHolder: false,
  }

  let candidates: bigint[]
  try {
    const scanned = await scanAddressTransferredTokenIds(address, client, opts)
    candidates = dedupeTokenIds(scanned).slice(0, MAX_TOKEN_IDS_RESOLVED)
  } catch {
    return empty
  }

  if (candidates.length === 0) return empty

  let balances: bigint[]
  try {
    balances = await Promise.all(
      candidates.map((id) =>
        client.readContract({
          address: ALFACLUB.friendKey,
          abi: FRIEND_KEY_ABI,
          functionName: 'balanceOf',
          args: [address, id],
        }) as Promise<bigint>,
      ),
    )
  } catch {
    return empty
  }

  const held: Array<{ tokenId: bigint; balance: bigint }> = []
  for (let i = 0; i < candidates.length; i += 1) {
    const id = candidates[i]
    const bal = balances[i]
    if (typeof id !== 'bigint' || typeof bal !== 'bigint') continue
    if (bal > 0n) held.push({ tokenId: id, balance: bal })
  }
  if (held.length === 0) return empty

  let creators: Address[]
  try {
    creators = await Promise.all(
      held.map(({ tokenId }) =>
        client.readContract({
          address: ALFACLUB.friendKey,
          abi: FRIEND_KEY_ABI,
          functionName: 'creatorByTokenId',
          args: [tokenId],
        }) as Promise<Address>,
      ),
    )
  } catch {
    return empty
  }

  const holdings: AlfaClubHolding[] = []
  for (let i = 0; i < held.length; i += 1) {
    const entry = held[i]
    const creator = creators[i]
    if (!entry || !creator) continue
    if (normalizeAddress(creator) === normalizeAddress(ZERO_ADDRESS)) continue
    holdings.push({ tokenId: entry.tokenId, balance: entry.balance, creator })
  }
  if (holdings.length === 0) return empty

  const isCreator = holdings.some(
    (h) => normalizeAddress(h.creator) === normalizeAddress(address),
  )

  return {
    address: normalized,
    holdings,
    isCreator,
    isHolder: true,
  }
}

/**
 * Reverse lookup: find the FriendKey tokenId a creator initially received.
 *
 * AlfaClub mints the first share of a new room to the creator (TransferSingle
 * with from=0x0, to=creator). We grab the earliest such log and return its id.
 *
 * Returns null if no mint event is found for the address.
 */
export async function getAlfaClubCreatorTokenId(
  creator: Address,
  client: AlfaClubPublicClientLike,
  opts?: { fromBlock?: bigint; toBlock?: bigint | 'latest' },
): Promise<bigint | null> {
  try {
    const logs = (await client.getLogs({
      address: ALFACLUB.friendKey,
      event: FRIEND_KEY_ABI.find(
        (x: Abi[number]) => x.type === 'event' && x.name === 'TransferSingle',
      ),
      args: { from: ZERO_ADDRESS as Address, to: creator },
      fromBlock: opts?.fromBlock ?? DEFAULT_FROM_BLOCK,
      toBlock: opts?.toBlock ?? 'latest',
    })) as ReadonlyArray<TransferSingleLog>

    for (const log of logs) {
      const id = log.args?.id
      if (typeof id === 'bigint') return id
    }
    return null
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Shared client factory (lazy; avoids pulling viem into cold paths)
// ---------------------------------------------------------------------------

let cachedClient: AlfaClubPublicClientLike | null = null

/**
 * Build (or reuse) a viem PublicClient pinned to Base for AlfaClub reads.
 * Resolution order: BASE_LOGS_RPC_URL > BASE_RPC_URL > public.
 */
export async function getAlfaClubPublicClient(): Promise<AlfaClubPublicClientLike> {
  if (cachedClient) return cachedClient
  const { createPublicClient, http } = await import('viem')
  const { base } = await import('viem/chains')
  const rpcUrl =
    (process.env.BASE_LOGS_RPC_URL ?? '').trim() ||
    (process.env.BASE_RPC_URL ?? '').trim() ||
    'https://mainnet.base.org'
  cachedClient = createPublicClient({
    chain: base,
    transport: http(rpcUrl),
  }) as unknown as AlfaClubPublicClientLike
  return cachedClient
}

/** Reset the cached client. Exposed for tests. */
export function _resetAlfaClubPublicClientForTests(): void {
  cachedClient = null
}
