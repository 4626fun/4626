import { describe, expect, it, vi } from 'vitest'
import { encodeFunctionData, getAddress, parseAbi, type Address } from 'viem'

import {
  ALFACLUB_FRIEND_KEY,
  ROOM_1659_CREATOR_COIN,
  validateAlfaClubLpCalls,
} from './alfaclubLpPolicy'

const FACTORY = getAddress('0x1000000000000000000000000000000000000001')
const POOL = getAddress('0x2000000000000000000000000000000000000002')
const SENDER = getAddress('0x3000000000000000000000000000000000000003')
const OTHER = getAddress('0x4000000000000000000000000000000000000004')
const ZERO = getAddress('0x0000000000000000000000000000000000000000')

const FACTORY_ABI = parseAbi([
  'function createPoolWithInitialLiquidity(address creatorCoin, uint256 tokenId, uint256 keyAmount, uint256 creatorCoinAmount, address recipient) returns (address)',
])
const POOL_ABI = parseAbi([
  'function buyKeys(uint256 keyAmount, uint256 maxCreatorCoinAmount, address recipient) returns (uint256 creatorCoinAmountIn)',
])
const ERC20_ABI = parseAbi(['function approve(address spender, uint256 amount) returns (bool)'])
const ERC1155_ABI = parseAbi(['function setApprovalForAll(address operator, bool approved)'])

const env = {
  ALFA_CREATOR_KEY_LP_FACTORY: FACTORY,
  ALFACLUB_LP_CREATOR_COIN: ROOM_1659_CREATOR_COIN,
  ALFACLUB_LP_TOKEN_ID: '1659',
}

function createClient(overrides: Record<string, unknown> = {}) {
  return {
    readContract: vi.fn(async ({ functionName }: { functionName: string }) => {
      if (functionName in overrides) return overrides[functionName]
      switch (functionName) {
        case 'poolCreatorAllowed':
        case 'pairAllowed':
          return true
        case 'getPool':
          return ZERO
        case 'factory':
          return FACTORY
        case 'friendKey':
          return ALFACLUB_FRIEND_KEY
        case 'creatorCoin':
          return ROOM_1659_CREATOR_COIN
        case 'keyTokenId':
          return 1659n
        case 'quoteBuyKeys':
          return 1_000n
        default:
          throw new Error(`unexpected read: ${functionName}`)
      }
    }),
  }
}

function createCalls(params: { recipient?: Address; operator?: Address } = {}) {
  const recipient = params.recipient ?? SENDER
  const operator = params.operator ?? FACTORY
  return [
    {
      target: ROOM_1659_CREATOR_COIN,
      value: 0n,
      data: encodeFunctionData({
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [operator, 1_000n],
      }),
    },
    {
      target: ALFACLUB_FRIEND_KEY,
      value: 0n,
      data: encodeFunctionData({
        abi: ERC1155_ABI,
        functionName: 'setApprovalForAll',
        args: [operator, true],
      }),
    },
    {
      target: FACTORY,
      value: 0n,
      data: encodeFunctionData({
        abi: FACTORY_ABI,
        functionName: 'createPoolWithInitialLiquidity',
        args: [ROOM_1659_CREATOR_COIN, 1659n, 10n, 1_000n, recipient],
      }),
    },
  ]
}

describe('AlfaClub LP paymaster policy', () => {
  it('accepts the pinned create batch for the sender', async () => {
    const result = await validateAlfaClubLpCalls({
      calls: createCalls(),
      sender: SENDER,
      client: createClient(),
      env,
    })

    expect(result).toEqual({
      creatorCoin: ROOM_1659_CREATOR_COIN,
      tokenId: 1659n,
      pool: null,
    })
  })

  it('denies an unallowlisted pair', async () => {
    await expect(
      validateAlfaClubLpCalls({
        calls: createCalls(),
        sender: SENDER,
        client: createClient({ pairAllowed: false }),
        env,
      }),
    ).rejects.toThrow('alfaclub_lp_pair_not_allowed')
  })

  it('denies approvals for an unknown operator', async () => {
    await expect(
      validateAlfaClubLpCalls({
        calls: createCalls({ operator: OTHER }),
        sender: SENDER,
        client: createClient(),
        env,
      }),
    ).rejects.toThrow('alfaclub_lp_approval_spender_mismatch')
  })

  it('denies a recipient other than the parent CSW sender', async () => {
    await expect(
      validateAlfaClubLpCalls({
        calls: createCalls({ recipient: OTHER }),
        sender: SENDER,
        client: createClient(),
        env,
      }),
    ).rejects.toThrow('alfaclub_lp_recipient_mismatch')
  })

  it('accepts only a pool proven by the configured factory', async () => {
    const calls = [
      {
        target: ROOM_1659_CREATOR_COIN,
        value: 0n,
        data: encodeFunctionData({
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [POOL, 1_000n],
        }),
      },
      {
        target: POOL,
        value: 0n,
        data: encodeFunctionData({
          abi: POOL_ABI,
          functionName: 'buyKeys',
          args: [1n, 1_000n, SENDER],
        }),
      },
    ]

    await expect(
      validateAlfaClubLpCalls({
        calls,
        sender: SENDER,
        client: createClient({ getPool: OTHER }),
        env,
      }),
    ).rejects.toThrow('alfaclub_lp_pool_not_registered')

    const result = await validateAlfaClubLpCalls({
      calls,
      sender: SENDER,
      client: createClient({ getPool: POOL }),
      env,
    })
    expect(result?.pool).toBe(POOL)
  })

  it('denies excessive slippage even for a registered pool', async () => {
    const calls = [
      {
        target: POOL,
        value: 0n,
        data: encodeFunctionData({
          abi: POOL_ABI,
          functionName: 'buyKeys',
          args: [1n, 1_501n, SENDER],
        }),
      },
    ]

    await expect(
      validateAlfaClubLpCalls({
        calls,
        sender: SENDER,
        client: createClient({ getPool: POOL }),
        env,
      }),
    ).rejects.toThrow('alfaclub_lp_slippage_exceeds_policy')
  })
})
