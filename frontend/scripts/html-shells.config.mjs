import fs from 'node:fs'

import { resolveCanvasTokens } from './canvasTokens.mjs'

const SHARED_SITE_META = JSON.parse(
  fs.readFileSync(new URL('../shared/site-meta.json', import.meta.url), 'utf8'),
)
const SHARED_SITE_CONFIG = JSON.parse(
  fs.readFileSync(new URL('../shared/site-config.json', import.meta.url), 'utf8'),
)

const CANVAS_TOKENS = resolveCanvasTokens(SHARED_SITE_CONFIG)

function trimTrailingSlash(url) {
  return String(url).replace(/\/+$/, '')
}

function withTrailingSlash(url) {
  return `${trimTrailingSlash(url)}/`
}

function buildAbsoluteUrl(baseUrl, assetPath, version) {
  const normalizedBaseUrl = trimTrailingSlash(baseUrl)
  const normalizedAssetPath = assetPath.startsWith('/') ? assetPath : `/${assetPath}`
  const suffix = version ? `?v=${encodeURIComponent(String(version))}` : ''
  return `${normalizedBaseUrl}${normalizedAssetPath}${suffix}`
}

const BRAND_ASSET_VERSION = Number(SHARED_SITE_CONFIG.brandAssetVersion ?? 3)
const APP_SHELL_ORIGIN = trimTrailingSlash(SHARED_SITE_CONFIG.appUrl ?? 'https://app.4626.fun')

const BASE_HTML_SHELL_CONFIG = {
  appBaseUrl: SHARED_SITE_CONFIG.url,
  marketingSocialImagePath: SHARED_SITE_CONFIG.assets.ogImage,
  marketingSocialImageVersion: BRAND_ASSET_VERSION,
  appSocialImagePath: SHARED_SITE_CONFIG.assets.ogImage,
  appSocialImageVersion: BRAND_ASSET_VERSION,
  twitterCardImagePath: SHARED_SITE_CONFIG.assets.twitterImage,
  twitterCardImageVersion: BRAND_ASSET_VERSION,
  ogImageWidth: '1200',
  ogImageHeight: '630',
  // Base App manifest expects a 1024px PNG; use the opaque tile (not 200px splash or og-image).
  miniappHeroPath: SHARED_SITE_CONFIG.assets.baseAppIcon,
  miniappHeroVersion: BRAND_ASSET_VERSION,
  miniappSplashPath: SHARED_SITE_CONFIG.assets.miniappSplash,
  miniappSplashVersion: BRAND_ASSET_VERSION,
  siteAppName: SHARED_SITE_META.siteAppName,
  siteName: SHARED_SITE_META.siteName,
  siteTitle: SHARED_SITE_META.siteTitle,
  siteDescription: SHARED_SITE_META.siteDescription,
  siteSocialDescription: SHARED_SITE_META.siteSocialDescription,
  siteImageAlt: SHARED_SITE_META.siteImageAlt,
  siteKeywords: SHARED_SITE_CONFIG.keywords,
  siteAuthor: '4626.fun',
  siteAuthorUrl: SHARED_SITE_CONFIG.url,
  siteAuthorEmail: 'hello@4626.fun',
  themeColor: SHARED_SITE_CONFIG.themeColor,
  msTileColor: SHARED_SITE_CONFIG.themeColor,
  brandBlue: SHARED_SITE_CONFIG.brandBlue,
  telegramLinkTitle: SHARED_SITE_META.telegramLinkTitle,
  telegramLinkDescription: SHARED_SITE_META.telegramLinkDescription,
  telegramLinkUrl: 'https://4626.fun/telegram/link',
  baseAppId: '695a49dc4d3a403912ed8ca5',
  talentappProjectVerification:
    '4b7b5b97d054b1a85c4d9635e53e928824fe96da81482cdecc54993bbe539de3df58eba944a698e62a7e6d5bad8b974254b2770354f4f3521c083c74a74af0da',
  miniappLaunchName: '4626.fun',
  miniappSplashBackgroundColor: SHARED_SITE_CONFIG.themeColor,
  faviconIcoPath: `${SHARED_SITE_CONFIG.assets.faviconIco}?v=${BRAND_ASSET_VERSION}`,
  faviconSvgPath: `${SHARED_SITE_CONFIG.assets.faviconSvg}?v=${BRAND_ASSET_VERSION}`,
  favicon64Path: `${SHARED_SITE_CONFIG.assets.favicon64}?v=${BRAND_ASSET_VERSION}`,
  favicon48Path: `${SHARED_SITE_CONFIG.assets.favicon48}?v=${BRAND_ASSET_VERSION}`,
  favicon32Path: `${SHARED_SITE_CONFIG.assets.favicon32}?v=${BRAND_ASSET_VERSION}`,
  favicon16Path: `${SHARED_SITE_CONFIG.assets.favicon16}?v=${BRAND_ASSET_VERSION}`,
  appleTouchIconPath: `${SHARED_SITE_CONFIG.assets.appleTouchIcon}?v=${BRAND_ASSET_VERSION}`,
  safariPinnedTabPath: `${SHARED_SITE_CONFIG.assets.safariPinnedTab}?v=${BRAND_ASSET_VERSION}`,
  organizationLogoUrl: buildAbsoluteUrl(
    SHARED_SITE_CONFIG.url,
    SHARED_SITE_CONFIG.assets.logoPng,
    BRAND_ASSET_VERSION,
  ),
}

