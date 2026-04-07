import { describe, expect, it } from 'vitest'

import {
  buildAjnaEnqueueAction,
  getAjnaCanonicalEnqueueError,
  makeCooldownKey,
  makeDedupeKey,
  resolveAjnaWatchedVaultExecutionContext,
} from '../actions/strategy-signal-listener.action.js'

const CANONICAL_SMART_WALLET = '0x00000000000000000000000000000000000000bb' as `0x${string}`
const EMBEDDED_OWNER = '0x00000000000000000000000000000000000000cc' as `0x${string}`
const OTHER_ADMIN = '0x00000000000000000000000000000000000000dd' as `0x${string}`
const VAULT_ADDRESS = '0x0000000000000000000000000000000000000011' as `0x${string}`
const POOL_ADDRESS = '0x0000000000000000000000000000000000000022' as `0x${string}`
const ORACLE_ADDRESS = '0x0000000000000000000000000000000000000033' as `0x${string}`
const STRATEGY_ADDRESS = '0x0000000000000000000000000000000000000044' as `0x${string}`
const AUTH_ADDRESS = '0x0000000000000000000000000000000000000055' as `0x${string}`

function watchedVault(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    poolAddress: POOL_ADDRESS,
    vaultAddress: VAULT_ADDRESS,
    oracleAddress: ORACLE_ADDRESS,
    groupId: 'group-1',
    automation: {
      automationEnabled: true,
      automationScope: 'ajna_min_bucket_only',
      canonicalCswAddress: CANONICAL_SMART_WALLET,
      embeddedEoaAddress: EMBEDDED_OWNER,
      privyWalletId: 'wallet-canonical-owner',
    },
    ...overrides,
  }
}

describe('strategy signal listener keys', () => {
  it('builds normalized cooldown keys', () => {
    const out = makeCooldownKey({
      vaultAddress: '0xAbCd000000000000000000000000000000000001',
      strategyAddressOrPool: '0xEFab000000000000000000000000000000000002',
      actionType: 'strategy.ajna.rebucket',
    })
    expect(out).toBe(
      '0xabcd000000000000000000000000000000000001:0xefab000000000000000000000000000000000002:strategy.ajna.rebucket',
    )
  })

  it('builds dedupe keys using canonical schema', () => {
    const out = makeDedupeKey({
      vaultAddress: '0xABCD000000000000000000000000000000000001',
      strategyAddressOrPool: '0xEFAB000000000000000000000000000000000002',
      actionType: 'strategy.charm.rebalance',
      band: '123',
    })
    expect(out).toBe(
      'vault:0xabcd000000000000000000000000000000000001:strategy:0xefab000000000000000000000000000000000002:action:strategy.charm.rebalance:band:123',
    )
  })

  it('requires enabled canonical Ajna automation before enqueueing', () => {
    expect(resolveAjnaWatchedVaultExecutionContext(watchedVault({ automation: undefined }))).toBeNull()
    expect(
      resolveAjnaWatchedVaultExecutionContext(
        watchedVault({
          automation: {
            automationEnabled: true,
            automationScope: 'vault',
            canonicalCswAddress: CANONICAL_SMART_WALLET,
            embeddedEoaAddress: EMBEDDED_OWNER,
            privyWalletId: 'wallet-canonical-owner',
          },
        }),
      ),
    ).toBeNull()
  })

  it('hard-stops Ajna enqueue when auth admin is not the canonical smart wallet', () => {
    const error = getAjnaCanonicalEnqueueError({
      watched: watchedVault(),
      authAdmin: OTHER_ADMIN,
    })

    expect(error).toBe('canonical_sender_required:auth_admin_mismatch')
  })

  it('includes the canonical execution context in Ajna enqueue payloads', () => {
    const watched = watchedVault()
    const executionContext = resolveAjnaWatchedVaultExecutionContext(watched)

    expect(executionContext).not.toBeNull()

    const action = buildAjnaEnqueueAction({
      watched,
      strategyAddress: STRATEGY_ADDRESS,
      authAddress: AUTH_ADDRESS,
      currentBucket: 1000,
      suggestedBucket: 1500,
      steppedBucket: 1250,
      targetBucket: 1250,
      deviationBps: 1200,
      nowSeconds: 1_700_000_000,
      executionContext: executionContext!,
    })

    expect(action.executionContext).toEqual({
      smartWallet: CANONICAL_SMART_WALLET,
      ownerAddress: EMBEDDED_OWNER,
      privyWalletId: 'wallet-canonical-owner',
      version: '1',
    })
    expect(action.actionType).toBe('strategy.ajna.rebucket')
  })
})

