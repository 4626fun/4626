/**
 * Database access helpers for `creator_strategy_features`.
 *
 * Keep this module tightly scoped to CRUD on the table. Payment
 * verification lives in `./usdcPayment.ts`; catalog metadata lives in
 * `./catalog.ts`. The HTTP handlers compose these three.
 */

import type { Address, Hex } from 'viem'
import { getAddress } from 'viem'

type Db = {
  sql: (strings: TemplateStringsArray, ...values: any[]) => Promise<{ rows: any[] }>
}

export type CreatorStrategyFeatureStatus = 'pending' | 'active' | 'failed' | 'refunded'

export type CreatorStrategyFeatureRow = {
  id: number
  creatorToken: Address
  featureKey: string
  status: CreatorStrategyFeatureStatus
  priceUsdcPaid: bigint
  paymentTxHash: Hex | null
  paymentFrom: Address | null
  paymentTo: Address | null
  paymentVerifiedAt: string | null
  provisionedAt: string | null
  failedAt: string | null
  refundedAt: string | null
  provisionerRef: string | null
  failureReason: string | null
  metadata: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

function normalizeHash(value: unknown): Hex | null {
  if (typeof value !== 'string') return null
  const v = value.trim().toLowerCase()
  return /^0x[0-9a-f]{64}$/.test(v) ? (v as Hex) : null
}

function normalizeAddress(value: unknown): Address | null {
  if (typeof value !== 'string') return null
  const v = value.trim()
  if (!/^0x[0-9a-fA-F]{40}$/.test(v)) return null
  try {
    return getAddress(v as Address)
  } catch {
    return null
  }
}

function rowToModel(row: any): CreatorStrategyFeatureRow {
  const creatorToken = normalizeAddress(row.creator_token)
  if (!creatorToken) throw new Error('creator_strategy_features row has invalid creator_token')
  return {
    id: Number(row.id),
    creatorToken,
    featureKey: String(row.feature_key),
    status: row.status as CreatorStrategyFeatureStatus,
    priceUsdcPaid: BigInt(row.price_usdc_paid ?? 0),
    paymentTxHash: normalizeHash(row.payment_tx_hash),
    paymentFrom: normalizeAddress(row.payment_from),
    paymentTo: normalizeAddress(row.payment_to),
    paymentVerifiedAt: row.payment_verified_at ?? null,
    provisionedAt: row.provisioned_at ?? null,
    failedAt: row.failed_at ?? null,
    refundedAt: row.refunded_at ?? null,
    provisionerRef: row.provisioner_ref ?? null,
    failureReason: row.failure_reason ?? null,
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }
}

export async function listActivationsForCreator(
  db: Db,
  creatorToken: Address,
): Promise<CreatorStrategyFeatureRow[]> {
  const key = creatorToken.toLowerCase()
  const result = await db.sql`
    SELECT id, creator_token, feature_key, status, price_usdc_paid,
           payment_tx_hash, payment_from, payment_to, payment_verified_at,
           provisioned_at, failed_at, refunded_at,
           provisioner_ref, failure_reason, metadata, created_at, updated_at
    FROM creator_strategy_features
    WHERE creator_token = ${key}
    ORDER BY created_at DESC;
  `
  return (result.rows ?? []).map(rowToModel)
}

/**
 * True when the creator has a live, PAID entitlement row for the feature.
 *
 * FIX: M-02 / 4626-408 — previously this function treated any row whose status
 * was `pending` or `active` as entitled. A `pending` row is inserted the moment
 * a Stripe checkout session (or x402 attempt) is created — BEFORE the payment
 * has cleared and `payment_verified_at` has been set by the webhook. That
 * window (typically several seconds, but unbounded if the user abandons the
 * flow) granted feature access for free.
 *
 * We now additionally require `payment_verified_at IS NOT NULL` so only rows
 * whose payment has been verified server-side (stripe webhook or x402 settle)
 * count as entitled. `active` rows written by the webhook always set
 * `payment_verified_at` (see upsertActivationFromStripeWebhook below), so this
 * tightens the gate without changing the happy path.
 */
export async function hasLiveActivationForFeature(
  db: Db,
  params: { creatorToken: Address; featureKey: string },
): Promise<boolean> {
  const creatorKey = params.creatorToken.toLowerCase()
  const featureKey = String(params.featureKey ?? '').trim()
  if (!featureKey) return false
  const result = await db.sql`
    SELECT 1
    FROM creator_strategy_features
    WHERE creator_token = ${creatorKey}
      AND feature_key = ${featureKey}
      AND status IN ('pending', 'active')
      AND payment_verified_at IS NOT NULL
    LIMIT 1;
  `
  return Array.isArray(result.rows) && result.rows.length > 0
}

export type InsertActivationInput = {
  creatorToken: Address
  featureKey: string
  priceUsdcPaid: bigint
  paymentTxHash: Hex
  paymentFrom: Address
  paymentTo: Address
  paymentVerifiedAt: Date
  status: Extract<CreatorStrategyFeatureStatus, 'pending'>
  metadata?: Record<string, unknown>
}

export type InsertActivationResult =
  | { ok: true; row: CreatorStrategyFeatureRow }
  | {
      ok: false
      reason:
        | 'live_activation_exists'
        | 'payment_already_used'
        | 'db_error'
      message: string
    }

export type InsertStripeCheckoutRowInput = {
  creatorToken: Address
  featureKey: string
  priceUsdcExpected: bigint
  walletAddress: Address
  stripeCheckoutSessionId: string
  metadata?: Record<string, unknown>
}

export type InsertStripeCheckoutRowResult =
  | { ok: true; row: CreatorStrategyFeatureRow }
  | {
      ok: false
      reason: 'live_activation_exists' | 'db_error'
      message: string
    }

export type FinalizeStripeCheckoutInput = {
  stripeCheckoutSessionId: string
  priceUsdcPaid: bigint
  walletAddress: Address
  stripePaymentIntentId: string | null
  stripeChargeId: string | null
  paymentVerifiedAt: Date
}

export type FinalizeStripeCheckoutResult =
  | { ok: true; row: CreatorStrategyFeatureRow }
  | {
      ok: false
      reason: 'session_not_found' | 'db_error'
      message: string
    }

function isUniqueViolation(error: unknown, constraint: string): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '')
  return (
    /duplicate key value/i.test(message) &&
    (message.includes(constraint) ||
      /creator_strategy_features_/i.test(message))
  )
}

