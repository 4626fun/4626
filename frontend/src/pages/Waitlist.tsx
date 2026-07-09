import { useCallback, useEffect, useState } from 'react'

import { META, PageMeta } from '@/components/seo/PageMeta'
import { WaitlistFlow } from '@/features/waitlist/WaitlistFlow'
import { WaitlistReturningWalletSignInRunner } from '@/features/waitlist/WaitlistReturningWalletSignInRunner'
import { invalidateAccountMeCache } from '@/hooks/useAccountMe'
import { PrivyClientProvider, usePrivyClientStatus } from '@/lib/privy/client'
import { AppQueryProvider } from '@/web3/AppQueryProvider'

type WaitlistFlowGateProps = {
  walletSignInPending: boolean
  walletSessionAddress: string | null
  walletSignInError: string | null
  onRequestWalletSignIn: () => void
  onCancelWalletSignIn: () => void
  onClearWalletSignInError: () => void
  onClearWalletSession: () => void
}

function WaitlistFlowGate(props: WaitlistFlowGateProps) {
  void usePrivyClientStatus()

  // Eager mount (not lazy): Base App WebViews already pay a Privy init cost;
  // a Suspense fallback here adds a second Loading flash on every remount.
  return (
    <WaitlistFlow
      sectionId="waitlist-page"
      walletSignInPending={props.walletSignInPending}
      walletSessionAddress={props.walletSessionAddress}
      walletSignInError={props.walletSignInError}
      onRequestWalletSignIn={props.onRequestWalletSignIn}
      onCancelWalletSignIn={props.onCancelWalletSignIn}
      onClearWalletSignInError={props.onClearWalletSignInError}
      onClearWalletSession={props.onClearWalletSession}
    />
  )
}

// Route-scoped (not in index.html) so this hint only competes for priority
// on the one page that actually renders the badge — avoids an unused-preload
// penalty on every other route in the SPA shell.
function useWaitlistPreloadTrustBadge() {
  useEffect(() => {
    const link = document.createElement('link')
    link.rel = 'preload'
    link.as = 'image'
    link.href = '/brands/privy-symbol-white.svg'
    document.head.appendChild(link)
    return () => {
      link.remove()
    }
  }, [])
}

export function Waitlist() {
  useWaitlistPreloadTrustBadge()
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

  const onClearWalletSession = useCallback(() => {
    setWalletSessionAddress(null)
  }, [])

  const hasWalletSession = Boolean(walletSessionAddress?.trim())
  const waitlistPrivyMode = hasWalletSession
    ? 'waitlist-wallet-joined'
    : walletSignInPending
      ? 'waitlist-returning-wallet'
      : 'waitlist-email-only'
  const waitlistWalletPrivyMode = waitlistPrivyMode !== 'waitlist-email-only'

  return (
    <AppQueryProvider>
      <PageMeta title={META.waitlist.title} description={META.waitlist.description} canonicalPath="/waitlist" />
      <PrivyClientProvider
        // Key on the full mode so Privy remounts when connectors/loginMethods
        // change (email → returning-wallet → wallet-joined). Updating Privy
        // config in place after wallet verify crashes in Base App WebViews.
        key={waitlistPrivyMode}
        showWalletLoginFirst={waitlistWalletPrivyMode}
        mode={waitlistPrivyMode}
        walletChainType={waitlistWalletPrivyMode ? 'ethereum-only' : undefined}
      >
        {walletSignInPending ? (
          <WaitlistReturningWalletSignInRunner
            key={walletSignInAttempt}
            signInAttempt={walletSignInAttempt}
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
          onClearWalletSession={onClearWalletSession}
        />
      </PrivyClientProvider>
    </AppQueryProvider>
  )
}
