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
const siteConfigPath = path.join(frontendRoot, 'shared/site-config.json')
const trustPagePaths = [
  path.join(publicRoot, 'about/index.html'),
  path.join(publicRoot, 'privacy/index.html'),
  path.join(publicRoot, 'risks/index.html'),
  path.join(publicRoot, 'security/index.html'),
  path.join(publicRoot, 'terms/index.html'),
]
const siteConfig = JSON.parse(readFileSync(siteConfigPath, 'utf8')) as {
  brandAssetVersion?: number
  assets?: {
    favicon32?: string
    appleTouchIcon?: string
    miniappIcon?: string
    miniappSplash?: string
  }
}
const BRAND_ASSET_VERSION = Number(siteConfig.brandAssetVersion ?? 3)
const TAB_ICON_32 = `${siteConfig.assets?.favicon32 ?? '/assets/domain-bar-icon-32.png'}?v=${BRAND_ASSET_VERSION}`
const TAB_ICON_180 = `${siteConfig.assets?.appleTouchIcon ?? '/assets/domain-bar-icon-180.png'}?v=${BRAND_ASSET_VERSION}`
const MINIAPP_ICON_PATH = siteConfig.assets?.miniappIcon ?? '/assets/base-miniapp-icon-200.png'
const ANDROID_192 = `/assets/android-chrome-192x192.png?v=${BRAND_ASSET_VERSION}`
const ANDROID_512 = `/assets/android-chrome-512x512.png?v=${BRAND_ASSET_VERSION}`
const OG_SOCIAL_IMAGE_URL = `https://4626.fun/assets/og-image.png?v=${BRAND_ASSET_VERSION}`
const TWITTER_SOCIAL_IMAGE_URL = `https://4626.fun/assets/twitter-card.png?v=${BRAND_ASSET_VERSION}`
const MINIAPP_HERO_URL = OG_SOCIAL_IMAGE_URL
const MINIAPP_SPLASH_URL = `https://4626.fun${siteConfig.assets?.miniappSplash ?? MINIAPP_ICON_PATH}?v=${BRAND_ASSET_VERSION}`
const APP_SHELL_MINIAPP_SPLASH_URL = `https://app.4626.fun${siteConfig.assets?.miniappSplash ?? MINIAPP_ICON_PATH}?v=${BRAND_ASSET_VERSION}`
const APP_SHELL_TAB_ICON_32 = `https://app.4626.fun${siteConfig.assets?.favicon32 ?? '/assets/domain-bar-icon-32.png'}?v=${BRAND_ASSET_VERSION}`
const APP_SHELL_TAB_ICON_180 = `https://app.4626.fun${siteConfig.assets?.appleTouchIcon ?? '/assets/domain-bar-icon-180.png'}?v=${BRAND_ASSET_VERSION}`
const farcasterManifestPath = path.join(publicRoot, '.well-known/farcaster.json')

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
      const relativePath = assetPath.replace(/^\//, '').replace(/\?.*$/, '')
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
    expect(manifest.theme_color).toBe('#000000')

    expect(manifest.icons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ src: ANDROID_192, sizes: '192x192', purpose: 'any' }),
        expect.objectContaining({ src: ANDROID_512, sizes: '512x512', purpose: 'any' }),
      ]),
    )
    expect(manifest.icons?.some((icon) => icon.purpose === 'maskable')).toBe(false)
  })

  it('keeps install metadata aligned in both HTML entry points', () => {
    const marketingHtml = readFileSync(marketingHtmlPath, 'utf8')
    const appHtml = readFileSync(appHtmlPath, 'utf8')

    expect(marketingHtml).toContain(`<link rel="icon" type="image/png" sizes="32x32" href="${TAB_ICON_32}" />`)
    expect(marketingHtml).toContain(`<link rel="apple-touch-icon" sizes="180x180" href="${TAB_ICON_180}" />`)
    expect(marketingHtml).not.toContain('rel="mask-icon"')
    expect(marketingHtml).not.toContain('image/svg+xml')
    expect(marketingHtml).toContain('<link rel="manifest" href="/site.webmanifest" crossorigin="use-credentials" />')
    expect(marketingHtml).toContain('<meta name="theme-color" content="#000000" />')

    expect(appHtml).toContain(`<link rel="icon" type="image/png" sizes="32x32" href="${APP_SHELL_TAB_ICON_32}" />`)
    expect(appHtml).toContain(`<link rel="apple-touch-icon" sizes="180x180" href="${APP_SHELL_TAB_ICON_180}" />`)
    expect(appHtml).not.toContain('rel="shortcut icon"')
    expect(appHtml).not.toContain('rel="mask-icon"')
    expect(appHtml).toContain('<link rel="manifest" href="/site.webmanifest" crossorigin="use-credentials" />')
    expect(appHtml).toContain('<meta name="theme-color" content="#000000" />')
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
    expect(appHtml).toContain('<link rel="canonical" href="https://app.4626.fun/" />')
    expect(appHtml).toContain('<meta property="og:url" content="https://app.4626.fun/" />')
    expect(appHtml).toContain('"url":"https://4626.fun/"')
    expect(appHtml).toContain(`"splashImageUrl":"${APP_SHELL_MINIAPP_SPLASH_URL}"`)
    expect(appHtml).not.toContain('"url":"https://app.4626.fun/"')
    expect(appHtml).not.toContain('https://app.4626.fun/app-hero.png')
    expect(appHtml).not.toContain('https://4626.fun/miniapp-hero.png')
    expect(appHtml).not.toContain('https://4626.fun/miniapp-splash.png')
    expect(appHtml).not.toContain('https://4626.fun/og-image.png')
    expect(appHtml).not.toContain('https://4626.fun/twitter-card.png')
    expect((appHtml.match(/<meta property="og:image"/g) ?? [])).toHaveLength(1)
    expect((appHtml.match(/<meta name="twitter:image"/g) ?? [])).toHaveLength(1)

    expect(telegramLinkHtml).toContain(`<meta property="og:image" content="${MINIAPP_HERO_URL}" />`)
    expect(telegramLinkHtml).toContain(`<meta name="twitter:image" content="${MINIAPP_HERO_URL}" />`)
    expect(telegramLinkHtml).toContain(`<link rel="icon" type="image/png" sizes="32x32" href="${TAB_ICON_32}" />`)
    expect(telegramLinkHtml).not.toContain('app-hero.png?v=6')
  })

  it('keeps trust/legal static pages on the canonical favicon kit', () => {
    for (const htmlPath of trustPagePaths) {
      const html = readFileSync(htmlPath, 'utf8')

      expect(html).toContain(TAB_ICON_32)
      expect(html).toContain(TAB_ICON_180)
      expect(html).not.toContain('rel="mask-icon"')
      expect(html).not.toContain('image/svg+xml')
      expect(html).toContain('<link rel="manifest" href="/site.webmanifest">')
    }
  })

  it('keeps the marketing homepage immersive shell on the canonical favicon kit', () => {
    const immersiveHtml = readFileSync(path.join(publicRoot, 'immersive/index.html'), 'utf8')

    expect(immersiveHtml).toContain(TAB_ICON_32)
    expect(immersiveHtml).toContain('/favicon.ico')
    expect(immersiveHtml).not.toContain('rel="mask-icon"')
    expect(immersiveHtml).not.toContain('app-tab-icon-32.png?v=9')
  })

  it('ships root auto-discovery favicon paths for Base App domain bar', () => {
    for (const relativePath of [
      'favicon.ico',
      'favicon-16x16.png',
      'favicon-32x32.png',
      'apple-touch-icon.png',
      'apple-touch-icon-precomposed.png',
      'icon.png',
    ]) {
      expect(existsSync(path.join(publicRoot, relativePath))).toBe(true)
    }
  })

  it('points Base mini-app manifest iconUrl at the 200px domain icon asset', () => {
    const manifest = JSON.parse(readFileSync(farcasterManifestPath, 'utf8')) as {
      miniapp?: { iconUrl?: string; splashImageUrl?: string; version?: string }
    }

    expect(manifest.miniapp?.iconUrl).toBe(`https://4626.fun${MINIAPP_ICON_PATH}`)
    expect(manifest.miniapp?.splashImageUrl).toBe(`https://4626.fun${MINIAPP_ICON_PATH}`)
    expect(manifest.miniapp?.version).toBe('5')
    expect(existsSync(path.join(publicRoot, MINIAPP_ICON_PATH.replace(/^\//, '')))).toBe(true)
  })
})
