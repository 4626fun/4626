import { encodeFunctionData } from 'viem'

import { RELAY_DEPOSITORY_BASE } from '../../../src/lib/wallet/cswOwnerAbi.js'
import { getRelayQuote } from './getQuote.js'

const DEFAULT_RELAY_QUOTE_GAS_LIMIT = 250_000n
const RELAY_QUOTE_MIN_GAS_LIMIT = 80_000n
const RELAY_QUOTE_OUTPUT_MULTIPLIER = 6n
const NATIVE_CURRENCY = '0x0000000000000000000000000000000000000000' as const
const RELAY_ROUTER_MULTICALL_SELECTOR = '0xcd6e13f7'

export type OwnerMutationRelayFlow = {
  requestId: `0x${string}`
  orderId: `0x${string}` | null
  paymentDetails: {
    chainId: number | null
    depository: `0x${string}`
    currency: `0x${string}`
    amount: string
  } | null
  userCall: {
    to: `0x${string}`
    data: `0x${string}`
    value: `0x${string}`
  }
  userCallSource: 'quote_tx' | 'built_from_payment_details'
  feeUsd: string | null
}

export type OwnerMutationRelayQuoteDiagnostics = {
  requestId: `0x${string}` | null
  orderId: `0x${string}` | null
  paymentDetails: {
    chainId: number | null
    depository: `0x${string}` | null
    currency: `0x${string}` | null
    amount: string | null
  } | null
  userTransaction: {
    to: `0x${string}`
    value: string
    chainId: number
    dataSelector: string | null
  } | null
  feeUsd: string | null
  rawSnippet: string | null
}

export type BuildOwnerMutationRelayFlowParams = {
  publicClient: {
    estimateGas: (args: {
      account: `0x${string}`
      to: `0x${string}`
      data: `0x${string}`
      value?: bigint
    }) => Promise<bigint>
    getGasPrice: () => Promise<bigint>
  }
  cswAddress: `0x${string}`
  relayQuoteUser: `0x${string}`
  mutationCalldata: `0x${string}`
  relayQuoteOutputWeiEnvKey?: string
}

export type BuildOwnerMutationRelayFlowResult =
  | {
      ok: true
      relay: OwnerMutationRelayFlow
      diagnostics: OwnerMutationRelayQuoteDiagnostics
    }
  | {
      ok: false
      error: string
      diagnostics: OwnerMutationRelayQuoteDiagnostics | null
    }

function encodeExecuteWithoutChainIdValidation(innerCallData: `0x${string}`): `0x${string}` {
  return encodeFunctionData({
    abi: [
      {
        type: 'function',
        name: 'executeWithoutChainIdValidation',
        inputs: [{ name: 'calls', type: 'bytes[]' }],
        outputs: [],
        stateMutability: 'payable',
      },
    ] as const,
    functionName: 'executeWithoutChainIdValidation',
    args: [[innerCallData]],
  })
}

function parseDecimalWei(value: unknown): bigint | null {
  if (typeof value !== 'string' || !/^[1-9][0-9]*$/.test(value)) return null
  try {
    const wei = BigInt(value)
    return wei > 0n ? wei : null
  } catch {
    return null
  }
}

async function deriveRelayQuoteTxsGasLimit(params: {
  publicClient: BuildOwnerMutationRelayFlowParams['publicClient']
  cswAddress: `0x${string}`
  data: `0x${string}`
}): Promise<number> {
  try {
    const estimated = await params.publicClient.estimateGas({
      account: params.cswAddress,
      to: params.cswAddress,
      data: params.data,
      value: 0n,
    })
    const withBuffer = estimated + estimated / 2n
    const bounded =
      withBuffer < RELAY_QUOTE_MIN_GAS_LIMIT
        ? RELAY_QUOTE_MIN_GAS_LIMIT
        : withBuffer > DEFAULT_RELAY_QUOTE_GAS_LIMIT
          ? DEFAULT_RELAY_QUOTE_GAS_LIMIT
          : withBuffer
    return Number(bounded)
  } catch {
    return Number(DEFAULT_RELAY_QUOTE_GAS_LIMIT)
  }
}

async function resolveRelayQuoteOutputWei(params: {
  publicClient: BuildOwnerMutationRelayFlowParams['publicClient']
  relayQuoteTxsGasLimit: number
  envKey: string
}): Promise<string> {
  const configured = (process.env[params.envKey] ?? '').trim()
  if (/^[1-9][0-9]*$/.test(configured)) return configured
  const gasPrice = await params.publicClient.getGasPrice()
  const gasLimit = BigInt(params.relayQuoteTxsGasLimit)
  const derived = gasPrice * gasLimit * RELAY_QUOTE_OUTPUT_MULTIPLIER
  if (derived <= 0n) {
    throw new Error('Could not derive relay quote input wei; derived amount is zero.')
  }
  return derived.toString(10)
}