/**
 * Insert a `pending` row for a Stripe Checkout Session BEFORE the user
 * has paid. The row is created so that when the Stripe webhook fires
 * after successful payment, we can idempotently find-and-update it by
 * `stripe_checkout_session_id` instead of racing to insert. Fails
 * cleanly with `live_activation_exists` if the creator already has a
 * live row for this feature — we never want to create a second
 * checkout session for a feature the creator has already activated or
 * has in-flight.
 *
 * The row's `price_usdc_paid` stays at the EXPECTED price until the
 * webhook fires; the webhook then updates it to the actual Stripe
 * charge amount (converted from USD cents back into USDC base units).
 */
export async function insertStripeCheckoutActivation(
  db: Db,
  input: InsertStripeCheckoutRowInput,
): Promise<InsertStripeCheckoutRowResult> {
  const creatorTokenLower = input.creatorToken.toLowerCase()
  const walletLower = input.walletAddress.toLowerCase()
  const metadataJson = JSON.stringify(input.metadata ?? {})
  const priceStr = input.priceUsdcExpected.toString()
  try {
    const result = await db.sql`
      INSERT INTO creator_strategy_features (
        creator_token, feature_key, status, price_usdc_paid,
        payment_source, payment_from,
        stripe_checkout_session_id,
        metadata, created_at, updated_at
      ) VALUES (
        ${creatorTokenLower}, ${input.featureKey}, 'pending', ${priceStr},
        'stripe', ${walletLower},
        ${input.stripeCheckoutSessionId},
        ${metadataJson}::jsonb, NOW(), NOW()
      )
      RETURNING id, creator_token, feature_key, status, price_usdc_paid,
                payment_tx_hash, payment_from, payment_to, payment_verified_at,
                provisioned_at, failed_at, refunded_at,
                provisioner_ref, failure_reason, metadata, created_at, updated_at;
    `
    const row = result.rows?.[0]
    if (!row) return { ok: false, reason: 'db_error', message: 'INSERT returned no row' }
    return { ok: true, row: rowToModel(row) }
  } catch (error) {
    if (isUniqueViolation(error, 'creator_strategy_features_one_live_per_feature')) {
      return {
        ok: false,
        reason: 'live_activation_exists',
        message: 'A pending or active activation already exists for this creator and feature',
      }
    }
    return {
      ok: false,
      reason: 'db_error',
      message: error instanceof Error ? error.message : String(error),
    }
  }
}

/**
 * Webhook handler — fills in Stripe payment metadata + the actual
 * amount paid after `checkout.session.completed`. Idempotent: running
 * it twice for the same session leaves the row in the same state.
 */
