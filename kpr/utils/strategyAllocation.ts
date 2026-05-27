/**
 * Pure cross-strategy allocation planner for CreatorOVault.
 *
 * Mirrors on-chain rebalanceStrategies() math:
 *   deployableBase = totalAssets - minIdle
 *   target[strategy] = deployableBase * weight / totalStrategyWeight
 *   overweight when actual > target + target * minDeviationBps / 10_000
 */

export const MAX_BPS = 10_000n;

export type StrategyAllocationSnapshot = {
  address: `0x${string}`;
  weightBps: bigint;
  actualAssets: bigint;
  strategyDebt: bigint;
};

export type StrategyAllocationPlanInput = {
  strategies: StrategyAllocationSnapshot[];
  coinBalance: bigint;
  minimumTotalIdle: bigint;
  deploymentThreshold: bigint;
  totalStrategyWeight: bigint;
  minDeviationBps: bigint;
};

export type StrategyAllocationAction = 'withdraw' | 'deposit' | 'hold';

export type StrategyAllocationRow = {
  address: `0x${string}`;
  weightBps: bigint;
  targetAssets: bigint;
  actualAssets: bigint;
  driftAssets: bigint;
  driftBps: bigint;
  action: StrategyAllocationAction;
  suggestedMove: bigint;
};

export function computeMinIdle(input: Pick<StrategyAllocationPlanInput, 'minimumTotalIdle' | 'deploymentThreshold'>): bigint {
  return input.minimumTotalIdle > input.deploymentThreshold
    ? input.minimumTotalIdle
    : input.deploymentThreshold;
}

export function computeTotalAssets(
  input: Pick<StrategyAllocationPlanInput, 'coinBalance' | 'strategies'>,
): bigint {
  return input.strategies.reduce((sum, row) => sum + row.actualAssets, input.coinBalance);
}

export function computeDeployableBase(input: StrategyAllocationPlanInput): bigint {
  const minIdle = computeMinIdle(input);
  const totalAssets = computeTotalAssets(input);
  return totalAssets > minIdle ? totalAssets - minIdle : 0n;
}

export function computeDriftBps(targetAssets: bigint, actualAssets: bigint): bigint {
  if (targetAssets === 0n) {
    return actualAssets === 0n ? 0n : MAX_BPS;
  }
  const drift = actualAssets > targetAssets ? actualAssets - targetAssets : targetAssets - actualAssets;
  return (drift * MAX_BPS) / targetAssets;
}

export function computeStrategyAllocationPlan(input: StrategyAllocationPlanInput): StrategyAllocationRow[] {
  const deployableBase = computeDeployableBase(input);
  if (deployableBase === 0n || input.totalStrategyWeight === 0n) {
    return input.strategies.map((row) => ({
      address: row.address,
      weightBps: row.weightBps,
      targetAssets: 0n,
      actualAssets: row.actualAssets,
      driftAssets: 0n,
      driftBps: 0n,
      action: 'hold' as const,
      suggestedMove: 0n,
    }));
  }

  const deployableIdle =
    input.coinBalance > computeMinIdle(input) ? input.coinBalance - computeMinIdle(input) : 0n;

  return input.strategies.map((row) => {
    const targetAssets = (deployableBase * row.weightBps) / input.totalStrategyWeight;
    const driftAssets = row.actualAssets - targetAssets;
    const driftBps = computeDriftBps(targetAssets, row.actualAssets);
    const driftThreshold =
      targetAssets > 0n ? (targetAssets * input.minDeviationBps) / MAX_BPS : 0n;

    if (driftAssets > 0n) {
      if (driftAssets <= driftThreshold) {
        return {
          address: row.address,
          weightBps: row.weightBps,
          targetAssets,
          actualAssets: row.actualAssets,
          driftAssets,
          driftBps,
          action: 'hold' as const,
          suggestedMove: 0n,
        };
      }
      return {
        address: row.address,
        weightBps: row.weightBps,
        targetAssets,
        actualAssets: row.actualAssets,
        driftAssets,
        driftBps,
        action: 'withdraw' as const,
        suggestedMove: driftAssets,
      };
    }

    if (driftAssets < 0n) {
      const deficit = -driftAssets;
      // On-chain redeploy only runs when idle exceeds minIdle; no deviation band on deposit.
      if (deployableIdle === 0n || deficit === 0n) {
        return {
          address: row.address,
          weightBps: row.weightBps,
          targetAssets,
          actualAssets: row.actualAssets,
          driftAssets,
          driftBps,
          action: 'hold' as const,
          suggestedMove: 0n,
        };
      }
      return {
        address: row.address,
        weightBps: row.weightBps,
        targetAssets,
        actualAssets: row.actualAssets,
        driftAssets,
        driftBps,
        action: 'deposit' as const,
        suggestedMove: deficit,
      };
    }

    return {
      address: row.address,
      weightBps: row.weightBps,
      targetAssets,
      actualAssets: row.actualAssets,
      driftAssets,
      driftBps,
      action: 'hold' as const,
      suggestedMove: 0n,
    };
  });
}

export function shouldRebalanceStrategies(plan: StrategyAllocationRow[]): boolean {
  return plan.some(
    (row) =>
      (row.action === 'withdraw' && row.suggestedMove > 0n) ||
      (row.action === 'deposit' && row.suggestedMove > 0n),
  );
}

export function sumSuggestedWithdrawals(plan: StrategyAllocationRow[]): bigint {
  return plan.reduce(
    (sum, row) => (row.action === 'withdraw' ? sum + row.suggestedMove : sum),
    0n,
  );
}

export function sumSuggestedDeposits(plan: StrategyAllocationRow[]): bigint {
  return plan.reduce(
    (sum, row) => (row.action === 'deposit' ? sum + row.suggestedMove : sum),
    0n,
  );
}

export function defaultWithdrawalQueueOrder(params: {
  charmStrategy?: `0x${string}` | null;
  ajnaStrategy?: `0x${string}` | null;
  defaultQueue: `0x${string}`[];
}): {
  queue: `0x${string}`[];
  redeemFirst: `0x${string}` | null;
  notes: string[];
} {
  const notes: string[] = [
    'Phase 3 deploy calls addStrategy(charm) before addStrategy(ajna); both append to defaultQueue.',
    'User redeems walk defaultQueue when useDefaultQueue=true, otherwise strategyList (same add order by default).',
  ];

  if (params.defaultQueue.length > 0) {
    return {
      queue: params.defaultQueue,
      redeemFirst: params.defaultQueue[0] ?? null,
      notes,
    };
  }

  const fallback = [params.charmStrategy, params.ajnaStrategy].filter(Boolean) as `0x${string}`[];
  return {
    queue: fallback,
    redeemFirst: fallback[0] ?? null,
    notes: [...notes, 'defaultQueue empty — fallback to known strategy addresses'],
  };
}
