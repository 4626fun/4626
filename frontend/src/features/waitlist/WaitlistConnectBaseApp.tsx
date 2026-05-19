/**
 * Track C2 — sub-accounts on the waitlist (frontend).
 *
 * Base App connect flow:
 *   1. Connect Base Account + provision the per-app sub-account (passkey when creating).
 *   2. Wire the Privy embedded EOA as the sub-account signer (silent SDK step).
 *   3. POST /api/arch-b/sub-account/baseapp/register
 *
 * Per docs/ACCOUNT_MODEL.md §5.3, this track does not call addOwnerAddress on the
 * parent CSW or the sub-account — wallet_addSubAccount keys + setToOwnerAccount
 * are the signing surface.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Address } from 'viem'

import { PixelWaveLoader } from '@/components/ui/PixelWaveLoader'
import { apiFetch } from '@/lib/api/apiBase'
import { useSubAccountSetup } from '@/hooks/useSubAccountSetup'
import type { SubAccountSetupStage, SubAccountSetupStageEvent } from '@/lib/wallet/subAccountSetup'

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
}

type ViewState =
  | { kind: 'idle' }
  | { kind: 'connecting' }
  | { kind: 'complete'; parentAddress: Address; subAccountAddress: Address }
  | { kind: 'error'; message: string; canRetry: boolean }

const STAGE_LABELS: Partial<Record<SubAccountSetupStage, string>> = {
  check_existing: 'Checking for your 4626 app wallet…',
  create_sub_account: 'Creating your app wallet (one passkey)…',
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

function mapSetupFailureMessage(params: {
  error: Error | null
  lastStage: SubAccountSetupStageEvent | null
  fallback: string
}): string {
  const combined = [params.error?.message, params.lastStage?.message].filter(Boolean).join(' ')
  const lower = combined.toLowerCase()

  if (
    lower.includes('not supported') &&
    (lower.includes('wallet_addsubaccount') || lower.includes('method'))
  ) {
    return 'Base App could not create your app wallet. Update the app and try Connect Base App again.'
  }
  if (lower.includes('user rejected') ||
    lower.includes('user denied') ||
    lower.includes('rejected the request')
  ) {
    return 'You declined the Base App request. Tap Connect Base App to try again.'
  }
  if (lower.includes('base account wallet')) {
    return 'Connect Base App first, then try again.'
  }
  if (params.error?.message) return params.error.message
  return params.fallback
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
    finalizeSubAccountSigner,
    connectBaseAccountWallet,
    getLastSetupError,
    isSettingUp,
    lastStage,
    embeddedWallet,
  } = useSubAccountSetup()

  const [view, setView] = useState<ViewState>({ kind: 'idle' })
  const cancelledRef = useRef(false)

  useEffect(() => {
    return () => {
      cancelledRef.current = true
    }
  }, [])

  const progressLabel = useMemo(() => {
    if (view.kind !== 'connecting') return null
    const live = lastStage?.stage
    if (live && STAGE_LABELS[live]) return STAGE_LABELS[live]
    return 'Connecting your Base App wallet…'
  }, [view.kind, lastStage])

  const persistAndComplete = useCallback(
    async (pending: PendingProvision) => {
      const embeddedEoaAddress = (embeddedWallet?.address ?? '') as Address
      if (!embeddedEoaAddress) {
        setView({
          kind: 'error',
          message: 'Could not resolve your 4626 embedded signer address. Try again or skip.',
          canRetry: true,
        })
        return
      }

      const registered = await registerBaseAppLink({
        parentAddress: pending.parentAddress,
        subAccountAddress: pending.subAccountAddress,
        embeddedEoaAddress,
      })

      if (cancelledRef.current) return
      if (!registered.ok) {
        setView({ kind: 'error', message: registered.message, canRetry: true })
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
    if (isSettingUp || view.kind === 'connecting') return
    setView({ kind: 'connecting' })

    const connected = await connectBaseAccountWallet()
    if (cancelledRef.current) return
    if (!connected) {
      setView({
        kind: 'error',
        message: mapSetupFailureMessage({
          error: getLastSetupError(),
          lastStage,
          fallback: 'Connect Base App first, then try again.',
        }),
        canRetry: true,
      })
      return
    }

    const provisioned = await provisionSubAccount()
    if (cancelledRef.current) return
    if (!provisioned) {
      setView({
        kind: 'error',
        message: mapSetupFailureMessage({
          error: getLastSetupError(),
          lastStage,
          fallback: 'Could not prepare your Base App wallet. Make sure Base App is connected and try again.',
        }),
        canRetry: true,
      })
      return
    }

    const pending: PendingProvision = {
      parentAddress: provisioned.parentAddress,
      subAccountAddress: provisioned.subAccountAddress,
      created: provisioned.created,
    }

    const finalized = await finalizeSubAccountSigner({
      parentAddress: pending.parentAddress,
      subAccountAddress: pending.subAccountAddress,
    })
    if (cancelledRef.current) return
    if (!finalized) {
      setView({
        kind: 'error',
        message: mapSetupFailureMessage({
          error: getLastSetupError(),
          lastStage,
          fallback: 'Could not link your 4626 signer to the app wallet. Try again.',
        }),
        canRetry: true,
      })
      return
    }

    await persistAndComplete(pending)
  }, [
    connectBaseAccountWallet,
    finalizeSubAccountSigner,
    getLastSetupError,
    isSettingUp,
    lastStage,
    persistAndComplete,
    provisionSubAccount,
    view.kind,
  ])

  const handleRetry = useCallback(() => {
    if (view.kind !== 'error' || !view.canRetry) return
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
          Link your Base App wallet for sponsored swaps. We create a dedicated 4626 app wallet signed by your embedded
          4626 key — your main Base App wallet stays unchanged. Base App only asks for a passkey when creating a new app
          wallet; linking your signer afterward is silent.
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

      {view.kind === 'connecting' ? (
        <div className="space-y-3" role="status" aria-live="polite" data-testid="waitlist-connect-base-app-connecting">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-zinc-200">
            <PixelWaveLoader name="wave-lr" size={12} color="rgba(255,255,255,0.92)" />
            <span data-testid="connect-stage-label">{progressLabel}</span>
          </div>
        </div>
      ) : null}

      {view.kind === 'complete' ? (
        <div className="space-y-3" data-testid="waitlist-connect-base-app-complete">
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-left text-sm text-emerald-200">
            <div className="font-medium text-emerald-100">Base App connected</div>
            <div className="mt-1 break-all font-mono text-xs text-emerald-200/80">{view.subAccountAddress}</div>
            <div className="mt-1 font-mono text-xs text-emerald-200/60">{shortAddress(view.subAccountAddress)}</div>
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
