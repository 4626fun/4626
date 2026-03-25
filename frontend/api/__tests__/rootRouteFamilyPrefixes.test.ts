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

    const { getApiHandler } = await import('../_handlers/_routes.ts')

    expect(await getApiHandler('uniswap/quote')).toBe(uniswapHandler)
    expect(await getApiHandler('image/external')).toBe(imageHandler)
    expect(await getApiHandler('telegram/miniapp/session')).toBe(telegramHandler)
    expect(await getApiHandler('keepr/nonce')).toBe(keeprHandler)
  })
})
