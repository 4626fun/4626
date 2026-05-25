import { useMemo } from 'react'

import { Button } from '@/components/ui/Button'
import { useZoraAddOwnerFlow } from '@/features/accountSetup/zoraAddOwner/useZoraAddOwnerFlow'
import type { useAccountSetupController } from '@/features/accountSetup/useAccountSetupController'
import { pickPrivyEmbeddedEoaWallet } from '@/lib/privy/privyEmbeddedEoa'
import { shortValue } from '@/features/accountSetup/shared'

type AccountSetupController = ReturnType<typeof useAccountSetupController>

type ZoraAddOwnerSigningPanelProps = {
  controller: AccountSetupController
  className?: string
  onOwnerInstallSuccess?: () => void | Promise<void>
}

export function ZoraAddOwnerSigningPanel(props: ZoraAddOwnerSigningPanelProps) {
  const { controller, className = '', onOwnerInstallSuccess } = props
  const {
    authHeaders,
    canonicalCswAddress,
    connectOwnerWallet,
    connectedOnchainEoaOwner,
    connectedOwnerReady,
    connectedSignerLabel,
    cswOwnersState,
    loadMe,
    onchainEoaOwnerCandidates,
    privyWallets,
    refreshCswOwners,
    requiresBaseAppForOwnerInstall,
    submitOwnerInstallViaOnchainEoa,
    busyProvider,
  } = controller

  const privyEmbeddedEoaAddress = useMemo(() => {
    const candidates = (Array.isArray(privyWallets) ? privyWallets : []) as Array<Record<string, unknown>>
    const found = pickPrivyEmbeddedEoaWallet(candidates)
    const address = found?.address
    return typeof address === 'string' ? address.toLowerCase() : null
  }, [privyWallets])

  const flowEnabled = Boolean(
    canonicalCswAddress &&
      privyEmbeddedEoaAddress &&
      onchainEoaOwnerCandidates.length > 0 &&
      !requiresBaseAppForOwnerInstall,
  )

  const addOwnerFlow = useZoraAddOwnerFlow({
    canonicalCswAddress,
    privyEmbeddedEoaAddress,
    connectedOnchainEoaOwner,
    submitOwnerInstallViaOnchainEoa,
    authHeaders,
    enabled: flowEnabled,
  })

  const ownerWalletConnecting = busyProvider === 'owner_wallet'
  const hasConnectedSigner = Boolean(connectedSignerLabel) && !/no wallet connected/i.test(connectedSignerLabel)
  const canSubmit =
    flowEnabled &&
    Boolean(connectedOnchainEoaOwner) &&
    !addOwnerFlow.alreadyOwner &&
    !addOwnerFlow.prepareLoading

  if (!canonicalCswAddress) {
    return (
      <p className={`text-xs text-zinc-500 ${className}`}>
        Link your canonical smart wallet in step 1 before enabling signing.
      </p>
    )
  }

  if (addOwnerFlow.alreadyOwner) {
    return (
      <div
        className={`rounded-lg border border-emerald-400/25 bg-emerald-500/10 px-3 py-2.5 text-xs text-emerald-100 ${className}`}
        data-testid="zora-add-owner-signing-complete"
      >
        4626 signing is enabled on your canonical wallet.
      </div>
    )
  }

  if (requiresBaseAppForOwnerInstall || onchainEoaOwnerCandidates.length === 0) {
    return (
      <div
        className={`rounded-lg border border-brand-primary/25 bg-brand-primary/10 px-3 py-2.5 text-xs leading-relaxed text-brand-100 ${className}`}
        data-testid="zora-add-owner-passkey-blocked"
      >
        Your Zora smart wallet is passkey-controlled and has no on-chain EOA owners we can use from this browser.
        Finish owner-gated actions in Zora or Base App, or trade at{' '}
        <a href="/swap" className="font-semibold text-brand-50 underline underline-offset-2">
          /swap
        </a>{' '}
        with an external wallet (EOA mode).
      </div>
    )
  }

  return (
    <div className={`space-y-3 ${className}`} data-testid="zora-add-owner-signing-panel">
      <p className="text-xs leading-relaxed text-zinc-500">
        Connect an on-chain owner of your Zora Coinbase Smart Wallet, then add your Privy embedded signer as a
        co-owner so sponsored swaps can run from your canonical wallet.
      </p>

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
            The connected wallet is not one of these owners. Connect a listed owner wallet first.
          </p>
        ) : null}
      </div>

      {!connectedOwnerReady || !connectedOnchainEoaOwner ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="primary"
            disabled={ownerWalletConnecting}
            loading={ownerWalletConnecting}
            onClick={() => void connectOwnerWallet()}
          >
            {ownerWalletConnecting ? 'Connecting wallet…' : 'Connect CSW owner wallet'}
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="primary"
            disabled={!canSubmit || addOwnerFlow.busy}
            loading={addOwnerFlow.busy || addOwnerFlow.prepareLoading}
            onClick={() => {
              void (async () => {
                const ok = await addOwnerFlow.handleEnableSigning()
                if (!ok) return
                await Promise.all([
                  loadMe({ showSpinner: false }),
                  refreshCswOwners(),
                  onOwnerInstallSuccess?.(),
                ])
              })()
            }}
          >
            Enable 4626 signing
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={addOwnerFlow.busy}
            onClick={() => void connectOwnerWallet()}
          >
            Switch owner wallet
          </Button>
        </div>
      )}

      {addOwnerFlow.pageNotice ? (
        <p className="text-xs text-emerald-200">{addOwnerFlow.pageNotice}</p>
      ) : null}
      {addOwnerFlow.pageError ? (
        <p className="text-xs text-rose-300">{addOwnerFlow.pageError}</p>
      ) : null}
      {addOwnerFlow.txHash ? (
        <p className="text-[11px] text-zinc-500">
          Tx: <span className="font-mono text-zinc-300">{shortValue(addOwnerFlow.txHash)}</span>
        </p>
      ) : null}
      {cswOwnersState.status === 'loading' ? (
        <p className="text-[11px] text-zinc-600">Refreshing owner list…</p>
      ) : null}
    </div>
  )
}
