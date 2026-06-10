import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getAddress } from 'viem'

/**
 * Tests for the keeper's Solana rebalance action.
 *
 * Covers planning (read-only dry runs) + execution (writeContract
 * dispatch) for the plain-bridge path, plus the edge cases where we
 * intentionally skip:
 *   - balance below threshold
 *   - missing destination pubkey
 *   - Meteora-ixs routing (builder not yet implemented)
 *
 * The Solana-side balanceOf RPC, the adapter writeContract, and the
 * alert helpers are all mocked so the test stays fully offline.
 */

const {
  readContractMock,
  writeContractMock,
  alertInfoMock,
  alertWarningMock,
  alertCriticalMock,
} = vi.hoisted(() => ({
  readContractMock: vi.fn(),
  writeContractMock: vi.fn(),
  alertInfoMock: vi.fn(async () => {}),
  alertWarningMock: vi.fn(async () => {}),
  alertCriticalMock: vi.fn(async () => {}),
}))

vi.mock('../utils/onchain.js', () => ({
  getPublicClient: () => ({
    readContract: readContractMock,
  }),
  writeContract: writeContractMock,
}))

vi.mock('../utils/alerts.js', () => ({
  alertInfo: alertInfoMock,
  alertWarning: alertWarningMock,
  alertCritical: alertCriticalMock,
}))

// Checksum-canonical addresses.
const CANONICAL_ADAPTER = '0x700b4BBAf965c013123bAd02a6562FBa487aC0f1'
const LEGACY_ADAPTER = '0x2414b595c4f18532a5836b6e2e6d536832c572e8'
const CREATOR = '0x5b674196812451B7cEC024FE9d22D2c0b172fa75'
// Valid base58 Solana pubkey (system program, 32 bytes of zeros).
const SOLANA_DEST = '11111111111111111111111111111111'
const METEORA_AV = '3duUsodw8Gda55WjXMyS9JSzXNAVbKuueigdmgCD6L8A'

import {
  executeSolanaRebalance,
  findLargestAdapterBalance,
  resolveBridgeAdapterCandidates,
} from '../actions/keepr-solana-rebalance.action.js'
import { getPublicClient } from '../utils/onchain.js'

const ENV_KEYS = [
  'SOLANA_BRIDGE_ADAPTER',
  'KPR_SOLANA_REBALANCE_EXECUTE',
  'KPR_SOLANA_REBALANCE_CREATORS_JSON',
  'KPR_SOLANA_REBALANCE_MIN_AMOUNT_MAP_JSON',
  'KPR_SOLANA_REBALANCE_FEE_WEI',
  'KPR_SOLANA_LEGACY_BRIDGE_ADAPTERS',
] as const

const savedEnv: Record<string, string | undefined> = {}

function mockBalanceOfByAdapter(balances: Record<string, bigint | Error>) {
  const normalized = Object.fromEntries(
    Object.entries(balances).map(([addr, value]) => [getAddress(addr).toLowerCase(), value]),
  )
  readContractMock.mockImplementation(async (params: { args?: unknown[] }) => {
    const owner = getAddress(String((params.args as unknown[] | undefined)?.[0] ?? '0x0000000000000000000000000000000000000001')).toLowerCase()
    if (owner in normalized) {
      const value = normalized[owner]
      if (value instanceof Error) throw value
      return value
    }
    return 0n
  })
}

