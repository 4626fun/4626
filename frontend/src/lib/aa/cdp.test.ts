import { afterEach, describe, expect, it, vi } from 'vitest'

const ORIGIN = 'https://app.4626.fun'
const ORIGINAL_ENV = import.meta.env.PROD

function setWindowOrigin(origin: string) {
  vi.stubGlobal('window', { location: { origin } })
}

function setProdEnv(value: boolean) {
  vi.stubEnv('PROD', value)
}

describe('resolveCdpPaymasterUrl', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    setProdEnv(Boolean(ORIGINAL_ENV))
  })

  it('forces same-origin proxy in production when paymaster exists', async () => {
    setWindowOrigin(ORIGIN)
    setProdEnv(true)
    const { resolveCdpPaymasterUrl } = await import('./cdp')
    expect(resolveCdpPaymasterUrl('https://api.developer.coinbase.com/rpc/v1/base/key')).toBe(
      `${ORIGIN}/api/paymaster`,
    )
  })

  it('normalizes proxy path to same-origin absolute URL', async () => {
    setWindowOrigin(ORIGIN)
    setProdEnv(false)
    const { resolveCdpPaymasterUrl } = await import('./cdp')
    expect(resolveCdpPaymasterUrl('/api/paymaster')).toBe(`${ORIGIN}/api/paymaster`)
  })

  it('preserves non-proxy URL outside the browser', async () => {
    vi.unstubAllGlobals()
    setProdEnv(false)
    const { resolveCdpPaymasterUrl } = await import('./cdp')
    expect(resolveCdpPaymasterUrl('https://bundler.invalid')).toBe('https://bundler.invalid/')
  })

  it('forces same-origin proxy in browser even outside production', async () => {
    setWindowOrigin(ORIGIN)
    setProdEnv(false)
    const { resolveCdpPaymasterUrl } = await import('./cdp')
    expect(resolveCdpPaymasterUrl('https://bundler.invalid')).toBe(`${ORIGIN}/api/paymaster`)
  })

  it('returns null for empty input', async () => {
    setWindowOrigin(ORIGIN)
    setProdEnv(false)
    const { resolveCdpPaymasterUrl } = await import('./cdp')
    expect(resolveCdpPaymasterUrl('')).toBeNull()
    expect(resolveCdpPaymasterUrl(null)).toBeNull()
  })
})
