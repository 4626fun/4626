import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  type ApiEnvelope,
  handleOptions,
  readBoundedJsonObjectBody,
  requireKeeprApiKey,
  setCors,
  setNoStore,
} from '../../../../packages/server-core/src/index.js'
import { runMaintenanceCycle } from '../../../../server/_lib/controlPlane/executors/runMaintenanceCycle.js'
import { KeeperVaultActionError } from '../../../../server/_lib/controlPlane/executors/keeperVaultActions.js'

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
    const result = await runMaintenanceCycle({
      vaultAddress: vaultAddress as `0x${string}`,
      mode: typeof body?.mode === 'string' ? body.mode : 'standard',
    })
    const success = result.overall !== 'failed'
    return res.status(success ? 200 : 500).json({
      success,
      data: result,
      ...(success ? null : { error: 'maintenance_cycle_failed' }),
    } satisfies ApiEnvelope<typeof result>)
  } catch (error) {
    if (error instanceof KeeperVaultActionError) {
      return res.status(error.retryable ? 503 : 400).json({
        success: false,
        error: error.message,
      } satisfies ApiEnvelope<never>)
    }
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'maintenance_failed',
    } satisfies ApiEnvelope<never>)
  }
}
