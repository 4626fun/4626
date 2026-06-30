import {
  type Abi,
  type Address,
  encodeAbiParameters,
  keccak256,
  parseAbi,
  parseAbiParameters,
} from 'viem'

import {
  ALFACLUB,
  FRIEND_KEY_ABI,
  type AlfaClubPublicClientLike,
} from '../wallet/alfaclub.js'
import { getAlfaClubDeployBlock } from './creators.js'

export const FRIEND_STAKE_ABI = parseAbi([
  'event KeyStaked(address indexed user, uint256 tokenId, uint256 amount)',
  'event KeyUnstaked(address indexed user, uint256 tokenId, uint256 amount)',
  'function totalStaked() view returns (uint256)',
  'function tokenId() view returns (uint256)',
])

/**
 * FriendStake storage layout (FriendDotSpace/contracts FriendStake.sol):
 * IterableMapping.Map `stakedBalances` starts at slot 15; its `values` mapping at slot 16.
 * Each user maps to a dynamic Stake[] array { amount, timestamp }.
 */
const FRIEND_STAKE_STAKED_VALUES_MAP_SLOT = 16n
/** IterableMapping.MAX_STAKE_ENTRIES_PER_USER */
const MAX_STAKE_ENTRIES_PER_USER = 100n

const DEFAULT_BLOCK_CHUNK = 9_900n
/** Max getLogs windows per single scan window. */
const MAX_STAKE_LOG_CHUNKS = 256
/** Blocks covered from mint (covers Flip-style early stake/unstake history). */
const EARLY_HISTORY_CHUNKS = 200
/** Recent tail when room is older than early window. */
const RECENT_TAIL_CHUNKS = 64
/** When mint block is known, scan this span from mint (covers stake/unstake after launch). */
const MINT_ANCHORED_SPAN = 2_500_000n
const CHUNK_CONCURRENCY = 2
const CHUNK_RETRY_ATTEMPTS = 4
const SEQUENTIAL_RETRY_ATTEMPTS = 6

async function mapChunkBatches<T, R>(
  items: readonly T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = []
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency)
    out.push(...(await Promise.all(batch.map(fn))))
  }
  return out
}

type StakeEventLog = {
  args?: { user?: Address; tokenId?: bigint; amount?: bigint }
}

type TransferSingleLog = {
  args?: { from?: Address; to?: Address; id?: bigint; value?: bigint }
}

type BlockRange = { fromBlock: bigint; toBlock: bigint | 'latest' }

function buildScanWindows(fromBlock: bigint, toBlock: bigint, mintAnchored = false): BlockRange[] {
  if (mintAnchored) {
    const end = fromBlock + MINT_ANCHORED_SPAN < toBlock ? fromBlock + MINT_ANCHORED_SPAN : toBlock
    return [{ fromBlock, toBlock: end }]
  }

  const span = DEFAULT_BLOCK_CHUNK + 1n
  const earlyEnd = fromBlock + span * BigInt(EARLY_HISTORY_CHUNKS)
  const windows: BlockRange[] = [{ fromBlock, toBlock: earlyEnd < toBlock ? earlyEnd : toBlock }]

  const recentStart =
    toBlock > span * BigInt(RECENT_TAIL_CHUNKS) ? toBlock - span * BigInt(RECENT_TAIL_CHUNKS) : fromBlock
  const firstEnd = windows[0]!.toBlock as bigint
  if (recentStart > firstEnd + 1n) {
    windows.push({ fromBlock: recentStart, toBlock })
  }

  return windows
}

function buildBlockRanges(
  fromBlock: bigint,
  toBlock: bigint | 'latest',
  chunk: bigint,
): BlockRange[] {
  if (toBlock === 'latest') return [{ fromBlock, toBlock: 'latest' }]
  const out: BlockRange[] = []
  for (let start = fromBlock; start <= toBlock; start += chunk + 1n) {
    const end = start + chunk > toBlock ? toBlock : start + chunk
    out.push({ fromBlock: start, toBlock: end })
  }
  return out
}

