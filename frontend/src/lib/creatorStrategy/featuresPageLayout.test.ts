import { describe, expect, it } from 'vitest'

import {
  partitionCreatorStrategyCatalog,
  vanityTierLabel,
} from '@/lib/creatorStrategy/featuresPageLayout'
import type { CatalogDto } from '@/pages/CreatorStrategyFeatures.types'

function mockFeature(key: string): CatalogDto {
  return {
    key,
    displayName: key,
    tagline: '',
    description: '',
    priceUsdc: '0',
    priceUsdcDisplay: '$0',
    provisionerTag: '',
    requires: [],
    estimatedActivationWindow: '',
  }
}

describe('partitionCreatorStrategyCatalog', () => {
  it('groups vanity tiers and keeps strategies separate', () => {
    const catalog = [
      mockFeature('vault_full_deploy'),
      mockFeature('deploy_vanity_vault_prefix_len_2'),
      mockFeature('deploy_vanity_vault_prefix_len_1'),
      mockFeature('deploy_vanity_share_suffix_len_3'),
      mockFeature('deploy_vanity_share_suffix_len_1'),
    ]

    const { sections, vanityGroups } = partitionCreatorStrategyCatalog(catalog)

    expect(sections.map((s) => s.id)).toEqual(['deploy'])
    expect(sections[0]?.features.map((f) => f.key)).toEqual(['vault_full_deploy'])
    expect(vanityGroups.map((g) => g.id)).toEqual(['vault_prefix', 'share_suffix'])
    expect(vanityGroups[0]?.features.map((f) => f.key)).toEqual([
      'deploy_vanity_vault_prefix_len_1',
      'deploy_vanity_vault_prefix_len_2',
    ])
    expect(vanityGroups[1]?.features.map((f) => f.key)).toEqual([
      'deploy_vanity_share_suffix_len_1',
      'deploy_vanity_share_suffix_len_3',
    ])
  })
})

describe('vanityTierLabel', () => {
  it('formats hex length labels', () => {
    expect(vanityTierLabel(mockFeature('deploy_vanity_share_suffix_len_1'))).toBe('1 hex char')
    expect(vanityTierLabel(mockFeature('deploy_vanity_vault_prefix_len_4'))).toBe('4 hex chars')
  })
})
