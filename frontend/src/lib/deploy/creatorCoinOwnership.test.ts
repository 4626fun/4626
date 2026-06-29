import { describe, expect, it, vi } from 'vitest'
import { encodeFunctionData, type Address } from 'viem'
import { coinABI } from '@zoralabs/protocol-deployments'

import {
  encodeCreatorCoinAddOwnerCallData,
  planCreatorCoinPolicyControllerOwnershipGrant,
} from './creatorCoinOwnership'

const CREATOR_TOKEN = '0x5b674196812451b7cec024fe9d22d2c0b172fa75' as Address
const DEPLOY_SENDER = '0xAb6d5C10b03300326CD7fAb7267Ae192842967b5' as Address
const POLICY_CONTROLLER = '0x1111111111111111111111111111111111111111' as Address
const OTHER_OWNER = '0x2222222222222222222222222222222222222222' as Address

function mockPublicClient(handlers: {
  readContract?: (params: { functionName: string; args?: readonly unknown[] }) => Promise<unknown>
  call?: (params: { data: `0x${string}`; account: Address }) => Promise<unknown>
}) {
  return {
    readContract: vi.fn(async (params: { functionName: string; args?: readonly unknown[] }) => {
      if (handlers.readContract) return handlers.readContract(params)
      throw new Error(`unexpected readContract ${params.functionName}`)
    }),
    call: vi.fn(async (params: { data: `0x${string}`; account: Address }) => {
      if (handlers.call) return handlers.call(params)
      throw new Error('unexpected call')
    }),
  }
}

describe('planCreatorCoinPolicyControllerOwnershipGrant', () => {
  it('skips grant when policy controller is already a Zora coin owner', async () => {
    const publicClient = mockPublicClient({
      readContract: async (params) => {
        if (params.functionName === 'owners') return [DEPLOY_SENDER, POLICY_CONTROLLER]
        if (params.functionName === 'isOwner') {
          const account = params.args?.[0] as Address
          return account.toLowerCase() === POLICY_CONTROLLER.toLowerCase()
        }
        throw new Error(`unexpected read ${params.functionName}`)
      },
    })

    const plan = await planCreatorCoinPolicyControllerOwnershipGrant({
      publicClient: publicClient as Parameters<typeof planCreatorCoinPolicyControllerOwnershipGrant>[0]['publicClient'],
      creatorToken: CREATOR_TOKEN,
      deploySender: DEPLOY_SENDER,
      policyController: POLICY_CONTROLLER,
    })

    expect(plan.needsGrant).toBe(false)
    expect(plan.policyControllerIsOwner).toBe(true)
    expect(plan.grantMethod).toBeNull()
    expect(publicClient.call).not.toHaveBeenCalled()
  })

  it('queues addOwner when deploy sender is owner and simulation succeeds', async () => {
    const addOwnerCallData = encodeCreatorCoinAddOwnerCallData(POLICY_CONTROLLER)
    const publicClient = mockPublicClient({
      readContract: async (params) => {
        if (params.functionName === 'owners') return [DEPLOY_SENDER, OTHER_OWNER]
        if (params.functionName === 'isOwner') {
          const account = params.args?.[0] as Address
          return account.toLowerCase() === DEPLOY_SENDER.toLowerCase()
        }
        if (params.functionName === 'owner') throw new Error('no legacy owner')
        throw new Error(`unexpected read ${params.functionName}`)
      },
      call: async (params) => {
        if (params.data === addOwnerCallData && params.account === DEPLOY_SENDER) return { data: '0x' }
        throw new Error('simulation failed')
      },
    })

    const plan = await planCreatorCoinPolicyControllerOwnershipGrant({
      publicClient: publicClient as Parameters<typeof planCreatorCoinPolicyControllerOwnershipGrant>[0]['publicClient'],
      creatorToken: CREATOR_TOKEN,
      deploySender: DEPLOY_SENDER,
      policyController: POLICY_CONTROLLER,
    })

    expect(plan.needsGrant).toBe(true)
    expect(plan.grantMethod).toBe('addOwner')
    expect(plan.grantCallData).toBe(addOwnerCallData)
    expect(plan.deploySenderIsCoinOwner).toBe(true)
  })

  it('returns unresolved grant when deploy sender cannot add owner', async () => {
    const publicClient = mockPublicClient({
      readContract: async (params) => {
        if (params.functionName === 'owners') return [OTHER_OWNER]
        if (params.functionName === 'isOwner') return false
        if (params.functionName === 'owner') throw new Error('no legacy owner')
        throw new Error(`unexpected read ${params.functionName}`)
      },
      call: async () => {
        throw new Error('NotOwner')
      },
    })

    const plan = await planCreatorCoinPolicyControllerOwnershipGrant({
      publicClient: publicClient as Parameters<typeof planCreatorCoinPolicyControllerOwnershipGrant>[0]['publicClient'],
      creatorToken: CREATOR_TOKEN,
      deploySender: DEPLOY_SENDER,
      policyController: POLICY_CONTROLLER,
    })

    expect(plan.needsGrant).toBe(true)
    expect(plan.grantMethod).toBeNull()
    expect(plan.grantCallData).toBeNull()
    expect(plan.deploySenderIsCoinOwner).toBe(false)
  })
})

describe('encodeCreatorCoinAddOwnerCallData', () => {
  it('matches Zora coinABI addOwner selector', () => {
    const data = encodeCreatorCoinAddOwnerCallData(POLICY_CONTROLLER)
    const expected = encodeFunctionData({
      abi: coinABI,
      functionName: 'addOwner',
      args: [POLICY_CONTROLLER],
    })
    expect(data).toBe(expected)
    expect(data.startsWith('0x7065cb48')).toBe(true)
  })
})
