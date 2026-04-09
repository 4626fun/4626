import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('root api route family prefixes', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('dispatches merged thin family routes through the root catch-all map', async () => {
    const uniswapHandler = vi.fn()
    const imageHandler = vi.fn()
    const telegramHandler = vi.fn()
    const keeprHandler = vi.fn()
    const tokenImageHandler = vi.fn()
    const telegramWebhookHandler = vi.fn()
    const v1Handler = vi.fn()

    vi.doMock('../_handlers/_routes.uniswap.js', () => ({
      uniswapRouteLoaders: {
        quote: async () => ({ default: uniswapHandler }),
      },
    }))
    vi.doMock('../_handlers/_routes.image.js', () => ({
      imageRouteLoaders: {
        external: async () => ({ default: imageHandler }),
      },
    }))
    vi.doMock('../_handlers/_routes.telegram.js', () => ({
      telegramRouteLoaders: {
        'miniapp/session': async () => ({ default: telegramHandler }),
      },
    }))
    vi.doMock('../_handlers/_routes.keepr.js', () => ({
      keeprRouteLoaders: {
        nonce: async () => ({ default: keeprHandler }),
      },
    }))
    vi.doMock('../_handlers/token/_image.js', () => ({
      default: tokenImageHandler,
    }))
    vi.doMock('../_handlers/telegram/_webhook.js', () => ({
      default: telegramWebhookHandler,
    }))
    vi.doMock('../_handlers/_routes.v1.js', () => ({
      getV1ApiHandler: vi.fn(async (subpath: string) => (subpath === 'spec.json' ? v1Handler : null)),
    }))

    const { getApiHandler } = await import('../_handlers/_routes.ts')

    expect(await getApiHandler('uniswap/quote')).toBe(uniswapHandler)
    expect(await getApiHandler('image/external')).toBe(imageHandler)
    expect(await getApiHandler('telegram/miniapp/session')).toBe(telegramHandler)
    expect(await getApiHandler('keepr/nonce')).toBe(keeprHandler)
    expect(await getApiHandler('token/image')).toBe(tokenImageHandler)
    expect(await getApiHandler('telegram/webhook')).toBe(telegramWebhookHandler)
    expect(await getApiHandler('v1/spec.json')).toBe(v1Handler)
    expect(await getApiHandler('agent/invokeSkill')).toBeNull()
    expect(await getApiHandler('creator-access/debug')).toBeNull()
    expect(await getApiHandler('revert-finance')).toBeNull()
    expect(await getApiHandler('dexscreener/tokenStatsBatch')).toBeNull()
    expect(await getApiHandler('openclaw/tools')).toBeNull()
    expect(await getApiHandler('creator-wallets/claim')).toBeNull()
    expect(await getApiHandler('onchain/coinMarketRewardsByCoin')).toBeNull()
    expect(await getApiHandler('onchain/coinMarketRewardsCurrency')).toBeNull()
    expect(await getApiHandler('admin/creator-access/note')).toBeNull()
    expect(await getApiHandler('admin/creator-access/restore')).toBeNull()
    expect(await getApiHandler('social/twitter')).toBeNull()
    expect(await getApiHandler('admin/db/index-usage')).toBeNull()
    expect(await getApiHandler('admin/wallet/canonical-owner-link-status')).toBeNull()
    expect(await getApiHandler('admin/wallet/duplicate-principals')).toBeNull()
  })
})
