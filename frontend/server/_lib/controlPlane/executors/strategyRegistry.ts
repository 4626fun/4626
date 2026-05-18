import type { KeeprConfigV1 } from '../../keepr/keeprRegistry.js'

export type StrategyVariant = 'default_strategy' | 'cca' | 'ajna' | 'charm' | (string & {})

export type StrategyProfile = {
  variant: string
  automationScope: string
  profileId: number
  contracts: KeeprConfigV1['contracts']
}

const STRATEGY_PROFILES: Record<string, StrategyProfile> = {
  default_strategy: {
    variant: 'default_strategy',
    automationScope: 'vault.standard',
    profileId: 1,
    contracts: {},
  },
  cca: {
    variant: 'cca',
    automationScope: 'vault.cca',
    profileId: 2,
    contracts: {},
  },
  ajna: {
    variant: 'ajna',
    automationScope: 'vault.ajna',
    profileId: 3,
    contracts: {},
  },
  charm: {
    variant: 'charm',
    automationScope: 'vault.charm',
    profileId: 4,
    contracts: {},
  },
}

export function resolveStrategyProfile(strategyVariant: string | null | undefined): StrategyProfile {
  const key = String(strategyVariant ?? 'default_strategy').trim().toLowerCase() || 'default_strategy'
  return STRATEGY_PROFILES[key] ?? STRATEGY_PROFILES.default_strategy
}

export function mergeStrategyContracts(
  profile: StrategyProfile,
  artifacts: Record<string, unknown>,
): KeeprConfigV1['contracts'] {
  const contracts = artifacts.contracts
  const source = contracts && typeof contracts === 'object' && !Array.isArray(contracts) ? contracts : artifacts
  const readAddress = (key: string): `0x${string}` | undefined => {
    const raw = typeof (source as Record<string, unknown>)[key] === 'string'
      ? String((source as Record<string, unknown>)[key]).trim().toLowerCase()
      : ''
    return /^0x[a-f0-9]{40}$/.test(raw) ? (raw as `0x${string}`) : undefined
  }
  return {
    ...profile.contracts,
    ccaStrategy: readAddress('ccaStrategy') ?? readAddress('ccaStrategyAddress'),
    ajnaAdapter: readAddress('ajnaAdapter') ?? readAddress('strategyAdapter'),
    ajnaInnerVault: readAddress('ajnaInnerVault') ?? readAddress('innerAjnaVault'),
    ajnaAuth: readAddress('ajnaAuth'),
    ajnaPool: readAddress('ajnaPool'),
    oracle: readAddress('oracle'),
    vrfHub: readAddress('vrfHub'),
  }
}
