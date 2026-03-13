import { beforeEach, describe, expect, it, vi } from 'vitest'

const getOrCreateCreatorAgentWalletMock = vi.fn()
const walletRpcMock = vi.fn()
const markTrendOpFunnelPendingMock = vi.fn()
const markTrendOpFunnelCompletedMock = vi.fn()
const markTrendOpFailedMock = vi.fn()
const originalFetch = globalThis.fetch
const TREND_ENV_KEYS = [
  'ZORA_TREND_AUTOMATION_ENABLED',
  'ZORA_TREND_FLYWHEEL_ENABLED',
  'ZORA_TREND_MAX_NOTIONAL_WEI',
  'ZORA_TREND_MAX_SLIPPAGE_BPS',
  'ZORA_TREND_ROUTEABILITY_REQUIRED',
  'ZORA_TREND_FLYWHEEL_TARGET_TOKEN',
  'ZORA_TREND_ALLOWED_TICKERS',
] as const
const TREND_ENV_BASELINE: Record<string, string | undefined> = Object.fromEntries(
  TREND_ENV_KEYS.map((key) => [key, process.env[key]]),
)

function resetTrendEnv() {
  for (const key of TREND_ENV_KEYS) {
    const value = TREND_ENV_BASELINE[key]
    if (typeof value === 'undefined') {
      delete process.env[key]
    } else {
      process.env[key] = value
    }
  }
}

vi.mock('../_lib/creatorAgentWallets.js', () => ({
  getOrCreateCreatorAgentWallet: getOrCreateCreatorAgentWalletMock,
}))

vi.mock('../_lib/privyWalletApi.js', () => ({
  walletRpc: walletRpcMock,
}))

vi.mock('../_lib/zoraTrendOpsStore.js', () => ({
  markTrendOpFunnelPending: markTrendOpFunnelPendingMock,
  markTrendOpFunnelCompleted: markTrendOpFunnelCompletedMock,
  markTrendOpFailed: markTrendOpFailedMock,
}))

describe('trend funnel config', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    resetTrendEnv()
  })

  afterEach(() => {
    resetTrendEnv()
    if (typeof originalFetch === 'function') {
      globalThis.fetch = originalFetch
    } else {
      delete (globalThis as any).fetch
    }
  })

  it('uses fail-closed defaults when env vars are unset', async () => {
    const { readTrendFunnelConfig } = await import('./trendFunnel')
    const cfg = readTrendFunnelConfig()
    expect(cfg.automationEnabled).toBe(false)
    expect(cfg.flywheelEnabled).toBe(false)
    expect(cfg.maxNotionalWei).toBe(0n)
    expect(cfg.routeabilityRequired).toBe(true)
    expect(cfg.targetToken).toBe(null)
  })
})

describe('runTrendFunnel', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    resetTrendEnv()
    ;(globalThis as any).fetch = vi.fn()
  })

  afterEach(() => {
    resetTrendEnv()
    if (typeof originalFetch === 'function') {
      globalThis.fetch = originalFetch
    } else {
      delete (globalThis as any).fetch
    }
  })

  it('skips execution when automation is disabled', async () => {
    process.env.ZORA_TREND_AUTOMATION_ENABLED = 'false'
    process.env.ZORA_TREND_FLYWHEEL_ENABLED = 'true'

    const { runTrendFunnel } = await import('./trendFunnel')
    const result = await runTrendFunnel({
      ticker: 'BASE',
      tickerHash: '0xaaa',
      trendCoinAddress: '0x1111111111111111111111111111111111111111',
      creatorToken: '0x2222222222222222222222222222222222222222',
      groupId: 'g1',
    })

    expect(result.status).toBe('skipped_disabled')
    expect(walletRpcMock).not.toHaveBeenCalled()
  })

  it('blocks writes when routeability is required but checks fail', async () => {
    process.env.ZORA_TREND_AUTOMATION_ENABLED = 'true'
    process.env.ZORA_TREND_FLYWHEEL_ENABLED = 'true'
    process.env.ZORA_TREND_MAX_NOTIONAL_WEI = '1000000000000000'
    process.env.ZORA_TREND_ROUTEABILITY_REQUIRED = 'true'
    process.env.ZORA_TREND_FLYWHEEL_TARGET_TOKEN = '0x9999999999999999999999999999999999999999'

    getOrCreateCreatorAgentWalletMock.mockResolvedValueOnce({
      walletId: 'wallet_1',
      address: '0x3333333333333333333333333333333333333333',
    })

    ;(globalThis as any).fetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => 'boom',
    })

    const { runTrendFunnel } = await import('./trendFunnel')
    const result = await runTrendFunnel({
      ticker: 'BASE',
      tickerHash: '0xbbb',
      trendCoinAddress: '0x1111111111111111111111111111111111111111',
      creatorToken: '0x2222222222222222222222222222222222222222',
      groupId: 'g2',
    })

    expect(result.status).toBe('blocked_routeability')
    expect(result.routeability.passed).toBe(false)
    expect(walletRpcMock).not.toHaveBeenCalled()
    expect(markTrendOpFunnelPendingMock).toHaveBeenCalledTimes(1)
  })

  it('executes guarded funnel action when checks pass', async () => {
    process.env.ZORA_TREND_AUTOMATION_ENABLED = 'true'
    process.env.ZORA_TREND_FLYWHEEL_ENABLED = 'true'
    process.env.ZORA_TREND_MAX_NOTIONAL_WEI = '1000000000000000'
    process.env.ZORA_TREND_MAX_SLIPPAGE_BPS = '300'
    process.env.ZORA_TREND_ROUTEABILITY_REQUIRED = 'true'
    process.env.ZORA_TREND_FLYWHEEL_TARGET_TOKEN = '0x9999999999999999999999999999999999999999'

    getOrCreateCreatorAgentWalletMock.mockResolvedValueOnce({
      walletId: 'wallet_2',
      address: '0x3333333333333333333333333333333333333333',
    })

    const quoteResponse = {
      call: {
        target: '0x7777777777777777777777777777777777777777',
        data: '0x1234',
        value: '0x0',
      },
    }
    ;(globalThis as any).fetch
      .mockResolvedValueOnce({ ok: true, json: async () => quoteResponse })
      .mockResolvedValueOnce({ ok: true, json: async () => quoteResponse })
      .mockResolvedValueOnce({ ok: true, json: async () => quoteResponse })
    walletRpcMock.mockResolvedValueOnce({ data: { hash: '0xabc123' } })

    const { runTrendFunnel } = await import('./trendFunnel')
    const result = await runTrendFunnel({
      ticker: 'BASE',
      tickerHash: '0xccc',
      trendCoinAddress: '0x1111111111111111111111111111111111111111',
      creatorToken: '0x2222222222222222222222222222222222222222',
      groupId: 'g3',
    })

    expect(result.status).toBe('executed')
    expect(result.action.executed).toBe(true)
    expect(result.action.txHash).toBe('0xabc123')
    expect(walletRpcMock).toHaveBeenCalledTimes(1)
    expect(walletRpcMock).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotencyKey:
          'trend-funnel:g3:0xccc:1000000000000000:0x9999999999999999999999999999999999999999',
      }),
    )
    expect(markTrendOpFunnelCompletedMock).toHaveBeenCalledTimes(1)
  })
})
