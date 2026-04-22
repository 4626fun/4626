/**
 * Architecture B Phase 2 — user self-service status endpoint.
 *
 * GET /api/arch-b/status
 *
 * Returns the delegation and execution-readiness state for the authenticated
 * session. If no session, returns { data: null } (matches creator-access/_status.ts).
 *
 * Responses:
 *   200 { success: true, data: null }            — unauthenticated
 *   200 { success: true, data: { profileId, delegated, executionReady, caps, revokedAt, quorumId } }
 */

import { PrivyClient } from '@privy-io/server-auth'
import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  type ApiEnvelope,
  handleOptions,
  setCors,
  setNoStore,
  getDb,
  isDbConfigured,
  resolveAuthorizedRequestPrincipal,
} from '../../../packages/server-core/src/index.js'
import { resolveCommandIssuerContextByProfileId } from '../../../server/_lib/wallet/commandIssuerContext.js'
import {
  fetchPrivyWalletFull,
} from '../../../server/_lib/wallet/privyWalletApi.js'
import { resolveOwnerWalletId } from '../../../server/_lib/wallet/privyOwnerWalletIdResolver.js'
import { getBasePublicClient } from '../../../server/_lib/wallet/subAccountProvisionVerify.js'
import { readSpendPermissionCurrentPeriod } from '../../../server/_lib/wallet/spendPermissionPeriodRead.js'
import type { CommandIssuerSubAccount } from '../../../server/_lib/wallet/commandIssuerContext.js'

declare const process: { env: Record<string, string | undefined> }

function resolveQuorumId(): { quorumId: string | null; configured: boolean } {
  const nodeEnv = (process.env.NODE_ENV ?? '').trim().toLowerCase()
  const isProd = nodeEnv === 'production' || Boolean((process.env.VERCEL ?? '').trim())
  const fromEnv = (process.env.ARCH_B_SIGNER_QUORUM_ID ?? '').trim()
  if (fromEnv) return { quorumId: fromEnv, configured: true }
  if (isProd) return { quorumId: null, configured: false }
  return { quorumId: 'lr8vgu2l0wnmwg824n4jrtr3', configured: true }
}

function getPrivyServerAuth(): { appId: string; appSecret: string } {
  const appId = (process.env.PRIVY_APP_ID ?? '').trim()
  const appSecret = (process.env.PRIVY_APP_SECRET ?? '').trim()
  if (!appId || !appSecret) {
    throw new Error('Privy server auth not configured (missing PRIVY_APP_ID / PRIVY_APP_SECRET).')
  }
  return { appId, appSecret }
}

function normalizeSignerId(entry: { signer_id?: string; id?: string } | string): string | null {
  if (typeof entry === 'string') return entry.trim() || null
  const v = entry.signer_id ?? entry.id ?? ''
  return typeof v === 'string' && v.trim() ? v.trim() : null
}

