/**
 * POST /api/v1/agents/identity/set-agent-wallet
 *
 * Build the EIP-712 typed data for `setAgentWallet` on the ERC-8004
 * Identity Registry, and optionally encode the final calldata once the
 * client provides the wallet signature.
 *
 * Two-phase flow:
 *   Phase 1 (action: "prepare"):
 *     Returns the EIP-712 typed data that the new wallet must sign.
 *
 *   Phase 2 (action: "encode"):
 *     Given the signature, returns the encoded calldata for the
 *     `setAgentWallet` transaction.
 *
 * Body (JSON):
 *   action: "prepare" | "encode"
 *   agentId: number | string
 *   newWallet: string (address)
 *   ownerAddress: string (address — current NFT owner / CSW)
 *   deadline?: number (unix timestamp, defaults to now + 4 minutes)
 *   signature?: string (hex — required for "encode" action)
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'

import { encodeFunctionData, getAddress, isAddress, type Address, type Hex } from 'viem'

import {
  handleOptions,
  readBoundedJsonObjectBody,
  setCors,
  setNoStore,
  guardAgentApiRequest,
  getClientIp,
  RATE_LIMITS,
  checkRateLimit,
  rateLimitKey,
} from '@4626/server-core'


import { resolveCanonicalSmartWalletAddress } from '../../../../../server/_lib/wallet/canonicalWalletResolver.js'
import {
  getIdentityRegistryAddress,
  IDENTITY_REGISTRY_ABI,
} from '../../../../../server/_lib/agent/erc8004.js'

/** EIP-712 domain matching the on-chain IdentityRegistryUpgradeable. */
function buildEip712Domain(chainId: number) {
  return {
    name: 'ERC8004IdentityRegistry',
    version: '1',
    chainId,
    verifyingContract: getIdentityRegistryAddress(),
  } as const
}

/** EIP-712 type for AgentWalletSet. */
const AGENT_WALLET_SET_TYPES = {
  AgentWalletSet: [
    { name: 'agentId', type: 'uint256' },
    { name: 'newWallet', type: 'address' },
    { name: 'owner', type: 'address' },
    { name: 'deadline', type: 'uint256' },
  ],
} as const

function asObjectBody(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {}
  return input as Record<string, unknown>
}

function setRetryAfterHeader(res: VercelResponse, resetAt: number) {
  res.setHeader('Retry-After', String(Math.max(1, Math.ceil((resetAt - Date.now()) / 1000))))
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  if (handleOptions(req, res)) return
  setNoStore(res)
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' })

  const g = await guardAgentApiRequest({ req, res, endpoint: 'v1/agents/identity/set-agent-wallet', kind: 'write' })
  if (!g.ok) return

  const limiter = checkRateLimit(
    rateLimitKey('v1-agent-identity-set-wallet', g.auth?.address?.toLowerCase() ?? 'anon', getClientIp(req)),
    RATE_LIMITS.agentIdentitySetWallet,
  )
  if (!limiter.allowed) {
    setRetryAfterHeader(res, limiter.resetAt)
    return res.status(429).json({ success: false, error: 'Too many requests' })
  }

  const body = asObjectBody(await readBoundedJsonObjectBody(req, { maxBytes: 8_192 }))
  const action = String(body?.action ?? 'prepare').trim().toLowerCase()
  const agentIdRaw = String(body?.agentId ?? '').trim()
  const newWalletRaw = String(body?.newWallet ?? '').trim()
  const ownerRaw = String(body?.ownerAddress ?? '').trim()
  const chainId = Number(body?.chainId ?? 8453)

  if (!agentIdRaw || !/^\d+$/.test(agentIdRaw)) {
    return res.status(400).json({ success: false, error: 'agentId is required (non-negative integer)' })
  }
  if (!newWalletRaw || !isAddress(newWalletRaw)) {
    return res.status(400).json({ success: false, error: 'newWallet must be a valid address' })
  }
  if (!ownerRaw || !isAddress(ownerRaw)) {
    return res.status(400).json({ success: false, error: 'ownerAddress must be a valid address (current NFT owner)' })
  }

  const agentId = BigInt(agentIdRaw)
  const newWallet = getAddress(newWalletRaw)
  const ownerAddress = getAddress(ownerRaw)

  const canonicalOwner = await resolveCanonicalSmartWalletAddress(ownerAddress)
  if (!canonicalOwner || canonicalOwner.toLowerCase() !== ownerAddress.toLowerCase()) {
    return res.status(403).json({
      success: false,
      error: 'ownerAddress must be a verified canonical smart wallet',
    })
  }

  if (g.auth?.type === 'session') {
    const sessionCanonical = await resolveCanonicalSmartWalletAddress(g.auth.address)
    if (!sessionCanonical || sessionCanonical.toLowerCase() !== ownerAddress.toLowerCase()) {
      return res.status(403).json({
        success: false,
        error: 'ownerAddress must match your canonical smart wallet',
      })
    }
  } else if (g.auth?.type === 'siwa') {
    if (BigInt(g.auth.agentId) !== agentId) {
      return res.status(403).json({
        success: false,
        error: 'SIWA agent authorization does not match agentId',
      })
    }
  }

  // Default deadline: 4 minutes from now (contract allows max 5 min)
  const deadline = body?.deadline
    ? BigInt(String(body.deadline))
    : BigInt(Math.floor(Date.now() / 1000) + 240)

  try {
    if (action === 'prepare') {
      // Phase 1: Return the EIP-712 typed data for the wallet to sign
      const domain = buildEip712Domain(chainId)
      const message = {
        agentId: agentId.toString(),
        newWallet,
        owner: ownerAddress,
        deadline: deadline.toString(),
      }

      return res.status(200).json({
        success: true,
        data: {
          typedData: {
            domain,
            types: AGENT_WALLET_SET_TYPES,
            primaryType: 'AgentWalletSet' as const,
            message,
          },
          deadline: deadline.toString(),
          registryAddress: getIdentityRegistryAddress(),
          note: 'Sign this typed data with the newWallet address, then call this endpoint again with action: "encode" and the signature.',
        },
      })
    }

    if (action === 'encode') {
      // Phase 2: Encode the setAgentWallet calldata with the provided signature
      const signatureRaw = String(body?.signature ?? '').trim()
      if (!signatureRaw || !/^0x[a-fA-F0-9]+$/.test(signatureRaw)) {
        return res.status(400).json({ success: false, error: 'signature is required (hex bytes)' })
      }

      const registryAddress = getIdentityRegistryAddress()
      const calldata = encodeFunctionData({
        abi: IDENTITY_REGISTRY_ABI,
        functionName: 'setAgentWallet',
        args: [agentId, newWallet, deadline, signatureRaw as Hex],
      })

      return res.status(200).json({
        success: true,
        data: {
          to: registryAddress,
          data: calldata,
          agentId: agentId.toString(),
          newWallet,
          deadline: deadline.toString(),
          note: 'Submit this transaction from the agent NFT owner address.',
        },
      })
    }

    return res.status(400).json({ success: false, error: 'action must be "prepare" or "encode"' })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to process setAgentWallet request'
    return res.status(500).json({ success: false, error: msg })
  }
}
