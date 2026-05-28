import { Suspense, lazy, useMemo } from 'react'

import { AppLoadingRegistrar } from '@/components/layout/AppLoadingOverlay'
import { META, PageMeta } from '@/components/seo/PageMeta'
import { PrivyClientProvider, usePrivyClientStatus } from '@/lib/privy/client'
import { SmartWalletsRouteProvider } from '@/lib/privy/SmartWalletsRouteProvider'
import { detectInAppEnvironment, isBaseAppInAppContext } from '@/lib/wallet/inAppBrowser'
import { AppQueryProvider, WalletProviders } from '@/web3/Web3Providers'

const LazyWaitlistFlow = lazy(async () => {
  const mod = await import('@/features/waitlist/WaitlistFlow')
  return { default: mod.WaitlistFlow }
})

function WaitlistFlowGate(props: { inBaseApp?: boolean }) {
  const privyClientStatus = usePrivyClientStatus()

  if (privyClientStatus === 'disabled') {
    return (
      <section className="mx-auto w-full max-w-5xl px-4 py-6 sm:py-8">
        <div className="rounded-3xl border border-white/10 bg-black/40 p-6 text-center text-white shadow-2xl shadow-black/30">
          <p className="label text-zinc-400">Waitlist unavailable</p>
          <h1 className="mt-3 text-2xl font-semibold sm:text-3xl">Email sign-in is not configured.</h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-zinc-300">
            The waitlist requires the 4626 Privy client configuration before the account flow can load. Check the
            deployment environment and try again.
          </p>
        </div>
      </section>
    )
  }

  return (
    <Suspense fallback={<AppLoadingRegistrar />}>
      <LazyWaitlistFlow sectionId="waitlist-page" inBaseApp={props.inBaseApp === true} />
    </Suspense>
  )
}

function readWaitlistPrivyShell() {
  if (typeof window === 'undefined') {
    return { inBaseApp: false, mode: 'waitlist-email-only' as const, showWalletLoginFirst: false }
  }
  const inBaseApp = isBaseAppInAppContext(detectInAppEnvironment())
  return {
    inBaseApp,
    mode: inBaseApp ? ('default' as const) : ('waitlist-email-only' as const),
    showWalletLoginFirst: inBaseApp,
  }
}

export function Waitlist() {
  const privyShell = useMemo(() => readWaitlistPrivyShell(), [])
  const flow = (
    <AppQueryProvider>
      <SmartWalletsRouteProvider>
        <WaitlistFlowGate inBaseApp={privyShell.inBaseApp} />
      </SmartWalletsRouteProvider>
    </AppQueryProvider>
  )

  return (
    <>
      <PageMeta title={META.waitlist.title} description={META.waitlist.description} canonicalPath="/waitlist" />
      <PrivyClientProvider showWalletLoginFirst={privyShell.showWalletLoginFirst} mode={privyShell.mode}>
        {privyShell.inBaseApp ? (
          <WalletProviders reconnectOnMount={false}>{flow}</WalletProviders>
        ) : (
          flow
        )}
      </PrivyClientProvider>
    </>
  )
}
