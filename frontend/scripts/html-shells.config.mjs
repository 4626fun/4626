import fs from 'node:fs'

const SHARED_SITE_META = JSON.parse(
  fs.readFileSync(new URL('../shared/site-meta.json', import.meta.url), 'utf8'),
)

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

const BASE_HTML_SHELL_CONFIG = {
  appBaseUrl: 'https://4626.fun',
  marketingSocialImagePath: '/app-hero.png',
  marketingSocialImageVersion: '6',
  appSocialImagePath: '/og-image.png',
  twitterCardImagePath: '/twitter-card.png',
  ogImageWidth: '1200',
  ogImageHeight: '630',
  miniappHeroPath: '/miniapp-hero.png',
  miniappSplashPath: '/miniapp-splash.png',
  siteAppName: SHARED_SITE_META.siteAppName,
  siteName: SHARED_SITE_META.siteName,
  siteTitle: SHARED_SITE_META.siteTitle,
  siteDescription: SHARED_SITE_META.siteDescription,
  siteImageAlt: SHARED_SITE_META.siteImageAlt,
  siteKeywords:
    'creator vaults, DeFi, yield, ERC-4626, tokenized vaults, Base, creator coins',
  siteAuthor: 'AKITA, LLC',
  siteAuthorUrl: 'https://akita.llc',
  siteAuthorEmail: 'info@akita.llc',
  msTileColor: '#020617',
  telegramLinkTitle: SHARED_SITE_META.telegramLinkTitle,
  telegramLinkDescription: SHARED_SITE_META.telegramLinkDescription,
  telegramLinkUrl: 'https://4626.fun/telegram/link',
  baseAppId: '695a49dc4d3a403912ed8ca5',
  talentappProjectVerification:
    '4b7b5b97d054b1a85c4d9635e53e928824fe96da81482cdecc54993bbe539de3df58eba944a698e62a7e6d5bad8b974254b2770354f4f3521c083c74a74af0da',
  miniappLaunchName: '4626.fun',
  miniappSplashBackgroundColor: '#0052FF',
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
  ),
  twitterCardImageUrl: buildAbsoluteUrl(
    BASE_HTML_SHELL_CONFIG.appBaseUrl,
    BASE_HTML_SHELL_CONFIG.twitterCardImagePath,
  ),
  miniappHeroUrl: buildAbsoluteUrl(
    BASE_HTML_SHELL_CONFIG.appBaseUrl,
    BASE_HTML_SHELL_CONFIG.miniappHeroPath,
  ),
  miniappSplashUrl: buildAbsoluteUrl(
    BASE_HTML_SHELL_CONFIG.appBaseUrl,
    BASE_HTML_SHELL_CONFIG.miniappSplashPath,
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
  SITE_APP_NAME: HTML_SHELL_CONFIG.siteAppName,
  SITE_NAME: HTML_SHELL_CONFIG.siteName,
  SITE_TITLE: HTML_SHELL_CONFIG.siteTitle,
  SITE_DESCRIPTION: HTML_SHELL_CONFIG.siteDescription,
  SITE_IMAGE_ALT: HTML_SHELL_CONFIG.siteImageAlt,
  SITE_KEYWORDS: HTML_SHELL_CONFIG.siteKeywords,
  SITE_AUTHOR: HTML_SHELL_CONFIG.siteAuthor,
  SITE_AUTHOR_URL: HTML_SHELL_CONFIG.siteAuthorUrl,
  SITE_AUTHOR_EMAIL: HTML_SHELL_CONFIG.siteAuthorEmail,
  MS_TILE_COLOR: HTML_SHELL_CONFIG.msTileColor,
  TELEGRAM_LINK_TITLE: HTML_SHELL_CONFIG.telegramLinkTitle,
  TELEGRAM_LINK_DESCRIPTION: HTML_SHELL_CONFIG.telegramLinkDescription,
  TELEGRAM_LINK_URL: HTML_SHELL_CONFIG.telegramLinkUrl,
  BASE_APP_ID: HTML_SHELL_CONFIG.baseAppId,
  TALENTAPP_PROJECT_VERIFICATION: HTML_SHELL_CONFIG.talentappProjectVerification,
  MINIAPP_LAUNCH_NAME: HTML_SHELL_CONFIG.miniappLaunchName,
  MINIAPP_SPLASH_BACKGROUND_COLOR: HTML_SHELL_CONFIG.miniappSplashBackgroundColor,
}
