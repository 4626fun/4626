import type { CatalogDto } from '@/pages/CreatorStrategyFeatures.types'

export type StrategyFeatureSection = {
  id: 'deploy' | 'other'
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

const DEPLOY_BUNDLE_KEY = 'vault_full_deploy'

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
  const deploy: CatalogDto[] = []
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
    if (feature.key === DEPLOY_BUNDLE_KEY) {
      deploy.push(feature)
      continue
    }
    other.push(feature)
  }

  const sections: StrategyFeatureSection[] = []
  if (deploy.length > 0) {
    sections.push({
      id: 'deploy',
      title: 'Vault deploy',
      subtitle:
        'One $499 payment unlocks the full stack: Charm + Ajna on Base, Solana share bridge at finalize, and Meteora pool entitlement.',
      features: deploy,
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
