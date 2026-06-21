import { Suspense, lazy, type ReactNode } from 'react'
import { CheckCircle2, Circle, ExternalLink } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/Button'
import { LoadingText } from '@/components/ui/LoadingState'
import { InlineAddressCopyButton } from '@/components/account/CopyableAddress'
import { LinkedIdentitiesSection } from '@/features/accountSetup/LinkedIdentitiesSection'
import { shouldShowParentCswAddOwnerPanel, shouldShowBaseAppConnectPanel } from '@/features/waitlist/waitlistFlowState'
import { useWaitlistSigningStepComplete } from '@/features/waitlist/useWaitlistSigningStepComplete'
import { waitlistSubAccountFlowFlag } from '@/lib/flags/featureFlags'
import { inferWaitlistEoaOwnerRoutingHint } from '@/lib/wallet/userExecutionTrack'
import { shortValue } from './shared'
import type { useAccountSetupController } from './useAccountSetupController'

type Controller = ReturnType<typeof useAccountSetupController>

const LazyZoraAddOwnerSigningPanel = lazy(async () => {
  const mod = await import('@/features/accountSetup/ZoraAddOwnerSigningPanel')
  return { default: mod.ZoraAddOwnerSigningPanel }
})

const LazyWaitlistConnectBaseApp = lazy(async () => {
  const mod = await import('@/features/waitlist/WaitlistConnectBaseApp')
  return { default: mod.WaitlistConnectBaseApp }
})

function StatusRow({
  label,
  detail,
  complete,
  action,
}: {
  label: string
  detail: string
  complete: boolean
  action?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-3">
      <div className="flex min-w-0 items-start gap-2.5">
        {complete ? (
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" aria-hidden />
        ) : (
          <Circle className="mt-0.5 h-4 w-4 shrink-0 text-zinc-600" aria-hidden />
        )}
        <div className="min-w-0">
          <div className="text-sm text-zinc-100">{label}</div>
          <div className="mt-0.5 text-xs text-zinc-500">{detail}</div>
        </div>
      </div>
      {action ? <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div> : null}
    </div>
  )
}

