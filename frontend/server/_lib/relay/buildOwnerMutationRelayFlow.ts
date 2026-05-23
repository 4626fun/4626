import { encodeFunctionData, decodeFunctionData, getAddress, type Hex } from 'viem'

import { encodeExecuteWithoutChainIdValidation } from '../../../src/lib/wallet/cswOwnerMutationEncode.js'
import {
  RELAY_DEPOSITORY_ABI,
  RELAY_DEPOSITORY_BASE,
  RELAY_DEPOSITORY_NATIVE_DEPOSIT_SELECTOR,
  MIN_OWNER_MUTATION_RELAY_DEPOSIT_WEI,
  GOLDEN_RELAY_PART1_DEPOSIT_WEI,
} from '../../../src/lib/wallet/cswOwnerAbi.js'
import { validateGoldenCswDepositoryPart1UserCall } from '../../../src/lib/relay/goldenRelayPart1Shape.js'
import { getRelayQuote, isNativeRelayCurrency, NATIVE_CURRENCY, resolveQuotedNativeDepositWei } from './getQuote.js'

const DEFAULT_RELAY_QUOTE_GAS_LIMIT = 250_000n
const RELAY_QUOTE_MIN_GAS_LIMIT = 80_000n
const RELAY_ROUTER_MULTICALL_SELECTOR = '0xcd6e13f7'
const RELAY_ROUTER_BASE = '0xb92fe925dc43a0ecde6c8b1a2709c170ec4fff4f' as const
type RelayUserCallCandidate = {
  userCall: OwnerMutationRelayFlow['userCall']
  isDepositoryDepositNative: boolean
}

/**
 * Golden Part 1 (0xa6b54357… / AA hash A6B54357…, block 45600637):
 * CSW UserOp → executeBatch → RelayDepository.depositNative(depositor=CSW, id=orderId)
 * with value 18871666861048 wei. Base App `wallet_sendCalls` wraps a single depository
 * call into that executeBatch shape. The AA bundle produces two internal transfers:
 *   1. CSW → EntryPoint v0.6 (~85989948096 wei prefund for gas)
 *   2. CSW → Relay Depository (18871666861048 wei + depositNative calldata)
 *
 * External EOA funders still submit Relay router `multicall` (`0xcd6e13f7`) via
 * `eth_sendTransaction`. Part 2 (0xa9a06340…) is the solver fill that emits AddOwner.
 *
 * Relay intent UI (8453→8453) may label Part 1 as a "same chain cross chain
 * transaction" (~0.000019 ETH). Bundle tx 0x34edd28… wraps UserOp 0xa6b54357….
 */
export function selectOwnerMutationRelayUserCall(params: {
  userTransaction: {
    to: `0x${string}`
    data: `0x${string}`
    value: string
  } | null
  builtUserCallFromPaymentDetails: OwnerMutationRelayFlow['userCall'] | null
  /** CSW self-auth lane: mimic golden executeBatch → Depository.depositNative Part 1. */
  preferDepositoryDepositNative?: boolean
}): RelayUserCallCandidate | null {
  if (params.preferDepositoryDepositNative && params.builtUserCallFromPaymentDetails) {
    const built = params.builtUserCallFromPaymentDetails
    if (
      built.to.toLowerCase() === RELAY_DEPOSITORY_BASE.toLowerCase() &&
      built.data.slice(0, 10).toLowerCase() === RELAY_DEPOSITORY_NATIVE_DEPOSIT_SELECTOR
    ) {
      return {
        userCall: built,
        isDepositoryDepositNative: true,
      }
    }
  }

  const quoteTx =
    params.userTransaction &&
    typeof params.userTransaction.value === 'string' &&
    /^[1-9][0-9]*$/.test(params.userTransaction.value) &&
    typeof params.userTransaction.data === 'string' &&
    params.userTransaction.data.startsWith(RELAY_ROUTER_MULTICALL_SELECTOR) &&
    params.userTransaction.to.toLowerCase() === RELAY_ROUTER_BASE.toLowerCase()
      ? {
          userCall: {
            to: params.userTransaction.to,
            data: params.userTransaction.data,
            value: `0x${BigInt(params.userTransaction.value).toString(16)}` as `0x${string}`,
          },
          isDepositoryDepositNative: false,
        }
      : null

  if (quoteTx && params.builtUserCallFromPaymentDetails) {
    const quotedWei = BigInt(quoteTx.userCall.value)
    const builtWei = BigInt(params.builtUserCallFromPaymentDetails.value)
    if (quotedWei >= builtWei) {
      return quoteTx
    }
    return null
  }

  if (quoteTx) return quoteTx

  if (params.builtUserCallFromPaymentDetails) {
    const built = params.builtUserCallFromPaymentDetails
    if (
      built.to.toLowerCase() === RELAY_DEPOSITORY_BASE.toLowerCase() &&
      built.data.slice(0, 10).toLowerCase() === RELAY_DEPOSITORY_NATIVE_DEPOSIT_SELECTOR
    ) {
      return {
        userCall: built,
        isDepositoryDepositNative: true,
      }
    }
  }

  return null
}

