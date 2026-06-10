import { describe, expect, it } from 'vitest'

import { validateCreatorRegistryBinding } from '../../server/_lib/onchain/creatorRegistryVerification.js'
import { AKITA_DEFAULTS } from '../../src/config/contracts.defaults.js'

describe('validateCreatorRegistryBinding', () => {
  it('reports AKITA as inactive in CreatorRegistry (grandfather handled by validateKeeperVaultListing)', async () => {
    const strict = await validateCreatorRegistryBinding({
      creatorCoinAddress: AKITA_DEFAULTS.token,
      vaultAddress: AKITA_DEFAULTS.vault,
      shareTokenAddress: AKITA_DEFAULTS.shareOFT,
    })
    expect(strict.ok).toBe(false)
    if (!strict.ok) {
      expect(strict.reason).toBe('creator_coin_inactive')
    }
  }, 30_000)
})
