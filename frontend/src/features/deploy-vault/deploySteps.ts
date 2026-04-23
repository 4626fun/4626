export type DeployTimelineStageId =
  | 'setupOwnerApproval'
  | 'phase1Core'
  | 'phase1Finalize'
  | 'phase2Core'
  | 'phase2Finalize'
  | 'phase2bOvaultMesh'
  | 'phase3Strategies'
  | 'phase4Launch'
  | 'cleanup'

export const DEPLOY_TIMELINE_STAGES: ReadonlyArray<{
  id: DeployTimelineStageId
  label: string
  optional?: boolean
}> = [
  { id: 'setupOwnerApproval', label: 'Setup owner approval' },
  { id: 'phase1Core', label: 'Phase 1 core' },
  { id: 'phase1Finalize', label: 'Phase 1 finalize' },
  { id: 'phase2Core', label: 'Phase 2 core' },
  { id: 'phase2Finalize', label: 'Phase 2 finalize' },
  { id: 'phase2bOvaultMesh', label: 'Phase 2b ovault mesh', optional: true },
  { id: 'phase3Strategies', label: 'Phase 3 strategies' },
  { id: 'phase4Launch', label: 'Phase 4 launch' },
  { id: 'cleanup', label: 'Cleanup' },
]

export const DEPLOY_TIMELINE_STAGE_INDEX: Record<DeployTimelineStageId, number> =
  DEPLOY_TIMELINE_STAGES.reduce(
    (acc, stage, index) => ({ ...acc, [stage.id]: index }),
    {} as Record<DeployTimelineStageId, number>,
  )

export function timelineStageFromDeployStep(stepRaw: string): DeployTimelineStageId | null {
  const step = String(stepRaw ?? '').trim()
  if (!step) return null
  if (step === 'created') return 'setupOwnerApproval'
  if (step === 'phase1_sent' || step === 'phase1_confirmed') return 'phase1Core'
  if (step === 'phase1_finalize_sent' || step === 'phase1_finalize_confirmed') return 'phase1Finalize'
  if (step === 'phase2_core_sent' || step === 'phase2_core_confirmed') return 'phase2Core'
  if (
    step === 'phase2_sent' ||
    step === 'phase2_confirmed' ||
    step === 'phase2_finalize_sent' ||
    step === 'phase2_finalize_confirmed'
  ) {
    return 'phase2Finalize'
  }
  if (step === 'ovault_mesh_sent' || step === 'ovault_mesh_confirmed') return 'phase2bOvaultMesh'
  if (step === 'phase3_sent' || step === 'phase3_confirmed') return 'phase3Strategies'
  if (step === 'phase4_sent' || step === 'phase4_confirmed') return 'phase4Launch'
  if (step === 'cleanup_sent' || step === 'completed') return 'cleanup'
  return null
}

export function legacyPhaseFromTimelineStage(stage: DeployTimelineStageId): 'phase1' | 'phase2' | 'phase3' | 'phase4' {
  if (stage === 'phase1Core' || stage === 'phase1Finalize' || stage === 'setupOwnerApproval') return 'phase1'
  if (
    stage === 'phase2Core' ||
    stage === 'phase2Finalize' ||
    stage === 'phase2bOvaultMesh' ||
    stage === 'cleanup'
  ) {
    return 'phase2'
  }
  if (stage === 'phase3Strategies') return 'phase3'
  return 'phase4'
}

export function txSlotFromTimelineStage(stage: DeployTimelineStageId): 'tx1' | 'tx2' | 'tx3' | 'tx4' | null {
  if (stage === 'phase1Core' || stage === 'phase1Finalize') return 'tx1'
  if (
    stage === 'phase2Core' ||
    stage === 'phase2Finalize' ||
    stage === 'phase2bOvaultMesh' ||
    stage === 'cleanup'
  ) {
    return 'tx2'
  }
  if (stage === 'phase3Strategies') return 'tx3'
  if (stage === 'phase4Launch') return 'tx4'
  return null
}
