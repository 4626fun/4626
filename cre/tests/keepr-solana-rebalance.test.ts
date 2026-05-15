import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

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

// Checksum-canonical AKITA address (live v2 adapter + live AKITA token).
// Viem's isAddress is strict about EIP-55 checksumming; using a
// non-checksum string would cause readCreatorRegistrations() to silently
// drop the entry.
const ADAPTER = '0x653326dD0145656eC3b598943C0E84d7405aE6Ae'
const CREATOR = '0x5b674196812451B7cEC024FE9d22D2c0b172fa75'
// Valid base58 Solana pubkey (system program, 32 bytes of zeros).
const SOLANA_DEST = '11111111111111111111111111111111'
const METEORA_AV = '3duUsodw8Gda55WjXMyS9JSzXNAVbKuueigdmgCD6L8A'

import { executeSolanaRebalance } from '../actions/keepr-solana-rebalance.action.js'

const ENV_KEYS = [
  'SOLANA_BRIDGE_ADAPTER',
  'KPR_SOLANA_REBALANCE_EXECUTE',
  'KPR_SOLANA_REBALANCE_CREATORS_JSON',
  'KPR_SOLANA_REBALANCE_MIN_AMOUNT_MAP_JSON',
  'KPR_SOLANA_REBALANCE_FEE_WEI',
] as const

const savedEnv: Record<string, string | undefined> = {}

describe('executeSolanaRebalance', () => {
  beforeEach(() => {
    for (const k of ENV_KEYS) {
      savedEnv[k] = process.env[k]
      delete process.env[k]
    }
    process.env.SOLANA_BRIDGE_ADAPTER = ADAPTER
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
    // Below threshold (default 1e18)
    readContractMock.mockResolvedValueOnce(10n)
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
    // 2 tokens worth
    readContractMock.mockResolvedValueOnce(2_000_000_000_000_000_000n)
    const res = await executeSolanaRebalance()
    expect(res.creatorsWithAdapterBalance).toBe(1)
    expect(res.plan[0]).toMatchObject({
      dispatchMode: 'bridge_plain',
      destination: SOLANA_DEST,
      meteoraAlphaVault: null,
    })
    expect(res.executed).toBe(false)
    expect(writeContractMock).not.toHaveBeenCalled()
  })

  it('broadcasts plain bridge when KPR_SOLANA_REBALANCE_EXECUTE=1', async () => {
    process.env.KPR_SOLANA_REBALANCE_EXECUTE = '1'
    process.env.KPR_SOLANA_REBALANCE_CREATORS_JSON = JSON.stringify([
      { creatorToken: CREATOR, destinationPubkey: SOLANA_DEST },
    ])
    readContractMock.mockResolvedValueOnce(2_000_000_000_000_000_000n)
    writeContractMock.mockResolvedValueOnce({ success: true, txHash: '0xdeadbeef' })
    const res = await executeSolanaRebalance()
    expect(res.executed).toBe(true)
    expect(writeContractMock).toHaveBeenCalledTimes(1)
    const call = writeContractMock.mock.calls[0][0]
    expect(call.functionName).toBe('bridgeToSolana')
    expect(call.address.toLowerCase()).toBe(ADAPTER.toLowerCase())
    expect(res.plan[0].txHash).toBe('0xdeadbeef')
    expect(alertInfoMock).toHaveBeenCalled()
  })

  it('reports failure cleanly when writeContract returns success=false', async () => {
    process.env.KPR_SOLANA_REBALANCE_EXECUTE = '1'
    process.env.KPR_SOLANA_REBALANCE_CREATORS_JSON = JSON.stringify([
      { creatorToken: CREATOR, destinationPubkey: SOLANA_DEST },
    ])
    readContractMock.mockResolvedValueOnce(2_000_000_000_000_000_000n)
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
    readContractMock.mockResolvedValueOnce(2_000_000_000_000_000_000n)
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
    readContractMock.mockResolvedValueOnce(2_000_000_000_000_000_000n)
    const res = await executeSolanaRebalance()
    expect(res.plan[0].dispatchMode).toBe('bridge_with_meteora_ixs')
    expect(res.plan[0].notes).toMatch(/not yet implemented/i)
    expect(writeContractMock).not.toHaveBeenCalled()
  })

  it('marks a creator as skipped when balanceOf RPC fails', async () => {
    process.env.KPR_SOLANA_REBALANCE_CREATORS_JSON = JSON.stringify([
      { creatorToken: CREATOR, destinationPubkey: SOLANA_DEST },
    ])
    readContractMock.mockRejectedValueOnce(new Error('rpc timeout'))
    const res = await executeSolanaRebalance()
    expect(res.plan[0].dispatchMode).toBe('skip_below_threshold')
    expect(res.plan[0].notes).toMatch(/balanceOf RPC failed/i)
  })
})
