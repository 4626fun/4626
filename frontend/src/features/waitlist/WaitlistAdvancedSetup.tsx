import { useCallback, useState } from 'react'

import { Button } from '@/components/ui/Button'
import { AccountSetupWorkspaceView } from '@/features/accountSetup/AccountSetupWorkspaceView'
import type { AccountSetupMe } from '@/features/accountSetup/types'
import { useAccountSetupController } from '@/features/accountSetup/useAccountSetupController'
import { WalletProviders } from '@/web3/Web3Providers'

type WaitlistAdvancedSetupProps = {
  initialAccount: AccountSetupMe
  canEnterApp: boolean
  completionBusy: boolean
  onEnterApp: () => void | Promise<void>
  onSignOut: () => void | Promise<void>
  signOutBusy?: boolean
  onSigningStepCompleteChange?: (complete: boolean) => void
}

export function WaitlistAdvancedSetup(props: WaitlistAdvancedSetupProps) {
  return (
    <WalletProviders reconnectOnMount={false}>
      <WaitlistAdvancedSetupContent {...props} />
    </WalletProviders>
  )
}

function WaitlistAdvancedSetupContent(props: WaitlistAdvancedSetupProps) {
  const {
    initialAccount,
    canEnterApp,
    completionBusy,
    onEnterApp,
    onSignOut,
    signOutBusy = false,
    onSigningStepCompleteChange,
  } = props
  const controller = useAccountSetupController({
    initialData: { me: initialAccount, zoraStatus: null },
    zoraReturnPath: '/waitlist',
  })
  const [signingStepComplete, setSigningStepComplete] = useState(false)
  const handleSigningStepCompleteChange = useCallback(
    (complete: boolean) => {
      setSigningStepComplete(complete)
      onSigningStepCompleteChange?.(complete)
    },
    [onSigningStepCompleteChange],
  )

  const summaryActions = (
    <div className="space-y-3">
      {canEnterApp ? (
        <Button
          type="button"
          variant="primary"
          onClick={() => void onEnterApp()}
          disabled={completionBusy}
          loading={completionBusy}
          className="w-full disabled:grayscale"
        >
          Enter App
        </Button>
      ) : null}
      <p className="text-xs text-zinc-500">
        {signingStepComplete
          ? 'Signing is enabled for app features that need it.'
          : 'This setup is optional while you wait.'}
      </p>
    </div>
  )

  return (
    <AccountSetupWorkspaceView
      context="waitlist"
      controller={controller}
      onSigningStepCompleteChange={handleSigningStepCompleteChange}
      summaryActions={summaryActions}
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
  )
}
