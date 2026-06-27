/**
 * Regression tests for the Arch B Phase 4 path of `/coin trend reserve`.
 *
 * Flag: ARCH_B_TREND_RESERVE_VIA_USEROP
 *
 * Verifies:
 *  - flag off  -> legacy reserveTrendTicker is used (no UserOp submit)
 *  - issuer not provisioned -> typed refusal + markTrendOpFailed
 *  - issuer revoked         -> typed refusal + markTrendOpFailed
 *  - issuer db_unavailable  -> typed refusal + markTrendOpFailed
 *  - TEE attestation denied via reserveTrendTickerViaUserOp refusal -> markTrendOpFailed(arch_b_tee_attestation_denied)
 *  - factory target mismatch -> markTrendOpFailed(arch_b_factory_target_mismatch)
 *  - UserOp caps exceeded    -> markTrendOpFailed(arch_b_userop_refused)
 *  - happy path deployed     -> markTrendOpDeployed + action.routing=arch-b-userop
 *  - happy path submitted    -> markTrendOpDeploying with tx + actor
 *  - ticker already deployed -> short-circuits before flag branch
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

// Feature flag must be set before module import so the Arch B branch is taken.
process.env.ARCH_B_TREND_RESERVE_VIA_USEROP = '1'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const resolveContextMock = vi.fn()
const preflightTrendTickerMock = vi.fn()
const reserveTrendTickerMock = vi.fn()
const reserveTrendTickerViaUserOpMock = vi.fn()

const upsertTrendPredictionMock = vi.fn().mockResolvedValue(undefined)
const markTrendOpDeployedMock = vi.fn().mockResolvedValue(undefined)
const markTrendOpDeployingMock = vi.fn().mockResolvedValue(undefined)
const markTrendOpFailedMock = vi.fn().mockResolvedValue(undefined)
const getTrendOpByTickerHashMock = vi.fn().mockResolvedValue(null)

const walletRpcMock = vi.fn()
const warnMock = vi.fn()

vi.mock('@4626/server-core', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    checkDurableRateLimit: vi.fn(async () => ({ allowed: true, remaining: 999, resetAt: Date.now() + 60_000, source: 'memory' })),
    resolveCommandIssuerContextByAddress: (...args: unknown[]) => resolveContextMock(...args),
    isExecutionReady: (resolution: { status: string }) => resolution.status === 'ready',
  }
})

vi.mock('../../server/_lib/wallet/commandIssuerContext.js', () => ({
  resolveCommandIssuerContextByAddress: (...args: unknown[]) => resolveContextMock(...args),
  isExecutionReady: (resolution: { status: string }) => resolution.status === 'ready',
}))

vi.mock('../../server/_lib/wallet/userOperationSubmitter.js', () => ({
  isArchBCoinBuyViaUserOpEnabled: () => false,
  isArchBCoinSellViaUserOpEnabled: () => false,
  isArchBTrendReserveViaUserOpEnabled: () =>
    String(process.env.ARCH_B_TREND_RESERVE_VIA_USEROP ?? '').trim() === '1',
  submitUserOpOrRefuse: vi.fn(),
}))

vi.mock('../../server/zora/trends.js', () => ({
  preflightTrendTicker: (...args: unknown[]) => preflightTrendTickerMock(...args),
  reserveTrendTicker: (...args: unknown[]) => reserveTrendTickerMock(...args),
  reserveTrendTickerViaUserOp: (...args: unknown[]) => reserveTrendTickerViaUserOpMock(...args),
}))

vi.mock('../../server/_lib/zora/zoraTrendOpsStore.js', () => ({
  upsertTrendPrediction: (...args: unknown[]) => upsertTrendPredictionMock(...args),
  markTrendOpDeployed: (...args: unknown[]) => markTrendOpDeployedMock(...args),
  markTrendOpDeploying: (...args: unknown[]) => markTrendOpDeployingMock(...args),
  markTrendOpFailed: (...args: unknown[]) => markTrendOpFailedMock(...args),
  getTrendOpByTickerHash: (...args: unknown[]) => getTrendOpByTickerHashMock(...args),
}))

// Legacy EOA path — stubbed; Arch B path must never hit this.
vi.mock('../../server/_lib/wallet/privyWalletApi.js', () => ({
  walletRpc: (...args: unknown[]) => walletRpcMock(...args),
  BASE_CAIP2: 'eip155:8453',
  secp256k1SignHash: vi.fn(),
}))

vi.mock('../../server/_lib/agent/teeAttestationGate.js', () => ({
  assertTeeAttestationOrThrow: vi.fn(),
}))

vi.mock('../../server/zora/routerAllowlist.js', () => ({
  checkRouterTarget: () => ({ allowed: true }),
}))

vi.mock('../../server/_lib/wallet/walletBalancePreflight.js', () => ({
  buildInsufficientFundsRefusal: () => 'friendly',
  checkWalletBalancePreflight: vi.fn(),
  getBasePreflightPublicClient: vi.fn(),
  isInsufficientFundsError: () => false,
}))

vi.mock('../../server/_lib/wallet/creatorAgentWallets.js', () => ({
  getOrCreateCreatorAgentWallet: vi.fn(),
}))

vi.mock('@zoralabs/coins-sdk', () => ({
  getTradeQuote: vi.fn(),
  getCoin: vi.fn(),
  getCoinSwap: vi.fn(),
  createCoinCall: vi.fn(),
}))

vi.mock('../../server/_lib/infra/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: (...args: unknown[]) => warnMock(...args),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

// Import under test AFTER mocks are set.
import { handleCoinCommand } from '../../server/zora/commands.js'

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const TICKER = '4626'
const TICKER_HASH = ('0x' + '42'.repeat(32)) as `0x${string}`
const PREDICTED_ADDRESS = '0x1111111111111111111111111111111111111111' as const
const SENDER_WALLET = '0xceca13f2686ed061c57620ecdf67e1b8c0f285e9' as const
const CSW = '0xab6d5c10b03300326cd7fab7267ae192842967b5' as const
const VAULT = {
  vaultAddress: '0x2222222222222222222222222222222222222222',
  chainId: 8453,
  groupId: 'group-1',
  lensGroupAddress: null,
  creatorCoinAddress: '0x3333333333333333333333333333333333333333',
  canonicalOwnerAddress: SENDER_WALLET,
  shareTokenAddress: null,
  gatingEnabled: false,
  joinLocked: false,
  gatingMode: 'open',
  minShares: null,
  failClosed: false,
  configVersion: 1,
  configHash: '0x0',
  config: {} as any,
} as any

const BASE_PREFLIGHT = {
  ticker: TICKER,
  tickerHash: TICKER_HASH,
  predictedAddress: PREDICTED_ADDRESS,
  deployed: false,
  deployedBytecode: null,
}

// Auto-incrementing group id to avoid handleCoinCommand's 60s per-group
// cooldown from short-circuiting later test cases with "Rate limited".
let _groupCounter = 0

function callReserve(overrides: { ticker?: string; text?: string; role?: string } = {}) {
  const ticker = overrides.ticker ?? TICKER
  const text = overrides.text ?? `/coin trend reserve ${ticker}`
  const groupId = `g-test-${++_groupCounter}`
  return handleCoinCommand({
    groupId,
    senderWallet: SENDER_WALLET,
    text,
    role: (overrides.role ?? 'ADMIN') as any,
    vault: VAULT,
  })
}

function issuerReady() {
  return {
    status: 'ready' as const,
    context: {
      profileId: 'profile-1',
      smartWallet: CSW,
      ownerAddress: SENDER_WALLET,
      ownerIndex: 0,
      quorumId: 'lr8vgu2l0wnmwg824n4jrtr3',
    },
  }
}

function okDeployedReservation() {
  return {
    ok: true as const,
    ticker: TICKER,
    tickerHash: TICKER_HASH,
    predictedAddress: PREDICTED_ADDRESS,
    deployedAddress: PREDICTED_ADDRESS,
    deployed: true,
    txHash: ('0x' + 'ab'.repeat(32)) as `0x${string}`,
    walletAddress: CSW,
    walletId: null,
    status: 'deployed' as const,
    userOpHash: ('0x' + 'cd'.repeat(32)) as `0x${string}`,
    smartWallet: CSW,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  preflightTrendTickerMock.mockResolvedValue(BASE_PREFLIGHT)
  resolveContextMock.mockResolvedValue(issuerReady())
  reserveTrendTickerViaUserOpMock.mockResolvedValue(okDeployedReservation())
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('/coin trend reserve — Arch B Phase 4', () => {
  it('flag off: uses the legacy reserveTrendTicker and never calls reserveTrendTickerViaUserOp', async () => {
    const prev = process.env.ARCH_B_TREND_RESERVE_VIA_USEROP
    process.env.ARCH_B_TREND_RESERVE_VIA_USEROP = '0'
    try {
      reserveTrendTickerMock.mockResolvedValue({
        ticker: TICKER,
        tickerHash: TICKER_HASH,
        predictedAddress: PREDICTED_ADDRESS,
        deployedAddress: PREDICTED_ADDRESS,
        deployed: true,
        txHash: '0xdeadbeef',
        walletAddress: '0x4444444444444444444444444444444444444444',
        walletId: 'legacy-wallet',
        status: 'deployed',
      })

      const result = await callReserve()

      expect(result.ok).toBe(true)
      expect(reserveTrendTickerMock).toHaveBeenCalledTimes(1)
      expect(reserveTrendTickerViaUserOpMock).not.toHaveBeenCalled()
      expect(resolveContextMock).not.toHaveBeenCalled()
    } finally {
      process.env.ARCH_B_TREND_RESERVE_VIA_USEROP = prev
    }
  })

  it('refuses when issuer is not provisioned and records markTrendOpFailed', async () => {
    resolveContextMock.mockResolvedValue({ status: 'not_provisioned' })

    const result = await callReserve()

    expect(result.ok).toBe(false)
    expect(String((result as any).response)).toContain("isn't provisioned for onchain execution yet")
    expect(reserveTrendTickerViaUserOpMock).not.toHaveBeenCalled()
    expect(markTrendOpFailedMock).toHaveBeenCalledWith(
      expect.objectContaining({
        tickerHash: TICKER_HASH,
        lastError: 'issuer_not_execution_ready:not_provisioned',
      }),
    )
  })

  it('refuses when issuer is revoked and records markTrendOpFailed', async () => {
    resolveContextMock.mockResolvedValue({ status: 'revoked' })

    const result = await callReserve()

    expect(result.ok).toBe(false)
    expect(String((result as any).response)).toContain('has been revoked')
    expect(markTrendOpFailedMock).toHaveBeenCalledWith(
      expect.objectContaining({
        lastError: 'issuer_not_execution_ready:revoked',
      }),
    )
  })

  it('refuses when issuer readiness db is unavailable', async () => {
    resolveContextMock.mockResolvedValue({ status: 'db_unavailable' })

    const result = await callReserve()

    expect(result.ok).toBe(false)
    expect(String((result as any).response)).toContain('account readiness storage is temporarily unavailable')
    expect(markTrendOpFailedMock).toHaveBeenCalledWith(
      expect.objectContaining({
        lastError: 'issuer_not_execution_ready:db_unavailable',
      }),
    )
  })

  it('maps TEE attestation refusal from reserveTrendTickerViaUserOp to markTrendOpFailed(arch_b_tee_attestation_denied)', async () => {
    reserveTrendTickerViaUserOpMock.mockResolvedValue({
      ok: false,
      code: 'tee_attestation_denied',
      response: 'Trend reserve denied: secure signer attestation is not verified.',
    })

    const result = await callReserve()

    expect(result.ok).toBe(false)
    expect(String((result as any).response)).toContain('secure signer attestation')
    expect(markTrendOpFailedMock).toHaveBeenCalledWith(
      expect.objectContaining({ lastError: 'arch_b_tee_attestation_denied' }),
    )
  })

  it('maps factory_target_mismatch refusal to markTrendOpFailed(arch_b_factory_target_mismatch)', async () => {
    reserveTrendTickerViaUserOpMock.mockResolvedValue({
      ok: false,
      code: 'factory_target_mismatch',
      response: "Trend reserve blocked: the TrendCoin factory address didn't match the configured value.",
    })

    const result = await callReserve()

    expect(result.ok).toBe(false)
    expect(String((result as any).response)).toContain('factory address')
    expect(markTrendOpFailedMock).toHaveBeenCalledWith(
      expect.objectContaining({ lastError: 'arch_b_factory_target_mismatch' }),
    )
  })

  it('maps UserOp submitter refusal (caps exceeded) to markTrendOpFailed(arch_b_userop_refused)', async () => {
    reserveTrendTickerViaUserOpMock.mockResolvedValue({
      ok: false,
      code: 'userop_refused',
      response: 'Daily cap reached.',
    })

    const result = await callReserve()

    expect(result.ok).toBe(false)
    expect((result as any).response).toBe('Daily cap reached.')
    expect(markTrendOpFailedMock).toHaveBeenCalledWith(
      expect.objectContaining({ lastError: 'arch_b_userop_refused' }),
    )
  })

  it('happy path — deployed: calls markTrendOpDeployed and emits action routing=arch-b-userop', async () => {
    const result = await callReserve()

    expect(result.ok).toBe(true)
    expect(reserveTrendTickerViaUserOpMock).toHaveBeenCalledWith(
      expect.objectContaining({
        ticker: TICKER,
        groupId: expect.stringMatching(/^g-test-\d+$/),
        issuer: expect.objectContaining({ smartWallet: CSW }),
        waitForReceipt: true,
      }),
    )
    expect(markTrendOpDeployedMock).toHaveBeenCalledWith(
      expect.objectContaining({
        tickerHash: TICKER_HASH,
        deployedCoinAddress: PREDICTED_ADDRESS,
      }),
    )
    expect(markTrendOpFailedMock).not.toHaveBeenCalled()
    const action = (result as any).action
    expect(action).toMatchObject({
      action: 'zora.trend.reserve',
      ticker: TICKER,
      routing: 'arch-b-userop',
      smartWallet: CSW,
    })
    // Legacy EOA path must not be invoked.
    expect(walletRpcMock).not.toHaveBeenCalled()
    expect(reserveTrendTickerMock).not.toHaveBeenCalled()
  })

  it('happy path — submitted-but-not-yet-deployed: calls markTrendOpDeploying with tx + actor', async () => {
    reserveTrendTickerViaUserOpMock.mockResolvedValue({
      ...okDeployedReservation(),
      deployed: false,
      status: 'submitted',
    })

    const result = await callReserve()

    expect(result.ok).toBe(true)
    // Two markTrendOpDeploying calls: the prelude one, and the post-submit one.
    expect(markTrendOpDeployingMock).toHaveBeenCalledTimes(2)
    expect(markTrendOpDeployingMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        tickerHash: TICKER_HASH,
        actorWallet: CSW,
      }),
    )
    expect(markTrendOpDeployedMock).not.toHaveBeenCalled()
  })

  it('short-circuits when preflight reports already deployed (never enters the flag branch)', async () => {
    preflightTrendTickerMock.mockResolvedValue({
      ...BASE_PREFLIGHT,
      deployed: true,
      deployedBytecode: '0x60',
    })

    const result = await callReserve()

    expect(result.ok).toBe(true)
    expect(String((result as any).response)).toContain('Trend already deployed')
    expect(reserveTrendTickerViaUserOpMock).not.toHaveBeenCalled()
    expect(reserveTrendTickerMock).not.toHaveBeenCalled()
    expect(markTrendOpDeployedMock).toHaveBeenCalledWith(
      expect.objectContaining({
        tickerHash: TICKER_HASH,
        deployedCoinAddress: PREDICTED_ADDRESS,
      }),
    )
  })
})

describe('/coin create removal', () => {
  it('no longer accepts /coin create and returns an unknown-command error', async () => {
    const result = await callReserve({ text: '/coin create MyCoin MYC ipfs://Qm...' })

    expect(result.ok).toBe(false)
    expect(String((result as any).response)).toContain('Unknown coin command: create')
  })
})
