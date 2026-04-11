import { type ReactNode, useCallback, useState } from 'react'
import { CheckCircle2, ExternalLink } from 'lucide-react'

import { WalletProviderIcon } from '@/components/ui/WalletProviderIcon'
import { shortValue } from './shared'
import type { useAccountSetupController } from './useAccountSetupController'

const BASESCAN_BASE = 'https://basescan.org/address/'
const ZORA_PROFILE_BASE = 'https://zora.co/'

type AccountSetupWorkspaceController = ReturnType<typeof useAccountSetupController>

export function AccountSetupWorkspaceView(props: {
  context: 'accounts' | 'waitlist'
  controller: AccountSetupWorkspaceController
  summaryActions?: ReactNode
}) {
  const { context, controller, summaryActions } = props
  // openStep: null = auto (first incomplete), 1/2/3 = manually opened
  const [openStep, setOpenStep] = useState<1 | 2 | 3 | null>(null)
  const {
    advancedBusy,
    baseAppUrl,
    busyProvider,
    canonicalCswAddress,
    connectedOwnerReady,
    connectedSignerDetail,
    connectedSignerLabel,
    connectOwnerWallet,
    cswOwnersState,
    error,
    inTelegramMiniApp,
    loading,
    me,
    needsBaseAppSetup,
    needsEmbeddedWallet,
    notice,
    onEnable4626Signing,
    onLinkZora,
    onRefreshZora,
    ownerApprovalReady,
    ownerAuthorityState,
    ownerChecklist,
    ownerInstallResumeState,
    ownerInstallSectionRef,
    ownerPrimaryCtaLabel,
    providerCollision,
    readableCswOwners,
    retryOwnerCheck,
    zoraCrossAppCount,
    zoraHandoffUrl,
    zoraLinked,
  } = controller
  const copyAddress = useCallback((addr: string) => {
    void navigator.clipboard.writeText(addr)
  }, [])

  if (loading && !me) {
    return (
      <div className="card rounded-2xl border border-white/10 bg-black/40 p-6 text-sm text-zinc-400">
        Loading account state...
      </div>
    )
  }

  if (!me) return null

  const zoraStepComplete = zoraLinked
  const walletStepComplete = Boolean(canonicalCswAddress)
  const signingStepComplete = /4626 signing is enabled|already enabled/i.test(notice ?? '')

  if (context === 'waitlist') {
    const stepOneComplete = zoraStepComplete && walletStepComplete
    // Which top-level step is expanded: null = auto
    const resolvedOpen: 1 | 2 =
      openStep === 1 || openStep === 2 ? openStep : stepOneComplete ? 2 : 1
    const primarySigningLabel = connectedOwnerReady ? 'Approve signing access' : 'Connect owner wallet'

    const goToPrev = () => {
      if (resolvedOpen > 1) setOpenStep((resolvedOpen - 1) as 1 | 2 | 3)
    }

    const toggleStep = (n: 1 | 2) => {
      setOpenStep(openStep === n ? null : n)
    }

    // Shared classes
    const stepBase = 'border-b border-white/[0.06] last:border-0 transition-colors duration-150 cursor-pointer'
    const doneRow = `${stepBase} bg-[#0a0a0b] hover:bg-[#111318]`
    const activeRow = `${stepBase} bg-[#1b2030] border-l-2 border-l-brand-primary`
    const badgeDone = 'flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full border border-emerald-500/20 bg-emerald-500/[0.12] text-[11px] font-bold text-emerald-400'
    const badgeActive = 'flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full border border-brand-primary/22 bg-brand-primary/[0.14] text-[11px] font-bold text-brand-200'
    const pillDone = 'inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/[0.12] px-[10px] py-[5px] text-[11px] uppercase tracking-[0.12em] text-emerald-400'
    const pillActive = 'inline-flex items-center rounded-full border border-brand-primary/22 bg-brand-primary/[0.14] px-[10px] py-[5px] text-[11px] uppercase tracking-[0.12em] text-brand-300'
    const pillUpcoming = 'inline-flex items-center rounded-full border border-white/[0.06] px-[10px] py-[5px] text-[11px] uppercase tracking-[0.12em] text-zinc-600'

    const stepOneStatus: 'done' | 'active' | 'upcoming' =
      stepOneComplete ? 'done' : resolvedOpen === 1 ? 'active' : 'upcoming'
    const stepTwoStatus: 'done' | 'active' | 'upcoming' =
      signingStepComplete ? 'done' : stepOneComplete && resolvedOpen === 2 ? 'active' : 'upcoming'
    const stepOneBStatus: 'done' | 'active' | 'upcoming' =
      walletStepComplete ? 'done' : zoraStepComplete ? 'active' : 'upcoming'

    const allDone = zoraStepComplete && walletStepComplete && signingStepComplete
    const rawZoraHandle = me.accountSignals.zoraHandle?.trim() ?? ''
    const normalizedZoraHandle = rawZoraHandle
      ? (rawZoraHandle.startsWith('@') || rawZoraHandle.startsWith('$') ? rawZoraHandle : `@${rawZoraHandle}`)
      : null
    const zoraProfileUrl = normalizedZoraHandle ? `${ZORA_PROFILE_BASE}${normalizedZoraHandle}` : null

    return (
      <div className="mx-auto w-full max-w-[640px] space-y-5">
        {/* System messages */}
        {error ? (
          <div role="alert" aria-live="assertive" className="rounded-xl border border-rose-500/20 bg-rose-500/[0.08] px-4 py-3 text-sm text-rose-300">
            {error}
          </div>
        ) : null}
        {notice ? (
          <div role="status" aria-live="polite" className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.08] px-4 py-3 text-sm text-emerald-300">
            {notice}
          </div>
        ) : null}

        {/* Heading — single line */}
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-white">Activate your account</h2>
          <p className="mt-1 text-sm text-zinc-500">{stepTwoStatus === 'done' ? 'Completed' : `Step ${resolvedOpen} of 2`}</p>
        </div>

        {/* Accordion steps */}
        <div className="overflow-hidden rounded-[13px] border border-white/[0.06]">

          {/* ── Step 1 — Zora + wallet sync ── */}
          {(() => {
            const s = stepOneStatus
            const isOpen = s === 'active'
            const addr = canonicalCswAddress
            return (
              <div
                className={s === 'done' ? doneRow : s === 'active' ? activeRow : stepBase}
                onClick={() => toggleStep(1)}
              >
                <div className="flex items-center justify-between gap-3 px-4 py-3.5">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className={s === 'done' ? badgeDone : s === 'active' ? badgeActive : 'flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-[11px] font-bold text-zinc-600'}>
                      {s === 'done' ? <CheckCircle2 className="h-3.5 w-3.5" /> : '1'}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <img src="/brands/zora-token.svg" alt="" aria-hidden="true" className="h-4 w-4 shrink-0 rounded-full object-cover" />
                        <p className="truncate text-sm font-semibold text-white">Link your Zora identity</p>
                        <span className="inline-flex items-center rounded-full border border-white/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.08em] text-zinc-500">
                          Manual
                        </span>
                      </div>
                      {s === 'done' && normalizedZoraHandle && zoraProfileUrl ? (
                        <a
                          href={zoraProfileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-0.5 inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                        >
                          {normalizedZoraHandle}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : null}
                      {addr ? (
                        <div className="mt-1 flex items-start gap-2">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation()
                              copyAddress(addr)
                            }}
                            title="Copy address"
                            className="font-mono text-xs text-zinc-400 hover:text-zinc-200 transition-colors break-all text-left"
                          >
                            {addr}
                          </button>
                          <a
                            href={`${BASESCAN_BASE}${addr}`}
                            target="_blank"
                            rel="noreferrer"
                            title="View on Basescan"
                            onClick={(event) => event.stopPropagation()}
                            className="shrink-0 text-zinc-500 hover:text-zinc-200 transition-colors"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      ) : null}
                      <div className="mt-1 text-xs text-zinc-300">
                        Wallet detection
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {s === 'done' ? (
                      <button
                        type="button"
                        disabled={busyProvider === 'zora_cross_app'}
                        onClick={(event) => {
                          event.stopPropagation()
                          void onLinkZora()
                        }}
                        className="inline-flex h-[30px] items-center rounded-md border border-white/10 bg-transparent px-2.5 text-[11px] font-medium uppercase tracking-[0.08em] text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200 disabled:opacity-50"
                      >
                        {busyProvider === 'zora_cross_app' ? 'Switching…' : 'Reselect'}
                      </button>
                    ) : null}
                    <span className={s === 'done' ? pillDone : s === 'active' ? pillActive : pillUpcoming}>
                      {s === 'done' ? 'Done' : s === 'active' ? 'Open' : 'Upcoming'}
                    </span>
                  </div>
                </div>
                {isOpen ? (
                  <div className="px-4 pb-4 pl-[52px]">
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={busyProvider === 'zora_cross_app'}
                        onClick={() => void onLinkZora()}
                        className="inline-flex h-[38px] items-center rounded-lg bg-brand-primary px-4 text-sm font-semibold text-white shadow-[0_4px_16px_rgba(0,82,255,0.28)] hover:bg-brand-hover disabled:opacity-50"
                      >
                        {busyProvider === 'zora_cross_app' ? 'Connecting…' : 'Connect Zora'}
                      </button>
                      <button
                        type="button"
                        disabled={busyProvider === 'zora_cross_app'}
                        onClick={() => void onRefreshZora()}
                        className="inline-flex h-[38px] items-center rounded-lg border border-white/10 bg-transparent px-4 text-sm font-medium text-zinc-400 hover:bg-white/[0.04] disabled:opacity-50"
                      >
                        Already linked? Refresh
                      </button>
                    </div>
                    <div
                      className="mt-3 rounded-md border border-white/10 bg-black/20 px-3 py-2"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <div className="text-xs text-zinc-300">Wallet detection</div>
                      <div className="mt-2 flex items-center gap-2 text-[11px] text-zinc-400">
                        <WalletProviderIcon provider="coinbase" size={12} />
                        <span className="truncate">Detect your Coinbase Smart Wallet</span>
                        <span className="rounded-full border border-white/10 px-1.5 py-0.5 text-[9px] uppercase tracking-[0.08em] text-zinc-500">
                          Auto
                        </span>
                        <span className={stepOneBStatus === 'done' ? pillDone : stepOneBStatus === 'active' ? pillActive : pillUpcoming}>
                          {stepOneBStatus === 'done' ? 'Done' : stepOneBStatus === 'active' ? 'Open' : 'Upcoming'}
                        </span>
                      </div>
                      {addr ? (
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => copyAddress(addr)}
                            title="Copy address"
                            className="font-mono text-xs text-zinc-500 hover:text-zinc-300 transition-colors break-all text-left"
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
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      ) : null}
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={busyProvider === 'zora_cross_app'}
                          onClick={() => void onRefreshZora()}
                          className="inline-flex h-[34px] items-center rounded-md border border-white/10 bg-transparent px-3 text-xs font-medium text-zinc-400 hover:bg-white/[0.04] disabled:opacity-50"
                        >
                          {busyProvider === 'zora_cross_app' ? 'Checking…' : 'Retry detection'}
                        </button>
                        {needsBaseAppSetup && baseAppUrl ? (
                          <a href={baseAppUrl} target="_blank" rel="noreferrer" className="inline-flex h-[34px] items-center rounded-md border border-white/10 bg-transparent px-3 text-xs font-medium text-zinc-400 hover:bg-white/[0.04]">
                            Open Base app
                          </a>
                        ) : null}
                      </div>
                    </div>
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
              <div
                className={s === 'done' ? doneRow : s === 'active' ? activeRow : stepBase}
                onClick={() => toggleStep(2)}
              >
                <div className="flex items-center justify-between gap-3 px-4 py-3.5">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className={s === 'done' ? badgeDone : s === 'active' ? badgeActive : 'flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-[11px] font-bold text-zinc-600'}>
                      {s === 'done' ? <CheckCircle2 className="h-3.5 w-3.5" /> : '2'}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-white">Enable 4626 signing</p>
                      {s === 'done' ? (
                        <p className="mt-0.5 text-xs text-zinc-500">Signing access approved</p>
                      ) : null}
                    </div>
                  </div>
                  <span className={s === 'done' ? pillDone : s === 'active' ? pillActive : pillUpcoming}>
                    {s === 'done' ? 'Done' : s === 'active' ? 'Open' : 'Upcoming'}
                  </span>
                </div>
                {isOpen ? (
                  <div className="px-4 pb-4 pl-[52px]">
                    <p className="text-sm leading-relaxed text-zinc-400">
                      Connect an owner wallet and approve 4626 signing access.
                      Once complete, the app unlocks immediately.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={advancedBusy || needsEmbeddedWallet}
                        onClick={() => (connectedOwnerReady ? void onEnable4626Signing() : connectOwnerWallet())}
                        className="inline-flex h-[38px] items-center rounded-lg bg-brand-primary px-4 text-sm font-semibold text-white shadow-[0_4px_16px_rgba(0,82,255,0.28)] hover:bg-brand-hover disabled:opacity-50"
                      >
                        {advancedBusy ? 'Working…' : primarySigningLabel}
                      </button>
                      <button
                        type="button"
                        disabled={advancedBusy}
                        onClick={() => void retryOwnerCheck()}
                        className="inline-flex h-[38px] items-center rounded-lg border border-white/10 bg-transparent px-4 text-sm font-medium text-zinc-400 hover:bg-white/[0.04] disabled:opacity-50"
                      >
                        Retry
                      </button>
                      {resolvedOpen > 1 ? (
                        <button type="button" onClick={goToPrev} className="inline-flex h-[38px] items-center rounded-lg border border-white/10 bg-transparent px-4 text-sm font-medium text-zinc-500 hover:bg-white/[0.04]">
                          Previous step
                        </button>
                      ) : null}
                    </div>
                    {connectedSignerLabel ? (
                      <p className="mt-3 text-xs text-zinc-500">
                        Connected signer: <span className="font-mono text-zinc-300">{connectedSignerLabel}</span>
                      </p>
                    ) : null}
                    {connectedSignerDetail ? (
                      <p className="mt-1 text-xs text-zinc-500">{connectedSignerDetail}</p>
                    ) : null}
                    {needsEmbeddedWallet ? (
                      <p className="mt-2 text-xs text-amber-300">Embedded wallet is still settling. Retry in a moment.</p>
                    ) : null}
                    {inTelegramMiniApp ? (
                      <p className="mt-2 text-xs text-amber-300">Owner signatures are more reliable in an external browser tab.</p>
                    ) : null}
                    {providerCollision.shouldDisableInjectedConnector ? (
                      <p className="mt-2 text-xs text-zinc-500">Wallet collision detected — Coinbase/Base is the most reliable option here.</p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            )
          })()}
        </div>

        {/* Enter App — only after all 3 steps */}
        {allDone && summaryActions ? (
          <div className="pt-1">{summaryActions}</div>
        ) : null}
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
          {error}
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
              {ownerInstallResumeState.source === 'telegram' ? 'Continue from Telegram' : 'Continue setup'}
            </span>
            <span className="text-brand-100/70">Owner install required</span>
          </div>
          <div className="mt-2 text-base font-medium text-white">
            Your Telegram account is linked. Finish wallet setup here.
          </div>
          <div className="mt-1 max-w-3xl text-sm leading-relaxed text-brand-50/85">
            4626 detected your Zora Coinbase Smart Wallet. The next step is to connect one of that wallet&apos;s current owners, verify authority on Base, and approve one transaction so 4626 can act through the same wallet.
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
                      Start with Zora so we can recover your creator identity and map your canonical smart wallet with fewer retries.
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
                    <button
                      type="button"
                      disabled={busyProvider === 'zora_cross_app'}
                      onClick={() => void onRefreshZora()}
                      className="btn-accent btn-no-icon inline-flex"
                    >
                      {busyProvider === 'zora_cross_app' ? 'Refreshing...' : 'Refresh Zora signals'}
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={busyProvider === 'zora_cross_app'}
                      onClick={() => void onLinkZora()}
                      className="btn-accent btn-no-icon inline-flex"
                    >
                      {busyProvider === 'zora_cross_app' ? 'Linking...' : 'Link Zora'}
                    </button>
                  )}
                  <a
                    href={zoraHandoffUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-secondary btn-no-icon inline-flex"
                  >
                    Open Zora
                  </a>
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
                    <a
                      href={baseAppUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="btn-secondary btn-no-icon inline-flex"
                    >
                      Open Base app
                    </a>
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
                    <div className="text-base font-medium text-white">Enable 4626 signing on that wallet</div>
                    <p className="text-sm leading-relaxed text-zinc-400">
                      This adds the 4626 embedded owner to your existing CSW. Your wallet stays primary while 4626 receives signing permission.
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
                    This step was resumed from another surface. Connect a current owner of the detected CSW, verify the signer, then approve the Base transaction below.
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
                      <div className="mt-2 text-xs text-zinc-500">Loading current CSW owners...</div>
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
                <div className="mt-4 flex flex-wrap items-start gap-3">
                  {connectedOwnerReady ? (
                    <button
                      type="button"
                      disabled={advancedBusy || !canonicalCswAddress || !ownerApprovalReady}
                      onClick={() => void onEnable4626Signing()}
                      className="btn-primary btn-no-icon inline-flex"
                    >
                      {advancedBusy ? 'Preparing...' : ownerPrimaryCtaLabel}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => connectOwnerWallet()}
                      className="btn-accent btn-no-icon inline-flex"
                    >
                      Connect owner wallet
                    </button>
                  )}
                  {connectedOwnerReady ? (
                    <button
                      type="button"
                      disabled={advancedBusy}
                      onClick={() => connectOwnerWallet()}
                      className="btn-secondary btn-no-icon inline-flex"
                    >
                      Switch owner wallet
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={advancedBusy}
                      onClick={() => void retryOwnerCheck()}
                      className="rounded-lg bg-white/5 px-3 py-2 text-xs text-zinc-300 transition hover:bg-white/10 hover:text-zinc-100"
                    >
                      Retry owner check
                    </button>
                  )}
                  <span className="max-w-xl text-xs leading-relaxed text-zinc-500">
                    {connectedOwnerReady
                      ? 'Server prepares the transaction. A current CSW owner signs on Base, then 4626 refreshes your account automatically.'
                      : 'Connect a current CSW owner first, then approve 4626 signing.'}
                  </span>
                </div>
                {!connectedOwnerReady ? (
                  <div className="mt-3 text-xs text-zinc-500">
                    Privy will open a wallet modal with MetaMask, Coinbase Wallet, detected browser wallets like Rabby, and WalletConnect fallback.
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
