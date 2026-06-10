#!/usr/bin/env tsx
/**
 * Trigger one safe AlfaClub snapshot refresh and verify leaderboard freshness.
 *
 * Usage:
 *   CRON_SECRET=... pnpm -C frontend exec tsx scripts/ops/alfaclub-refresh-snapshot.ts
 *   CRON_SECRET=... pnpm -C frontend exec tsx scripts/ops/alfaclub-refresh-snapshot.ts --origin https://app.4626.fun
 *   CRON_SECRET=... pnpm -C frontend exec tsx scripts/ops/alfaclub-refresh-snapshot.ts --max-wait-ms 20000
 *   CRON_SECRET=... pnpm -C frontend exec tsx scripts/ops/alfaclub-refresh-snapshot.ts --attempts 3
 */

declare const process: {
  env: Record<string, string | undefined>
  argv: string[]
  exit: (code: number) => void
}

type LeaderboardResponse = {
  success?: boolean
  error?: string
  data?: {
    snapshotTs?: string | null
    rows?: unknown[]
    totalRanked?: number
  }
}

type RunResponse = {
  success?: boolean
  error?: string
  reason?: string | null
  data?: {
    snapshotTs?: string | null
    rankedCreators?: number
  }
}

function readArg(name: string): string | null {
  const prefix = `--${name}=`
  for (const raw of process.argv.slice(2)) {
    if (raw.startsWith(prefix)) {
      const value = raw.slice(prefix.length).trim()
      return value.length > 0 ? value : null
    }
  }
  return null
}

function readNumberArg(name: string, fallback: number): number {
  const raw = readArg(name)
  if (!raw) return fallback
  const value = Number(raw)
  if (!Number.isFinite(value) || value <= 0) return fallback
  return Math.floor(value)
}

function toComparableTs(value: string | null | undefined): number | null {
  if (!value) return null
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : null
}

async function fetchLeaderboard(origin: string): Promise<LeaderboardResponse> {
  const response = await fetch(`${origin}/api/v1/alfaclub/leaderboard`, {
    method: 'GET',
    headers: { accept: 'application/json' },
  })
  const body = (await response.json().catch(() => ({}))) as LeaderboardResponse
  if (!response.ok) {
    throw new Error(`leaderboard_failed_http_${response.status}:${body.error ?? 'unknown'}`)
  }
  return body
}

async function triggerRun(origin: string, secret: string): Promise<RunResponse> {
  const response = await fetch(`${origin}/api/v1/alfaclub/run`, {
    method: 'POST',
    headers: {
      'x-cron-secret': secret,
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: '{}',
  })
  const body = (await response.json().catch(() => ({}))) as RunResponse
  if (!response.ok) {
    throw new Error(`run_failed_http_${response.status}:${body.error ?? body.reason ?? 'unknown'}`)
  }
  return body
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

async function main(): Promise<void> {
  const secret = (process.env.CRON_SECRET ?? readArg('cron-secret') ?? '').trim()
  if (!secret) {
    console.error('CRON_SECRET is required (env or --cron-secret=...).')
    process.exit(2)
  }

  const origin = (readArg('origin') ?? process.env.ALFACLUB_SMOKE_ORIGIN ?? 'https://app.4626.fun')
    .trim()
    .replace(/\/+$/, '')
  const maxWaitMs = readNumberArg('max-wait-ms', 30_000)
  const pollEveryMs = readNumberArg('poll-every-ms', 2_000)
  const attempts = Math.max(1, readNumberArg('attempts', 1))

  const before = await fetchLeaderboard(origin)
  const beforeTsRaw = before.data?.snapshotTs ?? null
  const beforeTs = toComparableTs(beforeTsRaw)
  console.log(
    `Before: snapshotTs=${beforeTsRaw ?? 'none'} totalRanked=${before.data?.totalRanked ?? 0} attempts=${attempts}`,
  )

  let latest = before
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const run = await triggerRun(origin, secret)
    console.log(
      `Run attempt ${attempt}/${attempts}: success=${run.success === true ? 'true' : 'false'} reason=${run.reason ?? 'none'} snapshotTs=${run.data?.snapshotTs ?? 'none'} ranked=${run.data?.rankedCreators ?? 0}`,
    )

    const startedAt = Date.now()
    while (Date.now() - startedAt <= maxWaitMs) {
      latest = await fetchLeaderboard(origin)
      const latestTsRaw = latest.data?.snapshotTs ?? null
      const latestTs = toComparableTs(latestTsRaw)
      const advanced = latestTs !== null && (beforeTs === null || latestTs > beforeTs)
      if (advanced) {
        console.log(
          `After: snapshot advanced to ${latestTsRaw} totalRanked=${latest.data?.totalRanked ?? 0}`,
        )
        return
      }
      await sleep(pollEveryMs)
    }

    if (attempt < attempts) {
      const latestTsRaw = latest.data?.snapshotTs ?? null
      console.log(
        `Attempt ${attempt} did not advance snapshot (still ${latestTsRaw ?? 'none'}). Retrying...`,
      )
    }
  }

  const latestTsRaw = latest.data?.snapshotTs ?? null
  console.error(
    `Snapshot did not advance after ${attempts} attempt(s) (before=${beforeTsRaw ?? 'none'}, after=${latestTsRaw ?? 'none'}). Check /api/v1/alfaclub/run logs and ALFACLUB_VIGILANTE_* env.`,
  )
  process.exit(1)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})

