import { Suspense, lazy, useState } from 'react'
import { motion } from 'framer-motion'

import { PageMeta } from '@/components/seo/PageMeta'
import { consumeStoredWaitlistAuthArmed, consumeStoredWaitlistAuthAutoStart } from '@/lib/auth/waitlistEntry'
import { PrivyClientProvider } from '@/lib/privy/client'
import { Web3Providers } from '@/web3/Web3Providers'

const LazyWaitlistFlow = lazy(async () => {
  const mod = await import('@/components/waitlist/WaitlistFlow')
  return { default: mod.WaitlistFlow }
})

export function Waitlist() {
  const [initialWaitlistState] = useState(() => {
    const autoStart = consumeStoredWaitlistAuthAutoStart()
    const armed = consumeStoredWaitlistAuthArmed() || autoStart
    // Only auto-start when an upstream entrypoint explicitly armed it.
    // Direct /waitlist visits should remain manual to avoid auth/bootstrap loops.
    return { autoStart: autoStart || armed }
  })

  return (
    <div className="min-h-screen flex flex-col">
      <PageMeta
        title="Join the Waitlist — 4626.fun"
        description="Get early access to Creator Vaults on Base. Deposit once. Earn from every trade, forever."
        canonicalPath="/waitlist"
      />

      <main className="flex-1 flex items-start justify-center px-4 py-16 sm:py-24">
        <div className="w-full max-w-2xl space-y-10">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            className="text-center space-y-3"
          >
            <h1 className="headline text-3xl sm:text-4xl tracking-[-0.04em]">
              Join the Waitlist
            </h1>
            <p className="text-[15px] text-zinc-500 font-light leading-relaxed">
              Deposit once. Earn from every trade, forever.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <PrivyClientProvider showWalletLoginFirst={false}>
              <Web3Providers>
                <Suspense
                  fallback={
                    <div className="card rounded-2xl border border-white/10 bg-black/50 p-6 sm:p-8 text-sm text-zinc-400">
                      Loading…
                    </div>
                  }
                >
                  <LazyWaitlistFlow
                    sectionId="waitlist-page"
                    autoStartAuth={initialWaitlistState.autoStart}
                  />
                </Suspense>
              </Web3Providers>
            </PrivyClientProvider>
          </motion.div>
        </div>
      </main>
    </div>
  )
}