export async function finalizeStripeCheckoutActivation(
  db: Db,
  input: FinalizeStripeCheckoutInput,
): Promise<FinalizeStripeCheckoutResult> {
  const walletLower = input.walletAddress.toLowerCase()
  const priceStr = input.priceUsdcPaid.toString()
  const verifiedIso = input.paymentVerifiedAt.toISOString()
  try {
    const result = await db.sql`
      UPDATE creator_strategy_features
      SET price_usdc_paid = ${priceStr},
          payment_from = COALESCE(payment_from, ${walletLower}),
          payment_verified_at = ${verifiedIso},
          stripe_payment_intent_id = ${input.stripePaymentIntentId},
          stripe_charge_id = ${input.stripeChargeId},
          updated_at = NOW()
      WHERE stripe_checkout_session_id = ${input.stripeCheckoutSessionId}
      RETURNING id, creator_token, feature_key, status, price_usdc_paid,
                payment_tx_hash, payment_from, payment_to, payment_verified_at,
                provisioned_at, failed_at, refunded_at,
                provisioner_ref, failure_reason, metadata, created_at, updated_at;
    `
    const row = result.rows?.[0]
    if (!row) {
      return {
        ok: false,
        reason: 'session_not_found',
        message: `No creator_strategy_features row for stripe_checkout_session_id=${input.stripeCheckoutSessionId}`,
      }
    }
    return { ok: true, row: rowToModel(row) }
  } catch (error) {
    return {
      ok: false,
      reason: 'db_error',
      message: error instanceof Error ? error.message : String(error),
    }
  }
}

/**
 * Insert a new `pending` activation row. Unique constraints on
 * (creator_token, feature_key) and payment_tx_hash are enforced at the
 * DB level; this helper translates those into specific error reasons
 * for the API handler.
 */
export async function insertPendingActivation(
  db: Db,
  input: InsertActivationInput,
): Promise<InsertActivationResult> {
  const creatorTokenLower = input.creatorToken.toLowerCase()
  const txHashLower = input.paymentTxHash.toLowerCase()
  const paymentFromLower = input.paymentFrom.toLowerCase()
  const paymentToLower = input.paymentTo.toLowerCase()
  const metadataJson = JSON.stringify(input.metadata ?? {})
  const priceStr = input.priceUsdcPaid.toString()
  const verifiedIso = input.paymentVerifiedAt.toISOString()
  try {
    const result = await db.sql`
      INSERT INTO creator_strategy_features (
        creator_token, feature_key, status, price_usdc_paid,
        payment_tx_hash, payment_from, payment_to, payment_verified_at,
        metadata, created_at, updated_at
      ) VALUES (
        ${creatorTokenLower}, ${input.featureKey}, 'pending', ${priceStr},
        ${txHashLower}, ${paymentFromLower}, ${paymentToLower}, ${verifiedIso},
        ${metadataJson}::jsonb, NOW(), NOW()
      )
      RETURNING id, creator_token, feature_key, status, price_usdc_paid,
                payment_tx_hash, payment_from, payment_to, payment_verified_at,
                provisioned_at, failed_at, refunded_at,
                provisioner_ref, failure_reason, metadata, created_at, updated_at;
    `
    const row = result.rows?.[0]
    if (!row) {
      return { ok: false, reason: 'db_error', message: 'INSERT returned no row' }
    }
    return { ok: true, row: rowToModel(row) }
  } catch (error) {
    if (isUniqueViolation(error, 'creator_strategy_features_one_live_per_feature')) {
      return {
        ok: false,
        reason: 'live_activation_exists',
        message: 'A pending or active activation already exists for this creator and feature',
      }
    }
    if (isUniqueViolation(error, 'creator_strategy_features_unique_payment_tx')) {
      return {
        ok: false,
        reason: 'payment_already_used',
        message: 'This payment tx hash has already been used for an activation',
      }
    }
    return {
      ok: false,
      reason: 'db_error',
      message: error instanceof Error ? error.message : String(error),
    }
  }
}

/**
 * Public-safe DTO for the API `/api/creator/strategy/activations` endpoint.
 * Hides internal IDs and keeps bigints as strings.
 */
export type CreatorStrategyFeatureDto = {
  creatorToken: Address
  featureKey: string
  status: CreatorStrategyFeatureStatus
  priceUsdcPaid: string
  paymentTxHash: Hex | null
  paymentVerifiedAt: string | null
  provisionedAt: string | null
  failedAt: string | null
  refundedAt: string | null
  failureReason: string | null
  provisionerRef: string | null
  createdAt: string
  updatedAt: string
}

export function toCreatorStrategyFeatureDto(
  row: CreatorStrategyFeatureRow,
): CreatorStrategyFeatureDto {
  return {
    creatorToken: row.creatorToken,
    featureKey: row.featureKey,
    status: row.status,
    priceUsdcPaid: row.priceUsdcPaid.toString(),
    paymentTxHash: row.paymentTxHash,
    paymentVerifiedAt: row.paymentVerifiedAt,
    provisionedAt: row.provisionedAt,
    failedAt: row.failedAt,
    refundedAt: row.refundedAt,
    failureReason: row.failureReason,
    provisionerRef: row.provisionerRef,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}
