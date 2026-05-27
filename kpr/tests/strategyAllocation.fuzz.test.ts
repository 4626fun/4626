/**
 * Property-style fuzz tests for cross-strategy allocation planning.
 */

import { describe, expect, it } from 'vitest';
import {
  computeDeployableBase,
  computeDriftBps,
  computeMinIdle,
  computeStrategyAllocationPlan,
  computeTotalAssets,
  shouldRebalanceStrategies,
  sumSuggestedDeposits,
  sumSuggestedWithdrawals,
  type StrategyAllocationPlanInput,
} from '../utils/strategyAllocation.js';

const CHARM = '0x1111111111111111111111111111111111111111' as const;
const AJNA = '0x2222222222222222222222222222222222222222' as const;

function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildRandomInput(rng: () => number, index: number): StrategyAllocationPlanInput {
  const coinBalance = BigInt(Math.floor(rng() * 500));
  const minimumTotalIdle = BigInt(Math.floor(rng() * 150));
  const deploymentThreshold = BigInt(Math.floor(rng() * 100));
  const minDeviationBps = BigInt(Math.floor(rng() * 10_001));
  const charmAssets = BigInt(Math.floor(rng() * 900) + index);
  const ajnaAssets = BigInt(Math.floor(rng() * 900) + index);

  return {
    coinBalance,
    minimumTotalIdle,
    deploymentThreshold,
    totalStrategyWeight: 9_000n,
    minDeviationBps,
    strategies: [
      { address: CHARM, weightBps: 4_500n, actualAssets: charmAssets, strategyDebt: charmAssets },
      { address: AJNA, weightBps: 4_500n, actualAssets: ajnaAssets, strategyDebt: ajnaAssets },
    ],
  };
}

describe('strategyAllocation fuzz properties', () => {
  it('keeps planner totals aligned with deployable base math', () => {
    const rng = mulberry32(0x4c42414e43);

    for (let i = 0; i < 250; i++) {
      const input = buildRandomInput(rng, i);
      const plan = computeStrategyAllocationPlan(input);
      const deployableBase = computeDeployableBase(input);
      const minIdle = computeMinIdle(input);
      const totalAssets = computeTotalAssets(input);

      expect(totalAssets).toBeGreaterThanOrEqual(minIdle);
      expect(deployableBase).toBe(totalAssets > minIdle ? totalAssets - minIdle : 0n);

      for (const row of plan) {
        expect(row.targetAssets).toBe((deployableBase * row.weightBps) / input.totalStrategyWeight);
        expect(row.driftBps).toBe(computeDriftBps(row.targetAssets, row.actualAssets));
        expect(row.suggestedMove).toBeGreaterThanOrEqual(0n);

        if (row.action === 'withdraw') {
          expect(row.driftAssets).toBeGreaterThan(0n);
          expect(row.suggestedMove).toBe(row.driftAssets);
        }

        if (row.action === 'deposit') {
          expect(row.driftAssets).toBeLessThan(0n);
          expect(row.suggestedMove).toBe(-row.driftAssets);
        }

        if (row.action === 'hold') {
          expect(row.suggestedMove).toBe(0n);
        }
      }
    }
  });

  it('never plans deposits without deployable idle', () => {
    const rng = mulberry32(1002);

    for (let i = 0; i < 250; i++) {
      const input = buildRandomInput(rng, i);
      const deployableIdle =
        input.coinBalance > computeMinIdle(input) ? input.coinBalance - computeMinIdle(input) : 0n;
      const plan = computeStrategyAllocationPlan(input);

      for (const row of plan) {
        if (row.action === 'deposit') {
          expect(deployableIdle).toBeGreaterThan(0n);
        }
      }
    }
  });

  it('matches shouldRebalanceStrategies to actionable rows', () => {
    const rng = mulberry32(0x51000001);

    for (let i = 0; i < 250; i++) {
      const input = buildRandomInput(rng, i);
      const plan = computeStrategyAllocationPlan(input);
      const actionable = plan.some((row) => row.suggestedMove > 0n);

      expect(shouldRebalanceStrategies(plan)).toBe(actionable);
    }
  });

  it('never plans more withdrawal than overweight excess above target', () => {
    const rng = mulberry32(0x5701);

    for (let i = 0; i < 250; i++) {
      const input = buildRandomInput(rng, i);
      const deployableBase = computeDeployableBase(input);
      if (deployableBase === 0n) continue;

      const plan = computeStrategyAllocationPlan(input);
      const target = (deployableBase * 4_500n) / 9_000n;

      for (const row of plan) {
        if (row.action !== 'withdraw') continue;
        const excess = row.actualAssets > target ? row.actualAssets - target : 0n;
        expect(row.suggestedMove).toBeLessThanOrEqual(excess);
      }
    }
  });

  it('keeps suggested deposit and withdraw sums finite under random skew', () => {
    const rng = mulberry32(1004);

    for (let i = 0; i < 250; i++) {
      const input = buildRandomInput(rng, i);
      const plan = computeStrategyAllocationPlan(input);
      const totalAssets = computeTotalAssets(input);

      expect(sumSuggestedWithdrawals(plan)).toBeLessThanOrEqual(totalAssets);
      expect(sumSuggestedDeposits(plan)).toBeLessThanOrEqual(totalAssets);
    }
  });
});
