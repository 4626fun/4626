#!/usr/bin/env tsx
/**
 * One-command AlfaClub chat-token repair.
 *
 * This is intentionally cron-secret based. It matches the production bootstrap
 * path that is safe for operators without requiring an admin browser bearer.
 * Token material is never printed, and the local triplet file is deleted after
 * validation by default.
 */

import { unlink, readFile } from 'node:fs/promises'
import { _testables } from '../alfaclub-restore-tokens.mjs'

declare const process: {
  argv: string[]
  env: Record<string, string | undefined>
  exit: (code: number) => never
}

type Triplet = {
  identityToken: string
  accessToken: string
  refreshToken: string
}

type CallResult = {
  name: string
  ok: boolean
  status: number
  body: string
  detail: string
}

const JWT_RE = /[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/g
const OPAQUE_RE = /\b[A-Za-z0-9_-]{40,}\b/g

function readArg(name: string): string | null {
  const prefix = `--${name}=`
  for (const raw of process.argv.slice(2)) {
    if (raw.startsWith(prefix)) return raw.slice(prefix.length).trim() || null
  }
  return null
}

function hasFlag(name: string): boolean {
  return process.argv.slice(2).includes(`--${name}`)
}

function redact(value: unknown, max = 800): string {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .replace(JWT_RE, '<jwt>')
    .replace(OPAQUE_RE, '<opaque>')
    .trim()
    .slice(0, max)
}

function parseJsonObject(text: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(text) as unknown
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null
  } catch {
    return null
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function readIsoMs(value: unknown): number | null {
  if (typeof value !== 'string' || !value.trim()) return null
  const ms = Date.parse(value)
  return Number.isFinite(ms) ? ms : null
}

function buildUrl(origin: string, path: string): string {
  return `${origin.replace(/\/$/, '')}${path}`
}

async function callJsonEndpoint(params: {
  name: string
  url: string
  method: 'GET' | 'POST'
  cronSecret: string
  body?: Record<string, unknown>
}): Promise<CallResult> {
  const response = await fetch(params.url, {
    method: params.method,
    headers: {
      'content-type': 'application/json',
      'x-cron-secret': params.cronSecret,
    },
    body: params.method === 'POST' ? JSON.stringify(params.body ?? {}) : undefined,
  })
  const body = await response.text().catch(() => '')
  const parsed = parseJsonObject(body)
  const success = parsed?.success
  const data = asRecord(parsed?.data)
  const reason = typeof data?.reason === 'string' ? data.reason : null
  const error = typeof parsed?.error === 'string' ? parsed.error : null
  const ok = response.status >= 200 && response.status < 300 && success !== false
  const detail = [
    `HTTP ${response.status}`,
    error,
    success === false ? 'success=false' : null,
    reason ? `reason=${reason}` : null,
  ].filter(Boolean).join(' — ')
  return { name: params.name, ok, status: response.status, body, detail }
}

function healthIsHealthy(body: string): { ok: boolean; reason: string | null } {
  const parsed = parseJsonObject(body)
  const data = asRecord(parsed?.data)
  const lastSuccess = asRecord(data?.lastSuccess)
  const lastFailure = asRecord(data?.lastFailure)
  const failureAt = readIsoMs(lastFailure?.at)
  const successAt = readIsoMs(lastSuccess?.at)
  if (failureAt !== null && (successAt === null || failureAt > successAt)) {
    const code = typeof lastFailure?.errorCode === 'string' ? lastFailure.errorCode : 'unknown'
    return { ok: false, reason: `latest refresh failure after success (${code})` }
  }
  const liveChatJwt = asRecord(data?.liveChatJwt)
  const minutes = typeof liveChatJwt?.minutesUntilExpiry === 'number'
    ? liveChatJwt.minutesUntilExpiry
    : null
  if (minutes !== null && minutes < 10) {
    return { ok: false, reason: `live chat JWT expires too soon (${minutes}m)` }
  }
  return { ok: true, reason: null }
}

async function loadTriplet(path: string): Promise<Triplet> {
  const raw = await readFile(path, 'utf8')
  const result = _testables.validateTripletJson(raw, { now: Date.now })
  if (!result.ok) throw new Error(result.error)
  return result.triplet as Triplet
}

async function deleteTriplet(path: string): Promise<void> {
  try {
    await unlink(path)
    console.log(`Deleted local triplet file: ${path}`)
  } catch (error) {
    console.warn(`Warning: could not delete local triplet file: ${redact(error instanceof Error ? error.message : error)}`)
  }
}

async function main(): Promise<void> {
  const tripletPath = process.argv.slice(2).find((arg) => !arg.startsWith('--')) ?? './triplet.json'
  const origin = readArg('origin') ?? process.env.ALFACLUB_REPAIR_ORIGIN ?? 'https://app.4626.fun'
  const cronSecret = readArg('cron-secret') ?? process.env.CRON_SECRET ?? ''
  const keepFile = hasFlag('keep-file')

  if (!cronSecret.trim()) {
    console.error('error: CRON_SECRET is required (env or --cron-secret=...)')
    process.exit(2)
  }

  let shouldDelete = false
  try {
    const triplet = await loadTriplet(tripletPath)
    shouldDelete = true

    console.log('AlfaClub chat-token repair')
    console.log('  identity_token:', _testables.describeJwt(triplet.identityToken))
    console.log('  privy_access  :', _testables.describeJwt(triplet.accessToken))
    console.log('  refresh_token :', _testables.describeOpaque(triplet.refreshToken))
    console.log('  origin        :', origin)
    console.log('')

    const seed = await callJsonEndpoint({
      name: 'chat-token',
      url: buildUrl(origin, '/api/v1/alfaclub/chat-token'),
      method: 'POST',
      cronSecret,
      body: {
        jwt: triplet.identityToken,
        privyAccessToken: triplet.accessToken,
        privyRefreshToken: triplet.refreshToken,
      },
    })
    console.log(`[${seed.ok ? 'ok' : 'FAIL'}] ${seed.name} — ${seed.detail}`)
    if (!seed.ok) {
      console.log(redact(seed.body))
      process.exit(1)
    }

    const refresh = await callJsonEndpoint({
      name: 'chat-token-refresh',
      url: buildUrl(origin, '/api/v1/alfaclub/chat-token-refresh'),
      method: 'POST',
      cronSecret,
    })
    console.log(`[${refresh.ok ? 'ok' : 'FAIL'}] ${refresh.name} — ${refresh.detail}`)
    if (!refresh.ok || /missing_or_invalid_token|bootstrap tokens are invalid/i.test(refresh.body)) {
      console.log(redact(refresh.body))
      process.exit(1)
    }

    const bridge = await callJsonEndpoint({
      name: 'chat-bridge-run',
      url: buildUrl(origin, '/api/v1/alfaclub/chat-bridge-run'),
      method: 'POST',
      cronSecret,
    })
    console.log(`[${bridge.ok ? 'ok' : 'FAIL'}] ${bridge.name} — ${bridge.detail}`)
    if (!bridge.ok) {
      console.log(redact(bridge.body))
      process.exit(1)
    }

    const health = await callJsonEndpoint({
      name: 'chat-auth-health',
      url: buildUrl(origin, '/api/v1/alfaclub/chat-auth-health'),
      method: 'GET',
      cronSecret,
    })
    const healthCheck = healthIsHealthy(health.body)
    const healthOk = health.ok && healthCheck.ok
    console.log(`[${healthOk ? 'ok' : 'FAIL'}] ${health.name} — ${health.detail}${healthCheck.reason ? ` — ${healthCheck.reason}` : ''}`)
    if (!healthOk) process.exit(1)

    console.log('')
    console.log('AlfaClub chat-token repair complete.')
  } catch (error) {
    console.error(`error: ${redact(error instanceof Error ? error.message : error)}`)
    process.exit(1)
  } finally {
    if (shouldDelete && !keepFile) await deleteTriplet(tripletPath)
  }
}

main()
