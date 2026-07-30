import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'

import { PageMeta } from '@/components/seo/PageMeta'
import { getHostMode, getMarketingBaseUrl, isCurrentWindowUrl } from '@/lib/env/host'

const surface =
  'glass-card ring-1 ring-white/5 shadow-[0_30px_80px_rgba(0,0,0,0.6)]'

const SIMS = [
  {
    path: '/sim/creator-vault',
    title: 'Creator Vault flywheel',
    description:
      'Deposit → ▢ / ■ → CCA → Charm·Ajna·idle legs → trade-fee vs payout lanes. Edit parameters and watch the mechanism.',
  },
] as const

/** Marketing teaching hub — must not call wagmi (4626.fun has no WagmiProvider). */
export function SimHub() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (getHostMode() !== 'app') return
    const target = `${getMarketingBaseUrl()}/sim`
    if (isCurrentWindowUrl(target)) return
    window.location.replace(target)
  }, [])

  return (
    <div className="relative">
      <PageMeta
        title="Mechanism simulations"
        description="Interactive, illustrative Creator Vault mechanism simulations — not live onchain data."
        canonicalPath="/sim"
      />

      <section className="cinematic-section">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="space-y-10"
          >
            <div className="space-y-4 max-w-2xl">
              <div className="flex items-center gap-3">
                <img src="/assets/logo-mark.svg" alt="4626" className="h-7 w-7 opacity-90" />
                <span className="label">4626</span>
              </div>
              <h1 className="headline text-4xl sm:text-5xl">Mechanism simulations</h1>
              <p className="text-zinc-400 text-sm sm:text-base font-light leading-relaxed">
                Interactive diagrams for how Creator Vaults move value — accelerated and illustrative,
                not live chain data.
              </p>
            </div>

            <div className="space-y-3">
              {SIMS.map((sim) => (
                <Link
                  key={sim.path}
                  to={sim.path}
                  className={`${surface} block p-6 sm:p-7 transition-colors hover:ring-white/10`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-2 min-w-0">
                      <div className="text-white text-lg font-light">{sim.title}</div>
                      <p className="text-sm text-zinc-400 font-light leading-relaxed">
                        {sim.description}
                      </p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-zinc-500 shrink-0 mt-1" />
                  </div>
                </Link>
              ))}
            </div>

            <p className="text-[11px] text-zinc-500 font-light max-w-prose">
              More sims (CCA graduation, gauge / lottery, share mesh) may land here later.
            </p>
          </motion.div>
        </div>
      </section>
    </div>
  )
}
