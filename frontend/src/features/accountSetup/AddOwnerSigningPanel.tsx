import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useWalletClient } from 'wagmi'
import { base } from 'viem/chains'

import { Button } from '@/components/ui/Button'
import { useAddOwnerRelayFlow } from '@/features/accountSetup/addOwner/useAddOwnerRelayFlow'
import type { useAccountSetupController } from '@/features/accountSetup/useAccountSetupController'
import { detectInAppEnvironment, externalBrowserUrlFor } from '@/lib/wallet/inAppBrowser'
import { pickPrivyEmbeddedEoaWallet } from '@/lib/privy/privyEmbeddedEoa'
import { addOwnerViaBaseAppSendCalls } from '@/lib/wallet/baseAppOwnerCalls'

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

  const { data: walletClient } = useWalletClient()
  const onchainEoaOwnerCandidates = rawOnchainEoaOwnerCandidates ?? []
  const [selfAuthBusy, setSelfAuthBusy] = useState(false)
  const [selfAuthError, setSelfAuthError] = useState<string | null>(null)
  const [selfAuthNotice, setSelfAuthNotice] = useState<string | null>(null)
  const [selfAuthTxHash, setSelfAuthTxHash] = useState<string | null>(null)

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
    connectedOnchainEoaOwner && !isSelfAuthSession && installedAsOwner !== true,
  )

  const relayFlow = useAddOwnerRelayFlow({
    ownerSignerAddress,
    canonicalCswAddress,
    privyExternalOwnerWallet: activeExternalOwnerWallet,
    enabled: useRelayOwnerInstall,
  })

  const inAppEnv = useMemo(() => detectInAppEnvironment(), [])
  const externalAddOwnerUrl = useMemo(
    () => externalBrowserUrlFor(variant === 'waitlist' ? '/waitlist' : '/add-owner'),
    [variant],
  )

  const ownerWalletConnecting = busyProvider === 'owner_wallet'
  const hasConnectedSigner = Boolean(connectedSignerLabel) && !/no wallet connected/i.test(connectedSignerLabel)
  const canSubmitSigningApproval =
    connectedOwnerReady || (isSelfAuthSession && !requiresBaseAppForOwnerInstall)
  const needsConnectFirst =
    !canSubmitSigningApproval && !useRelayOwnerInstall && !isSelfAuthSession

  const handleInstall = async () => {
    setSelfAuthError(null)
    setSelfAuthNotice(null)
    setSelfAuthTxHash(null)

    if (useRelayOwnerInstall) {
      const ok = await relayFlow.executeRelayInstall()
      if (ok) {
        await loadMe({ showSpinner: false })
        await onInstallSuccess?.()
      }
      return
    }

    const request = (walletClient as { request?: (args: { method: string; params?: unknown[] }) => Promise<unknown> })
      ?.request
    if (isSelfAuthSession && request && canonicalCswAddress && privyEmbeddedEoaAddress) {
      setSelfAuthBusy(true)
      try {
        const submitted = await addOwnerViaBaseAppSendCalls({
          walletRequest: async (args) => await request(args),
          csw: canonicalCswAddress as `0x${string}`,
          ownerToAdd: privyEmbeddedEoaAddress as `0x${string}`,
          chainId: base.id,
        })
        setSelfAuthTxHash(submitted.transactionHash ?? null)
        setSelfAuthNotice(
          submitted.transactionHash
            ? `Signing key submitted (tx ${submitted.transactionHash.slice(0, 10)}…).`
            : 'Signing key submitted via Base App send-calls.',
        )
        await loadMe({ showSpinner: false })
        await onInstallSuccess?.()
        return
      } catch (installError) {
        const message =
          installError instanceof Error
            ? installError.message
            : 'Failed to submit add-owner via Base App send-calls.'
        if (message.toLowerCase().includes('self calls are not allowed')) {
          setSelfAuthNotice('Base App rejected direct self-call; retrying via prepared owner-install lane.')
        } else {
          setSelfAuthError(message)
          return
        }
      } finally {
        setSelfAuthBusy(false)
      }
    }

    await onEnable4626Signing()
    await onInstallSuccess?.()
  }

  const installBusy = advancedBusy || selfAuthBusy || relayFlow.busy || relayFlow.previewLoading
  const installDisabled =
    installBusy ||
    installedAsOwner === true ||
    needsConnectFirst ||
    ((inAppEnv?.isAnyWalletInApp ?? false) && !isSelfAuthSession && !useRelayOwnerInstall)

  const primaryLabel = needsBaseAccountReconnect
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
            : useRelayOwnerInstall
              ? 'Enable 4626 signing via Relay'
              : 'Enable 4626 signing'

  const handlePrimaryClick = () => {
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
          Install your Privy embedded signer as an owner on your parent smart wallet so 4626 can
          prepare sponsored actions. Connect a wallet that is already listed as a CSW owner — not
          your smart wallet address itself.
        </p>
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

      {isSelfAuthSession ? (
        <p className="text-xs text-emerald-100/85">
          Base App session detected — this uses <span className="font-mono">wallet_sendCalls</span>{' '}
          for <span className="font-mono">addOwnerAddress(privyEoa)</span>.
        </p>
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
            Connected EOA owner funds a Relay deposit; Relay executes{' '}
            <code className="font-mono text-zinc-400">addOwnerAddress(privyEoa)</code> on your CSW.
          </p>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={relayFlow.previewLoading || relayFlow.busy}
            onClick={() => void relayFlow.loadPreview()}
          >
            {relayFlow.previewLoading ? 'Building Relay preview…' : 'Rebuild Relay preview'}
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

      {relayFlow.notice ?? selfAuthNotice ? (
        <div className="rounded-lg border border-emerald-400/25 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100">
          {relayFlow.notice ?? selfAuthNotice}
        </div>
      ) : null}

      {(relayFlow.txHash ?? selfAuthTxHash) ? (
        <div className="rounded-lg border border-emerald-400/20 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-100 break-all">
          Submitted:{' '}
          <a
            href={`https://basescan.org/tx/${relayFlow.txHash ?? selfAuthTxHash}`}
            target="_blank"
            rel="noreferrer"
            className="font-mono underline"
          >
            {relayFlow.txHash ?? selfAuthTxHash}
          </a>
        </div>
      ) : null}

      {relayFlow.error ?? selfAuthError ?? error ? (
        <div className="space-y-2">
          <div className="rounded-lg border border-rose-400/25 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">
            {relayFlow.error ?? selfAuthError ?? error}
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
