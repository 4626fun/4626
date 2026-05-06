// SPDX-License-Identifier: MIT
//
// Zora CSW enrich cron — `GET /api/v1/zora-csw/enrich-cron`.
//
// Scheduled every 30 minutes by `frontend/vercel.json:crons`. Each tick:
//   1. Selects up to INDEXER_ENRICH_BUDGET (default 3000) candidate
//      rows: `current_owners IS NULL` first (oldest unsynced backlog),
//      filling the budget with rows where `last_owner_sync_at < now()
//      - 7d` so refreshes don't starve.
//   2. Calls enrichCswOwners(client, csw) for each, with a fixed
//      INDEXER_RPC_CONCURRENCY (default 12) parallelism.
//   3. Upserts the {current_owners, last_owner_sync_at, metadata}
//      tuple per CSW. Failures are reported per-row and counted, but
//      the tick still returns 200 so downstream observability sees a
//      consistent envelope.
//
// AUTH — Vercel cron-secret bearer (`isAuthorizedCron`).
// FEATURE FLAG — `ZORA_CSW_INDEXER_ENABLED=1` (shared with the scan cron).

import type { VercelRequest, VercelResponse } from '@vercel/node'

import { isAuthorizedCron } from '../../../../server/_lib/lottery/cronAuth.js'
import {
  getSupabaseAdmin,
  isSupabaseAdminConfigured,
} from '../../../../server/_lib/db/supabaseAdmin.js'
import {
  isZoraCswIndexerEnabled,
  readEnrichBudget,
  readRpcConcurrency,
  ZORA_CSW_OWNERS_TABLE,
} from '../../../../server/_lib/zora-csw/cronConfig.js'
import { enrichCswOwners } from '../../../../server/_lib/zora-csw/enrichOwners.js'
import type { Address, PublicClient } from 'viem'

declare const process: { env: Record<string, string | undefined> }

type SupabaseLike = ReturnType<typeof getSupabaseAdmin>

export type EnrichCandidate = {
  csw_address: string
  creation_block: number | null
}

export type EnrichOutcome = {
  csw: string
  ok: boolean
  current_owners?: string[]
  passkey_owner_count?: number
  next_owner_index?: string | null
  removed_owners_count?: string | null
  error?: string
}

/**
 * Test seam — inject collaborators so handler tests can drive the cron
 * without RPC or Supabase.
 */
export interface ZoraCswEnrichCronHandlerHooks {
  db?: SupabaseLike
  /** Returns a viem-compatible public client for the multicall. */
  getClient?: () => Promise<PublicClient>
  /** Override the per-row enricher (lets tests inject success/failure mix). */
  enrichOne?: (csw: Address) => Promise<{
    addressOwners: Address[]
    passkeyOwnerCount: number
    nextOwnerIndex: bigint | null
    removedOwnersCount: bigint | null
  }>
  /** Override the candidate selector (lets tests force a specific batch). */
  selectCandidates?: (
    db: SupabaseLike,
    budget: number,
  ) => Promise<EnrichCandidate[]>
  budget?: number
  concurrency?: number
}

let __testHooks: ZoraCswEnrichCronHandlerHooks = {}

export function __setZoraCswEnrichCronHandlerHooksForTest(
  hooks: ZoraCswEnrichCronHandlerHooks,
): void {
  __testHooks = { ...hooks }
}

export function __resetZoraCswEnrichCronHandlerHooksForTest(): void {
  __testHooks = {}
}

const STALE_INTERVAL_DAYS = 7

async function selectCandidatesDefault(
  db: SupabaseLike,
  budget: number,
): Promise<EnrichCandidate[]> {
  // 1) Oldest unsynced first. They drain the long tail of CSWs created
  // before the cron started (~89% of the table at this writing).
  const { data: unsynced, error: e1 } = await db
    .from(ZORA_CSW_OWNERS_TABLE)
    .select('csw_address, creation_block')
    .is('current_owners', null)
    .order('creation_block', { ascending: true })
    .limit(budget)
  if (e1) throw new Error(`select_unsynced: ${e1.message}`)
  const out: EnrichCandidate[] = (unsynced ?? []) as EnrichCandidate[]

  if (out.length >= budget) return out

  // 2) Fill remaining budget with stale (>7 day) refreshes. We never
  // re-enrich faster than that — the on-chain owner set turns over
  // slowly and re-reading every CSW on every cron would burn RPC
  // quota for almost no signal.
  const remaining = budget - out.length
  const cutoff = new Date(Date.now() - STALE_INTERVAL_DAYS * 86_400_000).toISOString()
  const { data: stale, error: e2 } = await db
    .from(ZORA_CSW_OWNERS_TABLE)
    .select('csw_address, creation_block')
    .not('current_owners', 'is', null)
    .lt('last_owner_sync_at', cutoff)
    .order('last_owner_sync_at', { ascending: true })
    .limit(remaining)
  if (e2) throw new Error(`select_stale: ${e2.message}`)
  out.push(...((stale ?? []) as EnrichCandidate[]))
  return out
}

async function defaultGetClient(): Promise<PublicClient> {
  const rpcUrl = String(process.env.BASE_RPC_URL ?? '').trim()
  if (!rpcUrl) throw new Error('BASE_RPC_URL not set')
  const { createPublicClient, http } = await import('viem')
  const { base } = await import('viem/chains')
  return createPublicClient({ chain: base, transport: http(rpcUrl) }) as PublicClient
}

