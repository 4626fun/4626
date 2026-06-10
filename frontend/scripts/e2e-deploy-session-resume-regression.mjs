#!/usr/bin/env node

import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import process from 'node:process'
import { setTimeout as delay } from 'node:timers/promises'

import { chromium } from 'playwright'

const HOST = '127.0.0.1'
const PORT = Number(process.env.PORT || 4174)
const ORIGIN = `http://${HOST}:${PORT}`

async function waitForServerReady(origin, timeoutMs) {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const res = await fetch(`${origin}/deploy-session-resume-regression.html`)
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
      VITE_HOST_MODE_OVERRIDE: 'app',
      VITE_APP_ORIGIN: ORIGIN,
      VITE_MARKETING_ORIGIN: ORIGIN,
      VITE_PRIVY_ENABLED: '0',
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

async function main() {
  const server = startViteServer()
  const browser = await chromium.launch({ headless: true })

  try {
    await waitForServerReady(ORIGIN, 30_000)
    const page = await browser.newPage()
    const consoleMessages = []
    const pageErrors = []
    page.on('console', (message) => {
      consoleMessages.push(`${message.type()}: ${message.text()}`)
    })
    page.on('pageerror', (error) => {
      pageErrors.push(String(error?.message || error))
    })

    let statusCalls = 0
    let continueCalls = 0
    await page.route('**/api/deploy/v2/session/status', async (route) => {
      statusCalls += 1
      const fulfill = (status, body) =>
        route.fulfill({
          status,
          contentType: 'application/json',
          body: JSON.stringify(body),
        })

      if (statusCalls === 1) {
        await fulfill(401, { success: false, error: 'Not authenticated' })
        return
      }
      if (statusCalls === 2) {
        await fulfill(200, {
          success: true,
          data: {
            step: 'created',
            sessionSignerAddress: '0x00000000000000000000000000000000000000aa',
          },
        })
        return
      }
      if (statusCalls === 3) {
        await fulfill(200, {
          success: true,
          data: {
            step: 'phase2_sent',
            lastUserOpHash: `0x${'1'.repeat(64)}`,
          },
        })
        return
      }
      await fulfill(200, {
        success: true,
        data: {
          step: 'completed',
          lastTxHash: `0x${'2'.repeat(64)}`,
        },
      })
    })

    await page.route('**/api/deploy/v2/session/resume', async (route) => {
      continueCalls += 1
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { ok: true },
        }),
      })
    })

    await page.goto(`${ORIGIN}/deploy-session-resume-regression.html?autorun=1`, { waitUntil: 'domcontentloaded' })
    await page.waitForFunction(() => {
      const text = document.getElementById('output')?.textContent ?? ''
      return text.includes('"state": "completed"')
    })

    const result = await page.locator('#output').innerText()
    const parsed = JSON.parse(result)

    assert.equal(parsed.state, 'completed')
    assert.equal(parsed.ensurePaymasterSessionCalls, 1)
    assert.equal(parsed.cleared, true)
    assert.equal(parsed.sessionSignerAddress, '0x00000000000000000000000000000000000000AA')
    assert.deepEqual(parsed.steps, ['created', 'phase2_sent', 'completed'])
    // v2 flow issues one explicit resume from `created`, then one resume tick while pending.
    assert.equal(continueCalls, 2)
    assert.deepEqual(pageErrors, [], `unexpected page errors: ${pageErrors.join('\n')}`)

    await page.close()
    process.stdout.write(
      JSON.stringify(
        {
          ok: true,
          statusCalls,
          continueCalls,
          consoleMessages,
        },
        null,
        2,
      ) + '\n',
    )
  } finally {
    await browser.close().catch(() => {})
    server.child.kill('SIGTERM')
    await delay(250)
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
