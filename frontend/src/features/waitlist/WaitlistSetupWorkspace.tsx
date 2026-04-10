import { SHARE_SYMBOL_PREFIX } from '@/lib/tokenSymbols'
import { AccountSetupWorkspaceView } from '@/features/accountSetup/AccountSetupWorkspaceView'
import type { AccountSetupMe } from '@/features/accountSetup/types'
import { useAccountSetupController } from '@/features/accountSetup/useAccountSetupController'
import { WalletProviders } from '@/web3/Web3Providers'

type WaitlistSetupWorkspaceProps = {
  initialAccount: AccountSetupMe
  canEnterApp: boolean
  completionBusy: boolean
  onEnterApp: () => void | Promise<void>
  onOpenAccounts: () => void | Promise<void>
}

export function WaitlistSetupWorkspace(props: WaitlistSetupWorkspaceProps) {
  return (
    <WalletProviders>
      <WaitlistSetupWorkspaceContent {...props} />
    </WalletProviders>
  )
}

function WaitlistSetupWorkspaceContent(props: WaitlistSetupWorkspaceProps) {
  const { initialAccount, canEnterApp, completionBusy, onEnterApp } = props
  const controller = useAccountSetupController({
    initialData: { me: initialAccount, zoraStatus: null },
    zoraReturnPath: '/waitlist',
  })
  const signingStepComplete = /4626 signing is enabled|already enabled/i.test(controller.notice ?? '')
  const setupComplete =
    controller.zoraLinked && Boolean(controller.canonicalCswAddress) && signingStepComplete
  const canEnterNow = canEnterApp && setupComplete

  return (
    <AccountSetupWorkspaceView
      context="waitlist"
      controller={controller}
      summaryActions={
        <div className="w-full">
          <button
            type="button"
            onClick={() => void onEnterApp()}
            disabled={completionBusy || !canEnterNow}
            className="btn-accent btn-no-icon inline-flex w-full items-center justify-center sm:w-auto disabled:opacity-50 disabled:grayscale"
            aria-disabled={completionBusy || !canEnterNow}
            aria-describedby={!canEnterNow ? 'waitlist-enter-app-hint' : undefined}
          >
            {completionBusy ? 'Entering App...' : `${SHARE_SYMBOL_PREFIX} Enter App`}
          </button>
          {!canEnterNow ? (
            <div
              id="waitlist-enter-app-hint"
              role="status"
              aria-live="polite"
              className="bv-subpanel mt-3 px-4 py-3 ring-1 ring-brand-primary/20"
            >
              <p className="bv-kicker text-brand-300">
                {canEnterApp ? 'Finish setup first' : 'App access pending'}
              </p>
              <p className="mt-1 text-sm text-zinc-300">
                {canEnterApp
                  ? 'Complete all three setup steps above to unlock Enter App.'
                  : 'Your setup is saved. Stay on this page while approval catches up.'}
              </p>
            </div>
          ) : null}
        </div>
      }
    />
  )
}
