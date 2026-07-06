import { Wallet } from 'lucide-react'

import { PixelWaveLoader } from '@/components/ui/PixelWaveLoader'

type WaitlistReturningWalletSignInProps = {
  busy: boolean
  onSignIn: () => void
  onCancel?: () => void
}

export function WaitlistReturningWalletSignIn(props: WaitlistReturningWalletSignInProps) {
  const { busy, onSignIn, onCancel } = props

  return (
    <div className="space-y-3 text-center">
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-white/8" aria-hidden="true" />
        <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-zinc-500">
          Already joined?
        </span>
        <div className="h-px flex-1 bg-white/8" aria-hidden="true" />
      </div>

      <button
        type="button"
        onClick={busy ? onCancel ?? undefined : onSignIn}
        disabled={busy && !onCancel}
        aria-busy={busy}
        className="group relative flex w-full items-center justify-center gap-2.5 rounded-full border border-white/10 bg-white/[0.03] px-5 py-3.5 text-[14px] font-medium text-zinc-200 transition hover:border-white/16 hover:bg-white/[0.06] disabled:opacity-60"
      >
        {busy && onCancel ? (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-full bg-red-500/22 opacity-0 transition-opacity duration-150 group-hover:opacity-100"
          />
        ) : null}
        {busy ? (
          <span className="relative z-10 flex w-full items-center justify-center">
            <span className="inline-flex items-center gap-2.5 transition-opacity duration-150 group-hover:opacity-0">
              <PixelWaveLoader name="wave-lr" size={14} color="rgba(255,255,255,0.85)" />
              <span>Connecting wallet…</span>
            </span>
            {onCancel ? (
              <span className="pointer-events-none absolute inset-0 inline-flex items-center justify-center rounded-full text-[13px] font-semibold text-red-100 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                Cancel wallet sign-in
              </span>
            ) : null}
          </span>
        ) : (
          <span className="relative z-10 inline-flex items-center gap-2.5">
            <Wallet className="size-4 text-zinc-400 transition group-hover:text-zinc-200" aria-hidden="true" />
            <span>Sign in with linked wallet</span>
          </span>
        )}
      </button>
    </div>
  )
}
