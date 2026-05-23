import fs from 'node:fs'

const SITE_CONFIG_PATH = new URL('../shared/site-config.json', import.meta.url)

export function readSiteConfig() {
  return JSON.parse(fs.readFileSync(SITE_CONFIG_PATH, 'utf8'))
}

export function hexToRgbTriplet(hex) {
  const normalized = String(hex).trim().replace(/^#/, '')
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
    throw new Error(`invalid canvas hex color: ${hex}`)
  }
  const r = Number.parseInt(normalized.slice(0, 2), 16)
  const g = Number.parseInt(normalized.slice(2, 4), 16)
  const b = Number.parseInt(normalized.slice(4, 6), 16)
  return `${r} ${g} ${b}`
}

export function resolveCanvasTokens(siteConfig = readSiteConfig()) {
  const bg = siteConfig.backgroundColor ?? siteConfig.themeColor ?? '#020204'
  return {
    bg,
    bgRgb: hexToRgbTriplet(bg),
  }
}

export function renderCanvasTokensCss(tokens = resolveCanvasTokens()) {
  return `/* AUTO-GENERATED from shared/site-config.json (backgroundColor) — run: pnpm sync:canvas-tokens */
:root {
  --trust-page-bg: ${tokens.bg};
  --trust-page-bg-rgb: ${tokens.bgRgb};
}
`
}
