/**
 * POST /api/onboarding/provision-agent-owner
 *
 * Provisions a Privy-managed agent wallet for the authenticated user's
 * canonical CSW and returns the `addOwnerAddress` calldata.  The client
 * sends this as a sponsored `canonical4337` self-call from the CSW,
 * signed by the already-confirmed Privy embedded EOA owner.
 *
 * This replaces the old pattern where deploy-session lazily installed the
 * agent owner at first use.  By moving it into onboarding we can fold it
 * into the same session as sub-account creation and minimise passkey prompts.
 *
 * Response shape:
 *   { alreadyOwner: true }
 *   OR
 *   { alreadyOwner: false, agentWalletAddress, txRequest }
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  type ApiEnvelope,
  handleOptions,
  setCors,
  setNoStore,
  getDb,
  readJsonBody,
  RATE_LIMITS,
  checkDurableRateLimit,
  getClientIp,
  rateLimitKey,
} from '@4626/server-core'
import {
  bootstrapCanonicalDelegationState,
  extractDelegationFlags,
} from '../../../server/_lib/wallet/canonicalCswDelegation.js'
import { prepareAddOwnerTx, isOwner as isOwnerOnChain } from '../../../server/_lib/wallet/coinbaseSmartWalletOwner.js'
import { createAgentWallet, getWalletById } from '../../../server/_lib/wallet/privyWalletApi.js'
import { issueActivationOwnerToken } from '../../../server/_lib/wallet/activationOwnerToken.js'
import { resolveActivationServerWallet } from '../../../server/_lib/wallet/activationServerWallet.js'
import { resolveServerBaseRpcUrl } from '../../../server/_lib/onchain/baseRpcUrl.js'
import { createPublicClient, getAddress, http, type Address } from 'viem'
import { base } from 'viem/chains'

type ProvisionAgentOwnerResponse =
  | {
      alreadyOwner: true
      agentWalletAddress: string
      embeddedOwnerConfirmed: true
      activationToken: string
    }
  | {
      alreadyOwner: false
      agentWalletAddress: string
      embeddedOwnerConfirmed: true
      activationToken: string
      txRequest: ReturnType<typeof prepareAddOwnerTx>
    }

function resolveStatusCode(error: unknown): number {
  const flags = extractDelegationFlags(error)
  if (flags.needsBaseAppSetup || flags.needsEmbeddedWallet) return 409
  const message = error instanceof Error ? error.message : String(error ?? '')
  const lower = message.toLowerCase()
  if (
    lower.includes('missing privy auth token') ||
    lower.includes('invalid privy auth token') ||
    lower.includes('privy verification failed') ||
    lower.includes('jwt') ||
    lower.includes('unauthorized') ||
    lower.includes('forbidden')
  ) {
    return 401
  }
  if (lower.includes('not configured')) return 503
  return 500
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const limiter = await checkDurableRateLimit(
    rateLimitKey('onboarding-provision-agent-owner', getClientIp(req)),
    RATE_LIMITS.cswLink,
    { failClosed: true },
  )
  if (!limiter.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((limiter.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Rate limit exceeded' } satisfies ApiEnvelope<never>)
  }

  const body = (await readJsonBody(req, { maxBytes: 8 * 1024 }).catch(() => null)) as
    | Record<string, unknown>
    | null
  if (body?.purpose !== 'enable_4626_server_owner') {
    return res.status(400).json({
      success: false,
      error: 'activation_purpose_required',
    } satisfies ApiEnvelope<never>)
  }

  const db = await getDb()
  if (!db) {
    return res.status(503).json({ success: false, error: 'Service unavailable' } satisfies ApiEnvelope<never>)
  }

  try {
    // 1. Bootstrap canonical delegation state — verifies Privy token and
    //    resolves the user's canonical CSW.
    const bootstrap = await bootstrapCanonicalDelegationState({ db: db as any, req })
    const canonicalCswAddress = bootstrap.canonicalCswAddress as Address

    const embeddedEoaAddress = getAddress(bootstrap.privyEmbeddedEoaAddress)
    if (!bootstrap.privyIsOwner) {
      return res.status(409).json({
        success: false,
        error: 'embedded_owner_not_confirmed',
      } satisfies ApiEnvelope<never>)
    }

    // 2. Provision only after this explicit authenticated activation request.
    //    Reuse the persisted server wallet first; the Privy idempotency key is
    //    additionally bound to profile + parent CSW.
    const persistedResult = await (db as any).sql`
      SELECT preprov_server_wallet_id, preprov_server_wallet_address
      FROM profiles
      WHERE id = ${bootstrap.profileId}
      LIMIT 1;
    `
    const persisted = persistedResult.rows?.[0] as Record<string, unknown> | undefined
    const persistedWalletId =
      typeof persisted?.preprov_server_wallet_id === 'string'
        ? persisted.preprov_server_wallet_id.trim()
        : ''
    const persistedWalletAddress =
      typeof persisted?.preprov_server_wallet_address === 'string'
        ? persisted.preprov_server_wallet_address.trim()
        : ''
    const agentWallet = await resolveActivationServerWallet({
      profileId: bootstrap.profileId,
      parentCswAddress: canonicalCswAddress,
      persistedWalletId: persistedWalletId || null,
      persistedWalletAddress: persistedWalletAddress || null,
      fetchWallet: getWalletById,
      createWallet: async (idempotencyKey) => createAgentWallet({ idempotencyKey }),
    })
    await (db as any).sql`
      UPDATE profiles
      SET preprov_server_wallet_id = ${agentWallet.walletId},
          preprov_server_wallet_address = ${agentWallet.address.toLowerCase()},
          updated_at = NOW()
      WHERE id = ${bootstrap.profileId};
    `

    const activationToken = issueActivationOwnerToken({
      privyUserId: bootstrap.privyUserId,
      profileId: bootstrap.profileId,
      sessionAddress: embeddedEoaAddress,
      smartWalletAddress: canonicalCswAddress,
      embeddedOwnerAddress: embeddedEoaAddress,
      serverOwnerAddress: getAddress(agentWallet.address),
    })

    // 3. Check if the agent wallet is already an owner of the CSW on-chain.
    const publicClient = createPublicClient({
      chain: base,
      transport: http(resolveServerBaseRpcUrl()),
    })

    const alreadyOwner = await isOwnerOnChain(publicClient, canonicalCswAddress, agentWallet.address)

    if (alreadyOwner) {
      return res.status(200).json({
        success: true,
        data: {
          alreadyOwner: true,
          agentWalletAddress: agentWallet.address,
          embeddedOwnerConfirmed: true,
          activationToken,
        } satisfies ProvisionAgentOwnerResponse,
      } satisfies ApiEnvelope<ProvisionAgentOwnerResponse>)
    }

    // 4. Build the addOwnerAddress calldata for the client to submit.
    const txRequest = prepareAddOwnerTx(canonicalCswAddress, agentWallet.address)

    return res.status(200).json({
      success: true,
      data: {
        alreadyOwner: false,
        agentWalletAddress: agentWallet.address,
        embeddedOwnerConfirmed: true,
        activationToken,
        txRequest,
      } satisfies ProvisionAgentOwnerResponse,
    } satisfies ApiEnvelope<ProvisionAgentOwnerResponse>)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to provision agent owner'
    return res
      .status(resolveStatusCode(error))
      .json({ success: false, error: message, ...extractDelegationFlags(error) } satisfies ApiEnvelope<never>)
  }
}