export function validateSelectedOwnerMutationRelayUserCall(params: {
  requestBoundDepositId: `0x${string}` | null
  selected: RelayUserCallCandidate
  /** For Depository.depositNative Part 1, depositor must equal the funding CSW. */
  expectedDepositor?: `0x${string}` | null
  /** Authoritative Part 1 deposit from Relay `protocol.v2.paymentDetails.amount`. */
  paymentDetailsAmountWei?: string | null
}): string | null {
  let valueWei: bigint
  try {
    valueWei = BigInt(params.selected.userCall.value)
  } catch {
    return 'relay user call value is not valid wei'
  }
  if (valueWei < MIN_OWNER_MUTATION_RELAY_DEPOSIT_WEI) {
    return `relay deposit ${valueWei.toString()} wei is below minimum ${MIN_OWNER_MUTATION_RELAY_DEPOSIT_WEI.toString()} wei (underfunded quotes skip Part 2 solver fill)`
  }

  const selector = params.selected.userCall.data.slice(0, 10).toLowerCase()
  const isDepositoryNativeDeposit =
    selector === RELAY_DEPOSITORY_NATIVE_DEPOSIT_SELECTOR &&
    params.selected.userCall.to.toLowerCase() === RELAY_DEPOSITORY_BASE.toLowerCase()

  if (params.paymentDetailsAmountWei) {
    let authoritativeWei: bigint
    try {
      authoritativeWei = BigInt(params.paymentDetailsAmountWei)
    } catch {
      return 'paymentDetails.amount is not valid wei'
    }
    if (authoritativeWei > 0n && valueWei < authoritativeWei) {
      return `relay deposit ${valueWei.toString()} wei is below Relay paymentDetails.amount ${authoritativeWei.toString()} wei`
    }
    if (isDepositoryNativeDeposit && valueWei !== authoritativeWei) {
      return `relay depository deposit ${valueWei.toString()} wei must match Relay paymentDetails.amount ${authoritativeWei.toString()} wei`
    }
  }

  if (isDepositoryNativeDeposit) {
    try {
      const decoded = decodeFunctionData({
        abi: RELAY_DEPOSITORY_ABI,
        data: params.selected.userCall.data,
      })
      if (decoded.functionName !== 'depositNative') {
        return 'relay depository call must be depositNative'
      }
      const [depositor, depositId] = decoded.args as [`0x${string}`, `0x${string}`]
      if (params.expectedDepositor) {
        if (getAddress(depositor) !== getAddress(params.expectedDepositor)) {
          return `depositNative depositor must be funding CSW (${params.expectedDepositor}), got ${depositor}`
        }
      }
      if (params.requestBoundDepositId) {
        if (depositId.toLowerCase() !== params.requestBoundDepositId.toLowerCase()) {
          return 'depositNative id must match request-bound Relay order id'
        }
      }
    } catch {
      return 'relay depository depositNative calldata could not be decoded'
    }
  } else if (params.requestBoundDepositId) {
    const idNeedle = params.requestBoundDepositId.slice(2).toLowerCase()
    if (!params.selected.userCall.data.toLowerCase().includes(idNeedle)) {
      return 'relay user call calldata does not embed the request-bound deposit id'
    }
  }
  return null
}

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
  }
  cswAddress: `0x${string}`
  relayQuoteUser: `0x${string}`
  mutationCalldata: `0x${string}`
  relayQuoteOutputWeiEnvKey?: string
  /** Relay dashboard source tag (e.g. `4626-add-owner`, `4626-remove-owner`). */
  relaySource?: string
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

function parseDecimalWei(value: unknown): bigint | null {
  if (typeof value !== 'string' || !/^[1-9][0-9]*$/.test(value)) return null
  try {
    const wei = BigInt(value)
    return wei > 0n ? wei : null
  } catch {
    return null
  }
}

