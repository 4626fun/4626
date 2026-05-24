import {
  type KeyboardEvent,
  type ReactNode,
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useQuery } from '@tanstack/react-query'
import { encodeFunctionData, getAddress } from 'viem'
import {
  Apple,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  Mail,
  Music,
  Send,
  Twitter,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import { toast } from '@/components/ui/Toast'

import { Button } from '@/components/ui/Button'
import { WalletProviderIcon } from '@/components/ui/WalletProviderIcon'
import { LoadingText } from '@/components/ui/LoadingState'
import { PROVIDER_POINTS } from '@/features/waitlist/waitlistTiers'
import { ArchBEnrollmentCard } from '@/features/archB/ArchBEnrollmentCard'
import { shouldShowParentCswAddOwnerPanel } from '@/features/waitlist/waitlistFlowState'
import { useWaitlistSigningStepComplete } from '@/features/waitlist/useWaitlistSigningStepComplete'
import { usePrivyClientStatus } from '@/lib/privy/client'
import { buildWaitlistSetupUrl } from '@/lib/auth/waitlistEntry'
import { buildBaseAppProlinkUrl, encodeSingleCallSendCallsProlink } from '@/lib/base/prolink'
import { shortValue } from './shared'
import type { AccountLinkProvider } from './types'
import type { useAccountSetupController } from './useAccountSetupController'
import { CSW_OWNER_MUTATION_ABI } from '@/lib/wallet/cswOwnerAbi'

const PROVIDER_ICON: Record<AccountLinkProvider, LucideIcon | null> = {
  email: Mail,
  apple: Apple,
  twitter: Twitter,
  telegram: Send,
  tiktok: Music,
  external_eoa: Wallet,
  // No official google icon in lucide — fall back to a styled letter badge.
  google: null,
  zora_cross_app: null,
}

function handleAccordionToggleKeyboard(event: KeyboardEvent, toggle: () => void) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    toggle()
  }
}

function ProviderIconBadge({ provider }: { provider: AccountLinkProvider }) {
  const Icon = PROVIDER_ICON[provider]
  const commonClass =
    'flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-white/[0.08] bg-white/[0.03] text-zinc-400'
  if (Icon) {
    return (
      <span className={commonClass} aria-hidden="true">
        <Icon className="h-3 w-3" strokeWidth={1.75} />
      </span>
    )
  }
  // Letter fallback for providers without a clean lucide glyph (currently Google).
  const letter = provider === 'google' ? 'G' : provider.charAt(0).toUpperCase()
  return (
    <span
      className={`${commonClass} font-semibold text-[10px] text-zinc-300`}
      aria-hidden="true"
    >
      {letter}
    </span>
  )
}