export async function buildOwnerMutationRelayFlow(
  params: BuildOwnerMutationRelayFlowParams,
): Promise<BuildOwnerMutationRelayFlowResult> {
  const relayDestinationData = encodeExecuteWithoutChainIdValidation(params.mutationCalldata)
  const relayQuoteTxsGasLimit = await deriveRelayQuoteTxsGasLimit({
    publicClient: params.publicClient,
    cswAddress: params.cswAddress,
    data: params.mutationCalldata,
  })
  const relayQuoteOutputWei = await resolveRelayQuoteOutputWei({
    publicClient: params.publicClient,
    relayQuoteTxsGasLimit,
    envKey: params.relayQuoteOutputWeiEnvKey ?? 'RELAY_REMOVE_OWNER_QUOTE_OUTPUT_WEI',
  })

  try {
    const quote = await getRelayQuote({
      user: params.relayQuoteUser,
      recipient: params.cswAddress,
      originChainId: 8453,
      destinationChainId: 8453,
      tradeType: 'EXACT_OUTPUT',
      txs: [
        {
          to: params.cswAddress,
          data: relayDestinationData,
          value: '0',
        },
      ],
      txsGasLimit: relayQuoteTxsGasLimit,
      amount: relayQuoteOutputWei,
    })

    if (!quote.ok) {
      return {
        ok: false,
        error: quote.error,
        diagnostics: {
          requestId: null,
          orderId: null,
          paymentDetails: null,
          userTransaction: null,
          feeUsd: null,
          rawSnippet: quote.raw == null ? null : JSON.stringify(quote.raw).slice(0, 1600),
        },
      }
    }

    const e = quote.extract
    const requestBoundDepositId = e.orderId ?? e.requestId
    const quotedUserValue =
      e.userTransaction &&
      typeof e.userTransaction.value === 'string' &&
      /^[1-9][0-9]*$/.test(e.userTransaction.value)
        ? e.userTransaction.value
        : null
    const paymentDetails =
      e.paymentDetails &&
      e.paymentDetails.depository &&
      e.paymentDetails.currency &&
      e.paymentDetails.currency.toLowerCase() === NATIVE_CURRENCY &&
      e.paymentDetails.amount &&
      /^[1-9][0-9]*$/.test(e.paymentDetails.amount)
        ? {
            chainId: e.paymentDetails.chainId,
            depository: e.paymentDetails.depository,
            currency: e.paymentDetails.currency,
            amount: e.paymentDetails.amount,
          }
        : requestBoundDepositId && quotedUserValue
          ? {
              chainId: 8453,
              depository: RELAY_DEPOSITORY_BASE,
              currency: NATIVE_CURRENCY,
              amount: quotedUserValue,
            }
          : null

    const paymentAmountWei = parseDecimalWei(paymentDetails?.amount ?? null)
    const depositoryFromPaymentDetails = paymentDetails?.depository ?? null
    const builtUserCallFromPaymentDetails =
      requestBoundDepositId && paymentDetails && paymentAmountWei && depositoryFromPaymentDetails
        ? {
            to: depositoryFromPaymentDetails,
            data: encodeFunctionData({
              abi: [
                {
                  type: 'function',
                  name: 'depositNative',
                  stateMutability: 'payable',
                  inputs: [
                    { name: 'depositor', type: 'address' },
                    { name: 'id', type: 'bytes32' },
                  ],
                  outputs: [],
                },
              ] as const,
              functionName: 'depositNative',
              args: [params.relayQuoteUser, requestBoundDepositId],
            }),
            value: `0x${paymentAmountWei.toString(16)}` as `0x${string}`,
          }
        : null

    const diagnostics: OwnerMutationRelayQuoteDiagnostics = {
      requestId: e.requestId,
      orderId: requestBoundDepositId,
      paymentDetails,
      userTransaction: e.userTransaction
        ? {
            to: e.userTransaction.to,
            value: e.userTransaction.value,
            chainId: e.userTransaction.chainId,
            dataSelector: e.userTransaction.data.slice(0, 10) ?? null,
          }
        : null,
      feeUsd: e.feeUsd,
      rawSnippet: e.raw == null ? null : JSON.stringify(e.raw).slice(0, 1600),
    }

    if (
      e.requestId &&
      e.userTransaction &&
      typeof e.userTransaction.value === 'string' &&
      /^[1-9][0-9]*$/.test(e.userTransaction.value) &&
      typeof e.userTransaction.data === 'string' &&
      e.userTransaction.data.startsWith(RELAY_ROUTER_MULTICALL_SELECTOR)
    ) {
      return {
        ok: true,
        relay: {
          requestId: e.requestId,
          orderId: requestBoundDepositId,
          paymentDetails,
          userCall: {
            to: e.userTransaction.to,
            data: e.userTransaction.data,
            value: `0x${BigInt(e.userTransaction.value).toString(16)}` as `0x${string}`,
          },
          userCallSource: 'quote_tx',
          feeUsd: e.feeUsd,
        },
        diagnostics,
      }
    }

    if (e.requestId && builtUserCallFromPaymentDetails) {
      return {
        ok: true,
        relay: {
          requestId: e.requestId,
          orderId: requestBoundDepositId,
          paymentDetails,
          userCall: builtUserCallFromPaymentDetails,
          userCallSource: 'built_from_payment_details',
          feeUsd: e.feeUsd,
        },
        diagnostics,
      }
    }

    return {
      ok: false,
      error: 'Relay quote missing a valid user transaction and usable protocol.v2 paymentDetails.',
      diagnostics,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error ?? 'unknown error')
    return {
      ok: false,
      error: `Relay quote threw: ${message}`,
      diagnostics: null,
    }
  }
}
