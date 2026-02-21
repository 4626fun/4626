type ConfirmIntent = 'approval' | 'swap'

export function SwapConfirmModal(props: {
  intent: ConfirmIntent | null
  busy: string | null
  quoteIsStale: boolean
  canonicalAddress: `0x${string}` | null
  signerAddress: `0x${string}` | null
  tokenInSymbol: string
  tokenOutSymbol: string
  amountInUnits: string
  estimatedOut: string
  approvalRequired: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  if (!props.intent) return null

  return (
    <div className="fixed inset-0 z-90 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-zinc-950 p-5 space-y-4">
        <div className="text-white font-semibold text-lg">Review trade</div>
        <div className="text-xs text-zinc-400 space-y-1">
          <div>Action: {props.intent === 'approval' ? 'Approval transaction' : 'Swap transaction'}</div>
          <div>Executor: {props.canonicalAddress ?? 'N/A'}</div>
          <div>Owner signer: {props.signerAddress ?? 'N/A'}</div>
          <div>Pair: {props.tokenInSymbol} → {props.tokenOutSymbol}</div>
          <div>Amount: {props.amountInUnits} {props.tokenInSymbol}</div>
          <div>Estimated out: {props.estimatedOut || 'N/A'} {props.tokenOutSymbol}</div>
          {props.approvalRequired && props.intent === 'swap' ? (
            <div className="text-amber-300">Approval required first. We will submit approval, then swap.</div>
          ) : null}
          {props.quoteIsStale ? (
            <div className="text-amber-300">Quote is stale. Refresh quote before confirming.</div>
          ) : null}
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={props.onCancel}
            disabled={props.busy !== null}
            className="rounded-full border border-zinc-700 px-4 py-2 text-xs disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={props.onConfirm}
            disabled={props.busy !== null || props.quoteIsStale}
            className="btn-accent rounded-full px-4 py-2 text-xs disabled:opacity-50"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  )
}

