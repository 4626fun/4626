import { useEffect, useRef, useState } from 'react'

import type { AccountSetupMe } from '@/features/accountSetup/types'
import { apiFetch } from '@/lib/api/apiBase'
import { Modal } from '@/components/ui/Modal'
import { WaitlistUnlocksPanel } from './WaitlistUnlocksPanel'
import { SHARE_SYMBOL_PREFIX } from '@/lib/tokens/tokenSymbols'
import { isWaitlistSigningReady } from './waitlistFlowState'

type WaitlistSetupTrayProps = {
  account: AccountSetupMe
  canEnterApp: boolean
  completionBusy: boolean
  onEnterApp: () => void | Promise<void>
  onSignOut: () => void | Promise<void>
  signOutBusy?: boolean
}

function getWaitlistChatStatusMeta(status: 'idle' | 'joining' | 'queued' | 'blocked' | 'config' | 'error'): {
  label: string
  toneClass: string
  message: string
} {
  if (status === 'joining') {
    return {
      label: 'Joining',
      toneClass: 'text-sky-300 bg-sky-400/10 border-sky-400/20',
      message: 'Adding your Zora CSW to the waitlist chat...',
    }
  }
  if (status === 'queued') {
    return {
      label: 'Queued',
      toneClass: 'text-emerald-300 bg-emerald-400/10 border-emerald-400/20',
      message: 'Queued. You should be added shortly.',
    }
  }
  if (status === 'blocked') {
    return {
      label: 'Needs signing',
      toneClass: 'text-amber-300 bg-amber-400/10 border-amber-400/20',
      message: 'Enable 4626 signing to join waitlist chat.',
    }
  }
  if (status === 'config') {
    return {
      label: 'Not configured',
      toneClass: 'text-zinc-300 bg-zinc-400/10 border-zinc-400/20',
      message: 'Waitlist chat is not configured yet.',
    }
  }
  if (status === 'error') {
    return {
      label: 'Retry needed',
      toneClass: 'text-rose-300 bg-rose-400/10 border-rose-400/20',
      message: 'Chat join is temporarily unavailable. Retry in settings.',
    }
  }
  return {
    label: 'Pending',
    toneClass: 'text-zinc-300 bg-zinc-400/10 border-zinc-400/20',
    message: 'Waiting to join waitlist chat.',
  }
}

export function WaitlistSetupTray(props: WaitlistSetupTrayProps) {
  const { account, canEnterApp, completionBusy, onEnterApp, onSignOut, signOutBusy = false } = props
  const [trayOpen, setTrayOpen] = useState(false)
  const [waitlistChatStatus, setWaitlistChatStatus] = useState<
    'idle' | 'joining' | 'queued' | 'blocked' | 'config' | 'error'
  >('idle')
  const completedIdentityRef = useRef<string | null>(null)
  const inFlightIdentityRef = useRef<string | null>(null)

  const signingStepComplete = isWaitlistSigningReady(account)
  const setupComplete = Boolean(account.accountSignals.linked && account.accountSignals.canonicalCswAddress && signingStepComplete)
  const canEnterNow = canEnterApp && setupComplete
  const chatMeta = getWaitlistChatStatusMeta(waitlistChatStatus)

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
    <div className="mx-auto w-full max-w-[640px] space-y-4">
      <div className="rounded-[16px] border border-white/[0.08] bg-white/[0.03] px-4 py-4 sm:px-5">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-[11px] uppercase tracking-[0.14em] text-zinc-500">Waitlist status</p>
            <p className="text-sm text-zinc-200">
              {setupComplete
                ? 'Setup complete. You are ready to enter.'
                : 'Complete signer authorization to unlock chat and app entry.'}
            </p>
          </div>
          <span
            className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.11em] ${setupComplete ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300' : 'border-amber-400/20 bg-amber-400/10 text-amber-300'}`}
          >
            {setupComplete ? 'Ready' : 'Needs setup'}
          </span>
        </div>

        <div className="mt-3 rounded-lg border border-white/10 bg-black/20 px-3 py-2.5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] uppercase tracking-[0.12em] text-zinc-500">Waitlist chat</p>
            <span
              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em] ${chatMeta.toneClass}`}
            >
              {chatMeta.label}
            </span>
          </div>
          <p className="mt-1 text-sm text-zinc-300">{chatMeta.message}</p>
        </div>
      </div>

      <section className="rounded-[13px] border border-brand-primary/20 bg-brand-primary/[0.07] px-4 py-4">
        <div className="mb-2 text-[11px] uppercase tracking-[0.14em] text-brand-200">Boost points</div>
        <WaitlistUnlocksPanel score={account.score} email={account.email} />
      </section>

      <div className="-mx-1 flex w-[calc(100%+0.5rem)] items-center gap-2 overflow-x-auto px-1 pb-1 sm:mx-0 sm:w-full sm:overflow-visible sm:px-0 sm:pb-0">
        {canEnterNow ? (
          <button
            type="button"
            onClick={() => void onEnterApp()}
            disabled={completionBusy}
            className="btn-accent btn-no-icon inline-flex min-w-[96px] shrink-0 flex-1 justify-center px-3 text-xs sm:min-w-0 sm:text-sm disabled:opacity-50 disabled:grayscale"
          >
            {completionBusy ? (
              'Entering...'
            ) : (
              <>
                <span className="sm:hidden">Enter</span>
                <span className="hidden sm:inline">{`${SHARE_SYMBOL_PREFIX} Enter App`}</span>
              </>
            )}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setTrayOpen(true)}
            className="btn-accent btn-no-icon inline-flex min-w-[96px] shrink-0 flex-1 justify-center px-3 text-xs sm:min-w-0 sm:text-sm"
          >
            <span className="sm:hidden">Finish</span>
            <span className="hidden sm:inline">Finish setup</span>
          </button>
        )}
        <button
          type="button"
          onClick={() => setTrayOpen(true)}
          className="btn-secondary btn-no-icon inline-flex min-w-[96px] shrink-0 flex-1 justify-center px-3 text-xs sm:min-w-0 sm:text-sm"
        >
          <span className="sm:hidden">Settings</span>
          <span className="hidden sm:inline">Account settings</span>
        </button>
        <button
          type="button"
          onClick={() => void onSignOut()}
          disabled={signOutBusy}
          className="inline-flex min-w-[96px] shrink-0 flex-1 items-center justify-center rounded-lg px-3 py-2 text-xs font-medium text-rose-400 transition hover:text-rose-300 disabled:opacity-50 disabled:grayscale sm:min-w-0 sm:text-sm"
        >
          {signOutBusy ? 'Signing out...' : 'Sign out'}
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

