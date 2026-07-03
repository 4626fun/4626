import { Suspense, lazy, useCallback, useState } from 'react'

import { AppLoadingRegistrar } from '@/components/layout/AppLoadingOverlay'
import { META, PageMeta } from '@/components/seo/PageMeta'
import { WaitlistReturningWalletSignInRunner } from '@/features/waitlist/WaitlistReturningWalletSignInRunner'
import { invalidateAccountMeCache } from '@/hooks/useAccountMe'
import { PrivyClientProvider, usePrivyClientStatus } from '@/lib/privy/client'

const LazyWaitlistFlow = lazy(async () => {
  const mod = await import('@/features/waitlist/WaitlistFlow')
  return { default: mod.WaitlistFlow }
})

type WaitlistFlowGateProps = {
  walletSignInPending: boolean
  walletSessionAddress: string | null
  walletSignInError: string | null
  onRequestWalletSignIn: () => void
  onCancelWalletSignIn: () => void
  onClearWalletSignInError: () => void
}

function WaitlistFlowGate(props: WaitlistFlowGateProps) {
  void usePrivyClientStatus()

  return (
    <Suspense fallback={<AppLoadingRegistrar label="waitlist-page-suspense" />}>
      <LazyWaitlistFlow
        sectionId="waitlist-page"
        walletSignInPending={props.walletSignInPending}
        walletSessionAddress={props.walletSessionAddress}
        walletSignInError={props.walletSignInError}
        onRequestWalletSignIn={props.onRequestWalletSignIn}
        onCancelWalletSignIn={props.onCancelWalletSignIn}
        onClearWalletSignInError={props.onClearWalletSignInError}
      />
    </Suspense>
  )
}

export function Waitlist() {
  const [walletSignInPending, setWalletSignInPending] = useState(false)
  const [walletSignInAttempt, setWalletSignInAttempt] = useState(0)
  const [walletSessionAddress, setWalletSessionAddress] = useState<string | null>(null)
  const [walletSignInError, setWalletSignInError] = useState<string | null>(null)

  const onRequestWalletSignIn = useCallback(() => {
    if (walletSignInPending) return
    setWalletSignInError(null)
    setWalletSignInPending(true)
    setWalletSignInAttempt((attempt) => attempt + 1)
  }, [walletSignInPending])

  const onWalletSignInSuccess = useCallback((address: string) => {
    setWalletSessionAddress(address)
    setWalletSignInPending(false)
    invalidateAccountMeCache()
  }, [])

  const onWalletSignInFailure = useCallback((message: string | null) => {
    setWalletSignInPending(false)
    if (message) setWalletSignInError(message)
  }, [])

  const onCancelWalletSignIn = useCallback(() => {
    setWalletSignInPending(false)
  }, [])

  const onClearWalletSignInError = useCallback(() => {
    setWalletSignInError(null)
  }, [])

  return (
    <>
      <PageMeta title={META.waitlist.title} description={META.waitlist.description} canonicalPath="/waitlist" />
      <PrivyClientProvider
        showWalletLoginFirst={walletSignInPending}
        mode={walletSignInPending ? 'waitlist-returning-wallet' : 'waitlist-email-only'}
        walletChainType={walletSignInPending ? 'ethereum-only' : undefined}
      >
        {walletSignInPending ? (
          <WaitlistReturningWalletSignInRunner
            key={walletSignInAttempt}
            onSuccess={onWalletSignInSuccess}
            onFailure={onWalletSignInFailure}
          />
        ) : null}
        <WaitlistFlowGate
          walletSignInPending={walletSignInPending}
          walletSessionAddress={walletSessionAddress}
          walletSignInError={walletSignInError}
          onRequestWalletSignIn={onRequestWalletSignIn}
          onCancelWalletSignIn={onCancelWalletSignIn}
          onClearWalletSignInError={onClearWalletSignInError}
        />
      </PrivyClientProvider>
    </>
  )
}
