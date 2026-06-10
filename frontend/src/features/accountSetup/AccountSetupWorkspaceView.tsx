import {
  type KeyboardEvent,
  type ReactNode,
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  CheckCircle2,
  ExternalLink,
} from 'lucide-react'
import { toast } from '@/components/ui/Toast'
import { useSearchParams } from 'react-router-dom'

import { Button } from '@/components/ui/Button'
import { WalletProviderIcon } from '@/components/ui/WalletProviderIcon'
import { LoadingText } from '@/components/ui/LoadingState'
import { AccountsManagementPanel } from '@/features/accountSetup/AccountsManagementPanel'
import { ArchBEnrollmentCard } from '@/features/archB/ArchBEnrollmentCard'
import { shouldShowParentCswAddOwnerPanel, shouldShowBaseAppConnectPanel, shouldFocusWaitlistBaseAppConnect, resolveWaitlistAccordionOpenStep } from '@/features/waitlist/waitlistFlowState'
import { WaitlistBaseAppWalletNudge } from '@/features/waitlist/WaitlistBaseAppWalletNudge'
import { inferWaitlistEoaOwnerRoutingHint } from '@/lib/wallet/userExecutionTrack'
import { waitlistSubAccountFlowFlag } from '@/lib/flags/featureFlags'
import { useWaitlistSigningStepComplete } from '@/features/waitlist/useWaitlistSigningStepComplete'
import { WaitlistModernParentOwnerInstall } from './WaitlistModernParentOwnerInstall'
import { usePrivyClientStatus } from '@/lib/privy/client'
import { readWaitlistSetupIntent } from '@/lib/auth/waitlistEntry'
import { isBaseAppInAppContext } from '@/lib/wallet/inAppBrowser'
import { shortValue } from './shared'
import type { useAccountSetupController } from './useAccountSetupController'

const BASESCAN_BASE = 'https://basescan.org/address/'
const ZORA_PROFILE_BASE = 'https://zora.co/'

function handleAccordionToggleKeyboard(event: KeyboardEvent, toggle: () => void) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    toggle()
  }
}
function shortAddr(addr: string): string {
  if (addr.length <= 10) return addr
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

function extractSponsorshipDiagnostic(errorMessage: string | null | undefined): string | null {
  const message = typeof errorMessage === 'string' ? errorMessage.trim() : ''
  if (!message) return null
  const lower = message.toLowerCase()
  if (!lower.includes('sponsor') && !lower.includes('paymaster') && !lower.includes('gas sponsorship')) {
    return null
  }

  const explicitReasonMatch = message.match(/Gas sponsorship was rejected for this approval \(([^)]+)\)/i)
  if (explicitReasonMatch?.[1]) {
    return explicitReasonMatch[1].trim()
  }
  const bootstrapReasonMatch = message.match(/Paymaster session bootstrap failed:\s*([A-Za-z0-9_\-]+)/i)
  if (bootstrapReasonMatch?.[1]) {
    return `session_bootstrap:${bootstrapReasonMatch[1].trim()}`
  }

  const deniedReasonMatch = message.match(/request denied - ([^.]+)/i)
  if (deniedReasonMatch?.[1]) {
    return deniedReasonMatch[1].trim()
  }

  if (lower.includes('not authenticated')) return 'not authenticated'
  if (lower.includes('not_owner')) return 'not_owner'
  if (lower.includes('vault allowlist required')) return 'vault allowlist required'
  if (lower.includes('allowlist unavailable')) return 'allowlist unavailable'
  if (lower.includes('rate limited')) return 'rate limited'
  if (lower.includes('unsupported chainid')) return 'unsupported chainId'
  if (lower.includes('unsupported entrypoint')) return 'unsupported entryPoint'
  if (lower.includes('insufficient funds')) return 'insufficient funds in paymaster/sponsor'

  return 'unknown sponsorship rejection'
}

function extractOwnerApprovalDebugDiagnostic(errorMessage: string | null | undefined): string | null {
  const message = typeof errorMessage === 'string' ? errorMessage.trim() : ''
  if (!message) return null
  const match = message.match(/\[oa-debug:([^\]]+)\]/i)
  if (!match?.[1]) return null
  return match[1].trim()
}

type AccountSetupWorkspaceController = ReturnType<typeof useAccountSetupController>

const LazyWaitlistConnectBaseApp = lazy(async () => {
  const mod = await import('@/features/waitlist/WaitlistConnectBaseApp')
  return { default: mod.WaitlistConnectBaseApp }
})

function WaitlistConnectBaseAppLazy(
  props: Parameters<typeof import('@/features/waitlist/WaitlistConnectBaseApp').WaitlistConnectBaseApp>[0],
) {
  return (
    <Suspense
      fallback={
        <div className="text-xs text-zinc-500">
          <LoadingText intent="processing" size="sm" labelOverride="Loading Base App setup..." />
        </div>
      }
    >
      <LazyWaitlistConnectBaseApp {...props} />
    </Suspense>
  )
}

