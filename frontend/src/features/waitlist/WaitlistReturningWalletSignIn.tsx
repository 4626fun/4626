import type { ReactNode } from 'react'
import { Wallet } from 'lucide-react'

import { PixelWaveLoader } from '@/components/ui/PixelWaveLoader'

type WaitlistReturningWalletSignInProps = {
  busy: boolean
  onSignIn: () => void
  onCancel?: () => void
  /** Overrides the default static "Already joined?" divider label — lets a
   * caller animate something into this spot (e.g. the waitlist flow's
   * "already joined" count docking here) without this component needing to
   * know anything about that animation. */
  labelSlot?: ReactNode
}

export function WaitlistReturningWalletSignIn(props: WaitlistReturningWalletSignInProps) {
  const { busy, onSignIn, onCancel, labelSlot } = props

  return (
    <div className="space-y-2.5 text-center">
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-white/8" aria-hidden="true" />
        {labelSlot ?? (
          <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-zinc-500">
            Already joined?
          </span>
        )}
        <div className="h-px flex-1 bg-white/8" aria-hidden="true" />
      </div>

      {/* Collapsed to a quiet text link by default — the full bordered pill
          button was competing visually with the primary "Join with email"
          CTA above it. Only busy state (actively connecting) needs the
          extra weight of a status row with a cancel action. */}
      {busy ? (
        <div className="flex items-center justify-center gap-2 text-[13px] text-zinc-400" aria-busy="true">
          <PixelWaveLoader name="wave-lr" size={13} color="rgba(255,255,255,0.75)" />
          <span>Connecting wallet…</span>
          {onCancel ? (
            <button
              type="button"
              onClick={onCancel}
              className="font-medium text-zinc-500 underline-offset-2 transition hover:text-red-300 hover:underline"
            >
              Cancel
            </button>
          ) : null}
        </div>
      ) : (
        <button
          type="button"
          onClick={onSignIn}
          className="group inline-flex items-center gap-1.5 text-[13px] font-medium text-zinc-500 transition hover:text-zinc-200"
        >
          <Wallet className="size-3.5 text-zinc-500 transition group-hover:text-zinc-300" aria-hidden="true" />
          <span>Sign in with linked wallet</span>
        </button>
      )}
    </div>
  )
}
