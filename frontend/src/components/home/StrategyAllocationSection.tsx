import { motion } from 'framer-motion'
import { STRATEGY_CARDS } from './launchConfig'
import { TokenFlowViz } from './TokenFlowViz'

type StrategyAllocationSectionProps = {
  depositTokens: string
}

export function StrategyAllocationSection({ depositTokens }: StrategyAllocationSectionProps) {
  return (
    <section className="cinematic-section no-divider-top no-divider-bottom bg-zinc-950/20 !py-10 sm:!py-20 lg:!py-24" data-launch-section="strategy-allocation">
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
              <p className="max-w-md text-[13px] font-light text-zinc-300 sm:text-sm">
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
              <p className="max-w-lg text-xs font-light leading-relaxed text-zinc-300 sm:text-sm">
                This deposit is the vault&apos;s principal capital base. It feeds strategy deployment and stays separate from
                share-token launch allocation.
              </p>
            </div>
          </motion.div>

          <TokenFlowViz sourceLabel={`${depositTokens} TOKEN`} slots={STRATEGY_CARDS} />
        </div>
      </div>
    </section>
  )
}
