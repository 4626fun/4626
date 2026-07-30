import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

import { PageMeta } from '@/components/seo/PageMeta'
import { CreatorVaultSim } from '@/features/sim/creator-vault/CreatorVaultSim'
import { getHostMode, getMarketingBaseUrl, isCurrentWindowUrl } from '@/lib/env/host'

/** Marketing teaching page — must not call wagmi (4626.fun has no WagmiProvider). */
export function CreatorVaultSimPage() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (getHostMode() !== 'app') return
    const target = `${getMarketingBaseUrl()}/sim/creator-vault`
    if (isCurrentWindowUrl(target)) return
    window.location.replace(target)
  }, [])

  return (
    <div className="relative">
      <PageMeta
        title="Creator Vault simulation"
        description="Interactive Creator Vault flywheel: deposit, ▢/■ shares, CCA, Charm/Ajna legs, and fee lanes. Illustrative — not live onchain data."
        canonicalPath="/sim/creator-vault"
      />

      <section className="cinematic-section">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pb-16">
          <div className="mb-8">
            <Link
              to="/sim"
              className="inline-flex items-center gap-2 text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="label">All simulations</span>
            </Link>
          </div>

          <CreatorVaultSim />
        </div>
      </section>
    </div>
  )
}
