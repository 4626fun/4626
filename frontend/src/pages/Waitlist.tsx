import { Suspense, lazy } from 'react'

import { AppLoadingState } from '@/components/layout/AppLoadingState'
import { META, PageMeta } from '@/components/seo/PageMeta'
import { PrivyClientProvider, usePrivyClientStatus } from '@/lib/privy/client'
import { AppQueryProvider } from '@/web3/Web3Providers'

const LazyWaitlistFlow = lazy(async () => {
  const mod = await import('@/features/waitlist/WaitlistFlow')
  return { default: mod.WaitlistFlow }
})

function WaitlistFlowGate() {
  const privyClientStatus = usePrivyClientStatus()

  if (privyClientStatus === 'disabled') {
    return (
      <section className="rounded-3xl border border-white/10 bg-black/40 p-6 text-center text-white shadow-2xl shadow-black/30">
        <p className="text-sm font-semibold uppercase tracking-[0.28em] text-brand-primary">Waitlist unavailable</p>
        <h1 className="mt-3 text-2xl font-semibold sm:text-3xl">Email sign-in is not configured.</h1>
        <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-zinc-300">
          The waitlist requires the 4626 Privy client configuration before the account flow can load. Check the
          deployment environment and try again.
        </p>
      </section>
    )
  }

  if (privyClientStatus === 'loading') {
    return <AppLoadingState intent="session" />
  }

  return (
    <Suspense
      fallback={
        <AppLoadingState intent="session" />
      }
    >
      <LazyWaitlistFlow sectionId="waitlist-page" />
    </Suspense>
  )
}

export function Waitlist() {
  return (
    <div className="min-h-screen flex flex-col">
      <PageMeta title={META.waitlist.title} description={META.waitlist.description} canonicalPath="/waitlist" />

      <main className="flex-1 px-4 py-10 sm:py-14">
        <div className="mx-auto w-full max-w-5xl">
          <div>
            <PrivyClientProvider showWalletLoginFirst={false} mode="waitlist-email-only">
              <AppQueryProvider>
                <WaitlistFlowGate />
              </AppQueryProvider>
            </PrivyClientProvider>
          </div>
        </div>
      </main>
    </div>
  )
}
