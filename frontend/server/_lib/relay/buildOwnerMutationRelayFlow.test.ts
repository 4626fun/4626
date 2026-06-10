import { describe, expect, it, afterEach, vi } from 'vitest'
import { encodeFunctionData, getAddress } from 'viem'

import {
  resolveRelayQuoteRequestAmount,
  selectOwnerMutationRelayUserCall,
  validateSelectedOwnerMutationRelayUserCall,
  buildOwnerMutationRelayFlow,
} from './buildOwnerMutationRelayFlow.js'
import { getRelayQuote } from './getQuote.js'
import {
  GOLDEN_RELAY_PART1_PROBE_CSW,
  MIN_OWNER_MUTATION_RELAY_DEPOSIT_WEI,
  RELAY_DEPOSITORY_ABI,
  RELAY_DEPOSITORY_BASE,
  RELAY_DEPOSITORY_NATIVE_DEPOSIT_SELECTOR,
} from '../../../src/lib/wallet/cswOwnerAbi.js'
import { CANONICAL_CSW_ADDRESS } from '../../../src/wallet/canonicalWalletPolicy.js'

vi.mock('./getQuote.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./getQuote.js')>()
  return { ...actual, getRelayQuote: vi.fn() }
})

const mockedGetRelayQuote = vi.mocked(getRelayQuote)

const ROUTER = '0xb92fe925dc43a0ecde6c8b1a2709c170ec4fff4f' as const

describe('resolveRelayQuoteRequestAmount', () => {
  const envKey = 'RELAY_TEST_QUOTE_REQUEST_AMOUNT'

  afterEach(() => {
    delete process.env[envKey]
  })

  it('defaults to destination tx value zero for Relay EXACT_OUTPUT quotes', () => {
    expect(
      resolveRelayQuoteRequestAmount({
        destinationTxValueWei: '0',
        envKey,
      }),
    ).toBe('0')
  })

  it('uses ops env override when configured', () => {
    process.env[envKey] = '12000000000000'
    expect(
      resolveRelayQuoteRequestAmount({
        destinationTxValueWei: '0',
        envKey,
      }),
    ).toBe('12000000000000')
  })
})

describe('selectOwnerMutationRelayUserCall', () => {
  const routerMulticallData =
    '0xcd6e13f7000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`

  const depositoryUserCall = {
    to: RELAY_DEPOSITORY_BASE,
    data: `${RELAY_DEPOSITORY_NATIVE_DEPOSIT_SELECTOR}${'0'.repeat(120)}` as `0x${string}`,
    value: '0x1129e6ffe3f8' as `0x${string}`,
  }

  it('prefers Depository depositNative for CSW self-auth (golden Part 1 shape)', () => {
    const selected = selectOwnerMutationRelayUserCall({
      userTransaction: {
        to: ROUTER,
        data: routerMulticallData,
        value: '18871666861048',
      },
      builtUserCallFromPaymentDetails: depositoryUserCall,
      preferDepositoryDepositNative: true,
    })

    expect(selected?.isDepositoryDepositNative).toBe(true)
    expect(selected?.userCall.to).toBe(RELAY_DEPOSITORY_BASE)
    expect(selected?.userCall.data.slice(0, 10)).toBe(RELAY_DEPOSITORY_NATIVE_DEPOSIT_SELECTOR)
    expect(selected?.userCall.value).toBe('0x1129e6ffe3f8')
  })

  it('never falls back to router multicall for CSW self-auth when depository call is missing', () => {
    const selected = selectOwnerMutationRelayUserCall({
      userTransaction: {
        to: ROUTER,
        data: routerMulticallData,
        value: '18871666861048',
      },
      builtUserCallFromPaymentDetails: null,
      preferDepositoryDepositNative: true,
    })

    expect(selected).toBeNull()
  })

  it('prefers router multicall for external EOA funders when fully funded', () => {
    const selected = selectOwnerMutationRelayUserCall({
      userTransaction: {
        to: ROUTER,
        data: routerMulticallData,
        value: '18871666861048',
      },
      builtUserCallFromPaymentDetails: depositoryUserCall,
      preferDepositoryDepositNative: false,
    })

    expect(selected?.isDepositoryDepositNative).toBe(false)
    expect(selected?.userCall.to).toBe(ROUTER)
    expect(selected?.userCall.value).toBe('0x1129e6ffe3f8')
  })

  it('rejects underfunded router multicall for external EOA funders', () => {
    const selected = selectOwnerMutationRelayUserCall({
      userTransaction: {
        to: ROUTER,
        data: routerMulticallData,
        value: '2880000000000',
      },
      builtUserCallFromPaymentDetails: depositoryUserCall,
      preferDepositoryDepositNative: false,
    })

    expect(selected).toBeNull()
  })
})

