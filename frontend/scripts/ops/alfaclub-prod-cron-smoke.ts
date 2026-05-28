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
  try {
    const parsed = JSON.parse(body) as Record<string, unknown>
    if (typeof parsed.error === 'string') detail += ` — ${parsed.error}`
    else if (parsed.success === true && parsed.data && typeof parsed.data === 'object') {
      const data = parsed.data as Record<string, unknown>
      if (typeof data.reason === 'string') detail += ` — reason=${data.reason}`
      if (typeof data.skipped === 'boolean') detail += ` — skipped=${data.skipped}`
      if (typeof data.sent === 'boolean') detail += ` — sent=${data.sent}`
    } else if (parsed.success === false) detail += ` — success=false`
  } catch {
    detail += ` — ${redactBody(body)}`
  }
  const ok = response.status >= 200 && response.status < 300
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
