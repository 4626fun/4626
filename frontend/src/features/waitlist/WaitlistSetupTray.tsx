import { useEffect, useRef, useState } from 'react'

import type { AccountSetupMe } from '@/features/accountSetup/types'
import { apiFetch } from '@/lib/api/apiBase'
import { Modal } from '@/components/ui/Modal'
import { WaitlistUnlocksPanel } from './WaitlistUnlocksPanel'
import { SHARE_SYMBOL_PREFIX } from '@/lib/tokens/tokenSymbols'

type WaitlistSetupTrayProps = {
  account: AccountSetupMe
  canEnterApp: boolean
  completionBusy: boolean
  onEnterApp: () => void | Promise<void>
}

export function WaitlistSetupTray(props: WaitlistSetupTrayProps) {
  const { account, canEnterApp, completionBusy, onEnterApp } = props
  const [trayOpen, setTrayOpen] = useState(false)
  const [waitlistChatStatus, setWaitlistChatStatus] = useState<'idle' | 'joining' | 'joined' | 'blocked' | 'error'>('idle')
  const attemptedIdentityRef = useRef<string | null>(null)

  const signingStepComplete =
    account.accountSignals.executionTrack === 'legacy-owner-install' ||
    account.accountSignals.privyEmbeddedEoaIsOwnerOfCanonicalCsw === true
  const setupComplete = Boolean(account.accountSignals.linked && account.accountSignals.canonicalCswAddress && signingStepComplete)
  const canEnterNow = canEnterApp && setupComplete

  useEffect(() => {
    const identity = account.accountSignals.canonicalCswAddress?.toLowerCase() ?? null
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
  }, [account.accountSignals.canonicalCswAddress, setupComplete])

  return (
    <div className="mx-auto w-full max-w-[640px] space-y-5">
      <div className="rounded-[13px] border border-white/[0.08] bg-white/[0.02] px-4 py-4 space-y-3">
        <div className="space-y-1">
          <p className="text-[11px] uppercase tracking-[0.14em] text-zinc-500">Account status</p>
          <p className="text-sm text-zinc-300">
            {setupComplete
              ? 'Account setup complete.'
              : 'Account setup is partially complete. Open settings to finish signer authorization.'}
          </p>
        </div>
        <div className="rounded-md border border-white/10 bg-black/20 px-3 py-2.5">
          <p className="text-[11px] uppercase tracking-[0.12em] text-zinc-500">Waitlist chat</p>
          <p className="mt-1 text-sm text-zinc-300">
            {waitlistChatStatus === 'joining'
              ? 'Joining XMTP waitlist group with your Zora CSW identity...'
              : waitlistChatStatus === 'joined'
                ? 'Joined. Your Zora CSW is queued as your XMTP identity.'
                : waitlistChatStatus === 'blocked'
                  ? 'Enable 4626 signing to join waitlist chat.'
                  : waitlistChatStatus === 'error'
                    ? 'Chat join is temporarily unavailable. Retry from Account settings.'
                    : 'Waiting to join waitlist chat.'}
          </p>
        </div>
      </div>

      <section className="rounded-[13px] border border-brand-primary/20 bg-brand-primary/[0.07] px-4 py-4">
        <div className="mb-2 text-[11px] uppercase tracking-[0.14em] text-brand-200">Earn points faster</div>
        <WaitlistUnlocksPanel score={account.score} email={account.email} />
      </section>

      <div className="flex flex-wrap items-center gap-2">
        {canEnterNow ? (
          <button
            type="button"
            onClick={() => void onEnterApp()}
            disabled={completionBusy}
            className="btn-accent btn-no-icon inline-flex disabled:opacity-50 disabled:grayscale"
          >
            {completionBusy ? 'Entering App...' : `${SHARE_SYMBOL_PREFIX} Enter App`}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setTrayOpen(true)}
            className="btn-accent btn-no-icon inline-flex"
          >
            Finish setup
          </button>
        )}
        <button
          type="button"
          onClick={() => setTrayOpen(true)}
          className="btn-secondary btn-no-icon inline-flex"
        >
          Account settings
        </button>
      </div>

      <Modal
        open={trayOpen}
        onClose={() => setTrayOpen(false)}
        title="Account settings"
        maxWidth="max-w-lg"
      >
        <div className="space-y-3 text-sm text-zinc-300">
          <div className="rounded-md border border-white/10 bg-black/20 px-3 py-2.5">
            <p className="text-[11px] uppercase tracking-[0.12em] text-zinc-500">4626 signing</p>
            <p className="mt-1">
              {signingStepComplete ? 'Enabled on canonical Zora CSW.' : 'Pending. Finish signer authorization to continue.'}
            </p>
          </div>
          <div className="rounded-md border border-white/10 bg-black/20 px-3 py-2.5">
            <p className="text-[11px] uppercase tracking-[0.12em] text-zinc-500">Waitlist chat</p>
            <p className="mt-1">
              {waitlistChatStatus === 'joining'
                ? 'Joining...'
                : waitlistChatStatus === 'joined'
                  ? 'Joined.'
                  : waitlistChatStatus === 'blocked'
                    ? 'Blocked until signing is enabled.'
                    : waitlistChatStatus === 'error'
                      ? 'Temporarily unavailable.'
                      : 'Waiting.'}
            </p>
          </div>
        </div>
      </Modal>
    </div>
  )
}