async function getLatestBlock(client: AlfaClubPublicClientLike): Promise<bigint | null> {
  try {
    const anyClient = client as unknown as { getBlockNumber?: () => Promise<bigint> }
    if (typeof anyClient.getBlockNumber !== 'function') return null
    const n = await anyClient.getBlockNumber()
    return typeof n === 'bigint' ? n : null
  } catch {
    return null
  }
}

export async function resolveStakingPoolAddress(
  client: AlfaClubPublicClientLike,
  tokenId: bigint,
): Promise<Address | null> {
  try {
    const pool = (await client.readContract({
      address: ALFACLUB.friendKey,
      abi: FRIEND_KEY_ABI,
      functionName: 'stakingPoolByTokenId',
      args: [tokenId],
    })) as Address
    const normalized = (pool ?? '').toLowerCase()
    if (!normalized || normalized === '0x0000000000000000000000000000000000000000') return null
    return normalized as Address
  } catch {
    return null
  }
}

/** Aggregate staked keys for a room — pool's FriendKey balance for this tokenId. */
export async function readStakedSupply(
  client: AlfaClubPublicClientLike,
  stakingPool: Address | null,
  tokenId: bigint,
): Promise<bigint> {
  if (!stakingPool) return 0n
  try {
    const val = (await client.readContract({
      address: ALFACLUB.friendKey,
      abi: FRIEND_KEY_ABI,
      functionName: 'balanceOf',
      args: [stakingPool, tokenId],
    })) as bigint
    return typeof val === 'bigint' ? val : 0n
  } catch {
    return 0n
  }
}

type ChunkScanResult = { total: bigint; failedChunks: number; scannedChunks: number; truncated: boolean }

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchChunkLogs(
  client: AlfaClubPublicClientLike,
  fetch: () => Promise<ReadonlyArray<StakeEventLog>>,
  maxAttempts = CHUNK_RETRY_ATTEMPTS,
): Promise<{ total: bigint; failed: boolean }> {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      const logs = await fetch()
      let chunkTotal = 0n
      for (const log of logs) {
        const amount = log.args?.amount
        if (typeof amount === 'bigint') chunkTotal += amount
      }
      return { total: chunkTotal, failed: false }
    } catch {
      if (attempt + 1 < maxAttempts) {
        await sleep(150 * (attempt + 1))
      }
    }
  }
  return { total: 0n, failed: true }
}

async function scanRangesWithRecovery(
  ranges: BlockRange[],
  scanRange: (
    range: BlockRange,
    extendedRetry: boolean,
  ) => Promise<{ total: bigint; failed: boolean }>,
): Promise<ChunkScanResult> {
  if (ranges.length > MAX_STAKE_LOG_CHUNKS) {
    return { total: 0n, failedChunks: 0, scannedChunks: 0, truncated: true }
  }

  const initial = await mapChunkBatches(ranges, CHUNK_CONCURRENCY, async (range) => ({
    range,
    ...(await scanRange(range, false)),
  }))

  let total = 0n
  const failedRanges: BlockRange[] = []
  for (const result of initial) {
    if (result.failed) failedRanges.push(result.range)
    else total += result.total
  }

  let remainingFailures = 0
  for (const range of failedRanges) {
    const recovered = await scanRange(range, true)
    if (recovered.failed) remainingFailures += 1
    else total += recovered.total
  }

  return {
    total,
    failedChunks: remainingFailures,
    scannedChunks: ranges.length,
    truncated: false,
  }
}