export function AccountsManagementPanel(props: {
  controller: Controller
  summaryActions?: ReactNode
}) {
  const { controller, summaryActions } = props
  const {
    advancedBusy,
    baseAppUrl,
    busyProvider,
    canonicalCswAddress,
    connectedOwnerReady,
    connectOwnerWallet,
    cswOwnersState,
    error,
    inTelegramMiniApp,
    loadMe,
    me,
    needsBaseAppSetup,
    onLinkZora,
    onRefreshZora,
    onResetOwnerApproval,
    ownerAuthorityState,
    ownerInstallResumeState,
    ownerPrimaryCtaLabel,
    onchainEoaOwnerCandidates,
    readableCswOwners,
    zoraLinked,
  } = controller

  const ownerInstallPathActive = Boolean(me && ownerInstallResumeState.requested)
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

  if (!me) return null

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

  const zoraHandle = me.accountSignals.zoraHandle?.trim()
  const zoraLabel = zoraHandle ? `@${zoraHandle.replace(/^[@$]/, '')}` : null

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

      {ownerInstallResumeState.requested ? (
        <div className="rounded-2xl border border-brand-primary/20 bg-brand-primary/10 px-4 py-4 text-sm text-brand-50">
          <div className="text-[11px] uppercase tracking-[0.16em] text-brand-200">
            {ownerInstallResumeState.source === 'telegram' ? 'Continue from Telegram' : 'Signing setup'}
          </div>
          <p className="mt-2 text-sm text-zinc-200">
            Finish enabling 4626 signing on your parent smart wallet, or trade at{' '}
            <Link to="/swap" className="underline underline-offset-2">
              /swap
            </Link>{' '}
            with an external wallet.
          </p>
        </div>
      ) : null}

      {inTelegramMiniApp ? (
        <div className="rounded-xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          Wallet-owner actions are more reliable in an external browser.{' '}
          <a href="/accounts" target="_blank" rel="noreferrer" className="underline underline-offset-2">
            Open Accounts in browser
          </a>
        </div>
      ) : null}

      <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 space-y-5">
        <div className="space-y-1">
          <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Account management</div>
          <h2 className="text-xl font-semibold tracking-tight text-white">Setup &amp; recovery</h2>
          <p className="text-sm text-zinc-400">
            Finish anything still pending, link extra identities, and manage CSW owner signing. Primary identity
            details live above.
          </p>
        </div>

        <div className="space-y-2">
          <StatusRow
            label="Zora linked"
            detail={
              zoraLinked
                ? zoraLabel
                  ? `${zoraLabel} connected`
                  : 'Creator identity connected'
                : 'Link Zora to recover your creator profile and CSW'
            }
            complete={zoraLinked}
            action={
              zoraLinked ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={busyProvider === 'zora_cross_app'}
                  onClick={() => void onRefreshZora()}
                >
                  {busyProvider === 'zora_cross_app' ? 'Refreshing…' : 'Refresh'}
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  disabled={busyProvider === 'zora_cross_app'}
                  onClick={() => void onLinkZora()}
                >
                  {busyProvider === 'zora_cross_app' ? 'Connecting…' : 'Connect Zora'}
                </Button>
              )
            }
          />

          <StatusRow
            label="Canonical smart wallet"
            detail={
              canonicalCswAddress
                ? 'Parent CSW detected for this profile'
                : needsBaseAppSetup
                  ? 'Finish CSW setup in Base app, then return here'
                  : 'Waiting for CSW signals after Zora link'
            }
            complete={Boolean(canonicalCswAddress)}
            action={
              canonicalCswAddress ? (
                <div className="flex items-center gap-1 font-mono text-xs text-zinc-300">
                  <span>{shortValue(canonicalCswAddress)}</span>
                  <InlineAddressCopyButton address={canonicalCswAddress} />
                </div>
              ) : needsBaseAppSetup && baseAppUrl ? (
                <Button variant="secondary" size="sm" asChild>
                  <a href={baseAppUrl} target="_blank" rel="noreferrer">
                    Open Base app
                  </a>
                </Button>
              ) : null
            }
          />

          <StatusRow
            label="4626 signing"
            detail={
              signingStepComplete
                ? 'Embedded signer confirmed on your parent CSW'
                : 'Required for sponsored swaps from your canonical wallet'
            }
            complete={signingStepComplete}
            action={
              !signingStepComplete ? (
                <Button variant="secondary" size="sm" asChild>
                  <Link to="/waitlist?setup=owner-install">Open signing setup</Link>
                </Button>
              ) : null
            }
          />
        </div>
      </section>

      {!signingStepComplete && canonicalCswAddress ? (
        <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 space-y-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Signing setup</div>
            <h3 className="mt-1 text-lg font-medium text-white">Enable 4626 signing</h3>
            <p className="mt-1 text-sm text-zinc-400">
              Connect a current CSW owner and approve your Privy embedded signer, or use Base App when that path is
              available.
            </p>
          </div>

          <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-xs text-zinc-300">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-zinc-500">Owner authority</span>
              <span>{ownerAuthorityState.hint}</span>
              <span className={`rounded-full px-2 py-0.5 text-[10px] ${ownerAuthorityState.badgeClass}`}>
                {ownerAuthorityState.label}
              </span>
            </div>
          </div>

          {showBaseAppConnectPanel ? (
            <Suspense
              fallback={
                <div className="text-xs text-zinc-500">
                  <LoadingText intent="processing" size="sm" labelOverride="Loading Base App setup..." />
                </div>
              }
            >
              <LazyWaitlistConnectBaseApp
                onSkip={() => undefined}
                onComplete={() => {
                  void loadMe()
                  void refreshParentEmbeddedOwner()
                }}
                parentAddress={canonicalCswAddress}
                subAccountAddress={me.accountSignals.baseSubAccount?.address ?? me.baseSubAccount ?? null}
                embeddedEoaAddress={embeddedEoaAddress ?? null}
              />
            </Suspense>
          ) : showParentCswAddOwnerPanel ? (
            <Suspense
              fallback={
                <div className="text-xs text-zinc-500">
                  <LoadingText intent="processing" size="sm" labelOverride="Loading signing setup..." />
                </div>
              }
            >
              <LazyZoraAddOwnerSigningPanel
                controller={controller}
                onOwnerInstallSuccess={() => refreshParentEmbeddedOwner()}
              />
            </Suspense>
          ) : (
            <p className="text-xs leading-relaxed text-zinc-500">
              In-app owner setup is paused in this build. You can still trade at{' '}
              <Link to="/swap" className="text-zinc-300 underline underline-offset-2">
                /swap
              </Link>{' '}
              with an external wallet (EOA mode).
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            {!connectedOwnerReady ? (
              <Button type="button" variant="primary" onClick={() => connectOwnerWallet()}>
                Connect owner wallet
              </Button>
            ) : (
              <>
                <Button type="button" variant="secondary" disabled={advancedBusy} onClick={() => connectOwnerWallet()}>
                  Switch owner wallet
                </Button>
                <button
                  type="button"
                  disabled={advancedBusy || busyProvider === 'owner_wallet'}
                  onClick={() => void onResetOwnerApproval()}
                  className="rounded-lg border border-white/10 px-3 py-2 text-xs text-zinc-400 hover:text-zinc-200"
                >
                  Retry owner check
                </button>
              </>
            )}
            <span className="text-xs text-zinc-600">{ownerPrimaryCtaLabel}</span>
          </div>
        </section>
      ) : null}

      {canonicalCswAddress ? (
        <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 space-y-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">CSW owners</div>
            <h3 className="mt-1 text-lg font-medium text-white">On-chain owner slots</h3>
            <p className="mt-1 text-sm text-zinc-400">
              Wallets authorized to sign for your canonical Coinbase Smart Wallet.
            </p>
          </div>

          {cswOwnersState.status === 'loading' ? (
            <LoadingText intent="processing" size="sm" labelOverride="Loading owners…" />
          ) : null}
          {cswOwnersState.status === 'error' ? (
            <p className="text-xs text-rose-300">{cswOwnersState.error ?? 'Failed to load owner list.'}</p>
          ) : null}
          {readableCswOwners.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {readableCswOwners.map((owner) => {
                const isConnectedOwner =
                  Boolean(owner.ownerAddress && controller.ownerSignerAddress) &&
                  owner.ownerAddress!.toLowerCase() === controller.ownerSignerAddress!.toLowerCase()
                return (
                  <span
                    key={`${owner.index}:${owner.ownerAddress}`}
                    className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-[11px] ${
                      isConnectedOwner ? 'bg-emerald-500/15 text-emerald-200' : 'bg-white/5 text-zinc-300'
                    }`}
                  >
                    <span className="font-mono">{shortValue(owner.ownerAddress)}</span>
                    {isConnectedOwner ? <span>Connected</span> : null}
                  </span>
                )
              })}
            </div>
          ) : cswOwnersState.status === 'ready' ? (
            <p className="text-xs text-zinc-500">No readable EOA owners were returned for this CSW.</p>
          ) : null}

          {canonicalCswAddress ? (
            <a
              href={`https://basescan.org/address/${canonicalCswAddress}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300"
            >
              View CSW on Basescan <ExternalLink className="h-3 w-3" />
            </a>
          ) : null}
        </section>
      ) : null}

      {controller.canShowAdvanced ? (
        <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
          <LinkedIdentitiesSection controller={controller} />
        </section>
      ) : null}

      <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 space-y-4">
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Account</div>
          <h3 className="mt-1 text-lg font-medium text-white">Profile summary</h3>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-3">
            <div className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">Email</div>
            <div className="mt-1 truncate text-sm text-zinc-100">{me.email ?? 'Not linked'}</div>
            <div className="mt-1 text-xs text-zinc-500">
              {me.emailVerified ? 'Verified' : 'Needs verification'}
            </div>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-3">
            <div className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">Points</div>
            <div className="mt-1 text-2xl font-semibold text-zinc-100">{me.score.points}</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-3">
            <div className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">Tier</div>
            <div className="mt-1 text-2xl font-semibold text-zinc-100">{me.score.tier}</div>
          </div>
        </div>
        {summaryActions ? <div className="flex flex-wrap items-center gap-2 pt-1">{summaryActions}</div> : null}
        <p className="text-xs text-zinc-600">
          Need the full onboarding flow? Continue at{' '}
          <Link to="/waitlist" className="text-zinc-400 underline underline-offset-2 hover:text-zinc-200">
            /waitlist
          </Link>
          .
        </p>
      </section>
    </div>
  )
}
