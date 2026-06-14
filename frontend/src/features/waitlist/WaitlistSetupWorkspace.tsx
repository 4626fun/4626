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
import { WaitlistWorkspaceHeader } from './WaitlistWorkspaceHeader'
import { WaitlistLeaderboardPanel } from './WaitlistLeaderboardPanel'

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
  const showWorkspaceHeader = waitlistJoined && !(inBaseApp && !signingStepComplete)
  // Chat room surface is available on waitlist once email verified (for desktop) or after wallet signing step (Base App).
  // The panel internally gates interactive join on signingReady; this just mounts the teaser / connect UI.
  const chatEnabled = waitlistJoined && (!inBaseApp || signingStepComplete)

  const primaryColumnActions = (
    <div className="space-y-4">
      <section
        aria-label="Waitlist points actions"
        className="px-0 py-0"
      >
        <WaitlistUnlocksPanel
          score={controller.me?.score ?? initialAccount.score}
          email={controller.me?.email ?? initialAccount.email}
          linkedMethods={controller.me?.linkedMethods ?? initialAccount.linkedMethods}
          busyProvider={controller.busyProvider}
          onLinkProvider={controller.onLinkProvider}
          zoraHandle={controller.me?.accountSignals?.zoraHandle ?? initialAccount.accountSignals?.zoraHandle ?? null}
          canonicalCswAddress={
            controller.me?.accountSignals?.canonicalCswAddress ??
            initialAccount.accountSignals?.canonicalCswAddress ??
            null
          }
          signingStepComplete={signingStepComplete}
        />
      </section>

      {canEnterNow ? (
        <section aria-label="App access" className="space-y-2">
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
        </section>
      ) : waitlistJoined ? (
        <section aria-label="Approval status" className="space-y-2">
          <p className="text-sm text-zinc-300">Waiting for approval.</p>
          <p className="text-xs text-zinc-500 lg:hidden">
            Open the leaderboard section below to see where you rank.
          </p>
        </section>
      ) : null}
    </div>
  )

  const gridClass = chatEnabled
    ? 'grid grid-cols-1 gap-5 xl:grid-cols-[minmax(260px,300px)_minmax(0,1fr)_minmax(300px,360px)] xl:items-start xl:gap-6'
    : 'grid grid-cols-1 gap-5 xl:grid-cols-[minmax(260px,300px)_minmax(0,1fr)] xl:items-start xl:gap-6'

  return (
    <div className="mx-auto w-full max-w-[1380px] space-y-5 px-3 sm:space-y-6 sm:px-4">
      {showWorkspaceHeader ? (
        <WaitlistWorkspaceHeader
          canEnterApp={canEnterApp}
          setupComplete={setupComplete}
          showSetupHeading
        />
      ) : null}

      <div className={gridClass}>
        <WaitlistLeaderboardPanel layout="rail" />

        <div className="min-w-0 space-y-5">
          <div className="mx-auto w-full max-w-[860px] lg:max-w-none">
            <AccountSetupWorkspaceView
              context="waitlist"
              controller={controller}
              onSigningStepCompleteChange={onSigningStepCompleteChange}
              summaryActions={primaryColumnActions}
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
          </div>

          <WaitlistLeaderboardPanel layout="mobile" />

          {chatEnabled ? (
            <div className="lg:hidden">
              <WaitlistGroupChatPanel
                setupComplete={chatEnabled}
                signingReady={signingStepComplete}
                layout="mobile"
                onSignOut={onSignOut}
                signOutBusy={signOutBusy}
              />
            </div>
          ) : null}
        </div>

        {chatEnabled ? (
          <aside className="hidden min-w-0 xl:block xl:sticky xl:top-4" aria-label="Waitlist group chat">
            <WaitlistGroupChatPanel
              setupComplete={chatEnabled}
              signingReady={signingStepComplete}
              layout="sidebar"
              onSignOut={onSignOut}
              signOutBusy={signOutBusy}
            />
          </aside>
        ) : null}
      </div>
    </div>
  )
}
