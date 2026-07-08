import { describe, expect, it } from 'vitest'

import { validateRegistry4626Binding } from '../../server/_lib/onchain/registry4626Verification.js'
import { AKITA_DEFAULTS } from '../../src/config/contracts.defaults.js'

describe('validateRegistry4626Binding', () => {
  it('reports AKITA as inactive in Registry4626 (grandfather handled by validateKeeperVaultListing)', async () => {
    const strict = await validateRegistry4626Binding({
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
