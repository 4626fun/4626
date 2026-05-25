import { describe, expect, it } from 'vitest'

import {
  validateCreatorRegistryBinding,
  validateKeeperVaultListing,
} from '../../server/_lib/onchain/creatorRegistryVerification.js'
import { AKITA_DEFAULTS } from '../../src/config/contracts.defaults.js'

describe('validateKeeperVaultListing', () => {
  it('accepts grandfathered AKITA vault via on-chain asset binding', async () => {
    const strict = await validateCreatorRegistryBinding({
      creatorCoinAddress: AKITA_DEFAULTS.token,
      vaultAddress: AKITA_DEFAULTS.vault,
      shareTokenAddress: AKITA_DEFAULTS.shareOFT,
    })
    expect(strict.ok).toBe(false)
    if (strict.ok) return
    expect(strict.reason).toBe('creator_coin_inactive')

    const listing = await validateKeeperVaultListing({
      creatorCoinAddress: AKITA_DEFAULTS.token,
      vaultAddress: AKITA_DEFAULTS.vault,
      shareTokenAddress: AKITA_DEFAULTS.shareOFT,
    })
    expect(listing.ok).toBe(true)
    if (listing.ok) {
      expect(listing.mode).toBe('grandfathered_onchain')
    }
  }, 30_000)
})
