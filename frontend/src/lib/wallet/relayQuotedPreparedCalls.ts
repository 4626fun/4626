/**
 * relayQuotedPreparedCalls.ts
 *
 * Owner-mutation submission lane that combines two pieces:
 *
 *   1. **Relay /quote/v2** — given an inner CSW self-call (typically
 *      `executeWithoutChainIdValidation([removeOwnerAtIndex(...)])`),
 *      Relay returns a single `step` whose `items[0].data` contains a tx the
 *      *CSW itself* should execute: `to = RelayRouterV3`, `data = multicall(...)`,
 *      with non-zero `value` and gas fields. The router's multicall internally
 *      runs both the depository top-up and `EntryPoint.handleOps` on the inner
 *      UserOp, so the CSW pays Relay's fees in one shot rather than via a
 *      separate pre-fund tx.
 *
 *   2. **`wallet_prepareCalls` + `wallet_sendPreparedCalls`** — the existing
 *      `_submitOwnerViaPreparedCalls` helper wraps that tx in a CSW UserOp,
 *      asks Coinbase Wallet to sign it (passkey or session-key, depending on
 *      wallet state), and submits it through Coinbase's bundler. The returned
 *      value is the resulting tx hash on Base.
 *
 * Why this lane exists (May 11 2026):
 *
 * The original `/remove-owner` page was hand-building a UserOp that called
 * `executeWithoutChainIdValidation([removeOwnerAtIndex(...)])` against a
 * replayable nonce, then POSTing the resulting `handleOps` calldata to
 * `/api/relay/execute` so Relay's *solver* would broadcast it on behalf of the
 * CSW. That pattern only works if the depository has been pre-funded for the
 * specific request id, and even then required us to sign the inner UserOp with
 * an owner whose key is actually installed on-chain. Both of those have been
 * unreliable in practice (session-key rotation, missing pre-fund step).
 *
 * Relay's quote-driven flow sidesteps all of that. Relay returns the *exact tx*
 * the CSW must run; we just lift it onto Coinbase Wallet's UserOp infra
 * (`wallet_prepareCalls` etc.) which handles signing, nonce, gas, paymaster,
 * and bundling for us.
 */

import { apiFetch } from '../api/apiBase'
import { _submitOwnerViaPreparedCalls } from './onboardingWalletPrepared'

const RELAY_QUOTE_ENDPOINT = '/api/relay/quote'

export type RelayQuotedTelemetryEvent = {
  step:
    | 'quote_request'
    | 'quote_response'
    | 'quote_error'
    | 'prepare_calls_start'
    | 'prepare_calls_error'
    | 'submit_success'
  detail: unknown
}

export type RelayQuoteStepTx = {
  from: `0x${string}`
  to: `0x${string}`
  data: `0x${string}`
  value: string
  chainId: number
  maxFeePerGas?: string | number
  maxPriorityFeePerGas?: string | number
}

export type RelayQuoteResponseShape = {
  steps?: Array<{
    id?: string
    kind?: string
    items?: Array<{
      status?: string
      data?: Partial<RelayQuoteStepTx>
    }>
  }>
  fees?: unknown
  details?: unknown
}

/**
 * Pull the single tx item out of a `/quote/v2` response. We currently only
 * support the case where Relay returns exactly one step with exactly one item
 * whose `kind === 'transaction'`. Anything else means Relay has changed its
 * schema and we should bail loudly rather than guess.
 */
