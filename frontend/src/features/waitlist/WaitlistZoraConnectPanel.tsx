import { ArrowRight } from 'lucide-react'

import { PixelWaveLoader } from '@/components/ui/PixelWaveLoader'
import { PROVIDER_POINTS } from '@/features/waitlist/waitlistTiers'

const ZORA_REWARD_POINTS = PROVIDER_POINTS.zora_cross_app
const ZORA_LOGO_SRC = '/brands/zora-token.svg'

type WaitlistZoraConnectPanelProps = {
  busy: boolean
  onConnect: () => void
  onSkip: () => void
}

export function ZoraLogo(props: { className?: string }) {
  return (
    <img
      src={ZORA_LOGO_SRC}
      alt=""
      aria-hidden="true"
      draggable={false}
      className={props.className}
      decoding="async"
    />
  )
}

export function WaitlistZoraConnectPanel(props: WaitlistZoraConnectPanelProps) {
  const { busy, onConnect, onSkip } = props

  return (
    <div className="mt-6 space-y-2.5 text-left">
      <button
        type="button"
        onClick={onConnect}
        disabled={busy}
        aria-busy={busy}
        className="group relative flex w-full items-center justify-between gap-3 rounded-2xl px-5 py-4 transition-[transform,box-shadow] duration-150 ease-out shadow-[0_5px_0_0_rgba(0,0,0,0.5),0_14px_26px_-10px_rgba(99,102,241,0.4),inset_0_1px_0_0_rgba(255,255,255,0.14)] hover:-translate-y-0.5 hover:shadow-[0_6px_0_0_rgba(0,0,0,0.5),0_20px_36px_-10px_rgba(99,102,241,0.6),inset_0_1px_0_0_rgba(255,255,255,0.18)] active:translate-y-[5px] active:shadow-[0_1px_0_0_rgba(0,0,0,0.5),0_6px_14px_-8px_rgba(99,102,241,0.4),inset_0_1px_0_0_rgba(255,255,255,0.1)] disabled:translate-y-0 disabled:opacity-60"
        style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.1), rgba(255,255,255,0.025))' }}
      >
        <ZoraLogo className="pointer-events-none absolute -bottom-10 -right-10 size-44 rounded-full opacity-[0.14] transition-transform duration-500 ease-out group-hover:rotate-6 group-hover:scale-105" />

        <span className="relative flex min-w-0 items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-black/20 ring-1 ring-white/10">
            <ZoraLogo className="size-full object-cover" />
          </span>
          <span className="min-w-0">
            <span className="block text-[15px] font-semibold text-white">
              {busy ? 'Connecting…' : 'Connect Zora'}
            </span>
            <span className="mt-1 flex items-center gap-1.5 text-[11px] leading-snug">
              {busy ? (
                <span className="text-zinc-400">Opening Zora…</span>
              ) : (
                <>
                  <span className="font-semibold text-[rgb(var(--brand-primary))]">
                    +{ZORA_REWARD_POINTS} pts
                  </span>
                  <span className="text-zinc-600" aria-hidden="true">
                    ·
                  </span>
                  <span className="text-zinc-400">biggest boost</span>
                </>
              )}
            </span>
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
