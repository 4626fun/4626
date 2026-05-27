/**
 * Unit tests for multi-pass rebalanceStrategies() orchestration.
 */

import { describe, expect, it, vi } from 'vitest';
import {
  buildAllocationPlan,
  parseMinDeviationBps,
  runRebalancePassLoop,
  type VaultStrategyAllocationState,
} from '../actions/vault-strategy-reallocator.action.js';
import { computeStrategyAllocationPlan } from '../utils/strategyAllocation.js';

const CHARM = '0x1111111111111111111111111111111111111111' as const;
const AJNA = '0x2222222222222222222222222222222222222222' as const;
const VAULT = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' as const;

function skewedState(charmAssets: bigint, ajnaAssets: bigint): VaultStrategyAllocationState {
  return {
    vaultAddress: VAULT,
    coinBalance: 100n,
    deploymentThreshold: 50n,
    minimumTotalIdle: 100n,
    totalStrategyWeight: 9_000n,
    totalAssets: charmAssets + ajnaAssets + 100n,
    deployableBase: charmAssets + ajnaAssets,
    minIdle: 100n,
    defaultQueue: [CHARM, AJNA],
    useDefaultQueue: true,
    strategies: [
      { address: CHARM, weightBps: 4_500n, actualAssets: charmAssets, strategyDebt: charmAssets },
      { address: AJNA, weightBps: 4_500n, actualAssets: ajnaAssets, strategyDebt: ajnaAssets },
    ],
    isShutdown: false,
    paused: false,
  };
}

describe('parseMinDeviationBps', () => {
  it('clamps invalid and out-of-range values', () => {
    expect(parseMinDeviationBps('750')).toBe(750n);
    expect(parseMinDeviationBps(-1)).toBe(500n);
    expect(parseMinDeviationBps(99_999)).toBe(10_000n);
  });
});

describe('runRebalancePassLoop', () => {
  it('converges after one successful pass when follow-up state is balanced', async () => {
    const write = vi.fn(async () => ({
      success: true as const,
      txHash: '0xabcabcabcabcabcabcabcabcabcabcabcabcabcabcabcabcabcabcabcabcabcab' as const,
    }));
    const readState = vi
      .fn()
      .mockResolvedValueOnce(skewedState(450n, 450n))
      .mockResolvedValueOnce(skewedState(450n, 450n));

    const result = await runRebalancePassLoop({
      initialState: skewedState(810n, 90n),
      minDeviationBps: 500n,
      maxPasses: 4,
      readState,
      write,
    });

    expect(write).toHaveBeenCalledTimes(1);
    expect(result.passesExecuted).toBe(1);
    expect(result.stopReason).toBe('converged');
    expect(result.finalMaxDriftBps).toBe(0n);
  });

  it('stops on write failure without losing prior pass count', async () => {
    const write = vi.fn(async () => ({
      success: false as const,
      txHash: '0x0000000000000000000000000000000000000000000000000000000000000000' as const,
      error: 'keeper_not_authorized',
    }));

    const result = await runRebalancePassLoop({
      initialState: skewedState(810n, 90n),
      minDeviationBps: 500n,
      maxPasses: 4,
      readState: async () => skewedState(810n, 90n),
      write,
    });

    expect(result.passesExecuted).toBe(0);
    expect(result.stopReason).toBe('write_failed');
    expect(result.error).toBe('keeper_not_authorized');
  });

  it('reports max_passes_with_drift when drift remains after max passes', async () => {
    const write = vi.fn(async () => ({
      success: true as const,
      txHash: '0xdefdefdefdefdefdefdefdefdefdefdefdefdefdefdefdefdefdefdefdefdefdef' as const,
    }));

    const result = await runRebalancePassLoop({
      initialState: skewedState(810n, 90n),
      minDeviationBps: 500n,
      maxPasses: 2,
      readState: async () => skewedState(810n, 90n),
      write,
    });

    expect(write).toHaveBeenCalledTimes(2);
    expect(result.passesExecuted).toBe(2);
    expect(result.stopReason).toBe('max_passes_with_drift');
    expect(result.finalMaxDriftBps).toBeGreaterThan(500n);
  });

  it('exposes buildAllocationPlan aligned with planner helper', () => {
    const state = skewedState(810n, 90n);
    const plan = buildAllocationPlan(state, 500n);
    const direct = computeStrategyAllocationPlan({
      strategies: state.strategies,
      coinBalance: state.coinBalance,
      minimumTotalIdle: state.minimumTotalIdle,
      deploymentThreshold: state.deploymentThreshold,
      totalStrategyWeight: state.totalStrategyWeight,
      minDeviationBps: 500n,
    });
    expect(plan).toEqual(direct);
  });
});