export function extractRelayStepTx(
  response: RelayQuoteResponseShape | null | undefined,
): RelayQuoteStepTx {
  const steps = response?.steps ?? []
  if (steps.length === 0) {
    throw new Error('Relay /quote/v2 returned no steps. Expected one transaction step.')
  }
  if (steps.length > 1) {
    throw new Error(
      `Relay /quote/v2 returned ${steps.length} steps. This lane only supports single-step quotes.`,
    )
  }
  const step = steps[0]
  if (!step) {
    throw new Error('Relay /quote/v2 first step is undefined.')
  }
  const items = step.items ?? []
  if (items.length === 0) {
    throw new Error('Relay /quote/v2 step has no items.')
  }
  if (items.length > 1) {
    throw new Error(
      `Relay /quote/v2 step has ${items.length} items. This lane only supports single-item steps.`,
    )
  }
  const data = items[0]?.data ?? {}
  if (typeof data.to !== 'string' || !/^0x[0-9a-fA-F]{40}$/.test(data.to)) {
    throw new Error('Relay step item is missing a valid `to` address.')
  }
  if (typeof data.data !== 'string' || !data.data.startsWith('0x')) {
    throw new Error('Relay step item is missing valid `data` calldata.')
  }
  if (typeof data.from !== 'string' || !/^0x[0-9a-fA-F]{40}$/.test(data.from)) {
    throw new Error('Relay step item is missing a valid `from` address.')
  }
  const value =
    typeof data.value === 'string'
      ? data.value
      : typeof data.value === 'number'
        ? String(data.value)
        : '0'
  const chainId = typeof data.chainId === 'number' ? data.chainId : Number(data.chainId)
  return {
    from: data.from as `0x${string}`,
    to: data.to as `0x${string}`,
    data: data.data as `0x${string}`,
    value,
    chainId: Number.isFinite(chainId) ? chainId : 0,
    maxFeePerGas: data.maxFeePerGas,
    maxPriorityFeePerGas: data.maxPriorityFeePerGas,
  }
}

export type SubmitOwnerViaRelayQuotedPreparedCallsParams = {
  walletRequest: (args: { method: string; params?: unknown[] }) => Promise<unknown>
  chainId: number
  csw: `0x${string}`
  /**
   * The inner CSW self-call we want Relay to sponsor. For owner mutations this
   * is typically `executeWithoutChainIdValidation([removeOwnerAtIndex(...)])`
   * but it can be any CSW call \u2014 Relay does not inspect the bytes.
   */
  innerTx: { to: `0x${string}`; data: `0x${string}`; value?: string }
  paymasterUrl: string | null
  approvalRunId: string
  signerAddress: string | null
  sessionKind?: 'self_auth' | 'external_signer'
  onTelemetry?: (event: RelayQuotedTelemetryEvent) => void
}

/**
 * Fetch a Relay /quote/v2 for the given inner CSW call, then submit the
 * returned step tx through Coinbase Wallet's `wallet_prepareCalls` +
 * `wallet_sendPreparedCalls` infra. Resolves to the resulting tx hash on Base.
 */
