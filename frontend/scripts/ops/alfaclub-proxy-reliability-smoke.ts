#!/usr/bin/env tsx
/**
 * AlfaClub proxy reliability smoke:
 *  1) Gate check: request without x-proxy-secret must return 401.
 *  2) E2E check: room_history_paginate through the proxy must return 200.
 *
 * Usage:
 *   pnpm -C frontend exec tsx scripts/ops/alfaclub-proxy-reliability-smoke.ts
 *   pnpm -C frontend exec tsx scripts/ops/alfaclub-proxy-reliability-smoke.ts --room 1659 --limit 20
 *   pnpm -C frontend exec tsx scripts/ops/alfaclub-proxy-reliability-smoke.ts --skip-gate
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

declare const process: {
  env: Record<string, string | undefined>
  argv: string[]
  exit: (code: number) => void
  cwd: () => string
}

function loadDotEnvIfPresent(): void {
  for (const candidate of ['.env', 'frontend/.env']) {
    let raw: string
    try {
      raw = readFileSync(resolve(process.cwd(), candidate), 'utf8')
    } catch {
      continue
    }
    for (const line of raw.split('\n')) {
      const match = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line)
      if (!match) continue
      const key = match[1]
      if (process.env[key] !== undefined) continue
      let value = match[2]
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }
      process.env[key] = value
    }
    return
  }
}

function readArg(name: string, fallback: string): string {
  const prefix = `--${name}=`
  const argv = process.argv.slice(2)
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === `--${name}` && argv[i + 1]) return argv[i + 1]
    if (argv[i].startsWith(prefix)) return argv[i].slice(prefix.length)
  }
  return fallback
}

function hasFlag(flag: string): boolean {
  return process.argv.slice(2).includes(flag)
}

function redact(input: string): string {
  return String(input)
    .replace(/\b([A-Za-z0-9_-]{8,})\.([A-Za-z0-9_-]{8,})\.([A-Za-z0-9_-]{8,})\b/g, '<jwt>')
    .replace(/(Bearer\s+)[A-Za-z0-9._-]{16,}/gi, '$1<redacted>')
    .replace(/\b[A-Za-z0-9_-]{40,}\b/g, '<opaque>')
}

function bodyHead(text: string): string {
  return redact(text.slice(0, 200)).replace(/\s+/g, ' ')
}

async function main(): Promise<void> {
  loadDotEnvIfPresent()

  const {
    readAlfaClubChatToken,
    extractJwtExpiryIso,
  } = await import('../../server/_lib/alfaclub/chatTokenStore.js')
  const {
    buildAlfaClubApiHeaders,
    readAlfaClubApiAuthFlags,
    resolveAlfaClubApiCallBaseUrl,
    resolveAlfaClubProxySecret,
  } = await import('../../server/_lib/alfaclub/apiAuth.js')

  const roomId = readArg('room', process.env.ALFACLUB_CHAT_ROOM_ID ?? '1659')
  const limit = readArg('limit', '20')
  const timeoutMs = Number.parseInt(readArg('timeout-ms', '12000'), 10)
  const skipGate = hasFlag('--skip-gate')

  const flags = readAlfaClubApiAuthFlags()
  const apiBaseUrl = resolveAlfaClubApiCallBaseUrl(flags)
  const proxySecret = resolveAlfaClubProxySecret(flags)

  const record = await readAlfaClubChatToken()
  const jwt = record?.jwt?.trim() || (process.env.ALFACLUB_CHAT_JWT ?? '').trim() || null

  console.log('[smoke] config', {
    apiBaseUrl,
    proxySecretPresent: Boolean(proxySecret),
    jwtSource: record?.jwt ? 'db' : jwt ? 'env' : 'none',
    jwtExp: jwt ? extractJwtExpiryIso(jwt) : null,
    roomId,
    limit,
    timeoutMs,
    skipGate,
  })

  let failures = 0
  const baseUrl = new URL('/api/websocket/room_history_paginate', apiBaseUrl)
  baseUrl.searchParams.set('roomId', roomId)
  baseUrl.searchParams.set('limit', limit)
  baseUrl.searchParams.set('forward', 'false')

  if (!skipGate) {
    const gateStartedAt = Date.now()
    const gateResponse = await fetch(baseUrl.toString(), {
      method: 'GET',
      headers: {
        accept: 'application/json, text/plain, */*',
      },
    })
    const gateElapsedMs = Date.now() - gateStartedAt
    const gateBody = await gateResponse.text().catch(() => '')
    const gateLooksRight =
      gateResponse.status === 401 &&
      /unauthorized/i.test(gateBody)

    if (gateLooksRight) {
      console.log('[smoke] gate OK', {
        status: gateResponse.status,
        elapsedMs: gateElapsedMs,
        bodyHead: bodyHead(gateBody),
      })
    } else {
      failures += 1
      console.error('[smoke] gate FAILED', {
        expected: '401 unauthorized',
        status: gateResponse.status,
        elapsedMs: gateElapsedMs,
        bodyHead: bodyHead(gateBody),
      })
    }
  }

  if (!jwt) {
    console.error('[smoke] e2e FAILED', {
      reason: 'no chat JWT available (DB alfaclub_runtime_secret or ALFACLUB_CHAT_JWT)',
    })
    process.exit(2)
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  const e2eStartedAt = Date.now()
  try {
    const e2eResponse = await fetch(baseUrl.toString(), {
      method: 'GET',
      headers: buildAlfaClubApiHeaders({
        jwt,
        fingerprintBaseUrl: apiBaseUrl,
        proxySecret,
      }),
      signal: controller.signal,
    })
    const e2eElapsedMs = Date.now() - e2eStartedAt
    const cfRay = e2eResponse.headers.get('cf-ray')
    const cfMitigated = e2eResponse.headers.get('cf-mitigated')

    if (e2eResponse.ok) {
      const body = (await e2eResponse.json()) as { messages?: unknown[] }
      console.log('[smoke] e2e OK', {
        status: e2eResponse.status,
        elapsedMs: e2eElapsedMs,
        messages: Array.isArray(body.messages) ? body.messages.length : 'no-array',
        cfRay,
      })
    } else {
      failures += 1
      const text = await e2eResponse.text().catch(() => '')
      console.error('[smoke] e2e FAILED', {
        status: e2eResponse.status,
        elapsedMs: e2eElapsedMs,
        cfRay,
        cfMitigated,
        bodyHead: bodyHead(text),
      })
    }
  } catch (error) {
    failures += 1
    const elapsedMs = Date.now() - e2eStartedAt
    const message = error instanceof Error ? error.message : String(error)
    console.error('[smoke] e2e NETWORK/TIMEOUT', {
      elapsedMs,
      error: redact(message),
    })
  } finally {
    clearTimeout(timer)
  }

  if (failures > 0) {
    console.error('[smoke] FAILED', { failures })
    process.exit(1)
  }
  console.log('[smoke] PASSED')
}

void main()
