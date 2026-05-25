import { useCallback, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { SHARE_SYMBOL_PREFIX } from '@/lib/tokens/tokenSymbols'
import { AccountSetupWorkspaceView } from '@/features/accountSetup/AccountSetupWorkspaceView'
import type { AccountSetupMe } from '@/features/accountSetup/types'
import { useAccountSetupController } from '@/features/accountSetup/useAccountSetupController'
import { WalletProviders } from '@/web3/Web3Providers'
import { WaitlistUnlocksPanel } from './WaitlistUnlocksPanel'
import { useWaitlistChatJoin, waitlistChatStatusMessage } from './useWaitlistChatJoin'

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
    <WalletProviders>
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
  const setupComplete = controller.zoraLinked && Boolean(controller.canonicalCswAddress)
  const canEnterNow = canEnterApp && setupComplete
  const waitlistChatStatus = useWaitlistChatJoin({
    canonicalCswAddress: controller.canonicalCswAddress,
    enabled: setupComplete && signingStepComplete,
  })
  const chatStatusMessage = setupComplete
    ? signingStepComplete
      ? waitlistChatStatusMessage(waitlistChatStatus)
      : 'Enable 4626 signing to join waitlist chat.'
    : null

  return (
    <>
      <AccountSetupWorkspaceView
      context="waitlist"
      controller={controller}
      onSigningStepCompleteChange={onSigningStepCompleteChange}
      summaryActions={
        <div className="w-full space-y-4">
          <WaitlistUnlocksPanel score={initialAccount.score} email={initialAccount.email} />

          {chatStatusMessage ? (
            <p className="text-xs text-zinc-400">{chatStatusMessage}</p>
          ) : null}

          {canEnterNow ? (
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
          ) : setupComplete && !canEnterApp ? (
            <div role="status" aria-live="polite" className="space-y-2">
              <p className="text-sm text-zinc-300">Setup complete. Waiting for admin approval.</p>
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
