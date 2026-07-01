/**
 * AlfaClub Integrity Vigilante — phase-gated orchestrator.
 *
 * Three-stage pipeline, each independently gated by an env flag:
 *
 *   READ_ENABLED     → index creators, capture metrics, score + rank, persist
 *                      snapshot in Supabase so /api/v1/alfaclub/leaderboard works.
 *   POST_ENABLED     → publish per-top-N Lens scorecard posts (dedup'd via
 *                      publicationLedger) when a creator is new-to-rank or
 *                      has rolled past the cooldown window.
 *   FEEDBACK_ENABLED → submit ERC-8004 giveFeedback() onchain per top-N creator.
 *                      Uses an EOA signer (ALFACLUB_VIGILANTE_SIGNER_PRIVATE_KEY
 *                      with fallback to KPR_PRIVATE_KEY). If no key is
 *                      configured, the calldata is merely queued in the ledger
 *                      with kind='erc8004-queued' for later manual submission.
 *
 * KILL_SWITCH short-circuits the pipeline entirely. Every flag defaults to off;
 * the code ships dormant.
 *
 * Reads:   [creators.ts](./creators.ts), [alfaclub.ts](../wallet/alfaclub.ts),
 *          [hyperliquid.ts](./hyperliquid.ts)
 * Scoring: [leaderboard.ts](./leaderboard.ts)
 * Output:  [scorecard.ts](./scorecard.ts), [publicationLedger.ts](./publicationLedger.ts)
 */

import { createHash } from 'node:crypto'

import {
  encodeFunctionData,
  keccak256,
  toHex,
  type Address,
  type Hex,
} from 'viem'

import {
  ALFACLUB,
  FRIEND_KEY_ABI,
  getAlfaClubPublicClient,
  type AlfaClubPublicClientLike,
} from '../wallet/alfaclub.js'
import {
  REPUTATION_REGISTRY_ABI,
  getReputationRegistryAddress,
} from '../agent/erc8004.js'
import { listAllCreators, runCreatorIndexer, readVigilanteScoringCursor, writeVigilanteScoringCursor, type AlfaClubCreator } from './creators.js'
import {
  getHyperliquidSnapshot,
  type HyperliquidSnapshot,
} from './hyperliquid.js'
import {
  rankCreators,
  type CreatorMetricsInput,
  type RankedCreator,
} from './leaderboard.js'
import {
  buildScorecard,
  formatScorecardPostBody,
  SCORECARD_SCHEMA,
  publishScorecard as publishScorecardImpl,
  type ScorecardInput,
} from './scorecard.js'
import {
  attachErc8004TxHash,
  bucketWindowStart,
  getLatestMetricsByCreator,
  hasPublication,
  insertMetricsSnapshot,
  makePublicationKey,
  recordPublication,
  type MetricsSnapshotRow,
  type PublicationKind,
} from './publicationLedger.js'
import {
  lookupRoomTradingWalletHint,
  lookupTradingWalletFromEnv,
} from './keySafetyRoomContext.js'
import { ensureAlfaClubVigilanteSchema } from './schema.js'
import { tryUploadImmutableJson } from '../lens/lensGrove.js'

declare const process: { env: Record<string, string | undefined> }

// ---------------------------------------------------------------------------
// Flags / tunables
// ---------------------------------------------------------------------------

export type VigilanteFlags = {
  killSwitch: boolean
  readEnabled: boolean
  postEnabled: boolean
  feedbackEnabled: boolean
  topN: number
  cooldownHours: number
  maxCreatorsPerRun: number | null
  scoringBatchSize: number
}

const DEFAULT_TOP_N = 20
const DEFAULT_COOLDOWN_HOURS = 24
const DEFAULT_SCORING_BATCH_SIZE = 250
const METRICS_CAPTURE_CONCURRENCY = 16
const LIGHT_METRICS_CONCURRENCY = 32

function parseBoolFlag(raw: string | undefined): boolean {
  const v = (raw ?? '').trim().toLowerCase()
  return v === '1' || v === 'true' || v === 'yes'
}

