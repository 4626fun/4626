import type { KeeprConfigV1 } from './keeprRegistry.js'
import { mergeStrategyContracts, resolveStrategyProfile } from '../controlPlane/executors/strategyRegistry.js'

export function normalizeKeeprAddress(value: unknown): `0x${string}` | null {
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : ''
  return /^0x[a-f0-9]{40}$/.test(raw) ? (raw as `0x${string}`) : null
}

export function readKeeprString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

export class KeeprConfigBuildError extends Error {
  code: string

  constructor(message: string, code = 'keepr_config_build_failed') {
    super(message)
    this.code = code
  }
}

export function buildKeeprConfig(params: {
  vaultAddress: `0x${string}`
  chainId: number
  creatorAddress: `0x${string}`
  strategyVariant: string | null | undefined
  artifacts: Record<string, unknown>
  groupId: string
  agentInboxId?: string | null
}): KeeprConfigV1 {
  const profile = resolveStrategyProfile(params.strategyVariant)
  const shareTokenAddress =
    normalizeKeeprAddress(params.artifacts.shareToken) ??
    normalizeKeeprAddress(params.artifacts.shareTokenAddress) ??
    normalizeKeeprAddress(params.artifacts.shareOFT)
  const creatorCoinAddress =
    normalizeKeeprAddress(params.artifacts.creatorCoin) ??
    normalizeKeeprAddress(params.artifacts.creatorCoinAddress) ??
    normalizeKeeprAddress(params.artifacts.creatorToken)
  if (!creatorCoinAddress) {
    throw new KeeprConfigBuildError('creator_coin_address_missing', 'creator_coin_address_missing')
  }
  return {
    version: 1,
    chainId: params.chainId,
    vault: {
      vaultAddress: params.vaultAddress,
      creatorCoinAddress,
      canonicalOwnerAddress: params.creatorAddress,
      ...(shareTokenAddress ? { shareTokenAddress } : null),
    },
    xmtp: {
      groupId: params.groupId,
      ...(params.agentInboxId ? { agentInboxId: params.agentInboxId } : null),
    },
    gating: {
      enabled: true,
      joinLocked: false,
      mode: 'shares',
      thresholds: { minShares: '1' },
      failClosed: true,
    },
    roles: {
      owner: params.creatorAddress,
    },
    contracts: mergeStrategyContracts(profile, params.artifacts),
  }
}
