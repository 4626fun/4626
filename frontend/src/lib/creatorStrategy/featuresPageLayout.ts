import type { CatalogDto } from '@/pages/CreatorStrategyFeatures.types'

export type StrategyFeatureSection = {
  id: 'strategies' | 'post_deploy' | 'other'
  title: string
  subtitle: string
  features: CatalogDto[]
}

export type VanityFeatureGroup = {
  id: 'vault_prefix' | 'share_suffix'
  title: string
  subtitle: string
  defaultNote: string
  features: CatalogDto[]
}

const STRATEGY_KEYS = new Set([
  'charm_active_lp',
  'ajna_sleeve',
  'solana_bridge_strategy',
  'solana_ovault_mesh',
])

const POST_DEPLOY_KEYS = new Set(['solana_meteora_alpha_vault'])

function vanityLength(key: string, prefix: string): number {
  const match = key.match(new RegExp(`^${prefix}(\\d+)$`))
  return match ? Number(match[1]) : 0
}

function sortVanity(features: CatalogDto[], prefix: string): CatalogDto[] {
  return [...features].sort(
    (a, b) => vanityLength(a.key, prefix) - vanityLength(b.key, prefix),
  )
}

export function partitionCreatorStrategyCatalog(catalog: CatalogDto[]): {
  sections: StrategyFeatureSection[]
  vanityGroups: VanityFeatureGroup[]
} {
  const strategies: CatalogDto[] = []
  const postDeploy: CatalogDto[] = []
  const other: CatalogDto[] = []
  const vaultPrefix: CatalogDto[] = []
  const shareSuffix: CatalogDto[] = []

  for (const feature of catalog) {
    if (feature.key.startsWith('deploy_vanity_vault_prefix_len_')) {
      vaultPrefix.push(feature)
      continue
    }
    if (feature.key.startsWith('deploy_vanity_share_suffix_len_')) {
      shareSuffix.push(feature)
      continue
    }
    if (STRATEGY_KEYS.has(feature.key)) {
      strategies.push(feature)
      continue
    }
    if (POST_DEPLOY_KEYS.has(feature.key)) {
      postDeploy.push(feature)
      continue
    }
    other.push(feature)
  }

  const sections: StrategyFeatureSection[] = []
  if (strategies.length > 0) {
    sections.push({
      id: 'strategies',
      title: 'Vault strategies',
      subtitle: 'Activate at least one before deploy. Each strategy receives a share of vault TVL at launch.',
      features: strategies,
    })
  }
  if (postDeploy.length > 0) {
    sections.push({
      id: 'post_deploy',
      title: 'Post-deploy add-ons',
      subtitle: 'Optional extras you can enable after the vault is live.',
      features: postDeploy,
    })
  }
  if (other.length > 0) {
    sections.push({
      id: 'other',
      title: 'Other features',
      subtitle: '',
      features: other,
    })
  }

  const vanityGroups: VanityFeatureGroup[] = []
  if (vaultPrefix.length > 0) {
    vanityGroups.push({
      id: 'vault_prefix',
      title: 'Vault address prefix',
      subtitle: 'Optional vanity for the vault contract address.',
      defaultNote: 'Default prefix 4626 is included for free — you only pay if you want a custom length.',
      features: sortVanity(vaultPrefix, 'deploy_vanity_vault_prefix_len_'),
    })
  }
  if (shareSuffix.length > 0) {
    vanityGroups.push({
      id: 'share_suffix',
      title: 'Share token suffix',
      subtitle: 'Optional vanity for the share token address ending.',
      defaultNote: 'Default suffix 4626 is included for free — pick a tier only if you want more custom hex characters.',
      features: sortVanity(shareSuffix, 'deploy_vanity_share_suffix_len_'),
    })
  }

  return { sections, vanityGroups }
}

export function vanityTierLabel(feature: CatalogDto): string {
  const vault = feature.key.match(/^deploy_vanity_vault_prefix_len_(\d+)$/)
  if (vault) {
    const n = Number(vault[1])
    return `${n} hex char${n === 1 ? '' : 's'}`
  }
  const share = feature.key.match(/^deploy_vanity_share_suffix_len_(\d+)$/)
  if (share) {
    const n = Number(share[1])
    return `${n} hex char${n === 1 ? '' : 's'}`
  }
  return feature.displayName
}
