import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  listAllCreatorsMock,
  runCreatorIndexerMock,
  getHyperliquidSnapshotMock,
  tryUploadImmutableJsonMock,
  ensureSchemaMock,
  recordPublicationMock,
  insertMetricsSnapshotMock,
  hasPublicationMock,
} = vi.hoisted(() => ({
  listAllCreatorsMock: vi.fn(),
  runCreatorIndexerMock: vi.fn(),
  getHyperliquidSnapshotMock: vi.fn(),
  tryUploadImmutableJsonMock: vi.fn(),
  ensureSchemaMock: vi.fn(),
  recordPublicationMock: vi.fn(),
  insertMetricsSnapshotMock: vi.fn(),
  hasPublicationMock: vi.fn(),
}))

vi.mock('../../server/_lib/alfaclub/creators.js', () => ({
  listAllCreators: listAllCreatorsMock,
  runCreatorIndexer: runCreatorIndexerMock,
}))

vi.mock('../../server/_lib/alfaclub/hyperliquid.js', () => ({
  getHyperliquidSnapshot: getHyperliquidSnapshotMock,
}))

vi.mock('../../server/_lib/lens/lensGrove.js', () => ({
  tryUploadImmutableJson: tryUploadImmutableJsonMock,
}))

vi.mock('../../server/_lib/alfaclub/schema.js', () => ({
  ensureAlfaClubVigilanteSchema: ensureSchemaMock,
  _resetAlfaClubSchemaCacheForTests: vi.fn(),
}))

// Mock just enough of the publicationLedger — preserve the pure helpers.
vi.mock('../../server/_lib/alfaclub/publicationLedger.js', async () => {
  const actual = await vi.importActual<
    typeof import('../../server/_lib/alfaclub/publicationLedger.ts')
  >('../../server/_lib/alfaclub/publicationLedger.ts')
  return {
    ...actual,
    recordPublication: recordPublicationMock,
    insertMetricsSnapshot: insertMetricsSnapshotMock,
    hasPublication: hasPublicationMock,
  }
})

// Mock alfaclub's FriendKey readContract for supply / staked-supply lookups.
vi.mock('../../server/_lib/wallet/alfaclub.js', async () => {
  const actual = await vi.importActual<
    typeof import('../../server/_lib/wallet/alfaclub.ts')
  >('../../server/_lib/wallet/alfaclub.ts')
  return {
    ...actual,
    getAlfaClubPublicClient: vi.fn(async () => ({
      async readContract(args: unknown) {
        const a = args as { functionName: string; args: [unknown, bigint] | [bigint] }
        if (a.functionName === 'totalSupply') return 100n
        if (a.functionName === 'balanceOf') return 40n
        if (a.functionName === 'creatorByTokenId') return '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
        return 0n
      },
      async getLogs() {
        return []
      },
    })),
  }
})

import { runVigilante } from '../../server/_lib/alfaclub/vigilante.ts'

const BASE_FLAGS = {
  killSwitch: false,
  readEnabled: true,
  postEnabled: false,
  feedbackEnabled: false,
  topN: 5,
  cooldownHours: 24,
}

const CREATORS = [
  {
    tokenId: 1n,
    creatorAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' as `0x${string}`,
    mintedAtBlock: 100n,
    stakingPool: null,
  },
  {
    tokenId: 2n,
    creatorAddress: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' as `0x${string}`,
    mintedAtBlock: 120n,
    stakingPool: null,
  },
]

beforeEach(() => {
  vi.clearAllMocks()
  listAllCreatorsMock.mockResolvedValue(CREATORS)
  runCreatorIndexerMock.mockResolvedValue({
    ok: true,
    dbConfigured: true,
    scannedFromBlock: 0n,
    scannedToBlock: 1000n,
    newCreators: 2,
    totalKnownCreators: 2,
  })
  getHyperliquidSnapshotMock.mockResolvedValue({
    address: '0x0',
    accountValueUsd: 10_000,
    pnl30dUsd: 50_000,
    fills30d: 10,
    fetchedAt: '2026-04-20T12:00:00Z',
    ok: true,
    errorReason: null,
  })
  tryUploadImmutableJsonMock.mockResolvedValue({
    ok: true,
    result: {
      storageKey: 'grove-key',
      gatewayUrl: 'https://gateway.example/grove-key',
      lensUri: 'lens://grove/grove-key',
      statusUrl: null,
    },
  })
  ensureSchemaMock.mockResolvedValue(undefined)
  recordPublicationMock.mockResolvedValue(true)
  insertMetricsSnapshotMock.mockResolvedValue(CREATORS.length)
  hasPublicationMock.mockResolvedValue(false)
})

