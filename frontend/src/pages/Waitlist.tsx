import { Suspense, lazy } from 'react'

import { AppLoadingRegistrar } from '@/components/layout/AppLoadingOverlay'
import { META, PageMeta } from '@/components/seo/PageMeta'
import { PrivyClientProvider, usePrivyClientStatus } from '@/lib/privy/client'

const LazyWaitlistFlow = lazy(async () => {
  const mod = await import('@/features/waitlist/WaitlistFlow')
  return { default: mod.WaitlistFlow }
})

function WaitlistFlowGate() {
  void usePrivyClientStatus()

  return (
    <Suspense fallback={<AppLoadingRegistrar label="waitlist-page-suspense" />}>
      <LazyWaitlistFlow sectionId="waitlist-page" />
    </Suspense>
  )
}

export function Waitlist() {
  return (
    <>
      <PageMeta title={META.waitlist.title} description={META.waitlist.description} canonicalPath="/waitlist" />
      <PrivyClientProvider showWalletLoginFirst={false} mode="waitlist-email-only">
        <WaitlistFlowGate />
      </PrivyClientProvider>
    </>
  )
}
