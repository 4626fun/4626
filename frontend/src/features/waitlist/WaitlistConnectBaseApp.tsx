/**
 * Track C2 — sub-accounts on the waitlist (frontend).
 *
 * Base App connect flow:
 *   1. Connect Base Account + provision the per-app sub-account (passkey when creating).
 *   2. Shared owner-install lane (`installSubAccountOwnerOnly`): signer wiring, server
 *      registration, and on-chain `addOwnerAddress` on the app wallet.
 *
 * Parent CSW addOwnerAddress from third-party dapps remains blocked; owner install
 * targets the per-app sub-account only.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { getAddress, isAddress, type Address } from 'viem'

import { Button } from '@/components/ui/Button'
import { PixelWaveLoader } from '@/components/ui/PixelWaveLoader'
import { usePrivyClientStatus } from '@/lib/privy/client'
import { useSubAccountSetup } from '@/hooks/useSubAccountSetup'
import type { SubAccountSetupStage, SubAccountSetupStageEvent } from '@/lib/wallet/subAccountSetup'
import { isBaseAppInAppContext } from '@/lib/wallet/inAppBrowser'
import {
  mapSubAccountOwnerInstallError,
  normalizeSubAccountOwnerInstallErrorSource,
} from './subAccountOwnerInstallMessages'
import { isSubAccountOwnerInstallSucceeded } from './subAccountOwnerInstallResult'
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
  linkRegistered?: boolean
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

function normalizeAddress(value: string | null | undefined): Address | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!isAddress(trimmed)) return null
  return getAddress(trimmed)
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
  if (
    lower.includes('user rejected') ||
    lower.includes('user denied') ||
    lower.includes('rejected the request')
  ) {
    return 'You declined the Base App request. Tap Connect Base App to try again.'
  }
  if (lower.includes('base account wallet')) {
    return 'Connect Base App first, then try again.'
  }

  const inBaseApp = isBaseAppInAppContext()
  const installStageFailure =
    params.lastStage?.stage === 'install_embedded_owner' ||
    lower.includes('failed to enable 4626 signing on your app wallet')
  if (installStageFailure) {
    const source = normalizeSubAccountOwnerInstallErrorSource(
      params.error?.message ?? params.lastStage?.message ?? params.fallback,
    )
    return mapSubAccountOwnerInstallError(source, { inBaseApp })
  }

  if (params.error?.message) return params.error.message
  return params.fallback
}

function ownerInstallFailureMessage(params: {
  warning?: string | null
  setupError: Error | null
}): string {
  return mapSubAccountOwnerInstallError(
    normalizeSubAccountOwnerInstallErrorSource(
      params.warning ??
        params.setupError?.message ??
        'Base App did not finish the on-chain owner approval for your app wallet.',
    ),
    { inBaseApp: isBaseAppInAppContext() },
  )
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
  const {
    onSkip,
    onComplete,
    parentAddress,
    subAccountAddress,
    embeddedEoaAddress,
    linkRegistered = false,
  } = props
  const setup = useSubAccountSetup()
  const {
    provisionSubAccount,
    installSubAccountOwnerOnly,
    connectBaseAccountWallet,
    getLastSetupError,
    isSettingUp,
    lastStage,
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

  const markConnectComplete = useCallback((pending: Pick<PendingProvision, 'parentAddress' | 'subAccountAddress'>) => {
    setView({
      kind: 'complete',
      parentAddress: pending.parentAddress,
      subAccountAddress: pending.subAccountAddress,
    })
  }, [])

  const runOwnerInstallLane = useCallback(
    async (pending: Pick<PendingProvision, 'parentAddress' | 'subAccountAddress'>) => {
      const result = await installSubAccountOwnerOnly({
        parentAddress: pending.parentAddress,
        subAccountAddress: pending.subAccountAddress,
      })
      if (cancelledRef.current) return false

      if (!result) {
        setView({
          kind: 'error',
          message: mapSetupFailureMessage({
            error: getLastSetupError(),
            lastStage,
            fallback: 'Could not enable signing on your app wallet.',
          }),
          canRetry: true,
        })
        return false
      }

      if (!isSubAccountOwnerInstallSucceeded(result)) {
        setView({
          kind: 'error',
          message: ownerInstallFailureMessage({
            warning: result.onChainOwnerWarning,
            setupError: getLastSetupError(),
          }),
          canRetry: true,
        })
        return false
      }

      markConnectComplete(pending)
      return true
    },
    [getLastSetupError, installSubAccountOwnerOnly, lastStage, markConnectComplete],
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

    await runOwnerInstallLane({
      parentAddress: provisioned.parentAddress,
      subAccountAddress: provisioned.subAccountAddress,
    })
  }, [
    connectBaseAccountWallet,
    getLastSetupError,
    isSettingUp,
    lastStage,
    provisionSubAccount,
    runOwnerInstallLane,
    view.kind,
  ])

  const handleRecoverySuccess = useCallback(() => {
    const parent = normalizeAddress(parentAddress)
    const subAccount = normalizeAddress(subAccountAddress)
    if (!parent || !subAccount) return
    markConnectComplete({ parentAddress: parent, subAccountAddress: subAccount })
  }, [markConnectComplete, parentAddress, subAccountAddress])

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
              showHeader={false}
              parentAddress={parentAddress}
              subAccountAddress={subAccountAddress}
              embeddedEoaAddress={embeddedEoaAddress}
              linkRegistered={linkRegistered}
              setup={setup}
              onSuccess={handleRecoverySuccess}
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