async function scanRangesForStakeEvents(
  client: AlfaClubPublicClientLike,
  stakingPool: Address,
  user: Address,
  eventName: 'KeyStaked' | 'KeyUnstaked',
  ranges: BlockRange[],
): Promise<ChunkScanResult> {
  const event = FRIEND_STAKE_ABI.find(
    (x: Abi[number]) => x.type === 'event' && x.name === eventName,
  )

  return scanRangesWithRecovery(ranges, async (range, extendedRetry) =>
    fetchChunkLogs(
      client,
      () =>
        client.getLogs({
          address: stakingPool,
          event,
          args: { user },
          fromBlock: range.fromBlock,
          toBlock: range.toBlock,
        }) as Promise<ReadonlyArray<StakeEventLog>>,
      extendedRetry ? SEQUENTIAL_RETRY_ATTEMPTS : CHUNK_RETRY_ATTEMPTS,
    ),
  )
}

async function scanStakeEventsForUser(
  client: AlfaClubPublicClientLike,
  stakingPool: Address,
  user: Address,
  eventName: 'KeyStaked' | 'KeyUnstaked',
  fromBlock: bigint,
  toBlock: bigint | 'latest',
  mintAnchored: boolean,
): Promise<ChunkScanResult> {
  if (toBlock === 'latest') {
    const latest = await getLatestBlock(client)
    if (latest == null) return { total: 0n, failedChunks: 1, scannedChunks: 0, truncated: false }
    toBlock = latest
  }

  const windows = buildScanWindows(fromBlock, toBlock, mintAnchored)
  let total = 0n
  let failedChunks = 0
  let scannedChunks = 0
  for (const window of windows) {
    const windowEnd = window.toBlock === 'latest' ? toBlock : window.toBlock
    const ranges = buildBlockRanges(window.fromBlock, windowEnd, DEFAULT_BLOCK_CHUNK)
    const result = await scanRangesForStakeEvents(
      client,
      stakingPool,
      user,
      eventName,
      ranges,
    )
    if (result.truncated) return result
    total += result.total
    failedChunks += result.failedChunks
    scannedChunks += result.scannedChunks
  }

  return { total, failedChunks, scannedChunks, truncated: false }
}

async function scanPoolTransfersForUser(
  client: AlfaClubPublicClientLike,
  stakingPool: Address,
  user: Address,
  tokenId: bigint,
  fromBlock: bigint,
  toBlock: bigint | 'latest',
  mintAnchored: boolean,
): Promise<ChunkScanResult> {
  const transferEvent = FRIEND_KEY_ABI.find(
    (x: Abi[number]) => x.type === 'event' && x.name === 'TransferSingle',
  )
  if (toBlock === 'latest') {
    const latest = await getLatestBlock(client)
    if (latest == null) return { total: 0n, failedChunks: 1, scannedChunks: 0, truncated: false }
    toBlock = latest
  }

  const userLower = user.toLowerCase()
  const poolLower = stakingPool.toLowerCase()
  const windows = buildScanWindows(fromBlock, toBlock, mintAnchored)
  let net = 0n
  let failedChunks = 0
  let scannedChunks = 0

  for (const window of windows) {
    const windowEnd = window.toBlock === 'latest' ? toBlock : window.toBlock
    const ranges = buildBlockRanges(window.fromBlock, windowEnd, DEFAULT_BLOCK_CHUNK)
    const result = await scanRangesWithRecovery(ranges, async (range, extendedRetry) => {
      const maxAttempts = extendedRetry ? SEQUENTIAL_RETRY_ATTEMPTS : CHUNK_RETRY_ATTEMPTS
      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        try {
          const [toPoolLogs, fromPoolLogs] = await Promise.all([
            client.getLogs({
              address: ALFACLUB.friendKey,
              event: transferEvent,
              args: { from: user, to: stakingPool },
              fromBlock: range.fromBlock,
              toBlock: range.toBlock,
            }) as Promise<ReadonlyArray<TransferSingleLog>>,
            client.getLogs({
              address: ALFACLUB.friendKey,
              event: transferEvent,
              args: { from: stakingPool, to: user },
              fromBlock: range.fromBlock,
              toBlock: range.toBlock,
            }) as Promise<ReadonlyArray<TransferSingleLog>>,
          ])

          let chunkNet = 0n
          for (const log of toPoolLogs) {
            if (log.args?.id === tokenId && typeof log.args.value === 'bigint') {
              if (
                log.args.from?.toLowerCase() === userLower &&
                log.args.to?.toLowerCase() === poolLower
              ) {
                chunkNet += log.args.value
              }
            }
          }
          for (const log of fromPoolLogs) {
            if (log.args?.id === tokenId && typeof log.args.value === 'bigint') {
              if (
                log.args.from?.toLowerCase() === poolLower &&
                log.args.to?.toLowerCase() === userLower
              ) {
                chunkNet -= log.args.value
              }
            }
          }
          return { total: chunkNet, failed: false }
        } catch {
          if (attempt + 1 < maxAttempts) await sleep(150 * (attempt + 1))
        }
      }
      return { total: 0n, failed: true }
    })

    if (result.truncated) return result
    net += result.total
    failedChunks += result.failedChunks
    scannedChunks += result.scannedChunks
  }

  return {
    total: net >= 0n ? net : 0n,
    failedChunks,
    scannedChunks,
    truncated: false,
  }
}

