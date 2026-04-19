/**
 * Admin-granted price overrides for creator strategy features.
 *
 * Operators insert rows into `creator_strategy_price_overrides` to give
 * a specific creator (matched by creator_token) or a specific buyer
 * (matched by wallet_address) a discounted / comped / free activation
 * of a feature. The activate handler consults this table before
 * enforcing the catalog price.
 *
 * Lookup order (most-specific wins):
 *   1. (creator_token, feature_key) — per-vault override
 *   2. (wallet_address, feature_key) — per-buyer override
 *   3. Fall back to catalog `priceUsdc`
 *
 * Never applies a price HIGHER than the catalog — the handler takes
 * `min(override, catalog)` defensively so a broken operator row can't
 * silently raise prices on users.
 *
 * Overrides are single-use unless stacked: once the creator has an
 * `active` / `pending` row in `creator_strategy_features`, the
 * unique-per-creator-per-feature index prevents buying the same
 * feature twice anyway.
 */

import type { Address } from 'viem'
import { getAddress } from 'viem'

type Db = {
  sql: (strings: TemplateStringsArray, ...values: any[]) => Promise<{ rows: any[] }>
}

export type PriceOverrideRow = {
  id: number
  creatorToken: Address | null
  walletAddress: Address | null
  featureKey: string
  priceUsdcOverride: bigint
  reason: string
  grantedBy: string | null
  expiresAt: string | null
  revokedAt: string | null
  createdAt: string
}

function rowToModel(row: any): PriceOverrideRow {
  return {
    id: Number(row.id),
    creatorToken: row.creator_token ? (getAddress(row.creator_token) as Address) : null,
    walletAddress: row.wallet_address ? (getAddress(row.wallet_address) as Address) : null,
    featureKey: String(row.feature_key),
    priceUsdcOverride: BigInt(row.price_usdc_override ?? 0),
    reason: String(row.reason),
    grantedBy: row.granted_by ?? null,
    expiresAt: row.expires_at ?? null,
    revokedAt: row.revoked_at ?? null,
    createdAt: String(row.created_at),
  }
}

/**
 * Look up the most-specific active override for a given
 * (creator, wallet, feature) triple. Returns `null` if no override
 * applies — the caller must then fall back to catalog price.
 */
export async function findActivePriceOverride(
  db: Db,
  params: {
    creatorToken: Address
    walletAddress: Address
    featureKey: string
  },
): Promise<PriceOverrideRow | null> {
  const creatorLower = params.creatorToken.toLowerCase()
  const walletLower = params.walletAddress.toLowerCase()
  const { featureKey } = params

  // Step 1 — per-creator override wins if present.
  const byCreator = await db.sql`
    SELECT id, creator_token, wallet_address, feature_key,
           price_usdc_override, reason, granted_by,
           expires_at, revoked_at, created_at
    FROM creator_strategy_price_overrides
    WHERE creator_token = ${creatorLower}
      AND feature_key = ${featureKey}
      AND revoked_at IS NULL
      AND (expires_at IS NULL OR expires_at > NOW())
    ORDER BY created_at DESC
    LIMIT 1
  `
  if (byCreator.rows?.[0]) return rowToModel(byCreator.rows[0])

  // Step 2 — per-buyer wallet override.
  const byWallet = await db.sql`
    SELECT id, creator_token, wallet_address, feature_key,
           price_usdc_override, reason, granted_by,
           expires_at, revoked_at, created_at
    FROM creator_strategy_price_overrides
    WHERE wallet_address = ${walletLower}
      AND feature_key = ${featureKey}
      AND revoked_at IS NULL
      AND (expires_at IS NULL OR expires_at > NOW())
    ORDER BY created_at DESC
    LIMIT 1
  `
  if (byWallet.rows?.[0]) return rowToModel(byWallet.rows[0])

  return null
}

/**
 * Resolve the effective price the creator must pay, clamped to
 * `min(override, catalog)` so a malformed override row can never raise
 * the price above what the catalog advertises.
 */
export function applyPriceOverride(
  catalogPriceUsdc: bigint,
  override: PriceOverrideRow | null,
): { effectivePriceUsdc: bigint; appliedOverrideId: number | null; discountBps: number | null } {
  if (!override) {
    return { effectivePriceUsdc: catalogPriceUsdc, appliedOverrideId: null, discountBps: null }
  }
  const effective = override.priceUsdcOverride < catalogPriceUsdc ? override.priceUsdcOverride : catalogPriceUsdc
  const discountBps =
    catalogPriceUsdc > 0n
      ? Number(((catalogPriceUsdc - effective) * 10_000n) / catalogPriceUsdc)
      : null
  return {
    effectivePriceUsdc: effective,
    appliedOverrideId: override.id,
    discountBps,
  }
}