describe('executeSolanaRebalance', () => {
  beforeEach(() => {
    for (const k of ENV_KEYS) {
      savedEnv[k] = process.env[k]
      delete process.env[k]
    }
    process.env.SOLANA_BRIDGE_ADAPTER = CANONICAL_ADAPTER
    readContractMock.mockReset()
    writeContractMock.mockReset()
    alertInfoMock.mockClear()
    alertWarningMock.mockClear()
    alertCriticalMock.mockClear()
  })

  afterEach(() => {
    for (const k of ENV_KEYS) {
      if (savedEnv[k] !== undefined) process.env[k] = savedEnv[k]
      else delete process.env[k]
    }
  })

  it('returns empty plan when no creators are registered', async () => {
    const res = await executeSolanaRebalance()
    expect(res.creatorsScanned).toBe(0)
    expect(res.plan).toEqual([])
    expect(res.executed).toBe(false)
  })

  it('skips creators whose adapter balance is below threshold', async () => {
    process.env.KPR_SOLANA_REBALANCE_CREATORS_JSON = JSON.stringify([
      { creatorToken: CREATOR, destinationPubkey: SOLANA_DEST },
    ])
    mockBalanceOfByAdapter({ [CANONICAL_ADAPTER]: 10n, [LEGACY_ADAPTER]: 0n })
    const res = await executeSolanaRebalance()
    expect(res.creatorsScanned).toBe(1)
    expect(res.creatorsWithAdapterBalance).toBe(0)
    expect(res.plan).toHaveLength(1)
    expect(res.plan[0].dispatchMode).toBe('skip_below_threshold')
    expect(writeContractMock).not.toHaveBeenCalled()
  })

  it('plans a plain bridge dispatch (dry run, no writeContract)', async () => {
    process.env.KPR_SOLANA_REBALANCE_CREATORS_JSON = JSON.stringify([
      { creatorToken: CREATOR, destinationPubkey: SOLANA_DEST },
    ])
    mockBalanceOfByAdapter({ [CANONICAL_ADAPTER]: 2_000_000_000_000_000_000n, [LEGACY_ADAPTER]: 0n })
    const res = await executeSolanaRebalance()
    expect(res.creatorsWithAdapterBalance).toBe(1)
    expect(res.plan[0]).toMatchObject({
      dispatchMode: 'bridge_plain',
      destination: SOLANA_DEST,
      meteoraAlphaVault: null,
      bridgeAdapter: CANONICAL_ADAPTER,
    })
    expect(res.executed).toBe(false)
    expect(writeContractMock).not.toHaveBeenCalled()
  })

  it('prefers legacy adapter balance when it is larger than canonical', async () => {
    process.env.KPR_SOLANA_REBALANCE_CREATORS_JSON = JSON.stringify([
      {
        creatorToken: CREATOR,
        destinationPubkey: SOLANA_DEST,
        bridgeAdapter: LEGACY_ADAPTER,
      },
    ])
    mockBalanceOfByAdapter({
      [CANONICAL_ADAPTER]: 1_000_000_000_000_000_000n,
      [LEGACY_ADAPTER]: 3_000_000_000_000_000_000n,
    })
    const res = await executeSolanaRebalance()
    expect(res.plan[0].bridgeAdapter?.toLowerCase()).toBe(LEGACY_ADAPTER.toLowerCase())
    expect(res.plan[0].dispatchMode).toBe('bridge_plain')
  })

  it('broadcasts plain bridge when KPR_SOLANA_REBALANCE_EXECUTE=1', async () => {
    process.env.KPR_SOLANA_REBALANCE_EXECUTE = '1'
    process.env.KPR_SOLANA_REBALANCE_CREATORS_JSON = JSON.stringify([
      { creatorToken: CREATOR, destinationPubkey: SOLANA_DEST },
    ])
    mockBalanceOfByAdapter({ [CANONICAL_ADAPTER]: 2_000_000_000_000_000_000n, [LEGACY_ADAPTER]: 0n })
    writeContractMock.mockResolvedValueOnce({ success: true, txHash: '0xdeadbeef' })
    const res = await executeSolanaRebalance()
    expect(res.executed).toBe(true)
    expect(writeContractMock).toHaveBeenCalledTimes(1)
    const call = writeContractMock.mock.calls[0][0]
    expect(call.functionName).toBe('bridgeToSolana')
    expect(call.address.toLowerCase()).toBe(CANONICAL_ADAPTER.toLowerCase())
    expect(res.plan[0].txHash).toBe('0xdeadbeef')
    expect(alertInfoMock).toHaveBeenCalled()
  })

  it('reports failure cleanly when writeContract returns success=false', async () => {
    process.env.KPR_SOLANA_REBALANCE_EXECUTE = '1'
    process.env.KPR_SOLANA_REBALANCE_CREATORS_JSON = JSON.stringify([
      { creatorToken: CREATOR, destinationPubkey: SOLANA_DEST },
    ])
    mockBalanceOfByAdapter({ [CANONICAL_ADAPTER]: 2_000_000_000_000_000_000n, [LEGACY_ADAPTER]: 0n })
    writeContractMock.mockResolvedValueOnce({ success: false, error: 'bridge_paused' })
    const res = await executeSolanaRebalance()
    expect(res.plan[0].txError).toBe('bridge_paused')
    expect(res.plan[0].txHash).toBeUndefined()
    expect(alertWarningMock).toHaveBeenCalled()
  })

  it('refuses to bridge when destinationPubkey is missing', async () => {
    process.env.KPR_SOLANA_REBALANCE_CREATORS_JSON = JSON.stringify([
      { creatorToken: CREATOR }, // no destinationPubkey
    ])
    mockBalanceOfByAdapter({ [CANONICAL_ADAPTER]: 2_000_000_000_000_000_000n, [LEGACY_ADAPTER]: 0n })
    const res = await executeSolanaRebalance()
    expect(res.plan[0].dispatchMode).toBe('bridge_plain')
    expect(res.plan[0].destination).toBe(null)
    expect(res.plan[0].notes).toMatch(/destinationPubkey missing/i)
    expect(writeContractMock).not.toHaveBeenCalled()
  })

  it('does not broadcast Meteora-ixs path yet (marks plan without tx)', async () => {
    process.env.KPR_SOLANA_REBALANCE_EXECUTE = '1'
    process.env.KPR_SOLANA_REBALANCE_CREATORS_JSON = JSON.stringify([
      { creatorToken: CREATOR, destinationPubkey: SOLANA_DEST, meteoraAlphaVault: METEORA_AV },
    ])
    mockBalanceOfByAdapter({ [CANONICAL_ADAPTER]: 2_000_000_000_000_000_000n, [LEGACY_ADAPTER]: 0n })
    const res = await executeSolanaRebalance()
    expect(res.plan[0].dispatchMode).toBe('bridge_with_meteora_ixs')
    expect(res.plan[0].notes).toMatch(/not yet implemented/i)
    expect(writeContractMock).not.toHaveBeenCalled()
  })

  it('marks a creator as skipped when adapter balance scan fails', async () => {
    process.env.KPR_SOLANA_REBALANCE_CREATORS_JSON = JSON.stringify([
      { creatorToken: CREATOR, destinationPubkey: SOLANA_DEST },
    ])
    readContractMock.mockRejectedValue(new Error('rpc timeout'))
    const res = await executeSolanaRebalance()
    expect(res.plan[0].dispatchMode).toBe('skip_below_threshold')
    expect(res.plan[0].notes).toMatch(/adapter balance scan failed|no adapter balance readable/i)
  })
})