export const HTML_SHELL_CONFIG = Object.freeze({
  ...BASE_HTML_SHELL_CONFIG,
  appBaseUrlTrailing: withTrailingSlash(BASE_HTML_SHELL_CONFIG.appBaseUrl),
  marketingSocialImageUrl: buildAbsoluteUrl(
    BASE_HTML_SHELL_CONFIG.appBaseUrl,
    BASE_HTML_SHELL_CONFIG.marketingSocialImagePath,
    BASE_HTML_SHELL_CONFIG.marketingSocialImageVersion,
  ),
  appSocialImageUrl: buildAbsoluteUrl(
    BASE_HTML_SHELL_CONFIG.appBaseUrl,
    BASE_HTML_SHELL_CONFIG.appSocialImagePath,
    BASE_HTML_SHELL_CONFIG.appSocialImageVersion,
  ),
  twitterCardImageUrl: buildAbsoluteUrl(
    BASE_HTML_SHELL_CONFIG.appBaseUrl,
    BASE_HTML_SHELL_CONFIG.twitterCardImagePath,
    BASE_HTML_SHELL_CONFIG.twitterCardImageVersion,
  ),
  miniappHeroUrl: buildAbsoluteUrl(
    BASE_HTML_SHELL_CONFIG.appBaseUrl,
    BASE_HTML_SHELL_CONFIG.miniappHeroPath,
    BASE_HTML_SHELL_CONFIG.miniappHeroVersion,
  ),
  miniappSplashUrl: buildAbsoluteUrl(
    BASE_HTML_SHELL_CONFIG.appBaseUrl,
    BASE_HTML_SHELL_CONFIG.miniappSplashPath,
    BASE_HTML_SHELL_CONFIG.miniappSplashVersion,
  ),
  appShellUrlTrailing: withTrailingSlash(APP_SHELL_ORIGIN),
  appShellFaviconIcoUrl: buildAbsoluteUrl(
    APP_SHELL_ORIGIN,
    SHARED_SITE_CONFIG.assets.faviconIco,
    BRAND_ASSET_VERSION,
  ),
  appShellFavicon32Url: buildAbsoluteUrl(
    APP_SHELL_ORIGIN,
    SHARED_SITE_CONFIG.assets.favicon32,
    BRAND_ASSET_VERSION,
  ),
  appShellFavicon16Url: buildAbsoluteUrl(
    APP_SHELL_ORIGIN,
    SHARED_SITE_CONFIG.assets.favicon16,
    BRAND_ASSET_VERSION,
  ),
  appShellAppleTouchIconUrl: buildAbsoluteUrl(
    APP_SHELL_ORIGIN,
    SHARED_SITE_CONFIG.assets.appleTouchIcon,
    BRAND_ASSET_VERSION,
  ),
  appShellMiniappSplashUrl: buildAbsoluteUrl(
    APP_SHELL_ORIGIN,
    BASE_HTML_SHELL_CONFIG.miniappSplashPath,
    BASE_HTML_SHELL_CONFIG.miniappSplashVersion,
  ),
})

