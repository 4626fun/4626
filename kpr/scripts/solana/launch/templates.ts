export type LaunchTier = 'small' | 'medium' | 'large';

export interface LaunchTemplate {
  allocationPercent: number;
  depthUsd: number;
  binStepBps: number;
  rangeBins: number;
  vaultCapUsd: number;
  vestingHours: number;
  topUpTriggerUsd: number;
}

export const LAUNCH_TEMPLATES: Record<LaunchTier, LaunchTemplate> = {
  small: {
    allocationPercent: 5,
    depthUsd: 25_000,
    binStepBps: 50,
    rangeBins: 30,
    vaultCapUsd: 25_000,
    vestingHours: 0,
    topUpTriggerUsd: 10_000,
  },
  medium: {
    allocationPercent: 10,
    depthUsd: 75_000,
    binStepBps: 25,
    rangeBins: 50,
    vaultCapUsd: 75_000,
    vestingHours: 12,
    topUpTriggerUsd: 25_000,
  },
  large: {
    allocationPercent: 15,
    depthUsd: 150_000,
    binStepBps: 10,
    rangeBins: 80,
    vaultCapUsd: 150_000,
    vestingHours: 24,
    topUpTriggerUsd: 50_000,
  },
};

export function getLaunchTemplate(tier: LaunchTier): LaunchTemplate {
  return LAUNCH_TEMPLATES[tier];
}
