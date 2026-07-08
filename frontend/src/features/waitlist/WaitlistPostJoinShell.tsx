import { LoadingInline } from '@/components/ui/LoadingState'

import { WaitlistChatDock } from './WaitlistChatDock'
import { WaitlistOwnerInstallPanel } from './WaitlistOwnerInstallPanel'
import { WaitlistWalletProvision } from './WaitlistWalletProvision'
import { useWaitlistPostJoinAttention } from './useWaitlistPostJoinAttention'

type WaitlistPostJoinShellProps = {
  enabled: boolean
  onSignOut?: () => void | Promise<void>
  signOutBusy?: boolean
}

export function WaitlistPostJoinShell(props: WaitlistPostJoinShellProps) {
  if (!props.enabled) return null
  return <WaitlistPostJoinShellInner onSignOut={props.onSignOut} signOutBusy={props.signOutBusy} />
}

function WaitlistPostJoinShellInner(props: {
  onSignOut?: () => void | Promise<void>
  signOutBusy?: boolean
}) {
  const {
    accountMe,
    loading,
    refresh,
    connectTrack,
    canonicalCswAddress,
    embeddedEoaAddress,
    needsProvision,
    showOwnerInstall,
    messagingReady,
    refreshParentEmbeddedOwner,
    setupRequired,
  } = useWaitlistPostJoinAttention()
  const accountSignals = accountMe?.accountSignals

  const handleOwnerInstallSuccess = async () => {
    await refreshParentEmbeddedOwner()
    refresh()
  }

  if (loading && !accountMe) {
    return (
      <div className="mt-5 rounded-2xl border border-white/10 bg-black/25 px-4 py-5">
        <LoadingInline labelOverride="Loading wallet setup…" />
      </div>
    )
  }

  return (
    <div className="mt-5 space-y-4">
      {setupRequired ? (
        <div className="space-y-4">
          <WaitlistWalletProvision enabled needsProvision={needsProvision} />

          {showOwnerInstall ? (
            <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-4">
              <p className="mb-3 text-sm font-medium text-zinc-200">Enable 4626 signing</p>
              <WaitlistOwnerInstallPanel
                connectTrack={connectTrack}
                canonicalCswAddress={canonicalCswAddress}
                embeddedEoaAddress={embeddedEoaAddress ?? accountSignals?.embeddedEoaAddress ?? null}
                onSuccess={handleOwnerInstallSuccess}
              />
            </div>
          ) : null}
        </div>
      ) : null}

      <WaitlistChatDock
        setupComplete
        messagingReady={messagingReady}
        connectTrack={connectTrack}
        onSignOut={props.onSignOut}
        signOutBusy={props.signOutBusy}
      />
    </div>
  )
}