describe('resolveBridgeAdapterCandidates', () => {
  it('includes registration override, strategy adapter, canonical, and legacy adapters', async () => {
    readContractMock.mockResolvedValueOnce(LEGACY_ADAPTER)
    const publicClient = getPublicClient()
    const candidates = await resolveBridgeAdapterCandidates({
      canonicalAdapter: CANONICAL_ADAPTER as `0x${string}`,
      registration: {
        creatorToken: CREATOR as `0x${string}`,
        destinationPubkey: SOLANA_DEST,
        meteoraAlphaVault: null,
        bridgeAdapter: LEGACY_ADAPTER as `0x${string}`,
        solanaStrategyAddress: '0xC01a9f8E8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8' as `0x${string}`,
      },
      publicClient,
    })
    expect(candidates.map((a) => a.toLowerCase())).toEqual(
      expect.arrayContaining([
        LEGACY_ADAPTER.toLowerCase(),
        CANONICAL_ADAPTER.toLowerCase(),
      ]),
    )
  })
})

describe('findLargestAdapterBalance', () => {
  beforeEach(() => {
    readContractMock.mockReset()
  })

  it('returns the adapter with the highest ERC-20 balance', async () => {
    mockBalanceOfByAdapter({
      [CANONICAL_ADAPTER]: 100n,
      [LEGACY_ADAPTER]: 500n,
    })
    const publicClient = getPublicClient()
    const result = await findLargestAdapterBalance({
      creatorToken: CREATOR as `0x${string}`,
      adapters: [CANONICAL_ADAPTER, LEGACY_ADAPTER] as `0x${string}`[],
      publicClient,
    })
    expect(result?.adapter.toLowerCase()).toBe(LEGACY_ADAPTER.toLowerCase())
    expect(result?.balance).toBe(500n)
  })
})
