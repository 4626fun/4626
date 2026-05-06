/**
 * Track C2 — sub-accounts on the waitlist (frontend).
 *
 * Mounted between `auth` and `done` in the waitlist flow when
 * `VITE_WAITLIST_SUBACCOUNT_FLOW_ENABLED=1` and the user has an
 * embedded EOA. Drives the existing `useSubAccountSetup` orchestrator
 * (parent CSW → sub-account → embedded-EOA-as-signer) and POSTs the
 * resulting triple to the C1 server endpoint.
 *
 * Invariants (per docs/ACCOUNT_MODEL.md and
 * docs/sub-accounts-baseapp-design.md):
 *  - Parent Coinbase Smart Wallet stays canonical.
 *  - The sub-account is the execution lane only — never promoted to
 *    canonical here.
 *  - The Privy embedded EOA is the sub-account signer (set via
 *    `setToOwnerAccount()` inside the orchestrator).
 *  - The user can always Skip; the step is opt-in by design.
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

type ViewState =
  | { kind: 'idle' }
  | { kind: 'provisioning'; stage: SubAccountSetupStage | null }
  | { kind: 'registering'; parentAddress: Address; subAccountAddress: Address }
  | { kind: 'complete'; parentAddress: Address; subAccountAddress: Address }
  | { kind: 'error'; message: string; canRetry: boolean }

const STAGE_LABELS: Record<SubAccountSetupStage, string> = {
  check_existing: 'Looking for an existing sub-account…',
  create_sub_account: 'Creating sub-account (one-time passkey prompt)…',
  configure_signer: 'Linking your 4626 signer…',
  done: 'Sub-account ready.',
}

const COMPLETE_AUTOADVANCE_MS = 1_400

/**
 * Map a typed server error code to a friendly message. Generic / unknown
 * codes fall through to the server's `error` string when present.
 */
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
    default:
      return { message: fallback || 'Could not register your Base App wallet.', canRetry: true, autoSkip: false }
  }
}

function basescanAddressUrl(address: Address): string {
  return `https://basescan.org/address/${address}`
}

export function WaitlistConnectBaseApp(props: Props) {
  const { onSkip, onComplete } = props
  const { setupSubAccount, isSettingUp, lastStage, embeddedWallet } = useSubAccountSetup()

  const [view, setView] = useState<ViewState>({ kind: 'idle' })
  const cancelledRef = useRef(false)
  useEffect(() => {
    return () => {
      cancelledRef.current = true
    }
  }, [])

  // Stage label is derived directly from `lastStage` while provisioning.
  // We deliberately do not mirror `lastStage.stage` into local view state —
  // doing so would re-enter setState during render. Combining the
  // declarative view kind with the live hook stage gives us the same UX
  // (per-stage badge) without an effect-driven write loop.
  const stageLabel = useMemo(() => {
    if (view.kind !== 'provisioning') return null
    const live = lastStage?.stage ?? null
    if (live) return STAGE_LABELS[live] ?? null
    return STAGE_LABELS.check_existing
  }, [view, lastStage])

  const handleConnect = useCallback(async () => {
    if (isSettingUp) return
    setView({ kind: 'provisioning', stage: null })

    let result: Awaited<ReturnType<typeof setupSubAccount>> = null
    try {
      result = await setupSubAccount()
    } catch (err) {
      if (cancelledRef.current) return
      const message = err instanceof Error ? err.message : 'Sub-account setup failed.'
      setView({ kind: 'error', message, canRetry: true })
      return
    }

    if (cancelledRef.current) return
    if (!result) {
      setView({
        kind: 'error',
        message: 'Sub-account setup did not complete. Make sure your Base App wallet is connected and try again.',
        canRetry: true,
      })
      return
    }

    const parentAddress = result.parentAddress
    const subAccountAddress = result.subAccountAddress
    const embeddedEoaAddress = (embeddedWallet?.address ?? '') as Address
    if (!embeddedEoaAddress) {
      setView({
        kind: 'error',
        message: 'Could not resolve your 4626 embedded signer address. Try again or skip.',
        canRetry: true,
      })
      return
    }
    setView({ kind: 'registering', parentAddress, subAccountAddress })

    // POST the (parent, sub-account, embedded EOA) triple to the C1
    // server endpoint. The current Coinbase SDK does not surface a
    // numeric `ownerIndex` on the `wallet_addSubAccount` result, so the
    // body omits it and the server defaults to 0 (matching the
    // orchestrator's `keys: [embeddedEOA]` shape). If a future SDK
    // exposes the slot, plumb it through the orchestrator and include
    // it conditionally below.
    const body: Record<string, string | number> = {
      parentAddress,
      subAccountAddress,
      embeddedEoaAddress,
    }

    let response: Response
    try {
      response = await apiFetch('/api/arch-b/sub-account/baseapp/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      })
    } catch (err) {
      if (cancelledRef.current) return
      const message = err instanceof Error ? err.message : 'Network error while registering Base App wallet.'
      setView({ kind: 'error', message, canRetry: true })
      return
    }

    if (cancelledRef.current) return

    let payload: { success?: boolean; error?: string } | null = null
    try {
      payload = (await response.json()) as { success?: boolean; error?: string } | null
    } catch {
      payload = null
    }

    if (response.ok && payload?.success) {
      setView({ kind: 'complete', parentAddress, subAccountAddress })
      return
    }

    const errorCode = (payload?.error ?? '').toString()
    const fallbackMessage = errorCode || `Server returned ${response.status}.`
    const mapped = mapRegisterError(errorCode, fallbackMessage)
    if (mapped.autoSkip) {
      // Surface the message briefly, then skip.
      setView({ kind: 'error', message: mapped.message, canRetry: false })
      window.setTimeout(() => {
        if (!cancelledRef.current) onSkip()
      }, 600)
      return
    }
    setView({ kind: 'error', message: mapped.message, canRetry: mapped.canRetry })
  }, [embeddedWallet?.address, isSettingUp, onSkip, setupSubAccount])

  // Auto-advance to `done` once the final state lands.
  useEffect(() => {
    if (view.kind !== 'complete') return
    const timer = window.setTimeout(() => {
      onComplete({ parentAddress: view.parentAddress, subAccountAddress: view.subAccountAddress })
    }, COMPLETE_AUTOADVANCE_MS)
    return () => window.clearTimeout(timer)
  }, [view, onComplete])

  const headline = 'Connect Base App'
  const explanation =
    "Already have a Base App wallet? Link it now to unlock parent-CSW execution. We'll create a per-app sub-account signed by your 4626 account — no extra prompts after this one."

  return (
    <div className="mx-auto w-full max-w-md space-y-6 text-center" data-testid="waitlist-connect-base-app">
      <div className="space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#3C8AFF]/80">Optional · Base App</p>
        <h2 className="text-[1.8rem] font-light leading-tight tracking-tight text-white">{headline}</h2>
        <p className="text-sm leading-relaxed text-zinc-400">{explanation}</p>
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
            <span data-testid="provisioning-stage-label">{stageLabel ?? 'Setting up sub-account…'}</span>
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
                onClick={() => void handleConnect()}
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