async function relayFunderIsDeployedContract(params: {
  publicClient: BuildOwnerMutationRelayFlowParams['publicClient'] & {
    getBytecode?: (args: { address: `0x${string}` }) => Promise<Hex | undefined>
  }
  address: `0x${string}`
}): Promise<boolean> {
  if (typeof params.publicClient.getBytecode !== 'function') return false
  const bytecode = await params.publicClient.getBytecode({ address: params.address }).catch(() => undefined)
  return Boolean(bytecode && bytecode !== '0x')
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

/**
 * Relay `/quote/v2` `amount` for owner mutations: EXACT_OUTPUT destination value
 * (typically `"0"` wei on `txs[0].value`). When Relay returns
 * `protocol.v2.paymentDetails.amount`, that field is authoritative when currency
 * is native ETH. When it does not, we re-quote with a golden-scale native seed
 * amount and resolve the deposit via `resolveQuotedNativeDepositWei` (native
 * ETH only — USDC / ERC-20 currencyIn is rejected).
 *
 * Ops may override the request `amount` via `RELAY_*_QUOTE_OUTPUT_WEI` for
 * debugging only.
 */
export function resolveRelayQuoteRequestAmount(params: {
  destinationTxValueWei?: string
  envKey: string
}): string {
  const configured = (process.env[params.envKey] ?? '').trim()
  if (/^[0-9]+$/.test(configured)) return configured
  const destinationValue = (params.destinationTxValueWei ?? '0').trim()
  if (/^[0-9]+$/.test(destinationValue)) return destinationValue
  return '0'
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
  const destinationTxValueWei = '0'
  const relayQuoteRequestAmount = resolveRelayQuoteRequestAmount({
    destinationTxValueWei,
    envKey: params.relayQuoteOutputWeiEnvKey ?? 'RELAY_REMOVE_OWNER_QUOTE_OUTPUT_WEI',
  })

  try {
    const quoteParamsBase = {
      user: params.relayQuoteUser,
      recipient: params.cswAddress,
      originChainId: 8453,
      destinationChainId: 8453,
      tradeType: 'EXACT_OUTPUT' as const,
      source: params.relaySource ?? '4626-owner-mutation',
      txs: [
        {
          to: params.cswAddress,
          data: relayDestinationData,
          value: '0',
        },
      ],
      txsGasLimit: relayQuoteTxsGasLimit,
    }

    let quote = await getRelayQuote({
      ...quoteParamsBase,
      amount: relayQuoteRequestAmount,
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

    let e = quote.extract
    let resolvedDepositWei = resolveQuotedNativeDepositWei(e)
    if (resolvedDepositWei == null && relayQuoteRequestAmount === '0') {
      const retryQuote = await getRelayQuote({
        ...quoteParamsBase,
        amount: GOLDEN_RELAY_PART1_DEPOSIT_WEI.toString(),
      })
      if (retryQuote.ok) {
        const retryDepositWei = resolveQuotedNativeDepositWei(retryQuote.extract)
        if (retryDepositWei != null) {
          quote = retryQuote
          e = retryQuote.extract
          resolvedDepositWei = retryDepositWei
        }
      }
    }

    const requestBoundDepositId = e.orderId ?? e.requestId
    const paymentDetails =
      resolvedDepositWei &&
      requestBoundDepositId &&
      (e.paymentDetails?.currency == null || isNativeRelayCurrency(e.paymentDetails.currency))
        ? {
            chainId: e.paymentDetails?.chainId ?? 8453,
            depository: (e.paymentDetails?.depository ?? RELAY_DEPOSITORY_BASE) as `0x${string}`,
            currency: NATIVE_CURRENCY,
            amount: resolvedDepositWei.toString(),
          }
        : null

    const paymentAmountWei = resolvedDepositWei ?? parseDecimalWei(paymentDetails?.amount ?? null)
    const depositoryFromPaymentDetails = paymentDetails?.depository ?? null
    const builtUserCallFromPaymentDetails =
      requestBoundDepositId && paymentDetails && paymentAmountWei && depositoryFromPaymentDetails
        ? {
            to: depositoryFromPaymentDetails,
            data: encodeFunctionData({
              abi: RELAY_DEPOSITORY_ABI,
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

    const preferDepositoryDepositNative = await relayFunderIsDeployedContract({
      publicClient: params.publicClient,
      address: params.relayQuoteUser,
    })

    const selectedUserCall = selectOwnerMutationRelayUserCall({
      userTransaction: e.userTransaction,
      builtUserCallFromPaymentDetails,
      preferDepositoryDepositNative,
    })

    if (!selectedUserCall) {
      return {
        ok: false,
        error: preferDepositoryDepositNative
          ? 'Relay quote did not return a native ETH Part 1 deposit for CSW Depository.depositNative (paymentDetails absent, zero, or non-native).'
          : 'Relay quote missing a funded router multicall or usable native ETH Part 1 deposit.',
        diagnostics,
      }
    }

    if (e.requestId) {
      const validationError = validateSelectedOwnerMutationRelayUserCall({
        requestBoundDepositId,
        selected: selectedUserCall,
        expectedDepositor: selectedUserCall.isDepositoryDepositNative ? params.relayQuoteUser : null,
        paymentDetailsAmountWei: paymentDetails?.amount ?? null,
      })
      if (validationError) {
        return {
          ok: false,
          error: validationError,
          diagnostics,
        }
      }
      if (selectedUserCall.isDepositoryDepositNative) {
        const goldenShapeError = validateGoldenCswDepositoryPart1UserCall({
          userCall: selectedUserCall.userCall,
          fundingCsw: params.relayQuoteUser,
          orderId: requestBoundDepositId,
        })
        if (goldenShapeError) {
          return {
            ok: false,
            error: goldenShapeError,
            diagnostics,
          }
        }
      }
      return {
        ok: true,
        relay: {
          requestId: e.requestId,
          orderId: requestBoundDepositId,
          paymentDetails,
          userCall: selectedUserCall.userCall,
          feeUsd: e.feeUsd,
        },
        diagnostics,
      }
    }

    return {
      ok: false,
      error: 'Relay quote missing request id.',
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
