/**
 * POST /api/cre/keeper/tend
 *
 * HTTP bridge endpoint for CRE workflows. Accepts a vault address and
 * executes the `tend()` call using the keeper wallet.
 *
 * Protected by KEEPR_API_KEY Bearer token.
 *
 * Request body: { vaultAddress: string }
 * Response: { success: true, data: { txHash: string } }
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { type ApiEnvelope, handleOptions, readBoundedJsonObjectBody, requireKeeprApiKey, setCors, setNoStore } from '../../../../packages/server-core/src/index.js'
import { checkRateLimit, getClientIp, RATE_LIMITS, rateLimitKey } from '../../../../server/_lib/rateLimit.js'
import { createPublicClient, createWalletClient, http, type Abi } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { base } from 'viem/chains'

const VAULT_ABI = [
  { type: 'function', name: 'tend', inputs: [], outputs: [], stateMutability: 'nonpayable' },
] as const

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  if (!requireKeeprApiKey(req, res)) return

  const limiter = checkRateLimit(
    rateLimitKey('cre-keeper-tend', getClientIp(req)),
    RATE_LIMITS.creRuntimeTriggerWrite,
  )
  if (!limiter.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((limiter.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Rate limit exceeded' } satisfies ApiEnvelope<never>)
  }

  const body = (await readBoundedJsonObjectBody(req, { maxBytes: 8_192 })) as { vaultAddress?: string } | null
  const vaultAddress = typeof body?.vaultAddress === 'string' ? body.vaultAddress.trim() : ''
  if (!vaultAddress || !vaultAddress.startsWith('0x') || vaultAddress.length !== 42) {
    return res.status(400).json({ success: false, error: 'Invalid vaultAddress' } satisfies ApiEnvelope<never>)
  }

  const keeperPk = process.env.KEEPR_PRIVATE_KEY
  if (!keeperPk) {
    return res.status(500).json({ success: false, error: 'KEEPR_PRIVATE_KEY not configured' } satisfies ApiEnvelope<never>)
  }

  try {
    const rpcUrl = process.env.BASE_RPC_URL || 'https://mainnet.base.org'
    const account = privateKeyToAccount(keeperPk as `0x${string}`)
    const publicClient = createPublicClient({ chain: base, transport: http(rpcUrl, { timeout: 30_000 }) }) as any
    const walletClient = createWalletClient({ account, chain: base, transport: http(rpcUrl, { timeout: 30_000 }) })

    const txHash = await walletClient.writeContract({
      address: vaultAddress as `0x${string}`,
      abi: VAULT_ABI as unknown as Abi,
      functionName: 'tend',
      chain: base,
      account,
    })

    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash, timeout: 120_000 })

    return res.status(200).json({
      success: true,
      data: {
        txHash,
        status: receipt.status === 'success' ? 'success' : 'reverted',
      },
    } satisfies ApiEnvelope<{ txHash: string; status: string }>)
  } catch (err) {
    console.error('[cre/keeper/tend] Error:', err)
    return res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    } satisfies ApiEnvelope<never>)
  }
}
