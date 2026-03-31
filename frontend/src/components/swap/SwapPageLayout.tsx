import { ReactNode } from 'react'

type SwapPageLayoutProps = {
  children?: ReactNode
  swapPanel: ReactNode
  vaultPanel?: ReactNode | null
  title?: string
  subtitle?: string
}

export function SwapPageLayout({
  children,
  swapPanel,
  vaultPanel,
  title,
  subtitle,
}: SwapPageLayoutProps) {
  void subtitle
  const hasSidePanel = Boolean(vaultPanel ?? children)
  return (
    <div className="relative pb-36 md:pb-0">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-40 bg-[radial-gradient(65%_70%_at_50%_0%,rgba(0,82,255,0.14)_0%,rgba(0,82,255,0.04)_44%,transparent_80%)]" />
      <section className={hasSidePanel ? 'py-4 sm:py-5' : 'flex min-h-[calc(100vh-7rem)] items-center py-4 sm:py-5'}>
        <div className="mx-auto max-w-[1400px] px-3 sm:px-6">
          <h1 className="sr-only">{title ?? 'Swap'}</h1>

          <div className={hasSidePanel ? 'grid justify-center gap-5 xl:grid-cols-[minmax(0,430px)_380px]' : 'flex justify-center'}>
            <div className="mx-auto w-full max-w-[430px]">{swapPanel}</div>
            {hasSidePanel ? (
              <div className="xl:sticky xl:top-4 xl:self-start xl:transition-transform xl:duration-300">
                {vaultPanel ?? children ?? null}
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  )
}
