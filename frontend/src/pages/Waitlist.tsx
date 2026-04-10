import { Suspense, lazy } from 'react'
import { motion } from 'framer-motion'

import { META, PageMeta } from '@/components/seo/PageMeta'
import { PrivyClientProvider } from '@/lib/privy/client'
import { AppQueryProvider } from '@/web3/Web3Providers'

const LazyWaitlistFlow = lazy(async () => {
  const mod = await import('@/features/waitlist/WaitlistFlow')
  return { default: mod.WaitlistFlow }
})

export function Waitlist() {
  return (
    <div className="min-h-screen flex flex-col">
      <PageMeta title={META.waitlist.title} description={META.waitlist.description} canonicalPath="/waitlist" />

      <main className="flex-1 px-4 py-10 sm:py-14">
        <div className="mx-auto w-full max-w-5xl space-y-8 sm:space-y-10">
          <motion.header
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            className="text-center space-y-3"
          >
            <p className="text-sm sm:text-base uppercase tracking-[0.18em] text-zinc-400">4626 early access</p>
            <p className="mx-auto max-w-2xl text-[14px] text-zinc-500 font-light leading-relaxed">
              One secure email sign-in saves your spot. Then we guide you through setup in a few clear steps.
            </p>
          </motion.header>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <PrivyClientProvider showWalletLoginFirst={false} mode="waitlist-email-only">
              <AppQueryProvider>
                <Suspense
                  fallback={
                    <div className="card rounded-2xl border border-white/10 bg-black/50 p-6 sm:p-8 text-sm text-zinc-400">
                      Loading…
                    </div>
                  }
                >
                  <LazyWaitlistFlow sectionId="waitlist-page" />
                </Suspense>
              </AppQueryProvider>
            </PrivyClientProvider>
          </motion.div>
        </div>
      </main>
    </div>
  )
}
