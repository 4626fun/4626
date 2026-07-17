import { beforeEach, describe, expect, it } from 'vitest'
import { encodeFunctionData } from 'viem'

import {
  DeploySessionRequestError,
  type Call,
  resolveRolePolicyIdForSession,
  normalizePhase2RolePolicyCalls,
  validatePhase2RolePolicyInput,
} from '../_handlers/deploy/v2/session/_createCore.ts'

const PHASE2_CORE_ABI = [
  {
    type: 'function',
    name: 'deployPhase2CoreWithRolePolicy',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        components: [
          { name: 'creatorToken', type: 'address' },
          { name: 'owner', type: 'address' },
          { name: 'creatorTreasury', type: 'address' },
          { name: 'payoutRecipient', type: 'address' },
          { name: 'vault', type: 'address' },
          { name: 'wrapper', type: 'address' },
          { name: 'shareOFT', type: 'address' },
          { name: 'shareSymbol', type: 'string' },
          { name: 'version', type: 'string' },
          { name: 'floorPriceQ96', type: 'uint256' },
        ],
      },
      {
        name: 'codeIds',
        type: 'tuple',
        components: [
          { name: 'vault', type: 'bytes32' },
          { name: 'wrapper', type: 'bytes32' },
          { name: 'shareOFT', type: 'bytes32' },
          { name: 'gauge', type: 'bytes32' },
          { name: 'cca', type: 'bytes32' },
          { name: 'oracle', type: 'bytes32' },
          { name: 'oftBootstrap', type: 'bytes32' },
        ],
      },
      { name: 'rolePolicyId', type: 'uint256' },
    ],
    outputs: [],
  },
] as const

const ADDR = {
  creator: '0x1111111111111111111111111111111111111111',
  owner: '0x2222222222222222222222222222222222222222',
  vault: '0x3333333333333333333333333333333333333333',
  wrapper: '0x4444444444444444444444444444444444444444',
  shareOFT: '0x5555555555555555555555555555555555555555',
} as const

function makePhase2CoreWithRolePolicyCall(rolePolicyId: bigint): Call {
  return {
    to: ADDR.owner,
    value: '0',
    data: encodeFunctionData({
      abi: PHASE2_CORE_ABI,
      functionName: 'deployPhase2CoreWithRolePolicy',
      args: [
        {
          creatorToken: ADDR.creator,
          owner: ADDR.owner,
          creatorTreasury: '0x0000000000000000000000000000000000000000',
          payoutRecipient: '0x0000000000000000000000000000000000000000',
          vault: ADDR.vault,
          wrapper: ADDR.wrapper,
          shareOFT: ADDR.shareOFT,
          shareSymbol: '4626',
          version: 'v1',
          floorPriceQ96: 0n,
        },
        {
          vault: `0x${'11'.repeat(32)}`,
          wrapper: `0x${'22'.repeat(32)}`,
          shareOFT: `0x${'33'.repeat(32)}`,
          gauge: `0x${'44'.repeat(32)}`,
          cca: `0x${'55'.repeat(32)}`,
          oracle: `0x${'66'.repeat(32)}`,
          oftBootstrap: `0x${'77'.repeat(32)}`,
        },
        rolePolicyId,
      ],
    }),
  }
}

describe('deploy session create role policy validation', () => {
  beforeEach(() => {
    delete process.env.DEPLOY_DEFAULT_ROLE_POLICY_ID
    delete process.env.DEPLOY_ROLE_POLICY_BY_CREATOR_JSON
  })

  it('accepts consistent role policy ids', () => {
    expect(() =>
      validatePhase2RolePolicyInput({
        phase2CoreCalls: [makePhase2CoreWithRolePolicyCall(7n)],
        requestedRolePolicyId: 7n,
      }),
    ).not.toThrow()
  })

  it('rejects mismatched requested role policy id', () => {
    expect(() =>
      validatePhase2RolePolicyInput({
        phase2CoreCalls: [makePhase2CoreWithRolePolicyCall(7n)],
        requestedRolePolicyId: 8n,
      }),
    ).toThrow(DeploySessionRequestError)
  })

  it('rejects mixed role policy ids across calls', () => {
    expect(() =>
      validatePhase2RolePolicyInput({
        phase2CoreCalls: [makePhase2CoreWithRolePolicyCall(5n), makePhase2CoreWithRolePolicyCall(6n)],
        requestedRolePolicyId: null,
      }),
    ).toThrow(DeploySessionRequestError)
  })

  it('rejects out-of-range role policy ids', () => {
    expect(() =>
      validatePhase2RolePolicyInput({
        phase2CoreCalls: [makePhase2CoreWithRolePolicyCall(70_000n)],
        requestedRolePolicyId: null,
      }),
    ).toThrow(DeploySessionRequestError)
  })

  it('resolves explicit requested role policy over defaults', () => {
    process.env.DEPLOY_DEFAULT_ROLE_POLICY_ID = '12'
    process.env.DEPLOY_ROLE_POLICY_BY_CREATOR_JSON = JSON.stringify({
      [ADDR.creator.toLowerCase()]: '9',
    })
    const resolved = resolveRolePolicyIdForSession({
      creatorToken: ADDR.creator,
      requestedRolePolicyId: 7n,
    })
    expect(resolved).toEqual({
      rolePolicyId: 7n,
      source: 'request',
    })
  })

  it('resolves creator default role policy when request omitted', () => {
    process.env.DEPLOY_DEFAULT_ROLE_POLICY_ID = ''
    process.env.DEPLOY_ROLE_POLICY_BY_CREATOR_JSON = JSON.stringify({
      [ADDR.creator.toLowerCase()]: '9',
    })
    const resolved = resolveRolePolicyIdForSession({
      creatorToken: ADDR.creator,
      requestedRolePolicyId: null,
    })
    expect(resolved).toEqual({
      rolePolicyId: 9n,
      source: 'creator_default',
    })
  })

  it('normalizes phase2 calls to role-policy variant when activated', () => {
    const input = [makePhase2CoreWithRolePolicyCall(0n)]
    const normalized = normalizePhase2RolePolicyCalls({
      phase2CoreCalls: input,
      rolePolicyId: 15n,
    })
    expect(normalized.rewrote).toBe(true)
    expect(() =>
      validatePhase2RolePolicyInput({
        phase2CoreCalls: normalized.phase2CoreCalls,
        requestedRolePolicyId: 15n,
      }),
    ).not.toThrow()
  })
})
