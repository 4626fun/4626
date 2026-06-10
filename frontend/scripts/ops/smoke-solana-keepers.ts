#!/usr/bin/env node
/**
 * Live smoke: Solana provisioner + orchestrator + Vercel control plane + keeper_jobs health.
 *
 * Usage:
 *   pnpm -C frontend exec tsx scripts/ops/smoke-solana-keepers.ts
 *   pnpm -C frontend exec tsx scripts/ops/smoke-solana-keepers.ts --production
 *
 * Loads frontend/.env (and .env.local). Exits 1 on hard blockers; relay_entries must be disabled.
 */

import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

declare const process: {
  argv: string[]
  env: Record<string, string | undefined>
  exit: (code?: number) => never
  stdout: { write: (chunk: string) => void }
  stderr: { write: (chunk: string) => void }
}

const __dirname = dirname(fileURLToPath(import.meta.url))
const FRONTEND_ROOT = resolve(__dirname, '../..')

function loadEnvFile(path: string): void {
  if (!existsSync(path)) return
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq < 0) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (key && process.env[key] === undefined) process.env[key] = value
  }
}

loadEnvFile(resolve(FRONTEND_ROOT, '.env.local'))
loadEnvFile(resolve(FRONTEND_ROOT, '.env'))

const production = process.argv.includes('--production')
const appBase = production ? 'https://app.4626.fun' : process.env.KEEPER_COORDINATION_BASE_URL?.replace(/\/api\/?$/, '') ?? 'http://localhost:5173'

type Row = { id: string; ok: boolean; detail: string }

async function fetchJson(
  url: string,
  init: RequestInit = {},
): Promise<{ ok: boolean; status: number; data: unknown; detail: string }> {
  try {
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(90_000) })
    const text = await res.text()
    let data: unknown = text
    try {
      data = JSON.parse(text)
    } catch {
      // text
    }
    return { ok: res.ok, status: res.status, data, detail: `HTTP ${res.status}` }
  } catch (err) {
    return {
      ok: false,
      status: 0,
      data: null,
      detail: err instanceof Error ? err.message : String(err),
    }
  }
}

async function checkKeeperJobsHealth(kprKey: string): Promise<Row[]> {
  const rows: Row[] = []
  const health = await fetchJson(`${appBase}/api/keeper/jobs/health`, {
    headers: { Authorization: `Bearer ${kprKey}` },
  })
  const data = (health.data as { success?: boolean; data?: { retry?: number; failed?: number } })?.data
  rows.push({
    id: 'keeper_jobs_health',
    ok: health.ok && (health.data as { success?: boolean })?.success === true,
    detail: health.ok
      ? `retry=${data?.retry ?? '?'} failed=${data?.failed ?? '?'}`
      : health.detail,
  })

  const { getDb, getDbInitError } = await import('../../server/_lib/db/postgres.js')
  const db = await getDb()
  if (!db) {
    rows.push({
      id: 'keeper_jobs_failed_sample',
      ok: true,
      detail: `SKIP DB: ${getDbInitError() ?? 'no DATABASE_URL'}`,
    })
    return rows
  }

  const sample = await db.sql`
    SELECT id, kind, status, attempt_count, last_error, updated_at::text AS updated_at
    FROM keeper_jobs
    WHERE status = 'failed'
    ORDER BY updated_at DESC
    LIMIT 15;
  `
  const failedCount = await db.sql`
    SELECT COUNT(*)::int AS n FROM keeper_jobs WHERE status = 'failed';
  `
  const n = Number(failedCount.rows?.[0]?.n ?? 0)
  const lines = (sample.rows ?? []).map((r) => {
    const err = String(r.last_error ?? '').slice(0, 120)
    return `  #${r.id} ${r.kind} attempts=${r.attempt_count} @${r.updated_at} — ${err}`
  })
  rows.push({
    id: 'keeper_jobs_failed_detail',
    ok: n === 0,
    detail:
      n === 0
        ? 'no failed keeper_jobs'
        : `${n} failed total; recent:\n${lines.join('\n') || '  (none in sample)'}`,
  })
  return rows
}

