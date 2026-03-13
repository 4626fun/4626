import { beforeEach, describe, expect, it, vi } from 'vitest'

const preflightTrendTickerMock = vi.fn()
const reserveTrendTickerMock = vi.fn()
const upsertTrendPredictionMock = vi.fn()
const markTrendOpDeployingMock = vi.fn()
const markTrendOpDeployedMock = vi.fn()
const markTrendOpFailedMock = vi.fn()

vi.mock('./trends.js', () => ({
  preflightTrendTicker: preflightTrendTickerMock,
  reserveTrendTicker: reserveTrendTickerMock,
}))

vi.mock('../_lib/zoraTrendOpsStore.js', () => ({
  upsertTrendPrediction: upsertTrendPredictionMock,
  markTrendOpDeploying: markTrendOpDeployingMock,
  markTrendOpDeployed: markTrendOpDeployedMock,
  markTrendOpFailed: markTrendOpFailedMock,
}))

describe('trend launch sentinel', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    delete process.env.TREND_SENTINEL_ENABLED
    delete process.env.TREND_SENTINEL_CREATOR_TOKEN
    delete process.env.TREND_SENTINEL_TICKERS
    delete process.env.TREND_SENTINEL_GROUP_ID
    delete process.env.TREND_SENTINEL_MAX_RUNTIME_MS
  })

  it('returns disabled when sentinel is off', async () => {
    process.env.TREND_SENTINEL_ENABLED = 'false'
    const { runTrendLaunchSentinelProcess } = await import('./trendLaunchSentinel')
    const result = await runTrendLaunchSentinelProcess({
      deps: { sleep: async () => {}, now: () => Date.now(), random: () => 0 },
    })
    expect(result.status).toBe('disabled')
  })

  it('falls back from AI and secures 67', async () => {
    process.env.TREND_SENTINEL_ENABLED = 'true'
    process.env.TREND_SENTINEL_CREATOR_TOKEN = '0x2222222222222222222222222222222222222222'
    process.env.TREND_SENTINEL_TICKERS = 'AI,67,46'
    process.env.TREND_SENTINEL_GROUP_ID = 'trend-ai-launch-bot-v1'

    preflightTrendTickerMock
      .mockResolvedValueOnce({
        ticker: 'AI',
        tickerHash: '0xai',
        predictedAddress: '0x1111111111111111111111111111111111111111',
        deployed: true,
        deployedBytecode: '0x1234',
      })
      .mockResolvedValueOnce({
        ticker: '67',
        tickerHash: '0x67',
        predictedAddress: '0x6767676767676767676767676767676767676767',
        deployed: false,
        deployedBytecode: null,
      })

    reserveTrendTickerMock.mockResolvedValueOnce({
      ticker: '67',
      tickerHash: '0x67',
      predictedAddress: '0x6767676767676767676767676767676767676767',
      deployedAddress: '0x6767676767676767676767676767676767676767',
      deployed: true,
      txHash: '0xtx67',
      walletAddress: '0x3333333333333333333333333333333333333333',
      walletId: 'wallet_1',
      status: 'deployed',
    })

    const { runTrendLaunchSentinelProcess } = await import('./trendLaunchSentinel')
    const result = await runTrendLaunchSentinelProcess({
      deps: { sleep: async () => {}, now: () => Date.now(), random: () => 0 },
      overrides: { maxRuntimeMs: 10_000, pollMs: 1, jitterMs: 0 },
    })

    expect(result.status).toBe('secured')
    expect(result.securedTicker).toBe('67')
    expect(result.fallbackUsed).toBe(true)
    expect(markTrendOpDeployedMock).toHaveBeenCalled()
    expect(reserveTrendTickerMock).toHaveBeenCalledTimes(1)
  })

  it('returns misconfigured when creator token is missing', async () => {
    process.env.TREND_SENTINEL_ENABLED = 'true'
    process.env.TREND_SENTINEL_TICKERS = 'AI,67'
    const { runTrendLaunchSentinelProcess } = await import('./trendLaunchSentinel')
    const result = await runTrendLaunchSentinelProcess({
      deps: { sleep: async () => {}, now: () => Date.now(), random: () => 0 },
    })
    expect(result.status).toBe('misconfigured')
  })
})

