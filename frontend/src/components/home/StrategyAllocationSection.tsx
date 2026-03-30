import { motion } from 'framer-motion'

const STRATEGY_CARDS = [
  {
    label: 'Charm',
    percent: '30%',
    description: 'Managed Uniswap V3 CREATOR/USDC LP',
    icon: '/protocols/charm.png',
    iconAlt: 'Charm',
    iconClassName: 'h-3.5 w-3.5 rounded-sm opacity-90',
  },
  {
    label: 'Ajna',
    percent: '30%',
    description: 'Permissionless lending exposure',
    icon: '/protocols/ajna.svg',
    iconAlt: 'Ajna',
    iconClassName: 'h-3.5 w-3.5 opacity-90',
  },
  {
    label: 'Solana',
    percent: '30%',
    description: 'Reserved for Solana route deployment',
    icon: '/protocols/solana.svg',
    iconAlt: 'Solana',
    iconClassName: 'h-3.5 w-auto opacity-90',
  },
  {
    label: 'Idle Reserve',
    percent: '10%',
    description: 'Kept in-vault for withdrawals and execution flexibility',
    icon: null,
    iconAlt: 'Idle Reserve',
    iconClassName: '',
  },
] as const

type StrategyAllocationSectionProps = {
  depositTokens: string
}

export function StrategyAllocationSection({ depositTokens }: StrategyAllocationSectionProps) {
  return (
    <section className="cinematic-section bg-zinc-950/20 !py-10 sm:!py-20 lg:!py-24" data-launch-section="strategy-allocation">
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
                A clean 30/30/30 split across active strategy buckets, with 10% held idle to keep redemptions smooth.
              </p>
            </div>

            <div className="space-y-3 rounded-2xl border border-white/6 bg-white/[0.015] px-4 py-3 sm:px-5 sm:py-4">
              <div className="label text-[9px] sm:text-[10px]">Underlying Deposit</div>
              <div className="text-3xl sm:text-4xl">
                <span className="value mono" data-launch-key="depositTokens">
                  {depositTokens}
                </span>{' '}
                <span className="value mono text-zinc-300">TOKEN</span>
              </div>
              <p className="max-w-lg text-xs font-light leading-relaxed text-zinc-500 sm:text-sm">
                This deposit is the vault&apos;s principal capital base. It feeds strategy deployment and stays separate from
                share-token launch allocation.
              </p>
            </div>
          </motion.div>

          <div className="grid grid-cols-1 gap-5 rounded-2xl border border-white/6 bg-white/[0.01] p-4 sm:grid-cols-2 sm:gap-x-8 sm:gap-y-6 sm:p-5">
            {STRATEGY_CARDS.map((card, index) => (
              <motion.div
                key={card.label}
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: index * 0.08 }}
                className="space-y-2 border-l border-white/8 pl-4 sm:pl-5"
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
                    <span className="inline-flex h-3.5 w-3.5 rounded-full bg-white/[0.28]" aria-hidden="true" />
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
