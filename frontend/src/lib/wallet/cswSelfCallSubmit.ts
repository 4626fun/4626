/**
 * cswSelfCallSubmit.ts
 *
 * CSW self-call submission lane (Base App native).
 *
 * Per the user's past sessions (notably session 248b841e on 2026-05-04):
 * "Base App's native handler signs locally with the on-device passkey \u2014 no
 * popup, no keys.coinbase.com round-trip. This is the only path that works
 * inside the Base App in-app browser (webviews block the popup that
 * wallet_prepareCalls requires)."
 *
 * The mechanism is a plain `eth_sendTransaction` where `from === to === CSW`,
 * with the inner call already wrapped in `executeWithoutChainIdValidation`.
 * Base App detects the self-call shape, builds a UserOp under the hood,
 * prompts the user for a passkey authentication via its native UI (no popup,
 * no webview navigation), signs with the on-device passkey, and submits via
 * its own bundler. The CSW pays its own gas from its native balance.
 *
 * Why this lane is its own helper:
 *
 *   - It's only applicable when the connected wallet IS the CSW (self-auth
 *     session). For external-signer sessions there is no on-device passkey to
 *     prompt for.
 *   - It does NOT route through Relay at all. The funder-EOA lane and this
 *     lane are mutually exclusive: pick funder-EOA when an EOA wallet is
 *     connected, pick CSW-self-call when the CSW itself is connected.
 *   - It needs the CSW to have a small native balance on Base to pay its own
 *     gas. The page shows the CSW ETH balance in diagnostics so the user can
 *     verify before trying.
 *
 * Known caveats (from the same session notes):
 *
 *   - "Base App's webview is signing with an ephemeral session key it
 *     generates locally \u2014 not the canonical passkey at keys.coinbase.com."
 *     If the on-device passkey isn't accessible to Base App's native handler
 *     for some reason, the wallet may fall back to a session key. When that
 *     happens the SignatureWrapper claims an `ownerIndex` based on the
 *     wallet's client-side state, which may not match what's actually
 *     installed on-chain \u2014 the tx will revert with AA24 inside the bundler.
 *     The lane surfaces the eventual on-chain tx hash so the user can inspect
 *     the failure via Basescan / Tenderly if it doesn't go through.
 */

import { encodeExecuteWithoutChainIdValidation } from './onboardingWalletReplayable'

const EXECUTE_WITHOUT_CHAIN_ID_VALIDATION_SELECTOR = '0x2c2abd1e'

export type CswSelfCallTelemetry = {
  step: 'preflight' | 'prompt_sign' | 'broadcast_success' | 'broadcast_error'
  detail: unknown
}

export type SubmitViaCswSelfCallParams = {
  /**
   * Wallet provider RPC bridge for the CSW-connected wallet (i.e. Base App's
   * native provider when signed in as the smart wallet). The provider's
   * `eth_accounts` must return the CSW address \u2014 if it returns a different
   * address this lane is the wrong choice.
   */
  walletRequest: (args: { method: string; params?: unknown[] }) => Promise<unknown>
  /**
   * The CSW address. Used as both `from` and `to` on the eth_sendTransaction;
   * Base App's native handler interprets that shape as "this smart wallet is
   * making a self-call" and routes signing through its on-device passkey UI.
   */
  csw: `0x${string}`
  /**
   * The inner call. Two shapes are accepted:
   *
   *   1. RAW inner action calldata (e.g. `removeOwnerAtIndex(idx, ownerBytes)`
   *      or `addOwnerAddress(eoa)`). The helper wraps it in
   *      `executeWithoutChainIdValidation([...])` for you.
   *
   *   2. Pre-wrapped `executeWithoutChainIdValidation([...])` calldata
   *      (selector 0x2c2abd1e). The helper passes it through unchanged.
   *
   * Either way, the final transaction data uses the replayable validation
   * path so the signature isn't chain-id-bound (allowing the same signed
   * UserOp to be replayed across chains if needed).
   *
   * Why we accept both: the `/api/onboarding/preview-{add,remove}-owner`
   * endpoints return the RAW inner action calldata, but other call sites
   * (e.g. `_submitOwnerViaSelfBuiltUserOp` internals) already wrap.
   * Accepting both prevents a class of bugs where the caller forgets to
   * wrap and the CSW falls back to chain-id-bound validation.
   */
  innerCallData: `0x${string}`
  onTelemetry?: (event: CswSelfCallTelemetry) => void
}

