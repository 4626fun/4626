/**
 * Decision-logic tests for vault-strategy-reallocator action.
 */

import { describe, expect, it } from 'vitest';
import {
  shouldRebalanceVaultState,
  type VaultStrategyAllocationState,
} from '../actions/vault-strategy-reallocator.action.js';

const VAULT = '0x1234567890123456789012345678901234567890' as const;
const CHARM = '0x1111111111111111111111111111111111111111' as const;
const AJNA = '0x2222222222222222222222222222222222222222' as const;

function createState(
  overrides: Partial<VaultStrategyAllocationState> = {},
): VaultStrategyAllocationState {
  return {
    vaultAddress: VAULT,
    coinBalance: 100n,
    deploymentThreshold: 50n,
    minimumTotalIdle: 100n,
    totalStrategyWeight: 9_000n,
    totalAssets: 1_000n,
    deployableBase: 900n,
    minIdle: 100n,
    defaultQueue: [CHARM, AJNA],
    useDefaultQueue: true,
    strategies: [
      { address: CHARM, weightBps: 4_500n, actualAssets: 810n, strategyDebt: 810n },
      { address: AJNA, weightBps: 4_500n, actualAssets: 90n, strategyDebt: 90n },
    ],
    isShutdown: false,
    paused: false,
    ...overrides,
  };
}

describe('shouldRebalanceVaultState', () => {
  it('returns true for legacy 90/10 drift above the default band', () => {
    expect(shouldRebalanceVaultState(createState(), 500n)).toBe(true);
  });

  it('returns false when drift is inside the configured band', () => {
    expect(
      shouldRebalanceVaultState(
        createState({
          strategies: [
            { address: CHARM, weightBps: 4_500n, actualAssets: 455n, strategyDebt: 455n },
            { address: AJNA, weightBps: 4_500n, actualAssets: 445n, strategyDebt: 445n },
          ],
        }),
        5_000n,
      ),
    ).toBe(false);
  });

  it('returns false for shutdown, paused, or single-strategy vaults', () => {
    expect(shouldRebalanceVaultState(createState({ isShutdown: true }))).toBe(false);
    expect(shouldRebalanceVaultState(createState({ paused: true }))).toBe(false);
    expect(
      shouldRebalanceVaultState(
        createState({
          strategies: [{ address: CHARM, weightBps: 9_000n, actualAssets: 900n, strategyDebt: 900n }],
        }),
      ),
    ).toBe(false);
  });

  it('returns true when excess idle can fund an underweight sleeve', () => {
    expect(
      shouldRebalanceVaultState(
        createState({
          coinBalance: 250n,
          strategies: [
            { address: CHARM, weightBps: 4_500n, actualAssets: 450n, strategyDebt: 450n },
            { address: AJNA, weightBps: 4_500n, actualAssets: 350n, strategyDebt: 350n },
          ],
        }),
        5_000n,
      ),
    ).toBe(true);
  });

  it('returns false when only underweight but no deployable idle exists', () => {
    expect(
      shouldRebalanceVaultState(
        createState({
          coinBalance: 100n,
          strategies: [
            { address: CHARM, weightBps: 4_500n, actualAssets: 460n, strategyDebt: 460n },
            { address: AJNA, weightBps: 4_500n, actualAssets: 440n, strategyDebt: 440n },
          ],
        }),
        5_000n,
      ),
    ).toBe(false);
  });
});
