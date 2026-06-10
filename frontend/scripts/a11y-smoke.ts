#!/usr/bin/env node
/**
 * Playwright + axe smoke test for public app routes.
 *
 * Fails on serious/critical violations. Moderate/minor are reported but do not fail.
 *
 * Usage:
 *   pnpm -C frontend smoke:a11y -- --serve
 *   A11Y_BASE_URL=https://app.4626.fun pnpm -C frontend smoke:a11y
 */

import assert from 'node:assert/strict'
import { spawn, type ChildProcess } from 'node:child_process'
import process from 'node:process'
import { setTimeout as delay } from 'node:timers/promises'

import AxeBuilder from '@axe-core/playwright'
import { chromium, type Browser, type Page } from 'playwright'

const HOST = process.env.A11Y_HOST ?? '127.0.0.1'
const PORT = Number(process.env.A11Y_PORT ?? process.env.PORT ?? 4175)
const DEFAULT_PATHS = ['/faq', '/faq/how-it-works', '/waitlist', '/swap']

const MARKETING_PATH_PREFIXES = ['/faq', '/waitlist', '/status', '/cca', '/r/'] as const
const APP_PATH_PREFIXES = ['/swap', '/deploy', '/explore', '/accounts', '/vault', '/portfolio'] as const
const SERVE_TIMEOUT_MS = Number(process.env.A11Y_SERVE_TIMEOUT_MS ?? 120_000)
const PAGE_TIMEOUT_MS = Number(process.env.A11Y_PAGE_TIMEOUT_MS ?? 45_000)

type AxeImpact = 'minor' | 'moderate' | 'serious' | 'critical' | null

type RouteResult = {
  path: string
  url: string
  violations: Array<{
    id: string
    impact: AxeImpact
    help: string
    nodes: number
  }>
  failing: boolean
}

function usage(): void {
  process.stdout.write(`Usage:
  pnpm -C frontend smoke:a11y [--serve] [--paths /a,/b] [--base-url <origin>]

Options:
  --serve              Start Vite on A11Y_HOST:A11Y_PORT (default 127.0.0.1:4175)
  --paths <csv>        Comma-separated paths (default: ${DEFAULT_PATHS.join(',')})
  --base-url <origin>  Base origin (default: http://\${A11Y_HOST}:\${A11Y_PORT})
  --help               Show this message

Environment:
  A11Y_BASE_URL        Same as --base-url
  A11Y_HOST_MODE       Force Vite host shell: app | marketing (CI uses per-path groups)
  A11Y_HOST / A11Y_PORT
  A11Y_SERVE_TIMEOUT_MS  Wait for dev server (default 120000)
  A11Y_PAGE_TIMEOUT_MS   Per-page navigation timeout (default 45000)

Exit codes:
  0  No serious/critical axe violations
  1  One or more serious/critical violations (or runtime error)
`)
}

function getArg(name: string, fallback = ''): string {
  const idx = process.argv.indexOf(name)
  if (idx === -1) return fallback
  const next = process.argv[idx + 1]
  if (!next || next.startsWith('--')) return fallback
  return String(next).trim()
}

function hasFlag(name: string): boolean {
  return process.argv.includes(name)
}

function parsePaths(raw: string): string[] {
  const paths = raw
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => (p.startsWith('/') ? p : `/${p}`))
  assert.ok(paths.length > 0, 'At least one path is required')
  return paths
}

function isBlockingImpact(impact: AxeImpact): boolean {
  return impact === 'serious' || impact === 'critical'
}

export type A11yHostMode = 'app' | 'marketing'

function pathHostMode(path: string): A11yHostMode {
  const normalized = path.startsWith('/') ? path : `/${path}`
  if (MARKETING_PATH_PREFIXES.some((prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`))) {
    return 'marketing'
  }
  if (APP_PATH_PREFIXES.some((prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`))) {
    return 'app'
  }
  return 'marketing'
}

function groupPathsByHostMode(paths: string[]): Array<{ mode: A11yHostMode; paths: string[] }> {
  const marketing: string[] = []
  const app: string[] = []
  for (const path of paths) {
    if (pathHostMode(path) === 'app') app.push(path)
    else marketing.push(path)
  }
  const groups: Array<{ mode: A11yHostMode; paths: string[] }> = []
  if (marketing.length > 0) groups.push({ mode: 'marketing', paths: marketing })
  if (app.length > 0) groups.push({ mode: 'app', paths: app })
  return groups
}

