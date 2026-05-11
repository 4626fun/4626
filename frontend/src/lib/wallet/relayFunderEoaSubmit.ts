/**
 * relayFunderEoaSubmit.ts
 *
 * Two-wallet Relay submission lane.
 *
 * Architecture (see RELAY_OWNER_MUTATION_FLOW.md):
 *
 *   1. Wallet A (signer) signs the inner CSW UserOp client-side. Captures the
 *      handleOps calldata that EntryPoint would execute on Base.
 *   2. Wallet B (funder, any EOA with a tiny amount of ETH) fetches a Relay
 *      /quote/v2 with `user = funder EOA, recipient = CSW, txs = [{handleOps}]`
 *      and broadcasts the returned step tx via plain `eth_sendTransaction`.
 *
 * Relay's solver then picks up the deposit, validates the request id, and
 * executes the multicall (depository top-up + EntryPoint.handleOps) on Base.
 *
 * This file implements step 2 only. Step 1 lives in
 * `_submitOwnerViaSelfBuiltUserOp` (with `signOnly: true`).
 *
 * Why this is different from the previous `relayQuotedPreparedCalls.ts`:
 *
 *   - That lane used Coinbase Wallet's `wallet_prepareCalls` to wrap the
 *     multicall into a CSW UserOp signed by the wallet. That RPC is blocked
 *     in Coinbase Wallet's in-app browser (`Failed to fetch RPC request`).
 *   - This lane uses a plain `eth_sendTransaction` from the funder wallet,
 *     which works in literally any wallet (in-app browser included).
 *   - The CSW's owner signature is captured separately in step 1 and embedded
 *     inside `txs[0].data` (the handleOps calldata); the funder wallet never
 *     needs to sign anything for the CSW.
 */

import { apiFetch } from '../api/apiBase'
import { normalizePreparedCallValueToDecimal } from './onboardingWalletPrepared'
import type { RelayQuoteStepTx, RelayQuoteResponseShape } from './relayQuotedPreparedCalls'
import { extractRelayStepTx } from './relayQuotedPreparedCalls'

const RELAY_QUOTE_ENDPOINT = '/api/relay/quote'
const ENTRY_POINT_V06_ADDRESS = '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789'

export type RelayFunderEoaTelemetry = {
  step:
    | 'quote_request'
    | 'quote_response'
    | 'quote_error'
    | 'prompt_sign'
    | 'broadcast_success'
    | 'broadcast_error'
  detail: unknown
}

export type SubmitViaFunderEoaParams = {
  /**
   * Wallet provider RPC bridge for the FUNDER wallet (which holds the EOA
   * that will sign and broadcast the outer tx). Use whatever Privy / WalletConnect
   * / Coinbase Wallet provider is connected at the time of submission.
   */
  walletRequest: (args: { method: string; params?: unknown[] }) => Promise<unknown>
  /**
   * The address of the connected funder EOA. Used as `user` in the Relay
   * quote request so Relay computes its fee against this address rather than
   * against the CSW.
   */
  funderEoa: `0x${string}`
  /**
   * The CSW address. Used as `recipient` so Relay's solver knows the
   * destination identity, and as the `to` of the inner handleOps call (the
   * CSW is the EntryPoint's `sender` for the UserOp).
   */
  csw: `0x${string}`
  /**
   * The signed `handleOps(...)` calldata produced by the signer wallet in
   * step 1. This already contains a valid SignatureWrapper inside the
   * UserOp's `signature` field; the funder wallet doesn't sign it again.
   */
  handleOpsCalldata: `0x${string}`
  /** Target chain (currently always 8453 for Base). */
  chainId: number
  /**
   * Optional native amount the funder will pay Relay to sponsor the tx, in
   * decimal wei. If omitted, defaults to '0' and Relay computes a minimum.
   * For typical owner mutations Relay quotes ~160_000_000 wei.
   */
  amountWei?: string
  onTelemetry?: (event: RelayFunderEoaTelemetry) => void
}

