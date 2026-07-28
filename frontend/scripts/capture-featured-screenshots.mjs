#!/usr/bin/env node
/**
 * Capture Base Mini App featured screenshots (1284×2778, ≤5 MB).
 *
 * Requires a running local frontend (screenshot mode is blocked in production):
 *   pnpm -C frontend dev
 *   pnpm -C frontend capture:featured-screens
 *
 * Env:
 *   APP_SCREENSHOT_BASE_URL=http://localhost:5173
 */

import { mkdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { chromium } from 'playwright'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const OUT_DIR = path.resolve(__dirname, '../public/assets/screenshots')
const MAX_BYTES = 5 * 1024 * 1024
const EXPECTED_WIDTH = 1284
const EXPECTED_HEIGHT = 2778
const READY_TIMEOUT_MS = 90_000

const baseUrl = (process.env.APP_SCREENSHOT_BASE_URL || 'http://localhost:5173').replace(/\/$/, '')

/** @type {{ name: string; path: string; file: string; content: string }[]} */
const SHOTS = [
  {
    name: 'swap',
    path: '/swap?screenshot=1',
    file: 'screenshot-swap.png',
    // SwapCard sell/buy labels — proves the trade UI painted under the overlay.
    content: 'text=Sell',
  },
  {
    name: 'explore',
    path: '/explore/creators?screenshot=1',
    file: 'screenshot-explore.png',
    // Present for both live rows and screenshot demo fallback.
    content: 'text=Creator coins',
  },
  {
    name: 'deploy',
    path: '/deploy?screenshot=1',
    file: 'screenshot-deploy.png',
    content: 'role=heading[name=/^Coin$/i]',
  },
]

function urlFor(p) {
  if (p.startsWith('http://') || p.startsWith('https://')) return p
  return `${baseUrl}${p.startsWith('/') ? '' : '/'}${p}`
}

async function assertBaseReachable() {
  try {
    const res = await fetch(baseUrl, { method: 'GET', redirect: 'follow' })
    if (!res.ok && res.status >= 500) {
      throw new Error(`Base URL returned HTTP ${res.status}`)
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    throw new Error(
      `Cannot reach APP_SCREENSHOT_BASE_URL=${baseUrl} (${message}).\n` +
        'Start the frontend first: pnpm -C frontend dev',
    )
  }
}

/**
 * @param {import('playwright').Page} page
 * @param {string} contentSelector
 */
async function waitForContent(page, contentSelector) {
  if (contentSelector.startsWith('role=')) {
    // role=heading[name=/^Coin$/i]
    const match = /^role=(\w+)\[name=(.+)\]$/.exec(contentSelector)
    if (!match) throw new Error(`Invalid role selector: ${contentSelector}`)
    const role = /** @type {import('playwright').ARIARole} */ (match[1])
    const nameRaw = match[2]
    const name = nameRaw.startsWith('/')
      ? new RegExp(nameRaw.slice(1, nameRaw.lastIndexOf('/')), nameRaw.slice(nameRaw.lastIndexOf('/') + 1))
      : nameRaw
    await page.getByRole(role, { name }).first().waitFor({ state: 'visible', timeout: READY_TIMEOUT_MS })
    return
  }
  if (contentSelector.startsWith('text=')) {
    await page.getByText(contentSelector.slice('text='.length), { exact: false }).first().waitFor({
      state: 'visible',
      timeout: READY_TIMEOUT_MS,
    })
    return
  }
  await page.locator(contentSelector).first().waitFor({ state: 'visible', timeout: READY_TIMEOUT_MS })
}

/**
 * Hide transient chrome that is fine in-app but wrong for store screenshots.
 * Privy bootstrap can keep AppLoadingOverlay up even after page-ready.
 * @param {import('playwright').Page} page
 */
async function prepareForCapture(page) {
  await page.evaluate(() => {
    document.querySelectorAll('[data-loading-intent]').forEach((el) => {
      const root = el.closest('.fixed') ?? el
      if (root instanceof HTMLElement) root.style.setProperty('display', 'none', 'important')
    })
    document.querySelectorAll('[data-screenshot-hide="true"]').forEach((el) => {
      if (el instanceof HTMLElement) el.style.setProperty('display', 'none', 'important')
    })
    window.scrollTo(0, 0)
  })
  await page.addStyleTag({
    content: `
      [data-screenshot-hide="true"],
      [data-loading-intent],
      [data-loading-intent].fixed,
      .fixed:has([data-loading-intent]) {
        display: none !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }
      *, *::before, *::after {
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        transition-duration: 0s !important;
        transition-delay: 0s !important;
        caret-color: transparent !important;
      }
    `,
  })
  await page.waitForTimeout(500)
}

/**
 * @param {import('playwright').Page} page
 * @param {{ path: string; content: string }} shot
 */
async function gotoAndWaitReady(page, shot) {
  // Use `commit` — `/swap` can abort mid-navigation in local Privy/auth
  // flows, so `domcontentloaded` may never settle even when the shell mounts.
  await page.goto(urlFor(shot.path), { waitUntil: 'commit', timeout: 45_000 })
  await page.waitForSelector('main', { timeout: 60_000 })
  await page.waitForFunction(() => window.__APP_SCREENSHOT_READY === true, null, {
    timeout: READY_TIMEOUT_MS,
  })
  await waitForContent(page, shot.content)
  await prepareForCapture(page)
}

/**
 * @param {string} filePath
 */
function readPngSize(filePath) {
  const buf = readFileSync(filePath)
  if (buf.length < 24 || buf.toString('ascii', 1, 4) !== 'PNG') {
    throw new Error(`${path.basename(filePath)} is not a valid PNG`)
  }
  return {
    width: buf.readUInt32BE(16),
    height: buf.readUInt32BE(20),
  }
}

/**
 * @param {string} filePath
 */
function validateOutput(filePath) {
  const { width, height } = readPngSize(filePath)
  if (width !== EXPECTED_WIDTH || height !== EXPECTED_HEIGHT) {
    throw new Error(
      `${path.basename(filePath)} is ${width}×${height}, expected ${EXPECTED_WIDTH}×${EXPECTED_HEIGHT}`,
    )
  }
  const size = statSync(filePath).size
  if (size > MAX_BYTES) {
    throw new Error(`${path.basename(filePath)} is ${size} bytes (max ${MAX_BYTES})`)
  }
  return size
}

async function main() {
  await assertBaseReachable()
  mkdirSync(OUT_DIR, { recursive: true })

  // eslint-disable-next-line no-console
  console.log('Capturing Base featured screenshots from', baseUrl)
  // eslint-disable-next-line no-console
  console.log('Output:', OUT_DIR)

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  })
  const context = await browser.newContext({
    // Featured checklist: 1284×2778 portrait. Viewport × DSF = exact size.
    viewport: { width: 642, height: 1389 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    // Keep motion enabled so Deploy can prefer interactive cards when WebGL works;
    // StaticCard still renders if reduced-motion / WebGL fails.
    reducedMotion: 'no-preference',
  })
  const page = await context.newPage()

  try {
    for (const shot of SHOTS) {
      const outPath = path.join(OUT_DIR, shot.file)
      // eslint-disable-next-line no-console
      console.log(`→ ${shot.name}: ${shot.path}`)
      await gotoAndWaitReady(page, shot)
      await page.screenshot({
        path: outPath,
        type: 'png',
        fullPage: false,
      })
      const bytes = validateOutput(outPath)
      // eslint-disable-next-line no-console
      console.log(
        `  wrote ${shot.file} (${EXPECTED_WIDTH}×${EXPECTED_HEIGHT}, ${(bytes / (1024 * 1024)).toFixed(2)} MB)`,
      )
    }
  } finally {
    await browser.close()
  }

  // eslint-disable-next-line no-console
  console.log('Done.')
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
