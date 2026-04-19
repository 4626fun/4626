#!/usr/bin/env node

/**
 * Playwright smoke test for the waitlist → swap handoff bounce regression.
 *
 * Reproduces the cross-origin flow where a user on 4626.fun/waitlist finishes
 * sign-in, is redirected to app.4626.fun/swap?cv_handoff=<code>, and expects
 * to land on /swap without any intermediate round-trip back to the marketing
 * waitlist page.
 *
 * The prior bug: between the moment useSiweAuth set sessionHydrated=true and
 * the moment the /api/waitlist/me query actually began fetching, the access
 * guard briefly saw hasSession=true, data=undefined, and isLoading=false.
 * That combination evaluated as `accepted=false, loading=false`, which fired
 * a navigation back to the marketing /waitlist URL before the query settled.
 *
 * This test asserts the contract (regardless of the exact timing window that
 * originally produced it):
 *   1. The final top-frame URL is /swap.
 *   2. No intermediate top-frame navigation visited the marketing waitlist
 *      path OR carried `?reason=needs-acceptance`.
 *   3. /api/auth/handoff/redeem was called exactly once.
 *   4. /api/waitlist/me was queried at least once.
 *
 * The test artificially delays /api/waitlist/me so that, if any future
 * regression reintroduces a redirect during the in-flight query window, this
 * test will observe the bounce in the navigation tracker.
 */

import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import process from 'node:process'
import { setTimeout as delay } from 'node:timers/promises'

import { chromium } from 'playwright'

const HOST = '127.0.0.1'
const PORT = Number(process.env.PORT || 4174)
const ORIGIN = `http://${HOST}:${PORT}`
const SESSION_ADDRESS = '0xB05Cf01231cF2fF99499682E64D3780d57c80FdD'.toLowerCase()
const HANDOFF_CODE = 'b'.repeat(64)
const MARKETING_WAITLIST_PATH = '/waitlist'

function buildSwapHandoffUrl() {
  const params = new URLSearchParams({ cv_handoff: HANDOFF_CODE })
  return `${ORIGIN}/swap?${params.toString()}`
}

async function waitForServerReady(origin, timeoutMs) {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const res = await fetch(`${origin}/`)
      if (res.ok) return
    } catch {
      // keep polling
    }
    await delay(250)
  }
  throw new Error(`Timed out waiting for Vite dev server at ${origin}`)
}

function startViteServer() {
  const child = spawn('pnpm', ['vite', '--host', HOST, '--port', String(PORT)], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      CI: '1',
      // Same-origin app+marketing so that a window.location bounce to the
      // marketing /waitlist URL lands on the same dev server and is observable
      // via page navigation events.
      VITE_HOST_MODE_OVERRIDE: 'app',
      VITE_APP_ORIGIN: ORIGIN,
      VITE_MARKETING_ORIGIN: ORIGIN,
      VITE_PRIVY_ENABLED: '0',
      // Swap page transitively imports base builder code config; without this
      // the app throws during mount and the access runtime never fires.
      VITE_BASE_BUILDER_CODES: 'bc_b7k3p9da',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  let serverLog = ''
  child.stdout.on('data', (chunk) => {
    serverLog += chunk.toString()
  })
  child.stderr.on('data', (chunk) => {
    serverLog += chunk.toString()
  })

  return {
    child,
    readLog: () => serverLog,
  }
}

function createApiRouter(page, opts) {
  const state = {
    sessionEstablished: false,
    handoffRedeemCalls: 0,
    authMeCalls: 0,
    waitlistMeCalls: 0,
    requestLog: [],
    // Optional artificial delay applied to /api/waitlist/me so we can widen
    // the race window and make the bounce reproducible on slow CI.
    waitlistMeDelayMs: opts.waitlistMeDelayMs ?? 200,
  }

  return page
    .route('**/*', async (route) => {
      const url = new URL(route.request().url())
      let pathname = url.pathname
      if (pathname.startsWith('/__api/')) {
        pathname = `/api/${pathname.slice('/__api/'.length)}`
      }

      if (!pathname.startsWith('/api/')) {
        await route.continue()
        return
      }

      const requestEntry = {
        method: route.request().method(),
        pathname,
      }
      state.requestLog.push(requestEntry)

      const json = (body, status = 200) =>
        route.fulfill({
          status,
          contentType: 'application/json',
          body: JSON.stringify(body),
        })

      if (pathname === '/api/auth/handoff/redeem') {
        state.sessionEstablished = true
        state.handoffRedeemCalls += 1
        await json({
          success: true,
          data: {
            address: SESSION_ADDRESS,
            sessionToken: 'test-session-token',
            privyToken: null,
          },
        })
        return
      }

      if (pathname === '/api/auth/me') {
        state.authMeCalls += 1
        await json({
          success: true,
          data: state.sessionEstablished ? { address: SESSION_ADDRESS } : null,
        })
        return
      }

      if (pathname === '/api/auth/admin') {
        await json({
          success: true,
          data: state.sessionEstablished ? { address: SESSION_ADDRESS, isAdmin: false } : null,
        })
        return
      }

      if (pathname === '/api/creator-allowlist') {
        const address = (url.searchParams.get('address') || '').trim().toLowerCase() || null
        await json({
          success: true,
          data: {
            address,
            coin: null,
            creator: null,
            payoutRecipient: null,
            mode: 'enforced',
            allowed: Boolean(address && opts.allowAcceptedRoute),
          },
        })
        return
      }

      if (pathname === '/api/waitlist/me') {
        state.waitlistMeCalls += 1
        // Intentionally delay the response so that during the gap between
        // session hydration and query settlement the access guard must remain
        // in `loading` state. If it does not, the app will navigate to the
        // marketing waitlist path and this test will catch it.
        if (state.waitlistMeDelayMs > 0) {
          await delay(state.waitlistMeDelayMs)
        }
        await json({
          success: true,
          data: opts.allowAcceptedRoute
            ? { appAccessStatus: 'approved' }
            : { appAccessStatus: 'pending' },
        })
        return
      }

      await json({ success: true, data: null })
    })
    .then(() => state)
}

async function waitFor(predicate, { timeoutMs, label }) {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    if (predicate()) return
    await delay(100)
  }
  throw new Error(`Timed out waiting for ${label} (${timeoutMs}ms)`)
}

