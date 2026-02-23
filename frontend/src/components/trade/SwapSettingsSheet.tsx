import { X } from 'lucide-react'

export function SwapSettingsSheet(props: {
  open: boolean
  busy: boolean
  slippagePct: string
  deadlineMinutes: string
  onClose: () => void
  onSetSlippagePct: (next: string) => void
  onSetDeadlineMinutes: (next: string) => void
}) {
  if (!props.open) return null

  return (
    <div className="fixed inset-0 z-95">
      <button
        type="button"
        aria-label="Close trade settings"
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={props.onClose}
      />
      <div className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-xl rounded-t-3xl border border-white/10 bg-vault-card/95 px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4 shadow-[0_-30px_80px_-35px_rgba(0,0,0,0.9)] backdrop-blur-2xl sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2 sm:rounded-3xl sm:pb-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-400">Trade settings</div>
          <button
            type="button"
            onClick={props.onClose}
            className="rounded-full border border-white/15 p-2 text-zinc-400 hover:text-zinc-200"
            aria-label="Close settings sheet"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="label">Slippage %</label>
            <input
              inputMode="decimal"
              className="mt-1 min-h-11 w-full rounded-xl border border-zinc-700 bg-black/35 px-3 py-2 text-sm text-white"
              value={props.slippagePct}
              onChange={(e) => props.onSetSlippagePct(e.target.value)}
              placeholder="0.5"
            />
          </div>
          <div>
            <label className="label">Deadline (minutes)</label>
            <input
              inputMode="numeric"
              className="mt-1 min-h-11 w-full rounded-xl border border-zinc-700 bg-black/35 px-3 py-2 text-sm text-white"
              value={props.deadlineMinutes}
              onChange={(e) => props.onSetDeadlineMinutes(e.target.value)}
              placeholder="15"
            />
          </div>
          <button
            type="button"
            onClick={props.onClose}
            disabled={props.busy}
            className="mt-1 min-h-11 w-full rounded-2xl border border-white/20 bg-white/5 px-4 py-3 text-sm font-medium text-white disabled:opacity-50"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