async function upsertEnriched(
  db: SupabaseLike,
  outcomes: EnrichOutcome[],
): Promise<{ updated: number; errors: string[] }> {
  const ok = outcomes.filter((o) => o.ok)
  if (ok.length === 0) return { updated: 0, errors: [] }
  const now = new Date().toISOString()
  const rows = ok.map((o) => ({
    csw_address: o.csw,
    current_owners: o.current_owners ?? [],
    last_owner_sync_at: now,
    metadata: {
      next_owner_index: o.next_owner_index ?? null,
      removed_owners_count: o.removed_owners_count ?? null,
      passkey_owner_count: o.passkey_owner_count ?? 0,
    },
  }))
  const { error } = await db
    .from(ZORA_CSW_OWNERS_TABLE)
    .upsert(rows, { onConflict: 'csw_address' })
  if (error) {
    return { updated: 0, errors: [`upsert_failed: ${error.message}`] }
  }
  return { updated: rows.length, errors: [] }
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed' })
    return
  }

  if (!isZoraCswIndexerEnabled()) {
    res.status(503).json({ ok: false, error: 'feature_disabled' })
    return
  }

  if (!isAuthorizedCron(req)) {
    res.status(401).json({ ok: false, error: 'unauthorized' })
    return
  }

  if (!__testHooks.db && !isSupabaseAdminConfigured()) {
    res.status(503).json({ ok: false, error: 'supabase_not_configured' })
    return
  }
  if (!__testHooks.enrichOne && !__testHooks.getClient && !String(process.env.BASE_RPC_URL ?? '').trim()) {
    res.status(503).json({ ok: false, error: 'base_rpc_url_not_configured' })
    return
  }

  const db = __testHooks.db ?? getSupabaseAdmin()
  const budget = __testHooks.budget ?? readEnrichBudget()
  const concurrency = __testHooks.concurrency ?? readRpcConcurrency()
  const selectCandidates = __testHooks.selectCandidates ?? selectCandidatesDefault

  let candidates: EnrichCandidate[]
  try {
    candidates = await selectCandidates(db, budget)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown_error'
    console.warn('[zora-csw-enrich-cron] select failed', { error: message })
    res.status(200).json({
      ok: false,
      tick: 'errored',
      processed: 0,
      succeeded: 0,
      failed: 0,
      error: message.slice(0, 500),
    })
    return
  }

  if (candidates.length === 0) {
    res.status(200).json({
      ok: true,
      tick: 'idle',
      processed: 0,
      succeeded: 0,
      failed: 0,
      budget,
    })
    return
  }

  const enrichOne =
    __testHooks.enrichOne ??
    (async (csw: Address) => {
      const client = __testHooks.getClient
        ? await __testHooks.getClient()
        : await defaultGetClient()
      return enrichCswOwners(client, csw)
    })

  const outcomes: EnrichOutcome[] = []
  let succeeded = 0
  let failed = 0

  // Bounded-concurrency worker pool. Each worker pulls from the shared
  // queue index until exhausted; we await all workers at the end. This
  // is the simplest correct shape and matches the spirit of
  // indexer/src/runEnrich.ts without the inflight-set bookkeeping.
  let nextIndex = 0
  async function worker(): Promise<void> {
    while (true) {
      const i = nextIndex
      nextIndex += 1
      if (i >= candidates.length) return
      const csw = candidates[i]?.csw_address
      if (!csw) return
      try {
        const enriched = await enrichOne(csw as Address)
        outcomes.push({
          csw,
          ok: true,
          current_owners: enriched.addressOwners,
          passkey_owner_count: enriched.passkeyOwnerCount,
          next_owner_index: enriched.nextOwnerIndex?.toString() ?? null,
          removed_owners_count: enriched.removedOwnersCount?.toString() ?? null,
        })
        succeeded += 1
      } catch (err) {
        const message = err instanceof Error ? err.message : 'unknown_error'
        outcomes.push({ csw, ok: false, error: message.slice(0, 200) })
        failed += 1
      }
    }
  }

  const workerCount = Math.min(concurrency, candidates.length)
  const workers: Promise<void>[] = []
  for (let i = 0; i < workerCount; i++) workers.push(worker())
  await Promise.all(workers)

  let updated = 0
  const upsertErrors: string[] = []
  try {
    const r = await upsertEnriched(db, outcomes)
    updated = r.updated
    upsertErrors.push(...r.errors)
  } catch (err) {
    upsertErrors.push(err instanceof Error ? err.message : 'unknown_error')
  }

  if (candidates.length > 0 || failed > 0) {
    console.info('[zora-csw-enrich-cron] tick', {
      processed: candidates.length,
      succeeded,
      failed,
      updated,
      upsertErrorCount: upsertErrors.length,
    })
  }

  res.status(200).json({
    ok: failed === 0 && upsertErrors.length === 0,
    tick: candidates.length === 0 ? 'idle' : 'enriched',
    processed: candidates.length,
    succeeded,
    failed,
    updated,
    budget,
    concurrency,
    ...(upsertErrors.length > 0 && { error: upsertErrors.join('; ').slice(0, 500) }),
  })
}
