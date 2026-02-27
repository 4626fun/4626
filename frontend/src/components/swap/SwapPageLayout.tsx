import { ReactNode } from 'react'

import { ChainSelector } from '@/components/trade/ChainSelector'

type SwapPageLayoutProps = {
  children?: ReactNode
  swapPanel: ReactNode
  vaultPanel: ReactNode | null
  selectedChainId: number
  walletChainId?: number
  gasIndicatorLabel: string | null
  walletIndicator?: ReactNode
  onSelectChain: (chainId: number) => void
  title?: string
  subtitle?: string
}

export function SwapPageLayout({
  children,
  swapPanel,
  vaultPanel,
  selectedChainId,
  walletChainId,
  gasIndicatorLabel,
  walletIndicator,
  onSelectChain,
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

          <div className="mb-4 flex flex-col gap-2 rounded-2xl border border-white/8 bg-vault-card/65 p-3 backdrop-blur-xl md:flex-row md:items-center md:justify-between">
            <div className="shrink-0">
              <ChainSelector
                selectedChainId={selectedChainId}
                walletChainId={walletChainId}
                onSelect={onSelectChain}
              />
            </div>
            <div className="flex flex-1 items-center justify-end gap-2">
              {walletIndicator}
              <div
                className="rounded-full border border-white/12 bg-black/35 px-3 py-1.5 text-xs text-zinc-300"
                aria-live="polite"
                aria-label="Current estimated gas"
              >
                Gas {gasIndicatorLabel ?? '—'}
              </div>
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
