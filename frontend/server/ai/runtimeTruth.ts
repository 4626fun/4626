export type TrustedDeploymentSource = 'app_state' | 'docs' | 'config' | 'api' | 'code'

export type AssistantRuntimeTruth = {
  isElizaConnected: boolean
  hasConversationMemory: boolean
  hasPersistentMemory: boolean
  hasVerifiedDeploymentFlow: boolean
  deploymentFlowSource: TrustedDeploymentSource | null
  deploymentFlowSummary: string | null
}

export type AssistantRuntimeTruthInput = Partial<AssistantRuntimeTruth>

export function resolveAssistantRuntimeTruth(input?: AssistantRuntimeTruthInput): AssistantRuntimeTruth {
  const verifiedDeployment = input?.hasVerifiedDeploymentFlow === true
  const deploymentFlowSummary =
    typeof input?.deploymentFlowSummary === 'string' && input.deploymentFlowSummary.trim()
      ? input.deploymentFlowSummary.trim()
      : null

  return {
    isElizaConnected: input?.isElizaConnected === true,
    hasConversationMemory: input?.hasConversationMemory === true,
    hasPersistentMemory: input?.hasPersistentMemory === true,
    hasVerifiedDeploymentFlow: verifiedDeployment && !!deploymentFlowSummary,
    deploymentFlowSource: verifiedDeployment ? (input?.deploymentFlowSource ?? 'app_state') : null,
    deploymentFlowSummary: verifiedDeployment ? deploymentFlowSummary : null,
  }
}

export function hasVerifiedMemoryContinuity(runtimeTruth: AssistantRuntimeTruth): boolean {
  return runtimeTruth.hasConversationMemory || runtimeTruth.hasPersistentMemory
}
