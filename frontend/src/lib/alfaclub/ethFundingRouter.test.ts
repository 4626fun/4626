import { describe, expect, it } from 'vitest'
import { decodeFunctionData, encodeFunctionData, erc20Abi, getAddress } from 'viem'

import { ALFACLUB_UNIVERSAL_ROUTER_ABI } from './contracts'
import {
  buildAlfaClubEthFundingCalls,
  ZORA_BASE_UNIVERSAL_ROUTER,
  ZORA_NATIVE_ETH_TOKEN,
} from './ethFundingRouter'
import {
  encodeMinimalNativeEthFundingExecute,
  encodeMinimalWethFundingExecute,
} from './zoraFundingExecuteFixtures'

const SENDER = getAddress('0x1000000000000000000000000000000000000001')
const ROUTER = getAddress('0x2000000000000000000000000000000000000002')
const ADAPTER = getAddress('0x3000000000000000000000000000000000000003')
const PERMIT2 = getAddress('0x4000000000000000000000000000000000000004')
const FRIEND_KEY = getAddress('0x5000000000000000000000000000000000000005')
const PAIR = getAddress('0x6000000000000000000000000000000000000006')
const AKITA = getAddress('0x7000000000000000000000000000000000000007')

describe('buildAlfaClubEthFundingCalls', () => {
  it('places the native ETH funding call before Sudoswap approvals and buy', () => {
    const calls = buildAlfaClubEthFundingCalls({
      fundingSwap: {
        to: ZORA_BASE_UNIVERSAL_ROUTER,
        from: SENDER,
        data: encodeMinimalNativeEthFundingExecute({
          sender: SENDER,
          creatorCoin: AKITA,
          inputAmount: 1000000000000000n,
          amountOutMinimum: 250n,
        }),
        value: '1000000000000000',
        chainId: 8453,
      },
      expectedFundingInputAmount: 1000000000000000n,
      fundingOutputAmount: 250n,
      sender: SENDER,
      router: ROUTER,
      adapter: ADAPTER,
      permit2: PERMIT2,
      friendKey: FRIEND_KEY,
      creatorCoin: AKITA,
      pair: PAIR,
      keyAmount: 1n,
      buyLimit: 200n,
      deadline: 1_900_000_000n,
      erc20AllowanceToPermit2: 0n,
      permit2AllowanceToAdapter: { amount: 0n, expiration: 0n },
    })

    expect(calls[0]).toMatchObject({
      to: ZORA_BASE_UNIVERSAL_ROUTER,
      from: SENDER,
      value: '1000000000000000',
      chainId: 8453,
    })
    expect(calls.length).toBe(4)
    expect(calls.at(-1)?.to).toBe(ROUTER)
    const decoded = decodeFunctionData({
      abi: ALFACLUB_UNIVERSAL_ROUTER_ABI,
      data: calls.at(-1)!.data as `0x${string}`,
    })
    expect(decoded.functionName).toBe('execute')
  })

  it('fails closed when the quote cannot fund the Sudoswap limit', () => {
    expect(() =>
      buildAlfaClubEthFundingCalls({
        fundingSwap: {
          to: ZORA_BASE_UNIVERSAL_ROUTER,
          from: SENDER,
          data: encodeMinimalNativeEthFundingExecute({
            sender: SENDER,
            creatorCoin: AKITA,
            inputAmount: 1n,
            amountOutMinimum: 250n,
          }),
          value: '1',
          chainId: 8453,
        },
        expectedFundingInputAmount: 1n,
        fundingOutputAmount: 199n,
        sender: SENDER,
        router: ROUTER,
        adapter: ADAPTER,
        permit2: PERMIT2,
        friendKey: FRIEND_KEY,
        creatorCoin: AKITA,
        pair: PAIR,
        keyAmount: 1n,
        buyLimit: 200n,
        deadline: 1_900_000_000n,
      }),
    ).toThrow(/does not cover/i)
  })

  it('accepts the canonical WETH deposit and Permit2 approval before a zero-value Zora call', () => {
    const calls = buildAlfaClubEthFundingCalls({
      preparatoryCalls: [
        {
          to: getAddress('0x4200000000000000000000000000000000000006'),
          from: SENDER,
          data: '0xd0e30db0',
          value: '1000000000000000',
          chainId: 8453,
        },
        {
          to: getAddress('0x4200000000000000000000000000000000000006'),
          from: SENDER,
          data: encodeFunctionData({
            abi: erc20Abi,
            functionName: 'approve',
            args: [PERMIT2, 1000000000000000n],
          }),
          value: '0',
          chainId: 8453,
        },
      ],
      fundingSwap: {
        to: ZORA_BASE_UNIVERSAL_ROUTER,
        from: SENDER,
        data: encodeMinimalWethFundingExecute({
          sender: SENDER,
          creatorCoin: AKITA,
          inputAmount: 1000000000000000n,
          amountOutMinimum: 250n,
        }),
        value: '0',
        chainId: 8453,
      },
      expectedFundingInputAmount: 1000000000000000n,
      fundingOutputAmount: 250n,
      sender: SENDER,
      router: ROUTER,
      adapter: ADAPTER,
      permit2: PERMIT2,
      friendKey: FRIEND_KEY,
      creatorCoin: AKITA,
      pair: PAIR,
      keyAmount: 1n,
      buyLimit: 200n,
      deadline: 1_900_000_000n,
    })

    expect(calls).toHaveLength(6)
    expect(calls[0]?.data).toBe('0xd0e30db0')
    expect(calls[0]?.value).toBe('1000000000000000')
    expect(calls[1]?.to).toBe(getAddress('0x4200000000000000000000000000000000000006'))
    expect(calls[2]?.to).toBe(ZORA_BASE_UNIVERSAL_ROUTER)
    expect(calls[2]?.value).toBe('0')
  })

  it('rejects a non-Zora funding target or mismatched sender', () => {
    expect(() =>
      buildAlfaClubEthFundingCalls({
        fundingSwap: {
          to: ROUTER,
          from: SENDER,
          data: '0x1234',
          value: '1',
          chainId: 8453,
        },
        expectedFundingInputAmount: 1n,
        fundingOutputAmount: 200n,
        sender: SENDER,
        router: ROUTER,
        adapter: ADAPTER,
        permit2: PERMIT2,
        friendKey: FRIEND_KEY,
        creatorCoin: AKITA,
        pair: PAIR,
        keyAmount: 1n,
        buyLimit: 200n,
        deadline: 1_900_000_000n,
      }),
    ).toThrow(/approved Zora router/i)
  })

  it('rejects a native quote that spends more ETH than requested', () => {
    expect(() =>
      buildAlfaClubEthFundingCalls({
        fundingSwap: {
          to: ZORA_BASE_UNIVERSAL_ROUTER,
          from: SENDER,
          data: encodeMinimalNativeEthFundingExecute({
            sender: SENDER,
            creatorCoin: AKITA,
            inputAmount: 1000000000000000n,
            amountOutMinimum: 250n,
          }),
          value: '1000000000000000',
          chainId: 8453,
        },
        expectedFundingInputAmount: 10000000000000n,
        fundingOutputAmount: 250n,
        sender: SENDER,
        router: ROUTER,
        adapter: ADAPTER,
        permit2: PERMIT2,
        friendKey: FRIEND_KEY,
        creatorCoin: AKITA,
        pair: PAIR,
        keyAmount: 1n,
        buyLimit: 200n,
        deadline: 1_900_000_000n,
      }),
    ).toThrow(/input does not match the requested amount/i)
  })
})

  it('rejects when calldata min output is below the buy limit even if the quote amountOut covers it', () => {
    expect(() =>
      buildAlfaClubEthFundingCalls({
        fundingSwap: {
          to: ZORA_BASE_UNIVERSAL_ROUTER,
          from: SENDER,
          data: encodeMinimalNativeEthFundingExecute({
            sender: SENDER,
            creatorCoin: AKITA,
            inputAmount: 1n,
            amountOutMinimum: 150n,
          }),
          value: '1',
          chainId: 8453,
        },
        expectedFundingInputAmount: 1n,
        fundingOutputAmount: 250n,
        sender: SENDER,
        router: ROUTER,
        adapter: ADAPTER,
        permit2: PERMIT2,
        friendKey: FRIEND_KEY,
        creatorCoin: AKITA,
        pair: PAIR,
        keyAmount: 1n,
        buyLimit: 200n,
        deadline: 1_900_000_000n,
      }),
    ).toThrow(/guaranteed output does not cover/i)
  })


describe('ZORA_NATIVE_ETH_TOKEN', () => {
  it('is a full 20-byte native ETH sentinel accepted by viem', () => {
    expect(ZORA_NATIVE_ETH_TOKEN.toLowerCase()).toBe(
      '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    )
    expect(ZORA_NATIVE_ETH_TOKEN).toHaveLength(42)
    expect(() => getAddress(ZORA_NATIVE_ETH_TOKEN)).not.toThrow()
  })
})
