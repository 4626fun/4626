import type { CSSProperties } from 'react'
import { ArrowRight, Check } from 'lucide-react'

import { PixelWaveLoader } from '@/components/ui/PixelWaveLoader'
import { PROVIDER_POINTS } from '@/features/waitlist/waitlistTiers'

/**
 * Gentle gradient applied to the X watermark so the full glyph stays visible
 * but reads as bleeding through the surface — slightly more present toward the
 * card interior, never fully dissolving any part of the logo.
 */
const X_WATERMARK_FADE: CSSProperties = {
  WebkitMaskImage: 'linear-gradient(to top left, rgba(0,0,0,0.45), black 80%)',
  maskImage: 'linear-gradient(to top left, rgba(0,0,0,0.45), black 80%)',
}

type WaitlistTwitterLinkPanelProps = {
  linked: boolean
  busy: boolean
  onConnect: () => void
  onSkip?: () => void
}

// Mirrors the server `LINK_POINTS` reward written on a `link_twitter` event.
const X_REWARD_POINTS = PROVIDER_POINTS.twitter

function XLogo({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} style={style} fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  )
}

export function WaitlistTwitterLinkPanel(props: WaitlistTwitterLinkPanelProps) {
  const { linked, busy, onConnect, onSkip } = props

  if (linked) {
    return (
      <div className="mt-6 flex items-center justify-between gap-3 py-1 text-left">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-emerald-400/20 text-emerald-300">
            <Check className="size-3.5" aria-hidden="true" />
          </span>
          <span className="text-[13px] font-semibold text-emerald-100">X connected</span>
        </div>
        <span className="shrink-0 text-[11px] font-medium tabular-nums text-emerald-300/80">
          +{X_REWARD_POINTS} pts
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
        className="group relative flex w-full items-center justify-between gap-3 rounded-2xl px-5 py-4 transition-[transform,box-shadow] duration-150 ease-out shadow-[0_5px_0_0_rgba(0,0,0,0.5),0_14px_26px_-10px_rgba(59,130,246,0.45),inset_0_1px_0_0_rgba(255,255,255,0.14)] hover:-translate-y-0.5 hover:shadow-[0_6px_0_0_rgba(0,0,0,0.5),0_20px_36px_-10px_rgba(59,130,246,0.7),inset_0_1px_0_0_rgba(255,255,255,0.18)] active:translate-y-[5px] active:shadow-[0_1px_0_0_rgba(0,0,0,0.5),0_6px_14px_-8px_rgba(59,130,246,0.4),inset_0_1px_0_0_rgba(255,255,255,0.1)] disabled:translate-y-0 disabled:opacity-60"
        style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.1), rgba(255,255,255,0.025))' }}
      >
        {/* Full X glyph as a watermark that expands beyond the card edges, faded gradually via mask. */}
        <XLogo
          className="pointer-events-none absolute -bottom-10 -right-10 size-52 text-white/[0.16] transition-transform duration-500 ease-out group-hover:-rotate-6 group-hover:scale-105"
          style={X_WATERMARK_FADE}
        />

        <span className="relative min-w-0">
          <span className="block text-[15px] font-semibold text-white">{busy ? 'Linking…' : 'Link X'}</span>
          <span className="mt-1 flex items-center gap-1.5 text-[11px] leading-snug">
            {busy ? (
              <span className="text-zinc-400">Opening X…</span>
            ) : (
              <>
                <span className="font-semibold text-[rgb(var(--brand-primary))]">
                  +{X_REWARD_POINTS} pts
                </span>
                <span className="text-zinc-600" aria-hidden="true">
                  ·
                </span>
                <span className="text-zinc-400">move up the waitlist</span>
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

      {onSkip ? (
        <button
          type="button"
          onClick={onSkip}
          disabled={busy}
          className="block w-full text-center text-[11px] font-medium tracking-wide text-zinc-500 transition hover:text-zinc-300 disabled:opacity-50"
        >
          Skip for now
        </button>
      ) : null}
    </div>
  )
}
