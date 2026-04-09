import { Suspense, lazy } from 'react'
import { motion } from 'framer-motion'

import { META, PageMeta } from '@/components/seo/PageMeta'
import { PrivyClientProvider } from '@/lib/privy/client'
import { AppQueryProvider, WalletProviders } from '@/web3/Web3Providers'

const LazyWaitlistFlow = lazy(async () => {
  const mod = await import('@/features/waitlist/WaitlistFlow')
  return { default: mod.WaitlistFlow }
})

export function Waitlist() {
  return (
    <div className="min-h-screen flex flex-col">
      <PageMeta title={META.waitlist.title} description={META.waitlist.description} canonicalPath="/waitlist" />

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
            <PrivyClientProvider showWalletLoginFirst={false} mode="waitlist-email-only">
              <AppQueryProvider>
                <WalletProviders>
                  <Suspense
                    fallback={
                      <div className="card rounded-2xl border border-white/10 bg-black/50 p-6 sm:p-8 text-sm text-zinc-400">
                        Loading…
                      </div>
                    }
                  >
                    <LazyWaitlistFlow sectionId="waitlist-page" />
                  </Suspense>
                </WalletProviders>
              </AppQueryProvider>
            </PrivyClientProvider>
          </motion.div>
        </div>
      </main>
    </div>
  )
}
