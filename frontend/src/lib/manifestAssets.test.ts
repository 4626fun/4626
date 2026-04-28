import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const frontendRoot = path.resolve(import.meta.dirname, '../..')
const publicRoot = path.join(frontendRoot, 'public')
const siteManifestPath = path.join(publicRoot, 'site.webmanifest')
const legacyManifestPath = path.join(publicRoot, 'manifest.json')
const marketingHtmlPath = path.join(frontendRoot, 'index.html')
const appHtmlPath = path.join(frontendRoot, 'app.html')
const telegramLinkHtmlPath = path.join(frontendRoot, 'telegram-link.html')
const htmlEntryPaths = [marketingHtmlPath, appHtmlPath]
const OG_SOCIAL_IMAGE_URL = 'https://4626.fun/social/og-image-1200x630.png'
const TWITTER_SOCIAL_IMAGE_URL = 'https://4626.fun/social/twitter-summary-large-image-1200x675.png'
const MINIAPP_HERO_URL = OG_SOCIAL_IMAGE_URL
const MINIAPP_SPLASH_URL = 'https://4626.fun/social/social-profile-avatar-1080x1080.png'

describe('public manifest assets', () => {
  it('ships every referenced manifest icon and screenshot in public for local dev', () => {
    const manifests = [siteManifestPath, legacyManifestPath].map((manifestPath) => JSON.parse(readFileSync(manifestPath, 'utf8')) as {
      icons?: Array<{ src?: string }>
      screenshots?: Array<{ src?: string }>
    })

    const assetPaths = manifests
      .flatMap((manifest) => [...(manifest.icons ?? []), ...(manifest.screenshots ?? [])])
      .map((asset) => String(asset?.src ?? '').trim())
      .filter(Boolean)

    expect(assetPaths.length).toBeGreaterThan(0)

    for (const assetPath of assetPaths) {
      const relativePath = assetPath.replace(/^\//, '')
      expect(existsSync(path.join(publicRoot, relativePath))).toBe(true)
    }
  })

  it('advertises the canonical brand install metadata contract', () => {
    const manifest = JSON.parse(readFileSync(siteManifestPath, 'utf8')) as {
      scope?: string
      theme_color?: string
      icons?: Array<{ src?: string; purpose?: string; sizes?: string }>
    }

    expect(manifest.scope).toBe('/')
    expect(manifest.theme_color).toBe('#DDA01C')

    expect(manifest.icons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ src: '/favicons/favicon-192x192.png', sizes: '192x192' }),
        expect.objectContaining({ src: '/favicons/favicon-512x512.png', sizes: '512x512' }),
        expect.objectContaining({ src: '/favicons/maskable-icon-192x192.png', purpose: 'maskable' }),
        expect.objectContaining({ src: '/favicons/maskable-icon-512x512.png', purpose: 'maskable' }),
      ]),
    )
  })

  it('keeps install metadata aligned in both HTML entry points', () => {
    for (const htmlPath of htmlEntryPaths) {
      const html = readFileSync(htmlPath, 'utf8')

      expect(html).toContain('<link rel="icon" type="image/png" sizes="32x32" href="/favicons/favicon-32x32.png" />')
      expect(html).toContain('<link rel="icon" type="image/png" sizes="16x16" href="/favicons/favicon-16x16.png" />')
      expect(html).toContain('<link rel="icon" type="image/svg+xml" href="/favicon.svg" />')
      expect(html).toContain('<link rel="apple-touch-icon" sizes="180x180" href="/favicons/apple-touch-icon.png" />')
      expect(html).toContain('<link rel="manifest" href="/site.webmanifest" crossorigin="use-credentials" />')
      expect(html).toContain('<meta name="theme-color" content="#DDA01C" />')
    }
  })

  it('keeps shell-level social assets aligned with their intended surfaces', () => {
    const marketingHtml = readFileSync(marketingHtmlPath, 'utf8')
    const appHtml = readFileSync(appHtmlPath, 'utf8')
    const telegramLinkHtml = readFileSync(telegramLinkHtmlPath, 'utf8')

    expect(marketingHtml).toContain(`<meta property="og:image" content="${OG_SOCIAL_IMAGE_URL}" />`)
    expect(marketingHtml).toContain(`<meta name="twitter:image" content="${TWITTER_SOCIAL_IMAGE_URL}" />`)
    expect(marketingHtml).not.toContain('miniapp-hero.png')
    expect(marketingHtml).not.toContain('miniapp-splash.png')
    expect(marketingHtml).not.toContain('app-hero.png?v=6')

    expect(appHtml).toContain(`<meta property="og:image" content="${OG_SOCIAL_IMAGE_URL}" />`)
    expect(appHtml).toContain(`<meta name="twitter:image" content="${TWITTER_SOCIAL_IMAGE_URL}" />`)
    expect(appHtml).toContain(`"imageUrl":"${MINIAPP_HERO_URL}"`)
    expect(appHtml).toContain(`"splashImageUrl":"${MINIAPP_SPLASH_URL}"`)
    expect(appHtml).not.toContain('https://app.4626.fun/app-hero.png')
    expect(appHtml).not.toContain('https://4626.fun/miniapp-hero.png')
    expect(appHtml).not.toContain('https://4626.fun/miniapp-splash.png')
    expect(appHtml).not.toContain('https://4626.fun/og-image.png')
    expect(appHtml).not.toContain('https://4626.fun/twitter-card.png')
    expect((appHtml.match(/<meta property="og:image"/g) ?? [])).toHaveLength(1)
    expect((appHtml.match(/<meta name="twitter:image"/g) ?? [])).toHaveLength(1)

    expect(telegramLinkHtml).toContain(`<meta property="og:image" content="${MINIAPP_HERO_URL}" />`)
    expect(telegramLinkHtml).toContain(`<meta name="twitter:image" content="${MINIAPP_HERO_URL}" />`)
    expect(telegramLinkHtml).not.toContain('app-hero.png?v=6')
  })
})
