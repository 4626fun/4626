/**
 * Track C2 — sub-accounts on the waitlist (frontend).
 *
 * Base App connect flow:
 *   1. Connect Base Account + provision the per-app sub-account (passkey when creating).
 *   2. Install the Privy embedded EOA as an on-chain owner on the sub-account (addOwnerAddress).
 *   3. Wire the Privy embedded EOA as the sub-account SDK signer (silent).
 *   4. POST /api/arch-b/sub-account/baseapp/register
 *
 * Parent CSW addOwnerAddress from third-party dapps remains blocked; owner install
 * targets the per-app sub-account only.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import type { Address } from 'viem'

import { Button } from '@/components/ui/Button'
import { PixelWaveLoader } from '@/components/ui/PixelWaveLoader'
import { apiFetch } from '@/lib/api/apiBase'
import { usePrivyClientStatus } from '@/lib/privy/client'
import { useSubAccountSetup } from '@/hooks/useSubAccountSetup'
import type { SubAccountSetupStage, SubAccountSetupStageEvent } from '@/lib/wallet/subAccountSetup'
import { SubAccountOwnerInstallPanel } from './SubAccountOwnerInstallPanel'

export type WaitlistConnectBaseAppResult = {
  parentAddress: Address
  subAccountAddress: Address
}

type Props = {
  onSkip: () => void
  onComplete: (result: WaitlistConnectBaseAppResult) => void
  /** When set, show a recovery panel to addOwner on an existing sub-account. */
  parentAddress?: string | null
  subAccountAddress?: string | null
  embeddedEoaAddress?: string | null
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
  install_embedded_owner: 'Enabling 4626 signing on your app wallet…',
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
  const privyClientStatus = usePrivyClientStatus()
  if (privyClientStatus !== 'ready') {
    return (
      <div className="flex items-center justify-center gap-2 text-sm text-zinc-400" role="status">
        <PixelWaveLoader name="wave-lr" size={12} color="rgba(255,255,255,0.72)" />
        <span>Preparing wallet session…</span>
      </div>
    )
  }

  return <WaitlistConnectBaseAppReady {...props} />
}

function WaitlistConnectBaseAppReady(props: Props) {
  const { onSkip, onComplete, parentAddress, subAccountAddress, embeddedEoaAddress } = props
  const setup = useSubAccountSetup()
  const {
    provisionSubAccount,
    confirmSubAccountEmbeddedOwner,
    finalizeSubAccountSigner,
    connectBaseAccountWallet,
    getLastSetupError,
    isSettingUp,
    lastStage,
    embeddedWallet,
  } = setup

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

    const ownerInstalled = await confirmSubAccountEmbeddedOwner({
      parentAddress: pending.parentAddress,
      subAccountAddress: pending.subAccountAddress,
      provider: provisioned.provider,
    })
    if (cancelledRef.current) return
    if (!ownerInstalled) {
      setView({
        kind: 'error',
        message: mapSetupFailureMessage({
          error: getLastSetupError(),
          lastStage,
          fallback: 'Could not enable 4626 signing on your app wallet. Try again.',
        }),
        canRetry: true,
      })
      return
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
    confirmSubAccountEmbeddedOwner,
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

  const showRecoveryPanel = Boolean(
    parentAddress?.trim() && subAccountAddress?.trim() && embeddedEoaAddress?.trim(),
  )

  return (
    <div className="mx-auto w-full max-w-md space-y-6 text-center" data-testid="waitlist-connect-base-app">
      <div className="space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[rgb(var(--brand-primary)/0.8)]">
          {showRecoveryPanel ? 'Finish setup' : 'Optional · Base App'}
        </p>
        <h2 className="text-[1.8rem] font-light leading-tight tracking-tight text-white">
          {showRecoveryPanel ? 'Enable 4626 signing' : 'Connect Base App'}
        </h2>
        <p className="text-sm leading-relaxed text-zinc-400">
          {showRecoveryPanel
            ? 'Your app wallet is linked. One Base App approval lets your embedded 4626 key sign for sponsored swaps.'
            : 'Link your Base App wallet for sponsored swaps. We create a dedicated 4626 app wallet signed by your embedded key — your main Base App wallet stays unchanged.'}
        </p>
      </div>

      {view.kind === 'idle' ? (
        <div className="space-y-4 text-left">
          {showRecoveryPanel ? (
            <SubAccountOwnerInstallPanel
              variant="recovery"
              showHeader={false}
              parentAddress={parentAddress}
              subAccountAddress={subAccountAddress}
              embeddedEoaAddress={embeddedEoaAddress}
              setup={setup}
            />
          ) : null}

          {showRecoveryPanel ? (
            <p className="text-center text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-400">
              Or start fresh
            </p>
          ) : null}

          <div className="space-y-3 text-center">
            <Button
              type="button"
              variant="primary"
              className="w-full"
              onClick={() => void handleConnect()}
              data-testid="connect-base-app-button"
            >
              {showRecoveryPanel ? 'Run full Base App setup' : 'Connect Base App'}
            </Button>
            {!showRecoveryPanel ? (
              <SubAccountOwnerInstallPanel
                variant="inline"
                parentAddress={parentAddress}
                subAccountAddress={subAccountAddress}
                embeddedEoaAddress={embeddedEoaAddress}
                setup={setup}
              />
            ) : null}
            <button
              type="button"
              className="text-xs font-medium uppercase tracking-wider text-zinc-400 hover:text-zinc-300"
              onClick={onSkip}
              data-testid="skip-base-app-button"
            >
              Skip for now
            </button>
          </div>
        </div>
      ) : null}

      {view.kind === 'connecting' ? (
        <div
          className="flex items-center justify-center gap-2 text-sm text-zinc-400"
          role="status"
          aria-live="polite"
          data-testid="waitlist-connect-base-app-connecting"
        >
          <PixelWaveLoader name="wave-lr" size={12} color="rgba(255,255,255,0.72)" />
          <span data-testid="connect-stage-label">{progressLabel}</span>
        </div>
      ) : null}

      {view.kind === 'complete' ? (
        <div
          className="space-y-2 text-center text-sm text-zinc-300"
          data-testid="waitlist-connect-base-app-complete"
        >
          <p className="inline-flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
            <CheckCircle2 className="h-4 w-4 text-emerald-400/90" aria-hidden />
            <span>Base App connected</span>
            <span className="font-mono text-xs text-zinc-400">{shortAddress(view.subAccountAddress)}</span>
          </p>
          <a
            href={basescanAddressUrl(view.subAccountAddress)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-zinc-400 underline-offset-2 hover:text-zinc-300 hover:underline"
            data-testid="basescan-link"
          >
            View on Basescan ↗
          </a>
        </div>
      ) : null}

      {view.kind === 'error' ? (
        <div className="space-y-4" role="alert" aria-live="polite" data-testid="waitlist-connect-base-app-error">
          <p className="text-sm leading-relaxed text-rose-300/90">{view.message}</p>
          <div className="flex items-center justify-center gap-3">
            {view.canRetry ? (
              <Button
                type="button"
                variant="primary"
                onClick={() => void handleRetry()}
                data-testid="retry-base-app-button"
              >
                Try again
              </Button>
            ) : null}
            <button
              type="button"
              className="text-xs font-medium uppercase tracking-wider text-zinc-400 hover:text-zinc-300"
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
