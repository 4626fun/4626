/**
 * Architecture B / waitlist Base App connect — server half of Track C.
 *
 * POST /api/arch-b/sub-account/baseapp/register
 *
 * Called by the waitlist `connect-base-app` step and account-setup Step 2
 * after the browser SDK has run `wallet_addSubAccount` and
 * `setToOwnerAccount()`. Persists the (parent CSW, sub-account, embedded
 * EOA) triple so future requests resolve the right execution context.
 *
 * Difference vs `_subAccountProvisionCommit.ts`:
 *  - That endpoint is SIWE-gated and ingests a signed EIP-712
 *    SpendPermission produced by an on-chain owner of the parent CSW.
 *    It is the agent-command path; spend permission is required.
 *  - This endpoint is Privy-session-gated. The user's authority to bind
 *    the parent CSW comes from the Base App SDK confirmation that
 *    happened in their browser; we never see a signature here. v1 leaves
 *    the spend_permission_* columns NULL and tags the row with
 *    `provisioning_source = 'baseapp_waitlist'` so downstream code knows
 *    the spend-permission preflight does not apply.
 *
 * Invariants (per docs/ACCOUNT_MODEL.md and
 * frontend/docs/account-auth-invariants.md):
 *  - Parent CSW remains canonical: this handler upserts the parent CSW
 *    into `profile_wallets` with `is_canonical_smart_wallet = true` and
 *    clears that flag from any prior canonical row. The sub-account
 *    address is the execution lane only — it lives on
 *    `command_issuer_execution_context.sub_account_address`, never on
 *    `profile_wallets.is_canonical_smart_wallet`.
 *  - The Privy embedded EOA is the sub-account signer (recorded in
 *    `command_issuer_execution_context.owner_eoa_address`). It is NOT
 *    installed as a direct owner on the parent CSW on this track; it
 *    is the sub-account's signer via `setToOwnerAccount()`.
 *  - One parent CSW per profile. If the profile already has a row in
 *    `command_issuer_execution_context` with a non-null
 *    `parent_csw_address` that differs from the submitted parent, we
 *    return 409 `parent_csw_conflict` rather than silently switching
 *    canonical wallets.
 *
 * Feature-flagged. Default off — handler returns 503 `feature_disabled`
 * until `WAITLIST_SUBACCOUNT_FLOW_ENABLED=1` is set in the environment.
 *
 * Responses:
 *   200 { success: true, data: { profileId, parentAddress, subAccountAddress, embeddedEoaAddress, ownerIndex, provisioningSource } }
 *   400 invalid_body | invalid_address | embedded_eoa_mismatch | sub_account_not_distinct
 *   401 unauthenticated
 *   409 parent_csw_conflict | profile_not_ready
 *   429 too_many_requests
 *   503 db_unavailable | feature_disabled
 *   500 unexpected_error
 */

import type { Address } from 'viem'
import type { VercelRequest, VercelResponse } from '@vercel/node'

import { isWaitlistSubaccountFlowEnabled } from '../../../server/_lib/wallet/waitlistSubaccountFlowEnv.js'
import {
  type ApiEnvelope,
  handleOptions,
  setCors,
  setNoStore,
  getClientIp,
  RATE_LIMITS,
  checkRateLimit,
  rateLimitKey,
  readBoundedJsonObjectBody,
  getDb,
  isDbConfigured,
  runInTransaction,
  resolveAuthorizedRequestPrincipal,
  logger,
} from '../../../packages/server-core/src/index.js'
import { getBasePublicClient } from '../../../server/_lib/wallet/subAccountProvisionVerify.js'
import { envBigInt } from '@4626/server-core'

declare const process: { env: Record<string, string | undefined> }

const REGISTER_BODY_MAX_BYTES = 4_096
const PROVISIONING_SOURCE = 'baseapp_waitlist' as const
const ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/

