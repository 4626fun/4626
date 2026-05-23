import { useCallback, useMemo, useState } from 'react'
import { CheckCircle2, ChevronDown } from 'lucide-react'
import { getAddress, isAddress, type Address } from 'viem'

import { Button } from '@/components/ui/Button'
import { PixelWaveLoader } from '@/components/ui/PixelWaveLoader'
import { AddOwnerActionPanel } from '@/features/accountSetup/addOwner/AddOwnerActionPanel'
import { useAddOwnerFlow } from '@/features/accountSetup/addOwner/useAddOwnerFlow'
import { useSubAccountSetup, type SubAccountSetupControls } from '@/hooks/useSubAccountSetup'
import { waitlistSubAccountFlowFlag } from '@/lib/flags/featureFlags'
import { buildWaitlistSetupUrl } from '@/lib/auth/waitlistEntry'
import { usePrivyClientStatus } from '@/lib/privy/client'
import { isBaseAppInAppContext } from '@/lib/wallet/inAppBrowser'
import { SubAccountOwnerInstallRecovery } from './SubAccountOwnerInstallRecovery'
import {
  SUB_ACCOUNT_IN_BASE_APP_HINT,
  SUB_ACCOUNT_SIGNER_LINKED_ONCHAIN_OWNER_PENDING_MESSAGE,
  SUB_ACCOUNT_WRONG_BROWSER_MESSAGE,
} from './subAccountOwnerInstallMessages'
import { useEmbeddedOwnerOnSubAccount } from './useEmbeddedOwnerOnSubAccount'

export type SubAccountOwnerInstallSetup = Pick<SubAccountSetupControls, 'embeddedWallet'>

type SubAccountOwnerInstallPanelProps = {
  parentAddress: string | null | undefined
  subAccountAddress: string | null | undefined
  embeddedEoaAddress?: string | null | undefined
  className?: string
  /** When false, skip the local headline (parent screen already sets context). */
  showHeader?: boolean
  /** Reuse an existing setup hook instance from a parent surface (avoids duplicate Privy wallet hooks). */
  setup?: SubAccountOwnerInstallSetup
  /** Server saved parent/sub-account link; does not imply on-chain owner or swap readiness. */
  linkRegistered?: boolean
  onSuccess?: () => void
}

function normalizeAddress(value: string | null | undefined): Address | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!isAddress(trimmed)) return null
  return getAddress(trimmed)
}

function shortAddr(address: Address): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}

type FlowStepProps = {
  label: string
  detail: string
  address?: Address | null
  active?: boolean
  done?: boolean
}

function FlowStep(props: FlowStepProps) {
  const { label, detail, address, active, done } = props
  return (
    <li className="relative pl-5">
      <span
        className={`absolute left-0 top-[0.45rem] h-1.5 w-1.5 rounded-full ${
          done ? 'bg-emerald-400/80' : active ? 'bg-brand-primary' : 'bg-zinc-600'
        }`}
        aria-hidden
      />
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className={`text-sm ${active ? 'font-medium text-white' : 'text-zinc-300'}`}>{label}</span>
        {address ? (
          <span className="font-mono text-[11px] text-zinc-400" title={address}>
            {shortAddr(address)}
          </span>
        ) : null}
      </div>
      <p className="mt-0.5 text-xs leading-relaxed text-zinc-400">{detail}</p>
    </li>
  )
}

export function SubAccountOwnerInstallPanel(props: SubAccountOwnerInstallPanelProps) {
  const privyClientStatus = usePrivyClientStatus()
  if (privyClientStatus !== 'ready') {
    return (
      <div className={`flex items-center gap-2 text-sm text-zinc-400 ${props.className ?? ''}`} role="status">
        <PixelWaveLoader name="wave-lr" size={12} color="rgba(255,255,255,0.55)" />
        <span>Preparing wallet session…</span>
      </div>
    )
  }

  if (props.setup) {
    return <SubAccountOwnerInstallPanelContent {...props} setup={props.setup} />
  }

  return <SubAccountOwnerInstallPanelWithSetup {...props} />
}

function SubAccountOwnerInstallPanelWithSetup(props: SubAccountOwnerInstallPanelProps) {
  const setup = useSubAccountSetup()
  return <SubAccountOwnerInstallPanelContent {...props} setup={setup} />
}