async function main(): Promise<void> {
  const orchKey = process.env.SOLANA_ORCHESTRATOR_API_KEY?.trim()
  const provSecret = process.env.SOLANA_DYNAMIC_ROUTE_PROVISIONER_SECRET?.trim()
  const kprKey = process.env.KPR_API_KEY?.trim()
  const checkpoint = `smoke-${Date.now()}`
  const rows: Row[] = []

  process.stdout.write(`smoke-solana-keepers (${production ? 'production' : 'local app base'})\n`)
  process.stdout.write(`appBase=${appBase}\n\n`)

  const orchHealth = await fetchJson('https://orchestrator.4626.fun/healthz')
  rows.push({
    id: 'orchestrator_healthz',
    ok: orchHealth.ok && (orchHealth.data as { ok?: boolean })?.ok === true,
    detail: orchHealth.detail,
  })

  if (!orchKey) {
    rows.push({ id: 'orchestrator_reconcile', ok: false, detail: 'SOLANA_ORCHESTRATOR_API_KEY missing' })
  } else {
    for (const action of ['settle_fees', 'winner_relay'] as const) {
      const res = await fetchJson('https://orchestrator.4626.fun/reconcile', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${orchKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action,
          workflow: 'smoke',
          checkpointKey: `${checkpoint}-${action}`,
        }),
      })
      rows.push({
        id: `orchestrator_${action}`,
        ok: res.ok && (res.data as { ok?: boolean })?.ok === true,
        detail: res.ok ? `${action} OK` : `${res.detail} ${JSON.stringify(res.data).slice(0, 200)}`,
      })
    }
    const relay = await fetchJson('https://orchestrator.4626.fun/reconcile', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${orchKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'relay_entries',
        workflow: 'smoke',
        checkpointKey: `${checkpoint}-relay`,
      }),
    })
    const relayDisabled =
      relay.status === 503 &&
      String((relay.data as { error?: string })?.error ?? '').includes('action_disabled:relay_entries')
    rows.push({
      id: 'relay_entries_paused',
      ok: relayDisabled,
      detail: relayDisabled
        ? 'relay_entries correctly disabled (B2 gate)'
        : `expected action_disabled, got ${relay.status}`,
    })
  }

  const provUrl =
    process.env.SOLANA_DYNAMIC_ROUTE_PROVISIONER_HEALTH_URL?.trim() ??
    'https://provisioner.4626.fun/healthz'
  const prov = await fetchJson(provUrl, {
    headers: provSecret ? { Authorization: `Bearer ${provSecret}` } : {},
  })
  const provData = prov.data as { ok?: boolean; payerHealthy?: boolean }
  rows.push({
    id: 'provisioner_health',
    ok: prov.ok && provData?.ok === true && provData?.payerHealthy === true,
    detail: prov.ok
      ? `payerHealthy=${String(provData?.payerHealthy)}`
      : provSecret
        ? prov.detail
        : `${prov.detail} (set SOLANA_DYNAMIC_ROUTE_PROVISIONER_SECRET)`,
  })

  if (!kprKey) {
    rows.push({ id: 'vercel_solana_reconcile', ok: false, detail: 'KPR_API_KEY missing' })
  } else if (production) {
    const chain = await fetchJson(`${appBase}/api/keeper/solana/reconcile`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${kprKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        workflow: 'solana-orchestrator',
        action: 'settle_fees',
        checkpointKey: `${checkpoint}-vercel`,
      }),
    })
    const chainData = (chain.data as { data?: { status?: string; executed?: boolean } })?.data
    rows.push({
      id: 'vercel_solana_reconcile',
      ok:
        chain.ok &&
        (chain.data as { success?: boolean })?.success === true &&
        chainData?.status === 'completed' &&
        chainData?.executed === true,
      detail: chain.ok
        ? `status=${chainData?.status} executed=${String(chainData?.executed)}`
        : `${chain.detail}`,
    })
    const infra = await fetchJson(`${appBase}/api/deploy/solanaInfraStatus`, {
      headers: { Authorization: `Bearer ${kprKey}` },
    })
    const infraData = (infra.data as { data?: { readyForAutoRegistration?: boolean; blockers?: string[] } })
      ?.data
    rows.push({
      id: 'solana_infra_status',
      ok: Boolean(infraData?.readyForAutoRegistration && (infraData.blockers?.length ?? 0) === 0),
      detail: infraData
        ? `ready=${String(infraData.readyForAutoRegistration)} blockers=${JSON.stringify(infraData.blockers ?? [])}`
        : infra.detail,
    })
    rows.push(...(await checkKeeperJobsHealth(kprKey)))
  } else {
    rows.push({
      id: 'vercel_chain',
      ok: true,
      detail: 'SKIP production Vercel chain (pass --production)',
    })
  }

  const blockers = rows.filter((r) => !r.ok && r.id !== 'keeper_jobs_failed_detail')
  const warnings = rows.filter((r) => !r.ok && r.id === 'keeper_jobs_failed_detail')

  for (const r of rows) {
    process.stdout.write(`${r.ok ? 'OK' : r.id === 'keeper_jobs_failed_detail' ? 'WARN' : 'FAIL'} ${r.id}: ${r.detail}\n`)
  }

  if (blockers.length > 0) {
    process.stderr.write(`\n${blockers.length} blocker(s)\n`)
    process.exit(1)
  }
  if (warnings.length > 0) {
    process.stdout.write('\nSolana keeper smoke: PASS with keeper_jobs failures to triage (see WARN above)\n')
    process.exit(0)
  }
  process.stdout.write('\nSolana keeper smoke: PASS\n')
}

main().catch((err: unknown) => {
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`)
  process.exit(1)
})
