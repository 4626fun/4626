import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  type ApiEnvelope,
  handleOptions,
  readRequestPrincipalAddress,
  setCors,
  setNoStore,
  getApiContracts,
} from '../../../packages/server-core/src/index.js'


import {
  resolvePayoutRouterExternalSwapApprovals,
  resolvePayoutRouterFeeConfig,
  resolvePayoutRouterKeeperAddress,
  resolvePayoutRouterZoraToken,
} from '../../../server/_lib/onchain/payoutRouterRuntime.js'
import { deploymentBatcherNotConfiguredMessage } from '../../../server/_lib/onchain/deploymentBatcherConfigError.js'

declare const process: { env: Record<string, string | undefined> }

type DeployConfigResponse = {
  creatorVaultBatcher: `0x${string}` | null
  creatorVaultBatcherConfigError: string | null
  deploymentVersion: string
  allowApiContractOverrides: boolean
  deployMode: string
  serverContinue: boolean
  payoutRouterKeeperAddress: `0x${string}` | null
  payoutRouterApprovedExternalSwapTargets: `0x${string}`[]
  payoutRouterApprovedExternalSwapSpenders: `0x${string}`[]
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
  if (!principalAddress) {
    return res.status(401).json({ success: false, error: 'Not authenticated' } satisfies ApiEnvelope<never>)
  }

  const contracts = getApiContracts()
  const payoutRouterKeeperAddress = resolvePayoutRouterKeeperAddress()
  const payoutRouterExternalApprovals = resolvePayoutRouterExternalSwapApprovals()
  const payoutRouterFees = resolvePayoutRouterFeeConfig()
  const deployMode = String(process.env.VITE_DEPLOY_MODE ?? process.env.DEPLOY_MODE ?? 'default')
    .trim()
    .toLowerCase() || 'default'
  const deploymentVersion = String(process.env.VITE_DEPLOYMENT_VERSION ?? '').trim()
  const creatorVaultBatcherRawCandidate =
    String(process.env.CREATOR_VAULT_BATCHER ?? '').trim() ||
    String(process.env.CREATOR_VAULT_BATCHER_AUTO_HANDOFF ?? '').trim() ||
    null

  const data: DeployConfigResponse = {
    creatorVaultBatcher: contracts.creatorVaultBatcher ?? null,
    creatorVaultBatcherConfigError:
      contracts.creatorVaultBatcher == null
        ? deploymentBatcherNotConfiguredMessage(creatorVaultBatcherRawCandidate)
        : null,
    deploymentVersion,
    allowApiContractOverrides: envBool('ALLOW_API_CONTRACT_OVERRIDES'),
    deployMode,
    serverContinue: envBool('VITE_DEPLOY_USE_SERVER_CONTINUE'),
    payoutRouterKeeperAddress: payoutRouterKeeperAddress ?? null,
    payoutRouterApprovedExternalSwapTargets: payoutRouterExternalApprovals.targets,
    payoutRouterApprovedExternalSwapSpenders: payoutRouterExternalApprovals.spenders,
    zoraToken: resolvePayoutRouterZoraToken(contracts.zora ?? null),
    payoutRouterZoraWethFee: payoutRouterFees.zoraWethFee,
    payoutRouterWethCreatorFee: payoutRouterFees.wethCreatorFee,
  }

  return res.status(200).json({ success: true, data } satisfies ApiEnvelope<DeployConfigResponse>)
}