// Default per-tx / daily caps for freshly registered waitlist rows.
// Values mirror the arch-b _enroll.ts defaults so ops can tune both flows
// with the same env vars. The caps are written to the row to satisfy the
// ck_command_issuer_caps_positive CHECK constraint in migration 027
// (per_tx_cap_wei > 0 AND daily_cap_wei > 0) — they have no runtime effect
// for baseapp_waitlist rows in v1 because the submitter short-circuits
// when spend_permission_* columns are NULL. They become load-bearing only
// if / when we add a Spend Permission to this flow in a later PR.
const DEFAULT_PER_TX_CAP_WEI = 10_000_000_000_000_000n // 0.01 ETH
const DEFAULT_DAILY_CAP_WEI = 50_000_000_000_000_000n // 0.05 ETH

/**
 * Test seam — handler-side hooks to skip slow side-effects in unit
 * tests (the Base RPC sanity read in particular). Mirrors the
 * `__setHandlerHooksForTest` pattern used by the AMOE crons.
 */
export interface ZoraSubAccountBaseAppRegisterHandlerHooks {
  /**
   * Override the optional sanity read of `subAccountAddress.code` /
   * `ownerAtIndex(0)` from Base RPC. The default uses
   * `getBasePublicClient()`. Tests inject a no-op so they don't try
   * to talk to a real RPC.
   */
  sanityReadSubAccount?: (args: {
    subAccountAddress: Address
    embeddedEoaAddress: Address
  }) => Promise<void>
}

let __testHooks: ZoraSubAccountBaseAppRegisterHandlerHooks = {}

export function __setHandlerHooksForTest(
  hooks: ZoraSubAccountBaseAppRegisterHandlerHooks,
): void {
  __testHooks = { ...hooks }
}

export function __resetHandlerHooksForTest(): void {
  __testHooks = {}
}

function isFeatureEnabled(): boolean {
  return isWaitlistSubaccountFlowEnabled()
}

function lowerAddress(input: unknown): Address | null {
  if (typeof input !== 'string') return null
  const trimmed = input.trim()
  if (!ADDRESS_REGEX.test(trimmed)) return null
  return trimmed.toLowerCase() as Address
}

function asObjectBody(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {}
  return input as Record<string, unknown>
}

/**
 * Best-effort sanity read of `subAccountAddress`. We call
 * `eth_getCode` against Base RPC; if the address has no code (the
 * common case — sub-accounts deploy lazily on first UserOp) we
 * proceed. If the address has code, we optionally try to read
 * `ownerAtIndex(0)` and warn (don't fail) if it doesn't look like the
 * embedded EOA. Failures are non-fatal: this is observability, not
 * authorization.
 */
