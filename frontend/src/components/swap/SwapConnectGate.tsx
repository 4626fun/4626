import { Wallet } from 'lucide-react'

import { Button } from '@/components/ui/Button'
import type { SwapConnectGateResult } from '@/lib/swap/connectGate'

type SwapConnectGateProps = {
  gate: SwapConnectGateResult
  /** True while an auth/login request is in flight. */
  busy: boolean
  /** Non-empty when the most recent auth attempt failed. */
  errorMessage?: string | null
  onPrimaryAction: () => void
}

/**
 * Route-level gate shown in place of the Swap form when the user cannot
 * meaningfully interact yet. Intentionally single-CTA per the waitlist /
 * onboarding simplicity rule — no secondary actions, no protocol jargon.
 *
 * The gate state itself comes from `deriveSwapConnectGate` in
 * `frontend/src/lib/swap/connectGate.ts`, which is covered by unit tests.
 */
export function SwapConnectGate(props: SwapConnectGateProps) {
  const { gate } = props

  return (
    <div
      className="bv-panel border-0 vault-hover-lift flex flex-col items-center gap-4 p-8 text-center"
      data-swap-gate={gate.state}
    >
      <div
        className="flex h-12 w-12 items-center justify-center rounded-full bg-[linear-gradient(135deg,rgba(0,82,255,0.95),rgba(90,138,255,0.7))] text-white ring-1 ring-white/15"
        aria-hidden="true"
      >
        <Wallet className="h-5 w-5" />
      </div>

      <div className="space-y-1.5">
        <h2 className="text-lg font-semibold text-white">{gate.title}</h2>
        <p className="mx-auto max-w-[320px] text-sm text-zinc-400">{gate.message}</p>
      </div>

      {gate.showSpinner ? (
        <div
          className="h-8 w-8 animate-spin rounded-full border-2 border-white/15 border-t-white/70"
          role="status"
          aria-label={gate.spinnerLabel || 'Loading'}
        />
      ) : (
        <Button
          variant="primary"
          size="lg"
          className="mt-1 h-11 w-full max-w-[260px] rounded-xl shadow-[0_12px_34px_-14px_rgba(0,82,255,0.9)]"
          loading={props.busy}
          disabled={props.busy || !gate.actionLabel}
          onClick={props.onPrimaryAction}
        >
          {gate.actionLabel}
        </Button>
      )}

      {props.errorMessage ? (
        <div className="max-w-[320px] text-xs text-red-400/90" role="alert">
          {props.errorMessage}
        </div>
      ) : null}
    </div>
  )
}