export async function _submitOwnerViaRelayQuotedPreparedCalls(
  params: SubmitOwnerViaRelayQuotedPreparedCallsParams,
): Promise<{
  txHash: `0x${string}`
  stepTx: RelayQuoteStepTx
  quoteResponse: RelayQuoteResponseShape
}> {
  const emit = (event: RelayQuotedTelemetryEvent) => {
    try {
      params.onTelemetry?.(event)
    } catch {
      /* swallow telemetry callback errors */
    }
  }

  // Relay rejects mixed-case addresses for some chains, so lowercase the user
  // / recipient on the wire (the proxy already does this defensively, but be
  // explicit so the telemetry log shows what we actually sent).
  const cswLower = params.csw.toLowerCase() as `0x${string}`

  const quoteBody = {
    chainId: params.chainId,
    user: cswLower,
    to: params.innerTx.to,
    data: params.innerTx.data,
    value: params.innerTx.value ?? '0',
  }
  emit({ step: 'quote_request', detail: quoteBody })

  let quoteResponse: RelayQuoteResponseShape | null = null
  let quoteRawText = ''
  let quoteStatus = 0
  try {
    const res = await apiFetch(RELAY_QUOTE_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(quoteBody),
    })
    quoteStatus = res.status
    quoteRawText = await res.text().catch(() => '')
    let parsed: unknown = null
    try {
      parsed = quoteRawText ? JSON.parse(quoteRawText) : null
    } catch {
      parsed = null
    }
    if (!res.ok) {
      emit({
        step: 'quote_error',
        detail: { status: quoteStatus, body: parsed ?? quoteRawText.slice(0, 1000) },
      })
      throw new Error(
        `Relay /quote/v2 proxy returned ${quoteStatus}: ${
          typeof parsed === 'object' && parsed && 'error' in (parsed as Record<string, unknown>)
            ? String((parsed as Record<string, unknown>).error)
            : quoteRawText.slice(0, 200)
        }`,
      )
    }
    // Our /api/relay/quote proxy wraps the upstream response as
    // { success: true, data: <upstream> }, so unwrap to the upstream shape.
    const wrapped = parsed as { success?: boolean; data?: RelayQuoteResponseShape } | null
    quoteResponse = wrapped?.data ?? (parsed as RelayQuoteResponseShape | null)
  } catch (error) {
    if (!quoteResponse) {
      emit({
        step: 'quote_error',
        detail: {
          status: quoteStatus,
          error: error instanceof Error ? error.message : String(error ?? ''),
        },
      })
      throw error
    }
  }

  emit({ step: 'quote_response', detail: quoteResponse })

  const stepTx = extractRelayStepTx(quoteResponse)

  // Sanity check: Relay's quoted `from` must equal the CSW (not the connected
  // signer or anyone else). If it doesn't, the CSW won't have authority to
  // submit this call and the bundler will reject it.
  if (stepTx.from.toLowerCase() !== cswLower) {
    throw new Error(
      `Relay quoted from=${stepTx.from} but we expected the CSW ${cswLower}. ` +
        'Refresh the page and try again \u2014 the quote may have been built against the wrong sender.',
    )
  }

  // Sanity check: Relay's quoted chainId must match the requested chainId.
  if (stepTx.chainId !== params.chainId) {
    throw new Error(
      `Relay quoted chainId=${stepTx.chainId} but we requested ${params.chainId}.`,
    )
  }

  emit({
    step: 'prepare_calls_start',
    detail: {
      to: stepTx.to,
      data: stepTx.data.slice(0, 16) + '\u2026',
      dataLengthBytes: (stepTx.data.length - 2) / 2,
      value: stepTx.value,
      maxFeePerGas: stepTx.maxFeePerGas ?? null,
      maxPriorityFeePerGas: stepTx.maxPriorityFeePerGas ?? null,
    },
  })

  let txHash: `0x${string}`
  try {
    // NB: `_submitOwnerViaPreparedCalls` hardcodes the inner call value to
    // '0x0' today. Relay's quote may include a non-zero value (e.g. for the
    // depository top-up portion), but in observed Base-mainnet quotes for our
    // owner-mutation lane the value has always been '0' because Relay pays
    // itself out of the inner UserOp's prefund. If a future quote returns a
    // non-zero value we'll need to widen the helper \u2014 capture that in
    // telemetry so we notice.
    if (stepTx.value !== '0' && stepTx.value !== '0x0') {
      // Don't throw \u2014 still attempt the submission so we get a clear bundler
      // error rather than failing on a heuristic.
      emit({
        step: 'prepare_calls_error',
        detail: {
          stage: 'value_mismatch_warning',
          message:
            'Relay step value is non-zero but _submitOwnerViaPreparedCalls hardcodes value=0x0. ' +
            'Proceeding anyway; if this reverts, widen the helper to forward value.',
          relayValue: stepTx.value,
        },
      })
    }
    txHash = await _submitOwnerViaPreparedCalls({
      walletRequest: params.walletRequest,
      chainId: params.chainId,
      sender: params.csw,
      to: stepTx.to,
      data: stepTx.data,
      paymasterUrl: params.paymasterUrl,
      approvalRunId: params.approvalRunId,
      executionMode: 'canonicalSmartWallet',
      signerAddress: params.signerAddress,
      canonicalCswAddress: params.csw,
      sessionKind: params.sessionKind,
    })
  } catch (error) {
    emit({
      step: 'prepare_calls_error',
      detail: {
        stage: 'submit',
        error: error instanceof Error ? error.message : String(error ?? ''),
      },
    })
    throw error
  }

  emit({ step: 'submit_success', detail: { txHash } })
  return { txHash, stepTx, quoteResponse: quoteResponse ?? {} }
}