function resolveServeHostMode(paths: string[]): A11yHostMode {
  const override = process.env.A11Y_HOST_MODE?.trim()
  if (override === 'app' || override === 'marketing') return override
  const groups = groupPathsByHostMode(paths)
  if (groups.length === 1) return groups[0]!.mode
  return 'app'
}

async function waitForServerReady(origin: string, timeoutMs: number): Promise<void> {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const res = await fetch(`${origin}/`, { redirect: 'follow' })
      if (res.ok || res.status < 500) return
    } catch {
      // keep polling
    }
    await delay(250)
  }
  throw new Error(`Timed out waiting for server at ${origin}`)
}

function startViteServer(mode: A11yHostMode): ChildProcess {
  const origin = `http://${HOST}:${PORT}`
  const child = spawn('pnpm', ['vite', '--host', HOST, '--port', String(PORT)], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      CI: '1',
      VITE_HOST_MODE_OVERRIDE: mode,
      VITE_APP_ORIGIN: origin,
      VITE_MARKETING_ORIGIN: origin,
      VITE_PRIVY_ENABLED: '0',
      VITE_BASE_BUILDER_CODES: process.env.VITE_BASE_BUILDER_CODES ?? 'bc_b7k3p9da',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  return child
}

async function stopChild(child: ChildProcess | null): Promise<void> {
  if (!child || child.killed) return
  child.kill('SIGTERM')
  await delay(500)
  if (!child.killed) child.kill('SIGKILL')
}

async function scanRoute(page: Page, origin: string, path: string): Promise<RouteResult> {
  const url = new URL(path, origin).toString()
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: PAGE_TIMEOUT_MS })
  await page.waitForTimeout(750)

  const axe = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()

  const violations = axe.violations.map((v) => ({
    id: v.id,
    impact: (v.impact ?? null) as AxeImpact,
    help: v.help,
    nodes: v.nodes.length,
  }))

  const failing = violations.some((v) => isBlockingImpact(v.impact))

  return { path, url, violations, failing }
}

function printReport(results: RouteResult[]): void {
  for (const result of results) {
    const blocking = result.violations.filter((v) => isBlockingImpact(v.impact))
    const advisory = result.violations.filter((v) => !isBlockingImpact(v.impact))

    process.stdout.write(`\n${result.url}\n`)
    if (blocking.length === 0 && advisory.length === 0) {
      process.stdout.write('  ok (no axe violations)\n')
      continue
    }
    for (const v of blocking) {
      process.stdout.write(`  FAIL [${v.impact}] ${v.id} (${v.nodes} nodes) — ${v.help}\n`)
    }
    for (const v of advisory) {
      process.stdout.write(`  note [${v.impact ?? 'unknown'}] ${v.id} (${v.nodes} nodes) — ${v.help}\n`)
    }
  }
}

async function main(): Promise<void> {
  if (hasFlag('--help') || hasFlag('-h')) {
    usage()
    return
  }

  const shouldServe = hasFlag('--serve')
  const paths = parsePaths(getArg('--paths', DEFAULT_PATHS.join(',')))
  const externalOrigin =
    getArg('--base-url', process.env.A11Y_BASE_URL ?? '') ||
    `http://${HOST}:${PORT}`

  let vite: ChildProcess | null = null
  let browser: Browser | null = null

  try {
    browser = await chromium.launch({ headless: true })
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      reducedMotion: 'reduce',
    })
    const page = await context.newPage()

    const results: RouteResult[] = []
    const scanGroups = shouldServe
      ? groupPathsByHostMode(paths)
      : [{ mode: resolveServeHostMode(paths), paths }]

    for (const group of scanGroups) {
      const origin = shouldServe ? `http://${HOST}:${PORT}` : externalOrigin

      if (shouldServe) {
        await stopChild(vite)
        process.stdout.write(`Starting Vite (${group.mode}) at ${origin} …\n`)
        vite = startViteServer(group.mode)
        await waitForServerReady(origin, SERVE_TIMEOUT_MS)
      }

      for (const path of group.paths) {
        process.stdout.write(`Scanning ${path} …\n`)
        results.push(await scanRoute(page, origin, path))
      }
    }

    printReport(results)

    const failed = results.filter((r) => r.failing)
    if (failed.length > 0) {
      process.stderr.write(
        `\na11y-smoke: ${failed.length} route(s) with serious/critical violations\n`,
      )
      process.exit(1)
    }

    process.stdout.write('\na11y-smoke: passed (no serious/critical violations)\n')
  } finally {
    await stopChild(vite)
    await browser?.close()
  }
}

main().catch((err) => {
  process.stderr.write(`${err instanceof Error ? err.stack ?? err.message : String(err)}\n`)
  process.exit(1)
})