async function resolveDelegated(
  walletId: string,
  quorumId: string,
): Promise<boolean | null> {
  try {
    const walletFull = await fetchPrivyWalletFull(walletId)
    if (!walletFull) return null
    const signerIds = walletFull.additional_signers
      .map(normalizeSignerId)
      .filter((s): s is string => s !== null)
    return signerIds.includes(quorumId)
  } catch {
    return null
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'GET') {
    return res
      .status(405)
      .json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const principal = await resolveAuthorizedRequestPrincipal(req, { lowercase: true })
  if (!principal) {
    return res
      .status(200)
      .json({ success: true, data: null } satisfies ApiEnvelope<null>)
  }

  const { profileId } = principal
  const quorum = resolveQuorumId()

  // Resolve execution readiness
  const ctxResolution = await resolveCommandIssuerContextByProfileId(profileId)

  // db_unavailable is an operational incident — surface it explicitly via 503
  // rather than misclassifying it as not_provisioned (which would drive users
  // into re-enrollment UX during backend outages).
  if (ctxResolution.status === 'db_unavailable') {
    return res
      .status(503)
      .json({ success: false, error: 'db_unavailable' } satisfies ApiEnvelope<never>)
  }

  let executionReady: 'ready' | 'revoked' | 'not_provisioned' = 'not_provisioned'
  let caps: { perTxCapWei: string; dailyCapWei: string } | null = null
  let revokedAt: string | null = null
  let existingWalletId: string | null = null
  let subAccountContext: CommandIssuerSubAccount | null = null

  if (ctxResolution.status === 'ready') {
    executionReady = 'ready'
    caps = {
      perTxCapWei: ctxResolution.context.perTxCapWei.toString(),
      dailyCapWei: ctxResolution.context.dailyCapWei.toString(),
    }
    existingWalletId = ctxResolution.context.privyOwnerWalletId
    subAccountContext = ctxResolution.context.subAccount
  } else if (ctxResolution.status === 'revoked') {
    executionReady = 'revoked'
    revokedAt = ctxResolution.revokedAt.toISOString()
  }

  // Resolve walletId for delegation check (prefer existing context row, then derive)
  let walletId = existingWalletId

  if (!walletId && isDbConfigured()) {
    const db = await getDb()
    if (db) {
      try {
        const profileRow = await db.sql`
          SELECT privy_user_id, primary_embedded_eoa
          FROM profiles
          WHERE id = ${profileId}
          LIMIT 1
        `
        const row = profileRow.rows?.[0] as Record<string, unknown> | undefined
        const privyUserId = typeof row?.privy_user_id === 'string' ? row.privy_user_id.trim() : ''
        const ownerEoa =
          typeof row?.primary_embedded_eoa === 'string' ? row.primary_embedded_eoa.trim() : ''

        if (privyUserId && ownerEoa) {
          const { appId, appSecret } = getPrivyServerAuth()
          const privyClient = new PrivyClient(appId, appSecret)
          const privyUser = await privyClient.getUserById(privyUserId)
          const walletOutcome = resolveOwnerWalletId(privyUser, ownerEoa)
          if (walletOutcome.status === 'ready') {
            walletId = walletOutcome.candidate.id ?? null
          }
        }
      } catch {
        // best-effort — walletId stays null, delegated will be null
      }
    }
  }

  const delegated = walletId && quorum.quorumId ? await resolveDelegated(walletId, quorum.quorumId) : null

  // Sub-account surface for the /accounts "Execution scopes" card. When
  // sub_account_address is not populated, the legacy direct-CSW path is
  // in effect — we return `subAccount: null` and the card shows a
  // "not enabled" empty state. When present, we additionally read the
  // SpendPermissionManager's current period window so the UI can show
  // "0.18 ETH used · 0.32 ETH remaining" without a separate round trip.
  let subAccountResponse: SubAccountStatusDto | null = null
  if (subAccountContext) {
    let currentPeriod: Awaited<ReturnType<typeof readSpendPermissionCurrentPeriod>> = null
    try {
      const publicClient = getBasePublicClient()
      currentPeriod = await readSpendPermissionCurrentPeriod(
        publicClient as unknown as Parameters<typeof readSpendPermissionCurrentPeriod>[0],
        subAccountContext.spendPermission.payload,
      )
    } catch {
      // Non-fatal: UI renders "usage unavailable" in that slot.
      currentPeriod = null
    }

    subAccountResponse = {
      address: subAccountContext.subAccountAddress,
      parentCsw: subAccountContext.parentCswAddress,
      spendPermission: {
        allowanceWei: subAccountContext.spendPermission.allowanceWei.toString(),
        periodSeconds: subAccountContext.spendPermission.periodSeconds,
        endAt: subAccountContext.spendPermission.endAt.toISOString(),
        revokedAt: subAccountContext.spendPermission.revokedAt
          ? subAccountContext.spendPermission.revokedAt.toISOString()
          : null,
        currentPeriod: currentPeriod
          ? {
              startUnix: currentPeriod.start,
              endUnix: currentPeriod.end,
              spendWei: currentPeriod.spendWei,
              remainingWei: currentPeriod.remainingWei,
            }
          : null,
      },
    }
  }

  return res.status(200).json({
    success: true,
    data: {
      profileId,
      delegated,
      executionReady,
      caps,
      revokedAt,
      quorumId: quorum.quorumId ?? '',
      quorumConfigured: quorum.configured,
      subAccount: subAccountResponse,
    },
  } satisfies ApiEnvelope<unknown>)
}

type SubAccountStatusDto = {
  address: string
  parentCsw: string
  spendPermission: {
    allowanceWei: string
    periodSeconds: number
    endAt: string
    revokedAt: string | null
    currentPeriod: {
      startUnix: number
      endUnix: number
      spendWei: string
      remainingWei: string
    } | null
  }
}
