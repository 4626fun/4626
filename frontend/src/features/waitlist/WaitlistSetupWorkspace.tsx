import { useEffect, useRef, useState } from 'react'

import { SHARE_SYMBOL_PREFIX } from '@/lib/tokens/tokenSymbols'
import { AccountSetupWorkspaceView } from '@/features/accountSetup/AccountSetupWorkspaceView'
import type { AccountSetupMe } from '@/features/accountSetup/types'
import { useAccountSetupController } from '@/features/accountSetup/useAccountSetupController'
import { apiFetch } from '@/lib/api/apiBase'
import { WalletProviders } from '@/web3/Web3Providers'
import { WaitlistUnlocksPanel } from './WaitlistUnlocksPanel'

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
  const currentAccount = controller.me ?? initialAccount
  const signingStepComplete =
    currentAccount.accountSignals.executionTrack === 'legacy-owner-install' ||
    currentAccount.accountSignals.privyEmbeddedEoaIsOwnerOfCanonicalCsw === true ||
    /4626 signing is enabled|already enabled/i.test(controller.notice ?? '')
  const setupComplete =
    controller.zoraLinked && Boolean(controller.canonicalCswAddress) && signingStepComplete
  const canEnterNow = canEnterApp && setupComplete
  const [waitlistChatStatus, setWaitlistChatStatus] = useState<'idle' | 'joining' | 'joined' | 'blocked' | 'error'>('idle')
  const attemptedIdentityRef = useRef<string | null>(null)

  useEffect(() => {
    const identity = controller.canonicalCswAddress?.toLowerCase() ?? null
    if (!setupComplete || !identity) return
    if (attemptedIdentityRef.current === identity) return

    attemptedIdentityRef.current = identity
    let cancelled = false

    void (async () => {
      if (!cancelled) setWaitlistChatStatus('joining')
      try {
        const response = await apiFetch('/api/waitlist/xmtp-join', { method: 'POST' })
        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { error?: string } | null
          const reason = String(payload?.error ?? '')
          if (reason === 'embedded_owner_not_installed') {
            if (!cancelled) setWaitlistChatStatus('blocked')
            return
          }
          if (!cancelled) setWaitlistChatStatus('error')
          return
        }
        if (!cancelled) setWaitlistChatStatus('joined')
      } catch {
        if (!cancelled) setWaitlistChatStatus('error')
      }
    })()

    return () => {
      cancelled = true
    }
  }, [controller.canonicalCswAddress, setupComplete])

  return (
    <AccountSetupWorkspaceView
      context="waitlist"
      controller={controller}
      summaryActions={
        <div className="w-full space-y-5">
          <WaitlistUnlocksPanel score={initialAccount.score} email={initialAccount.email} />
          {setupComplete ? (
            <div className="bv-subpanel px-4 py-3">
              <p className="bv-kicker text-brand-300">Waitlist chat</p>
              <p className="mt-1 text-sm text-zinc-300">
                {waitlistChatStatus === 'joining'
                  ? 'Joining XMTP waitlist group with your Zora CSW identity...'
                  : waitlistChatStatus === 'joined'
                    ? 'Joined. Your Zora CSW is queued as your XMTP identity.'
                    : waitlistChatStatus === 'blocked'
                      ? 'Enable 4626 signing to join waitlist chat.'
                      : waitlistChatStatus === 'error'
                        ? 'Chat join is temporarily unavailable. It will retry when this page refreshes.'
                        : 'Waiting to join waitlist chat.'}
              </p>
            </div>
          ) : null}
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
