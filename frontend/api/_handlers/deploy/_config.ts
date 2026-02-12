import type { VercelRequest, VercelResponse } from '@vercel/node'

import { type ApiEnvelope, handleOptions, setCors, setNoStore } from '../../../server/auth/_shared.js'
import { getApiContracts } from '../../../server/_lib/contracts.js'
import { getSessionAddress, isAdminAddress } from '../../../server/_lib/session.js'

declare const process: { env: Record<string, string | undefined> }

type DeployConfigResponse = {
  admin: `0x${string}`
  creatorVaultBatcher: `0x${string}` | null
  allowApiContractOverrides: boolean
  deployMode: string
  serverContinue: boolean
}

function envBool(key: string): boolean {
  const v = String(process.env[key] ?? '').trim().toLowerCase()
  return v === '1' || v === 'true' || v === 'yes'
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const admin = getSessionAddress(req)
  if (!admin) {
    return res.status(401).json({ success: false, error: 'Sign in required' } satisfies ApiEnvelope<never>)
  }
  if (!isAdminAddress(admin)) {
    return res.status(403).json({ success: false, error: 'Admin only' } satisfies ApiEnvelope<never>)
  }

  const contracts = getApiContracts()
  const deployMode = String(process.env.VITE_DEPLOY_MODE ?? process.env.DEPLOY_MODE ?? 'default')
    .trim()
    .toLowerCase() || 'default'

  const data: DeployConfigResponse = {
    admin,
    creatorVaultBatcher: contracts.creatorVaultBatcher ?? null,
    allowApiContractOverrides: envBool('ALLOW_API_CONTRACT_OVERRIDES'),
    deployMode,
    serverContinue: envBool('VITE_DEPLOY_USE_SERVER_CONTINUE'),
  }

  return res.status(200).json({ success: true, data } satisfies ApiEnvelope<DeployConfigResponse>)
}
