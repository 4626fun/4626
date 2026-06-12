import { describe, expect, it } from 'vitest'

import {
  buildShareVanitySkipLogKey,
  deployTimelineProgressLabel,
  deriveDeployTimelineProgressState,
  isProviderCollisionErrorMessage,
  summarizeDeployTimelineProgress,
  shouldEmitShareVanitySkipLog,
} from './deployVaultSignals'
import { DEPLOY_TIMELINE_STAGE_INDEX, DEPLOY_TIMELINE_STAGES, type DeployTimelineStageId } from '@/features/deploy-vault/deploySteps'

describe('deploy vault signals', () => {
  it('normalizes provider collision error signatures', () => {
    expect(isProviderCollisionErrorMessage('Cannot redefine property: ethereum')).toBe(true)
    expect(
      isProviderCollisionErrorMessage(
        'Cannot set property ethereum of #<Window> which has only a getter',
      ),
    ).toBe(true)
    expect(
      isProviderCollisionErrorMessage(
        'MetaMask encountered an error setting the global Ethereum provider',
      ),
    ).toBe(true)
    expect(
      isProviderCollisionErrorMessage(
        'Failed to add embedded wallet connector: Wallet proxy not initialized',
      ),
    ).toBe(true)
    expect(isProviderCollisionErrorMessage('Deploy ownership mismatch')).toBe(false)
    expect(isProviderCollisionErrorMessage('')).toBe(false)
  })

  it('emits share vanity skip log only once per unique key', () => {
    const keyA = buildShareVanitySkipLogKey({
      batcher: '0xeB872AB8830f5cE71Dc710C0394A0F68524D6d68',
      suffix: '4626',
    })
    expect(shouldEmitShareVanitySkipLog({ lastKey: null, nextKey: keyA })).toBe(true)
    expect(shouldEmitShareVanitySkipLog({ lastKey: keyA, nextKey: keyA })).toBe(false)

    const keyB = buildShareVanitySkipLogKey({
      batcher: '0xA9D5A2A9D5A2A9D5A2A9D5A2A9D5A2A9D5A2B912',
      suffix: '4626',
    })
    expect(shouldEmitShareVanitySkipLog({ lastKey: keyA, nextKey: keyB })).toBe(true)
  })

  it('derives timeline chip labels for enabled, done, in-progress, pending, and disabled stages', () => {
    const isEnabled = (stage: DeployTimelineStageId) => stage !== 'phase2bOvaultMesh'

    const doneState = deriveDeployTimelineProgressState({
      stage: 'phase1Core',
      timelineCurrentStage: 'phase2Core',
      isDone: false,
      isStageEnabled: isEnabled,
      stageIndexMap: DEPLOY_TIMELINE_STAGE_INDEX,
    })
    expect(doneState).toBe('done')
    expect(deployTimelineProgressLabel(doneState)).toBe('complete')

    const inProgressState = deriveDeployTimelineProgressState({
      stage: 'phase2Core',
      timelineCurrentStage: 'phase2Core',
      isDone: false,
      isStageEnabled: isEnabled,
      stageIndexMap: DEPLOY_TIMELINE_STAGE_INDEX,
    })
    expect(inProgressState).toBe('inProgress')
    expect(deployTimelineProgressLabel(inProgressState)).toBe('in progress')

    const pendingState = deriveDeployTimelineProgressState({
      stage: 'phase4Launch',
      timelineCurrentStage: 'phase2Core',
      isDone: false,
      isStageEnabled: isEnabled,
      stageIndexMap: DEPLOY_TIMELINE_STAGE_INDEX,
    })
    expect(pendingState).toBe('pending')
    expect(deployTimelineProgressLabel(pendingState)).toBe('pending')

    const disabledState = deriveDeployTimelineProgressState({
      stage: 'phase2bOvaultMesh',
      timelineCurrentStage: 'phase2Core',
      isDone: false,
      isStageEnabled: isEnabled,
      stageIndexMap: DEPLOY_TIMELINE_STAGE_INDEX,
    })
    expect(disabledState).toBe('disabled')
    expect(deployTimelineProgressLabel(disabledState)).toBe('not enabled')
  })

  it('summarizes timeline counts used by the timeline header', () => {
    const isEnabled = (stage: DeployTimelineStageId) => stage !== 'phase2bOvaultMesh'
    const stateForStage = (stage: DeployTimelineStageId) =>
      deriveDeployTimelineProgressState({
        stage,
        timelineCurrentStage: 'phase2Core',
        isDone: false,
        isStageEnabled: isEnabled,
        stageIndexMap: DEPLOY_TIMELINE_STAGE_INDEX,
      })

    const summary = summarizeDeployTimelineProgress({
      stages: DEPLOY_TIMELINE_STAGES,
      isStageEnabled: isEnabled,
      stateForStage,
    })

    expect(summary).toEqual({
      enabledStageCount: 8,
      completedEnabledStageCount: 3,
      pendingStageCount: 4,
    })
  })
})

