/**
 * Solana buyer pubkey → Base lottery beneficiary (parent CSW).
 *
 * Never treats a Solana wallet as an EVM address. Missing, ambiguous, or
 * cross-account conflicts fail closed (quarantine). Personal veLottery
 * coverage is never inferred here — callers must force coverage = 0.
 */

import { ensureSolanaLotteryEntryInboxSchema } from '../db/schemaBootstrap.js'

type Db = { sql: (strings: TemplateStringsArray, ...values: any[]) => Promise<{ rows: any[] }> }

export type SolanaLotteryIdentityResolution =
  | {
      ok: true
      buyerSolana: string
      profileId: string
      beneficiaryCsw: `0x${string}`
      identityKind: 'parent_csw'
    }
  | {
      ok: false
      buyerSolana: string
      reason: 'missing_mapping' | 'ambiguous_mapping' | 'missing_csw' | 'invalid_solana_pubkey'
    }

function isSolanaAddress(value: string): boolean {
  if (value.length < 32 || value.length > 44) return false
  return /^[1-9A-HJ-NP-Za-km-z]+$/.test(value)
}

function normalizeSolanaPubkey(value: unknown): string | null {
  const s = typeof value === 'string' ? value.trim() : ''
  if (!isSolanaAddress(s)) return null
  return s
}

function normalizeCsw(value: unknown): `0x${string}` | null {
  const s = typeof value === 'string' ? value.trim().toLowerCase() : ''
  if (!/^0x[a-f0-9]{40}$/.test(s)) return null
  return s as `0x${string}`
}

/**
 * Resolve the unique parent CSW for a Solana buyer via
 * `profile_wallets.is_canonical_solana_wallet`.
 */
export async function resolveSolanaLotteryBeneficiary(params: {
  db: Db
  buyerSolana: string
}): Promise<SolanaLotteryIdentityResolution> {
  await ensureSolanaLotteryEntryInboxSchema(params.db)
  const buyerSolana = normalizeSolanaPubkey(params.buyerSolana)
  if (!buyerSolana) {
    return { ok: false, buyerSolana: String(params.buyerSolana ?? ''), reason: 'invalid_solana_pubkey' }
  }

  const result = await params.db.sql`
    SELECT
      pw.profile_id,
      LOWER(COALESCE(p.csw_address, '')) AS csw_address
    FROM profile_wallets pw
    INNER JOIN profiles p ON p.id = pw.profile_id
    WHERE pw.is_canonical_solana_wallet = true
      AND LOWER(COALESCE(pw.chain, '')) = 'solana'
      AND pw.address = ${buyerSolana}
      AND (p.merged_into_profile_id IS NULL)
    LIMIT 3
  `

  const rows = Array.isArray(result?.rows) ? result.rows : []
  if (rows.length === 0) {
    return { ok: false, buyerSolana, reason: 'missing_mapping' }
  }
  if (rows.length > 1) {
    return { ok: false, buyerSolana, reason: 'ambiguous_mapping' }
  }

  const profileId = String(rows[0]?.profile_id ?? '').trim()
  const beneficiaryCsw = normalizeCsw(rows[0]?.csw_address)
  if (!profileId || !beneficiaryCsw) {
    return { ok: false, buyerSolana, reason: 'missing_csw' }
  }

  return {
    ok: true,
    buyerSolana,
    profileId,
    beneficiaryCsw,
    identityKind: 'parent_csw',
  }
}

/** Solana lottery entries are base-odds-only until boost attribution is proven. */
export const SOLANA_LOTTERY_FORCED_COVERAGE_BALANCE = 0n