async function defaultSanityReadSubAccount(args: {
  subAccountAddress: Address
  embeddedEoaAddress: Address
}): Promise<void> {
  try {
    const client = getBasePublicClient()
    const code = await client.getBytecode({ address: args.subAccountAddress }).catch(() => null)
    if (!code || code === '0x') {
      // Counterfactual deploy — expected. Nothing to verify.
      return
    }
    // Code exists. Try ownerAtIndex(0) with a minimal ABI; on any
    // failure (CSW variant, unknown method, RPC blip), warn-only.
    try {
      const owner0 = (await client.readContract({
        address: args.subAccountAddress,
        abi: [
          {
            type: 'function',
            name: 'ownerAtIndex',
            stateMutability: 'view',
            inputs: [{ name: 'index', type: 'uint256' }],
            outputs: [{ name: '', type: 'bytes' }],
          },
        ] as const,
        functionName: 'ownerAtIndex',
        args: [0n],
      })) as `0x${string}` | null
      if (typeof owner0 === 'string' && owner0.length >= 42) {
        const tail = owner0.slice(-40).toLowerCase()
        if (tail !== args.embeddedEoaAddress.replace(/^0x/, '').toLowerCase()) {
          logger.warn('[arch-b/baseapp/register] subAccount ownerAtIndex(0) does not match embedded EOA', {
            subAccountAddress: args.subAccountAddress,
            embeddedEoaAddress: args.embeddedEoaAddress,
            ownerAtIndex0: owner0,
          })
        }
      }
    } catch (e) {
      logger.warn('[arch-b/baseapp/register] subAccount ownerAtIndex(0) read failed (non-fatal)', {
        subAccountAddress: args.subAccountAddress,
        message: e instanceof Error ? e.message : String(e ?? ''),
      })
    }
  } catch (e) {
    logger.warn('[arch-b/baseapp/register] subAccount sanity read failed (non-fatal)', {
      subAccountAddress: args.subAccountAddress,
      message: e instanceof Error ? e.message : String(e ?? ''),
    })
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res
      .status(405)
      .json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  if (!isFeatureEnabled()) {
    return res
      .status(503)
      .json({ success: false, error: 'feature_disabled' } satisfies ApiEnvelope<never>)
  }

  const principal = await resolveAuthorizedRequestPrincipal(req, { lowercase: true })
  if (!principal) {
    return res
      .status(401)
      .json({ success: false, error: 'unauthenticated' } satisfies ApiEnvelope<never>)
  }
  if (!principal.profileId) {
    return res
      .status(409)
      .json({ success: false, error: 'profile_not_ready' } satisfies ApiEnvelope<never>)
  }

  const rate = checkRateLimit(
    rateLimitKey('arch-b-baseapp-register', principal.address, getClientIp(req)),
    RATE_LIMITS.adminAction,
  )
  if (!rate.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((rate.resetAt - Date.now()) / 1000))))
    return res
      .status(429)
      .json({ success: false, error: 'too_many_requests' } satisfies ApiEnvelope<never>)
  }

  const rawBody = await readBoundedJsonObjectBody(req, { maxBytes: REGISTER_BODY_MAX_BYTES }).catch(
    () => null,
  )
  if (!rawBody) {
    return res
      .status(400)
      .json({ success: false, error: 'invalid_body' } satisfies ApiEnvelope<never>)
  }
  const body = asObjectBody(rawBody)

  const parentAddress = lowerAddress(body.parentAddress)
  const subAccountAddress = lowerAddress(body.subAccountAddress)
  const embeddedEoaAddress = lowerAddress(body.embeddedEoaAddress)
  if (!parentAddress || !subAccountAddress || !embeddedEoaAddress) {
    return res
      .status(400)
      .json({ success: false, error: 'invalid_address' } satisfies ApiEnvelope<never>)
  }
  if (subAccountAddress === parentAddress) {
    return res
      .status(400)
      .json({ success: false, error: 'sub_account_not_distinct' } satisfies ApiEnvelope<never>)
  }

  if (!isDbConfigured()) {
    return res
      .status(503)
      .json({ success: false, error: 'db_unavailable' } satisfies ApiEnvelope<never>)
  }
  const db = await getDb()
  if (!db) {
    return res
      .status(503)
      .json({ success: false, error: 'db_unavailable' } satisfies ApiEnvelope<never>)
  }

  // Validation 3: embeddedEoaAddress must match the Privy embedded EOA
  // recorded for this profile. Defense-in-depth: a malicious client
  // could submit a different EOA here and silently bind a foreign
  // signer; we reject.
  const profileRow = await db.sql`
    SELECT primary_embedded_eoa
    FROM profiles
    WHERE id = ${principal.profileId}
    LIMIT 1
  `
  const profile = profileRow.rows?.[0] as { primary_embedded_eoa: string | null } | undefined
  const recordedEmbedded =
    typeof profile?.primary_embedded_eoa === 'string' ? profile.primary_embedded_eoa.trim().toLowerCase() : ''
  if (!recordedEmbedded || recordedEmbedded !== embeddedEoaAddress) {
    return res
      .status(400)
      .json({ success: false, error: 'embedded_eoa_mismatch' } satisfies ApiEnvelope<never>)
  }

  // Validation 4: a profile binds to one parent CSW. If a prior row
  // exists with a different non-null parent, reject with 409 rather
  // than silently switching canonical.
  const existingRow = await db.sql`
    SELECT parent_csw_address
    FROM command_issuer_execution_context
    WHERE profile_id = ${principal.profileId}
    LIMIT 1
  `
  const existing = existingRow.rows?.[0] as { parent_csw_address: string | null } | undefined
  const existingParent =
    typeof existing?.parent_csw_address === 'string' ? existing.parent_csw_address.trim().toLowerCase() : null
  if (existingParent && existingParent.length > 0 && existingParent !== parentAddress) {
    return res
      .status(409)
      .json({ success: false, error: 'parent_csw_conflict' } satisfies ApiEnvelope<never>)
  }

  // Non-fatal sanity probe of the sub-account on chain. Logs a warning
  // if it has code AND ownerAtIndex(0) does not match the embedded
  // EOA. Does not gate the write.
  try {
    const sanity = __testHooks.sanityReadSubAccount ?? defaultSanityReadSubAccount
    await sanity({ subAccountAddress, embeddedEoaAddress })
  } catch (e) {
    logger.warn('[arch-b/baseapp/register] sanityReadSubAccount threw (non-fatal)', {
      message: e instanceof Error ? e.message : String(e ?? ''),
    })
  }

  // Write the (CIEC, profile_wallets, wallets) state in a single
  // server-side transaction so the canonical-flag flip and the
  // execution-context row succeed or fail together. If the
  // profile_wallets upsert fails mid-transaction, the
  // command_issuer_execution_context upsert is rolled back.
  //
  // We use the existing CIEC schema (NUMERIC(78,0) caps, TEXT
  // addresses) per migration 028; the spend_permission_* columns stay
  // NULL because v1 does not issue a spend permission. We tag the
  // row with provisioning_source = 'baseapp_waitlist' (migration 039)
  // so downstream code can branch on it.
  //
  // Caps default: per spec, spend caps are not part of v1 and the
  // sub-account executes against its own balance only. We still need
  // non-NULL values because the existing schema enforces NOT NULL.
  // Use 0n / 0n; if a future PR enables baseapp-waitlist spending it
  // will populate real values via a separate endpoint.
  const PROVISIONED_BY = `user:${principal.address}`
  // Caps must be > 0 per ck_command_issuer_caps_positive in migration 027.
  // envBigInt falls back to DEFAULT_* on missing / non-positive / non-numeric
  // env values, so misconfiguration can't re-introduce the zero-value bug.
  const perTxCapWei = envBigInt('ARCH_B_DEFAULT_PER_TX_CAP_WEI', DEFAULT_PER_TX_CAP_WEI)
  const dailyCapWei = envBigInt('ARCH_B_DEFAULT_DAILY_CAP_WEI', DEFAULT_DAILY_CAP_WEI)

  let resultRow: { ownerIndex: number } | null = null
  try {
    resultRow = await runInTransaction(async (txDb) => {
      // 1. Upsert command_issuer_execution_context (sub-account triple).
      // owner_index = 0: per spec, the SDK has not yet been instrumented
      // to log the actual returned index. Track C2 wires up the SDK
      // and may revise to whatever wallet_addSubAccount returns.
      // track-c2: record the actual ownerIndex from the SDK response and
      // update both this default and ACCOUNT_MODEL.md §5.3.
      await txDb.sql`
        INSERT INTO command_issuer_execution_context (
          profile_id, smart_wallet_address, privy_owner_wallet_id, owner_eoa_address,
          owner_index, paymaster_policy, per_tx_cap_wei, daily_cap_wei,
          provisioned_by, revoked_at, revoked_reason, updated_at,
          sub_account_address, parent_csw_address, provisioning_source
        ) VALUES (
          ${principal.profileId}, ${subAccountAddress}, '', ${embeddedEoaAddress},
          0, 'cdp_default', ${perTxCapWei.toString()}::NUMERIC, ${dailyCapWei.toString()}::NUMERIC,
          ${PROVISIONED_BY}, NULL, NULL, now(),
          ${subAccountAddress}, ${parentAddress}, ${PROVISIONING_SOURCE}
        )
        ON CONFLICT (profile_id) DO UPDATE SET
          smart_wallet_address = EXCLUDED.smart_wallet_address,
          owner_eoa_address    = EXCLUDED.owner_eoa_address,
          owner_index          = EXCLUDED.owner_index,
          paymaster_policy     = EXCLUDED.paymaster_policy,
          provisioned_by       = EXCLUDED.provisioned_by,
          revoked_at           = NULL,
          revoked_reason       = NULL,
          updated_at           = now(),
          sub_account_address  = EXCLUDED.sub_account_address,
          parent_csw_address   = EXCLUDED.parent_csw_address,
          provisioning_source  = EXCLUDED.provisioning_source
      `

      // 2. Ensure both wallets exist in `wallets` (referenced by
      // profile_wallets.address FK). Use ON CONFLICT DO NOTHING so we
      // don't overwrite provider/wallet_type for pre-existing rows.
      await txDb.sql`
        INSERT INTO wallets (address, chain, wallet_type, provider)
        VALUES
          (${parentAddress}, 'evm', 'smart_wallet', 'coinbase'),
          (${embeddedEoaAddress}, 'evm', 'eoa', 'privy')
        ON CONFLICT (address) DO NOTHING
      `

      // 3. Clear is_canonical_smart_wallet from any prior canonical
      // row so the partial unique index `profile_wallets_one_canonical`
      // doesn't trip when we set the parent CSW row.
      await txDb.sql`
        UPDATE profile_wallets
        SET is_canonical_smart_wallet = false,
            updated_at = now()
        WHERE profile_id = ${principal.profileId}
          AND lower(address) <> ${parentAddress}
          AND is_canonical_smart_wallet = true
      `

      // 4. Upsert the parent CSW as canonical.
      await txDb.sql`
        INSERT INTO profile_wallets (
          profile_id, address, is_canonical_smart_wallet, is_embedded_eoa,
          verified_at, created_at, updated_at
        ) VALUES (
          ${principal.profileId}, ${parentAddress}, true, false,
          now(), now(), now()
        )
        ON CONFLICT (profile_id, address) DO UPDATE SET
          is_canonical_smart_wallet = true,
          updated_at                = now()
      `

      // 5. Record the embedded EOA on profile_wallets as well, with
      // is_embedded_eoa = true. The partial unique index allows only
      // one such row per profile; if a different EOA was previously
      // recorded, clear it first. (Defense in depth: the
      // embedded_eoa_mismatch check above should already have
      // protected us, but the index is hard, so be explicit.)
      await txDb.sql`
        UPDATE profile_wallets
        SET is_embedded_eoa = false,
            updated_at      = now()
        WHERE profile_id = ${principal.profileId}
          AND lower(address) <> ${embeddedEoaAddress}
          AND is_embedded_eoa = true
      `
      await txDb.sql`
        INSERT INTO profile_wallets (
          profile_id, address, is_canonical_smart_wallet, is_embedded_eoa,
          verified_at, created_at, updated_at
        ) VALUES (
          ${principal.profileId}, ${embeddedEoaAddress}, false, true,
          now(), now(), now()
        )
        ON CONFLICT (profile_id, address) DO UPDATE SET
          is_embedded_eoa = true,
          updated_at      = now()
      `

      // 6. Mirror profile columns used by accounts/me executionTrack.
      await txDb.sql`
        UPDATE profiles
        SET
          primary_embedded_eoa = ${embeddedEoaAddress},
          csw_address = ${parentAddress},
          base_sub_account = ${subAccountAddress},
          updated_at = now()
        WHERE id = ${principal.profileId}
      `

      return { ownerIndex: 0 }
    })
  } catch (err) {
    logger.warn('[arch-b/baseapp/register] DB upsert failed', {
      profileId: principal.profileId,
      message: err instanceof Error ? err.message : String(err ?? ''),
    })
    return res
      .status(500)
      .json({ success: false, error: 'unexpected_error' } satisfies ApiEnvelope<never>)
  }

  if (!resultRow) {
    return res
      .status(503)
      .json({ success: false, error: 'db_unavailable' } satisfies ApiEnvelope<never>)
  }

  logger.info('[arch-b/baseapp/register] registered', {
    profileId: principal.profileId,
    parentAddress,
    subAccountAddress,
    provisioningSource: PROVISIONING_SOURCE,
  })

  return res.status(200).json({
    success: true,
    data: {
      profileId: principal.profileId,
      parentAddress,
      subAccountAddress,
      embeddedEoaAddress,
      ownerIndex: resultRow.ownerIndex,
      provisioningSource: PROVISIONING_SOURCE,
    },
  } satisfies ApiEnvelope<unknown>)
}
