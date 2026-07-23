import { afterEach, describe, expect, it, vi } from 'vitest'

import robotsHandler from '../_handlers/seo/_robots.ts'
import sitemapHandler from '../_handlers/seo/_sitemap.ts'
import { createMockReq, createMockRes } from './helpers'

describe('seo route handlers', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('serves robots.txt with canonical sitemap reference', async () => {
    vi.stubEnv('APP_ORIGIN', 'https://4626.fun')
    const req = createMockReq({
      method: 'GET',
      headers: {
        host: '4626.fun',
      },
      url: '/robots.txt',
    })
    const res = createMockRes()

    await robotsHandler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.getHeader('content-type')).toBe('text/plain; charset=utf-8')
    expect(String(res.body)).toContain('User-agent: *')
    expect(String(res.body)).toContain('Allow: /explore/pools')
    expect(String(res.body)).toContain('Disallow: /explore/')
    expect(String(res.body)).toContain('Disallow: /faq')
    expect(String(res.body)).toContain('Disallow: /swap')
    expect(String(res.body)).toContain('Sitemap: https://4626.fun/sitemap.xml')
    expect(res.getHeader('x-content-type-options')).toBe('nosniff')
    expect(res.getHeader('x-frame-options')).toBe('DENY')
    expect(res.getHeader('referrer-policy')).toBe('no-referrer')
    expect(String(res.getHeader('content-security-policy') ?? '')).toContain("default-src 'none'")
  })

  it('serves sitemap.xml with indexable canonical URLs only', async () => {
    vi.stubEnv('APP_ORIGIN', 'https://4626.fun')
    const req = createMockReq({
      method: 'GET',
      headers: {
        host: '4626.fun',
      },
      url: '/sitemap.xml',
    })
    const res = createMockRes()

    await sitemapHandler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.getHeader('content-type')).toBe('application/xml; charset=utf-8')
    const xml = String(res.body)
    expect(xml).toContain('<loc>https://4626.fun/</loc>')
    expect(xml).toContain('<loc>https://4626.fun/explore/pools</loc>')
    expect(xml).not.toContain('<loc>https://4626.fun/faq</loc>')
    expect(xml).not.toContain('<loc>https://4626.fun/faq/how-it-works</loc>')
    expect(xml).not.toContain('/swap')
    expect(xml).not.toContain('/waitlist')
    expect(res.getHeader('x-content-type-options')).toBe('nosniff')
    expect(res.getHeader('x-frame-options')).toBe('DENY')
  })

  it('falls back to canonical public origin when APP_ORIGIN is non-canonical', async () => {
    vi.stubEnv('APP_ORIGIN', 'https://evil.example')
    const req = createMockReq({
      method: 'GET',
      headers: {
        host: 'evil.example',
      },
      url: '/robots.txt',
    })
    const res = createMockRes()

    await robotsHandler(req, res)

    expect(res.statusCode).toBe(200)
    expect(String(res.body)).toContain('Sitemap: https://4626.fun/sitemap.xml')
    expect(String(res.body)).not.toContain('https://evil.example/sitemap.xml')
  })
})

describe('key markets crawlable HTML', () => {
  it('serves indexable HTML for the clean markets hub', async () => {
    const { default: keyMarketsHandler } = await import('../_handlers/seo/_keyMarkets.ts')
    const req = createMockReq({
      method: 'GET',
      headers: { host: '4626.fun' },
      url: '/explore/pools',
      query: {},
    })
    const res = createMockRes()
    await keyMarketsHandler(req, res)
    expect(res.statusCode).toBe(200)
    expect(res.getHeader('content-type')).toBe('text/html; charset=utf-8')
    expect(res.getHeader('x-robots-tag')).toBe('index, follow')
    const html = String(res.body)
    expect(html).toContain('Official FriendKey markets on Sudoswap')
    expect(html).toContain('name="robots" content="index,follow')
    expect(html).toContain('https://4626.fun/explore/pools')
    expect(html).toContain('https://app.4626.fun/explore/pools')
  })

  it('noindexes query variants', async () => {
    const { default: keyMarketsHandler } = await import('../_handlers/seo/_keyMarkets.ts')
    const req = createMockReq({
      method: 'GET',
      headers: { host: '4626.fun' },
      url: '/explore/pools?q=akita',
      query: { q: 'akita' },
    })
    const res = createMockRes()
    await keyMarketsHandler(req, res)
    expect(res.statusCode).toBe(200)
    expect(res.getHeader('x-robots-tag')).toBe('noindex, follow')
    expect(String(res.body)).toContain('name="robots" content="noindex,follow"')
  })
})