const BASESCAN_BASE = 'https://basescan.org/address/'
const ZORA_PROFILE_BASE = 'https://zora.co/'
function shortAddr(addr: string): string {
  if (addr.length <= 10) return addr
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

function isAddressLike(value: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/i.test(value.trim())
}

function formatEth(value: bigint): string {
  const asEth = Number(value) / 1e18
  if (!Number.isFinite(asEth)) return '0'
  if (asEth >= 0.01) return asEth.toFixed(4).replace(/\.?0+$/, '')
  return asEth.toFixed(6).replace(/\.?0+$/, '')
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

const LazyAddOwnerSigningPanel = lazy(async () => {
  const mod = await import('@/features/accountSetup/AddOwnerSigningPanel')
  return { default: mod.AddOwnerSigningPanel }
})

function AddOwnerSigningPanelLazy(props: {
  controller: AccountSetupWorkspaceController
  className?: string
  inlineRelay?: boolean
  onOwnerInstallSuccess?: () => void | Promise<void>
}) {
  return (
    <Suspense
      fallback={
        <div className="rounded-xl bg-white/[0.02] px-3 py-3 text-xs text-zinc-500 ring-1 ring-white/10">
          <LoadingText intent="session" labelOverride="Loading signing setup..." />
        </div>
      }
    >
      <LazyAddOwnerSigningPanel {...props} />
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
  const hasPrivyProviderContext = privyClientStatus === 'ready'
  // openStep: null = auto (first incomplete), 1/2/3 = manually opened
  const [openStep, setOpenStep] = useState<1 | 2 | 3 | null>(null)
  const {
    advancedBusy,
    baseAppUrl,
    busyProvider,
    canonicalCswAddress,
    connectedOwnerReady,
    connectedCanonicalWalletSelected,
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
    providerCollision,
    readableCswOwners,
    zoraCrossAppCount,
    requiresBaseAppForOwnerInstall,
    zoraLinked,
  } = controller
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

  // `zoraStepComplete`, `walletStepComplete`, and `stepOneComplete` are
  // hoisted above the `if (!me) return null` guard so the auto-trigger effect
  // can depend on them. `signingStepComplete` is the canonical (post-`me`)
  // form used by the rendered step UI — it shadows the auto-trigger
  // helper `signingStepCompleteForAuto` once `me` is available.
  const executionTrack = me.accountSignals.executionTrack
  const showParentCswAddOwnerPanel = shouldShowParentCswAddOwnerPanel({
    ownerInstallRequested: ownerInstallPathActive,
    signingStepComplete,
    executionTrack,
    accountSignals: me.accountSignals,
    parentEmbeddedOwnerOnChain,
  })
  const stepTwoDoneSubtitle = signingStepComplete
    ? 'Embedded signer installed on your parent smart wallet'
    : 'Enable 4626 signing on your parent smart wallet'
  const sponsorshipDiagnostic = extractSponsorshipDiagnostic(error)
  const ownerApprovalDiagnostic = extractOwnerApprovalDebugDiagnostic(error)
  // Zora-controlled CBSWs are passkey-owned (P256 keys held in Coinbase
  // Wallet / Base Account), not EOA-owned. The cross-app login surfaces the
  // CBSW address but cannot expose a transactional signer, so we steer users
  // to Base Account before they burn a connection attempt on an unrelated EOA.
  const hasConnectedSigner = Boolean(connectedSignerLabel) && !/no wallet connected/i.test(connectedSignerLabel)
  const shouldHintBaseAccountForZora =
    zoraLinked && Boolean(canonicalCswAddress) && !connectedOwnerReady && !hasConnectedSigner

  if (context === 'waitlist') {
    // Which top-level step is expanded: null = auto
    const resolvedOpen: 1 | 2 = ownerInstallResumeState.requested
      ? 2
      : openStep === 1 || openStep === 2
        ? openStep
        : stepOneComplete
          ? 2
          : 1
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
      stepOneComplete ? 'done' : resolvedOpen === 1 ? 'active' : 'upcoming'
    const stepTwoStatus: 'done' | 'active' | 'upcoming' =
      signingStepComplete
        ? 'done'
        : ownerInstallPathActive || (stepOneComplete && resolvedOpen === 2)
          ? 'active'
          : 'upcoming'

    const allDone = zoraStepComplete && walletStepComplete && signingStepComplete
    const rawZoraHandle = me.accountSignals.zoraHandle?.trim() ?? ''
    const normalizedZoraHandle = rawZoraHandle
      ? (rawZoraHandle.startsWith('@') || rawZoraHandle.startsWith('$') ? rawZoraHandle : `@${rawZoraHandle}`)
      : null
    const zoraProfileUrl = normalizedZoraHandle ? `${ZORA_PROFILE_BASE}${normalizedZoraHandle}` : null

    if (allDone) {
      return (
        <div className="mx-auto w-full max-w-[640px] space-y-5">
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

          <div className="space-y-2">
            <h2 className="text-2xl font-semibold tracking-tight text-white">You&apos;re live</h2>
            <p className="text-sm text-zinc-500">Your account is activated and ready.</p>
            <div className="flex flex-wrap items-center gap-2 text-[11px]">
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-emerald-200">
                <CheckCircle2 className="h-3 w-3" />
                Step 1 complete
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-emerald-200">
                <CheckCircle2 className="h-3 w-3" />
                Step 2 complete
              </span>
            </div>
          </div>

          <div className="rounded-[13px] border border-white/[0.08] bg-white/[0.02] px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 text-[11px] text-zinc-400">
                  <CheckCircle2 className="h-3.5 w-3.5 text-zinc-500" />
                  Zora linked · Signing enabled
                </div>
                {(normalizedZoraHandle || canonicalCswAddress) ? (
                  <div className="flex min-w-0 items-center gap-1.5 text-[11px] text-zinc-500">
                    {normalizedZoraHandle && zoraProfileUrl ? (
                      <a
                        href={zoraProfileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="shrink-0 hover:text-zinc-300 transition-colors"
                      >
                        {normalizedZoraHandle}
                      </a>
                    ) : null}
                    {normalizedZoraHandle && canonicalCswAddress ? <span className="text-zinc-700">·</span> : null}
                    {canonicalCswAddress ? (
                      <button
                        type="button"
                        onClick={() => copyAddress(canonicalCswAddress)}
                        title={canonicalCswAddress}
                        className="shrink-0 font-mono text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors"
                      >
                        {shortAddr(canonicalCswAddress)}
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                disabled={busyProvider === 'email'}
                onClick={() => void onSwitchAccount()}
                className="shrink-0 text-xs font-medium text-zinc-500 transition-colors hover:text-zinc-300 disabled:opacity-50"
              >
                {busyProvider === 'email' ? 'Resetting…' : 'Reset'}
              </button>
            </div>
          </div>

          {summaryActions ? (
            <section className="rounded-[13px] border border-white/[0.08] bg-white/[0.02] px-4 py-4">
              {summaryActions}
            </section>
          ) : null}

          <WaitlistAdvancedSection controller={controller} label="Account settings" />

          {waitlistFooter ? <div className="flex justify-center pt-1">{waitlistFooter}</div> : null}
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

        {ownerInstallResumeState.requested ? (
          <div className="rounded-2xl bg-[linear-gradient(180deg,rgba(37,99,235,0.16),rgba(37,99,235,0.05))] px-5 py-4 text-sm text-brand-50 ring-1 ring-brand-primary/20">
            <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-brand-200">
              <span className="inline-flex rounded-full bg-brand-primary/15 px-2.5 py-1">Desktop signing setup</span>
              <span className="text-brand-100/70">Owner install required</span>
            </div>
            <div className="mt-2 text-base font-medium text-white">
              Enable signing on your parent smart wallet from this browser.
            </div>
            <p className="mt-1 text-sm leading-relaxed text-brand-50/85">
              Connect a current owner of your Zora Coinbase Smart Wallet (Rabby, MetaMask, or Base Account), then
              finish the two-step Relay flow on <span className="font-mono text-brand-50">/add-owner</span>.
            </p>
          </div>
        ) : null}

        {/* Heading — single line */}
        <div className="flex items-start justify-between gap-3">
          <div>
          <h2 className="text-2xl font-semibold tracking-tight text-white">{allDone ? 'Account activated' : 'Activate your account'}</h2>
          <p className="mt-1 text-sm text-zinc-500">{allDone ? 'All steps completed' : 'Complete both steps to unlock app access'}</p>
          {!allDone ? (
            <div className="mt-2 inline-flex items-center rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[11px] text-zinc-300">
              Step {resolvedOpen} of 2
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
                    {requiresBaseAppForOwnerInstall ? (
                      <div className="rounded-lg bg-brand-primary/10 px-3 py-2.5 text-xs leading-relaxed text-brand-100 ring-1 ring-brand-primary/25">
                        Your Zora smart wallet is passkey-controlled. Owner install cannot finish from this
                        desktop browser — open{' '}
                        {baseAppUrl ? (
                          <a
                            href={baseAppUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="font-semibold text-brand-50 underline decoration-dotted underline-offset-2"
                          >
                            Base app
                          </a>
                        ) : (
                          <span className="font-semibold">Base app</span>
                        )}{' '}
                        or connect an on-chain EOA owner in the wallet connector first.
                      </div>
                    ) : shouldHintBaseAccountForZora ? (
                      <div className="rounded-lg bg-brand-primary/10 px-3 py-2.5 text-xs leading-relaxed text-brand-100 ring-1 ring-brand-primary/25">
                        <span className="font-semibold">Pick &ldquo;Base Account&rdquo;</span>{' '}
                        in the wallet connector. Your Zora smart wallet is passkey-controlled,
                        so 4626 can approve embedded signing on the canonical smart wallet.
                      </div>
                    ) : null}
                    {showParentCswAddOwnerPanel ? (
                      <AddOwnerSigningPanelLazy
                        controller={controller}
                        inlineRelay
                        onOwnerInstallSuccess={() => refreshParentEmbeddedOwner()}
                      />
                    ) : null}
                    {needsEmbeddedWallet ? (
                      <p className="text-xs text-amber-300/80">Embedded wallet is still settling. Retry in a moment.</p>
                    ) : null}
                    {inTelegramMiniApp ? (
                      <p className="text-xs text-amber-300/80">Owner signatures are more reliable in an external browser tab.</p>
                    ) : null}
                    {providerCollision.shouldDisableInjectedConnector ? (
                      <p className="text-xs text-zinc-600">Coinbase/Base is the most reliable option when a wallet collision is detected.</p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            )
          })()}
        </div>

        {/* Optional post-activation delegation consent. Keep out of core setup flow. */}
        {allDone ? <ArchBEnrollmentCard hasCanonicalCsw={Boolean(canonicalCswAddress)} /> : null}

        {/* Advanced — identities + co-owner management. Collapsed by default. */}
        <WaitlistAdvancedSection controller={controller} />

        {/* Enter App — only after all 3 steps */}
        {allDone && summaryActions ? (
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
            Connect a current owner of your Zora Coinbase Smart Wallet (Rabby, MetaMask, or Base Account), verify
            authority on Base, then finish the two-step Relay add-owner flow on{' '}
            <span className="font-mono text-brand-50">/add-owner</span>.
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
                    <div className="text-base font-medium text-white">Enable 4626 smart-wallet signing</div>
                    <p className="text-sm leading-relaxed text-zinc-400">
                      Your canonical CSW stays primary. Finish the two-step Relay add-owner flow on{' '}
                      <span className="font-mono text-zinc-300">/add-owner</span> so your Privy embedded signer can
                      co-sign sponsored actions.
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
                    This step was resumed from another surface. Connect a current owner of the detected CSW, verify the
                    signer, then continue on <span className="font-mono">/add-owner</span> for the Relay add-owner flow.
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
                <AddOwnerSigningPanelLazy
                  controller={controller}
                  className="mt-4"
                  inlineRelay
                  onOwnerInstallSuccess={() => refreshParentEmbeddedOwner()}
                />
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
            <WaitlistAdvancedSection controller={controller} label="Account settings" />
          </div>
        </div>
      </section>
    </div>
  )
}

/**
 * Collapsed "Advanced" disclosure inside the waitlist accordion.
 *
 * Consolidates the identity-linking grid and Rabby co-owner tools that
 * used to live at `/accounts` into the single `/waitlist` surface. Kept
 * minimal: one clean disclosure with two compact sub-sections; the
 * advanced owner input is further nested behind its own disclosure to
 * avoid surfacing destructive controls by default.
 */
function WaitlistAdvancedSection({
  controller,
  label = 'Advanced',
}: {
  controller: AccountSetupWorkspaceController
  label?: string
}) {
  const [open, setOpen] = useState(false)
  const [rabbyOpen, setRabbyOpen] = useState(false)
  const [rabbyAddress, setRabbyAddress] = useState('')
  const {
    advancedBusy,
    busyProvider,
    canShowAdvanced,
    canonicalCswAddress,
    customOwnerGasPreflight,
    customOwnerPreparedAddress,
    customOwnerPreparedTxRequest,
    ownerInstallIntent,
    providerCards,
    onLinkProvider,
    onUnlinkProvider,
    onAddRabbyCoOwner,
    telegramLaunchParamsAvailable,
  } = controller
  const normalizedRabbyAddress = useMemo(() => {
    const raw = rabbyAddress.trim()
    return isAddressLike(raw) ? raw.toLowerCase() : null
  }, [rabbyAddress])
  const rabbyOwnerAddCalldata = useMemo(() => {
    if (!normalizedRabbyAddress) return null
    try {
      return encodeFunctionData({
        abi: CSW_OWNER_MUTATION_ABI,
        functionName: 'addOwnerAddress',
        args: [getAddress(normalizedRabbyAddress) as `0x${string}`],
      })
    } catch {
      return null
    }
  }, [normalizedRabbyAddress])
  const preparedOwnerTxForAddress = useMemo(() => {
    if (!customOwnerPreparedTxRequest || !customOwnerPreparedAddress || !normalizedRabbyAddress) return null
    if (customOwnerPreparedAddress.toLowerCase() !== normalizedRabbyAddress.toLowerCase()) return null
    return customOwnerPreparedTxRequest
  }, [customOwnerPreparedAddress, customOwnerPreparedTxRequest, normalizedRabbyAddress])
  const prolinkCallTarget = preparedOwnerTxForAddress?.to ?? canonicalCswAddress ?? null
  const prolinkCallData = preparedOwnerTxForAddress?.data ?? rabbyOwnerAddCalldata
  const prolinkCallValue = preparedOwnerTxForAddress?.value ?? '0x0'
  const rabbyProlinkSourceLabel = preparedOwnerTxForAddress
    ? 'Base App prolink (exact backend-prepared call)'
    : 'Base App prolink (local preview call)'
  const rabbyOwnerAddProlinkQuery = useQuery({
    queryKey: [
      'waitlist-advanced',
      'custom-owner-prolink',
      prolinkCallTarget,
      normalizedRabbyAddress,
      prolinkCallData,
      prolinkCallValue,
      preparedOwnerTxForAddress ? 'prepared' : 'preview',
    ],
    queryFn: async () => {
      if (!prolinkCallTarget || !prolinkCallData) return null
      return await encodeSingleCallSendCallsProlink({
        from: canonicalCswAddress ?? prolinkCallTarget,
        to: prolinkCallTarget,
        data: prolinkCallData,
        value: prolinkCallValue,
      })
    },
    enabled: Boolean(rabbyOpen && prolinkCallTarget && normalizedRabbyAddress && prolinkCallData),
    staleTime: Number.POSITIVE_INFINITY,
    retry: false,
  })
  const rabbyOwnerAddProlinkUrl = useMemo(() => {
    if (!rabbyOwnerAddProlinkQuery.data) return null
    try {
      return buildBaseAppProlinkUrl(rabbyOwnerAddProlinkQuery.data)
    } catch {
      return null
    }
  }, [rabbyOwnerAddProlinkQuery.data])

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="group flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-[11.5px] uppercase tracking-[0.14em] text-zinc-500 transition-colors hover:text-zinc-300"
        aria-expanded={open}
      >
        <span>{label}</span>
        <ChevronRight
          className={`h-3.5 w-3.5 transition-transform duration-150 ${open ? 'rotate-90' : ''}`}
          aria-hidden="true"
        />
      </button>

      {open ? (
        <div className="mt-2 space-y-4">
          {/* Linked identities — icon + status + points reward + action, per row */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-[0.14em] text-zinc-500">
                Earn points by linking
              </span>
              <span className="text-[10px] uppercase tracking-[0.14em] text-zinc-600">
                {providerCards.filter((p) => p.linked).length}/{providerCards.length}
              </span>
            </div>
            <ul className="divide-y divide-white/[0.04]">
              {providerCards.map((provider) => {
                const busy = busyProvider === provider.provider
                const telegramBlocked =
                  provider.provider === 'telegram' && !provider.linked && !telegramLaunchParamsAvailable
                const points = PROVIDER_POINTS[provider.provider] ?? null
                return (
                  <li
                    key={provider.provider}
                    className="flex items-center gap-2.5 py-2 text-[11.5px] transition-colors"
                  >
                    <ProviderIconBadge provider={provider.provider} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-zinc-200">{provider.label}</div>
                      <div
                        className={`truncate text-[10.5px] ${
                          provider.linked ? 'text-emerald-400/80' : 'text-zinc-600'
                        }`}
                      >
                        {provider.linked
                          ? provider.values.length > 0
                            ? provider.values.map((value) => shortValue(value)).join(', ')
                            : 'Linked'
                          : telegramBlocked
                            ? 'Open from Telegram'
                            : 'Not linked'}
                      </div>
                    </div>
                    {points !== null && !provider.linked ? (
                      <span className="shrink-0 rounded-md border border-white/[0.06] bg-white/[0.02] px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-zinc-400">
                        +{points}
                      </span>
                    ) : null}
                    {provider.linked ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void onUnlinkProvider(provider.provider)}
                        className="shrink-0 text-[10.5px] text-zinc-600 transition-colors hover:text-rose-300 disabled:opacity-50"
                      >
                        {busy ? '…' : 'Unlink'}
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={busy || telegramBlocked}
                        onClick={() => void onLinkProvider(provider.provider)}
                        className="shrink-0 rounded-md border border-brand-primary/25 bg-brand-primary/[0.08] px-2 py-0.5 text-[10.5px] font-medium text-brand-200 transition-colors hover:border-brand-primary/40 hover:bg-brand-primary/[0.14] disabled:opacity-40"
                      >
                        {busy ? '…' : 'Link'}
                      </button>
                    )}
                  </li>
                )
              })}
            </ul>
          </div>

          {/* Advanced owner actions — nested disclosure, gated on canonical CSW */}
          {canShowAdvanced ? (
            <div className="border-t border-white/[0.05] pt-3">
              <button
                type="button"
                onClick={() => setRabbyOpen((prev) => !prev)}
                className="group flex w-full items-center justify-between gap-2 text-[11px] uppercase tracking-[0.14em] text-zinc-500 transition-colors hover:text-zinc-300"
                aria-expanded={rabbyOpen}
              >
                <span>Advanced owner actions</span>
                <ChevronRight
                  className={`h-3.5 w-3.5 transition-transform duration-150 ${rabbyOpen ? 'rotate-90' : ''}`}
                  aria-hidden="true"
                />
              </button>
              {rabbyOpen ? (
                <div className="mt-2.5 space-y-2">
                  <p className="text-[11px] leading-relaxed text-zinc-500">
                    Add a second owner to your canonical CSW (e.g. a Rabby EOA). 4626 will use sponsored
                    smart-wallet approval when policy context is available.
                  </p>
                  {ownerInstallIntent === 'customCoOwner' && customOwnerGasPreflight ? (
                    <div className="rounded-md border border-white/10 bg-black/20 px-2.5 py-2 text-[10.5px] text-zinc-300">
                      <div>Signer: <span className="font-mono text-zinc-200">{shortAddr(customOwnerGasPreflight.payerAddress)}</span></div>
                      <div className="mt-0.5">Estimated gas: <span className="font-mono text-zinc-200">{customOwnerGasPreflight.estimatedGas.toString()}</span></div>
                      <div className="mt-0.5">
                        Required: <span className="font-mono text-zinc-200">{formatEth(customOwnerGasPreflight.requiredWei)} ETH</span>
                        {' '}| Balance: <span className="font-mono text-zinc-200">{formatEth(customOwnerGasPreflight.balanceWei)} ETH</span>
                      </div>
                    </div>
                  ) : null}
                  <p className="text-[10.5px] leading-relaxed text-zinc-500">
                    {ownerInstallIntent === 'customCoOwner' && customOwnerGasPreflight
                      ? 'Fallback path is direct transaction approval. If Base App shows insufficient funds, fund the signer wallet on Base and retry Add co-owner.'
                      : 'If sponsorship is denied, the error will include diagnostics so you can retry with the same signed-in wallet session.'}
                  </p>
                  <input
                    value={rabbyAddress}
                    onChange={(event) => setRabbyAddress(event.target.value)}
                    placeholder="0x…"
                    className="w-full rounded-md border border-white/10 bg-black/30 px-2.5 py-1.5 font-mono text-[11.5px] text-white placeholder:text-zinc-700 outline-none focus:border-brand-primary/40"
                  />
                  {rabbyOwnerAddProlinkQuery.isLoading ? (
                    <div className="text-[10.5px] text-zinc-500">Encoding Base App prolink…</div>
                  ) : rabbyOwnerAddProlinkQuery.data ? (
                    <div className="rounded-md border border-white/10 bg-black/20 px-2.5 py-2 space-y-2">
                      <div className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">
                        {rabbyProlinkSourceLabel}
                      </div>
                      {rabbyOwnerAddProlinkUrl ? (
                        <a
                          href={rabbyOwnerAddProlinkUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-md border border-brand-primary/30 bg-brand-primary/10 px-2 py-1 text-[10px] text-brand-100 hover:bg-brand-primary/20"
                        >
                          Open in Base App <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : null}
                      <div className="flex items-start gap-2">
                        <span className="font-mono text-[10px] break-all text-zinc-300">{rabbyOwnerAddProlinkQuery.data}</span>
                        <button
                          type="button"
                          onClick={() => {
                            void (async () => {
                              try {
                                if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
                                  await navigator.clipboard.writeText(rabbyOwnerAddProlinkQuery.data ?? '')
                                }
                              } catch {
                                // ignore
                              }
                            })()
                          }}
                          className="shrink-0 rounded-md border border-white/10 bg-black/25 px-2 py-1 text-[10px] text-zinc-300 hover:bg-black/40"
                        >
                          Copy
                        </button>
                      </div>
                    </div>
                  ) : rabbyOwnerAddProlinkQuery.error ? (
                    <div className="text-[10.5px] text-amber-300">
                      Prolink unavailable: {(rabbyOwnerAddProlinkQuery.error as Error)?.message}
                    </div>
                  ) : null}
                  <button
                    type="button"
                    disabled={advancedBusy || rabbyAddress.trim().length === 0}
                    onClick={() => void onAddRabbyCoOwner(rabbyAddress)}
                    className="inline-flex h-8 items-center rounded-md border border-white/10 bg-white/[0.03] px-3 text-[11.5px] text-zinc-300 transition-colors hover:bg-white/[0.06] disabled:opacity-40"
                  >
                    {advancedBusy ? 'Preparing…' : 'Add co-owner'}
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
