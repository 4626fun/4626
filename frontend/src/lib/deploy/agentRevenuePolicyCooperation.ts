import { getAddress, type Address } from 'viem'

import {
  AGENT_TOKEN_V4_READ_ABI,
  type AgentTokenIntegration,
} from '@/lib/onchain/agentTokenIntegration'
import {
  isAgentTokenV4Integration,
  resolveAgentTokenIntegration,
} from '@/lib/onchain/resolveAgentTokenIntegration'

const OWNABLE_OWNER_ABI = [
  {
    type: 'function',
    name: 'owner',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
] as const

export type AgentRevenuePolicyCooperation = {
  token: Address
  isAgentTokenV4: boolean
  tokenOwner: Address | null
  projectTaxRecipient: Address | null
  taxAccountingAdapter: Address | null
  /** True only when deploy sender is the token owner — required before offering enforce. */
  deploySenderCanEnforce: boolean
  /** True when recipient already points at the expected revenue router. */
  projectTaxRecipientMatchesRouter: boolean
  /** Adapter wiring is a separate Agent capability; never implied by policy deploy. */
  taxAdapterReadyToWire: boolean
  readinessReason: string
}

type PublicClientLike = {
  readContract: (args: {
    address: Address
    abi: readonly unknown[]
    functionName: string
    args?: readonly unknown[]
  }) => Promise<unknown>
  multicall?: (...args: never[]) => Promise<unknown>
}

function sameAddress(a: Address | null | undefined, b: Address | null | undefined): boolean {
  if (!a || !b) return false
  return getAddress(a) === getAddress(b)
}

/**
 * Fail-closed AgentTokenV4 cooperation preflight for AgentRevenuePolicyController.
 * Deploying the policy controller alone is never enough to claim enforcement readiness.
 */
export async function resolveAgentRevenuePolicyCooperation(params: {
  publicClient: PublicClientLike
  agentToken: Address
  deploySender: Address
  expectedRevenueRouter: Address
  integration: AgentTokenIntegration | null
}): Promise<AgentRevenuePolicyCooperation> {
  const token = getAddress(params.agentToken)
  const deploySender = getAddress(params.deploySender)
  const expectedRevenueRouter = getAddress(params.expectedRevenueRouter)
  let integration = params.integration
  if (!integration && typeof params.publicClient.multicall === 'function') {
    try {
      integration = await resolveAgentTokenIntegration(params.publicClient as never, token)
    } catch {
      integration = null
    }
  }
  const isAgentTokenV4 = isAgentTokenV4Integration(integration)

  let tokenOwner: Address | null = null
  try {
    const owner = (await params.publicClient.readContract({
      address: token,
      abi: OWNABLE_OWNER_ABI,
      functionName: 'owner',
    })) as Address
    tokenOwner = getAddress(owner)
  } catch {
    tokenOwner = null
  }

  let projectTaxRecipient: Address | null = integration?.projectTaxRecipient
    ? getAddress(integration.projectTaxRecipient)
    : null
  let taxAccountingAdapter: Address | null = integration?.taxAccountingAdapter
    ? getAddress(integration.taxAccountingAdapter)
    : null

  if (isAgentTokenV4) {
    try {
      const [recipient, adapter] = await Promise.all([
        params.publicClient.readContract({
          address: token,
          abi: AGENT_TOKEN_V4_READ_ABI,
          functionName: 'projectTaxRecipient',
        }) as Promise<Address>,
        params.publicClient.readContract({
          address: token,
          abi: AGENT_TOKEN_V4_READ_ABI,
          functionName: 'taxAccountingAdapter',
        }) as Promise<Address>,
      ])
      projectTaxRecipient = getAddress(recipient)
      taxAccountingAdapter = getAddress(adapter)
    } catch {
      // Keep integration snapshot values when live reads fail.
    }
  }

  const deploySenderCanEnforce = Boolean(tokenOwner && sameAddress(tokenOwner, deploySender))
  const projectTaxRecipientMatchesRouter = sameAddress(projectTaxRecipient, expectedRevenueRouter)
  // Tax adapter remains a separate typed Agent capability; do not auto-wire here.
  const taxAdapterReadyToWire = false

  let readinessReason: string
  if (!isAgentTokenV4) {
    readinessReason = 'token_not_agent_token_v4'
  } else if (!tokenOwner) {
    readinessReason = 'token_owner_unreadable'
  } else if (!deploySenderCanEnforce) {
    readinessReason = 'deploy_sender_not_token_owner'
  } else if (projectTaxRecipientMatchesRouter) {
    readinessReason = 'project_tax_recipient_already_router'
  } else {
    readinessReason = 'ready_for_enforce_project_tax_recipient'
  }

  return {
    token,
    isAgentTokenV4,
    tokenOwner,
    projectTaxRecipient,
    taxAccountingAdapter,
    deploySenderCanEnforce,
    projectTaxRecipientMatchesRouter,
    taxAdapterReadyToWire,
    readinessReason,
  }
}

export function canOfferAgentRevenuePolicyEnforcement(
  cooperation: AgentRevenuePolicyCooperation,
): boolean {
  return (
    cooperation.isAgentTokenV4 &&
    cooperation.deploySenderCanEnforce &&
    !cooperation.projectTaxRecipientMatchesRouter &&
    cooperation.readinessReason === 'ready_for_enforce_project_tax_recipient'
  )
}

export const AGENT_REVENUE_POLICY_ENFORCE_ABI = [
  {
    type: 'function',
    name: 'enforceProjectTaxRecipient',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
] as const
