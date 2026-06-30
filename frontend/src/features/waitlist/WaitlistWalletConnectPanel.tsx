import { ArrowRight, Check, Wallet } from 'lucide-react'

import { PixelWaveLoader } from '@/components/ui/PixelWaveLoader'
import { PROVIDER_POINTS } from '@/features/waitlist/waitlistTiers'

const WALLET_REWARD_POINTS = PROVIDER_POINTS.external_eoa

function shortAddress(address: string): string {
  const trimmed = address.trim()
  if (trimmed.length < 10) return trimmed
  return `${trimmed.slice(0, 6)}…${trimmed.slice(-4)}`
}

type WaitlistWalletConnectPanelProps = {
  linked: boolean
  linkedAddress?: string | null
  busy: boolean
  onConnect: () => void
  onSkip: () => void
}

export function WaitlistWalletConnectPanel(props: WaitlistWalletConnectPanelProps) {
  const { linked, linkedAddress, busy, onConnect, onSkip } = props

  if (linked) {
    const label = linkedAddress ? shortAddress(linkedAddress) : 'Wallet connected'
    return (
      <div className="mt-6 flex items-center justify-between gap-3 py-1 text-left">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-emerald-400/20 text-emerald-300">
            <Check className="size-3.5" aria-hidden="true" />
          </span>
          <span className="truncate font-mono text-[13px] font-semibold text-emerald-100">{label}</span>
        </div>
        <span className="shrink-0 text-[11px] font-medium tabular-nums text-emerald-300/80">
          +{WALLET_REWARD_POINTS} pts
        </span>
      </div>
    )
  }

  return (
    <div className="mt-6 space-y-2.5 text-left">
      <button
        type="button"
        onClick={onConnect}
        disabled={busy}
        aria-busy={busy}
        className="group relative flex w-full items-center justify-between gap-3 rounded-2xl px-5 py-4 transition-[transform,box-shadow] duration-150 ease-out shadow-[0_5px_0_0_rgba(0,0,0,0.5),0_14px_26px_-10px_rgba(59,130,246,0.35),inset_0_1px_0_0_rgba(255,255,255,0.14)] hover:-translate-y-0.5 hover:shadow-[0_6px_0_0_rgba(0,0,0,0.5),0_20px_36px_-10px_rgba(59,130,246,0.55),inset_0_1px_0_0_rgba(255,255,255,0.18)] active:translate-y-[5px] active:shadow-[0_1px_0_0_rgba(0,0,0,0.5),0_6px_14px_-8px_rgba(59,130,246,0.35),inset_0_1px_0_0_rgba(255,255,255,0.1)] disabled:translate-y-0 disabled:opacity-60"
        style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.1), rgba(255,255,255,0.025))' }}
      >
        <Wallet
          className="pointer-events-none absolute -bottom-8 -right-8 size-40 text-white/[0.08] transition-transform duration-500 ease-out group-hover:-rotate-3 group-hover:scale-105"
          aria-hidden="true"
        />

        <span className="relative min-w-0">
          <span className="block text-[15px] font-semibold text-white">
            {busy ? 'Connecting…' : 'Connect wallet'}
          </span>
          <span className="mt-1 flex items-center gap-1.5 text-[11px] leading-snug">
            {busy ? (
              <span className="text-zinc-400">Choose a wallet…</span>
            ) : (
              <>
                <span className="font-semibold text-[rgb(var(--brand-primary))]">
                  +{WALLET_REWARD_POINTS} pts
                </span>
                <span className="text-zinc-600" aria-hidden="true">
                  ·
                </span>
                <span className="text-zinc-400">optional</span>
              </>
            )}
          </span>
        </span>

        <span className="relative flex shrink-0 items-center">
          {busy ? (
            <PixelWaveLoader name="wave-lr" size={16} color="rgba(255,255,255,0.9)" />
          ) : (
            <ArrowRight
              className="size-4 text-zinc-500 transition group-hover:translate-x-0.5 group-hover:text-white"
              aria-hidden="true"
            />
          )}
        </span>
      </button>

      <button
        type="button"
        onClick={onSkip}
        disabled={busy}
        className="block w-full text-center text-[11px] font-medium tracking-wide text-zinc-500 transition hover:text-zinc-300 disabled:opacity-50"
      >
        Skip for now
      </button>
    </div>
  )
}
