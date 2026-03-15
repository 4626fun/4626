import { X } from 'lucide-react'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'

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

  const slippagePresets = ['0.02', '0.1', '0.5', '1']
  const slippageNum = parseFloat(props.slippagePct)
  const slippageTooHigh = Number.isFinite(slippageNum) && slippageNum > 1
  const slippageTooLow = Number.isFinite(slippageNum) && slippageNum > 0 && slippageNum < 0.05

  return (
    <div className="fixed inset-0 z-95">
      <button
        type="button"
        aria-label="Close trade settings"
        className="absolute inset-0 bg-black/70 backdrop-blur-[6px]"
        onClick={props.onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Trade settings"
        className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-xl rounded-t-2xl border border-white/12 bg-linear-to-b from-vault-card/92 to-vault-cardRaised/78 px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4 shadow-[0_-20px_60px_-20px_rgba(0,0,0,0.8)] backdrop-blur-xl sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:pb-4"
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="text-sm font-medium text-vault-text">Trade settings</div>
          <button
            type="button"
            onClick={props.onClose}
            className="rounded-lg p-1 -mr-1 text-vault-subtext hover:text-vault-text hover:bg-white/6 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-primary"
            aria-label="Close settings"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Slippage */}
          <div>
            <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.12em] text-vault-subtext">Slippage tolerance</label>
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <div className="relative">
                <input
                  inputMode="decimal"
                  id="slippage-input"
                  aria-label="Slippage percentage"
                  className="h-10 w-full rounded-xl border border-white/12 bg-white/6 px-3 pr-7 text-sm text-vault-text placeholder:text-vault-subtext focus:outline-none focus:ring-2 focus:ring-brand-primary/35 focus:border-brand-primary/50 transition-all duration-200"
                  value={props.slippagePct}
                  onChange={(e) => props.onSetSlippagePct(e.target.value)}
                  placeholder="0.5"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-zinc-500 pointer-events-none">
                  %
                </span>
              </div>
              <div className="flex items-center gap-0.5 rounded-xl border border-white/12 bg-white/6 p-0.5">
                {slippagePresets.map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => props.onSetSlippagePct(value)}
                    className={`min-h-8 rounded-lg border px-2 py-1 text-[11px] transition-all duration-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-primary ${
                      props.slippagePct === value
                        ? 'border-brand-primary/35 bg-brand-primary/20 text-white font-medium'
                        : 'border-transparent text-zinc-400 hover:border-white/10 hover:text-zinc-200'
                    }`}
                  >
                    {value}%
                  </button>
                ))}
              </div>
            </div>
            {slippageTooHigh && (
              <Alert variant="warning" className="mt-2">
                High slippage — you may receive significantly less than expected. Consider using 0.5% or lower.
              </Alert>
            )}
            {slippageTooLow && (
              <Alert variant="info" className="mt-2">
                Very low slippage — your transaction may fail if the price moves at all.
              </Alert>
            )}
          </div>

          {/* Deadline */}
          <div>
            <label htmlFor="deadline-input" className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.12em] text-vault-subtext">
              Transaction deadline
            </label>
            <div className="relative">
                <input
                  inputMode="numeric"
                  id="deadline-input"
                  aria-label="Deadline in minutes"
                  className="h-10 w-full rounded-xl border border-white/12 bg-white/6 px-3 pr-16 text-sm text-vault-text placeholder:text-vault-subtext focus:outline-none focus:ring-2 focus:ring-brand-primary/35 focus:border-brand-primary/50 transition-all duration-200"
                  value={props.deadlineMinutes}
                  onChange={(e) => props.onSetDeadlineMinutes(e.target.value)}
                  placeholder="15"
                />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500 pointer-events-none">
                minutes
              </span>
            </div>
            <p className="mt-1 text-[11px] text-vault-subtext">
              Transaction will revert if not confirmed within this time.
            </p>
          </div>

          <Button
            variant="secondary"
            size="md"
            onClick={props.onClose}
            disabled={props.busy}
            className="w-full"
          >
            Done
          </Button>
        </div>
      </div>
    </div>
  )
}