export async function _submitOwnerViaFunderEoa(params: SubmitViaFunderEoaParams): Promise<{
  funderTxHash: `0x${string}`
  stepTx: RelayQuoteStepTx
  quoteResponse: RelayQuoteResponseShape
  /**
   * Relay's polling URL for the request status. Poll this to learn the
   * eventual destination tx hash on Base (i.e. the tx where the CSW owner
   * actually gets mutated).
   */
  statusCheckEndpoint: string | null
}> {
  const emit = (event: RelayFunderEoaTelemetry) => {
    try {
      params.onTelemetry?.(event)
    } catch {
      /* swallow */
    }
  }

  const funderLower = params.funderEoa.toLowerCase() as `0x${string}`
  const cswLower = params.csw.toLowerCase() as `0x${string}`
  const amountDecimal = normalizePreparedCallValueToDecimal(params.amountWei ?? '0')

  // Build the quote body. We forward the signed handleOps calldata in `txs`
  // and tell Relay the funder pays a (possibly zero) amount on the same chain.
  // Relay rewrites the destination call into a RelayRouterV3.multicall that
  // wraps both the depository top-up and the inner handleOps; the funder just
  // broadcasts that single tx.
  const quoteBody = {
    chainId: params.chainId,
    user: funderLower,
    recipient: cswLower,
    to: ENTRY_POINT_V06_ADDRESS,
    data: params.handleOpsCalldata,
    value: '0',
    amount: amountDecimal,
    // Forwarded so the proxy passes through correctly; the proxy already adds
    // explicitDeposit on its end but we surface the intent in telemetry.
    originChainId: params.chainId,
    destinationChainId: params.chainId,
  }
  emit({ step: 'quote_request', detail: quoteBody })

  let parsedBody: { success?: boolean; data?: RelayQuoteResponseShape } | null = null
  let rawText = ''
  let httpStatus = 0
  try {
    const res = await apiFetch(RELAY_QUOTE_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(quoteBody),
    })
    httpStatus = res.status
    rawText = await res.text().catch(() => '')
    try {
      parsedBody = rawText ? JSON.parse(rawText) : null
    } catch {
      parsedBody = null
    }
    if (!res.ok) {
      emit({
        step: 'quote_error',
        detail: { status: httpStatus, body: parsedBody ?? rawText.slice(0, 1500) },
      })
      const msg =
        parsedBody && typeof parsedBody === 'object' && 'error' in parsedBody
          ? String((parsedBody as Record<string, unknown>).error)
          : `Relay /quote/v2 proxy returned ${httpStatus}`
      throw new Error(msg)
    }
  } catch (error) {
    if (httpStatus === 0) {
      emit({
        step: 'quote_error',
        detail: { error: error instanceof Error ? error.message : String(error ?? '') },
      })
    }
    throw error
  }

  const quoteResponse = parsedBody?.data ?? (parsedBody as unknown as RelayQuoteResponseShape)
  emit({ step: 'quote_response', detail: quoteResponse })

  const stepTx = extractRelayStepTx(quoteResponse)

  // Sanity check: the quoted `from` MUST be the connected funder EOA. If it's
  // anything else (e.g. the CSW), the funder wallet won't be authorized to
  // sign and the tx will revert at the RPC layer.
  if (stepTx.from.toLowerCase() !== funderLower) {
    throw new Error(
      `Relay quoted from=${stepTx.from} but connected funder is ${funderLower}. ` +
        'Reconnect with the correct wallet and retry.',
    )
  }
  if (stepTx.chainId !== params.chainId) {
    throw new Error(
      `Relay quoted chainId=${stepTx.chainId} but we requested ${params.chainId}.`,
    )
  }

  emit({
    step: 'prompt_sign',
    detail: {
      to: stepTx.to,
      data: stepTx.data.slice(0, 16) + '\u2026',
      dataLengthBytes: (stepTx.data.length - 2) / 2,
      value: stepTx.value,
      maxFeePerGas: stepTx.maxFeePerGas ?? null,
      maxPriorityFeePerGas: stepTx.maxPriorityFeePerGas ?? null,
    },
  })

  // Build an eth_sendTransaction request. Coerce numeric fields to hex.
  const valueHex = decimalOrHexToHex(stepTx.value)
  const maxFeeHex = decimalOrHexToHex(stepTx.maxFeePerGas)
  const maxPrioHex = decimalOrHexToHex(stepTx.maxPriorityFeePerGas)
  const txParams: Record<string, unknown> = {
    from: funderLower,
    to: stepTx.to,
    data: stepTx.data,
    value: valueHex,
  }
  if (maxFeeHex) txParams.maxFeePerGas = maxFeeHex
  if (maxPrioHex) txParams.maxPriorityFeePerGas = maxPrioHex

  let funderTxHash: `0x${string}`
  try {
    funderTxHash = (await params.walletRequest({
      method: 'eth_sendTransaction',
      params: [txParams],
    })) as `0x${string}`
    if (!funderTxHash || typeof funderTxHash !== 'string' || !funderTxHash.startsWith('0x')) {
      throw new Error('Funder wallet did not return a transaction hash.')
    }
  } catch (error) {
    emit({
      step: 'broadcast_error',
      detail: { error: error instanceof Error ? error.message : String(error ?? '') },
    })
    throw error
  }

  // Extract the Relay status-check endpoint if Relay returned one.
  let statusCheckEndpoint: string | null = null
  try {
    const items = quoteResponse?.steps?.[0]?.items ?? []
    const first = items[0] as unknown as { check?: { endpoint?: string } } | undefined
    if (first?.check?.endpoint) {
      statusCheckEndpoint = first.check.endpoint
    }
  } catch {
    /* swallow */
  }

  emit({ step: 'broadcast_success', detail: { funderTxHash, statusCheckEndpoint } })
  return { funderTxHash, stepTx, quoteResponse: quoteResponse ?? {}, statusCheckEndpoint }
}

function decimalOrHexToHex(value: string | number | undefined | null): `0x${string}` | null {
  if (value === undefined || value === null || value === '') return null
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 0) return null
    return `0x${BigInt(Math.trunc(value)).toString(16)}`
  }
  const trimmed = value.trim()
  if (!trimmed) return null
  if (/^0x[0-9a-fA-F]+$/.test(trimmed)) {
    try {
      return `0x${BigInt(trimmed).toString(16)}`
    } catch {
      return null
    }
  }
  if (/^[0-9]+$/.test(trimmed)) {
    try {
      return `0x${BigInt(trimmed).toString(16)}`
    } catch {
      return null
    }
  }
  return null
}