describe('vigilante orchestrator — flag gating', () => {
  it('kill switch short-circuits before any work', async () => {
    const result = await runVigilante({ flags: { ...BASE_FLAGS, killSwitch: true } })
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('kill_switch')
    expect(insertMetricsSnapshotMock).not.toHaveBeenCalled()
    expect(recordPublicationMock).not.toHaveBeenCalled()
  })

  it('read_disabled returns early and records nothing', async () => {
    const result = await runVigilante({ flags: { ...BASE_FLAGS, readEnabled: false } })
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('read_disabled')
    expect(insertMetricsSnapshotMock).not.toHaveBeenCalled()
  })

  it('read-only run persists snapshot but never publishes', async () => {
    const result = await runVigilante({ flags: BASE_FLAGS })
    expect(result.ok).toBe(true)
    expect(result.rankedCreators).toBe(CREATORS.length)
    expect(insertMetricsSnapshotMock).toHaveBeenCalledTimes(1)
    expect(recordPublicationMock).not.toHaveBeenCalled()
    expect(result.publications).toHaveLength(0)
  })
})

describe('vigilante orchestrator — publishing', () => {
  it('post-only phase records a Lens publication per top-N creator', async () => {
    const postToLens = vi.fn(async () => 'lens://post/0xdeadbeef')
    const result = await runVigilante({
      flags: { ...BASE_FLAGS, postEnabled: true },
      postToLens,
    })
    expect(result.ok).toBe(true)
    expect(recordPublicationMock).toHaveBeenCalledTimes(CREATORS.length)
    for (const pub of result.publications) {
      expect(pub.lens?.ok).toBe(true)
    }
    expect(postToLens).toHaveBeenCalled()
  })

  it('skips an already-published creator in the same window', async () => {
    hasPublicationMock.mockImplementationOnce(async () => true)
    const result = await runVigilante({
      flags: { ...BASE_FLAGS, postEnabled: true },
    })
    const lens = result.publications.map((p) => p.lens)
    expect(lens.some((p) => p?.ok && 'alreadyPublished' in p && p.alreadyPublished === true)).toBe(true)
  })

  it('feedback-only with no signer queues ERC-8004 calldata in the ledger', async () => {
    const result = await runVigilante({
      flags: { ...BASE_FLAGS, feedbackEnabled: true },
      signer: null,
    })
    expect(result.ok).toBe(true)
    // Every top-N creator gets a queued record (kind='erc8004-queued') so the
    // admin can later submit the prepared calldata manually.
    const calls = recordPublicationMock.mock.calls.map(([input]) => input)
    const queuedCount = calls.filter((c) => c?.kind === 'erc8004-queued').length
    expect(queuedCount).toBe(CREATORS.length)
    const submittedCount = calls.filter((c) => c?.kind === 'erc8004-submitted').length
    expect(submittedCount).toBe(0)
  })

  it('feedback-on with a signer submits on-chain and attaches the tx hash', async () => {
    const send = vi.fn(async () => ({ ok: true as const, txHash: '0xabcabcabc' }))
    const result = await runVigilante({
      flags: { ...BASE_FLAGS, feedbackEnabled: true, topN: 1 },
      signer: { send, signerAddress: '0xdeadbeef00000000000000000000000000000000' },
    })
    expect(result.ok).toBe(true)
    expect(send).toHaveBeenCalledTimes(1)
    expect(result.signerAddress).toBe('0xdeadbeef00000000000000000000000000000000')
    const calls = recordPublicationMock.mock.calls.map(([input]) => input)
    const submitted = calls.find((c) => c?.kind === 'erc8004-submitted')
    expect(submitted).toBeDefined()
    expect(submitted?.erc8004TxHash).toBe('0xabcabcabc')
  })

  it('feedback submission failure falls back to queued', async () => {
    const send = vi.fn(async () => ({ ok: false as const, error: 'gas_too_low' }))
    const result = await runVigilante({
      flags: { ...BASE_FLAGS, feedbackEnabled: true, topN: 1 },
      signer: { send, signerAddress: '0xfeedfeed00000000000000000000000000000000' },
    })
    expect(result.ok).toBe(true)
    const calls = recordPublicationMock.mock.calls.map(([input]) => input)
    expect(calls.some((c) => c?.kind === 'erc8004-queued')).toBe(true)
    expect(result.publications[0]?.erc8004?.ok).toBe(false)
  })

  it('topN caps the publication count even when there are more ranked creators', async () => {
    const many = Array.from({ length: 10 }, (_, i) => ({
      tokenId: BigInt(i + 1),
      creatorAddress: `0x${'a'.repeat(39)}${i}` as `0x${string}`,
      mintedAtBlock: 100n + BigInt(i),
      stakingPool: null,
    }))
    listAllCreatorsMock.mockResolvedValue(many)
    const result = await runVigilante({
      flags: { ...BASE_FLAGS, postEnabled: true, topN: 3 },
      postToLens: async () => 'lens://post/x',
    })
    expect(result.publications).toHaveLength(3)
  })
})

describe('vigilante orchestrator — corner cases', () => {
  it('returns no_creators reason when the indexer finds zero rooms', async () => {
    listAllCreatorsMock.mockResolvedValue([])
    const result = await runVigilante({ flags: BASE_FLAGS })
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('no_creators')
    expect(insertMetricsSnapshotMock).not.toHaveBeenCalled()
  })

  it('skipIndexer bypasses the block scan and trusts listCreators override', async () => {
    const result = await runVigilante({
      flags: BASE_FLAGS,
      skipIndexer: true,
      listCreators: async () => CREATORS,
    })
    expect(result.ok).toBe(true)
    expect(runCreatorIndexerMock).not.toHaveBeenCalled()
  })
})
