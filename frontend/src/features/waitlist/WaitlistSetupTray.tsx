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
  const [waitlistChatStatus, setWaitlistChatStatus] = useState<
    'idle' | 'joining' | 'queued' | 'blocked' | 'config' | 'error'
  >('idle')
  const completedIdentityRef = useRef<string | null>(null)
  const inFlightIdentityRef = useRef<string | null>(null)

  const signingStepComplete =
    account.accountSignals.executionTrack === 'sub-account' ||
    account.accountSignals.executionTrack === 'migration-pending' ||
    account.accountSignals.executionTrack === 'legacy-owner-install' ||
    account.accountSignals.privyEmbeddedEoaIsOwnerOfCanonicalCsw === true
  const setupComplete = Boolean(account.accountSignals.linked && account.accountSignals.canonicalCswAddress && signingStepComplete)
  const canEnterNow = canEnterApp && setupComplete

  useEffect(() => {
    const identity = account.accountSignals.canonicalCswAddress?.toLowerCase() ?? null
    if (!setupComplete || !identity) return
    if (completedIdentityRef.current === identity) return
    if (inFlightIdentityRef.current === identity) return

    inFlightIdentityRef.current = identity
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
            completedIdentityRef.current = identity
            return
          }
          if (reason === 'waitlist_chat_not_configured' || reason === 'waitlist_chat_vault_not_configured') {
            if (!cancelled) setWaitlistChatStatus('config')
            completedIdentityRef.current = identity
            return
          }
          if (!cancelled) setWaitlistChatStatus('error')
          return
        }
        if (!cancelled) setWaitlistChatStatus('queued')
        completedIdentityRef.current = identity
      } catch {
        if (!cancelled) setWaitlistChatStatus('error')
      } finally {
        if (inFlightIdentityRef.current === identity) inFlightIdentityRef.current = null
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
              ? 'Queueing your Zora CSW identity for the XMTP waitlist group...'
              : waitlistChatStatus === 'queued'
                ? 'Queued. Your Zora CSW will be added to the waitlist group shortly.'
                : waitlistChatStatus === 'blocked'
                  ? 'Enable 4626 signing to join waitlist chat.'
                : waitlistChatStatus === 'config'
                  ? 'Waitlist chat is not configured yet. Ask an admin to set the waitlist XMTP group.'
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
                ? 'Queueing...'
                : waitlistChatStatus === 'queued'
                  ? 'Queued.'
                  : waitlistChatStatus === 'blocked'
                    ? 'Blocked until signing is enabled.'
                  : waitlistChatStatus === 'config'
                    ? 'Not configured yet.'
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