export function AccountSetupWorkspaceView(props: {
  context: 'accounts' | 'waitlist'
  controller: AccountSetupWorkspaceController
  summaryActions?: ReactNode
  waitlistFooter?: ReactNode
  onSigningStepCompleteChange?: (complete: boolean) => void
}) {
  const { context, controller, summaryActions, waitlistFooter, onSigningStepCompleteChange } = props
  const privyClientStatus = usePrivyClientStatus()
  void privyClientStatus
  const [searchParams] = useSearchParams()
  const inBaseApp = useMemo(() => isBaseAppInAppContext(), [])
  // openStep: null = auto (first incomplete), 1/2/3 = manually opened
  const [openStep, setOpenStep] = useState<1 | 2 | 3 | null>(null)
  const goToWaitlistStepTwo = useCallback(() => {
    setOpenStep(2)
  }, [])
  const {
    advancedBusy,
    baseAppUrl,
    busyProvider,
    canonicalCswAddress,
    connectedOwnerReady,
    connectedCanonicalWalletSelected: _connectedCanonicalWalletSelected,
    connectedSignerDetail,
    connectedSignerLabel,
    connectOwnerWallet,
    cswOwnersState,
    error,
    inTelegramMiniApp,
    loadMe,
    loading,
    me,
    needsBaseAppSetup,
    needsEmbeddedWallet,
    notice,
    onLinkZora,
    onRefreshZora,
    onResetOwnerApproval,
    onSwitchAccount,
    ownerApprovalReady,
    ownerAuthorityState,
    ownerChecklist,
    ownerInstallResumeState,
    ownerInstallSectionRef,
    ownerPrimaryCtaLabel,
    onchainEoaOwnerCandidates,
    pendingOwnerInstallHash,
    setPendingOwnerInstallHash,
    ownerInstallPhase,
    setOwnerInstallPhase,
    ownerInstallInProgress,
    providerCollision,
    readableCswOwners,
    zoraCrossAppCount,
    zoraLinked,
  } = controller
  void _connectedCanonicalWalletSelected
  const copyAddress = useCallback((addr: string) => {
    void navigator.clipboard.writeText(addr)
  }, [])

  // Fire notices as bottom-right toasts rather than inline banners
  const shownNoticeRef = useRef<string | null>(null)
  useEffect(() => {
    if (notice && notice !== shownNoticeRef.current) {
      shownNoticeRef.current = notice
      toast.success(notice, { duration: 6000 })
    }
  }, [notice])

  const zoraStepComplete = zoraLinked
  const walletStepComplete = Boolean(canonicalCswAddress)
  const stepOneComplete = zoraStepComplete && walletStepComplete
  const ownerInstallPathActive = ownerInstallResumeState.requested
  const {
    signingStepComplete,
    embeddedEoaAddress,
    parentEmbeddedOwnerOnChain,
    refreshParentEmbeddedOwner,
  } = useWaitlistSigningStepComplete({
    accountSignals: me?.accountSignals,
    canonicalCswAddress,
    ownerInstallRequested: ownerInstallPathActive,
  })

  useEffect(() => {
    onSigningStepCompleteChange?.(signingStepComplete)
  }, [onSigningStepCompleteChange, signingStepComplete])

  if (loading && !me) {
    return (
      <div className="card rounded-2xl border border-white/10 bg-black/40 p-6 text-sm text-zinc-400">
        <LoadingText intent="session" labelOverride="Loading account state..." />
      </div>
    )
  }

  if (!me) return null

  if (context === 'accounts') {
    return <AccountsManagementPanel controller={controller} summaryActions={summaryActions} />
  }

  // `zoraStepComplete`, `walletStepComplete`, and `stepOneComplete` are
  // hoisted above the `if (!me) return null` guard so the auto-trigger effect
  // can depend on them. `signingStepComplete` is the canonical (post-`me`)
  // form used by the rendered step UI — it shadows the auto-trigger
  // helper `signingStepCompleteForAuto` once `me` is available.
  const executionTrack = me.accountSignals.executionTrack
  const subAccountFlowEnabled = waitlistSubAccountFlowFlag()
  const resolvedOnchainEoaOwnerCount = Math.max(
    onchainEoaOwnerCandidates.length,
    inferWaitlistEoaOwnerRoutingHint({
      parentEmbeddedOwnerOnChain,
      accountSignals: me.accountSignals,
    }),
  )
  const showParentCswAddOwnerPanel = shouldShowParentCswAddOwnerPanel({
    zoraLinked,
    ownerInstallRequested: ownerInstallPathActive,
    signingStepComplete,
    executionTrack,
    accountSignals: me.accountSignals,
    parentEmbeddedOwnerOnChain,
    onchainEoaOwnerCount: resolvedOnchainEoaOwnerCount,
    subAccountFlowEnabled,
  })
  const showBaseAppConnectPanel = shouldShowBaseAppConnectPanel({
    subAccountFlowEnabled,
    signingStepComplete,
    embeddedEoaAvailable: Boolean(embeddedEoaAddress),
    parentEmbeddedOwnerOnChain,
    zoraLinked,
    onchainEoaOwnerCount: resolvedOnchainEoaOwnerCount,
    accountSignals: me.accountSignals,
  })
  const stepTwoDoneSubtitle = signingStepComplete
    ? parentEmbeddedOwnerOnChain || executionTrack === 'legacy-owner-install'
      ? 'Embedded signer installed on your parent smart wallet'
      : executionTrack === 'sub-account'
        ? 'Base App sub-account connected for swaps'
        : '4626 signing enabled'
    : ownerInstallInProgress || pendingOwnerInstallHash
      ? ownerInstallPhase === 'awaiting_signature'
        ? 'Waiting for Base App signature…'
        : 'Owner install in progress…'
      : showBaseAppConnectPanel
        ? 'Connect Base App to enable sponsored swaps'
        : showParentCswAddOwnerPanel
          ? 'Connect a CSW owner wallet and enable 4626 signing'
          : 'Optional — trade at /swap with an external wallet (EOA mode) if you skip this step'
  const sponsorshipDiagnostic = extractSponsorshipDiagnostic(error)
  const ownerApprovalDiagnostic = extractOwnerApprovalDebugDiagnostic(error)

  // Prefer the modern validated Base App self-call path (EntryPoint handleOps)
  // for parent-CSW owner install whenever we're in a Base App context or the
  // older sub-account connect panel is not the active one. This makes the
  // proven 2026 direction the primary experience inside the waitlist.
  const useModernParentOwnerInstallInWaitlist =
    showParentCswAddOwnerPanel && (inBaseApp || !showBaseAppConnectPanel)
  // Zora-controlled CBSWs are passkey-owned (P256 keys held in Coinbase
  // Wallet / Base Account), not EOA-owned. The cross-app login surfaces the
  // CBSW address but cannot expose a transactional signer, so we steer users
  // to Base Account before they burn a connection attempt on an unrelated EOA.
  const hasConnectedSigner = Boolean(connectedSignerLabel) && !/no wallet connected/i.test(connectedSignerLabel)
  const shouldHintBaseAccountForZora =
    zoraLinked && Boolean(canonicalCswAddress) && !connectedOwnerReady && !hasConnectedSigner

  if (context === 'waitlist') {
    const setupIntent = readWaitlistSetupIntent(searchParams.get('setup'))
    const focusBaseAppConnect = shouldFocusWaitlistBaseAppConnect({
      inBaseApp,
      showBaseAppConnectPanel,
      signingStepComplete,
      setupIntent,
      subAccountFlowEnabled,
      parentEmbeddedOwnerOnChain,
      zoraLinked,
      onchainEoaOwnerCount: resolvedOnchainEoaOwnerCount,
      account: {
        emailVerified: me.emailVerified === true,
        accountSignals: me.accountSignals,
      },
    })
    // Which top-level step is expanded: null = auto
    const resolvedOpen = resolveWaitlistAccordionOpenStep({
      manualOpenStep: openStep === 1 || openStep === 2 ? openStep : null,
      ownerInstallRequested: ownerInstallResumeState.requested,
      stepOneComplete,
      focusBaseAppConnect,
    })
    const toggleStep = (n: 1 | 2) => {
      setOpenStep(openStep === n ? null : n)
    }

    // Shared classes
    const stepBase = 'border-b border-white/[0.06] last:border-0 transition-colors duration-150 cursor-pointer'
    const doneRow = `${stepBase} bg-white/[0.015] hover:bg-white/[0.03]`
    const activeRow = `${stepBase} bg-brand-primary/[0.16] border-l-2 border-l-brand-primary/85 ring-1 ring-inset ring-brand-primary/25`
    const badgeDone = 'flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full border border-emerald-500/20 bg-emerald-500/[0.12] text-[11px] font-bold text-emerald-400'
    const badgeActive = 'flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full border border-brand-primary/22 bg-brand-primary/[0.14] text-[11px] font-bold text-brand-200'

    const stepOneStatus: 'done' | 'active' | 'upcoming' =
      stepOneComplete ? 'done' : focusBaseAppConnect ? 'upcoming' : resolvedOpen === 1 ? 'active' : 'upcoming'
    const stepTwoStatus: 'done' | 'active' | 'upcoming' =
      signingStepComplete
        ? 'done'
        : ownerInstallPathActive || focusBaseAppConnect || (stepOneComplete && resolvedOpen === 2)
          ? 'active'
          : 'upcoming'

    const allDone = zoraStepComplete && walletStepComplete
    const rawZoraHandle = me.accountSignals.zoraHandle?.trim() ?? ''
    const normalizedZoraHandle = rawZoraHandle
      ? (rawZoraHandle.startsWith('@') || rawZoraHandle.startsWith('$') ? rawZoraHandle : `@${rawZoraHandle}`)
      : null
    const zoraProfileUrl = normalizedZoraHandle ? `${ZORA_PROFILE_BASE}${normalizedZoraHandle}` : null
    const baseAppConnectProps = {
      onSkip: () => undefined,
      onComplete: () => {
        void loadMe()
        void refreshParentEmbeddedOwner()
      },
      parentAddress: canonicalCswAddress,
      subAccountAddress: me.accountSignals.baseSubAccount?.address ?? me.baseSubAccount ?? null,
      embeddedEoaAddress: embeddedEoaAddress ?? null,
      autoConnectOnMount: focusBaseAppConnect,
      requireBaseAppConnect: inBaseApp,
      compact: focusBaseAppConnect && inBaseApp,
    } as const

    if (allDone) {
      return (
        <div className="w-full space-y-4">
          {error ? (
            <div role="alert" aria-live="assertive" className="rounded-xl border border-rose-500/20 bg-rose-500/[0.08] px-4 py-3 text-sm text-rose-300">
              <div>{error}</div>
              {import.meta.env.DEV && sponsorshipDiagnostic ? (
                <div className="mt-2 rounded-lg border border-rose-400/20 bg-black/20 px-3 py-2 text-xs text-rose-200/90">
                  Sponsorship diagnostics: <span className="font-mono">{sponsorshipDiagnostic}</span>
                </div>
              ) : null}
              {import.meta.env.DEV && ownerApprovalDiagnostic ? (
                <div className="mt-2 rounded-lg border border-rose-400/20 bg-black/20 px-3 py-2 text-xs text-rose-200/90">
                  Owner approval diagnostics: <span className="font-mono">{ownerApprovalDiagnostic}</span>
                </div>
              ) : null}
            </div>
          ) : null}

          {summaryActions ? <div className="space-y-4">{summaryActions}</div> : null}

          {waitlistFooter ? <div className="flex justify-center pt-1">{waitlistFooter}</div> : null}
        </div>
      )
    }

    if (focusBaseAppConnect && showBaseAppConnectPanel && !signingStepComplete) {
      return (
        <div className="mx-auto w-full max-w-[640px] space-y-4">
          {error ? (
            <div role="alert" aria-live="assertive" className="rounded-xl border border-rose-500/20 bg-rose-500/[0.08] px-4 py-3 text-sm text-rose-300">
              <div>{error}</div>
            </div>
          ) : null}

          {/* Pending owner install banner also shown in the focused Base App connect path for consistency. */}
          {(ownerInstallInProgress || pendingOwnerInstallHash) ? (
            <div className="mb-4 rounded-xl border border-sky-400/30 bg-sky-500/10 p-4 space-y-3 text-xs text-sky-100">
              <div>
                <div className="font-semibold">
                  {ownerInstallPhase === 'awaiting_signature'
                    ? 'Waiting for Base App signature…'
                    : 'Owner install in progress — waiting for bundle'}
                </div>
                <button
                  type="button"
                  onClick={() => navigator.clipboard?.writeText(pendingOwnerInstallHash || '')}
                  className="mt-1 block w-full text-left font-mono text-[10px] text-sky-200/80 break-all hover:text-sky-100 active:text-white"
                >
                  {pendingOwnerInstallHash || '—'}
                </button>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={async () => {
                  await Promise.all([loadMe({ showSpinner: false }), refreshParentEmbeddedOwner?.()])
                  if (signingStepComplete) {
                    setPendingOwnerInstallHash?.(null)
                    setOwnerInstallPhase?.(null)
                  }
                }}
              >
                Check now (also refresh)
              </Button>
            </div>
          ) : null}

          <div className="space-y-1">
            <h2 className="text-2xl font-semibold tracking-tight text-white">Connect your wallet</h2>
            <p className="text-sm text-zinc-500">One approval in Base App unlocks swaps and chat. Zora is optional.</p>
          </div>

          <WaitlistConnectBaseAppLazy {...baseAppConnectProps} />

          {!stepOneComplete ? (
            <details className="rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3 text-sm text-zinc-400">
              <summary className="cursor-pointer select-none text-zinc-300">Link Zora later (optional)</summary>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busyProvider === 'zora_cross_app'}
                  onClick={() => void onLinkZora()}
                  className="inline-flex h-9 items-center rounded-lg bg-brand-primary px-4 text-sm font-semibold text-white hover:bg-brand-hover disabled:opacity-50"
                >
                  {busyProvider === 'zora_cross_app' ? 'Connecting…' : 'Connect Zora'}
                </button>
                <button
                  type="button"
                  disabled={busyProvider === 'zora_cross_app'}
                  onClick={() => void onRefreshZora()}
                  className="inline-flex h-9 items-center rounded-lg border border-white/10 px-4 text-sm font-medium text-zinc-400 hover:bg-white/[0.04] disabled:opacity-50"
                >
                  Already linked? Refresh
                </button>
              </div>
            </details>
          ) : null}

          {summaryActions ? <div className="pt-1">{summaryActions}</div> : null}
          {waitlistFooter ? <div className="flex justify-center pt-2">{waitlistFooter}</div> : null}
        </div>
      )
    }

    return (
      <div className="mx-auto w-full max-w-[640px] space-y-5">
        {/* Critical errors stay inline; notices are toasted */}
        {error ? (
          <div role="alert" aria-live="assertive" className="rounded-xl border border-rose-500/20 bg-rose-500/[0.08] px-4 py-3 text-sm text-rose-300">
            <div>{error}</div>
            {import.meta.env.DEV && sponsorshipDiagnostic ? (
              <div className="mt-2 rounded-lg border border-rose-400/20 bg-black/20 px-3 py-2 text-xs text-rose-200/90">
                Sponsorship diagnostics: <span className="font-mono">{sponsorshipDiagnostic}</span>
              </div>
            ) : null}
            {import.meta.env.DEV && ownerApprovalDiagnostic ? (
              <div className="mt-2 rounded-lg border border-rose-400/20 bg-black/20 px-3 py-2 text-xs text-rose-200/90">
                Owner approval diagnostics: <span className="font-mono">{ownerApprovalDiagnostic}</span>
              </div>
            ) : null}
          </div>
        ) : null}

        {ownerInstallResumeState.requested && !inBaseApp && !showBaseAppConnectPanel ? (
          <div className="rounded-2xl bg-[linear-gradient(180deg,rgba(37,99,235,0.16),rgba(37,99,235,0.05))] px-5 py-4 text-sm text-brand-50 ring-1 ring-brand-primary/20">
            <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-brand-200">
              <span className="inline-flex rounded-full bg-brand-primary/15 px-2.5 py-1">Desktop signing setup</span>
              <span className="text-brand-100/70">Owner install required</span>
            </div>
            <div className="mt-2 text-base font-medium text-white">
              Enable signing on your parent smart wallet from this browser.
            </div>
            <p className="mt-1 text-sm leading-relaxed text-brand-50/85">
              Wallet signing setup is paused in this build. Link Zora and confirm your smart wallet, then use{' '}
              <a href="/swap" className="font-mono text-brand-50 underline underline-offset-2">
                /swap
              </a>{' '}
              with an external wallet (EOA mode) if canonical signing is unavailable.
            </p>
          </div>
        ) : null}

        {inBaseApp && !signingStepComplete && !focusBaseAppConnect ? (
          <WaitlistBaseAppWalletNudge
            stepOneComplete={stepOneComplete}
            showConnectPanel={showBaseAppConnectPanel}
            onGoToStepTwo={goToWaitlistStepTwo}
          />
        ) : null}

        {/* Heading — single line */}
        <div className="flex items-start justify-between gap-3">
          <div>
          <h2 className="text-2xl font-semibold tracking-tight text-white">
            {allDone ? 'Account activated' : focusBaseAppConnect ? 'Connect your wallet' : 'Activate your account'}
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            {allDone
              ? 'All steps completed'
              : focusBaseAppConnect
                ? 'Link Base App to enable swaps and chat. Zora is optional.'
                : 'Complete both steps to unlock app access'}
          </p>
          {!allDone ? (
            <div className="mt-2 inline-flex items-center rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[11px] text-zinc-300">
              {focusBaseAppConnect ? 'Step 2 · Base App' : `Step ${resolvedOpen} of 2`}
            </div>
          ) : null}
          </div>
        </div>

        {/* Accordion steps */}
        <div className="w-full overflow-hidden rounded-[13px]">

          {/* ── Step 1 — Zora + wallet sync ── */}
          {(() => {
            const s = stepOneStatus
            const isOpen = s === 'active'
            const addr = canonicalCswAddress
            return (
              <div className={s === 'done' ? doneRow : s === 'active' ? activeRow : stepBase}>
                <div
                  className="flex items-center gap-3 px-4 py-3.5"
                  role="button"
                  tabIndex={0}
                  aria-expanded={isOpen}
                  onClick={() => toggleStep(1)}
                  onKeyDown={(event) => handleAccordionToggleKeyboard(event, () => toggleStep(1))}
                >
                  {/* Number / check badge */}
                  <div className={`shrink-0 ${s === 'done' ? badgeDone : s === 'active' ? badgeActive : 'flex h-[26px] w-[26px] items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-[11px] font-bold text-zinc-600'}`}>
                    {s === 'done' ? <CheckCircle2 className="h-3.5 w-3.5" /> : '1'}
                  </div>

                  {/* Title + meta */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <img src="/brands/zora-token.svg" alt="" aria-hidden="true" className="h-3.5 w-3.5 shrink-0 rounded-full object-cover opacity-80" />
                      <span className="rounded-full border border-white/[0.1] bg-white/[0.04] px-1.5 py-0.5 text-[9px] uppercase tracking-[0.12em] text-zinc-400">
                        Step 1
                      </span>
                      <span className="text-sm font-medium text-white">Link your Zora identity</span>
                    </div>

                    {/* Identity line — only when done */}
                    {s === 'done' && (normalizedZoraHandle || addr) ? (
                      <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[11px] text-zinc-500">
                        {normalizedZoraHandle && zoraProfileUrl ? (
                          <a
                            href={zoraProfileUrl}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="shrink-0 hover:text-zinc-300 transition-colors"
                          >
                            {normalizedZoraHandle}
                          </a>
                        ) : null}
                        {normalizedZoraHandle && addr ? <span className="text-zinc-700">·</span> : null}
                        {addr ? (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); copyAddress(addr) }}
                            title={addr}
                            className="shrink-0 font-mono text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors"
                          >
                            {shortAddr(addr)}
                          </button>
                        ) : null}
                        {addr ? (
                          <a
                            href={`${BASESCAN_BASE}${addr}`}
                            target="_blank"
                            rel="noreferrer"
                            title="View on Basescan"
                            onClick={(e) => e.stopPropagation()}
                            className="shrink-0 text-zinc-600 hover:text-zinc-400 transition-colors"
                          >
                            <ExternalLink className="h-2.5 w-2.5" />
                          </a>
                        ) : null}
                      </div>
                    ) : null}
                  </div>

                  {s === 'done' ? (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation()
                        void onSwitchAccount()
                      }}
                      disabled={busyProvider === 'email'}
                      className="shrink-0 text-xs font-medium text-rose-900/80 transition-colors hover:text-rose-700 disabled:opacity-50"
                    >
                      {busyProvider === 'email' ? 'Resetting…' : 'Reset'}
                    </button>
                  ) : null}
                </div>

                {/* Expanded body */}
                {isOpen ? (
                  <div className="space-y-3 px-4 pb-4 pl-[52px]">
                    {/* Primary actions */}
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={busyProvider === 'zora_cross_app'}
                        onClick={() => void onLinkZora()}
                        className="inline-flex h-9 items-center rounded-lg bg-brand-primary px-4 text-sm font-semibold text-white shadow-[0_4px_16px_rgb(var(--brand-primary)/0.22)] hover:bg-brand-hover disabled:opacity-50"
                      >
                        {busyProvider === 'zora_cross_app' ? 'Connecting…' : 'Connect Zora'}
                      </button>
                      <button
                        type="button"
                        disabled={busyProvider === 'zora_cross_app'}
                        onClick={() => void onRefreshZora()}
                        className="inline-flex h-9 items-center rounded-lg border border-white/10 bg-transparent px-4 text-sm font-medium text-zinc-400 hover:bg-white/[0.04] disabled:opacity-50"
                      >
                        Already linked? Refresh
                      </button>
                      <button
                        type="button"
                        disabled={busyProvider === 'email'}
                        onClick={() => void onSwitchAccount()}
                        className="inline-flex h-9 items-center rounded-lg border border-rose-400/20 bg-rose-500/10 px-4 text-sm font-medium text-rose-200 hover:bg-rose-500/20 disabled:opacity-50"
                      >
                        {busyProvider === 'email' ? 'Resetting…' : 'Reset Zora identity'}
                      </button>
                    </div>

                    {/* Wallet detection sub-section */}
                    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
                      <div className="flex items-center gap-2 text-[11px] text-zinc-500">
                        <WalletProviderIcon provider="coinbase" size={11} />
                        <span>Coinbase Smart Wallet detection</span>
                        <span className="ml-auto rounded border border-white/10 px-1.5 py-px text-[9px] uppercase tracking-wide text-zinc-600">Auto</span>
                      </div>
                      {addr ? (
                        <div className="mt-1.5 flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => copyAddress(addr)}
                            title="Copy address"
                            className="min-w-0 max-w-full truncate font-mono text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors text-left"
                          >
                            {addr}
                          </button>
                          <a
                            href={`${BASESCAN_BASE}${addr}`}
                            target="_blank"
                            rel="noreferrer"
                            title="View on Basescan"
                            className="shrink-0 text-zinc-600 hover:text-zinc-300 transition-colors"
                          >
                            <ExternalLink className="h-2.5 w-2.5" />
                          </a>
                        </div>
                      ) : null}
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={busyProvider === 'zora_cross_app'}
                          onClick={() => void onRefreshZora()}
                          className="inline-flex h-8 items-center rounded-md border border-white/10 bg-transparent px-3 text-xs text-zinc-400 hover:bg-white/[0.04] disabled:opacity-50"
                        >
                          {busyProvider === 'zora_cross_app' ? 'Checking…' : 'Retry detection'}
                        </button>
                        {needsBaseAppSetup && baseAppUrl ? (
                          <a
                            href={baseAppUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex h-8 items-center rounded-md border border-white/10 bg-transparent px-3 text-xs text-zinc-400 hover:bg-white/[0.04]"
                          >
                            Open Base app
                          </a>
                        ) : null}
                      </div>
                    </div>

                    {/* Switch account — last, least prominent */}
                    <button
                      type="button"
                      onClick={() => void onSwitchAccount()}
                      disabled={busyProvider === 'email'}
                      className="text-[11px] text-zinc-600 hover:text-zinc-400 transition-colors disabled:opacity-40"
                    >
                      {busyProvider === 'email' ? 'Switching…' : 'Not this account? Switch'}
                    </button>
                  </div>
                ) : null}
              </div>
            )
          })()}

          {/* ── Step 2 — Signing ── */}
          {(() => {
            const s = stepTwoStatus
            const isOpen = s === 'active'
            return (
              <div className={s === 'done' ? doneRow : s === 'active' ? activeRow : stepBase}>
                <div
                  className="flex items-center gap-3 px-4 py-3.5"
                  role="button"
                  tabIndex={0}
                  aria-expanded={isOpen}
                  onClick={() => toggleStep(2)}
                  onKeyDown={(event) => handleAccordionToggleKeyboard(event, () => toggleStep(2))}
                >
                  <div className={`shrink-0 ${s === 'done' ? badgeDone : s === 'active' ? badgeActive : 'flex h-[26px] w-[26px] items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-[11px] font-bold text-zinc-600'}`}>
                    {s === 'done' ? <CheckCircle2 className="h-3.5 w-3.5" /> : '2'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="mb-0.5">
                      <span className="rounded-full border border-white/[0.1] bg-white/[0.04] px-1.5 py-0.5 text-[9px] uppercase tracking-[0.12em] text-zinc-400">
                        Step 2
                      </span>
                    </div>
                    <span className="text-sm font-medium text-white">Enable 4626 signing</span>
                    {s === 'done' ? (
                      <p className="mt-0.5 text-[11px] text-zinc-500">{stepTwoDoneSubtitle}</p>
                    ) : null}
                  </div>
                </div>

                {isOpen ? (
                  <div className="space-y-2.5 px-4 pb-4 pl-[52px]">
                    {/* Pending owner install banner — shows the same high-quality waiting UX
                        as the dedicated /add Base App flow while the user is still on the waitlist page.
                        Uses the stabilized pendingOwnerInstallHash / ownerInstallInProgress from the controller
                        (set by the modern hook when it enters awaiting_signature / broadcasting etc.). */}
                    {(ownerInstallInProgress || pendingOwnerInstallHash) ? (
                      <div className="rounded-xl border border-sky-400/30 bg-sky-500/10 p-4 space-y-3 text-xs text-sky-100">
                        <div>
                          <div className="font-semibold">
                            {ownerInstallPhase === 'awaiting_signature'
                              ? 'Waiting for Base App signature…'
                              : ownerInstallPhase === 'broadcasting' || ownerInstallPhase === 'confirming'
                                ? 'UserOp submitted — waiting for bundle confirmation'
                                : 'Owner install in progress'}
                          </div>
                          <button
                            type="button"
                            onClick={() => navigator.clipboard?.writeText(pendingOwnerInstallHash || '')}
                            className="mt-1 block w-full text-left font-mono text-[10px] text-sky-200/80 break-all hover:text-sky-100 active:text-white"
                            title="Click to copy full UserOp hash"
                          >
                            {pendingOwnerInstallHash || '—'}
                          </button>
                        </div>
                        <p className="leading-relaxed text-sky-100/90">
                          {ownerInstallPhase === 'awaiting_signature'
                            ? 'Confirm the add-owner request in Base App (passkey or device sign). This step can take up to 3 minutes.'
                            : 'This can take 1–3 minutes. Keep this tab open. You can safely refresh or come back later.'}
                        </p>
                        <div className="flex flex-wrap gap-2 pt-1">
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={async () => {
                              await Promise.all([
                                loadMe({ showSpinner: false }),
                                refreshParentEmbeddedOwner?.(),
                              ])
                              // Auto-clear the pending banner once the owner install has landed
                              // and the signing step reports complete (mirrors the "hide raw errors
                              // when pending hash present" pattern from the dedicated flow).
                              if (signingStepComplete) {
                                setPendingOwnerInstallHash?.(null)
                                setOwnerInstallPhase?.(null)
                              }
                            }}
                          >
                            Check now (also refresh)
                          </Button>
                          <button
                            type="button"
                            className="text-[11px] text-sky-200/70 underline underline-offset-2 hover:text-sky-100"
                            onClick={() => {
                              setPendingOwnerInstallHash?.(null)
                              setOwnerInstallPhase?.(null)
                            }}
                          >
                            Dismiss
                          </button>
                        </div>
                      </div>
                    ) : null}

                    {/* While a modern owner install is in-flight (pending hash present), suppress the
                        normal action buttons/panels to prevent the user from starting a second operation
                        during the long signature + bundle window. The banner above is the single source
                        of truth and action surface. */}
                    {(ownerInstallInProgress || pendingOwnerInstallHash) ? (
                      <p className="text-xs text-zinc-500">
                        Owner install in progress. Use the status card above to monitor or check progress.
                      </p>
                    ) : signingStepComplete ? (
                      <p className="text-xs text-zinc-400 leading-relaxed">
                        Your embedded signer is confirmed as an on-chain owner of your parent smart wallet.
                      </p>
                    ) : showBaseAppConnectPanel ? (
                      <WaitlistConnectBaseAppLazy {...baseAppConnectProps} />
                    ) : useModernParentOwnerInstallInWaitlist ? (
                      <WaitlistModernParentOwnerInstall
                        controller={controller}
                        embeddedEoaAddress={embeddedEoaAddress}
                        onOwnerInstallSuccess={() => refreshParentEmbeddedOwner?.()}
                      />
                    ) : (
                      <p className="text-xs text-zinc-400 leading-relaxed">
                        Modern Base App owner install (validated self-call) is the primary path for parent-CSW signing.
                        The older Zora EOA-relay option is available as a fallback when needed.
                        You can still trade at{' '}
                        <a href="/swap" className="text-brand-100 underline underline-offset-2">
                          /swap
                        </a>{' '}
                        with an external wallet (EOA mode).
                      </p>
                    )}
                  </div>
                ) : null}
              </div>
            )
          })()}
        </div>

        {/* Optional post-activation delegation consent. Keep out of core setup flow. */}
        {allDone ? <ArchBEnrollmentCard hasCanonicalCsw={Boolean(canonicalCswAddress)} /> : null}

        {/* Enter App / waitlist actions — approval-gated, not setup-gated */}
        {summaryActions ? (
          <div className="pt-1">{summaryActions}</div>
        ) : null}

        {waitlistFooter ? <div className="flex justify-center pt-2">{waitlistFooter}</div> : null}
      </div>
    )
  }

  const headerEyebrow = 'Accounts'
  const headerTitle = 'Workspace'
  const headerBody =
    'Start with Zora. If you already use a Coinbase Smart Wallet there, 4626 keeps that wallet as the primary surface and adds 4626 as an owner so you can continue with the same account.'
  const summaryTitle = 'Current state'
  const journeyBadgeClass =
    'inline-flex items-center rounded-full px-2.5 py-1 text-[11px] tracking-[0.08em] uppercase'
  const nextActionLabel = !zoraLinked
    ? 'Link Zora to continue'
    : !canonicalCswAddress
      ? 'Confirm your Coinbase Smart Wallet'
      : !connectedOwnerReady
        ? 'Connect a current CSW owner'
        : ownerPrimaryCtaLabel

  return (
    <div className="space-y-6">
      {error ? (
        <div
          role="alert"
          aria-live="assertive"
          className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200"
        >
          <div>{error}</div>
          {import.meta.env.DEV && sponsorshipDiagnostic ? (
            <div className="mt-2 rounded-lg border border-rose-400/20 bg-black/20 px-3 py-2 text-xs text-rose-100/90">
              Sponsorship diagnostics: <span className="font-mono">{sponsorshipDiagnostic}</span>
            </div>
          ) : null}
          {import.meta.env.DEV && ownerApprovalDiagnostic ? (
            <div className="mt-2 rounded-lg border border-rose-400/20 bg-black/20 px-3 py-2 text-xs text-rose-100/90">
              Owner approval diagnostics: <span className="font-mono">{ownerApprovalDiagnostic}</span>
            </div>
          ) : null}
        </div>
      ) : null}
      {notice ? (
        <div
          role="status"
          aria-live="polite"
          className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200"
        >
          {notice}
        </div>
      ) : null}

      {ownerInstallResumeState.requested ? (
        <div className="rounded-2xl bg-[linear-gradient(180deg,rgba(37,99,235,0.16),rgba(37,99,235,0.05))] px-5 py-4 text-sm text-brand-50 ring-1 ring-brand-primary/20">
          <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-brand-200">
            <span className="inline-flex rounded-full bg-brand-primary/15 px-2.5 py-1">
              {ownerInstallResumeState.source === 'telegram' ? 'Continue from Telegram' : 'Desktop signing setup'}
            </span>
            <span className="text-brand-100/70">Owner install required</span>
          </div>
          <div className="mt-2 text-base font-medium text-white">
            {ownerInstallResumeState.source === 'telegram'
              ? 'Your Telegram account is linked. Finish wallet setup here.'
              : 'Enable signing on your parent smart wallet from this browser.'}
          </div>
          <div className="mt-1 max-w-3xl text-sm leading-relaxed text-brand-50/85">
            Finish Zora linking and enable 4626 signing on your parent smart wallet from this browser.
            If signing is unavailable here, use{' '}
            <a href="/swap" className="font-mono text-brand-50 underline underline-offset-2">
              /swap
            </a>{' '}
            with an external wallet (EOA mode).
          </div>
        </div>
      ) : null}

      {inTelegramMiniApp ? (
        <div className="rounded-xl bg-amber-500/10 px-4 py-3 text-sm text-amber-100 ring-1 ring-amber-400/20 space-y-2">
          <div>
            You are inside Telegram Mini App. Wallet-owner signatures (MetaMask/Rabby) are more reliable in an external browser context.
          </div>
          <a
            href="/accounts"
            target="_blank"
            rel="noreferrer"
            className="inline-flex text-xs font-medium text-amber-200 underline underline-offset-2 hover:text-amber-100"
          >
            Open Accounts in browser
          </a>
        </div>
      ) : null}

      <section className="overflow-hidden rounded-3xl bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.16),transparent_42%),linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.01))] p-5 sm:p-7 lg:p-8 ring-1 ring-white/10">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.18fr)_minmax(320px,0.82fr)]">
          <div className="space-y-5">
            <div className="space-y-3">
              <div className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">{headerEyebrow}</div>
              <div className="flex flex-wrap items-center gap-2 text-[11px]">
                <span className={`${journeyBadgeClass} bg-brand-primary/15 text-brand-200`}>
                  Zora first
                </span>
                <span className={`${journeyBadgeClass} bg-white/5 text-zinc-400`}>
                  Existing CSW stays primary
                </span>
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-[2rem]">{headerTitle}</h2>
                <p className="max-w-2xl text-sm leading-relaxed text-zinc-300">{headerBody}</p>
              </div>
              <div className="rounded-xl bg-brand-primary/10 px-3 py-3 ring-1 ring-brand-primary/20">
                <div className="text-[11px] uppercase tracking-[0.16em] text-brand-200">Next action</div>
                <div className="mt-1 text-sm font-medium text-zinc-100">{nextActionLabel}</div>
              </div>
            </div>

            <div className="grid gap-3">
              <div className="rounded-2xl bg-black/30 p-4 sm:p-5 ring-1 ring-brand-primary/15">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1.5">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-brand-200">Step 1</div>
                    <div className="text-base font-medium text-white">Link your Zora identity</div>
                    <p className="text-sm leading-relaxed text-zinc-400">
                      Connect with Zora through Privy cross-app auth (read-only) so we can recover your creator identity and map your canonical smart wallet.
                    </p>
                  </div>
                  <div className={`rounded-full px-2.5 py-1 text-xs ${
                    zoraLinked ? 'bg-emerald-500/15 text-emerald-200' : 'bg-white/5 text-zinc-400'
                  }`}>
                    {zoraLinked ? 'Linked' : 'Action required'}
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {zoraLinked ? (
                    <Button
                      type="button"
                      variant="primary"
                      disabled={busyProvider === 'zora_cross_app'}
                      onClick={() => void onRefreshZora()}
                      className="inline-flex"
                    >
                      {busyProvider === 'zora_cross_app' ? 'Refreshing...' : 'Refresh Zora signals'}
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="primary"
                      disabled={busyProvider === 'zora_cross_app'}
                      onClick={() => void onLinkZora()}
                      className="inline-flex"
                    >
                      {busyProvider === 'zora_cross_app' ? 'Connecting…' : 'Connect with Zora'}
                    </Button>
                  )}
                  {!zoraLinked ? (
                    <button
                      type="button"
                      disabled={busyProvider === 'zora_cross_app'}
                      onClick={() => void onRefreshZora()}
                      className="rounded-lg bg-white/5 px-3 py-2 text-xs text-zinc-300 transition hover:bg-white/10 hover:text-zinc-100"
                    >
                      {busyProvider === 'zora_cross_app' ? 'Refreshing...' : 'Already linked? Refresh signals'}
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="rounded-2xl bg-black/30 p-4 sm:p-5 ring-1 ring-white/10">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1.5">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Step 2</div>
                    <div className="text-base font-medium text-white">Detect your Coinbase Smart Wallet</div>
                    <p className="text-sm leading-relaxed text-zinc-400">
                      If Base app already knows your CSW, we keep it as your primary wallet. If not, finish setup there, then return here.
                    </p>
                  </div>
                  <div className={`rounded-full px-2.5 py-1 text-xs ${
                    canonicalCswAddress ? 'bg-emerald-500/15 text-emerald-200' : 'bg-white/5 text-zinc-400'
                  }`}>
                    {canonicalCswAddress ? 'Detected' : needsBaseAppSetup ? 'Base app required' : 'Waiting'}
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-zinc-300">
                  <span className="text-zinc-500">Canonical CSW</span>
                  <span className="font-mono text-zinc-100">{shortValue(me.accountSignals.canonicalCswAddress)}</span>
                </div>
                {needsBaseAppSetup && baseAppUrl ? (
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <Button variant="secondary" asChild>
                      <a href={baseAppUrl} target="_blank" rel="noreferrer">
                        Open Base app
                      </a>
                    </Button>
                    <span className="text-xs text-zinc-500">
                      Create or connect your CSW there, then return here.
                    </span>
                  </div>
                ) : null}
              </div>

              <section
                ref={ownerInstallSectionRef}
                tabIndex={-1}
                className={`rounded-2xl p-4 sm:p-5 outline-none ring-1 ${
                  ownerInstallResumeState.requested
                    ? 'ring-brand-primary/30 bg-[linear-gradient(180deg,rgba(37,99,235,0.12),rgba(255,255,255,0.02))]'
                    : 'ring-white/10 bg-black/30'
                }`}
                aria-label="Owner install step"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1.5">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Step 3</div>
                    <div className="text-base font-medium text-white">Wallet signing</div>
                    <p className="text-sm leading-relaxed text-zinc-400">
                      {signingStepComplete
                        ? 'Your embedded signer is confirmed as an on-chain owner of your parent smart wallet.'
                        : showParentCswAddOwnerPanel
                          ? 'Connect an on-chain CSW owner and add your Privy embedded signer so sponsored swaps can run from your canonical wallet.'
                          : 'In-app owner setup is paused in this build. You can still trade at /swap with an external wallet (EOA mode).'}
                    </p>
                  </div>
                  <div className={`rounded-full px-2.5 py-1 text-xs ${
                    ownerApprovalReady
                      ? 'bg-brand-primary/15 text-brand-200'
                      : ownerAuthorityState.badgeClass
                  }`}>
                    {canonicalCswAddress ? ownerPrimaryCtaLabel : 'Blocked'}
                  </div>
                </div>
                {ownerInstallResumeState.requested ? (
                  <div className="mt-4 rounded-xl bg-brand-primary/10 px-3 py-3 text-xs leading-5 text-brand-50/90 ring-1 ring-brand-primary/20">
                    This step was resumed from another surface. Connect a CSW owner wallet below and enable 4626
                    signing, or use /swap with an external wallet (EOA mode).
                  </div>
                ) : null}
                <details className="mt-4 rounded-xl bg-white/[0.02] px-3 py-3 ring-1 ring-white/10">
                  <summary className="cursor-pointer list-none text-[11px] uppercase tracking-[0.14em] text-zinc-400">
                    Setup checklist
                  </summary>
                  <div className="mt-3 grid gap-2 md:grid-cols-3">
                    {ownerChecklist.map((step) => (
                      <div
                        key={step.title}
                        className={`rounded-xl px-3 py-3 ring-1 ${
                          step.state === 'complete'
                            ? 'ring-emerald-400/25 bg-emerald-500/10'
                            : step.state === 'active'
                              ? 'ring-brand-primary/25 bg-brand-primary/10'
                              : 'ring-white/10 bg-black/20'
                        }`}
                      >
                        <div className="text-[11px] uppercase tracking-[0.14em] text-zinc-500">{step.title}</div>
                        <div className="mt-1 text-sm font-medium text-white">
                          {step.state === 'complete'
                            ? 'Complete'
                            : step.state === 'active'
                              ? 'In progress'
                              : 'Waiting'}
                        </div>
                        <div className="mt-1 text-xs leading-relaxed text-zinc-400">{step.description}</div>
                      </div>
                    ))}
                  </div>
                </details>
                <div className="mt-4 rounded-xl bg-white/[0.03] px-3 py-3 text-xs text-zinc-300 ring-1 ring-white/10">
                  <div className="text-[11px] uppercase tracking-[0.14em] text-zinc-500">Owner authority</div>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <span className="text-sm text-zinc-100">{ownerAuthorityState.hint}</span>
                    <span className={`rounded-full px-2.5 py-1 text-[11px] ${ownerAuthorityState.badgeClass}`}>
                      {ownerAuthorityState.label}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl bg-black/25 px-3 py-2 ring-1 ring-white/10">
                    <div className="text-[11px] uppercase tracking-[0.14em] text-zinc-500">Connected signer</div>
                    <div className="font-mono text-sm text-zinc-100">{connectedSignerLabel}</div>
                    <div className="text-xs text-zinc-500">{connectedSignerDetail}</div>
                  </div>
                  <details className="mt-3 rounded-xl bg-black/25 px-3 py-3 ring-1 ring-white/10">
                    <summary className="cursor-pointer list-none text-[11px] uppercase tracking-[0.14em] text-zinc-500">
                      Current owners
                    </summary>
                    {cswOwnersState.status === 'loading' ? (
                      <LoadingText intent="processing" size="sm" className="mt-2" labelOverride="Loading current CSW owners..." />
                    ) : null}
                    {cswOwnersState.status === 'error' ? (
                      <div className="mt-2 text-xs text-rose-300">{cswOwnersState.error ?? 'Failed to load owner list.'}</div>
                    ) : null}
                    {cswOwnersState.status !== 'error' && readableCswOwners.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {readableCswOwners.map((owner) => {
                          const isConnectedOwner =
                            Boolean(owner.ownerAddress && controller.ownerSignerAddress) &&
                            owner.ownerAddress!.toLowerCase() === controller.ownerSignerAddress!.toLowerCase()
                          return (
                            <span
                              key={`${owner.index}:${owner.ownerAddress}`}
                              className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-[11px] ${
                                isConnectedOwner
                                  ? 'bg-emerald-500/15 text-emerald-200'
                                  : 'bg-white/5 text-zinc-300'
                              }`}
                            >
                              <span className="font-mono">{shortValue(owner.ownerAddress)}</span>
                              {isConnectedOwner ? <span>Connected</span> : null}
                            </span>
                          )
                        })}
                      </div>
                    ) : null}
                    {cswOwnersState.status === 'ready' && readableCswOwners.length === 0 ? (
                      <div className="mt-2 text-xs text-zinc-500">No readable EOA owners were returned for this CSW.</div>
                    ) : null}
                  </details>
                </div>
                {needsEmbeddedWallet ? (
                  <div className="mt-4 rounded-xl bg-amber-500/10 px-3 py-2 text-xs text-amber-100 ring-1 ring-amber-400/20">
                    Privy embedded wallet provisioning is still settling. Retry signer setup in a moment.
                  </div>
                ) : null}
                {shouldHintBaseAccountForZora ? (
                  <div className="mt-4 rounded-xl bg-brand-primary/10 px-3 py-3 text-xs leading-relaxed text-brand-100 ring-1 ring-brand-primary/25">
                    <div className="text-[11px] uppercase tracking-[0.14em] text-brand-200">Recommended</div>
                    <div className="mt-1 text-sm font-medium text-white">
                      Connect using &ldquo;Base Account&rdquo;
                    </div>
                    <p className="mt-1 text-zinc-300">
                      Your Zora Coinbase Smart Wallet is passkey-controlled. Connecting via
                      Base Account lets 4626 approve embedded signing on the canonical smart wallet
                      and, when accepted, the separate approval used by deploy and agent server signing.
                      Other wallet types (Coinbase Wallet, MetaMask, Rabby) can&rsquo;t bootstrap this for a Zora-provisioned wallet.
                    </p>
                  </div>
                ) : null}
                {showBaseAppConnectPanel ? (
                  <WaitlistConnectBaseAppLazy
                    onSkip={() => undefined}
                    onComplete={() => {
                      void loadMe()
                      void refreshParentEmbeddedOwner()
                    }}
                    parentAddress={canonicalCswAddress}
                    subAccountAddress={me.accountSignals.baseSubAccount?.address ?? me.baseSubAccount ?? null}
                    embeddedEoaAddress={embeddedEoaAddress ?? null}
                  />
                ) : useModernParentOwnerInstallInWaitlist ? (
                  <WaitlistModernParentOwnerInstall
                    controller={controller}
                    embeddedEoaAddress={embeddedEoaAddress}
                    onOwnerInstallSuccess={() => refreshParentEmbeddedOwner?.()}
                    className="mt-4"
                  />
                ) : (
                  <p className="mt-4 text-xs text-zinc-500 leading-relaxed">
                    {signingStepComplete
                      ? executionTrack === 'sub-account'
                        ? '4626 swaps can route through your Base App sub-account.'
                        : '4626 signing is enabled on your canonical wallet.'
                      : subAccountFlowEnabled
                        ? 'Connect Base App for sponsored swaps, or use the modern Base App owner install path (recommended for parent-CSW signing).'
                        : 'Modern Base App owner install (validated self-call) is the primary way to enable parent-CSW signing. The older Zora EOA-relay option is the legacy fallback.'}
                  </p>
                )}
                <div className="mt-4 flex flex-wrap items-start gap-3">
                  {!connectedOwnerReady ? (
                    <Button
                      type="button"
                      variant="primary"
                      onClick={() => connectOwnerWallet()}
                      className="inline-flex"
                    >
                      Connect owner wallet
                    </Button>
                  ) : (
                    <>
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={advancedBusy}
                        onClick={() => connectOwnerWallet()}
                      >
                        Switch owner wallet
                      </Button>
                      <button
                        type="button"
                        disabled={advancedBusy || busyProvider === 'owner_wallet'}
                        onClick={() => void onResetOwnerApproval()}
                        className="rounded-lg bg-white/5 px-3 py-2 text-xs text-zinc-300 transition hover:bg-white/10 hover:text-zinc-100"
                      >
                        Retry owner check
                      </button>
                    </>
                  )}
                </div>
                {!connectedOwnerReady ? (
                  <div className="mt-3 text-xs text-zinc-500">
                    Privy will open a wallet modal with MetaMask, Coinbase Wallet, and detected browser wallets like Rabby.
                    {providerCollision.shouldDisableInjectedConnector
                      ? ' This browser still reports an injected-provider collision, so Coinbase/Base may be the most reliable option if a browser wallet fails to answer.'
                      : ''}
                  </div>
                ) : null}
              </section>
            </div>
          </div>

          <div className="space-y-4 lg:sticky lg:top-6 lg:self-start">
            <section className="rounded-2xl bg-black/35 p-5 space-y-4 ring-1 ring-white/10">
              <div className="space-y-1">
                <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Account summary</div>
                <h3 className="text-lg font-medium text-white">{summaryTitle}</h3>
              </div>
              <div className="grid gap-3 text-sm">
                <div className="rounded-xl bg-white/[0.03] px-3 py-3">
                  <div className="text-[11px] uppercase tracking-[0.14em] text-zinc-500">Email</div>
                  <div className="mt-1 text-zinc-100">{me.email ?? 'Not linked'}</div>
                  <div className="mt-1 text-xs text-zinc-500">{me.emailVerified ? 'Verified and canonical' : 'Needs verification'}</div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-white/[0.03] px-3 py-3">
                    <div className="text-[11px] uppercase tracking-[0.14em] text-zinc-500">Points</div>
                    <div className="mt-1 text-xl font-semibold text-zinc-100">{me.score.points}</div>
                  </div>
                  <div className="rounded-xl bg-white/[0.03] px-3 py-3">
                    <div className="text-[11px] uppercase tracking-[0.14em] text-zinc-500">Tier</div>
                    <div className="mt-1 text-xl font-semibold text-zinc-100">{me.score.tier}</div>
                  </div>
                </div>
                <div className="rounded-xl bg-white/[0.03] px-3 py-3 space-y-2">
                  <div className="text-[11px] uppercase tracking-[0.14em] text-zinc-500">Signals</div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-zinc-500">Zora handle</span>
                    <span className="text-zinc-100">{me.accountSignals.zoraHandle ? `@${me.accountSignals.zoraHandle}` : '—'}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-zinc-500">Creator coin</span>
                    <span className="font-mono text-zinc-100">{shortValue(me.accountSignals.creatorCoin?.address)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-zinc-500">Cross-app accounts</span>
                    <span className="text-zinc-100">{zoraCrossAppCount}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-zinc-500">Signing path</span>
                    <span className="text-zinc-100">
                      {signingStepComplete ? 'Canonical CSW + embedded signer' : 'Pending approval'}
                    </span>
                  </div>
                </div>
              </div>
              {summaryActions ? <div className="flex flex-wrap items-center gap-2">{summaryActions}</div> : null}
            </section>
          </div>
        </div>
      </section>
    </div>
  )
}