export const HTML_SHELL_TEMPLATE_VARS = {
  APP_BASE_URL: HTML_SHELL_CONFIG.appBaseUrl,
  APP_BASE_URL_TRAILING: HTML_SHELL_CONFIG.appBaseUrlTrailing,
  MARKETING_SOCIAL_IMAGE_URL: HTML_SHELL_CONFIG.marketingSocialImageUrl,
  APP_SOCIAL_IMAGE_URL: HTML_SHELL_CONFIG.appSocialImageUrl,
  TWITTER_CARD_IMAGE_URL: HTML_SHELL_CONFIG.twitterCardImageUrl,
  OG_IMAGE_WIDTH: HTML_SHELL_CONFIG.ogImageWidth,
  OG_IMAGE_HEIGHT: HTML_SHELL_CONFIG.ogImageHeight,
  MINIAPP_HERO_URL: HTML_SHELL_CONFIG.miniappHeroUrl,
  MINIAPP_SPLASH_URL: HTML_SHELL_CONFIG.miniappSplashUrl,
  APP_SHELL_URL_TRAILING: HTML_SHELL_CONFIG.appShellUrlTrailing,
  APP_SHELL_FAVICON_ICO_URL: HTML_SHELL_CONFIG.appShellFaviconIcoUrl,
  APP_SHELL_FAVICON_32_URL: HTML_SHELL_CONFIG.appShellFavicon32Url,
  APP_SHELL_FAVICON_16_URL: HTML_SHELL_CONFIG.appShellFavicon16Url,
  APP_SHELL_APPLE_TOUCH_URL: HTML_SHELL_CONFIG.appShellAppleTouchIconUrl,
  APP_SHELL_MINIAPP_SPLASH_URL: HTML_SHELL_CONFIG.appShellMiniappSplashUrl,
  SITE_APP_NAME: HTML_SHELL_CONFIG.siteAppName,
  SITE_NAME: HTML_SHELL_CONFIG.siteName,
  SITE_TITLE: HTML_SHELL_CONFIG.siteTitle,
  SITE_DESCRIPTION: HTML_SHELL_CONFIG.siteDescription,
  SITE_SOCIAL_DESCRIPTION: HTML_SHELL_CONFIG.siteSocialDescription,
  SITE_IMAGE_ALT: HTML_SHELL_CONFIG.siteImageAlt,
  SITE_KEYWORDS: HTML_SHELL_CONFIG.siteKeywords,
  SITE_AUTHOR: HTML_SHELL_CONFIG.siteAuthor,
  SITE_AUTHOR_URL: HTML_SHELL_CONFIG.siteAuthorUrl,
  SITE_AUTHOR_EMAIL: HTML_SHELL_CONFIG.siteAuthorEmail,
  THEME_COLOR: HTML_SHELL_CONFIG.themeColor,
  MS_TILE_COLOR: HTML_SHELL_CONFIG.msTileColor,
  BRAND_BLUE: HTML_SHELL_CONFIG.brandBlue,
  FAVICON_ICO_PATH: HTML_SHELL_CONFIG.faviconIcoPath,
  FAVICON_SVG_PATH: HTML_SHELL_CONFIG.faviconSvgPath,
  FAVICON_64_PATH: HTML_SHELL_CONFIG.favicon64Path,
  FAVICON_48_PATH: HTML_SHELL_CONFIG.favicon48Path,
  FAVICON_32_PATH: HTML_SHELL_CONFIG.favicon32Path,
  FAVICON_16_PATH: HTML_SHELL_CONFIG.favicon16Path,
  APPLE_TOUCH_ICON_PATH: HTML_SHELL_CONFIG.appleTouchIconPath,
  SAFARI_PINNED_TAB_PATH: HTML_SHELL_CONFIG.safariPinnedTabPath,
  ORGANIZATION_LOGO_URL: HTML_SHELL_CONFIG.organizationLogoUrl,
  TELEGRAM_LINK_TITLE: HTML_SHELL_CONFIG.telegramLinkTitle,
  TELEGRAM_LINK_DESCRIPTION: HTML_SHELL_CONFIG.telegramLinkDescription,
  TELEGRAM_LINK_URL: HTML_SHELL_CONFIG.telegramLinkUrl,
  BASE_APP_ID: HTML_SHELL_CONFIG.baseAppId,
  TALENTAPP_PROJECT_VERIFICATION: HTML_SHELL_CONFIG.talentappProjectVerification,
  MINIAPP_LAUNCH_NAME: HTML_SHELL_CONFIG.miniappLaunchName,
  MINIAPP_SPLASH_BACKGROUND_COLOR: HTML_SHELL_CONFIG.miniappSplashBackgroundColor,
  CANVAS_BG: CANVAS_TOKENS.bg,
  CANVAS_BG_RGB: CANVAS_TOKENS.bgRgb,
}
