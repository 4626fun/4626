import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'

import { Liquid } from '@/components/canvasui/Liquid'
import { PageMeta } from '@/components/seo/PageMeta'
import { cn } from '@/lib/shared/utils'

type ShowcaseCardId = 1 | 2 | 3

type ShowcaseCard = {
  id: ShowcaseCardId
  eyebrow: string
  title: string
  body: string
  signal?: {
    direction: 'SHORT' | 'LONG'
    window: string
    rationale: string
  }
}

const CARDS: ShowcaseCard[] = [
  {
    id: 1,
    eyebrow: '4626',
    title: 'When others zig, this signal zags.',
    body: 'Paid counter-trade signal on Virtuals ACP.',
  },
  {
    id: 2,
    eyebrow: 'Deliverable',
    title: 'Signal',
    body: 'Paid on ACP · observe-only until funded',
    signal: {
      direction: 'SHORT',
      window: '7d bias',
      rationale: 'Inverse read — price zig up, signal zags short.',
    },
  },
  {
    id: 3,
    eyebrow: 'Source',
    title: 'github.com/4626fun/4626',
    body: 'Public adapter · payment gate · tool quotas · tests',
  },
]

function parseCardId(raw: string | null): ShowcaseCardId {
  const n = Number.parseInt(String(raw ?? '1'), 10)
  if (n === 2 || n === 3) return n
  return 1
}

/**
 * Local capture surface for the Virtuals showcase demo video.
 * Unlinked / noindex — not part of product IA.
 */
export function ShowcaseDemoInterstitial() {
  const [params] = useSearchParams()
  const cardId = parseCardId(params.get('card'))
  const card = useMemo(() => CARDS.find((c) => c.id === cardId) ?? CARDS[0], [cardId])

  return (
    <>
      <PageMeta
        title="4626 showcase demo (local)"
        description="Capture-only interstitial for Virtuals showcase video."
        robots="noindex,follow"
        canonicalPath="/_showcase-demo"
      />
      <div className="fixed inset-0 z-[100] bg-[#0a0b0d] text-white">
        <Liquid
          className="h-full w-full"
          style={{ height: '100%', width: '100%' }}
          rainbow={false}
          color={[0.72, 0.76, 0.8]}
          intensity={1.1}
          blend={2.2}
          distortion={0.22}
          force={0.85}
          radius={0.28}
        >
          <div className="flex h-full w-full items-center justify-center px-10 py-16">
            <div className="flex w-full max-w-4xl flex-col gap-8">
              <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-white/45">
                {card.eyebrow}
              </p>
              <h1 className="headline text-4xl leading-tight text-white sm:text-5xl md:text-6xl">
                {card.title}
              </h1>
              {card.signal ? (
                <div
                  className={cn(
                    'rounded-2xl border border-white/15 bg-white/[0.04] p-6 backdrop-blur-sm',
                    'shadow-[0_0_0_1px_rgba(255,255,255,0.04)]',
                  )}
                >
                  <div className="flex flex-wrap items-baseline gap-4">
                    <span className="text-3xl font-light tracking-tight text-white">
                      {card.signal.direction}
                    </span>
                    <span className="text-sm uppercase tracking-[0.18em] text-white/50">
                      {card.signal.window}
                    </span>
                  </div>
                  <p className="mt-4 max-w-xl text-base font-light leading-relaxed text-white/70">
                    {card.signal.rationale}
                  </p>
                </div>
              ) : null}
              <p className="max-w-2xl text-lg font-light leading-relaxed text-white/60">
                {card.body}
              </p>
            </div>
          </div>
        </Liquid>
      </div>
    </>
  )
}
