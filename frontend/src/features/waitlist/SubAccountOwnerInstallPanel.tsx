import { useCallback, useEffect, useMemo, useState } from 'react'
import { CheckCircle2, ChevronDown } from 'lucide-react'
import { getAddress, isAddress, type Address } from 'viem'

import { Button } from '@/components/ui/Button'
import { PixelWaveLoader } from '@/components/ui/PixelWaveLoader'
import { useSubAccountSetup } from '@/hooks/useSubAccountSetup'
import { waitlistSubAccountFlowFlag } from '@/lib/flags/featureFlags'
import { readEmbeddedOwnerOnSubAccount } from '@/lib/wallet/subAccountOwnerInstall'

type SubAccountOwnerInstallPanelProps = {
  parentAddress: string | null | undefined
  subAccountAddress: string | null | undefined
  embeddedEoaAddress?: string | null | undefined
  className?: string
  /** `recovery` — step content when sub-account exists. `inline` — one-line follow-up under connect. */
  variant?: 'recovery' | 'inline'
  /** When false, skip the local headline (parent screen already sets context). */
  showHeader?: boolean
  onSuccess?: () => void
}

type OwnerCheckState = 'idle' | 'checking' | 'needs_install' | 'already_owner'

function normalizeAddress(value: string | null | undefined): Address | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!isAddress(trimmed)) return null
  return getAddress(trimmed)
}

function mapOwnerInstallError(message: string): string {
  const lower = message.toLowerCase()
  if (lower.includes('base account wallet')) {
    return 'Connect Base App first (open this page in Base App), then tap Enable 4626 signing again.'
  }
  if (
    lower.includes('not been authorized by the user') ||
    lower.includes('requested method and/or account has not been authorized')
  ) {
    return 'This request was not approved in Base App. Open 4626 inside Base App (not Safari/Chrome/extensions), tap Enable 4626 signing again, and approve the wallet prompt.'
  }
  if (lower.includes('user rejected') || lower.includes('user denied') || lower.includes('rejected the request')) {
    return 'Signing was canceled in Base App. Tap Enable 4626 signing again and approve the transaction.'
  }
  if (lower.includes('connect base app first')) {
    return message
  }
  return message
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
          <span className="font-mono text-[11px] text-zinc-600" title={address}>
            {shortAddr(address)}
          </span>
        ) : null}
      </div>
      <p className="mt-0.5 text-xs leading-relaxed text-zinc-500">{detail}</p>
    </li>
  )
}

export function SubAccountOwnerInstallPanel(props: SubAccountOwnerInstallPanelProps) {
  const {
    parentAddress,
    subAccountAddress,
    embeddedEoaAddress,
    className = '',
    variant = 'recovery',
    showHeader = variant === 'inline',
    onSuccess,
  } = props
  const subAccountFlowEnabled = waitlistSubAccountFlowFlag()
  const parent = normalizeAddress(parentAddress)
  const subAccount = normalizeAddress(subAccountAddress)
  const embeddedFromProps = normalizeAddress(embeddedEoaAddress)

  const {
    installSubAccountOwnerOnly,
    embeddedWallet,
    isSettingUp,
    getLastSetupError,
    lastStage,
  } = useSubAccountSetup()

  const embeddedEoa = embeddedFromProps ?? normalizeAddress(embeddedWallet?.address)

  const [ownerCheck, setOwnerCheck] = useState<OwnerCheckState>('idle')
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionSuccess, setActionSuccess] = useState(false)
  const [detailsOpen, setDetailsOpen] = useState(false)

  const canRender = subAccountFlowEnabled && Boolean(parent && subAccount && embeddedEoa)
  const isInline = variant === 'inline'

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
    // Base RPC can return empty call data (`0x`) for contract reads under load or
    // while a sub-account is still settling; default to install-needed so users
    // can proceed instead of getting stuck behind a non-actionable status check.
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
    if (!parent || !subAccount) return
    setActionError(null)
    setActionSuccess(false)

    const result = await installSubAccountOwnerOnly({
      parentAddress: parent,
      subAccountAddress: subAccount,
    })
    if (!result) {
      const message =
        mapOwnerInstallError(getLastSetupError()?.message ?? 'Could not enable signing on your app wallet.')
      setActionError(message)
      return
    }

    setActionSuccess(true)
    await refreshOwnerCheck()
    onSuccess?.()
  }, [getLastSetupError, installSubAccountOwnerOnly, onSuccess, parent, refreshOwnerCheck, subAccount])

  if (!canRender) return null

  if (ownerCheck === 'checking' || ownerCheck === 'idle') {
    return (
      <div
        className={`flex items-center gap-2 text-sm text-zinc-500 ${className}`}
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
          <p className="mt-1 text-xs leading-relaxed text-zinc-500">
            Your embedded key can sign for the app wallet.
          </p>
        </div>
      </div>
    )
  }

  const primaryLabel = isSettingUp ? progressLabel : 'Enable 4626 signing'

  if (isInline) {
    return (
      <div className={`space-y-3 text-left ${className}`} data-testid="sub-account-owner-install-panel">
        <p className="text-xs leading-relaxed text-zinc-500">
          App wallet linked — one Base App approval adds your embedded key as owner.
        </p>
        {isSettingUp ? (
          <div className="flex items-center gap-2 text-xs text-zinc-400" role="status" aria-live="polite">
            <PixelWaveLoader name="wave-lr" size={12} color="rgba(255,255,255,0.72)" />
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
        )}
        {actionError ? (
          <p className="text-xs text-rose-300/90" role="alert">
            {actionError}
          </p>
        ) : null}
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
        <FlowStep
          label="Main Base wallet"
          detail="Unchanged — custody stays here"
          address={parent}
          done
        />
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

      <p className="text-xs leading-relaxed text-zinc-500">
        Open in <span className="text-zinc-400">Base App</span> and approve one transaction. Safari, Chrome, and
        extensions cannot sign for sub-accounts.
      </p>

      {isSettingUp ? (
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
      )}

      {actionError ? (
        <p className="text-xs leading-relaxed text-rose-300/90" role="alert">
          {actionError}
        </p>
      ) : null}

      <div>
        <button
          type="button"
          className="inline-flex items-center gap-1 text-xs text-zinc-600 transition-colors hover:text-zinc-400"
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
          <p className="mt-2 max-w-sm text-[11px] leading-relaxed text-zinc-600">
            We call <span className="font-mono text-zinc-500">addOwnerAddress</span> on your app wallet so your Privy
            embedded key can co-sign. Your main smart wallet is not modified.
          </p>
        ) : null}
      </div>
    </section>
  )
}
