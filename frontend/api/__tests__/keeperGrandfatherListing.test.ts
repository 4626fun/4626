import { describe, expect, it } from 'vitest'

import {
  shouldAttemptGrandfatheredKeeperFallback,
  validateKeeperVaultListing,
} from '../../server/_lib/onchain/creatorRegistryVerification.js'
import { AKITA_DEFAULTS } from '../../src/config/contracts.defaults.js'

describe('shouldAttemptGrandfatheredKeeperFallback', () => {
  it('includes share_token_mismatch alongside inactive and vault_mismatch', () => {
    expect(shouldAttemptGrandfatheredKeeperFallback('creator_coin_inactive')).toBe(true)
    expect(shouldAttemptGrandfatheredKeeperFallback('vault_mismatch')).toBe(true)
    expect(shouldAttemptGrandfatheredKeeperFallback('share_token_mismatch')).toBe(true)
  })

  it('does not grandfather invalid_input or asset deployment failures', () => {
    expect(shouldAttemptGrandfatheredKeeperFallback('invalid_input')).toBe(false)
    expect(shouldAttemptGrandfatheredKeeperFallback('grandfathered_vault_not_deployed')).toBe(false)
    expect(shouldAttemptGrandfatheredKeeperFallback('grandfathered_vault_asset_mismatch')).toBe(false)
  })
})

describe('validateKeeperVaultListing', () => {
  it('accepts grandfathered AKITA vault via on-chain asset binding', async () => {
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

  it('accepts grandfathered AKITA when DB share column is a stale undeployed address', async () => {
    const listing = await validateKeeperVaultListing({
      creatorCoinAddress: AKITA_DEFAULTS.token,
      vaultAddress: AKITA_DEFAULTS.vault,
      // Deliberately wrong / empty slot — grandfather path must not require share bytecode.
      shareTokenAddress: '0x0000000000000000000000000000000000000001',
    })
    expect(listing.ok).toBe(true)
    if (listing.ok) {
      expect(listing.mode).toBe('grandfathered_onchain')
    }
  }, 30_000)
})
