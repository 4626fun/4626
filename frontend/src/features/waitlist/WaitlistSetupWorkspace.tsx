import { SHARE_SYMBOL_PREFIX } from '@/lib/tokenSymbols'
import { AccountSetupWorkspaceView } from '@/features/accountSetup/AccountSetupWorkspaceView'
import type { AccountSetupMe } from '@/features/accountSetup/types'
import { useAccountSetupController } from '@/features/accountSetup/useAccountSetupController'

export function WaitlistSetupWorkspace(props: {
  initialAccount: AccountSetupMe
  canEnterApp: boolean
  completionBusy: boolean
  onEnterApp: () => void | Promise<void>
  onOpenAccounts: () => void | Promise<void>
}) {
  const { initialAccount, canEnterApp, completionBusy, onEnterApp, onOpenAccounts } = props
  const controller = useAccountSetupController({
    initialData: { me: initialAccount, zoraStatus: null },
    zoraReturnPath: '/waitlist',
  })

  return (
    <AccountSetupWorkspaceView
      context="waitlist"
      controller={controller}
      summaryActions={
        <>
          {canEnterApp ? (
            <button
              type="button"
              onClick={() => void onEnterApp()}
              disabled={completionBusy}
              className="btn-accent btn-no-icon inline-flex disabled:opacity-60"
            >
              {completionBusy ? 'Entering App...' : `${SHARE_SYMBOL_PREFIX} Enter App`}
            </button>
          ) : (
            <div className="text-xs text-zinc-500">
              App access is still pending. Keep setup on this page while approval catches up.
            </div>
          )}
          <button
            type="button"
            onClick={() => void onOpenAccounts()}
            className="rounded-lg border border-white/15 px-3 py-2 text-xs text-zinc-300 hover:border-white/30"
          >
            Advanced account settings
          </button>
        </>
      }
    />
  )
}
