#!/usr/bin/env tsx
/**
 * Production AlfaClub cron smoke (requires real CRON_SECRET — not from vercel env pull).
 *
 *   CRON_SECRET=… pnpm -C frontend exec tsx scripts/ops/alfaclub-prod-cron-smoke.ts
 *   CRON_SECRET=… pnpm -C frontend exec tsx scripts/ops/alfaclub-prod-cron-smoke.ts --origin https://app.4626.fun
 */

declare const process: { env: Record<string, string | undefined>; argv: string[]; exit: (code: number) => void }

type StepResult = {
  name: string
  ok: boolean
  status: number
  detail: string
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

function classifyCronResponse(path: string, status: number, parsed: Record<string, unknown>): {
  ok: boolean
  detailSuffix: string
} {
  const suffixes: string[] = []
  const success = parsed.success
  const data = asRecord(parsed.data)

  if (typeof parsed.error === 'string') suffixes.push(parsed.error)
  if (success === false) suffixes.push('success=false')
  if (typeof data?.reason === 'string') suffixes.push(`reason=${data.reason}`)
  if (typeof data?.skipped === 'boolean') suffixes.push(`skipped=${data.skipped}`)
  if (typeof data?.sent === 'boolean') suffixes.push(`sent=${data.sent}`)

  let ok = status >= 200 && status < 300 && success !== false

  if (path.endsWith('/chat-auth-health') && data) {
    const lastSuccess = asRecord(data.lastSuccess)
    const lastFailure = asRecord(data.lastFailure)
    const failureAt = readIsoMs(lastFailure?.at)
    const successAt = readIsoMs(lastSuccess?.at)
    const errorCode = typeof lastFailure?.errorCode === 'string' ? lastFailure.errorCode : ''
    if (failureAt !== null && (successAt === null || failureAt > successAt)) {
      ok = false
      suffixes.push(`latest_failure=${errorCode || 'unknown'}`)
    }
  }

  if (path.endsWith('/chat-token-refresh')) {
    const text = [
      typeof parsed.error === 'string' ? parsed.error : '',
      typeof data?.reason === 'string' ? data.reason : '',
      typeof data?.message === 'string' ? data.message : '',
    ].join(' ')
    if (/invalid|missing_or_invalid_token|bootstrap tokens/i.test(text)) {
      ok = false
      suffixes.push('refresh_chain_unhealthy')
    }
  }

  if (path.endsWith('/chat-bridge-run') && success === false) {
    ok = false
    if (typeof data?.reason === 'string') suffixes.push(`bridge_${data.reason}`)
  }

  return {
    ok,
    detailSuffix: suffixes.length > 0 ? ` — ${Array.from(new Set(suffixes)).join(' — ')}` : '',
  }
}

function readArg(name: string): string | null {
  const prefix = `--${name}=`
  for (const raw of process.argv.slice(2)) {
    if (raw.startsWith(prefix)) return raw.slice(prefix.length).trim() || null
  }
  return null
}

function redactBody(text: string, max = 280): string {
  const trimmed = text.replace(/\s+/g, ' ').trim()
  const jwtLike = /[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/g
  return trimmed.replace(jwtLike, '<jwt>').slice(0, max)
}

async function callCron(
  origin: string,
  path: string,
  secret: string,
  method: 'GET' | 'POST' = 'POST',
): Promise<StepResult> {
  const url = `${origin.replace(/\/$/, '')}${path}`
  const response = await fetch(url, {
    method,
    headers: {
      'x-cron-secret': secret,
      'content-type': 'application/json',
    },
    body: method === 'POST' ? '{}' : undefined,
  })
  const body = await response.text().catch(() => '')
  let detail = `HTTP ${response.status}`
  let ok = response.status >= 200 && response.status < 300
  try {
    const parsed = JSON.parse(body) as Record<string, unknown>
    const classified = classifyCronResponse(path, response.status, parsed)
    ok = classified.ok
    detail += classified.detailSuffix
  } catch {
    detail += ` — ${redactBody(body)}`
  }
  return { name: path, ok, status: response.status, detail }
}

async function main(): Promise<void> {
  const secret = (process.env.CRON_SECRET ?? readArg('cron-secret') ?? '').trim()
  if (!secret) {
    console.error(
      'CRON_SECRET is required (env or --cron-secret=). vercel env pull often omits it — copy from Vercel dashboard.',
    )
    process.exit(2)
  }

  const origin = (readArg('origin') ?? process.env.ALFACLUB_SMOKE_ORIGIN ?? 'https://app.4626.fun').trim()

  const steps: Array<{ path: string; method: 'GET' | 'POST' }> = [
    { path: '/api/v1/alfaclub/chat-auth-health', method: 'GET' },
    { path: '/api/v1/alfaclub/chat-token-refresh', method: 'POST' },
    { path: '/api/v1/alfaclub/chat-bridge-run', method: 'POST' },
    { path: '/api/v1/alfaclub/daily-brief', method: 'GET' },
  ]

  console.log(`AlfaClub production cron smoke — ${origin}`)
  console.log('')

  let failures = 0
  for (const step of steps) {
    const result = await callCron(origin, step.path, secret, step.method)
    const mark = result.ok ? 'ok' : 'FAIL'
    if (!result.ok) failures += 1
    console.log(`[${mark}] ${result.name} — ${result.detail}`)
  }

  console.log('')
  if (failures > 0) {
    console.log(`${failures} step(s) failed. See docs/operations/alfaclub-token-rotation.md`)
    process.exit(1)
  }
  console.log('All cron endpoints returned 2xx. Run room checks: /help, /gmeow, /alfa brief post')
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
