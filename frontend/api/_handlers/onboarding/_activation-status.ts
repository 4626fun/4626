import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  getDb,
  handleOptions,
  setCors,
  setNoStore,
  type ApiEnvelope,
} from '@4626/server-core'
import {
  readActivationStatus,
  resolveActivationContext,
} from '../../../server/_lib/wallet/activationContext.js'

type ActivationStatusResponse = {
  parentCswAddress: string
  embeddedEoaAddress: string
  serverWalletAddress: string | null
  embeddedOwnerConfirmed: boolean
  serverOwnerConfirmed: boolean
  xmtpProvisioned: boolean
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed',
    } satisfies ApiEnvelope<never>)
  }

  const db = await getDb()
  if (!db) {
    return res.status(503).json({
      success: false,
      error: 'Service unavailable',
    } satisfies ApiEnvelope<never>)
  }

  try {
    const context = await resolveActivationContext({ db: db as never, req })
    const status = await readActivationStatus({ db: db as never, context })
    const data: ActivationStatusResponse = {
      parentCswAddress: status.parentCswAddress,
      embeddedEoaAddress: status.embeddedEoaAddress,
      serverWalletAddress: status.serverWalletAddress,
      embeddedOwnerConfirmed: status.embeddedOwnerConfirmed,
      serverOwnerConfirmed: status.serverOwnerConfirmed,
      xmtpProvisioned: status.xmtpProvisioned,
    }
    return res.status(200).json({
      success: true,
      data,
    } satisfies ApiEnvelope<ActivationStatusResponse>)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Activation status failed'
    const statusCode = message.includes('Missing Privy') || message.includes('Privy verification')
      ? 401
      : message === 'activation_parent_csw_missing' || message === 'activation_embedded_eoa_missing'
        ? 409
        : 500
    return res.status(statusCode).json({
      success: false,
      error: message,
    } satisfies ApiEnvelope<never>)
  }
}
