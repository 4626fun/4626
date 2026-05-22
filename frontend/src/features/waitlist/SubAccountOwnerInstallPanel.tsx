import { useCallback, useEffect, useMemo, useState } from 'react'
import { CheckCircle2, ChevronDown } from 'lucide-react'
import { getAddress, isAddress, type Address } from 'viem'

import { Button } from '@/components/ui/Button'
import { PixelWaveLoader } from '@/components/ui/PixelWaveLoader'
import { useSubAccountSetup, type SubAccountSetupControls } from '@/hooks/useSubAccountSetup'
import { waitlistSubAccountFlowFlag } from '@/lib/flags/featureFlags'
import { buildWaitlistSetupUrl } from '@/lib/auth/waitlistEntry'
import { usePrivyClientStatus } from '@/lib/privy/client'
import { detectInAppEnvironment } from '@/lib/wallet/inAppBrowser'
import { readEmbeddedOwnerOnSubAccount } from '@/lib/wallet/subAccountOwnerInstall'

import { SubAccountOwnerInstallRecovery } from './SubAccountOwnerInstallRecovery'
import {
  mapSubAccountOwnerInstallError,
  SUB_ACCOUNT_IN_BASE_APP_HINT,
  SUB_ACCOUNT_WRONG_BROWSER_MESSAGE,
} from './subAccountOwnerInstallMessages'

export type SubAccountOwnerInstallSetup = Pick<
  SubAccountSetupControls,
  'installSubAccountOwnerOnly' | 'embeddedWallet' | 'isSettingUp' | 'getLastSetupError' | 'lastStage'
>

type SubAccountOwnerInstallPanelProps = {
  parentAddress: string | null | undefined
  subAccountAddress: string | null | undefined
  embeddedEoaAddress?: string | null | undefined
  className?: string
  /** `recovery` — step content when sub-account exists. `inline` — one-line follow-up under connect. */
  variant?: 'recovery' | 'inline'
  /** When false, skip the local headline (parent screen already sets context). */
  showHeader?: boolean
  /** Reuse an existing setup hook instance from a parent surface (avoids duplicate Privy wallet hooks). */
  setup?: SubAccountOwnerInstallSetup
  onSuccess?: () => void
}