export async function _submitOwnerViaCswSelfCall(params: SubmitViaCswSelfCallParams): Promise<{
  funderTxHash: `0x${string}`
}> {
  const emit = (event: CswSelfCallTelemetry) => {
    try {
      params.onTelemetry?.(event)
    } catch {
      /* swallow */
    }
  }

  if (!params.innerCallData || !params.innerCallData.startsWith('0x')) {
    throw new Error(
      `innerCallData must be 0x-prefixed hex, got ${params.innerCallData?.slice(0, 16) ?? '(empty)'}.`,
    )
  }

  // Accept both raw inner action calldata (e.g. removeOwnerAtIndex(...)) and
  // pre-wrapped executeWithoutChainIdValidation calldata. The page's preview
  // endpoint returns the raw form; some library call sites pre-wrap. Either
  // way the final transaction data MUST go through the replayable validation
  // path so the signature isn't chain-id-bound.
  const isAlreadyWrapped = params.innerCallData.startsWith(
    EXECUTE_WITHOUT_CHAIN_ID_VALIDATION_SELECTOR,
  )
  const wrappedData = isAlreadyWrapped
    ? params.innerCallData
    : encodeExecuteWithoutChainIdValidation(params.innerCallData)

  // Confirm the connected wallet is actually the CSW. If `eth_accounts`
  // returns something else we'd be signing from the wrong address and Base
  // App would either prompt for the wrong key or reject the tx outright.
  let accounts: string[] = []
  try {
    accounts = (await params.walletRequest({ method: 'eth_accounts' })) as string[]
  } catch {
    /* fall through \u2014 we'll still attempt and let the wallet reject */
  }
  const cswLower = params.csw.toLowerCase()
  const accountMatches = accounts.some((a) => a.toLowerCase() === cswLower)

  emit({
    step: 'preflight',
    detail: {
      csw: cswLower,
      connectedAccounts: accounts.map((a) => a.toLowerCase()),
      accountMatches,
      innerCallSelectorIn: params.innerCallData.slice(0, 10),
      innerCallLengthBytesIn: (params.innerCallData.length - 2) / 2,
      wrappedAlready: isAlreadyWrapped,
      wrappedDataSelector: wrappedData.slice(0, 10),
      wrappedDataLengthBytes: (wrappedData.length - 2) / 2,
    },
  })

  if (!accountMatches) {
    throw new Error(
      `Connected wallet does not expose the CSW ${cswLower} via eth_accounts. ` +
        `This lane requires the CSW itself to be the active account (Base App self-auth). ` +
        `Reconnect with the wallet that holds the CSW passkey and retry.`,
    )
  }

  // The tx payload. Notably:
  //   * `from` === `to` === CSW. This is the "smart wallet self-call" shape
  //     Base App's native handler recognises.
  //   * `value` is 0 (omitted via undefined would also work but be explicit).
  //   * No gas fields \u2014 let the wallet/bundler estimate. Base App's handler
  //     wraps this into a UserOp internally and chooses gas itself.
  const txParams = {
    from: params.csw,
    to: params.csw,
    data: wrappedData,
    value: '0x0',
  }

  emit({
    step: 'prompt_sign',
    detail: {
      from: params.csw,
      to: params.csw,
      data: wrappedData.slice(0, 30) + '…',
      dataLengthBytes: (wrappedData.length - 2) / 2,
    },
  })

  let funderTxHash: `0x${string}`
  try {
    funderTxHash = (await params.walletRequest({
      method: 'eth_sendTransaction',
      params: [txParams],
    })) as `0x${string}`
    if (!funderTxHash || typeof funderTxHash !== 'string' || !funderTxHash.startsWith('0x')) {
      throw new Error('Wallet did not return a transaction hash from eth_sendTransaction.')
    }
  } catch (error) {
    emit({
      step: 'broadcast_error',
      detail: { error: error instanceof Error ? error.message : String(error ?? '') },
    })
    throw error
  }

  emit({ step: 'broadcast_success', detail: { funderTxHash } })
  return { funderTxHash }
}
