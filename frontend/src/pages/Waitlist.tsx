import { Suspense, lazy } from 'react'

import { AppLoadingState } from '@/components/layout/AppLoadingState'
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
        <div className="mx-auto w-full max-w-5xl">
          <div>
            <PrivyClientProvider showWalletLoginFirst={false} mode="waitlist-email-only">
              <AppQueryProvider>
                <Suspense
                  fallback={
                    <AppLoadingState intent="session" />
                  }
                >
                  <LazyWaitlistFlow sectionId="waitlist-page" />
                </Suspense>
              </AppQueryProvider>
            </PrivyClientProvider>
          </div>
        </div>
      </main>
    </div>
  )
}