describe('validateSelectedOwnerMutationRelayUserCall', () => {
  const routerMulticallData =
    '0xcd6e13f7000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`

  const orderId =
    '0xb00755d1810713e0485fa287c8f5d326c5378de6149464662d186166c23b56f3' as const

  it('rejects underfunded deposits that match the broken 0xdfec2946 pattern', () => {
    const selected = selectOwnerMutationRelayUserCall({
      userTransaction: {
        to: ROUTER,
        data: `0xcd6e13f7${'0'.repeat(120)}${orderId.slice(2)}` as `0x${string}`,
        value: '2880000000000',
      },
      builtUserCallFromPaymentDetails: null,
      preferDepositoryDepositNative: false,
    })
    expect(selected).not.toBeNull()
    expect(
      validateSelectedOwnerMutationRelayUserCall({
        requestBoundDepositId: orderId,
        selected: selected!,
      }),
    ).toMatch(/below minimum/)
  })

  it('accepts golden-scale depository depositNative with bound order id and depositor', () => {
    const depositor = GOLDEN_RELAY_PART1_PROBE_CSW
    const depositData = encodeFunctionData({
      abi: RELAY_DEPOSITORY_ABI,
      functionName: 'depositNative',
      args: [depositor, orderId],
    })
    const selected = selectOwnerMutationRelayUserCall({
      userTransaction: {
        to: ROUTER,
        data: routerMulticallData,
        value: '18871666861048',
      },
      builtUserCallFromPaymentDetails: {
        to: RELAY_DEPOSITORY_BASE,
        data: depositData,
        value: '0x1129e6ffe3f8' as `0x${string}`,
      },
      preferDepositoryDepositNative: true,
    })
    expect(selected).not.toBeNull()
    expect(
      validateSelectedOwnerMutationRelayUserCall({
        requestBoundDepositId: orderId,
        selected: selected!,
        expectedDepositor: depositor,
      }),
    ).toBeNull()
  })

  it('rejects depository depositNative when depositor is not the funding CSW', () => {
    const wrongDepositor = '0x0000000000000000000000000000000000000001' as const
    const fundingCsw = getAddress(CANONICAL_CSW_ADDRESS) as `0x${string}`
    const depositData = encodeFunctionData({
      abi: RELAY_DEPOSITORY_ABI,
      functionName: 'depositNative',
      args: [wrongDepositor, orderId],
    })
    const selected = selectOwnerMutationRelayUserCall({
      userTransaction: {
        to: ROUTER,
        data: routerMulticallData,
        value: '18871666861048',
      },
      builtUserCallFromPaymentDetails: {
        to: RELAY_DEPOSITORY_BASE,
        data: depositData,
        value: '0x1129e6ffe3f8' as `0x${string}`,
      },
      preferDepositoryDepositNative: true,
    })
    expect(selected).not.toBeNull()
    expect(
      validateSelectedOwnerMutationRelayUserCall({
        requestBoundDepositId: orderId,
        selected: selected!,
        expectedDepositor: fundingCsw,
      }),
    ).toMatch(/depositor must be funding CSW/)
  })

  it('accepts golden-scale router multicall deposits with bound order id', () => {
    const selected = selectOwnerMutationRelayUserCall({
      userTransaction: {
        to: ROUTER,
        data: `0xcd6e13f7${'0'.repeat(120)}${orderId.slice(2)}` as `0x${string}`,
        value: '18871666861048',
      },
      builtUserCallFromPaymentDetails: null,
      preferDepositoryDepositNative: false,
    })
    expect(selected).not.toBeNull()
    expect(
      validateSelectedOwnerMutationRelayUserCall({
        requestBoundDepositId: orderId,
        selected: selected!,
      }),
    ).toBeNull()
  })

  it('rejects deposit below Relay paymentDetails.amount', () => {
    const selected = selectOwnerMutationRelayUserCall({
      userTransaction: {
        to: ROUTER,
        data: `0xcd6e13f7${'0'.repeat(120)}${orderId.slice(2)}` as `0x${string}`,
        value: '18828082080000',
      },
      builtUserCallFromPaymentDetails: null,
      preferDepositoryDepositNative: false,
    })
    expect(selected).not.toBeNull()
    expect(
      validateSelectedOwnerMutationRelayUserCall({
        requestBoundDepositId: orderId,
        selected: selected!,
        paymentDetailsAmountWei: '18871666861048',
      }),
    ).toMatch(/below Relay paymentDetails.amount/)
  })

  it('accepts runtime-scale deposits quoted by Relay paymentDetails', () => {
    const runtimeDeposit = '12000000000000'
    const selected = selectOwnerMutationRelayUserCall({
      userTransaction: {
        to: ROUTER,
        data: `0xcd6e13f7${'0'.repeat(120)}${orderId.slice(2)}` as `0x${string}`,
        value: runtimeDeposit,
      },
      builtUserCallFromPaymentDetails: null,
      preferDepositoryDepositNative: false,
    })
    expect(selected).not.toBeNull()
    expect(
      validateSelectedOwnerMutationRelayUserCall({
        requestBoundDepositId: orderId,
        selected: selected!,
        paymentDetailsAmountWei: runtimeDeposit,
      }),
    ).toBeNull()
  })
})

