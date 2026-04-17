import { SHARE_SYMBOL_PREFIX } from '@/lib/tokens/tokenSymbols'
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
  const signingStepComplete = Boolean(controller.subAccountAddress) || Boolean(initialAccount.baseSubAccount) || /4626 signing is enabled|already enabled/i.test(controller.notice ?? '')
  const setupComplete =
    controller.zoraLinked && Boolean(controller.canonicalCswAddress) && signingStepComplete
  const canEnterNow = canEnterApp && setupComplete

  return (
    <AccountSetupWorkspaceView
      context="waitlist"
      controller={controller}
      summaryActions={
        <div className="w-full">
          {canEnterNow ? (
            <button
              type="button"
              onClick={() => void onEnterApp()}
              disabled={completionBusy}
              className="btn-accent btn-no-icon inline-flex w-full items-center justify-center sm:w-auto disabled:opacity-50 disabled:grayscale"
            >
              {completionBusy ? 'Entering App...' : `${SHARE_SYMBOL_PREFIX} Enter App`}
            </button>
          ) : setupComplete && !canEnterApp ? (
            <div
              role="status"
              aria-live="polite"
              className="bv-subpanel space-y-3 px-4 py-4 ring-1 ring-brand-primary/20"
            >
              <p className="bv-kicker text-brand-300">Waiting for admin approval</p>
              <p className="text-sm text-zinc-300">
                Your account setup is complete. Access will be granted once an admin approves your entry.
              </p>
              <a
                href="/leaderboard"
                className="inline-flex h-9 items-center rounded-lg border border-white/10 bg-white/[0.04] px-4 text-sm font-medium text-zinc-300 hover:bg-white/[0.08] transition-colors"
              >
                View leaderboard
              </a>
            </div>
          ) : null}
        </div>
      }
    />
  )
}
