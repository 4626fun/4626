import type { ReactNode } from 'react'
import { CheckCircle2 } from 'lucide-react'

import { WalletProviderIcon } from '@/components/ui/WalletProviderIcon'
import { shortValue } from './shared'
import type { useAccountSetupController } from './useAccountSetupController'

type AccountSetupWorkspaceController = ReturnType<typeof useAccountSetupController>

export function AccountSetupWorkspaceView(props: {
  context: 'accounts' | 'waitlist'
  controller: AccountSetupWorkspaceController
  summaryActions?: ReactNode
}) {
  const { context, controller, summaryActions } = props
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
  const activeStep = !zoraStepComplete ? 1 : !walletStepComplete ? 2 : 3
  const completedSteps = [zoraStepComplete, walletStepComplete, signingStepComplete].filter(Boolean).length

  if (context === 'waitlist') {
    const progressPct = Math.min(100, (completedSteps / 3) * 100)
    const zoraStatus = zoraStepComplete ? 'completed' : activeStep === 1 ? 'current' : 'upcoming'
    const walletStatus = walletStepComplete ? 'completed' : activeStep === 2 ? 'current' : 'upcoming'
    const signingStatus = signingStepComplete ? 'completed' : activeStep === 3 ? 'current' : 'upcoming'

    // card style per step state
    const cardClassForStatus = (status: 'completed' | 'current' | 'upcoming') => {
      if (status === 'current')
        return 'bv-panel shadow-[0_0_40px_rgba(0,82,255,0.18)] ring-1 ring-brand-primary/40 p-5'
      if (status === 'completed')
        return 'bv-subpanel ring-1 ring-emerald-400/25 shadow-[0_0_20px_rgba(16,185,129,0.08)] p-4'
      return 'bv-subpanel opacity-80 p-4'
    }

    // kicker color per step state
    const kickerToneClass = (status: 'completed' | 'current' | 'upcoming') => {
      if (status === 'current') return 'text-brand-300'
      if (status === 'completed') return 'text-emerald-400'
      return 'text-zinc-600'
    }

    // status badge per step state
    const badgeClass = (status: 'completed' | 'current' | 'upcoming') => {
      if (status === 'completed') return 'bv-chip !border-emerald-400/30 !bg-emerald-500/10 !text-emerald-300'
      if (status === 'current') return 'bv-chip !border-brand-primary/30 !bg-brand-primary/10 !text-brand-200'
      return 'bv-chip'
    }

    const primarySigningLabel = connectedOwnerReady ? 'Approve signing access' : 'Connect owner wallet'

    return (
      <div className="mx-auto w-full max-w-[720px] space-y-5">
        {/* system messages */}
        {error ? (
          <div
            role="alert"
            aria-live="assertive"
            className="bv-subpanel px-4 py-3 text-sm text-rose-300 ring-1 ring-rose-500/30"
          >
            {error}
          </div>
        ) : null}
        {notice ? (
          <div
            role="status"
            aria-live="polite"
            className="bv-subpanel px-4 py-3 text-sm text-emerald-300 ring-1 ring-emerald-500/30"
          >
            {notice}
          </div>
        ) : null}

        {/* page header */}
        <div className="space-y-1 text-center">
          <p className="bv-kicker">3-step setup</p>
          <h2 className="text-4xl font-light tracking-tight text-white">Finish Setup</h2>
          <p className="text-sm text-zinc-400">Complete these 3 steps to activate your wallet</p>
        </div>

        {/* progress bar — inline, no wrapper container */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="bv-kicker">Progress</span>
            <span className="bv-kicker text-zinc-300">Step {activeStep} of 3</span>
          </div>
          <div className="h-1 overflow-hidden rounded-full bg-white/8">
            <div
              className="h-full rounded-full bg-[linear-gradient(90deg,#1d4ed8_0%,#60a5fa_100%)] transition-all duration-500"
              style={{ width: `${Math.max(progressPct, activeStep === 1 ? 18 : 0)}%` }}
            />
          </div>
        </div>

        {/* step cards */}
        <div className="space-y-2.5">

          {/* Step 1 — Zora */}
          <section className={`rounded-2xl transition-all duration-300 ${cardClassForStatus(zoraStatus)}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className={zoraStatus === 'completed' ? 'space-y-1' : 'space-y-2'}>
                <p className={`bv-kicker ${kickerToneClass(zoraStatus)}`}>Step 1</p>
                <div className="flex items-center gap-2.5">
                  <img
                    src="/brands/zora-token.svg"
                    alt=""
                    aria-hidden="true"
                    className="h-6 w-6 shrink-0 rounded-full object-cover"
                  />
                  <h3 className="text-lg font-medium text-white">Link your Zora identity</h3>
                </div>
                <p className={`text-sm text-zinc-400 ${zoraStatus === 'completed' ? 'line-clamp-1' : ''}`}>
                  Connect your Zora account so we can verify your creator identity.
                </p>
              </div>
              <span className={badgeClass(zoraStatus)}>
                {zoraStepComplete ? <CheckCircle2 className="h-3 w-3" /> : null}
                {zoraStepComplete ? 'Connected' : zoraStatus === 'current' ? 'Current' : 'Upcoming'}
              </span>
            </div>
            {zoraStatus === 'current' ? (
              <div className="mt-4">
                <button
                  type="button"
                  disabled={busyProvider === 'zora_cross_app'}
                  onClick={() => void onLinkZora()}
                  className="btn-accent btn-no-icon inline-flex"
                >
                  {busyProvider === 'zora_cross_app' ? 'Connecting…' : 'Connect Zora'}
                </button>
              </div>
            ) : null}
          </section>

          {/* Step 2 — Coinbase Smart Wallet */}
          <section className={`rounded-2xl transition-all duration-300 ${cardClassForStatus(walletStatus)}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className={walletStatus === 'completed' ? 'space-y-1' : 'space-y-2'}>
                <p className={`bv-kicker ${kickerToneClass(walletStatus)}`}>Step 2</p>
                <div className="flex items-center gap-2.5">
                  <WalletProviderIcon provider="coinbase" size={24} />
                  <h3 className="text-lg font-medium text-white">Detect your Coinbase Smart Wallet</h3>
                </div>
                <p className={`text-sm text-zinc-400 ${walletStatus === 'completed' ? 'line-clamp-1' : ''}`}>
                  Confirm the wallet connected to your account.
                </p>
              </div>
              <span className={badgeClass(walletStatus)}>
                {walletStepComplete ? <CheckCircle2 className="h-3 w-3" /> : null}
                {walletStepComplete ? 'Wallet detected' : walletStatus === 'current' ? 'Current' : 'Upcoming'}
              </span>
            </div>

            {walletStepComplete || walletStatus === 'current' ? (
              <div className="mt-3 inline-flex items-center gap-2 rounded-lg bg-black/30 px-3 py-2 text-xs text-zinc-300 ring-1 ring-white/8">
                <WalletProviderIcon provider="coinbase" size={14} />
                <span className="text-zinc-500">Wallet</span>
                <span className="font-mono text-zinc-100">{shortValue(canonicalCswAddress)}</span>
              </div>
            ) : null}

            {walletStatus === 'current' ? (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={busyProvider === 'zora_cross_app'}
                  onClick={() => void onRefreshZora()}
                  className="btn-secondary btn-no-icon inline-flex"
                >
                  {busyProvider === 'zora_cross_app' ? 'Checking…' : 'Retry detection'}
                </button>
                {needsBaseAppSetup && baseAppUrl ? (
                  <a href={baseAppUrl} target="_blank" rel="noreferrer" className="btn-secondary btn-no-icon inline-flex">
                    Open Base app
                  </a>
                ) : null}
              </div>
            ) : null}
          </section>

          {/* Step 3 — Enable signing */}
          <section className={`rounded-2xl transition-all duration-300 ${cardClassForStatus(signingStatus)}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className={signingStatus === 'completed' ? 'space-y-1' : 'space-y-2'}>
                <p className={`bv-kicker ${kickerToneClass(signingStatus)}`}>Step 3</p>
                <h3 className="text-lg font-medium text-white">Enable 4626 signing</h3>
                <p className={`text-sm text-zinc-400 ${signingStatus === 'completed' ? 'line-clamp-1' : ''}`}>
                  Connect an owner wallet and approve signing access.
                </p>
              </div>
              <span className={badgeClass(signingStatus)}>
                {signingStepComplete ? <CheckCircle2 className="h-3 w-3" /> : null}
                {signingStepComplete ? 'Completed' : signingStatus === 'current' ? 'Current' : 'Upcoming'}
              </span>
            </div>

            {signingStatus === 'current' ? (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={advancedBusy || needsEmbeddedWallet}
                  onClick={() => (connectedOwnerReady ? void onEnable4626Signing() : connectOwnerWallet())}
                  className="btn-primary btn-no-icon inline-flex"
                >
                  {advancedBusy ? 'Working…' : primarySigningLabel}
                </button>
                <button
                  type="button"
                  disabled={advancedBusy}
                  onClick={() => void retryOwnerCheck()}
                  className="btn-secondary btn-no-icon inline-flex"
                >
                  Retry
                </button>
              </div>
            ) : null}

            {connectedSignerLabel && signingStatus === 'current' ? (
              <p className="mt-3 text-xs text-zinc-500">
                Connected signer: <span className="font-mono text-zinc-300">{connectedSignerLabel}</span>
              </p>
            ) : null}
            {connectedSignerDetail && signingStatus === 'current' ? (
              <p className="mt-1 text-xs text-zinc-500">{connectedSignerDetail}</p>
            ) : null}
            {needsEmbeddedWallet && signingStatus === 'current' ? (
              <p className="mt-2 text-xs text-amber-300">Embedded wallet provisioning is still settling. Retry in a moment.</p>
            ) : null}
            {inTelegramMiniApp && signingStatus === 'current' ? (
              <p className="mt-2 text-xs text-amber-300">
                Owner signatures are more reliable in an external browser tab.
              </p>
            ) : null}
            {providerCollision.shouldDisableInjectedConnector && signingStatus === 'current' ? (
              <p className="mt-2 text-xs text-zinc-500">
                Browser wallet collision detected. Coinbase/Base wallet is the most reliable option here.
              </p>
            ) : null}
          </section>
        </div>

        {/* Enter App / summary actions */}
        {summaryActions ? <div className="pt-1">{summaryActions}</div> : null}
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
