import { motion } from 'framer-motion'
import { SHARE_DISTRIBUTION_ROWS } from './launchConfig'

type ShareDistributionSectionProps = {
  auctionEpoch: string
  shareTokens: string
}

export function ShareDistributionSection({ auctionEpoch, shareTokens }: ShareDistributionSectionProps) {
  return (
    <section className="cinematic-section !py-10 sm:!py-20 lg:!py-24" data-launch-section="share-distribution">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
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
              <h2 className="headline text-3xl sm:text-4xl lg:text-5xl">Share launch allocation</h2>
              <div className="text-3xl sm:text-4xl lg:text-[3.5rem]">
                <span className="value mono text-brand-primary" data-launch-key="shareTokens">
                  {shareTokens}
                </span>
              </div>
              <p className="max-w-lg text-[13px] font-light leading-relaxed text-zinc-400 sm:text-sm">
                Minted shares are allocated across launch discovery, creator alignment, and the reserve required for post-auction
                liquidity.
              </p>
            </div>

            <p className="max-w-lg rounded-xl border border-white/6 bg-black/10 px-3 py-2 text-[11px] font-light leading-relaxed text-zinc-500 sm:text-xs">
              Default launch epoch: <span className="font-mono text-zinc-200">{auctionEpoch}</span>. Creator vesting streams
              linearly over 365 days, and the reserve remains in launch liquidity rather than treasury extraction.
            </p>
          </motion.div>

          <div className="space-y-1 rounded-2xl border border-white/6 bg-black/10 px-4 py-2 sm:px-5 sm:py-3">
            {SHARE_DISTRIBUTION_ROWS.map((card, index) => (
              <motion.div
                key={card.title}
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: index * 0.08 }}
                className="grid grid-cols-[auto,1fr] gap-4 border-b border-white/8 py-4 first:pt-0 last:border-b-0 last:pb-0 sm:gap-6 sm:py-5"
              >
                <div className="value mono text-3xl text-brand-primary sm:text-4xl">{card.percent}</div>
                <div className="space-y-1.5">
                  <div className="label text-[9px] sm:text-[10px]">{card.title}</div>
                  <p className="text-[11px] font-light leading-relaxed text-zinc-400 sm:text-xs">{card.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
