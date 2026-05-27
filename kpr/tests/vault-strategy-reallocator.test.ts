/**
 * Unit tests for cross-strategy allocation planning.
 */

import { describe, expect, it } from 'vitest';
import {
  computeDeployableBase,
  computeDriftBps,
  computeMaxDriftBps,
  computeMinIdle,
  computeStrategyAllocationPlan,
  computeTotalAssets,
  defaultWithdrawalQueueOrder,
  shouldRebalanceStrategies,
  sumSuggestedDeposits,
  sumSuggestedWithdrawals,
  type StrategyAllocationPlanInput,
} from '../utils/strategyAllocation.js';

const CHARM = '0x1111111111111111111111111111111111111111' as const;
const AJNA = '0x2222222222222222222222222222222222222222' as const;
const THIRD = '0x3333333333333333333333333333333333333333' as const;

const BASE_TWO_STRATEGY: Pick<
  StrategyAllocationPlanInput,
  'minimumTotalIdle' | 'deploymentThreshold' | 'totalStrategyWeight' | 'minDeviationBps'
> = {
  minimumTotalIdle: 100n,
  deploymentThreshold: 50n,
  totalStrategyWeight: 9_000n,
  minDeviationBps: 500n,
};

function twoStrategyInput(
  overrides: Partial<StrategyAllocationPlanInput> & {
    charmAssets: bigint;
    ajnaAssets: bigint;
    coinBalance?: bigint;
  },
): StrategyAllocationPlanInput {
  return {
    coinBalance: overrides.coinBalance ?? 100n,
    ...BASE_TWO_STRATEGY,
    minDeviationBps: overrides.minDeviationBps ?? BASE_TWO_STRATEGY.minDeviationBps,
    strategies: [
      {
        address: CHARM,
        weightBps: 4_500n,
        actualAssets: overrides.charmAssets,
        strategyDebt: overrides.charmAssets,
      },
      {
        address: AJNA,
        weightBps: 4_500n,
        actualAssets: overrides.ajnaAssets,
        strategyDebt: overrides.ajnaAssets,
      },
    ],
    ...overrides,
  };
}

describe('computeMinIdle', () => {
  it('uses the larger of minimumTotalIdle and deploymentThreshold', () => {
    expect(
      computeMinIdle({ minimumTotalIdle: 100n, deploymentThreshold: 50n }),
    ).toBe(100n);
    expect(
      computeMinIdle({ minimumTotalIdle: 50n, deploymentThreshold: 100n }),
    ).toBe(100n);
  });
});

describe('computeStrategyAllocationPlan', () => {
  it('marks overweight charm and underweight ajna after legacy 90/10 split', () => {
    const input = twoStrategyInput({ charmAssets: 810n, ajnaAssets: 90n });

    const plan = computeStrategyAllocationPlan(input);
    const charm = plan.find((row) => row.address === CHARM)!;
    const ajna = plan.find((row) => row.address === AJNA)!;

    expect(computeDeployableBase(input)).toBe(900n);
    expect(charm.targetAssets).toBe(450n);
    expect(ajna.targetAssets).toBe(450n);
    expect(charm.action).toBe('withdraw');
    expect(charm.suggestedMove).toBe(360n);
    expect(ajna.action).toBe('hold');
    expect(ajna.suggestedMove).toBe(0n);
    expect(shouldRebalanceStrategies(plan)).toBe(true);
    expect(sumSuggestedWithdrawals(plan)).toBe(360n);
    expect(sumSuggestedDeposits(plan)).toBe(0n);
  });

  it('holds when drift is inside the deviation band', () => {
    const plan = computeStrategyAllocationPlan(
      twoStrategyInput({
        charmAssets: 455n,
        ajnaAssets: 445n,
        minDeviationBps: 5_000n,
      }),
    );

    expect(plan.every((row) => row.action === 'hold')).toBe(true);
    expect(shouldRebalanceStrategies(plan)).toBe(false);
  });

  it('marks ajna overweight when charm is underweight (reverse skew)', () => {
    const plan = computeStrategyAllocationPlan(
      twoStrategyInput({ charmAssets: 90n, ajnaAssets: 810n }),
    );
    const charm = plan.find((row) => row.address === CHARM)!;
    const ajna = plan.find((row) => row.address === AJNA)!;

    expect(charm.action).toBe('hold');
    expect(ajna.action).toBe('withdraw');
    expect(ajna.suggestedMove).toBe(360n);
    expect(shouldRebalanceStrategies(plan)).toBe(true);
  });

  it('deposits from excess idle when ajna is underweight and charm is on target', () => {
    const plan = computeStrategyAllocationPlan(
      twoStrategyInput({
        coinBalance: 200n,
        charmAssets: 450n,
        ajnaAssets: 350n,
        minDeviationBps: 5_000n,
      }),
    );
    const charm = plan.find((row) => row.address === CHARM)!;
    const ajna = plan.find((row) => row.address === AJNA)!;

    expect(charm.action).toBe('hold');
    expect(ajna.action).toBe('deposit');
    expect(ajna.suggestedMove).toBe(100n);
    expect(shouldRebalanceStrategies(plan)).toBe(true);
  });

  it('deploys dual underweight sleeves when new idle raises targets', () => {
    const input = twoStrategyInput({
      coinBalance: 300n,
      charmAssets: 450n,
      ajnaAssets: 450n,
    });
    const plan = computeStrategyAllocationPlan(input);

    expect(plan.every((row) => row.action === 'deposit')).toBe(true);
    expect(sumSuggestedDeposits(plan)).toBe(200n);
    expect(shouldRebalanceStrategies(plan)).toBe(true);
  });

  it('returns hold rows when deployable base is zero', () => {
    const plan = computeStrategyAllocationPlan({
      coinBalance: 50n,
      minimumTotalIdle: 100n,
      deploymentThreshold: 50n,
      totalStrategyWeight: 9_000n,
      minDeviationBps: 500n,
      strategies: [
        { address: CHARM, weightBps: 4_500n, actualAssets: 0n, strategyDebt: 0n },
        { address: AJNA, weightBps: 4_500n, actualAssets: 0n, strategyDebt: 0n },
      ],
    });

    expect(plan.every((row) => row.action === 'hold')).toBe(true);
    expect(shouldRebalanceStrategies(plan)).toBe(false);
  });

  it('handles three-way 30/30/30 weights with charm-heavy drift', () => {
    const input: StrategyAllocationPlanInput = {
      coinBalance: 100n,
      minimumTotalIdle: 100n,
      deploymentThreshold: 50n,
      totalStrategyWeight: 9_000n,
      minDeviationBps: 500n,
      strategies: [
        { address: CHARM, weightBps: 3_000n, actualAssets: 600n, strategyDebt: 600n },
        { address: AJNA, weightBps: 3_000n, actualAssets: 200n, strategyDebt: 200n },
        { address: THIRD, weightBps: 3_000n, actualAssets: 100n, strategyDebt: 100n },
      ],
    };

    const plan = computeStrategyAllocationPlan(input);
    const charm = plan.find((row) => row.address === CHARM)!;
    const ajna = plan.find((row) => row.address === AJNA)!;
    const third = plan.find((row) => row.address === THIRD)!;

    expect(charm.targetAssets).toBe(300n);
    expect(charm.action).toBe('withdraw');
    expect(charm.suggestedMove).toBe(300n);
    expect(ajna.action).toBe('hold');
    expect(third.action).toBe('hold');
    expect(shouldRebalanceStrategies(plan)).toBe(true);
  });

  it('exact target match yields all hold actions', () => {
    const plan = computeStrategyAllocationPlan(
      twoStrategyInput({ charmAssets: 450n, ajnaAssets: 450n }),
    );

    expect(plan.every((row) => row.action === 'hold')).toBe(true);
    expect(shouldRebalanceStrategies(plan)).toBe(false);
  });
});