function parsePositiveIntEnv(key: string, fallback: number, max = 500): number {
  const raw = (process.env[key] ?? '').trim()
  if (!/^\d+$/.test(raw)) return fallback
  const n = Number.parseInt(raw, 10)
  if (!Number.isFinite(n) || n <= 0) return fallback
  return Math.min(n, max)
}

function parseOptionalPositiveIntEnv(key: string, max = 10_000): number | null {
  const raw = (process.env[key] ?? '').trim()
  if (!raw) return null
  if (!/^\d+$/.test(raw)) return null
  const n = Number.parseInt(raw, 10)
  if (!Number.isFinite(n) || n <= 0) return null
  return Math.min(n, max)
}

export function readVigilanteFlags(): VigilanteFlags {
  const scoringBatchSize = parsePositiveIntEnv(
    'ALFACLUB_VIGILANTE_SCORING_BATCH_SIZE',
    DEFAULT_SCORING_BATCH_SIZE,
    500,
  )
  const maxCreatorsPerRun = parseOptionalPositiveIntEnv('ALFACLUB_VIGILANTE_MAX_CREATORS_PER_RUN')
  return {
    killSwitch: parseBoolFlag(process.env.ALFACLUB_VIGILANTE_KILL_SWITCH),
    readEnabled: parseBoolFlag(process.env.ALFACLUB_VIGILANTE_READ_ENABLED),
    postEnabled: parseBoolFlag(process.env.ALFACLUB_VIGILANTE_POST_ENABLED),
    feedbackEnabled: parseBoolFlag(process.env.ALFACLUB_VIGILANTE_FEEDBACK_ENABLED),
    topN: parsePositiveIntEnv('ALFACLUB_VIGILANTE_TOP_N', DEFAULT_TOP_N, 200),
    cooldownHours: parsePositiveIntEnv('ALFACLUB_VIGILANTE_POST_COOLDOWN_HOURS', DEFAULT_COOLDOWN_HOURS, 720),
    maxCreatorsPerRun,
    scoringBatchSize: maxCreatorsPerRun ? Math.min(scoringBatchSize, maxCreatorsPerRun) : scoringBatchSize,
  }
}

export function resolveScoringBatchSize(flags: VigilanteFlags = readVigilanteFlags()): number {
  return flags.scoringBatchSize
}

export function selectRotatingScoringBatch(
  creators: readonly AlfaClubCreator[],
  offset: number,
  batchSize: number,
): { batch: AlfaClubCreator[]; nextOffset: number } {
  if (creators.length === 0 || batchSize <= 0) {
    return { batch: [], nextOffset: 0 }
  }
  const sorted = [...creators].sort((a, b) => {
    if (a.tokenId === b.tokenId) {
      return a.creatorAddress.localeCompare(b.creatorAddress)
    }
    return a.tokenId < b.tokenId ? -1 : 1
  })
  const start = ((offset % sorted.length) + sorted.length) % sorted.length
  const take = Math.min(batchSize, sorted.length)
  const batch: AlfaClubCreator[] = []
  for (let index = 0; index < take; index += 1) {
    batch.push(sorted[(start + index) % sorted.length]!)
  }
  return { batch, nextOffset: (start + take) % sorted.length }
}

export function mergeCreatorMetricsForSnapshot(params: {
  allCreators: readonly AlfaClubCreator[]
  batchMetrics: readonly CreatorMetricsInput[]
  cachedByCreator: ReadonlyMap<string, MetricsSnapshotRow>
  lightMetrics: readonly CreatorMetricsInput[]
}): CreatorMetricsInput[] {
  const batchByAddress = new Map(
    params.batchMetrics.map((metric) => [metric.creatorAddress.toLowerCase(), metric]),
  )
  const lightByAddress = new Map(
    params.lightMetrics.map((metric) => [metric.creatorAddress.toLowerCase(), metric]),
  )
  return params.allCreators.map((creator) => {
    const address = creator.creatorAddress.toLowerCase()
    const fresh = batchByAddress.get(address)
    if (fresh) return fresh

    const cached = params.cachedByCreator.get(address)
    if (cached) {
      return {
        tokenId: creator.tokenId,
        creatorAddress: creator.creatorAddress,
        totalSupply: cached.totalSupply,
        stakedSupply: cached.stakedSupply,
        hyperliquid: {
          accountValueUsd: cached.hlAccountValueUsd,
          pnl30dUsd: cached.pnl30dUsd,
        },
      }
    }

    return (
      lightByAddress.get(address) ?? {
        tokenId: creator.tokenId,
        creatorAddress: creator.creatorAddress,
        totalSupply: 0n,
        stakedSupply: 0n,
        hyperliquid: null,
      }
    )
  })
}