type OwnerCheckState = 'idle' | 'checking' | 'needs_install' | 'already_owner'

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
    variant = 'recovery',
    showHeader = variant === 'inline',
    onSuccess,
    setup,
  } = props
  const subAccountFlowEnabled = waitlistSubAccountFlowFlag()
  const parent = normalizeAddress(parentAddress)
  const subAccount = normalizeAddress(subAccountAddress)
  const embeddedFromProps = normalizeAddress(embeddedEoaAddress)

  const { installSubAccountOwnerOnly, embeddedWallet, isSettingUp, getLastSetupError, lastStage } = setup

  const embeddedEoa = embeddedFromProps ?? normalizeAddress(embeddedWallet?.address)

  const [ownerCheck, setOwnerCheck] = useState<OwnerCheckState>('idle')
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionSuccess, setActionSuccess] = useState(false)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [showRecovery, setShowRecovery] = useState(false)
  const [recheckBusy, setRecheckBusy] = useState(false)

  const inAppEnv = useMemo(() => detectInAppEnvironment(), [])
  const inBaseApp = Boolean(inAppEnv?.isBaseAppInApp)
  const needsBaseAppHost = Boolean(inAppEnv && !inBaseApp)

  const canRender = subAccountFlowEnabled && Boolean(parent && subAccount && embeddedEoa)
  const isInline = variant === 'inline'
  const baseAppSetupUrl = buildWaitlistSetupUrl('base-app')

  const refreshOwnerCheck = useCallback(async () => {
    if (!subAccount || !embeddedEoa) {
      setOwnerCheck('idle')
      return
    }
    setOwnerCheck('checking')
    const isOwner = await readEmbeddedOwnerOnSubAccount({
      subAccountAddress: subAccount,
      embeddedEoaAddress: embeddedEoa,
    })
    if (isOwner === true) {
      setOwnerCheck('already_owner')
      return
    }
    if (isOwner === false) {
      setOwnerCheck('needs_install')
      return
    }
    setOwnerCheck('needs_install')
  }, [embeddedEoa, subAccount])

  useEffect(() => {
    if (!canRender) {
      setOwnerCheck('idle')
      return
    }
    void refreshOwnerCheck()
  }, [canRender, refreshOwnerCheck])

  const progressLabel = useMemo(() => {
    if (lastStage?.stage === 'install_embedded_owner') {
      return 'Waiting for Base App approval…'
    }
    if (lastStage?.stage === 'configure_signer') {
      return 'Linking your 4626 signer…'
    }
    return 'Enabling signing on your app wallet…'
  }, [lastStage?.stage])

  const handleInstall = useCallback(async () => {
    if (!parent || !subAccount || needsBaseAppHost) return
    setActionError(null)
    setActionSuccess(false)

    const result = await installSubAccountOwnerOnly({
      parentAddress: parent,
      subAccountAddress: subAccount,
    })
    if (!result) {
      const message = mapSubAccountOwnerInstallError(
        getLastSetupError()?.message ?? 'Could not enable signing on your app wallet.',
        { inBaseApp },
      )
      setActionError(message)
      setShowRecovery(true)
      return
    }

    setActionSuccess(true)
    setShowRecovery(false)
    await refreshOwnerCheck()
    onSuccess?.()
  }, [
    getLastSetupError,
    inBaseApp,
    installSubAccountOwnerOnly,
    needsBaseAppHost,
    onSuccess,
    parent,
    refreshOwnerCheck,
    subAccount,
  ])

  const handleRecheck = useCallback(async () => {
    setActionError(null)
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

  if (ownerCheck === 'already_owner' || actionSuccess) {
    return (
      <div
        className={`flex items-start gap-2.5 text-left ${className}`}
        data-testid="sub-account-owner-install-complete"
      >
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400/90" aria-hidden />
        <div>
          <p className="text-sm text-zinc-200">4626 signing is enabled</p>
          <p className="mt-1 text-xs leading-relaxed text-zinc-400">
            Your embedded key can sign for the app wallet.
          </p>
        </div>
      </div>
    )
  }

  const primaryLabel = isSettingUp ? progressLabel : 'Enable 4626 signing'
  const recoveryVisible = showRecovery || Boolean(actionError) || needsBaseAppHost

  const primaryAction = needsBaseAppHost ? (
    <Button type="button" variant="primary" className="w-full" asChild data-testid="sub-account-open-base-app-button">
      <a href={baseAppSetupUrl}>Open setup in Base App</a>
    </Button>
  ) : isSettingUp ? (
    <div className="flex items-center gap-2 text-sm text-zinc-400" role="status" aria-live="polite">
      <PixelWaveLoader name="wave-lr" size={14} color="rgba(255,255,255,0.85)" />
      <span>{progressLabel}</span>
    </div>
  ) : (
    <Button
      type="button"
      variant="primary"
      className="w-full"
      onClick={() => void handleInstall()}
      data-testid="sub-account-owner-install-button"
    >
      {primaryLabel}
    </Button>
  )

  const contextHint = needsBaseAppHost ? (
    <p className="text-xs leading-relaxed text-amber-200/90" role="status">
      {SUB_ACCOUNT_WRONG_BROWSER_MESSAGE}
    </p>
  ) : (
    <p className="text-xs leading-relaxed text-zinc-400">{SUB_ACCOUNT_IN_BASE_APP_HINT}</p>
  )

  const errorBlock =
    actionError && !needsBaseAppHost ? (
      <p className="text-xs leading-relaxed text-rose-300/90" role="alert">
        {actionError}
      </p>
    ) : null

  const recoveryBlock = recoveryVisible ? (
    <SubAccountOwnerInstallRecovery
      inBaseApp={inBaseApp}
      onRecheck={() => void handleRecheck()}
      recheckBusy={recheckBusy}
    />
  ) : null

  if (isInline) {
    return (
      <div className={`space-y-3 text-left ${className}`} data-testid="sub-account-owner-install-panel">
        <p className="text-xs leading-relaxed text-zinc-400">
          App wallet linked — one Base App approval adds your embedded key as owner.
        </p>
        {contextHint}
        {primaryAction}
        {errorBlock}
        {recoveryBlock}
      </div>
    )
  }

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
      {primaryAction}
      {errorBlock}
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
            We call <span className="font-mono text-zinc-400">addOwnerAddress</span> on your app wallet so your Privy
            embedded key can co-sign. Your main smart wallet is not modified.
          </p>
        ) : null}
      </div>
    </section>
  )
}
