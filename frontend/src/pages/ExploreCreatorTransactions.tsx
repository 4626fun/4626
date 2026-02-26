import { motion } from 'framer-motion'
import { Link, Navigate, useParams } from 'react-router-dom'
import { getAddress, isAddress } from 'viem'

import { ExploreSubnav } from '@/components/explore/ExploreSubnav'
import { PageMeta } from '@/components/seo/PageMeta'

function isSupportedChain(chain: string): boolean {
  return chain.toLowerCase() === 'base'
}

export function ExploreCreatorTransactions() {
  const params = useParams()
  const chain = String(params.chain ?? '').trim()
  const tokenAddressRaw = String(params.tokenAddress ?? '').trim()
  const tokenAddress = isAddress(tokenAddressRaw) ? getAddress(tokenAddressRaw) : null

  if (!chain || !isSupportedChain(chain) || !tokenAddress) {
    return <Navigate replace to="/explore/transactions" />
  }

  return (
    <div className="relative pb-24 md:pb-0">
      <PageMeta title="Creator Transactions" description="View on-chain transactions for this creator coin on CreatorVault." canonicalPath={`/explore/transactions/${String(params.chain ?? '')}/${String(params.tokenAddress ?? '')}`} />
      <section className="cinematic-section">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-10"
          >
            <span className="label">Transactions</span>
            <h1 className="headline text-3xl sm:text-5xl mt-4">Creator Coin</h1>
            <div className="mt-3 text-[11px] font-mono text-zinc-600 break-all">{tokenAddress}</div>
          </motion.div>

          <ExploreSubnav searchPlaceholder="Filter transactions…" />

          <div className="mt-10 rounded-2xl border border-white/5 bg-white/[0.03] p-6 sm:p-8">
            <div className="label">Coming soon</div>
            <div className="mt-4 text-sm text-zinc-600 font-light">
              This page will show swaps/mints/launch events for this creator coin.
            </div>
            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <Link
                to={`/explore/creators/base/${tokenAddress}`}
                className="btn-primary btn-compact inline-flex items-center justify-center rounded-full text-xs"
              >
                Back to creator
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