function SubAccountOwnerInstallPanelContent(
  props: SubAccountOwnerInstallPanelProps & { setup: SubAccountOwnerInstallSetup },
) {
  const {
    parentAddress,
    subAccountAddress,
    embeddedEoaAddress,
    className = '',
    showHeader = false,
    linkRegistered = false,
    onSuccess,
    setup,
  } = props
  const subAccountFlowEnabled = waitlistSubAccountFlowFlag()
  const parent = normalizeAddress(parentAddress)
  const subAccount = normalizeAddress(subAccountAddress)
  const embeddedFromProps = normalizeAddress(embeddedEoaAddress)

  const { embeddedWallet } = setup

  const embeddedEoa = embeddedFromProps ?? normalizeAddress(embeddedWallet?.address)

  const [detailsOpen, setDetailsOpen] = useState(false)
  const [recheckBusy, setRecheckBusy] = useState(false)
  const [baseAppLinkCopyState, setBaseAppLinkCopyState] = useState<'idle' | 'copied' | 'failed'>('idle')

  const inBaseApp = useMemo(() => isBaseAppInAppContext(), [])
  const needsBaseAppHost = !inBaseApp

  const canRender = subAccountFlowEnabled && Boolean(parent && subAccount && embeddedEoa)
  const baseAppSetupUrl = buildWaitlistSetupUrl('base-app')

  const {
    status: ownerCheck,
    refresh: refreshOwnerCheck,
    isOwner: embeddedOwnerOnSubAccount,
  } = useEmbeddedOwnerOnSubAccount({
    subAccountAddress: subAccount,
    embeddedEoaAddress: embeddedEoa,
    enabled: canRender,
  })

  const relayOwnerFlow = useAddOwnerFlow({
    canonicalCswAddress: parent,
    targetCswAddress: subAccount,
    relayFundingCswAddress: parent,
    ownerSignerAddress: parent,
    enabled: canRender && inBaseApp && !embeddedOwnerOnSubAccount,
  })

  const handleRelaySubmit = useCallback(async () => {
    const ok = await relayOwnerFlow.handleAdd()
    if (!ok) return
    await refreshOwnerCheck()
    onSuccess?.()
  }, [onSuccess, refreshOwnerCheck, relayOwnerFlow])

  const handleRecheck = useCallback(async () => {
    setRecheckBusy(true)
    try {
      await refreshOwnerCheck()
    } finally {
      setRecheckBusy(false)
    }
  }, [refreshOwnerCheck])

  if (!canRender) return null

  if (ownerCheck === 'checking' || ownerCheck === 'idle') {
    return (
      <div
        className={`flex items-center gap-2 text-sm text-zinc-400 ${className}`}
        data-testid="sub-account-owner-install-checking"
        role="status"
      >
        <PixelWaveLoader name="wave-lr" size={12} color="rgba(255,255,255,0.55)" />
        <span>Checking signing status…</span>
      </div>
    )
  }

  if (embeddedOwnerOnSubAccount) {
    return (
      <div
        className={`flex items-start gap-2.5 text-left ${className}`}
        data-testid="sub-account-owner-install-complete"
      >
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400/90" aria-hidden />
        <div>
          <p className="text-sm text-zinc-200">4626 signing is enabled</p>
          <p className="mt-1 text-xs leading-relaxed text-zinc-400">
            Your embedded key is an on-chain owner of the app wallet.
          </p>
        </div>
      </div>
    )
  }

  if (linkRegistered) {
    return (
      <div className={`space-y-3 ${className}`} data-testid="sub-account-owner-install-pending">
        <div className="rounded-lg border border-amber-400/25 bg-amber-500/10 px-3 py-2.5 text-xs leading-relaxed text-amber-100/90">
          {SUB_ACCOUNT_SIGNER_LINKED_ONCHAIN_OWNER_PENDING_MESSAGE}
        </div>
        {ownerCheck === 'unknown' ? (
          <p className="text-xs leading-relaxed text-zinc-400">
            Your app wallet is not deployed on Base yet. Relay deploys it when you submit — the small
            deposit is paid from your main Base smart wallet.
          </p>
        ) : null}
        {needsBaseAppHost ? (
          <Button
            type="button"
            variant="primary"
            className="w-full"
            data-testid="sub-account-open-base-app-setup-button"
            onClick={() => {
              window.open(baseAppSetupUrl, '_blank', 'noopener,noreferrer')
            }}
          >
            Open Base App setup
          </Button>
        ) : (
          <AddOwnerActionPanel
            previewLoading={relayOwnerFlow.previewLoading}
            preview={relayOwnerFlow.preview}
            busy={relayOwnerFlow.busy}
            isSelfAuthSession={relayOwnerFlow.isSelfAuthSession}
            handleAdd={handleRelaySubmit}
            onBuildPreview={() => void relayOwnerFlow.fetchPreview()}
            onRebuildPreview={() => void relayOwnerFlow.fetchPreview()}
            txHash={relayOwnerFlow.txHash}
            pageNotice={relayOwnerFlow.pageNotice}
            pageError={relayOwnerFlow.pageError}
            lastErrorDetail={relayOwnerFlow.lastErrorDetail}
            eventLog={relayOwnerFlow.eventLog}
          />
        )}
        <SubAccountOwnerInstallRecovery
          inBaseApp={inBaseApp}
          onRecheck={() => void handleRecheck()}
          recheckBusy={recheckBusy}
        />
      </div>
    )
  }

  const relayActionPanel = inBaseApp ? (
    <AddOwnerActionPanel
      previewLoading={relayOwnerFlow.previewLoading}
      preview={relayOwnerFlow.preview}
      busy={relayOwnerFlow.busy}
      isSelfAuthSession={relayOwnerFlow.isSelfAuthSession}
      handleAdd={handleRelaySubmit}
      onBuildPreview={() => void relayOwnerFlow.fetchPreview()}
      onRebuildPreview={() => void relayOwnerFlow.fetchPreview()}
      txHash={relayOwnerFlow.txHash}
      pageNotice={relayOwnerFlow.pageNotice}
      pageError={relayOwnerFlow.pageError}
      lastErrorDetail={relayOwnerFlow.lastErrorDetail}
      eventLog={relayOwnerFlow.eventLog}
    />
  ) : null

  const recoveryVisible = needsBaseAppHost || Boolean(relayOwnerFlow.pageError)

  const primaryAction = needsBaseAppHost ? (
    <div className="space-y-2">
      <Button
        type="button"
        variant="primary"
        className="w-full"
        data-testid="sub-account-copy-base-app-link-button"
        onClick={() => {
          void (async () => {
            try {
              if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(baseAppSetupUrl)
                setBaseAppLinkCopyState('copied')
                return
              }
            } catch {
              // fall through
            }
            setBaseAppLinkCopyState('failed')
          })()
        }}
      >
        Copy Base App setup link
      </Button>
      {baseAppLinkCopyState === 'copied' ? (
        <p className="text-xs leading-relaxed text-emerald-200/90" role="status">
          Copied. Open Base App on your phone, paste this link, then tap Enable 4626 signing.
        </p>
      ) : null}
      {baseAppLinkCopyState === 'failed' ? (
        <p className="text-xs leading-relaxed text-amber-200/90" role="status">
          Copy failed. Use Other ways to finish below, or open{' '}
          <a href={baseAppSetupUrl} className="underline underline-offset-2">
            this link
          </a>{' '}
          inside Base App.
        </p>
      ) : null}
    </div>
  ) : relayActionPanel ? (
    relayActionPanel
  ) : null

  const contextHint = needsBaseAppHost ? (
    <p className="text-xs leading-relaxed text-amber-200/90" role="status">
      {SUB_ACCOUNT_WRONG_BROWSER_MESSAGE}
    </p>
  ) : (
    <p className="text-xs leading-relaxed text-zinc-400">{SUB_ACCOUNT_IN_BASE_APP_HINT}</p>
  )

  const recoveryBlock = recoveryVisible ? (
    <SubAccountOwnerInstallRecovery
      inBaseApp={inBaseApp}
      onRecheck={() => void handleRecheck()}
      recheckBusy={recheckBusy}
    />
  ) : null

  return (
    <section className={`space-y-5 text-left ${className}`} data-testid="sub-account-owner-install-panel">
      {showHeader ? (
        <div className="space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-brand-primary/75">One step left</p>
          <h3 className="text-base font-medium tracking-tight text-white">Enable 4626 signing</h3>
        </div>
      ) : null}

      <ol className="relative space-y-4 border-l border-white/[0.08]">
        <FlowStep label="Main Base wallet" detail="Unchanged — custody stays here" address={parent} done />
        <FlowStep
          label="4626 app wallet"
          detail="Needs your embedded signer for swaps"
          address={subAccount}
          active
        />
        <FlowStep
          label="Embedded 4626 key"
          detail="Becomes co-owner of the app wallet only"
          address={embeddedEoa}
          active
        />
      </ol>

      {contextHint}
      {ownerCheck === 'unknown' && inBaseApp ? (
        <p className="text-xs leading-relaxed text-zinc-400">
          Your app wallet is not deployed on Base yet. Relay deploys it when you submit — the small
          deposit is paid from your main Base smart wallet.
        </p>
      ) : null}
      {primaryAction}
      {recoveryBlock}

      <div>
        <button
          type="button"
          className="inline-flex items-center gap-1 text-xs text-zinc-400 transition-colors hover:text-zinc-400"
          aria-expanded={detailsOpen}
          onClick={() => setDetailsOpen((open) => !open)}
        >
          What happens on-chain?
          <ChevronDown
            className={`h-3 w-3 transition-transform ${detailsOpen ? 'rotate-180' : ''}`}
            aria-hidden
          />
        </button>
        {detailsOpen ? (
          <p className="mt-2 max-w-sm text-[11px] leading-relaxed text-zinc-400">
            We call <span className="font-mono text-zinc-400">addOwnerAddress</span> on your app wallet through Relay:
            build preview, submit the deposit in Base App, then verify on-chain. Your main smart wallet is not modified.
          </p>
        ) : null}
      </div>
    </section>
  )
}
