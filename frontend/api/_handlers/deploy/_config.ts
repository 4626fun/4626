import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  type ApiEnvelope,
  handleOptions,
  readRequestPrincipalAddress,
  setCors,
  setNoStore,
  getApiContracts,
} from '../../../packages/server-core/src/index.js'


import { resolvePayoutRouterFeeConfig, resolvePayoutRouterKeeperAddress } from '../../../server/_lib/payoutRouterRuntime.js'
import { isServerAdminAddress } from '../../../server/_lib/trust.js'

declare const process: { env: Record<string, string | undefined> }

type DeployConfigResponse = {
  creatorVaultBatcher: `0x${string}` | null
  deploymentVersion: string
  allowApiContractOverrides: boolean
  deployMode: string
  serverContinue: boolean
  payoutRouterKeeperAddress: `0x${string}` | null
  zoraToken: `0x${string}` | null
  payoutRouterZoraWethFee: number
  payoutRouterWethCreatorFee: number
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
  const principalAddress = readRequestPrincipalAddress(req, { lowercase: true })
  if (!principalAddress || !isServerAdminAddress(principalAddress)) {
    return res.status(403).json({ success: false, error: 'Admin access required' } satisfies ApiEnvelope<never>)
  }

  const contracts = getApiContracts()
  const payoutRouterKeeperAddress = resolvePayoutRouterKeeperAddress()
  const payoutRouterFees = resolvePayoutRouterFeeConfig()
  const deployMode = String(process.env.VITE_DEPLOY_MODE ?? process.env.DEPLOY_MODE ?? 'default')
    .trim()
    .toLowerCase() || 'default'
  const deploymentVersion = String(process.env.VITE_DEPLOYMENT_VERSION ?? '').trim()

  const data: DeployConfigResponse = {
    creatorVaultBatcher: contracts.creatorVaultBatcher ?? null,
    deploymentVersion,
    allowApiContractOverrides: envBool('ALLOW_API_CONTRACT_OVERRIDES'),
    deployMode,
    serverContinue: envBool('VITE_DEPLOY_USE_SERVER_CONTINUE'),
    payoutRouterKeeperAddress: payoutRouterKeeperAddress ?? null,
    zoraToken: contracts.zora ?? null,
    payoutRouterZoraWethFee: payoutRouterFees.zoraWethFee,
    payoutRouterWethCreatorFee: payoutRouterFees.wethCreatorFee,
  }

  return res.status(200).json({ success: true, data } satisfies ApiEnvelope<DeployConfigResponse>)
}