function bigintToSafeNumber(value: bigint): number | null {
  if (value < 0n) return null
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) return Number.MAX_SAFE_INTEGER
  const asNumber = Number(value)
  return Number.isFinite(asNumber) && asNumber >= 0 ? asNumber : null
}

function scanIncomplete(...scans: ChunkScanResult[]): boolean {
  return scans.some((scan) => scan.failedChunks > 0 || scan.truncated)
}

function clampToPool(userStake: bigint, poolStakedSupply?: bigint): bigint {
  if (poolStakedSupply == null) return userStake >= 0n ? userStake : 0n
  if (userStake <= poolStakedSupply) return userStake >= 0n ? userStake : 0n
  return poolStakedSupply
}

function evmMappingSlot(key: Address, mapSlot: bigint): `0x${string}` {
  return keccak256(
    encodeAbiParameters(parseAbiParameters('address, uint256'), [key, mapSlot]),
  )
}

function storageWordToBigInt(slot: `0x${string}`): bigint {
  return BigInt(slot)
}

function offsetStorageSlot(base: bigint, offset: bigint): `0x${string}` {
  return `0x${(base + offset).toString(16).padStart(64, '0')}` as `0x${string}`
}

/**
 * Read a user's total staked keys directly from FriendStake storage.
 * FriendStake keeps balances in a private IterableMapping with no public getter,
 * but the layout is stable across beacon-proxy pool clones.
 */
export async function readUserStakedKeysFromStorage(
  client: AlfaClubPublicClientLike,
  stakingPool: Address,
  user: Address,
): Promise<bigint | null> {
  if (typeof client.getStorageAt !== 'function') return null

  try {
    const valuesArrayHead = evmMappingSlot(user, FRIEND_STAKE_STAKED_VALUES_MAP_SLOT)
    const lengthWord = await client.getStorageAt({ address: stakingPool, slot: valuesArrayHead })
    const entryCount = storageWordToBigInt(lengthWord)
    if (entryCount === 0n) return 0n
    if (entryCount > MAX_STAKE_ENTRIES_PER_USER) return null

    const arrayDataBase = storageWordToBigInt(keccak256(valuesArrayHead))
    let total = 0n
    for (let i = 0n; i < entryCount; i += 1n) {
      const amountWord = await client.getStorageAt({
        address: stakingPool,
        slot: offsetStorageSlot(arrayDataBase, i * 2n),
      })
      total += storageWordToBigInt(amountWord)
    }

    return total >= 0n ? total : 0n
  } catch {
    return null
  }
}

/**
 * Replay FriendStake KeyStaked / KeyUnstaked logs for one user on a room pool.
 * Falls back to FriendKey TransferSingle net flow (user ↔ pool) when stake events fail.
 * Returns null when the scan could not complete (missing pool, RPC failure, etc.).
 */