describe('computeDriftBps', () => {
  it('returns MAX_BPS when target is zero but actual is positive', () => {
    expect(computeDriftBps(0n, 100n)).toBe(10_000n);
  });

  it('returns zero when actual equals target', () => {
    expect(computeDriftBps(450n, 450n)).toBe(0n);
  });

  it('computes symmetric drift for underweight and overweight', () => {
    expect(computeDriftBps(450n, 495n)).toBe(1_000n);
    expect(computeDriftBps(450n, 405n)).toBe(1_000n);
  });
});

describe('computeMaxDriftBps', () => {
  it('returns the largest per-strategy drift in the plan', () => {
    const plan = computeStrategyAllocationPlan(
      twoStrategyInput({ charmAssets: 810n, ajnaAssets: 90n }),
    );
    expect(computeMaxDriftBps(plan)).toBeGreaterThan(500n);
  });

  it('returns zero when all strategies are on target', () => {
    const plan = computeStrategyAllocationPlan(
      twoStrategyInput({ charmAssets: 450n, ajnaAssets: 450n }),
    );
    expect(computeMaxDriftBps(plan)).toBe(0n);
  });
});

describe('defaultWithdrawalQueueOrder', () => {
  it('documents phase-3 charm-first queue order', () => {
    const resolved = defaultWithdrawalQueueOrder({
      charmStrategy: CHARM,
      ajnaStrategy: AJNA,
      defaultQueue: [CHARM, AJNA],
    });

    expect(resolved.queue).toEqual([CHARM, AJNA]);
    expect(resolved.redeemFirst).toBe(CHARM);
  });

  it('falls back to known strategy addresses when defaultQueue is empty', () => {
    const resolved = defaultWithdrawalQueueOrder({
      charmStrategy: CHARM,
      ajnaStrategy: AJNA,
      defaultQueue: [],
    });

    expect(resolved.queue).toEqual([CHARM, AJNA]);
    expect(resolved.notes.some((note) => note.includes('defaultQueue empty'))).toBe(true);
  });
});

describe('computeTotalAssets', () => {
  it('sums idle plus strategy NAV', () => {
    expect(
      computeTotalAssets({
        coinBalance: 100n,
        strategies: [
          { address: CHARM, weightBps: 4_500n, actualAssets: 450n, strategyDebt: 450n },
          { address: AJNA, weightBps: 4_500n, actualAssets: 450n, strategyDebt: 450n },
        ],
      }),
    ).toBe(1_000n);
  });
});

describe('parseMaxRebalancePasses', () => {
  it('defaults to 4 and clamps invalid values', async () => {
    const { parseMaxRebalancePasses } = await import('../actions/vault-strategy-reallocator.action.js');
    const original = process.env.VAULT_STRATEGY_REALLOC_MAX_PASSES;
    delete process.env.VAULT_STRATEGY_REALLOC_MAX_PASSES;
    expect(parseMaxRebalancePasses()).toBe(4);

    process.env.VAULT_STRATEGY_REALLOC_MAX_PASSES = '0';
    expect(parseMaxRebalancePasses()).toBe(4);

    process.env.VAULT_STRATEGY_REALLOC_MAX_PASSES = '6';
    expect(parseMaxRebalancePasses()).toBe(6);

    process.env.VAULT_STRATEGY_REALLOC_MAX_PASSES = '99';
    expect(parseMaxRebalancePasses()).toBe(8);

    if (original === undefined) delete process.env.VAULT_STRATEGY_REALLOC_MAX_PASSES;
    else process.env.VAULT_STRATEGY_REALLOC_MAX_PASSES = original;
  });
});