async function mapWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = []
  for (let index = 0; index < items.length; index += concurrency) {
    const chunk = items.slice(index, index + concurrency)
    out.push(...(await Promise.all(chunk.map(fn))))
  }
  return out
}

async function resolveHyperliquidAddress(creator: AlfaClubCreator): Promise<string> {
  const roomId = creator.tokenId.toString()
  return (
    lookupTradingWalletFromEnv(roomId) ??
    (await lookupRoomTradingWalletHint(roomId)) ??
    creator.creatorAddress
  )
}

// ---------------------------------------------------------------------------
// Metrics capture
// ---------------------------------------------------------------------------

async function readSupply(
  client: AlfaClubPublicClientLike,
  tokenId: bigint,
): Promise<bigint> {
  try {
    const val = (await client.readContract({
      address: ALFACLUB.friendKey,
      abi: FRIEND_KEY_ABI,
      functionName: 'totalSupply',
      args: [tokenId],
    })) as bigint
    return typeof val === 'bigint' ? val : 0n
  } catch {
    return 0n
  }
}

async function readStakedSupply(
  client: AlfaClubPublicClientLike,
  stakingPool: Address | null,
  tokenId: bigint,
): Promise<bigint> {
  if (!stakingPool) return 0n
  try {
    // AlfaClub stakes the FriendKey tokenId in the staking pool contract,
    // so the staked supply is the pool's balance of that tokenId on FriendKey.
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

async function captureMetricsForCreators(
  creators: readonly AlfaClubCreator[],
  client: AlfaClubPublicClientLike,
  opts: {
    skipHyperliquid?: boolean
    getHyperliquid?: (address: string) => Promise<HyperliquidSnapshot>
    concurrency?: number
  } = {},
): Promise<CreatorMetricsInput[]> {
  const hl = opts.getHyperliquid ?? getHyperliquidSnapshot
  const concurrency = opts.concurrency ?? METRICS_CAPTURE_CONCURRENCY
  return mapWithConcurrency(creators, concurrency, async (creator) => {
    const totalSupply = await readSupply(client, creator.tokenId)
    const stakedSupply = await readStakedSupply(client, creator.stakingPool, creator.tokenId)
    const shouldFetchHl = !opts.skipHyperliquid && totalSupply > 0n
    const hlAddress = shouldFetchHl ? await resolveHyperliquidAddress(creator) : null
    const snapshot = shouldFetchHl && hlAddress ? await hl(hlAddress) : null
    return {
      tokenId: creator.tokenId,
      creatorAddress: creator.creatorAddress,
      totalSupply,
      stakedSupply,
      hyperliquid: snapshot
        ? {
            accountValueUsd: snapshot.accountValueUsd,
            pnl30dUsd: snapshot.pnl30dUsd,
          }
        : null,
    }
  })
}

async function captureLightMetricsForCreators(
  creators: readonly AlfaClubCreator[],
  client: AlfaClubPublicClientLike,
): Promise<CreatorMetricsInput[]> {
  return mapWithConcurrency(creators, LIGHT_METRICS_CONCURRENCY, async (creator) => {
    const totalSupply = await readSupply(client, creator.tokenId)
    const stakedSupply = await readStakedSupply(client, creator.stakingPool, creator.tokenId)
    return {
      tokenId: creator.tokenId,
      creatorAddress: creator.creatorAddress,
      totalSupply,
      stakedSupply,
      hyperliquid: null,
    }
  })
}

// ---------------------------------------------------------------------------
// Publication — Lens posts
// ---------------------------------------------------------------------------

type PublishOutcome =
  | { ok: true; publicationKey: string; alreadyPublished?: boolean }
  | { ok: false; reason: string; publicationKey?: string }

async function publishLensScorecard(params: {
  creator: RankedCreator
  snapshotTs: string
  windowStart: string
  totalCreatorsRanked: number
  postFn?: (body: string, scorecardUri: string | null) => Promise<string | null>
}): Promise<PublishOutcome> {
  const publicationKey = makePublicationKey({
    creatorAddress: params.creator.creatorAddress,
    windowStart: params.windowStart,
    kind: 'lens',
  })
  if (await hasPublication(publicationKey)) {
    return { ok: true, publicationKey, alreadyPublished: true }
  }

  const scorecardInput: ScorecardInput = {
    creator: params.creator,
    snapshotTs: params.snapshotTs,
    totalCreatorsRanked: params.totalCreatorsRanked,
    sources: {
      friendKeyContract: ALFACLUB.friendKey,
      friendStakeBeacon: ALFACLUB.friendStakeBeacon,
      friendPool: ALFACLUB.friendPool,
      hyperliquidInfoUrl: 'https://api.hyperliquid.xyz/info',
    },
  }
  const published = await publishScorecardImpl(scorecardInput)
  const scorecardUri = published.upload.ok ? published.upload.result.lensUri : null
  const scorecardCid = published.upload.ok ? published.upload.result.storageKey : null

  const body = formatScorecardPostBody(published.scorecard, scorecardUri ?? '(grove_upload_failed)')

  // Lens post is optional — only fires if the caller wires a real post function.
  let lensPostId: string | null = null
  if (params.postFn) {
    try {
      lensPostId = await params.postFn(body, scorecardUri)
    } catch {
      lensPostId = null
    }
  }

  await recordPublication({
    publicationKey,
    kind: 'lens',
    creatorAddress: params.creator.creatorAddress,
    tokenId: params.creator.tokenId,
    scorecardCid,
    scorecardUri,
    scorecardHash: published.hash,
    lensPostId,
    erc8004TxHash: null,
    erc8004Calldata: null,
    score: params.creator.compositeScore,
    rank: params.creator.rank,
  })

  if (!published.upload.ok) {
    return { ok: false, reason: `grove_upload_failed:${published.upload.error}`, publicationKey }
  }
  return { ok: true, publicationKey }
}

// ---------------------------------------------------------------------------
// Publication — ERC-8004 giveFeedback
// ---------------------------------------------------------------------------

type Erc8004Signer = {
  send: (
    to: `0x${string}`,
    data: Hex,
  ) => Promise<{ ok: true; txHash: string } | { ok: false; error: string }>
  signerAddress: string
}

function resolveSignerPrivateKey(): `0x${string}` | null {
  const a = (process.env.ALFACLUB_VIGILANTE_SIGNER_PRIVATE_KEY ?? '').trim()
  if (/^0x[0-9a-fA-F]{64}$/.test(a)) return a as `0x${string}`
  const b = (process.env.KPR_PRIVATE_KEY ?? '').trim()
  if (/^0x[0-9a-fA-F]{64}$/.test(b)) return b as `0x${string}`
  return null
}

/**
 * Lazily construct a viem wallet-client EOA signer. Returns null when no
 * private key is configured, in which case the orchestrator queues the
 * prepared calldata instead of submitting. No key => no autonomous write.
 */
async function buildEoaSigner(): Promise<Erc8004Signer | null> {
  const pk = resolveSignerPrivateKey()
  if (!pk) return null
  const { createPublicClient, createWalletClient, http } = await import('viem')
  const { privateKeyToAccount } = await import('viem/accounts')
  const { base } = await import('viem/chains')

  const rpcUrl =
    (process.env.BASE_RPC_URL ?? '').trim() || 'https://mainnet.base.org'
  const account = privateKeyToAccount(pk)
  const publicClient = createPublicClient({ chain: base, transport: http(rpcUrl) })
  const walletClient = createWalletClient({ account, chain: base, transport: http(rpcUrl) })
  return {
    signerAddress: account.address,
    async send(to, data) {
      try {
        const hash = await walletClient.sendTransaction({ to, data })
        try {
          await publicClient.waitForTransactionReceipt({ hash, timeout: 120_000 })
        } catch {
          // Treat as ok even if confirmation wait fails — we have the hash.
        }
        return { ok: true, txHash: hash }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        return { ok: false, error: msg.slice(0, 512) }
      }
    },
  }
}

async function publishErc8004Feedback(params: {
  creator: RankedCreator
  snapshotTs: string
  windowStart: string
  totalCreatorsRanked: number
  signer: Erc8004Signer | null
}): Promise<PublishOutcome> {
  const publicationKey = makePublicationKey({
    creatorAddress: params.creator.creatorAddress,
    windowStart: params.windowStart,
    kind: 'erc8004-submitted',
  })
  const queuedKey = makePublicationKey({
    creatorAddress: params.creator.creatorAddress,
    windowStart: params.windowStart,
    kind: 'erc8004-queued',
  })

  if (await hasPublication(publicationKey)) {
    return { ok: true, publicationKey, alreadyPublished: true }
  }

  // Build scorecard + upload to Grove; feedbackURI must resolve to the scorecard.
  const scorecardInput: ScorecardInput = {
    creator: params.creator,
    snapshotTs: params.snapshotTs,
    totalCreatorsRanked: params.totalCreatorsRanked,
    sources: {
      friendKeyContract: ALFACLUB.friendKey,
      friendStakeBeacon: ALFACLUB.friendStakeBeacon,
      friendPool: ALFACLUB.friendPool,
      hyperliquidInfoUrl: 'https://api.hyperliquid.xyz/info',
    },
  }
  const built = buildScorecard(scorecardInput)
  const upload = await tryUploadImmutableJson(built.scorecard)
  const feedbackURI = upload.ok ? upload.result.lensUri : ''
  const scorecardCid = upload.ok ? upload.result.storageKey : null
  const feedbackHash = upload.ok
    ? (keccak256(toHex(feedbackURI || built.canonicalJson)) as `0x${string}`)
    : (built.hash as `0x${string}`)

  // Composite score is in [-1, 1]. Map to int128 * 10^4 for fixed-point.
  const scoreInt = Math.round(params.creator.compositeScore * 10_000)
  const agentIdRaw = (process.env.ERC8004_AGENT_ID ?? '2205').trim()
  const agentId = /^\d+$/.test(agentIdRaw) ? BigInt(agentIdRaw) : 2205n

  const calldata = encodeFunctionData({
    abi: REPUTATION_REGISTRY_ABI,
    functionName: 'giveFeedback',
    args: [
      agentId,
      BigInt(scoreInt),
      4,
      'alfaclub',
      'leaderboard-v1',
      'https://4626.fun/api/v1/alfaclub/leaderboard',
      feedbackURI,
      feedbackHash,
    ],
  }) as Hex

  const registry = getReputationRegistryAddress()

  // No signer → queue calldata only, no on-chain submission.
  if (!params.signer) {
    await recordPublication({
      publicationKey: queuedKey,
      kind: 'erc8004-queued',
      creatorAddress: params.creator.creatorAddress,
      tokenId: params.creator.tokenId,
      scorecardCid,
      scorecardUri: feedbackURI || null,
      scorecardHash: feedbackHash,
      lensPostId: null,
      erc8004TxHash: null,
      erc8004Calldata: calldata,
      score: params.creator.compositeScore,
      rank: params.creator.rank,
    })
    return { ok: true, publicationKey: queuedKey }
  }

  // Signer present → submit on-chain and record the tx hash.
  const result = await params.signer.send(registry, calldata)
  if (!result.ok) {
    await recordPublication({
      publicationKey: queuedKey,
      kind: 'erc8004-queued',
      creatorAddress: params.creator.creatorAddress,
      tokenId: params.creator.tokenId,
      scorecardCid,
      scorecardUri: feedbackURI || null,
      scorecardHash: feedbackHash,
      lensPostId: null,
      erc8004TxHash: null,
      erc8004Calldata: calldata,
      score: params.creator.compositeScore,
      rank: params.creator.rank,
    })
    return { ok: false, reason: `submit_failed:${result.error}`, publicationKey: queuedKey }
  }

  await recordPublication({
    publicationKey,
    kind: 'erc8004-submitted',
    creatorAddress: params.creator.creatorAddress,
    tokenId: params.creator.tokenId,
    scorecardCid,
    scorecardUri: feedbackURI || null,
    scorecardHash: feedbackHash,
    lensPostId: null,
    erc8004TxHash: result.txHash,
    erc8004Calldata: calldata,
    score: params.creator.compositeScore,
    rank: params.creator.rank,
  })
  return { ok: true, publicationKey }
}

// ---------------------------------------------------------------------------
// Public orchestrator
// ---------------------------------------------------------------------------

export type VigilanteRunOptions = {
  flags?: VigilanteFlags
  client?: AlfaClubPublicClientLike
  /** Override creator enumeration (for tests / dry-runs). */
  listCreators?: () => Promise<AlfaClubCreator[]>
  /** Override metrics capture (for tests). */
  getHyperliquid?: (address: string) => Promise<HyperliquidSnapshot>
  /** Optional Lens post publisher — if unset, Lens posts skip the post step but still record the scorecard. */
  postToLens?: (body: string, scorecardUri: string | null) => Promise<string | null>
  /** Provide an explicit signer (tests) — otherwise derived from env private keys. */
  signer?: Erc8004Signer | null
  /** Override the current time (tests). */
  now?: Date
  /** Skip the indexer step (tests that seed creators directly). */
  skipIndexer?: boolean
  /** Skip Hyperliquid reads (tests or early rollouts). */
  skipHyperliquid?: boolean
}

export type VigilantePublishResult = {
  creatorAddress: string
  rank: number
  lens: PublishOutcome | null
  erc8004: PublishOutcome | null
}

export type VigilanteRunResult = {
  ok: boolean
  reason?: string
  flags: VigilanteFlags
  snapshotTs: string
  windowStart: string
  indexedNewCreators: number | null
  creatorsIndexed: number
  rankedCreators: number
  scoringBatchSize: number
  scoringBatchCount: number
  scoringCursorBefore: number
  scoringCursorAfter: number
  topN: number
  publications: VigilantePublishResult[]
  signerAddress: string | null
  durationMs: number
}

export async function runVigilante(
  opts: VigilanteRunOptions = {},
): Promise<VigilanteRunResult> {
  const started = Date.now()
  const flags = opts.flags ?? readVigilanteFlags()
  const now = opts.now ?? new Date()
  const snapshotTs = now.toISOString()
  const windowStart = bucketWindowStart(now, flags.cooldownHours)

  const empty = (reason?: string): VigilanteRunResult => ({
    ok: reason === undefined,
    reason,
    flags,
    snapshotTs,
    windowStart,
    indexedNewCreators: null,
    creatorsIndexed: 0,
    rankedCreators: 0,
    scoringBatchSize: flags.scoringBatchSize,
    scoringBatchCount: 0,
    scoringCursorBefore: 0,
    scoringCursorAfter: 0,
    topN: flags.topN,
    publications: [],
    signerAddress: null,
    durationMs: Date.now() - started,
  })

  if (flags.killSwitch) return empty('kill_switch')
  if (!flags.readEnabled) return empty('read_disabled')

  try {
    await ensureAlfaClubVigilanteSchema()
  } catch {
    // Ignore — downstream steps fail-open on missing tables.
  }

  const client = opts.client ?? (await getAlfaClubPublicClient())

  // 1. Index creators.
  let indexedNew: number | null = null
  if (!opts.skipIndexer) {
    try {
      const report = await runCreatorIndexer({ client, skipSchemaBootstrap: true })
      indexedNew = report.newCreators
    } catch {
      indexedNew = null
    }
  }

  const creators = opts.listCreators
    ? await opts.listCreators()
    : await listAllCreators()

  if (creators.length === 0) {
    return empty('no_creators')
  }

  const scoringCursorBefore = await readVigilanteScoringCursor()
  const { batch, nextOffset } = selectRotatingScoringBatch(
    creators,
    scoringCursorBefore,
    flags.scoringBatchSize,
  )
  const batchAddressSet = new Set(batch.map((creator) => creator.creatorAddress.toLowerCase()))
  const cachedByCreator = await getLatestMetricsByCreator()
  const lightTargets = creators.filter((creator) => {
    const address = creator.creatorAddress.toLowerCase()
    return !batchAddressSet.has(address) && !cachedByCreator.has(address)
  })

  const [batchMetrics, lightMetrics] = await Promise.all([
    captureMetricsForCreators(batch, client, {
      skipHyperliquid: opts.skipHyperliquid,
      getHyperliquid: opts.getHyperliquid,
    }),
    captureLightMetricsForCreators(lightTargets, client),
  ])

  const metrics = mergeCreatorMetricsForSnapshot({
    allCreators: creators,
    batchMetrics,
    cachedByCreator,
    lightMetrics,
  })

  // 3. Rank.
  const ranked = rankCreators(metrics)

  // 4. Persist snapshot rows.
  const snapshotRows: MetricsSnapshotRow[] = ranked.map((r) => ({
    snapshotTs,
    creatorAddress: r.creatorAddress,
    tokenId: r.tokenId,
    totalSupply: r.totalSupply,
    stakedSupply: r.stakedSupply,
    pnl30dUsd: r.hyperliquid?.pnl30dUsd ?? null,
    hlAccountValueUsd: r.hyperliquid?.accountValueUsd ?? null,
    score: r.compositeScore,
    rank: r.rank,
  }))
  await insertMetricsSnapshot(snapshotRows)
  await writeVigilanteScoringCursor(nextOffset)

  // 5. Publish if enabled.
  const publications: VigilantePublishResult[] = []
  let signer: Erc8004Signer | null = opts.signer ?? null
  if (flags.feedbackEnabled && signer === null && opts.signer === undefined) {
    signer = await buildEoaSigner()
  }

  if (flags.postEnabled || flags.feedbackEnabled) {
    const toPublish = ranked.slice(0, flags.topN)
    for (const creator of toPublish) {
      const result: VigilantePublishResult = {
        creatorAddress: creator.creatorAddress,
        rank: creator.rank,
        lens: null,
        erc8004: null,
      }
      if (flags.postEnabled) {
        result.lens = await publishLensScorecard({
          creator,
          snapshotTs,
          windowStart,
          totalCreatorsRanked: ranked.length,
          postFn: opts.postToLens,
        })
      }
      if (flags.feedbackEnabled) {
        result.erc8004 = await publishErc8004Feedback({
          creator,
          snapshotTs,
          windowStart,
          totalCreatorsRanked: ranked.length,
          signer,
        })
      }
      publications.push(result)
    }
  }

  return {
    ok: true,
    flags,
    snapshotTs,
    windowStart,
    indexedNewCreators: indexedNew,
    creatorsIndexed: creators.length,
    rankedCreators: ranked.length,
    scoringBatchSize: flags.scoringBatchSize,
    scoringBatchCount: batch.length,
    scoringCursorBefore,
    scoringCursorAfter: nextOffset,
    topN: flags.topN,
    publications,
    signerAddress: signer?.signerAddress ?? null,
    durationMs: Date.now() - started,
  }
}

// ---------------------------------------------------------------------------
// Emergency revoke (admin)
// ---------------------------------------------------------------------------

/**
 * Build the calldata for `revokeFeedback(agentId, feedbackIndex)`. The caller
 * supplies the signer — we intentionally do NOT auto-revoke. The admin
 * dashboard submits this through the existing manual-submit flow.
 */
export function buildRevokeFeedbackCalldata(params: {
  agentId: number
  feedbackIndex: number
}): { to: `0x${string}`; data: Hex } {
  const data = encodeFunctionData({
    abi: REPUTATION_REGISTRY_ABI,
    functionName: 'revokeFeedback',
    args: [BigInt(params.agentId), BigInt(params.feedbackIndex)],
  }) as Hex
  return { to: getReputationRegistryAddress(), data }
}

// ---------------------------------------------------------------------------
// Exports used by the admin endpoints and tests
// ---------------------------------------------------------------------------

export const VIGILANTE_SCORECARD_SCHEMA = SCORECARD_SCHEMA

export {
  attachErc8004TxHash,
  captureMetricsForCreators,
  publishErc8004Feedback,
  publishLensScorecard,
}

// Stable hash helper exposed for tests.
export function stableDigest(input: string): string {
  return createHash('sha256').update(input).digest('hex')
}

// Expose signer resolver for endpoint-side preflight diagnostics.
export { resolveSignerPrivateKey, buildEoaSigner }

/** Narrow type helper so callers can opaque-pass a kind without importing the ledger. */
export type VigilantePublicationKind = PublicationKind