describe('buildOwnerMutationRelayFlow deposit re-quote', () => {
  const CSW = getAddress(CANONICAL_CSW_ADDRESS) as `0x${string}`
  const OWNER = '0xB2aaD65A5402714bf428a66731ae62BA5c45CAC0' as const
  const requestId = `0x${'aa'.repeat(32)}` as const
  afterEach(() => {
    mockedGetRelayQuote.mockReset()
  })

  it('re-quotes with clamped fees.gas seed when amount=0 quote has no deposit', async () => {
    const zeroQuoteFeesGas = '148913182984'
    const expectedDepositSeed = MIN_OWNER_MUTATION_RELAY_DEPOSIT_WEI.toString()
    const mutationCalldata = encodeFunctionData({
      abi: [
        {
          name: 'addOwnerAddress',
          type: 'function',
          stateMutability: 'nonpayable',
          inputs: [{ name: 'owner', type: 'address' }],
          outputs: [],
        },
      ],
      functionName: 'addOwnerAddress',
      args: [OWNER],
    })

    const zeroQuoteRaw = {
      steps: [
        {
          kind: 'transaction',
          requestId,
          items: [
            {
              data: {
                to: '0xb92fe925dc43a0ecde6c8b1a2709c170ec4fff4f',
                data: '0xcd6e13f7',
                value: '0',
                chainId: 8453,
              },
            },
          ],
        },
      ],
      details: {
        currencyIn: {
          amount: '0',
          currency: { address: '0x0000000000000000000000000000000000000000' },
        },
      },
      fees: {
        gas: {
          amount: zeroQuoteFeesGas,
          minimumAmount: zeroQuoteFeesGas,
        },
      },
    }

    const pricedQuoteRaw = {
      steps: [
        {
          kind: 'transaction',
          requestId,
          items: [
            {
              data: {
                to: '0xb92fe925dc43a0ecde6c8b1a2709c170ec4fff4f',
                data: '0xcd6e13f7',
                value: expectedDepositSeed,
                chainId: 8453,
              },
            },
          ],
        },
      ],
      details: {
        currencyIn: {
          amount: expectedDepositSeed,
          currency: { address: '0x0000000000000000000000000000000000000000' },
        },
      },
    }

    mockedGetRelayQuote
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        extract: (await import('./getQuote.js')).extractFromRelayQuoteResponse(zeroQuoteRaw),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        extract: (await import('./getQuote.js')).extractFromRelayQuoteResponse(pricedQuoteRaw),
      })

    const result = await buildOwnerMutationRelayFlow({
      publicClient: {
        estimateGas: async () => 120_000n,
        getBytecode: async () => '0x1234',
      },
      cswAddress: CSW,
      relayQuoteUser: CSW,
      mutationCalldata,
      relaySource: '4626-add-owner',
      requireDepositoryDepositNative: true,
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.relay.paymentDetails?.amount).toBe(expectedDepositSeed)
    expect(result.relay.userCall.to).toBe(RELAY_DEPOSITORY_BASE)
    expect(result.relay.userCall.data.slice(0, 10)).toBe(RELAY_DEPOSITORY_NATIVE_DEPOSIT_SELECTOR)
    expect(mockedGetRelayQuote).toHaveBeenCalledTimes(2)
    expect(mockedGetRelayQuote.mock.calls[1]?.[0]?.amount).toBe(expectedDepositSeed)
  })

  it('re-quotes with deposit-scale fees.gas as the native seed', async () => {
    const mutationCalldata = encodeFunctionData({
      abi: [
        {
          name: 'addOwnerAddress',
          type: 'function',
          stateMutability: 'nonpayable',
          inputs: [{ name: 'owner', type: 'address' }],
          outputs: [],
        },
      ],
      functionName: 'addOwnerAddress',
      args: [OWNER],
    })

    const modernFeesGas = '23728009023622'
    const expectedDepositSeed = modernFeesGas
    const requestIdModern = `0x${'bb'.repeat(32)}` as const

    const zeroQuoteRaw = {
      fees: { gas: { amount: modernFeesGas, minimumAmount: modernFeesGas } },
      details: {
        currencyIn: {
          amount: '0',
          currency: { address: '0x0000000000000000000000000000000000000000' },
        },
      },
    }

    const pricedQuoteRaw = {
      steps: [
        {
          kind: 'transaction',
          requestId: requestIdModern,
          items: [
            {
              data: {
                to: '0xb92fe925dc43a0ecde6c8b1a2709c170ec4fff4f',
                data: '0xcd6e13f7',
                value: expectedDepositSeed,
                chainId: 8453,
              },
            },
          ],
        },
      ],
      details: {
        currencyIn: {
          amount: expectedDepositSeed,
          currency: { address: '0x0000000000000000000000000000000000000000' },
        },
      },
    }

    mockedGetRelayQuote
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        extract: (await import('./getQuote.js')).extractFromRelayQuoteResponse(zeroQuoteRaw),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        extract: (await import('./getQuote.js')).extractFromRelayQuoteResponse(pricedQuoteRaw),
      })

    const result = await buildOwnerMutationRelayFlow({
      publicClient: {
        estimateGas: async () => 120_000n,
        getBytecode: async () => '0x1234',
      },
      cswAddress: CSW,
      relayQuoteUser: CSW,
      mutationCalldata,
      relaySource: '4626-add-owner',
      requireDepositoryDepositNative: true,
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.relay.paymentDetails?.amount).toBe(expectedDepositSeed)
    expect(mockedGetRelayQuote.mock.calls[1]?.[0]?.amount).toBe(expectedDepositSeed)
  })
})
