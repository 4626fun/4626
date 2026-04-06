type Stage4Range2 = [number, number]
type Stage4Range3 = [number, number, number]

export type Stage4FanCardTiming = {
  opacity: Stage4Range2
  destination: Stage4Range2
}

export type VaultFlowStage4TimingPreset = {
  deployZ: Stage4Range3
  deployOpacity: Stage4Range2
  deployBlur: Stage4Range3
  deployTitle: Stage4Range2
  fanCards: [
    Stage4FanCardTiming,
    Stage4FanCardTiming,
    Stage4FanCardTiming,
    Stage4FanCardTiming,
  ]
}

export const MOBILE_STAGE4_TIMING: VaultFlowStage4TimingPreset = {
  deployZ: [0.75, 0.81, 1.0],
  deployOpacity: [0.75, 0.81],
  deployBlur: [0.75, 0.81, 1.0],
  deployTitle: [0.77, 0.83],
  fanCards: [
    { opacity: [0.80, 0.86], destination: [0.82, 0.88] },
    { opacity: [0.83, 0.89], destination: [0.85, 0.91] },
    { opacity: [0.86, 0.92], destination: [0.88, 0.94] },
    { opacity: [0.89, 0.95], destination: [0.91, 0.97] },
  ],
}

export const DESKTOP_STAGE4_TIMING: VaultFlowStage4TimingPreset = {
  deployZ: [0.74, 0.79, 1.0],
  deployOpacity: [0.74, 0.79],
  deployBlur: [0.74, 0.79, 1.0],
  deployTitle: [0.75, 0.80],
  fanCards: [
    { opacity: [0.77, 0.82], destination: [0.79, 0.84] },
    { opacity: [0.79, 0.84], destination: [0.81, 0.86] },
    { opacity: [0.81, 0.86], destination: [0.83, 0.88] },
    { opacity: [0.83, 0.88], destination: [0.85, 0.90] },
  ],
}

export const getVaultFlowStage4TimingPreset = (
  isDesktop: boolean,
): VaultFlowStage4TimingPreset =>
  isDesktop ? DESKTOP_STAGE4_TIMING : MOBILE_STAGE4_TIMING

