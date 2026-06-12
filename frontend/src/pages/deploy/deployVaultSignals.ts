import type { DeployTimelineStage, DeployTimelineStageId } from '@/features/deploy-vault/deploySteps'

export function isProviderCollisionErrorMessage(input: string | null | undefined): boolean {
  const lower = String(input ?? '').toLowerCase()
  if (!lower) return false
  return (
    lower.includes('cannot redefine property: ethereum') ||
    (lower.includes('cannot set property ethereum') && lower.includes('only a getter')) ||
    lower.includes('metamask encountered an error setting the global ethereum provider') ||
    lower.includes('failed to add embedded wallet connector: wallet proxy not initialized')
  )
}

export function buildShareVanitySkipLogKey(params: {
  batcher: string | null | undefined
  suffix: string | null | undefined
  reason?: string
}): string {
  const reason = params.reason ?? 'phase1_salt_overrides_not_supported'
  return `${String(params.batcher ?? '').toLowerCase()}:${String(params.suffix ?? '').toLowerCase()}:${reason}`
}

export function shouldEmitShareVanitySkipLog(params: {
  lastKey: string | null
  nextKey: string
}): boolean {
  return params.lastKey !== params.nextKey
}

export type DeployTimelineProgressState = 'disabled' | 'inProgress' | 'done' | 'pending'

export function deriveDeployTimelineProgressState(params: {
  stage: DeployTimelineStageId
  timelineCurrentStage: DeployTimelineStageId | null
  isDone: boolean
  isStageEnabled: (stage: DeployTimelineStageId) => boolean
  stageIndexMap: Record<DeployTimelineStageId, number>
}): DeployTimelineProgressState {
  if (!params.isStageEnabled(params.stage)) return 'disabled'
  const currentIndex = params.timelineCurrentStage ? params.stageIndexMap[params.timelineCurrentStage] : -1
  const stageIndex = params.stageIndexMap[params.stage]
  if (params.timelineCurrentStage === params.stage && !params.isDone) return 'inProgress'
  if (currentIndex >= stageIndex && currentIndex >= 0) return 'done'
  return 'pending'
}

export function deployTimelineProgressLabel(state: DeployTimelineProgressState): string {
  if (state === 'disabled') return 'not enabled'
  if (state === 'inProgress') return 'in progress'
  if (state === 'done') return 'complete'
  return 'pending'
}

export function summarizeDeployTimelineProgress(params: {
  stages: ReadonlyArray<DeployTimelineStage>
  isStageEnabled: (stage: DeployTimelineStageId) => boolean
  stateForStage: (stage: DeployTimelineStageId) => DeployTimelineProgressState
}): {
  enabledStageCount: number
  completedEnabledStageCount: number
  pendingStageCount: number
} {
  let enabledStageCount = 0
  let completedEnabledStageCount = 0
  let pendingStageCount = 0
  for (const stage of params.stages) {
    if (params.isStageEnabled(stage.id)) enabledStageCount += 1
    const state = params.stateForStage(stage.id)
    if (state === 'done' && params.isStageEnabled(stage.id)) completedEnabledStageCount += 1
    if (state === 'pending') pendingStageCount += 1
  }
  return { enabledStageCount, completedEnabledStageCount, pendingStageCount }
}

