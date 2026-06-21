import { Suspense, lazy, useMemo, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { SHARE_SYMBOL_PREFIX } from '@/lib/tokens/tokenSymbols'
import type { AccountSetupMe } from '@/features/accountSetup/types'
import { LoadingInline } from '@/components/ui/LoadingState'
import { WaitlistUnlocksPanel } from './WaitlistUnlocksPanel'
import { WaitlistWorkspaceHeader } from './WaitlistWorkspaceHeader'
import { WaitlistLeaderboardPanel } from './WaitlistLeaderboardPanel'
import { isWaitlistStepTwoSigningComplete } from './waitlistFlowState'

const LazyWaitlistAdvancedSetup = lazy(async () => {
  const mod = await import('./WaitlistAdvancedSetup')
  return { default: mod.WaitlistAdvancedSetup }
})

const LazyWaitlistGroupChatPanel = lazy(async () => {
  const mod = await import('./WaitlistGroupChatPanel')
  return { default: mod.WaitlistGroupChatPanel }
})

type WaitlistSetupWorkspaceProps = {
  initialAccount: AccountSetupMe
  canEnterApp: boolean
  completionBusy: boolean
  onEnterApp: () => void | Promise<void>
  onSignOut: () => void | Promise<void>
  signOutBusy?: boolean
  onRepairSession?: () => Promise<boolean> | boolean
  repairBusy?: boolean
}

export function WaitlistSetupWorkspace(props: WaitlistSetupWorkspaceProps) {
  const {
    initialAccount,
    canEnterApp,
    completionBusy,
    onEnterApp,
    onSignOut,
    signOutBusy = false,
    onRepairSession,
    repairBusy = false,
  } = props
  const initialSigningReady = useMemo(
    () =>
      isWaitlistStepTwoSigningComplete({
        ownerInstallRequested: false,
        accountSignals: initialAccount.accountSignals,
        subAccountFlowEnabled: true,
      }),
    [initialAccount.accountSignals],
  )
  const [signingStepComplete, setSigningStepComplete] = useState(initialSigningReady)
  const [showAdvancedSetup, setShowAdvancedSetup] = useState(false)
  const [showChat, setShowChat] = useState(false)
  const waitlistJoined = initialAccount.emailVerified === true

  return (
    <div className="mx-auto w-full max-w-[1380px] space-y-5 px-3 sm:space-y-6 sm:px-4">
      {waitlistJoined ? (
        <WaitlistWorkspaceHeader
          canEnterApp={canEnterApp}
          setupComplete={signingStepComplete}
          showSetupHeading
        />
      ) : null}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(260px,300px)_minmax(0,1fr)] xl:items-start xl:gap-6">
        <WaitlistLeaderboardPanel layout="rail" />

        <div className="min-w-0 space-y-5">
          <section className="mx-auto w-full max-w-[720px] space-y-5 rounded-3xl bg-black/20 px-4 py-5 ring-1 ring-white/[0.06] sm:px-5">
            <WaitlistUnlocksPanel
              score={initialAccount.score}
              email={initialAccount.email}
              linkedMethods={initialAccount.linkedMethods}
              zoraHandle={initialAccount.accountSignals.zoraHandle}
              canonicalCswAddress={initialAccount.accountSignals.canonicalCswAddress}
              signingStepComplete={signingStepComplete}
              showIdentityActions={false}
            />

            {canEnterApp ? (
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
                <p className="text-xs text-zinc-500">Optional setup can wait until after you enter.</p>
              </div>
            ) : (
              <div className="rounded-2xl bg-white/[0.03] px-4 py-3 text-sm text-zinc-300">
                <p>You're in. We'll notify you when your spot opens.</p>
                <p className="mt-1 text-xs text-zinc-500">Share your referral link to move up the list.</p>
              </div>
            )}

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setShowAdvancedSetup((open) => !open)}
                className="flex-1"
              >
                {showAdvancedSetup ? 'Hide account setup' : 'Optional account setup'}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setShowChat((open) => !open)}
                className="flex-1"
              >
                {showChat ? 'Hide chat' : 'Open group chat'}
              </Button>
            </div>

            <div className="flex justify-center pt-1">
                <button
                  type="button"
                  onClick={() => void onSignOut()}
                  disabled={signOutBusy}
                  className="text-xs text-zinc-400 transition hover:text-zinc-300 disabled:opacity-50"
                >
                  {signOutBusy ? 'Signing out...' : 'Sign out'}
                </button>
            </div>
          </section>

          {showAdvancedSetup ? (
            <section className="mx-auto w-full max-w-[720px]">
              <Suspense fallback={<LoadingInline labelOverride="Loading account setup…" />}>
                <LazyWaitlistAdvancedSetup
                  initialAccount={initialAccount}
                  canEnterApp={canEnterApp}
                  completionBusy={completionBusy}
                  onEnterApp={onEnterApp}
                  onSignOut={onSignOut}
                  signOutBusy={signOutBusy}
                  onSigningStepCompleteChange={setSigningStepComplete}
                />
              </Suspense>
            </section>
          ) : null}

          {showChat ? (
            <section className="mx-auto w-full max-w-[720px]">
              <Suspense fallback={<LoadingInline labelOverride="Loading waitlist chat…" />}>
                <LazyWaitlistGroupChatPanel
                  setupComplete={waitlistJoined}
                  signingReady={signingStepComplete}
                  layout="inline"
                  onSignOut={onSignOut}
                  signOutBusy={signOutBusy}
                  onRepairSession={onRepairSession}
                  repairBusy={repairBusy}
                />
              </Suspense>
            </section>
          ) : null}

          <WaitlistLeaderboardPanel layout="mobile" />
        </div>
      </div>
    </div>
  )
}
