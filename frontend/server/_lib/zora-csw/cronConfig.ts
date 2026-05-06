// SPDX-License-Identifier: MIT
//
// Shared env helpers for the Zora CSW indexer crons. Centralizes the
// feature-flag gate and the per-tick budget knobs so the two handlers
// (scan + enrich) share the same parsing rules.

declare const process: { env: Record<string, string | undefined> }

export const ZORA_CSW_INDEXER_STATE_TABLE = 'zora_csw_indexer_state'
export const ZORA_CSW_OWNERS_TABLE = 'zora_csw_owners'
export const LAST_SCANNED_BLOCK_KEY = 'last_scanned_block'

/**
 * Master kill-switch for both crons. Default: disabled.
 * Set `ZORA_CSW_INDEXER_ENABLED=1` in Vercel to flip on.
 */
export function isZoraCswIndexerEnabled(): boolean {
  return String(process.env.ZORA_CSW_INDEXER_ENABLED ?? '').trim() === '1'
}

export function readEnrichBudget(): number {
  const raw = String(process.env.INDEXER_ENRICH_BUDGET ?? '').trim()
  if (!raw) return 3000
  const n = Number(raw)
  if (!Number.isFinite(n) || n <= 0) return 3000
  return Math.floor(n)
}

export function readRpcConcurrency(): number {
  const raw = String(process.env.INDEXER_RPC_CONCURRENCY ?? '').trim()
  if (!raw) return 12
  const n = Number(raw)
  if (!Number.isFinite(n) || n <= 0) return 12
  return Math.floor(n)
}

export function readEthosEnrichBudget(): number {
  const raw = String(process.env.INDEXER_ETHOS_ENRICH_BUDGET ?? '').trim()
  if (!raw) return 250
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 0) return 250
  return Math.floor(n)
}
