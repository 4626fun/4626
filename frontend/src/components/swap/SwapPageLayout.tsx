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
    <div className="relative pb-[calc(env(safe-area-inset-bottom)+9rem)] md:pb-0">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-56 bg-[radial-gradient(65%_70%_at_50%_0%,rgba(0,82,255,0.2)_0%,rgba(0,82,255,0.06)_40%,transparent_78%)]" />
      <section className="py-8 sm:py-10">
        <div className="mx-auto max-w-7xl px-3 sm:px-6">
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="text-center sm:text-left">
              <div className="bv-kicker">
                {subtitle ?? 'Trade on Base'}
              </div>
              <h1 className="mt-1 font-display text-[2rem] font-medium tracking-[-0.02em] text-vault-text sm:text-[2.2rem]">
                {title ?? 'Swap'}
              </h1>
            </div>
            <div
              className="bv-chip sm:ml-auto gap-2 font-mono normal-case tracking-[0.02em] text-[11px]"
              aria-live="polite"
              aria-label="Current estimated gas"
            >
              <span className="text-vault-muted">Gas</span>
              <span className="text-vault-text">{gasIndicatorLabel ?? '—'}</span>
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
