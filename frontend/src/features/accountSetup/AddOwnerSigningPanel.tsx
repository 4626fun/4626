import { useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/Button'
import { useAddOwnerRelayFlow } from '@/features/accountSetup/addOwner/useAddOwnerRelayFlow'
import type { useAccountSetupController } from '@/features/accountSetup/useAccountSetupController'
import { buildWaitlistSetupUrl } from '@/lib/auth/waitlistEntry'
import { detectInAppEnvironment, externalBrowserUrlFor, isBaseAppInAppContext } from '@/lib/wallet/inAppBrowser'
import { formatCompactEth } from '@/lib/removeOwner/removeOwnerHelpers'
import { pickPrivyEmbeddedEoaWallet } from '@/lib/privy/privyEmbeddedEoa'

type AccountSetupController = ReturnType<typeof useAccountSetupController>

type AddOwnerSigningPanelProps = {
  controller: AccountSetupController
  /** Compact copy for waitlist step 2; full copy on `/add-owner`. */
  variant?: 'waitlist' | 'standalone'
  /** Called after a successful install (Relay, sendCalls, or prepared lane). */
  onInstallSuccess?: () => void | Promise<void>
  className?: string
}

export function AddOwnerSigningPanel(props: AddOwnerSigningPanelProps) {
  const { controller, variant = 'standalone', onInstallSuccess, className = '' } = props
  const {
    advancedBusy,
    busyProvider,
    canonicalCswAddress,
    connectOwnerWallet,
    connectedOnchainEoaOwner,
    connectedOwnerReady,
    connectedSignerLabel,
    cswOwnersState,
    error,
    loadMe,
    needsBaseAccountReconnect,
    onchainEoaOwnerCandidates: rawOnchainEoaOwnerCandidates,
    onEnable4626Signing,
    onResetOwnerApproval,
    ownerSignerAddress,
    privyWallets,
    requiresBaseAppForOwnerInstall,
    activeExternalOwnerWallet,
  } = controller

  const onchainEoaOwnerCandidates = rawOnchainEoaOwnerCandidates ?? []

  const privyEmbeddedEoaAddress = useMemo(() => {
    const candidates = (Array.isArray(privyWallets) ? privyWallets : []) as Array<Record<string, unknown>>
    const found = pickPrivyEmbeddedEoaWallet(candidates)
    const address = found?.address
    return typeof address === 'string' ? address.toLowerCase() : null
  }, [privyWallets])

  const installedAsOwner = useMemo(() => {
    if (!privyEmbeddedEoaAddress) return null
    return cswOwnersState.owners.some(
      (owner) =>
        owner.isAddressOwner &&
        typeof owner.ownerAddress === 'string' &&
        owner.ownerAddress.toLowerCase() === privyEmbeddedEoaAddress,
    )
  }, [cswOwnersState.owners, privyEmbeddedEoaAddress])

  const isSelfAuthSession = useMemo(() => {
    if (!canonicalCswAddress || !ownerSignerAddress) return false
    return ownerSignerAddress.toLowerCase() === canonicalCswAddress.toLowerCase()
  }, [canonicalCswAddress, ownerSignerAddress])

  const useRelayOwnerInstall = Boolean(
    installedAsOwner !== true &&
      ((connectedOnchainEoaOwner && !isSelfAuthSession) ||
        (isSelfAuthSession && privyEmbeddedEoaAddress)),
  )
  const useRelaySelfAuthInstall = Boolean(isSelfAuthSession && useRelayOwnerInstall)

  const {
    preview: relayPreview,
    previewLoading: relayPreviewLoading,
    loadPreview: loadRelayPreview,
    ...relayFlow
  } = useAddOwnerRelayFlow({
    ownerSignerAddress,
    canonicalCswAddress,
    privyExternalOwnerWallet: activeExternalOwnerWallet,
    enabled: useRelayOwnerInstall,
  })

  useEffect(() => {
    if (!useRelayOwnerInstall || relayPreview || relayPreviewLoading) return
    void loadRelayPreview()
  }, [loadRelayPreview, relayPreview, relayPreviewLoading, useRelayOwnerInstall])

  const relayDepositWei = useMemo(() => {
    const raw = relayPreview?.relay?.userCall?.value
    if (!raw) return null
    try {
      const wei = BigInt(raw)
      return wei > 0n ? wei : null
    } catch {
      return null
    }
  }, [relayPreview?.relay?.userCall?.value])

  const inAppEnv = useMemo(() => detectInAppEnvironment(), [])
  const externalAddOwnerUrl = useMemo(
    () => externalBrowserUrlFor(variant === 'waitlist' ? '/waitlist' : '/add-owner'),
    [variant],
  )

  const ownerWalletConnecting = busyProvider === 'owner_wallet'
  const hasConnectedSigner = Boolean(connectedSignerLabel) && !/no wallet connected/i.test(connectedSignerLabel)
  const passkeyOnlyOwnerInstallBlocked =
    requiresBaseAppForOwnerInstall && onchainEoaOwnerCandidates.length === 0
  const baseAppSetupUrl = useMemo(() => buildWaitlistSetupUrl('base-app'), [])
  const canSubmitSigningApproval =
    connectedOwnerReady || (isSelfAuthSession && !requiresBaseAppForOwnerInstall)
  const needsConnectFirst =
    !canSubmitSigningApproval &&
    !useRelayOwnerInstall &&
    !isSelfAuthSession &&
    !passkeyOnlyOwnerInstallBlocked

  const handleInstall = async () => {
    if (useRelayOwnerInstall) {
      const ok = await relayFlow.executeRelayInstall()
      if (ok) {
        await loadMe({ showSpinner: false })
        await onInstallSuccess?.()
      }
      return
    }

    await onEnable4626Signing()
    await onInstallSuccess?.()
  }

  const installBusy = advancedBusy || relayFlow.busy || relayPreviewLoading
  const installDisabled =
    installBusy ||
    installedAsOwner === true ||
    needsConnectFirst ||
    ((inAppEnv?.isAnyWalletInApp ?? false) && !isSelfAuthSession && !useRelayOwnerInstall)

  const primaryLabel = passkeyOnlyOwnerInstallBlocked
    ? 'Open Base App setup'
    : needsBaseAccountReconnect
      ? 'Reconnect via Base Account'
      : needsConnectFirst
        ? hasConnectedSigner
          ? 'Switch to a CSW owner wallet'
          : ownerWalletConnecting
            ? 'Connecting wallet…'
            : 'Connect CSW owner wallet'
        : installBusy
        ? 'Installing…'
        : installedAsOwner === true
          ? 'Already installed'
          : inAppEnv?.isAnyWalletInApp && !isSelfAuthSession && !useRelayOwnerInstall
            ? 'Open in browser to install'
            : useRelaySelfAuthInstall
              ? 'Enable 4626 signing in Base App'
              : useRelayOwnerInstall
                ? 'Enable 4626 signing via Relay'
                : 'Enable 4626 signing'

  const handlePrimaryClick = () => {
    if (passkeyOnlyOwnerInstallBlocked) {
      window.open(baseAppSetupUrl, '_blank', 'noopener,noreferrer')
      return
    }
    if (needsBaseAccountReconnect || needsConnectFirst) {
      void connectOwnerWallet()
      return
    }
    void handleInstall()
  }

  if (!canonicalCswAddress) {
    return (
      <p className={`text-xs text-zinc-500 ${className}`}>
        Link your canonical smart wallet in step 1 before enabling signing.
      </p>
    )
  }

  if (installedAsOwner === true) {
    return (
      <div
        className={`rounded-lg border border-emerald-400/25 bg-emerald-500/10 px-3 py-2.5 text-xs text-emerald-100 ${className}`}
        data-testid="add-owner-signing-complete"
      >
        4626 signing is enabled on your canonical wallet.
      </div>
    )
  }

  return (
    <div className={`space-y-3 ${className}`} data-testid="add-owner-signing-panel">
      {variant === 'waitlist' ? (
        <p className="text-xs leading-relaxed text-zinc-500">
          {useRelaySelfAuthInstall
            ? 'Install your Privy embedded signer as a CSW owner via Base App Relay — your smart wallet funds a small deposit, then Relay executes addOwnerAddress(privyEoa).'
            : 'Install your Privy embedded signer as an owner on your parent smart wallet so 4626 can prepare sponsored actions. Connect a wallet that is already listed as a CSW owner — not your smart wallet address itself.'}
        </p>
      ) : null}

      {passkeyOnlyOwnerInstallBlocked ? (
        <div className="rounded-lg border border-brand-primary/25 bg-brand-primary/10 px-3 py-2.5 text-xs leading-relaxed text-brand-100">
          Your smart wallet is passkey-controlled and has no on-chain EOA owners. Owner install cannot
          finish from this desktop browser — open{' '}
          <a
            href={baseAppSetupUrl}
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-brand-50 underline decoration-dotted underline-offset-2"
          >
            Base App setup
          </a>{' '}
          to finish signing there instead.
        </div>
      ) : null}

      {needsConnectFirst && onchainEoaOwnerCandidates.length > 0 ? (
        <div className="rounded-xl border border-white/10 bg-black/30 p-3 text-xs space-y-2">
          <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">Current CSW owners</div>
          <ul className="space-y-1">
            {onchainEoaOwnerCandidates.map((candidate) => {
              const matched =
                connectedOnchainEoaOwner?.ownerAddress.toLowerCase() === candidate.ownerAddress.toLowerCase()
              return (
                <li
                  key={candidate.ownerAddress}
                  className={`flex items-center gap-2 break-all font-mono ${
                    matched ? 'text-emerald-300' : 'text-zinc-400'
                  }`}
                >
                  <span className="text-[10px]">[{candidate.index}]</span>
                  <span>{candidate.ownerAddress}</span>
                  {matched ? <span className="text-[10px]">connected</span> : null}
                </li>
              )
            })}
          </ul>
          {hasConnectedSigner && !connectedOnchainEoaOwner ? (
            <p className="text-[11px] leading-relaxed text-amber-200/90">
              The connected wallet is not one of these owners. Use the button above to connect Rabby,
              MetaMask, or another listed owner.
            </p>
          ) : null}
        </div>
      ) : null}

      {inAppEnv?.isAnyWalletInApp && !isSelfAuthSession && !useRelayOwnerInstall ? (
        <div className="rounded-lg border border-amber-400/25 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-100/90">
          Passkey signing may fail inside this in-app browser.{' '}
          <a
            href={externalAddOwnerUrl}
            target="_blank"
            rel="noopener noreferrer external"
            className="font-medium text-amber-50 underline decoration-dotted"
          >
            Open in your default browser
          </a>{' '}
          or connect an on-chain EOA owner and use Relay.
        </div>
      ) : null}

      {useRelaySelfAuthInstall ? (
        <p className="text-xs text-emerald-100/85">
          Base App session detected — your canonical smart wallet submits a Relay deposit via{' '}
          <span className="font-mono">wallet_sendCalls</span>, then Relay fills{' '}
          <span className="font-mono">addOwnerAddress(privyEoa)</span> on-chain.
          {relayDepositWei ? (
            <>
              {' '}
              Relay deposit:{' '}
              <span className="font-mono text-emerald-50">{formatCompactEth(relayDepositWei)} ETH</span>.
            </>
          ) : null}
        </p>
      ) : null}

      {useRelaySelfAuthInstall && isBaseAppInAppContext(inAppEnv) && onchainEoaOwnerCandidates.length > 0 ? (
        <div className="rounded-lg border border-amber-400/25 bg-amber-500/10 px-3 py-2.5 text-xs leading-relaxed text-amber-100/90">
          If Base App shows &quot;insufficient funds&quot; on approve, that is usually a wallet simulation
          quirk — your CSW likely has enough ETH for the tiny Relay deposit. Retry once here, or open{' '}
          <a
            href={externalAddOwnerUrl}
            target="_blank"
            rel="noopener noreferrer external"
            className="font-medium text-amber-50 underline decoration-dotted"
          >
            /add-owner in Safari or Chrome
          </a>{' '}
          and connect one of the on-chain EOA owners listed below.
        </div>
      ) : null}

      {onchainEoaOwnerCandidates.length > 0 && variant === 'standalone' ? (
        <div className="rounded-xl border border-white/10 bg-black/30 p-3 text-xs space-y-2">
          <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">On-chain EOA owners</div>
          <ul className="space-y-1">
            {onchainEoaOwnerCandidates.map((candidate) => {
              const matched =
                connectedOnchainEoaOwner?.ownerAddress.toLowerCase() === candidate.ownerAddress.toLowerCase()
              return (
                <li
                  key={candidate.ownerAddress}
                  className={`flex items-center gap-2 break-all font-mono ${
                    matched ? 'text-emerald-300' : 'text-zinc-400'
                  }`}
                >
                  <span className="text-[10px]">[{candidate.index}]</span>
                  <span>{candidate.ownerAddress}</span>
                  {matched ? <span className="text-[10px]">connected</span> : null}
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="primary"
          disabled={installDisabled && !needsConnectFirst && !needsBaseAccountReconnect}
          loading={installBusy && !needsConnectFirst}
          onClick={handlePrimaryClick}
          data-testid="add-owner-signing-primary"
        >
          {primaryLabel}
        </Button>
        {!needsConnectFirst ? (
          <button
            type="button"
            onClick={() => void onResetOwnerApproval()}
            className="inline-flex h-9 items-center text-xs font-medium text-rose-900/80 transition-colors hover:text-rose-700 disabled:opacity-50"
          >
            Reset
          </button>
        ) : null}
      </div>

      {useRelayOwnerInstall ? (
        <div className="space-y-2">
          <p className="text-[11px] leading-relaxed text-zinc-500">
            {useRelaySelfAuthInstall
              ? 'Your canonical smart wallet funds a small Relay deposit in Base App; Relay executes'
              : 'Connected EOA owner funds a Relay deposit; Relay executes'}{' '}
            <code className="font-mono text-zinc-400">addOwnerAddress(privyEoa)</code> on your CSW.
          </p>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={relayPreviewLoading || relayFlow.busy}
            onClick={() => void loadRelayPreview()}
          >
            {relayPreviewLoading ? 'Building Relay preview…' : 'Rebuild Relay preview'}
          </Button>
          {relayFlow.relayReady ? (
            <div className="rounded-lg border border-emerald-400/25 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100">
              Relay preview ready.
            </div>
          ) : null}
        </div>
      ) : (
        <p className="text-[11px] leading-relaxed text-zinc-500">
          {needsConnectFirst
            ? 'Connect one of the CSW owner addresses above — not the parent smart wallet address — then approve the one-time signing install.'
            : 'Passkey owners approve through Coinbase prepared calls; no private key export required.'}
        </p>
      )}

      {connectedSignerLabel && !needsConnectFirst ? (
        <p className="text-xs text-zinc-500">
          Connected signer: <span className="font-mono text-zinc-300">{connectedSignerLabel}</span>
        </p>
      ) : null}

      {relayFlow.notice ? (
        <div className="rounded-lg border border-emerald-400/25 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100">
          {relayFlow.notice}
        </div>
      ) : null}

      {relayFlow.txHash ? (
        <div className="rounded-lg border border-emerald-400/20 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-100 break-all">
          Submitted:{' '}
          <a
            href={`https://basescan.org/tx/${relayFlow.txHash}`}
            target="_blank"
            rel="noreferrer"
            className="font-mono underline"
          >
            {relayFlow.txHash}
          </a>
        </div>
      ) : null}

      {relayFlow.error ?? error ? (
        <div className="space-y-2">
          <div className="rounded-lg border border-rose-400/25 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">
            {relayFlow.error ?? error}
          </div>
          {variant === 'waitlist' ? (
            <p className="text-[11px] text-zinc-500">
              You can also finish on{' '}
              <Link to="/add-owner" className="text-zinc-300 underline decoration-dotted">
                /add-owner
              </Link>
              .
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
