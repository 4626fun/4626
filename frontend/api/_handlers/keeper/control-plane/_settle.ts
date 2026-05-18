import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  type ApiEnvelope,
  handleOptions,
  readBoundedJsonObjectBody,
  requireKeeprApiKey,
  setCors,
  setNoStore,
} from '../../../../packages/server-core/src/index.js'
import {
  executeSettleVault,
  SettleVaultExecutionError,
} from '../../../../server/_lib/controlPlane/executors/executeSettleVault.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }
  if (!requireKeeprApiKey(req, res)) return

  const body = (await readBoundedJsonObjectBody(req, { maxBytes: 8_192 })) as Record<string, unknown> | null
  const vaultAddress = typeof body?.vaultAddress === 'string' ? body.vaultAddress.trim().toLowerCase() : ''
  if (!/^0x[a-f0-9]{40}$/.test(vaultAddress)) {
    return res.status(400).json({ success: false, error: 'Invalid vaultAddress' } satisfies ApiEnvelope<never>)
  }

  try {
    const result = await executeSettleVault({
      vaultAddress,
      graduatedAt: typeof body?.graduatedAt === 'string' ? body.graduatedAt : undefined,
      settledAt: typeof body?.settledAt === 'string' ? body.settledAt : undefined,
      settlementStage: typeof body?.settlementStage === 'string' ? body.settlementStage : undefined,
    })
    return res.status(200).json({ success: true, data: result } satisfies ApiEnvelope<typeof result>)
  } catch (error) {
    if (error instanceof SettleVaultExecutionError) {
      return res.status(error.statusCode).json({
        success: false,
        error: error.message,
        data: { code: error.code, retryable: error.retryable },
      } satisfies ApiEnvelope<{ code: string; retryable: boolean }>)
    }
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'settle_failed',
    } satisfies ApiEnvelope<never>)
  }
}
