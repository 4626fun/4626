import { ReactNode } from 'react'

type SwapPageLayoutProps = {
  children?: ReactNode
  swapPanel: ReactNode
  vaultPanel: ReactNode | null
  gasIndicatorLabel: string | null
  title?: string
  subtitle?: string
}

export function SwapPageLayout({
  children,
  swapPanel,
  vaultPanel,
  gasIndicatorLabel,
  title,
  subtitle,
}: SwapPageLayoutProps) {
  return (
    <div className="pb-[calc(env(safe-area-inset-bottom)+9rem)] md:pb-0">
      <section className="py-8 sm:py-10">
        <div className="mx-auto max-w-7xl px-3 sm:px-6">
          <div className="mb-5 text-center sm:text-left">
            <div className="text-[10px] uppercase tracking-[0.24em] text-zinc-500">
              {subtitle ?? 'Trade on Base'}
            </div>
            <h1 className="mt-1 text-[1.9rem] font-semibold tracking-tight text-white">
              {title ?? 'Swap'}
            </h1>
          </div>

          <div className="mb-4 flex items-center justify-end">
            <div
              className="rounded-full border border-white/12 bg-black/35 px-3 py-1.5 text-xs text-zinc-300"
              aria-live="polite"
              aria-label="Current estimated gas"
            >
              Gas {gasIndicatorLabel ?? '—'}
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
            <div className="mx-auto w-full max-w-2xl">{swapPanel}</div>
            <div className="lg:sticky lg:top-6 lg:self-start">{vaultPanel ?? children ?? null}</div>
          </div>
        </div>
      </section>
    </div>
  )
}
