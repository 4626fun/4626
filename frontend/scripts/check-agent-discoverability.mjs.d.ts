export type DiscoverabilityCheck = {
  id: string
  passed: boolean
  detail?: string
}

export type DiscoverabilitySummary = {
  agentId: number
  registryRef: string
  discoverabilityReady: boolean
  endpointUrl: string | null
  registrationMirrorUrl: string | null
  domainVerificationUrl: string | null
  failedChecks: DiscoverabilityCheck[]
}

export type DiscoverabilityValidationOptions = {
  expectedAgentId?: number | null
  expectedAgentRegistry?: string | null
  expectReady?: boolean
}

export function validateDiscoverabilityPayload(
  payload: unknown,
  options?: DiscoverabilityValidationOptions,
): DiscoverabilitySummary
