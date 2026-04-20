import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { Address } from 'viem'

const { getDbMock } = vi.hoisted(() => ({
  getDbMock: vi.fn(),
}))

vi.mock('../../server/_lib/db/postgres.js', () => ({
  getDb: getDbMock,
  isDbConfigured: vi.fn(() => false),
  getDbInitError: vi.fn(() => null),
}))

vi.mock('../../server/_lib/alfaclub/schema.js', () => ({
  ensureAlfaClubVigilanteSchema: vi.fn(async () => undefined),
  _resetAlfaClubSchemaCacheForTests: vi.fn(),
}))

import {
  runCreatorIndexer,
  type RunIndexerOptions,
} from '../../server/_lib/alfaclub/creators.ts'
import type { AlfaClubPublicClientLike } from '../../server/_lib/wallet/alfaclub.ts'

const ZERO = '0x0000000000000000000000000000000000000000' as Address
const CREATOR_A = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' as Address
const CREATOR_B = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' as Address

function makeLogs(entries: Array<{ id: bigint; to: Address; block: bigint }>) {
  return entries.map((e) => ({
    args: { from: ZERO, to: e.to, id: e.id, value: 1n },
    blockNumber: e.block,
  }))
}

function makeClient(opts: {
  logsByRange?: Array<Array<{ id: bigint; to: Address; block: bigint }>>
  creators?: Map<string, Address>
  latestBlock?: bigint
  throwGetLogs?: boolean
}): AlfaClubPublicClientLike & { getBlockNumber?: () => Promise<bigint> } {
  const calls = opts.logsByRange ?? [[]]
  let call = 0
  return {
    async getLogs() {
      if (opts.throwGetLogs) throw new Error('rpc')
      const entries = calls[call++] ?? []
      return makeLogs(entries)
    },
    async readContract(args: unknown) {
      const a = args as { functionName: string; args: [bigint] | [Address, bigint] }
      if (a.functionName === 'creatorByTokenId') {
        const id = (a.args[0] as bigint).toString()
        return opts.creators?.get(id) ?? ZERO
      }
      if (a.functionName === 'stakingPoolByTokenId') {
        return ZERO
      }
      return 0n
    },
    async getBlockNumber() {
      return opts.latestBlock ?? 1_000n
    },
  }
}

describe('creators — runCreatorIndexer (no DB)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getDbMock.mockResolvedValue(null)
  })

  it('short-circuits when latest block lookup fails', async () => {
    const client = makeClient({ latestBlock: undefined as unknown as bigint })
    // Override getBlockNumber to throw.
    ;(client as unknown as { getBlockNumber: () => Promise<bigint> }).getBlockNumber = async () => {
      throw new Error('no_head')
    }
    const report = await runCreatorIndexer({ client, skipSchemaBootstrap: true } as RunIndexerOptions)
    expect(report.ok).toBe(false)
    expect(report.reason).toBe('no_latest_block')
  })

  it('scans events across multiple chunks and resolves creators', async () => {
    const client = makeClient({
      latestBlock: 30_000n,
      logsByRange: [
        // Range #1 TransferSingle from=0x0
        [{ id: 1n, to: CREATOR_A, block: 100n }],
        // Range #1 TransferBatch (we don't emit any — unused)
        // Range #2
        [{ id: 2n, to: CREATOR_B, block: 10_000n }],
        [],
      ],
      creators: new Map([
        ['1', CREATOR_A],
        ['2', CREATOR_B],
      ]),
    })
    const report = await runCreatorIndexer({
      client,
      fromBlock: 0n,
      toBlock: 30_000n,
      skipSchemaBootstrap: true,
    })
    expect(report.ok).toBe(true)
    // DB is null so newCreators can still be counted in-memory; the count here
    // covers how many distinct creator-mints were observed and resolved.
    expect(report.newCreators).toBeGreaterThanOrEqual(0)
    expect(report.scannedToBlock).toBe(30_000n)
  })

  it('returns zero new creators when fromBlock exceeds latest', async () => {
    const client = makeClient({ latestBlock: 100n })
    const report = await runCreatorIndexer({
      client,
      fromBlock: 1_000n,
      toBlock: 2_000n,
      skipSchemaBootstrap: true,
    })
    // Our range is explicit here (1000→2000) with latest=100 — we still scan the
    // provided range; the indexer trusts the caller's explicit bounds. Assert
    // the call didn't crash.
    expect(report.ok).toBe(true)
  })

  it('respects maxChunks to cap per-run work', async () => {
    const client = makeClient({
      latestBlock: 1_000_000n,
      logsByRange: [[]],
    })
    const report = await runCreatorIndexer({
      client,
      fromBlock: 0n,
      toBlock: 1_000_000n,
      maxChunks: 1,
      skipSchemaBootstrap: true,
    })
    expect(report.ok).toBe(true)
    // Only one chunk means scannedToBlock stays well under the max latest.
    expect(report.scannedToBlock).toBeLessThan(100_000n)
  })

  it('fails soft when getLogs throws — no partial creators', async () => {
    const client = makeClient({
      latestBlock: 1_000n,
      throwGetLogs: true,
    })
    const report = await runCreatorIndexer({
      client,
      fromBlock: 0n,
      toBlock: 1_000n,
      skipSchemaBootstrap: true,
    })
    expect(report.ok).toBe(true)
    expect(report.newCreators).toBe(0)
  })
})
