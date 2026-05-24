/**
 * POST /api/onboarding/provision-agent-owner
 *
 * Provisions a Privy-managed agent wallet for the authenticated user's
 * canonical CSW and returns the `addOwnerAddress` calldata.  The client
 * sends this as an `eth_sendTransaction` self-call from the CSW
 * during the same account-setup ceremony that creates the sub-account.
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
  RATE_LIMITS,
  checkRateLimit,
  getClientIp,
  rateLimitKey,
} from '../../../packages/server-core/src/index.js'
import {
  bootstrapCanonicalDelegationState,
  extractDelegationFlags,
} from '../../../server/_lib/wallet/canonicalCswDelegation.js'
import { prepareAddOwnerTx, isOwner as isOwnerOnChain } from '../../../server/_lib/wallet/coinbaseSmartWalletOwner.js'
import { createAgentWallet } from '../../../server/_lib/wallet/privyWalletApi.js'
import { resolveServerBaseRpcUrl } from '../../../server/_lib/onchain/baseRpcUrl.js'
import { createPublicClient, http, type Address } from 'viem'
import { base } from 'viem/chains'

type ProvisionAgentOwnerResponse =
  | { alreadyOwner: true; agentWalletAddress: string }
  | {
      alreadyOwner: false
      agentWalletAddress: string
      txRequest: {
        chainId: 8453
        to: `0x${string}`
        data: `0x${string}`
        value: '0x0'
      }
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

  const limiter = checkRateLimit(
    rateLimitKey('onboarding-provision-agent-owner', getClientIp(req)),
    RATE_LIMITS.cswLink,
  )
  if (!limiter.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((limiter.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Rate limit exceeded' } satisfies ApiEnvelope<never>)
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

    // 2. Provision (or retrieve) the agent wallet for this user.
    //    The idempotency key is tied to the canonical CSW so that the same
    //    wallet is returned on retry.
    const agentWallet = await createAgentWallet({
      idempotencyKey: `agent-owner:${canonicalCswAddress.toLowerCase()}`,
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
