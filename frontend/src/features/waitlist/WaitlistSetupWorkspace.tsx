import { SHARE_SYMBOL_PREFIX } from '@/lib/tokens/tokenSymbols'
import { AccountSetupWorkspaceView } from '@/features/accountSetup/AccountSetupWorkspaceView'
import type { AccountSetupMe } from '@/features/accountSetup/types'
import { useAccountSetupController } from '@/features/accountSetup/useAccountSetupController'
import { waitlistSubAccountFlowFlag } from '@/lib/flags/featureFlags'
import { WalletProviders } from '@/web3/Web3Providers'
import { WaitlistUnlocksPanel } from './WaitlistUnlocksPanel'
import { isSubAccountExecutionReady, isWaitlistSigningReadyForUi } from './waitlistFlowState'
import { useWaitlistChatJoin, waitlistChatStatusMessage } from './useWaitlistChatJoin'

type WaitlistSetupWorkspaceProps = {
  initialAccount: AccountSetupMe
  canEnterApp: boolean
  completionBusy: boolean
  onEnterApp: () => void | Promise<void>
  onOpenAccounts: () => void | Promise<void>
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
  const subAccountFlowEnabled = waitlistSubAccountFlowFlag()
  const currentAccount = controller.me ?? initialAccount
  const signingStepComplete = subAccountFlowEnabled
    ? isSubAccountExecutionReady(currentAccount.accountSignals)
    : isWaitlistSigningReadyForUi(currentAccount, controller.notice)
  const setupComplete =
    controller.zoraLinked && Boolean(controller.canonicalCswAddress) && signingStepComplete
  const canEnterNow = canEnterApp && setupComplete
  const waitlistChatStatus = useWaitlistChatJoin({
    canonicalCswAddress: controller.canonicalCswAddress,
    enabled: setupComplete,
  })
  const chatStatusMessage = setupComplete ? waitlistChatStatusMessage(waitlistChatStatus) : null

  return (
    <div className="mx-auto w-full max-w-[640px] space-y-6">
      <AccountSetupWorkspaceView
      context="waitlist"
      controller={controller}
      summaryActions={
        <div className="w-full space-y-4">
          {canEnterNow ? (
            <button
              type="button"
              onClick={() => void onEnterApp()}
              disabled={completionBusy}
              className="btn-accent btn-no-icon w-full disabled:opacity-50 disabled:grayscale"
            >
              {completionBusy ? 'Entering App...' : `${SHARE_SYMBOL_PREFIX} Enter App`}
            </button>
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

          <WaitlistUnlocksPanel score={initialAccount.score} email={initialAccount.email} />

          {chatStatusMessage ? (
            <p className="text-xs text-zinc-500">{chatStatusMessage}</p>
          ) : null}
        </div>
      }
      waitlistFooter={
        <button
          type="button"
          onClick={() => void onSignOut()}
          disabled={signOutBusy}
          className="text-xs text-zinc-500 transition hover:text-zinc-300 disabled:opacity-50"
        >
          {signOutBusy ? 'Signing out...' : 'Sign out'}
        </button>
      }
    />
    </div>
  )
}
