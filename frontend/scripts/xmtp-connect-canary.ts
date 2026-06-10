#!/usr/bin/env node
/**
 * Layer 3 — XMTP browser connect manual canary helper.
 *
 * Opens a headed browser, navigates to the app chat surface, samples DOM +
 * localStorage, and pauses for operator wallet actions between scenarios.
 *
 * Usage:
 *   pnpm -C frontend smoke:xmtp-canary -- --headed
 *   pnpm -C frontend smoke:xmtp-canary -- --scenario b --headed
 *   pnpm -C frontend smoke:xmtp-canary -- --fresh-profile --report-json /tmp/xmtp-canary.json
 */

import { mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import readline from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'

import { chromium, type BrowserContext, type Page } from 'playwright'

type ScenarioId = 'a' | 'b' | 'c' | 'd' | 'e' | 'all'

type ScenarioResult = {
  id: ScenarioId
  title: string
  startedAt: string
  finishedAt: string
  passed: boolean
  notes: string[]
  snapshot: XmtpUiSnapshot | null
}

type XmtpUiSnapshot = {
  url: string
  connectMessagingVisible: boolean
  resetLocalVisible: boolean
  resetInstallationsVisible: boolean
  connectedIconVisible: boolean
  errorText: string | null
  xmtpModeLabel: string | null
  localStorageKeys: Record<string, string | null>
  capturedAt: string
}

type CanaryReport = {
  baseUrl: string
  path: string
  scenarios: ScenarioResult[]
  startedAt: string
  finishedAt: string
  allPassed: boolean
}

const XMTP_ENV = (process.env.VITE_XMTP_ENV ?? 'production').trim().toLowerCase() || 'production'

function usage(): void {
  process.stdout.write(`XMTP browser connect canary (Layer 3)

Usage:
  pnpm -C frontend smoke:xmtp-canary -- [options]

Options:
  --base-url <url>       App origin (default: https://app.4626.fun)
  --path <path>          Route path (default: /swap)
  --scenario <id>        a | b | c | d | e | all (default: all)
  --headed               Run headed browser (default: true)
  --headless             Run headless (not recommended for Layer 3)
  --fresh-profile        New persistent profile dir (scenario A)
  --profile-dir <path>   Reuse persistent profile directory
  --executable-path <p>  Browser binary (e.g. /usr/bin/brave-browser)
  --wallet-address <0x>  Expected wallet for localStorage key checks
  --timeout-ms <ms>      UI wait timeout (default: 45000)
  --report-json <path>   Write JSON report on exit
  --help                 Show this help

Operator flow:
  1. Sign in + connect wallet in the opened browser when prompted.
  2. Press Enter at each gate after completing the manual step.
  3. Review pass/fail summary and optional JSON report.

See: docs/operations/xmtp-browser-connect-canary.md
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

function parseScenario(raw: string): ScenarioId {
  const value = raw.trim().toLowerCase()
  if (!value || value === 'all') return 'all'
  if (value === 'a' || value === 'b' || value === 'c' || value === 'd' || value === 'e') return value
  throw new Error(`Invalid --scenario: ${raw}`)
}

function normalizeOrigin(raw: string): string {
  const value = raw.trim() || 'https://app.4626.fun'
  try {
    return new URL(value).origin
  } catch {
    throw new Error(`Invalid --base-url: ${raw}`)
  }
}

function normalizePath(raw: string): string {
  const value = raw.trim() || '/swap'
  return value.startsWith('/') ? value : `/${value}`
}

function toPositiveInt(raw: string, fallback: number): number {
  const n = Number(raw)
  if (!Number.isFinite(n) || n <= 0) return fallback
  return Math.floor(n)
}

function isAddressLike(value: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(value)
}

async function promptContinue(rl: readline.Interface, message: string): Promise<void> {
  process.stdout.write(`\n${message}\n`)
  await rl.question('Press Enter when ready (or Ctrl+C to abort)... ')
}

async function captureSnapshot(page: Page, walletAddress: string | null): Promise<XmtpUiSnapshot> {
  const connectBtn = page.getByRole('button', { name: /Connect Messaging/i })
  const resetLocalBtn = page.getByRole('button', { name: /Reset local XMTP state/i })
  const resetInstallBtn = page.getByRole('button', { name: /Reset XMTP installations/i })

  const [connectMessagingVisible, resetLocalVisible, resetInstallationsVisible] = await Promise.all([
    connectBtn.isVisible().catch(() => false),
    resetLocalBtn.isVisible().catch(() => false),
    resetInstallBtn.isVisible().catch(() => false),
  ])

  const connectedIconVisible = await page
    .locator('button:has-text("Chats") svg.lucide-wifi.text-emerald-400')
    .first()
    .isVisible()
    .catch(() => false)

  const errorText = await page
    .locator('.text-red-400')
    .first()
    .textContent()
    .catch(() => null)

  const modeBlock = page.locator('text=/Messaging mode:/i').first()
  const xmtpModeLabel = (await modeBlock.isVisible().catch(() => false))
    ? ((await modeBlock.textContent().catch(() => null)) ?? null)
    : null

  const localStorageKeys = await page.evaluate(
    ({ env, address }) => {
      const keys: Record<string, string | null> = {}
      const collect = (suffix: string) => {
        if (!address) return null
        const key = `cv:xmtp:${suffix}:${env}:${address.toLowerCase()}`
        try {
          return window.localStorage.getItem(key)
        } catch {
          return null
        }
      }
      keys.installationProvisioned = collect('installationProvisioned')
      keys.installationMeta = collect('installationMeta')
      keys.encKey = collect('encKey')
      keys.signerType = collect('signerType')
      return keys
    },
    { env: XMTP_ENV, address: walletAddress },
  )

  return {
    url: page.url(),
    connectMessagingVisible,
    resetLocalVisible,
    resetInstallationsVisible,
    connectedIconVisible,
    errorText: errorText?.trim() || null,
    xmtpModeLabel: xmtpModeLabel?.trim() || null,
    localStorageKeys,
    capturedAt: new Date().toISOString(),
  }
}

function printSnapshot(snapshot: XmtpUiSnapshot): void {
  process.stdout.write('\n--- UI snapshot ---\n')
  process.stdout.write(`url: ${snapshot.url}\n`)
  process.stdout.write(`connectMessagingVisible: ${snapshot.connectMessagingVisible}\n`)
  process.stdout.write(`connectedIconVisible: ${snapshot.connectedIconVisible}\n`)
  process.stdout.write(`resetLocalVisible: ${snapshot.resetLocalVisible}\n`)
  process.stdout.write(`resetInstallationsVisible: ${snapshot.resetInstallationsVisible}\n`)
  if (snapshot.errorText) process.stdout.write(`errorText: ${snapshot.errorText}\n`)
  if (snapshot.xmtpModeLabel) process.stdout.write(`mode: ${snapshot.xmtpModeLabel}\n`)
  for (const [key, value] of Object.entries(snapshot.localStorageKeys)) {
    const preview = value && value.length > 80 ? `${value.slice(0, 77)}...` : value
    process.stdout.write(`localStorage.${key}: ${preview ?? '(null)'}\n`)
  }
  process.stdout.write('---\n')
}

async function openChatsPanel(page: Page): Promise<void> {
  const chatsToggle = page.getByRole('button', { name: /^Chats$/i }).first()
  if (await chatsToggle.isVisible().catch(() => false)) {
    await chatsToggle.click().catch(() => {})
  }
}

async function waitForConnected(page: Page, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const snapshot = await captureSnapshot(page, null)
    if (snapshot.connectedIconVisible && !snapshot.connectMessagingVisible) return true
    await page.waitForTimeout(750)
  }
  return false
}

async function runScenarioA(
  page: Page,
  rl: readline.Interface,
  walletAddress: string | null,
  timeoutMs: number,
): Promise<ScenarioResult> {
  const startedAt = new Date().toISOString()
  const notes: string[] = []

  await promptContinue(
    rl,
    '[Scenario A] Fresh profile: sign in, complete wallet readiness, then connect messaging once.',
  )

  await openChatsPanel(page)
  let snapshot = await captureSnapshot(page, walletAddress)
  printSnapshot(snapshot)

  if (!snapshot.connectMessagingVisible && !snapshot.connectedIconVisible) {
    notes.push('Neither Connect Messaging nor connected state detected — expand Chats or finish sign-in.')
  }

  await promptContinue(rl, '[Scenario A] Click Connect Messaging and approve ONE wallet signature.')
  const connected = await waitForConnected(page, timeoutMs)
  snapshot = await captureSnapshot(page, walletAddress)
  printSnapshot(snapshot)

  const provisioned = snapshot.localStorageKeys.installationProvisioned === '1'
  const passed = connected && provisioned
  if (!connected) notes.push('Expected connected icon without Connect Messaging CTA.')
  if (!provisioned) notes.push('Expected installationProvisioned localStorage marker.')

  return {
    id: 'a',
    title: 'Fresh profile → first connect',
    startedAt,
    finishedAt: new Date().toISOString(),
    passed,
    notes,
    snapshot,
  }
}

async function runScenarioB(
  page: Page,
  rl: readline.Interface,
  walletAddress: string | null,
  timeoutMs: number,
): Promise<ScenarioResult> {
  const startedAt = new Date().toISOString()
  const notes: string[] = []

  const before = await captureSnapshot(page, walletAddress)
  const beforeMeta = before.localStorageKeys.installationMeta

  await promptContinue(rl, '[Scenario B] Hard refresh the page (Ctrl+Shift+R), wait for bootstrap, then continue.')
  await page.reload({ waitUntil: 'domcontentloaded' })
  await openChatsPanel(page)

  const connected = await waitForConnected(page, timeoutMs)
  const after = await captureSnapshot(page, walletAddress)
  printSnapshot(after)

  const metaStable =
    !beforeMeta ||
    !after.localStorageKeys.installationMeta ||
    beforeMeta === after.localStorageKeys.installationMeta

  const passed = connected && !after.connectMessagingVisible && metaStable
  if (!connected) notes.push('Expected auto-reconnect after reload.')
  if (after.connectMessagingVisible) notes.push('Connect Messaging still visible after reload.')
  if (!metaStable) notes.push('installationMeta changed after reload — possible new install churn.')

  return {
    id: 'b',
    title: 'Hard refresh → restore without new install',
    startedAt,
    finishedAt: new Date().toISOString(),
    passed,
    notes,
    snapshot: after,
  }
}

async function runScenarioC(
  page: Page,
  rl: readline.Interface,
  walletAddress: string | null,
): Promise<ScenarioResult> {
  const startedAt = new Date().toISOString()
  const notes: string[] = []

  await promptContinue(
    rl,
    '[Scenario C] Confirm Privy is signed in and canonical CSW embedded owner is ready (Smart Wallet path).',
  )
  await openChatsPanel(page)
  const snapshot = await captureSnapshot(page, walletAddress)
  printSnapshot(snapshot)

  const modeHint = snapshot.xmtpModeLabel?.toLowerCase() ?? ''
  const smartWalletPath = modeHint.includes('smart wallet')
  const passed = snapshot.connectedIconVisible && smartWalletPath
  if (!snapshot.connectedIconVisible) notes.push('Connect messaging first (scenario A) before evaluating C.')
  if (!smartWalletPath) notes.push('Expected Messaging mode label to mention Smart Wallet for canonical CSW accounts.')

  return {
    id: 'c',
    title: 'Smart Wallet (canonical CSW) path',
    startedAt,
    finishedAt: new Date().toISOString(),
    passed,
    notes,
    snapshot,
  }
}

async function runScenarioD(
  page: Page,
  rl: readline.Interface,
  walletAddress: string | null,
  timeoutMs: number,
): Promise<ScenarioResult> {
  const startedAt = new Date().toISOString()
  const notes: string[] = []

  await promptContinue(
    rl,
    '[Scenario D] Only if you see identity registration failure: use Reset local XMTP state, then Connect Messaging once.',
  )
  await openChatsPanel(page)
  let snapshot = await captureSnapshot(page, walletAddress)
  printSnapshot(snapshot)

  if (!snapshot.resetLocalVisible && !snapshot.errorText?.includes('registration failed')) {
    notes.push('Skipped recovery flow — no registration failure UI detected (mark as manual N/A or force failure first).')
    return {
      id: 'd',
      title: 'Identity registration failure recovery',
      startedAt,
      finishedAt: new Date().toISOString(),
      passed: true,
      notes,
      snapshot,
    }
  }

  await promptContinue(rl, '[Scenario D] After local reset + one signature, wait for connected state.')
  const connected = await waitForConnected(page, timeoutMs)
  snapshot = await captureSnapshot(page, walletAddress)
  printSnapshot(snapshot)

  const passed = connected && snapshot.localStorageKeys.installationProvisioned === '1'
  if (!passed) notes.push('Recovery did not reach connected state with provisioned marker.')

  return {
    id: 'd',
    title: 'Identity registration failure recovery',
    startedAt,
    finishedAt: new Date().toISOString(),
    passed,
    notes,
    snapshot,
  }
}

async function runScenarioE(
  page: Page,
  rl: readline.Interface,
  walletAddress: string | null,
): Promise<ScenarioResult> {
  const startedAt = new Date().toISOString()
  const notes: string[] = []

  await promptContinue(
    rl,
    '[Scenario E] Only at 10/10 install cap: confirm on xmtp.chat/inbox-tools, then use Reset XMTP installations.',
  )
  await openChatsPanel(page)
  const snapshot = await captureSnapshot(page, walletAddress)
  printSnapshot(snapshot)

  if (!snapshot.resetInstallationsVisible) {
    notes.push('Install-cap UI not visible — scenario E is N/A unless inbox is at 10/10.')
    return {
      id: 'e',
      title: 'Installation cap recovery',
      startedAt,
      finishedAt: new Date().toISOString(),
      passed: true,
      notes,
      snapshot,
    }
  }

  await promptContinue(rl, '[Scenario E] After installation reset + reconnect, press Enter.')
  const after = await captureSnapshot(page, walletAddress)
  printSnapshot(after)
  const passed = after.connectedIconVisible
  if (!passed) notes.push('Expected connected state after installation reset path.')

  return {
    id: 'e',
    title: 'Installation cap recovery',
    startedAt,
    finishedAt: new Date().toISOString(),
    passed,
    notes,
    snapshot: after,
  }
}

async function resolveWalletAddress(page: Page, explicit: string | null): Promise<string | null> {
  if (explicit && isAddressLike(explicit)) return explicit.toLowerCase()

  const fromPage = await page.evaluate(() => {
    try {
      for (let i = 0; i < window.localStorage.length; i += 1) {
        const key = window.localStorage.key(i)
        if (!key) continue
        const match = key.match(/^cv:xmtp:installationProvisioned:[^:]+:(0x[a-fA-F0-9]{40})$/)
        if (match?.[1]) return match[1].toLowerCase()
      }
    } catch {
      // ignore
    }
    return null
  })

  return fromPage
}

async function main(): Promise<void> {
  if (hasFlag('--help') || hasFlag('-h')) {
    usage()
    return
  }

  const baseUrl = normalizeOrigin(getArg('--base-url', process.env.XMTP_CANARY_BASE_URL ?? 'https://app.4626.fun'))
  const path = normalizePath(getArg('--path', '/swap'))
  const scenario = parseScenario(getArg('--scenario', 'all'))
  const headed = hasFlag('--headless') ? false : true
  const freshProfile = hasFlag('--fresh-profile')
  const profileDir =
    getArg('--profile-dir') ||
    (freshProfile ? join(tmpdir(), `xmtp-canary-${Date.now()}`) : join(tmpdir(), 'xmtp-canary-default'))
  const executablePath = getArg('--executable-path') || getArg('--browser-path')
  const walletArg = getArg('--wallet-address')
  const timeoutMs = toPositiveInt(getArg('--timeout-ms'), 45_000)
  const reportJsonPath = getArg('--report-json')

  if (freshProfile) {
    mkdirSync(profileDir, { recursive: true })
  }

  const targetUrl = `${baseUrl}${path}`
  const rl = readline.createInterface({ input, output })

  let context: BrowserContext | null = null
  const report: CanaryReport = {
    baseUrl,
    path,
    scenarios: [],
    startedAt: new Date().toISOString(),
    finishedAt: '',
    allPassed: false,
  }

  try {
    process.stdout.write(`Launching browser (headed=${headed}) profile=${profileDir}\n`)
    process.stdout.write(`Navigate target: ${targetUrl}\n`)

    context = await chromium.launchPersistentContext(profileDir, {
      headless: !headed,
      viewport: { width: 1440, height: 900 },
      ...(executablePath ? { executablePath } : {}),
    })

    const page = context.pages()[0] ?? (await context.newPage())
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: timeoutMs })

    await promptContinue(
      rl,
      'Sign in + connect wallet in the browser if needed. Open Chats (bottom-right) when ready.',
    )

    let walletAddress = await resolveWalletAddress(page, walletArg || null)

    const runOne = async (id: ScenarioId) => {
      if (id === 'a') report.scenarios.push(await runScenarioA(page, rl, walletAddress, timeoutMs))
      if (id === 'b') report.scenarios.push(await runScenarioB(page, rl, walletAddress, timeoutMs))
      if (id === 'c') report.scenarios.push(await runScenarioC(page, rl, walletAddress))
      if (id === 'd') report.scenarios.push(await runScenarioD(page, rl, walletAddress, timeoutMs))
      if (id === 'e') report.scenarios.push(await runScenarioE(page, rl, walletAddress))
      walletAddress = await resolveWalletAddress(page, walletArg || walletAddress)
    }

    if (scenario === 'all') {
      await runOne('a')
      await runOne('b')
      await runOne('c')
      await runOne('d')
      await runOne('e')
    } else {
      await runOne(scenario)
    }

    report.finishedAt = new Date().toISOString()
    report.allPassed = report.scenarios.every((s) => s.passed)

    process.stdout.write('\n=== Canary summary ===\n')
    for (const s of report.scenarios) {
      process.stdout.write(`${s.passed ? 'PASS' : 'FAIL'}  ${s.id.toUpperCase()} — ${s.title}\n`)
      for (const note of s.notes) process.stdout.write(`      - ${note}\n`)
    }
    process.stdout.write(`\nOverall: ${report.allPassed ? 'GO' : 'NO-GO'}\n`)

    if (reportJsonPath) {
      writeFileSync(reportJsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
      process.stdout.write(`Report written: ${reportJsonPath}\n`)
    }

    if (!report.allPassed) process.exitCode = 1
  } finally {
    rl.close()
    await context?.close().catch(() => {})
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`)
  process.exit(1)
})
