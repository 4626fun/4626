import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  type ApiEnvelope,
  handleOptions,
  readBoundedJsonObjectBody,
  requireKeeprApiKey,
  setCors,
  setNoStore,
} from '@4626/server-core'
import {
  provisionVaultEconomy,
  ProvisionVaultEconomyError,
} from '../../../../server/_lib/controlPlane/executors/provisionVaultEconomy.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }
  if (!requireKeeprApiKey(req, res)) return

  const body = (await readBoundedJsonObjectBody(req, { maxBytes: 16_384 })) as Record<string, unknown> | null
  const vaultAddress = typeof body?.vaultAddress === 'string' ? body.vaultAddress.trim().toLowerCase() : ''
  if (!/^0x[a-f0-9]{40}$/.test(vaultAddress)) {
    return res.status(400).json({ success: false, error: 'Invalid vaultAddress' } satisfies ApiEnvelope<never>)
  }

  try {
    const result = await provisionVaultEconomy({
      vaultAddress: vaultAddress as `0x${string}`,
      chainId: typeof body?.chainId === 'number' ? body.chainId : Number(body?.chainId ?? 8453),
      creatorAddress: typeof body?.creatorAddress === 'string' ? body.creatorAddress : null,
      strategyVariant: typeof body?.strategyVariant === 'string' ? body.strategyVariant : null,
      requestedBy: typeof body?.requestedBy === 'string' ? body.requestedBy : null,
      operationId: typeof body?.operationId === 'string' ? body.operationId : null,
    })
    return res.status(200).json({ success: true, data: result } satisfies ApiEnvelope<typeof result>)
  } catch (error) {
    if (error instanceof ProvisionVaultEconomyError) {
      return res.status(error.retryable ? 503 : 400).json({
        success: false,
        error: error.message,
        data: { code: error.code, retryable: error.retryable },
      } satisfies ApiEnvelope<{ code: string; retryable: boolean }>)
    }
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'provision_failed',
    } satisfies ApiEnvelope<never>)
  }
}
