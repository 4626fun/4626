/**
 * Track C2 — sub-accounts on the waitlist (frontend).
 *
 * Two-step Base App connect:
 *   1. Provision the per-app sub-account (one passkey when creating).
 *   2. User signs addOwnerAddress(privyEmbeddedEoa) on the sub-account.
 *   3. Silent SDK signer wiring + server register.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Address } from 'viem'

import { PixelWaveLoader } from '@/components/ui/PixelWaveLoader'
import { apiFetch } from '@/lib/api/apiBase'
import { useSubAccountSetup } from '@/hooks/useSubAccountSetup'
import type { SubAccountSetupStage } from '@/lib/wallet/subAccountSetup'

export type WaitlistConnectBaseAppResult = {
  parentAddress: Address
  subAccountAddress: Address
}

type Props = {
  onSkip: () => void
  onComplete: (result: WaitlistConnectBaseAppResult) => void
}

type PendingProvision = {
  parentAddress: Address
  subAccountAddress: Address
  created: boolean
  provider: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> }
}

type ViewState =
  | { kind: 'idle' }
  | { kind: 'provisioning' }
  | { kind: 'ready_to_sign'; pending: PendingProvision }
  | { kind: 'signing_owner'; pending: PendingProvision }
  | { kind: 'finishing'; pending: PendingProvision }
  | { kind: 'registering'; parentAddress: Address; subAccountAddress: Address }
  | { kind: 'complete'; parentAddress: Address; subAccountAddress: Address }
  | { kind: 'error'; message: string; canRetry: boolean; retryFrom?: 'start' | 'sign' }

const PROVISION_LABELS: Partial<Record<SubAccountSetupStage, string>> = {
  check_existing: 'Checking for your 4626 app wallet…',
  create_sub_account: 'Creating your app wallet (one passkey)…',
}

const SIGN_LABELS: Partial<Record<SubAccountSetupStage, string>> = {
  install_embedded_owner: 'Confirm 4626 signing in Base App…',
  configure_signer: 'Linking your 4626 signer…',
}

const COMPLETE_AUTOADVANCE_MS = 1_400

function mapRegisterError(code: string, fallback: string): { message: string; canRetry: boolean; autoSkip: boolean } {
  switch (code) {
    case 'embedded_eoa_mismatch':
      return {
        message:
          'This Base App wallet is linked to a different 4626 account. Sign in with your original email first.',
        canRetry: false,
        autoSkip: false,
      }
    case 'parent_csw_conflict':
      return {
        message:
          'Your account is already linked to a different Base App wallet. Contact support to change it.',
        canRetry: false,
        autoSkip: false,
      }
    case 'feature_disabled':
      return {
        message: 'This feature is not yet enabled. Skipping for now.',
        canRetry: false,
        autoSkip: true,
      }
    case 'unexpected_error':
    case 'db_unavailable':
      return {
        message:
          'We could not save your Base App link right now. Please try again in a moment, or skip and finish setup later.',
        canRetry: true,
        autoSkip: false,
      }
    case 'profile_not_ready':
      return {
        message: 'Finish email verification first, then return to connect Base App.',
        canRetry: false,
        autoSkip: false,
      }
    default: {
      const looksLikeCode = /^[a-z][a-z0-9_]*$/.test(code)
      return {
        message: looksLikeCode
          ? 'Could not register your Base App wallet. Please try again.'
          : fallback || 'Could not register your Base App wallet.',
        canRetry: true,
        autoSkip: false,
      }
    }
  }
}

function basescanAddressUrl(address: Address): string {
  return `https://basescan.org/address/${address}`
}

function shortAddress(address: Address): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}

async function registerBaseAppLink(body: Record<string, string>): Promise<{ ok: boolean; message: string }> {
  let response: Response
  try {
    response = await apiFetch('/api/arch-b/sub-account/baseapp/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body),
    })
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : 'Network error while registering Base App wallet.',
    }
  }

  let payload: { success?: boolean; error?: string } | null = null
  try {
    payload = (await response.json()) as { success?: boolean; error?: string } | null
  } catch {
    payload = null
  }

  if (response.ok && payload?.success) {
    return { ok: true, message: '' }
  }

  const errorCode = (payload?.error ?? '').toString()
  const fallbackMessage = errorCode || `Server returned ${response.status}.`
  const mapped = mapRegisterError(errorCode, fallbackMessage)
  return { ok: false, message: mapped.message }
}

export function WaitlistConnectBaseApp(props: Props) {
  const { onSkip, onComplete } = props
  const {
    provisionSubAccount,
    confirmSubAccountEmbeddedOwner,
    finalizeSubAccountSigner,
    isSettingUp,
    lastStage,
    embeddedWallet,
  } = useSubAccountSetup()

  const [view, setView] = useState<ViewState>({ kind: 'idle' })
  const cancelledRef = useRef(false)
  const pendingRef = useRef<PendingProvision | null>(null)

  useEffect(() => {
    return () => {
      cancelledRef.current = true
    }
  }, [])

  const progressLabel = useMemo(() => {
    if (view.kind === 'provisioning') {
      const live = lastStage?.stage
      if (live && PROVISION_LABELS[live]) return PROVISION_LABELS[live]
      return 'Preparing your 4626 app wallet…'
    }
    if (view.kind === 'signing_owner' || view.kind === 'finishing') {
      const live = lastStage?.stage
      if (live && SIGN_LABELS[live]) return SIGN_LABELS[live]
      return 'Enabling 4626 signing…'
    }
    return null
  }, [view.kind, lastStage])

  const persistAndComplete = useCallback(
    async (pending: PendingProvision) => {
      const embeddedEoaAddress = (embeddedWallet?.address ?? '') as Address
      if (!embeddedEoaAddress) {
        setView({
          kind: 'error',
          message: 'Could not resolve your 4626 embedded signer address. Try again or skip.',
          canRetry: true,
          retryFrom: 'sign',
        })
        return
      }

      setView({ kind: 'registering', parentAddress: pending.parentAddress, subAccountAddress: pending.subAccountAddress })

      const registered = await registerBaseAppLink({
        parentAddress: pending.parentAddress,
        subAccountAddress: pending.subAccountAddress,
        embeddedEoaAddress,
      })

      if (cancelledRef.current) return
      if (!registered.ok) {
        setView({ kind: 'error', message: registered.message, canRetry: true, retryFrom: 'sign' })
        return
      }

      setView({
        kind: 'complete',
        parentAddress: pending.parentAddress,
        subAccountAddress: pending.subAccountAddress,
      })
    },
    [embeddedWallet?.address],
  )

  const handleConnect = useCallback(async () => {
    if (isSettingUp) return
    setView({ kind: 'provisioning' })

    const provisioned = await provisionSubAccount()
    if (cancelledRef.current) return
    if (!provisioned) {
      setView({
        kind: 'error',
        message: 'Could not prepare your Base App wallet. Make sure Base App is connected and try again.',
        canRetry: true,
        retryFrom: 'start',
      })
      return
    }

    const pending: PendingProvision = {
      parentAddress: provisioned.parentAddress,
      subAccountAddress: provisioned.subAccountAddress,
      created: provisioned.created,
      provider: provisioned.provider,
    }
    pendingRef.current = pending
    setView({ kind: 'ready_to_sign', pending })
  }, [isSettingUp, provisionSubAccount])

  const handleEnableSigning = useCallback(async () => {
    if (view.kind !== 'ready_to_sign' || isSettingUp) return
    const pending = view.pending
    setView({ kind: 'signing_owner', pending })

    const ownerResult = await confirmSubAccountEmbeddedOwner({
      parentAddress: pending.parentAddress,
      subAccountAddress: pending.subAccountAddress,
      provider: pending.provider,
    })
    if (cancelledRef.current) return
    if (!ownerResult) {
      setView({
        kind: 'error',
        message: '4626 signing was not enabled. Approve the request in Base App or try again.',
        canRetry: true,
        retryFrom: 'sign',
      })
      return
    }

    setView({ kind: 'finishing', pending })
    const finalized = await finalizeSubAccountSigner({
      parentAddress: pending.parentAddress,
      subAccountAddress: pending.subAccountAddress,
    })
    if (cancelledRef.current) return
    if (!finalized) {
      setView({
        kind: 'error',
        message: 'Could not finish linking your 4626 signer. Try again.',
        canRetry: true,
        retryFrom: 'sign',
      })
      return
    }

    await persistAndComplete(pending)
  }, [
    confirmSubAccountEmbeddedOwner,
    finalizeSubAccountSigner,
    isSettingUp,
    persistAndComplete,
    view,
  ])

  const handleRetry = useCallback(() => {
    if (view.kind !== 'error') return
    if (view.retryFrom === 'sign' && pendingRef.current) {
      setView({ kind: 'ready_to_sign', pending: pendingRef.current })
      return
    }
    void handleConnect()
  }, [handleConnect, view])

  useEffect(() => {
    if (view.kind !== 'complete') return
    const timer = window.setTimeout(() => {
      onComplete({ parentAddress: view.parentAddress, subAccountAddress: view.subAccountAddress })
    }, COMPLETE_AUTOADVANCE_MS)
    return () => window.clearTimeout(timer)
  }, [view, onComplete])

  return (
    <div className="mx-auto w-full max-w-md space-y-6 text-center" data-testid="waitlist-connect-base-app">
      <div className="space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[rgb(var(--brand-primary)/0.8)]">
          Optional · Base App
        </p>
        <h2 className="text-[1.8rem] font-light leading-tight tracking-tight text-white">Connect Base App</h2>
        <p className="text-sm leading-relaxed text-zinc-400">
          Link your Base App wallet for sponsored swaps. We create a dedicated 4626 app wallet, then you confirm one
          signing step — your main Base App wallet stays unchanged.
        </p>
      </div>

      {view.kind === 'idle' ? (
        <div className="space-y-3">
          <button
            type="button"
            className="btn-accent btn-no-icon w-full"
            onClick={() => void handleConnect()}
            data-testid="connect-base-app-button"
          >
            Connect Base App
          </button>
          <button
            type="button"
            className="text-xs font-medium uppercase tracking-wider text-zinc-500 hover:text-zinc-300"
            onClick={onSkip}
            data-testid="skip-base-app-button"
          >
            Skip for now
          </button>
        </div>
      ) : null}

      {view.kind === 'provisioning' ? (
        <div className="space-y-3" role="status" aria-live="polite" data-testid="waitlist-connect-base-app-provisioning">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-zinc-200">
            <PixelWaveLoader name="wave-lr" size={12} color="rgba(255,255,255,0.92)" />
            <span data-testid="provisioning-stage-label">{progressLabel}</span>
          </div>
        </div>
      ) : null}

      {view.kind === 'ready_to_sign' ? (
        <div className="space-y-4 text-left" data-testid="waitlist-connect-base-app-ready">
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-100">
            <div className="font-medium text-emerald-50">App wallet ready</div>
            <div className="mt-1 font-mono text-xs text-emerald-200/80">{shortAddress(view.pending.subAccountAddress)}</div>
            <p className="mt-2 text-xs leading-relaxed text-emerald-200/90">
              {view.pending.created
                ? 'Your 4626 app wallet was created. One more step enables signing from this app.'
                : 'We found your existing 4626 app wallet. Confirm signing to finish linking.'}
            </p>
          </div>
          <button
            type="button"
            className="btn-accent btn-no-icon w-full"
            onClick={() => void handleEnableSigning()}
            data-testid="enable-signing-button"
          >
            Enable 4626 signing
          </button>
          <p className="text-center text-xs text-zinc-500">
            You will approve one request in Base App. We add your 4626 signer to the app wallet only — not your main
            wallet.
          </p>
          <button
            type="button"
            className="w-full text-xs font-medium uppercase tracking-wider text-zinc-500 hover:text-zinc-300"
            onClick={onSkip}
          >
            Skip for now
          </button>
        </div>
      ) : null}

      {view.kind === 'signing_owner' || view.kind === 'finishing' ? (
        <div className="space-y-3" role="status" aria-live="polite">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-zinc-200">
            <PixelWaveLoader name="wave-lr" size={12} color="rgba(255,255,255,0.92)" />
            <span>{progressLabel}</span>
          </div>
        </div>
      ) : null}

      {view.kind === 'registering' ? (
        <div className="space-y-3" role="status" aria-live="polite" data-testid="waitlist-connect-base-app-registering">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-zinc-200">
            <PixelWaveLoader name="wave-lr" size={12} color="rgba(255,255,255,0.92)" />
            <span>Saving link to your 4626 account…</span>
          </div>
        </div>
      ) : null}

      {view.kind === 'complete' ? (
        <div className="space-y-3" data-testid="waitlist-connect-base-app-complete">
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-left text-sm text-emerald-200">
            <div className="font-medium text-emerald-100">Base App connected</div>
            <div className="mt-1 break-all font-mono text-xs text-emerald-200/80">{view.subAccountAddress}</div>
            <a
              href={basescanAddressUrl(view.subAccountAddress)}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex text-xs font-medium text-emerald-300 underline-offset-2 hover:underline"
              data-testid="basescan-link"
            >
              View on Basescan ↗
            </a>
          </div>
        </div>
      ) : null}

      {view.kind === 'error' ? (
        <div className="space-y-3" role="alert" aria-live="polite" data-testid="waitlist-connect-base-app-error">
          <div className="rounded-lg border border-rose-500/20 bg-rose-500/8 px-4 py-3 text-left text-sm text-rose-200">
            {view.message}
          </div>
          <div className="flex items-center justify-center gap-3">
            {view.canRetry ? (
              <button
                type="button"
                className="btn-accent btn-no-icon"
                onClick={() => void handleRetry()}
                data-testid="retry-base-app-button"
              >
                Try again
              </button>
            ) : null}
            <button
              type="button"
              className="text-xs font-medium uppercase tracking-wider text-zinc-500 hover:text-zinc-300"
              onClick={onSkip}
              data-testid="skip-base-app-button"
            >
              Skip for now
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default WaitlistConnectBaseApp
