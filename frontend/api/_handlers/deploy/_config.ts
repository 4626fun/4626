import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  type ApiEnvelope,
  handleOptions,
  readRequestPrincipalAddress,
  setCors,
  setNoStore,
  getApiContracts,
} from '@4626/server-core'


import {
  resolvePayoutRouterExternalSwapApprovals,
  resolvePayoutRouterFeeConfig,
  resolvePayoutRouterKeeperAddress,
  resolvePayoutRouterZoraToken,
} from '../../../server/_lib/onchain/payoutRouterRuntime.js'
import { deploymentBatcherNotConfiguredMessage } from '../../../server/_lib/onchain/deploymentBatcherConfigError.js'
import {
  resolveProtocolAjnaKeeperAddress,
  resolveProtocolAutomationAddress,
} from '../../../server/_lib/wallet/protocolTreasurySafe.js'
import { hexAddressOrNull, hexAddresses } from '../../../server/_lib/onchain/hexAddress.js'

declare const process: { env: Record<string, string | undefined> }

type DeployConfigResponse = {
  creatorVaultBatcher: `0x${string}` | null
  creatorVaultBatcherConfigError: string | null
  deploymentVersion: string
  allowApiContractOverrides: boolean
  deployMode: string
  serverContinue: boolean
  protocolAutomation: `0x${string}` | null
  protocolAjnaKeeper: `0x${string}` | null
  payoutRouterKeeperAddress: `0x${string}` | null
  payoutRouterApprovedExternalSwapTargets: `0x${string}`[]
  payoutRouterApprovedExternalSwapSpenders: `0x${string}`[]
  zoraToken: `0x${string}` | null
  payoutRouterZoraWethFee: number
  payoutRouterWethCreatorFee: number
  impairmentClaims: `0x${string}` | null
  impairmentRecoveryEscrow: `0x${string}` | null
  impairmentGuardian: `0x${string}` | null
  impairmentChallengeWindowSeconds: number | null
}

function envBool(key: string): boolean {
  const v = String(process.env[key] ?? '').trim().toLowerCase()
  return v === '1' || v === 'true' || v === 'yes'
}

function envPositiveInt(key: string): number | null {
  const raw = String(process.env[key] ?? '').trim()
  if (!raw) return null
  const parsed = Number(raw)
  if (!Number.isFinite(parsed) || parsed <= 0) return null
  return Math.floor(parsed)
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
    creatorVaultBatcher: hexAddressOrNull(contracts.creatorVaultBatcher ?? null),
    creatorVaultBatcherConfigError:
      contracts.creatorVaultBatcher == null
        ? deploymentBatcherNotConfiguredMessage(creatorVaultBatcherRawCandidate)
        : null,
    deploymentVersion,
    allowApiContractOverrides: envBool('ALLOW_API_CONTRACT_OVERRIDES'),
    deployMode,
    serverContinue: envBool('VITE_DEPLOY_USE_SERVER_CONTINUE'),
    protocolAutomation: hexAddressOrNull(resolveProtocolAutomationAddress()),
    protocolAjnaKeeper: hexAddressOrNull(resolveProtocolAjnaKeeperAddress()),
    payoutRouterKeeperAddress: hexAddressOrNull(payoutRouterKeeperAddress),
    payoutRouterApprovedExternalSwapTargets: hexAddresses(payoutRouterExternalApprovals.targets),
    payoutRouterApprovedExternalSwapSpenders: hexAddresses(payoutRouterExternalApprovals.spenders),
    zoraToken: hexAddressOrNull(resolvePayoutRouterZoraToken(contracts.zora ?? null)),
    payoutRouterZoraWethFee: payoutRouterFees.zoraWethFee,
    payoutRouterWethCreatorFee: payoutRouterFees.wethCreatorFee,
    impairmentClaims: hexAddressOrNull(contracts.impairmentClaims ?? null),
    impairmentRecoveryEscrow: hexAddressOrNull(contracts.impairmentRecoveryEscrow ?? null),
    impairmentGuardian: hexAddressOrNull(contracts.impairmentGuardian ?? null),
    impairmentChallengeWindowSeconds: envPositiveInt('IMPAIRMENT_CHALLENGE_WINDOW_SECONDS'),
  }

  return res.status(200).json({ success: true, data } satisfies ApiEnvelope<DeployConfigResponse>)
}
