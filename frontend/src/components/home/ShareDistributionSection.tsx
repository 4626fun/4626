import { motion } from 'framer-motion'

const SHARE_DISTRIBUTION_CARDS = [
  {
    title: '40% Uniswap CCA',
    percent: '40%',
    description: 'Auctioned into the weekly Thursday 00:00 UTC launch window for price discovery.',
  },
  {
    title: '40% creator vesting',
    percent: '40%',
    description: 'Locked to the creator on a linear 365-day vest instead of being immediately liquid.',
  },
  {
    title: '20% LP reserve',
    percent: '20%',
    description: 'Held back for post-auction liquidity migration. This is not routed to protocol treasury.',
  },
] as const

type ShareDistributionSectionProps = {
  auctionEpoch: string
  shareTokens: string
}

export function ShareDistributionSection({ auctionEpoch, shareTokens }: ShareDistributionSectionProps) {
  return (
    <section className="cinematic-section !py-10 sm:!py-20 lg:!py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="overflow-hidden rounded-[32px] border border-brand-primary/12 bg-linear-to-br from-brand-primary/[0.06] via-white/[0.025] to-transparent p-6 shadow-[0_28px_90px_-50px_rgba(0,82,255,0.28)] backdrop-blur-sm sm:p-8 lg:p-10">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)] lg:items-start lg:gap-12">
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="space-y-5"
            >
              <span className="label">Share Token Distribution</span>
              <div className="space-y-4">
                <h2 className="headline text-3xl sm:text-4xl lg:text-5xl">How minted shares get routed</h2>
                <div className="text-3xl sm:text-4xl lg:text-[3.5rem]">
                  <span className="value mono text-brand-primary">{shareTokens}</span>
                </div>
                <p className="max-w-lg text-[13px] font-light leading-relaxed text-zinc-400 sm:text-sm">
                  Freshly minted vault shares are split between launch price discovery, creator alignment, and the reserve needed
                  to seed post-auction liquidity.
                </p>
              </div>

              <div className="rounded-3xl border border-white/10 bg-black/35 p-4 text-[11px] font-light leading-relaxed text-zinc-500 sm:p-5 sm:text-xs">
                Default launch epoch: <span className="font-mono text-zinc-200">{auctionEpoch}</span>. Creator vesting is linear
                over 365 days, and the reserve portion stays inside the launch path rather than being carved out to treasury.
              </div>
            </motion.div>

            <div className="grid gap-3 lg:grid-cols-3">
              {SHARE_DISTRIBUTION_CARDS.map((card, index) => (
                <motion.div
                  key={card.title}
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: index * 0.08 }}
                  className="rounded-3xl border border-white/10 bg-black/45 p-5 shadow-[0_18px_60px_-44px_rgba(0,82,255,0.32)]"
                >
                  <div className="label text-[9px] sm:text-[10px]">{card.title}</div>
                  <div className="mt-4 value mono text-3xl text-brand-primary sm:text-4xl">{card.percent}</div>
                  <p className="mt-4 text-[11px] font-light leading-relaxed text-zinc-400 sm:text-xs">{card.description}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
