import { useCallback, useMemo, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { SHARE_SYMBOL_PREFIX } from '@/lib/tokens/tokenSymbols'
import { AccountSetupWorkspaceView } from '@/features/accountSetup/AccountSetupWorkspaceView'
import type { AccountSetupMe } from '@/features/accountSetup/types'
import { useAccountSetupController } from '@/features/accountSetup/useAccountSetupController'
import { isBaseAppInAppContext } from '@/lib/wallet/inAppBrowser'
import { WalletProviders } from '@/web3/Web3Providers'
import { WaitlistUnlocksPanel } from './WaitlistUnlocksPanel'
import { WaitlistGroupChatPanel } from './WaitlistGroupChatPanel'

type WaitlistSetupWorkspaceProps = {
  initialAccount: AccountSetupMe
  canEnterApp: boolean
  completionBusy: boolean
  onEnterApp: () => void | Promise<void>
  onSignOut: () => void | Promise<void>
  signOutBusy?: boolean
}

export function WaitlistSetupWorkspace(props: WaitlistSetupWorkspaceProps) {
  return (
    <WalletProviders reconnectOnMount={false}>
      <WaitlistSetupWorkspaceContent {...props} />
    </WalletProviders>
  )
}

function WaitlistSetupWorkspaceContent(props: WaitlistSetupWorkspaceProps) {
  const {
    initialAccount,
    canEnterApp,
    completionBusy,
    onEnterApp,
    onSignOut,
    signOutBusy = false,
  } = props
  const controller = useAccountSetupController({
    initialData: { me: initialAccount, zoraStatus: null },
    zoraReturnPath: '/waitlist',
  })
  const [signingStepComplete, setSigningStepComplete] = useState(false)
  const onSigningStepCompleteChange = useCallback((complete: boolean) => {
    setSigningStepComplete(complete)
  }, [])
  const waitlistJoined = initialAccount.emailVerified === true
  const setupComplete = controller.zoraLinked && Boolean(controller.canonicalCswAddress)
  const canEnterNow = canEnterApp
  const inBaseApp = useMemo(() => isBaseAppInAppContext(), [])

  return (
    <>
      {waitlistJoined ? (
        <div className="mx-auto mb-6 max-w-[640px] space-y-2 text-center">
          <h2 className="text-2xl font-semibold text-white">You&apos;re on the waitlist</h2>
          <p className="text-sm text-zinc-400">
            {inBaseApp && !signingStepComplete
              ? 'Email verified — connect your Base Account wallet in Step 2 below to unlock swaps and chat.'
              : canEnterApp
                ? 'You&apos;re approved — enter the app when ready.'
                : 'We&apos;ll notify you when your spot opens. Optional setup below unlocks swaps and chat sooner.'}
          </p>
        </div>
      ) : null}
      <AccountSetupWorkspaceView
        context="waitlist"
        controller={controller}
        onSigningStepCompleteChange={onSigningStepCompleteChange}
        summaryActions={
          <div className="w-full space-y-4">
            <WaitlistUnlocksPanel score={initialAccount.score} email={initialAccount.email} />

            <WaitlistGroupChatPanel setupComplete={setupComplete} signingReady={signingStepComplete} />

            {canEnterNow ? (
              <div className="space-y-2">
                <Button
                  type="button"
                  variant="primary"
                  onClick={() => void onEnterApp()}
                  disabled={completionBusy}
                  loading={completionBusy}
                  className="w-full disabled:grayscale"
                >
                  {`${SHARE_SYMBOL_PREFIX} Enter App`}
                </Button>
                {!setupComplete ? (
                  <p className="text-xs text-zinc-500">
                    Complete optional setup below for the best in-app experience.
                  </p>
                ) : null}
              </div>
            ) : waitlistJoined ? (
              <div role="status" aria-live="polite" className="space-y-2">
                <p className="text-sm text-zinc-300">Waiting for approval.</p>
                <a
                  href="/leaderboard"
                  className="inline-flex h-9 items-center rounded-lg border border-white/10 bg-white/[0.04] px-4 text-sm font-medium text-zinc-300 transition-colors hover:bg-white/[0.08]"
                >
                  View leaderboard
                </a>
              </div>
            ) : null}
          </div>
        }
        waitlistFooter={
          <button
            type="button"
            onClick={() => void onSignOut()}
            disabled={signOutBusy}
            className="text-xs text-zinc-400 transition hover:text-zinc-300 disabled:opacity-50"
          >
            {signOutBusy ? 'Signing out...' : 'Sign out'}
          </button>
        }
      />
    </>
  )
}
