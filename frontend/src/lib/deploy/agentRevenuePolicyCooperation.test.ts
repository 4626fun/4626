import { describe, expect, it, vi } from 'vitest'
import { getAddress, type Address } from 'viem'

import {
  canOfferAgentRevenuePolicyEnforcement,
  resolveAgentRevenuePolicyCooperation,
} from './agentRevenuePolicyCooperation'

const TOKEN = getAddress('0x1111111111111111111111111111111111111111')
const OWNER = getAddress('0x2222222222222222222222222222222222222222')
const ROUTER = getAddress('0x3333333333333333333333333333333333333333')
const OTHER = getAddress('0x4444444444444444444444444444444444444444')
const PAIR = getAddress('0x5555555555555555555555555555555555555555')

describe('agentRevenuePolicyCooperation', () => {
  it('does not offer enforcement merely because a policy controller exists', async () => {
    const publicClient = {
      readContract: vi.fn(async ({ functionName }: { functionName: string }) => {
        if (functionName === 'owner') return OTHER
        if (functionName === 'projectTaxRecipient') return OTHER
        if (functionName === 'taxAccountingAdapter') return OTHER
        throw new Error(`unexpected ${functionName}`)
      }),
    }

    const cooperation = await resolveAgentRevenuePolicyCooperation({
      publicClient,
      agentToken: TOKEN,
      deploySender: OWNER,
      expectedRevenueRouter: ROUTER,
      integration: {
        token: TOKEN,
        nativeAgentVault: OTHER,
        projectTaxRecipient: OTHER,
        taxAccountingAdapter: OTHER,
        pairToken: PAIR,
        uniswapV2Pair: PAIR,
      },
    })

    expect(cooperation.isAgentTokenV4).toBe(true)
    expect(cooperation.deploySenderCanEnforce).toBe(false)
    expect(canOfferAgentRevenuePolicyEnforcement(cooperation)).toBe(false)
    expect(cooperation.taxAdapterReadyToWire).toBe(false)
    expect(cooperation.readinessReason).toBe('deploy_sender_not_token_owner')
  })

  it('offers enforcement only when deploy sender owns the AgentTokenV4 and recipient differs', async () => {
    const publicClient = {
      readContract: vi.fn(async ({ functionName }: { functionName: string }) => {
        if (functionName === 'owner') return OWNER
        if (functionName === 'projectTaxRecipient') return OTHER
        if (functionName === 'taxAccountingAdapter') return OTHER
        throw new Error(`unexpected ${functionName}`)
      }),
    }

    const cooperation = await resolveAgentRevenuePolicyCooperation({
      publicClient,
      agentToken: TOKEN,
      deploySender: OWNER,
      expectedRevenueRouter: ROUTER,
      integration: {
        token: TOKEN,
        nativeAgentVault: OTHER as Address,
        projectTaxRecipient: OTHER,
        taxAccountingAdapter: OTHER,
        pairToken: PAIR,
        uniswapV2Pair: PAIR,
      },
    })

    expect(canOfferAgentRevenuePolicyEnforcement(cooperation)).toBe(true)
    expect(cooperation.readinessReason).toBe('ready_for_enforce_project_tax_recipient')
  })
})