function createNavigationTracker(page) {
  /** @type {{ url: string; frame: string; at: number }[]} */
  const entries = []
  const start = Date.now()
  page.on('framenavigated', (frame) => {
    // Record all frame navigations (top-level + child).
    entries.push({ url: frame.url(), frame: frame.name() || 'main', at: Date.now() - start })
  })
  return entries
}

async function describePageState(page, diagnostics) {
  let bodyText = ''
  try {
    bodyText = await page.locator('body').innerText()
  } catch {
    bodyText = '<body unavailable>'
  }

  return [
    `URL: ${page.url()}`,
    `TITLE: ${await page.title().catch(() => '<title unavailable>')}`,
    `BODY: ${bodyText.slice(0, 2000)}`,
    `CONSOLE: ${(diagnostics.consoleMessages ?? []).join('\n') || '<none>'}`,
    `PAGE_ERRORS: ${(diagnostics.pageErrors ?? []).join('\n') || '<none>'}`,
    `API_REQUESTS: ${JSON.stringify(diagnostics.requestLog ?? [], null, 2)}`,
    `NAVIGATIONS: ${JSON.stringify(diagnostics.navigations ?? [], null, 2)}`,
  ].join('\n\n')
}

function findMarketingBounce(navigations) {
  // A bounce is any top-frame navigation whose pathname is exactly
  // /waitlist OR whose URL looks like a marketing needs-acceptance redirect.
  return navigations.find((entry) => {
    if (entry.frame !== 'main' && entry.frame !== '') return false
    try {
      const parsed = new URL(entry.url)
      if (parsed.pathname === MARKETING_WAITLIST_PATH) return true
      if (parsed.searchParams.get('reason') === 'needs-acceptance') return true
      return false
    } catch {
      return false
    }
  })
}

async function runApprovedNoBounceFlow(browser) {
  const page = await browser.newPage()
  page.setDefaultTimeout(20_000)
  const pageErrors = []
  const consoleMessages = []
  page.on('console', (message) => {
    consoleMessages.push(`${message.type()}: ${message.text()}`)
  })
  page.on('pageerror', (error) => {
    pageErrors.push(String(error?.message || error))
  })
  const navigations = createNavigationTracker(page)
  // 3s delay widens the render window between hasSession flipping true and
  // the waitlist/me query settling. On the buggy code this is when the guard
  // briefly saw `data=undefined, isLoading=false` and fired a redirect.
  const state = await createApiRouter(page, { allowAcceptedRoute: true, waitlistMeDelayMs: 3_000 })

  try {
    await page.goto(buildSwapHandoffUrl(), { waitUntil: 'domcontentloaded' })

    // Wait for the handoff redeem to actually fire. This is our primary
    // signal that the access runtime has mounted and begun its session flow.
    await waitFor(
      () => state.handoffRedeemCalls >= 1,
      { timeoutMs: 30_000, label: 'handoff redeem to fire' },
    )

    // Wait for /api/waitlist/me to be queried — this is the query whose
    // pre-settlement render window caused the original bounce bug.
    await waitFor(
      () => state.waitlistMeCalls >= 1,
      { timeoutMs: 10_000, label: 'waitlist/me to be queried' },
    )

    // Wait long enough for the full delay + response + subsequent renders.
    // The bounce symptom manifests as a location.replace to /waitlist fired
    // between the `hasSession` flip and the query settlement.
    await delay(Math.max(2500, state.waitlistMeDelayMs + 1500))

    const finalPathname = await page.evaluate(() => window.location.pathname)
    assert.equal(finalPathname, '/swap', `expected final pathname /swap, got ${finalPathname}`)

    const bounce = findMarketingBounce(navigations)
    assert.equal(
      bounce,
      undefined,
      `expected no intermediate navigation to the marketing waitlist; got ${bounce ? bounce.url : '<none>'}`,
    )

    assert.equal(state.handoffRedeemCalls, 1, 'expected a single handoff redeem call')
    assert.ok(state.waitlistMeCalls >= 1, 'expected /api/waitlist/me to be queried at least once')
    assert.deepEqual(pageErrors, [], `unexpected page errors: ${pageErrors.join('\n')}`)
  } catch (error) {
    const details = await describePageState(page, {
      pageErrors,
      consoleMessages,
      requestLog: state.requestLog,
      navigations,
    })
    throw new Error(`${error instanceof Error ? error.message : String(error)}\n\n${details}`)
  } finally {
    await page.close()
  }
}

async function main() {
  const server = startViteServer()

  try {
    await waitForServerReady(ORIGIN, 60_000)
    const browser = await chromium.launch({ headless: true })
    try {
      await runApprovedNoBounceFlow(browser)
    } finally {
      await browser.close()
    }
    console.log('waitlist→swap bounce regression: OK')
  } catch (error) {
    const detail = error instanceof Error ? `${error.message}\n\n${error.stack ?? ''}` : String(error)
    throw new Error(`${detail}\n\nVite server output:\n${server.readLog()}`)
  } finally {
    server.child.kill('SIGTERM')
    await delay(500).catch(() => {})
    if (!server.child.killed) {
      server.child.kill('SIGKILL')
    }
  }
}

await main()
