#!/usr/bin/env node

import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import process from 'node:process'
import { setTimeout as delay } from 'node:timers/promises'

import { chromium } from 'playwright'

const HOST = '127.0.0.1'
const PORT = Number(process.env.PORT || 4173)
const ORIGIN = `http://${HOST}:${PORT}`
const SESSION_ADDRESS = '0x1234567890123456789012345678901234567890'
const HANDOFF_CODE = 'a'.repeat(64)

function buildAppContinueUrl(nextPath) {
  const params = new URLSearchParams({
    from: 'waitlist',
    autologin: '1',
    auth: 'wallet',
    next: nextPath,
    cv_handoff: HANDOFF_CODE,
  })
  return `${ORIGIN}/continue?${params.toString()}`
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
  const child = spawn(
    'pnpm',
    ['vite', '--host', HOST, '--port', String(PORT)],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        CI: '1',
        VITE_HOST_MODE_OVERRIDE: 'app',
        VITE_APP_ORIGIN: ORIGIN,
        VITE_MARKETING_ORIGIN: ORIGIN,
        VITE_PRIVY_ENABLED: '0',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  )

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
    allowlistAddressCalls: [],
    requestLog: [],
  }

  return page.route('**/*', async (route) => {
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
      authorization: route.request().headers().authorization ?? null,
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
      requestEntry.response = {
        address: SESSION_ADDRESS,
        sessionToken: 'test-session-token',
      }
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
      requestEntry.response = {
        sessionEstablished: state.sessionEstablished,
        address: state.sessionEstablished ? SESSION_ADDRESS : null,
      }
      await json({
        success: true,
        data: state.sessionEstablished ? { address: SESSION_ADDRESS } : null,
      })
      return
    }

    if (pathname === '/api/auth/admin') {
      requestEntry.response = {
        sessionEstablished: state.sessionEstablished,
        isAdmin: false,
      }
      await json({
        success: true,
        data: state.sessionEstablished ? { address: SESSION_ADDRESS, isAdmin: false } : null,
      })
      return
    }

    if (pathname === '/api/creator-allowlist') {
      const address = (url.searchParams.get('address') || '').trim().toLowerCase() || null
      if (address) state.allowlistAddressCalls.push(address)
      requestEntry.response = {
        address,
        allowed: Boolean(address && opts.allowAcceptedRoute),
      }
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
      requestEntry.response = null
      await json({
        success: true,
        data: null,
      })
      return
    }

    requestEntry.response = null
    await json({
      success: true,
      data: null,
    })
  }).then(() => state)
}

async function describePageState(page, diagnostics) {
  let bodyText = ''
  try {
    bodyText = await page.locator('body').innerText()
  } catch {
    bodyText = '<body unavailable>'
  }

  let sessionToken = '<unavailable>'
  try {
    sessionToken = await page.evaluate(() => window.sessionStorage.getItem('cv_siwe_session_token') ?? '<missing>')
  } catch {
    // ignore
  }

  return [
    `URL: ${page.url()}`,
    `TITLE: ${await page.title().catch(() => '<title unavailable>')}`,
    `SESSION_TOKEN: ${sessionToken}`,
    `BODY: ${bodyText.slice(0, 4000)}`,
    `CONSOLE: ${(diagnostics.consoleMessages ?? []).join('\n') || '<none>'}`,
    `PAGE_ERRORS: ${(diagnostics.pageErrors ?? []).join('\n') || '<none>'}`,
    `API_REQUESTS: ${JSON.stringify(diagnostics.requestLog ?? [], null, 2)}`,
  ].join('\n\n')
}

async function runAcceptedFlow(browser) {
  const page = await browser.newPage()
  page.setDefaultTimeout(15_000)
  const pageErrors = []
  const consoleMessages = []
  page.on('console', (message) => {
    consoleMessages.push(`${message.type()}: ${message.text()}`)
  })
  page.on('pageerror', (error) => {
    pageErrors.push(String(error?.message || error))
  })
  const state = await createApiRouter(page, { allowAcceptedRoute: true })

  try {
    await page.goto(buildAppContinueUrl('/positions'), { waitUntil: 'domcontentloaded' })
    await page.waitForFunction(() => window.location.pathname === '/positions')
    await page.waitForSelector('text=Positions')

    assert.equal(state.handoffRedeemCalls, 1, 'expected a single handoff redeem call')
    assert.ok(state.authMeCalls >= 2, 'expected /api/auth/me before and after handoff redemption')
    assert.ok(
      state.allowlistAddressCalls.includes(SESSION_ADDRESS.toLowerCase()),
      'expected allowlist lookup for the resolved session address',
    )
    assert.deepEqual(pageErrors, [], `unexpected page errors during accepted flow: ${pageErrors.join('\n')}`)
  } catch (error) {
    const details = await describePageState(page, { pageErrors, consoleMessages, requestLog: state.requestLog })
    throw new Error(`${error instanceof Error ? error.message : String(error)}\n\n${details}`)
  } finally {
    await page.close()
  }
}

async function runRejectedFlow(browser) {
  const page = await browser.newPage()
  page.setDefaultTimeout(15_000)
  const pageErrors = []
  const consoleMessages = []
  page.on('console', (message) => {
    consoleMessages.push(`${message.type()}: ${message.text()}`)
  })
  page.on('pageerror', (error) => {
    pageErrors.push(String(error?.message || error))
  })
  const state = await createApiRouter(page, { allowAcceptedRoute: false })

  try {
    await page.goto(buildAppContinueUrl('/positions'), { waitUntil: 'domcontentloaded' })
    await page.waitForFunction(() => {
      const url = new URL(window.location.href)
      return url.pathname === '/' && url.searchParams.get('reason') === 'needs-acceptance' && url.hash === '#waitlist'
    })

    const finalUrl = new URL(page.url())
    assert.equal(finalUrl.pathname, '/')
    assert.equal(finalUrl.searchParams.get('reason'), 'needs-acceptance')
    assert.equal(finalUrl.hash, '#waitlist')
    assert.equal(state.handoffRedeemCalls, 1, 'expected rejected flow to still redeem the handoff once')
    assert.ok(
      state.allowlistAddressCalls.includes(SESSION_ADDRESS.toLowerCase()),
      'expected rejected flow to check allowlist status for the resolved session address',
    )
    assert.deepEqual(pageErrors, [], `unexpected page errors during rejected flow: ${pageErrors.join('\n')}`)
  } catch (error) {
    const details = await describePageState(page, { pageErrors, consoleMessages, requestLog: state.requestLog })
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
      await runAcceptedFlow(browser)
      await runRejectedFlow(browser)
    } finally {
      await browser.close()
    }
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
