#!/usr/bin/env tsx
/**
 * Read-only reproduction of the chat bridge's `room_history_paginate` fetch.
 *
 * Reproduces exactly what `fetchRoomHistory` in chatBridge.ts sends (DB-backed
 * `chat_jwt`, proxy base URL + `x-proxy-secret`, browser-fingerprint headers)
 * and prints status / timing / sanitized error detail — never token material.
 *
 * Use when Railway logs show `room_history_failed:no_fallback` and the
 * truncated log line hides the underlying status (timeout vs 4xx vs 5xx).
 *
 *   pnpm -C frontend exec tsx scripts/ops/alfaclub-room-history-probe.ts
 *   pnpm -C frontend exec tsx scripts/ops/alfaclub-room-history-probe.ts --room 1659 --limit 5
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

function redact(input: string): string {
  return String(input)
    .replace(/\b([A-Za-z0-9_-]{8,})\.([A-Za-z0-9_-]{8,})\.([A-Za-z0-9_-]{8,})\b/g, '<jwt>')
    .replace(/(Bearer\s+)[A-Za-z0-9._-]{16,}/gi, '$1<redacted>')
    .replace(/\b[A-Za-z0-9_-]{40,}\b/g, '<opaque>')
}

async function main(): Promise<void> {
  loadDotEnvIfPresent()

  // Import after env load so lazily-read config sees the dotenv values.
  const { readAlfaClubChatToken, extractJwtExpiryIso } = await import(
    '../../server/_lib/alfaclub/chatTokenStore.js'
  )
  const { buildAlfaClubApiHeaders, readAlfaClubApiAuthFlags, resolveAlfaClubApiCallBaseUrl, resolveAlfaClubProxySecret } =
    await import('../../server/_lib/alfaclub/apiAuth.js')

  const roomId = readArg('room', process.env.ALFACLUB_CHAT_ROOM_ID ?? '1043')
  const limit = readArg('limit', '5')
  const timeoutMs = Number.parseInt(readArg('timeout-ms', '12000'), 10)

  const flags = readAlfaClubApiAuthFlags()
  const apiBaseUrl = resolveAlfaClubApiCallBaseUrl(flags)
  const proxySecret = resolveAlfaClubProxySecret(flags)

  const record = await readAlfaClubChatToken()
  const jwt = record?.jwt?.trim() || (process.env.ALFACLUB_CHAT_JWT ?? '').trim() || null
  console.log('[probe] config', {
    roomId,
    apiBaseUrl,
    proxySecretPresent: Boolean(proxySecret),
    jwtSource: record?.jwt ? 'db' : jwt ? 'env' : 'none',
    jwtExp: jwt ? extractJwtExpiryIso(jwt) : null,
  })
  if (!jwt) {
    console.error('[probe] no chat JWT available (DB alfaclub_runtime_secret or ALFACLUB_CHAT_JWT)')
    process.exit(2)
  }

  const url = new URL('/api/websocket/room_history_paginate', apiBaseUrl)
  url.searchParams.set('roomId', roomId)
  url.searchParams.set('limit', limit)
  url.searchParams.set('forward', 'false')

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  const startedAt = Date.now()
  try {
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: buildAlfaClubApiHeaders({
        jwt,
        fingerprintBaseUrl: apiBaseUrl,
        proxySecret,
      }),
      signal: controller.signal,
    })
    const elapsedMs = Date.now() - startedAt
    const cfRay = response.headers.get('cf-ray')
    const cfMitigated = response.headers.get('cf-mitigated')
    const contentType = response.headers.get('content-type')
    if (response.ok) {
      const body = (await response.json()) as { messages?: unknown[] }
      console.log('[probe] OK', {
        status: response.status,
        elapsedMs,
        messages: Array.isArray(body.messages) ? body.messages.length : 'no-array',
        cfRay,
      })
      process.exit(0)
    }
    const text = await response.text().catch(() => '')
    console.error('[probe] FAILED', {
      status: response.status,
      elapsedMs,
      cfRay,
      cfMitigated,
      contentType,
      bodyHead: redact(text.slice(0, 200)).replace(/\s+/g, ' '),
    })
    process.exit(1)
  } catch (error) {
    const elapsedMs = Date.now() - startedAt
    const message = error instanceof Error ? error.message : String(error)
    console.error('[probe] NETWORK/TIMEOUT', { elapsedMs, error: redact(message) })
    process.exit(1)
  } finally {
    clearTimeout(timer)
  }
}

void main()