export async function readUserStakedKeys(
  client: AlfaClubPublicClientLike,
  stakingPool: Address | null,
  user: Address | null,
  opts: { fromBlock?: bigint; tokenId?: bigint; poolStakedSupply?: bigint } = {},
): Promise<number | null> {
  if (!stakingPool || !user) return null

  const deployBlock = getAlfaClubDeployBlock()
  const fromBlock = opts.fromBlock ?? deployBlock
  const mintAnchored = opts.fromBlock != null && opts.fromBlock !== deployBlock
  const latest = await getLatestBlock(client)
  const toBlock = latest ?? 'latest'
  const tokenId = opts.tokenId ?? 0n

  try {
    const fromStorage = await readUserStakedKeysFromStorage(client, stakingPool, user)
    if (fromStorage != null) {
      const capped = clampToPool(fromStorage, opts.poolStakedSupply)
      const fromSlot = bigintToSafeNumber(capped)
      if (fromSlot != null) return fromSlot
    }

    const stakedScan = await scanStakeEventsForUser(
      client,
      stakingPool,
      user,
      'KeyStaked',
      fromBlock,
      toBlock,
      mintAnchored,
    )
    const unstakedScan = await scanStakeEventsForUser(
      client,
      stakingPool,
      user,
      'KeyUnstaked',
      fromBlock,
      toBlock,
      mintAnchored,
    )

    if (!scanIncomplete(stakedScan, unstakedScan)) {
      const eventNet =
        stakedScan.total >= unstakedScan.total ? stakedScan.total - unstakedScan.total : 0n
      const capped = clampToPool(eventNet, opts.poolStakedSupply)
      const fromEvents = bigintToSafeNumber(capped)
      if (fromEvents != null) return fromEvents
    }

    if (tokenId > 0n) {
      const transferScan = await scanPoolTransfersForUser(
        client,
        stakingPool,
        user,
        tokenId,
        fromBlock,
        toBlock,
        mintAnchored,
      )
      if (!scanIncomplete(transferScan)) {
        const capped = clampToPool(transferScan.total, opts.poolStakedSupply)
        return bigintToSafeNumber(capped)
      }
    }

    return null
  } catch {
    return null
  }
}

/** Sum staked keys across multiple owner wallets (creator + trading wallet, etc.). */
export async function readUserStakedKeysForAddresses(
  client: AlfaClubPublicClientLike,
  stakingPool: Address | null,
  users: readonly Address[],
  opts: { fromBlock?: bigint; tokenId?: bigint; poolStakedSupply?: bigint } = {},
): Promise<number | null> {
  if (!stakingPool || users.length === 0) return null

  const uniqueUsers = [...new Set(users.map((u) => u.toLowerCase()))] as Address[]
  let total = 0
  for (const user of uniqueUsers) {
    const stake = await readUserStakedKeys(client, stakingPool, user, opts)
    if (stake == null) return null
    total += stake
  }

  if (opts.poolStakedSupply != null) {
    const cap = Number(opts.poolStakedSupply)
    if (Number.isFinite(cap) && cap >= 0) total = Math.min(total, cap)
  }

  return total
}

export function computeHostKeyShare(params: {
  keySupply: number | null
  hostWalletKeys: number
  hostStakedKeys: number
}): {
  hostKeys: number
  hostSharePercent: number
  stakeRatioPercent: number | null
} {
  const hostKeys = Math.max(0, params.hostWalletKeys) + Math.max(0, params.hostStakedKeys)
  const supply = Math.max(1, params.keySupply ?? 1)
  const hostSharePercent =
    hostKeys > 0 ? Math.min(100, Math.max(0, Math.round((hostKeys / supply) * 100))) : 0
  const stakeRatioPercent =
    params.keySupply != null && params.keySupply > 0
      ? Math.min(100, Math.max(0, Math.round((Math.max(0, params.hostStakedKeys) / supply) * 100)))
      : null
  return { hostKeys, hostSharePercent, stakeRatioPercent }
}
