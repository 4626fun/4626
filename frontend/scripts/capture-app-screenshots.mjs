/**
 * Capture real app screenshots from a running frontend (Playwright).
 *
 * Why:
 * - Open graph previews use PNGs served from `public/`.
 * - "Screenshot" should reflect the actual product UI (not a stylized mock).
 * - This script owns UI-derived assets only: the wide social hero and portrait
 *   install screenshots. Small install/browser icons stay in
 *   `generate-brand-icons.mjs`.
 *
 * Usage:
 *   pnpm -C frontend add -D playwright
 *   pnpm -C frontend exec playwright install chromium
 *
 *   # With the dev server running (default http://localhost:5173):
 *   pnpm -C frontend run capture:app-screens
 *
 * Env:
 *   APP_SCREENSHOT_BASE_URL=http://localhost:5173
 *   APP_HERO_PATH=/deploy?screenshot=1
 *   APP_SCREENSHOT_TARGETS=screenshot-swap.png=/swap?screenshot=1,screenshot-explore.png=/explore/creators?screenshot=1,screenshot-deploy.png=/deploy?screenshot=1
 */
import fs from 'node:fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

let chromium
try {
  // eslint-disable-next-line import/no-unresolved
  ;({ chromium } = await import('playwright'))
} catch (err) {
  // eslint-disable-next-line no-console
  console.error(
    '\nMissing dependency: playwright.\n' +
      'Install it and the Chromium browser:\n' +
      '  pnpm -C frontend add -D playwright\n' +
      '  pnpm -C frontend exec playwright install chromium\n',
  )
  process.exit(1)
}

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const OUT_DIR = path.resolve(__dirname, '../public')

const baseUrl = (process.env.APP_SCREENSHOT_BASE_URL || 'http://localhost:5173').replace(/\/$/, '')
const heroPath = process.env.APP_HERO_PATH || '/deploy?screenshot=1&demo=akita'
const screenshotTargetsRaw =
  process.env.APP_SCREENSHOT_TARGETS ||
  [
    'screenshot-swap.png=/swap?screenshot=1&demo=akita',
    'screenshot-explore.png=/explore/creators?screenshot=1&demo=akita',
    'screenshot-deploy.png=/deploy?screenshot=1&demo=akita',
  ].join(',')
const screenshotPortraitAliasName = 'screenshot-portrait.png'
const screenshotPortraitSource =
  (process.env.APP_SCREENSHOT_PORTRAIT_ALIAS || 'screenshot-deploy.png').trim() || 'screenshot-deploy.png'

function parseScreenshotTargets(raw) {
  return raw
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry, index) => {
      const eqIndex = entry.indexOf('=')
      if (eqIndex === -1) {
        return {
          fileName: `screenshot-${index + 1}.png`,
          path: entry,
        }
      }
      return {
        fileName: entry.slice(0, eqIndex).trim(),
        path: entry.slice(eqIndex + 1).trim(),
      }
    })
    .filter((target) => target.fileName && target.path)
    .slice(0, 3)
}

const screenshotTargets = parseScreenshotTargets(screenshotTargetsRaw)

function urlFor(p) {
  if (p.startsWith('http://') || p.startsWith('https://')) return p
  return `${baseUrl}${p.startsWith('/') ? '' : '/'}${p}`
}

async function stabilizePage(page) {
  // Disable animations/transitions for deterministic screenshots.
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        transition-duration: 0s !important;
        transition-delay: 0s !important;
        caret-color: transparent !important;
      }
      [data-screenshot-hide="true"] {
        visibility: hidden !important;
      }
    `,
  })
  await page.evaluate(() => {
    window.scrollTo(0, 0)
  })
}

async function gotoApp(page, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45_000 })
  // Ensure app shell exists.
  await page.waitForSelector('main', { timeout: 45_000 })
  await stabilizePage(page)
  await page.waitForFunction(() => window.__APP_SCREENSHOT_READY === true, {
    timeout: 45_000,
  })
  // Allow layout to settle after the app asserts readiness.
  await page.waitForTimeout(250)
}

async function captureHero() {
  const browser = await chromium.launch()
  const context = await browser.newContext({
    viewport: { width: 1200, height: 630 },
    deviceScaleFactor: 1,
    reducedMotion: 'reduce',
  })
  const page = await context.newPage()

  await gotoApp(page, urlFor(heroPath))

  await page.screenshot({
    path: path.join(OUT_DIR, 'app-hero.png'),
    type: 'png',
  })
  await fs.copyFile(path.join(OUT_DIR, 'app-hero.png'), path.join(OUT_DIR, 'miniapp-hero.png'))

  await browser.close()
}

async function capturePortrait() {
  const browser = await chromium.launch()
  const context = await browser.newContext({
    // Featured checklist asks for portrait screenshots at 1284x2778.
    // Use a 642x1389 viewport at 2x scale to match exactly.
    viewport: { width: 642, height: 1389 },
    deviceScaleFactor: 2, // => 1284x2778 output
    isMobile: true,
    hasTouch: true,
    reducedMotion: 'reduce',
  })
  const page = await context.newPage()

  for (const target of screenshotTargets) {
    await gotoApp(page, urlFor(target.path))
    await page.screenshot({
      path: path.join(OUT_DIR, target.fileName),
      type: 'png',
    })
  }

  const portraitSourceTarget = screenshotTargets.find((target) => target.fileName === screenshotPortraitSource) ?? screenshotTargets[0]
  if (portraitSourceTarget) {
    await fs.copyFile(
      path.join(OUT_DIR, portraitSourceTarget.fileName),
      path.join(OUT_DIR, screenshotPortraitAliasName),
    )
  }

  await browser.close()
}

async function main() {
  // eslint-disable-next-line no-console
  console.log('Capturing app screenshots from', baseUrl)
  // eslint-disable-next-line no-console
  console.log(' - hero:', heroPath)
  // eslint-disable-next-line no-console
  console.log(
    ' - screenshots:',
    screenshotTargets.map((target) => `${target.fileName} <= ${target.path}`).join(', ') || '(none)',
  )

  await captureHero()
  // eslint-disable-next-line no-console
  console.log('wrote app-hero.png, miniapp-hero.png')

  await capturePortrait()
  // eslint-disable-next-line no-console
  console.log(
    `wrote ${screenshotTargets.map((target) => target.fileName).join(', ')}${screenshotTargets.length ? `, ${screenshotPortraitAliasName}` : ''}`,
  )
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err)
  process.exit(1)
})
