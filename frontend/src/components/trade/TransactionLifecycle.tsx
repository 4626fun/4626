export type TxLifecycleState = 'idle' | 'review' | 'signing' | 'pending' | 'success' | 'error'

export function TransactionLifecycle(props: {
  state: TxLifecycleState
  message?: string
  txHash?: string | null
  chainExplorerBase?: string
}) {
  const { state, message, txHash, chainExplorerBase = 'https://basescan.org/tx/' } = props
  if (state === 'idle' && !message) return null
  const reducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

  const tone = state === 'error' ? 'text-rose-300' : state === 'success' ? 'text-emerald-300' : 'text-zinc-300'
  const label = state === 'pending' ? 'Pending' : state === 'success' ? 'Success' : state === 'error' ? 'Failed' : state === 'review' ? 'Review' : state === 'signing' ? 'Signing' : 'Status'

  return (
    <div className={`mt-3 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs ${reducedMotion ? '' : 'transition-all duration-200'}`}>
      <div className={tone}><span className="font-semibold">{label}:</span> {message ?? 'Ready'}</div>
      {txHash ? (
        <a className="mt-1 inline-block text-fuchsia-300 hover:text-fuchsia-200" href={`${chainExplorerBase}${txHash}`} target="_blank" rel="noreferrer">
          View transaction
        </a>
      ) : null}
    </div>
  )
}
