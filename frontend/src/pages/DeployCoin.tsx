import { Link } from 'react-router-dom'

import { LaunchCoinCard } from '@/features/waitlist/LaunchCoinCard'
import { PageMeta } from '@/components/seo/PageMeta'
import { useAccountContext } from '@/wallet/accountContext'

export function DeployCoin() {
  const accountContext = useAccountContext()
  const canonicalSmartWalletAddress = accountContext.cswAddress ?? null
  const ownerSignerAddress = accountContext.signerAddress ?? null

  return (
    <div className="vault-shell relative">
      <PageMeta
        title="Deploy Coin"
        description="Launch your Zora Creator Coin on Base with gas-sponsored creation."
        canonicalPath="/deploy/coin"
      />

      <section className="cinematic-section">
        <div className="max-w-[1400px] mx-auto px-6">
          <div className="space-y-8">
            <div className="flex items-start justify-between gap-6">
              <div className="space-y-2">
                <span className="label">Deploy</span>
                <h1 className="headline text-4xl sm:text-6xl">Launch Coin</h1>
                <p className="text-zinc-600 text-sm font-light">
                  Launch your Zora Creator Coin first, then continue to vault deployment.
                </p>
                <div className="inline-flex items-center rounded-xl border border-white/10 bg-white/5 p-1 text-[11px]">
                  <span className="rounded-lg bg-white/12 px-3 py-1 text-white">Coin</span>
                  <Link className="rounded-lg px-3 py-1 text-zinc-400 hover:text-white" to="/deploy/vault">
                    Vault
                  </Link>
                </div>
              </div>
              <div className="vault-pill normal-case tracking-[0.02em] px-3 py-1 gap-2">
                <img src="/protocols/base.png" alt="" aria-hidden="true" loading="lazy" className="w-3.5 h-3.5 opacity-90" />
                Base
              </div>
            </div>

            <div className="max-w-3xl space-y-4">
              <LaunchCoinCard
                smartWalletAddress={canonicalSmartWalletAddress}
                ownerAddress={ownerSignerAddress}
              />

              <div className="text-xs text-zinc-600">
                After your coin is live, continue to{' '}
                <Link to="/deploy/vault" className="text-brand-primary hover:text-brand-accent">
                  Vault deploy
                </Link>
                .
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
