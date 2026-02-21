type ConfirmIntent = 'approval' | 'swap'

export function SwapConfirmModal(props: {
  intent: ConfirmIntent | null
  busy: string | null
  quoteIsStale: boolean
  executionMode: 'canonical' | 'eoa'
  executionAddress: `0x${string}` | null
  signerAddress: `0x${string}` | null
  tokenInSymbol: string
  tokenOutSymbol: string
  amountInUnits: string
  estimatedOut: string
  approvalRequired: boolean
  permitSignatureRequired: boolean
  permitSignaturePending: boolean
  permitSignatureReady: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  if (!props.intent) return null

  return (
    <div className="fixed inset-0 z-95">
      <button
        type="button"
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        aria-label="Close review sheet"
        onClick={props.onCancel}
      />
      <div className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-xl rounded-t-3xl border border-white/10 bg-vault-card/95 px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4 shadow-[0_-30px_80px_-35px_rgba(0,0,0,0.9)] backdrop-blur-2xl sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2 sm:rounded-3xl sm:pb-4">
        <div className="text-base font-semibold text-white">Review trade</div>
        <div className="mt-3 space-y-1 text-xs text-zinc-400">
          <div>Action: {props.intent === 'approval' ? 'Approval transaction' : 'Swap transaction'}</div>
          <div>
            Executor:{' '}
            {props.executionMode === 'canonical' ? 'Zora Coinbase Smart Wallet' : 'Connected EOA'}{' '}
            ({props.executionAddress ?? 'N/A'})
          </div>
          <div>Owner signer: {props.signerAddress ?? 'N/A'}</div>
          <div>Pair: {props.tokenInSymbol} → {props.tokenOutSymbol}</div>
          <div>Amount: {props.amountInUnits} {props.tokenInSymbol}</div>
          <div>Estimated out: {props.estimatedOut || 'N/A'} {props.tokenOutSymbol}</div>
          <div>
            Permit2:{' '}
            {props.permitSignatureRequired
              ? props.permitSignaturePending
                ? 'Awaiting off-chain wallet signature…'
                : props.permitSignatureReady
                  ? 'Signature captured for this quote'
                  : 'Signature required before submit'
              : 'Not required'}
          </div>
          {props.approvalRequired && props.intent === 'swap' ? (
            <div className="text-amber-300">Approval required first. We will submit approval, then swap.</div>
          ) : null}
          {props.quoteIsStale ? (
            <div className="text-amber-300">Quote is stale. Continue will refresh and rebuild review.</div>
          ) : null}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={props.onCancel}
            disabled={props.busy !== null}
            className="min-h-11 rounded-full border border-zinc-700 px-4 py-2 text-xs disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={props.onConfirm}
            disabled={props.busy !== null}
            className="btn-accent min-h-11 rounded-full px-4 py-2 text-xs disabled:opacity-50"
          >
            {props.quoteIsStale ? 'Refresh review' : 'Continue'}
          </button>
        </div>
      </div>
    </div>
  )
}

