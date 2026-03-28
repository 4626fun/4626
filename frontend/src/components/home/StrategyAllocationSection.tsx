import { motion } from 'framer-motion'

const STRATEGY_CARDS = [
  {
    label: 'Charm',
    percent: '30%',
    description: 'CREATOR/USDC Uniswap V3 LP',
    icon: '/protocols/charm.png',
    iconAlt: 'Charm',
    iconClassName: 'h-3.5 w-3.5 rounded-sm opacity-90',
  },
  {
    label: 'Ajna',
    percent: '30%',
    description: 'Permissionless lending',
    icon: '/protocols/ajna.svg',
    iconAlt: 'Ajna',
    iconClassName: 'h-3.5 w-3.5 opacity-90',
  },
  {
    label: 'Solana',
    percent: '30%',
    description: 'Reserved for Solana route flow',
    icon: '/protocols/solana.svg',
    iconAlt: 'Solana',
    iconClassName: 'h-3.5 w-auto opacity-90',
  },
  {
    label: 'Idle Buffer',
    percent: '10%',
    description: 'Kept liquid for operations and withdrawals',
    icon: null,
    iconAlt: 'Idle Buffer',
    iconClassName: '',
  },
] as const

type StrategyAllocationSectionProps = {
  depositTokens: string
}

export function StrategyAllocationSection({ depositTokens }: StrategyAllocationSectionProps) {
  return (
    <section className="cinematic-section bg-zinc-950/20 !py-10 sm:!py-20 lg:!py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-start lg:gap-12">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="space-y-5 lg:pr-6"
          >
            <span className="label">Vault Strategies</span>
            <div className="space-y-4">
              <h2 className="headline text-3xl sm:text-4xl lg:text-5xl">Default strategy allocation</h2>
              <p className="max-w-md text-[13px] font-light text-zinc-500 sm:text-sm">
                The launch vault spreads the creator coin across three active strategy buckets and leaves 10% idle in the vault
                so redemptions stay flexible.
              </p>
            </div>

            <div className="rounded-3xl border border-white/8 bg-white/[0.035] p-5 shadow-[0_24px_70px_-44px_rgba(0,82,255,0.22)] backdrop-blur-sm sm:p-6">
              <div className="label text-[9px] sm:text-[10px]">Underlying Deposit</div>
              <div className="mt-3 space-y-3">
                <div className="text-3xl sm:text-4xl">
                  <span className="value mono">{depositTokens}</span> <span className="value mono text-zinc-300">TOKEN</span>
                </div>
                <p className="max-w-lg text-xs font-light leading-relaxed text-zinc-500 sm:text-sm">
                  Creator coin deposit routed into the strategy mix on the right. This is the productive capital base of the
                  vault, separate from the share-token launch distribution.
                </p>
              </div>
            </div>
          </motion.div>

          <div className="grid grid-cols-1 gap-px overflow-hidden rounded-3xl border border-white/8 bg-white/[0.035] shadow-[0_24px_80px_-48px_rgba(0,82,255,0.24)] sm:grid-cols-2">
            {STRATEGY_CARDS.map((card, index) => (
              <motion.div
                key={card.label}
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: index * 0.08 }}
                className="space-y-3 bg-black/55 p-5 sm:min-h-[178px] sm:space-y-4 sm:p-7"
              >
                <div className="inline-flex items-center gap-1.5">
                  {card.icon ? (
                    <img
                      src={card.icon}
                      alt={card.iconAlt}
                      width={16}
                      height={16}
                      className={card.iconClassName}
                      loading="lazy"
                    />
                  ) : (
                    <span className="inline-flex h-3.5 w-3.5 rounded-full border border-white/12 bg-white/[0.05]" aria-hidden="true" />
                  )}
                  <span className="label text-[9px] sm:text-[10px]">{card.label}</span>
                </div>
                <div className="value mono text-2xl sm:text-3xl lg:text-4xl">{card.percent}</div>
                <div className="max-w-[16rem] text-[11px] font-light leading-relaxed text-zinc-500 sm:text-xs">
                  {card.description}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
