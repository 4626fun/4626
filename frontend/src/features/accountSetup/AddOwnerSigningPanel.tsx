import { useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/Button'
import { AddOwnerActionPanel } from '@/features/accountSetup/addOwner/AddOwnerActionPanel'
import { useAddOwnerFlow } from '@/features/accountSetup/addOwner/useAddOwnerFlow'
import type { useAccountSetupController } from '@/features/accountSetup/useAccountSetupController'
import { buildWaitlistSetupUrl } from '@/lib/auth/waitlistEntry'
import { getAppBaseUrl } from '@/lib/env/host'
import { pickPrivyEmbeddedEoaWallet } from '@/lib/privy/privyEmbeddedEoa'
import { resolveOwnerMutationSignerContext } from '@/lib/relay/resolveOwnerMutationSignerContext'

type AccountSetupController = ReturnType<typeof useAccountSetupController>

type AddOwnerSigningPanelProps = {
  controller: AccountSetupController
  className?: string
  /** Run the Relay add-owner flow inline instead of linking away. */
  inlineRelay?: boolean
  onOwnerInstallSuccess?: () => void | Promise<void>
}

export function AddOwnerSigningPanel(props: AddOwnerSigningPanelProps) {
  const { controller, className = '', inlineRelay = false, onOwnerInstallSuccess } = props
  const {
    activeExternalOwnerWallet,
    canonicalCswAddress,
    connectOwnerWallet,
    connectedOnchainEoaOwner,
    connectedOwnerReady,
    connectedSignerLabel,
    cswOwnersState,
    loadMe,
    onchainEoaOwnerCandidates: rawOnchainEoaOwnerCandidates,
    ownerSignerAddress,
    privyWallets,
    refreshCswOwners,
    requiresBaseAppForOwnerInstall,
    busyProvider,
  } = controller

  const onchainEoaOwnerCandidates = rawOnchainEoaOwnerCandidates ?? []
  const baseAppSetupUrl = useMemo(() => buildWaitlistSetupUrl('base-app'), [])
  const fullPageAddOwnerUrl = useMemo(() => `${getAppBaseUrl()}/add-owner`, [])

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

  const signerContext = useMemo(
    () =>
      resolveOwnerMutationSignerContext({
        canonicalCswAddress,
        connectedAddress: ownerSignerAddress,
        privyEmbeddedEoaAddress,
      }),
    [canonicalCswAddress, ownerSignerAddress, privyEmbeddedEoaAddress],
  )
  const isSelfAuthSession = signerContext.isSelfAuthSession

  const passkeyOnlyOwnerInstallBlocked =
    requiresBaseAppForOwnerInstall &&
    onchainEoaOwnerCandidates.length === 0 &&
    !isSelfAuthSession
  const ownerWalletConnecting = busyProvider === 'owner_wallet'
  const hasConnectedSigner = Boolean(connectedSignerLabel) && !/no wallet connected/i.test(connectedSignerLabel)
  const canRunAddOwnerFlow =
    installedAsOwner !== true &&
    !passkeyOnlyOwnerInstallBlocked &&
    (signerContext.signingReady || connectedOwnerReady || Boolean(connectedOnchainEoaOwner))

  const addOwnerFlow = useAddOwnerFlow({
    canonicalCswAddress,
    ownerSignerAddress,
    privyEmbeddedEoaAddress,
    privyExternalOwnerWallet: activeExternalOwnerWallet,
    enabled: inlineRelay && canRunAddOwnerFlow,
  })

  const handleInlineSubmit = useCallback(async () => {
    const ok = await addOwnerFlow.handleAdd()
    if (!ok) return
    await Promise.all([
      loadMe({ showSpinner: false }),
      refreshCswOwners(),
      onOwnerInstallSuccess?.(),
    ])
  }, [addOwnerFlow, loadMe, onOwnerInstallSuccess, refreshCswOwners])

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
      <p className="text-xs leading-relaxed text-zinc-500">
        {inlineRelay
          ? 'Add your Privy embedded signer as a CSW owner through Relay: build preview, review deposit, then submit.'
          : (
              <>
                Owner install runs on <span className="font-mono text-zinc-300">/add-owner</span> as a two-step
                Relay flow: build preview, then submit deposit.
              </>
            )}
      </p>

      {passkeyOnlyOwnerInstallBlocked ? (
        <div className="rounded-lg border border-brand-primary/25 bg-brand-primary/10 px-3 py-2.5 text-xs leading-relaxed text-brand-100">
          Your smart wallet is passkey-controlled and has no on-chain EOA owners. Open{' '}
          <a
            href={baseAppSetupUrl}
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-brand-50 underline decoration-dotted underline-offset-2"
          >
            Base App setup
          </a>{' '}
          first, connect your canonical smart wallet, then finish signing here.
        </div>
      ) : null}

      {onchainEoaOwnerCandidates.length > 0 ? (
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
          {hasConnectedSigner && !connectedOnchainEoaOwner && !isSelfAuthSession ? (
            <p className="text-[11px] leading-relaxed text-amber-200/90">
              The connected wallet is not one of these owners. Connect a listed owner wallet first.
            </p>
          ) : null}
        </div>
      ) : null}

      {!canRunAddOwnerFlow ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="primary"
            disabled={ownerWalletConnecting}
            loading={ownerWalletConnecting}
            onClick={() => void connectOwnerWallet()}
          >
            {ownerWalletConnecting
              ? 'Connecting wallet…'
              : 'Connect CSW owner wallet'}
          </Button>
        </div>
      ) : inlineRelay ? (
        <AddOwnerActionPanel
          previewLoading={addOwnerFlow.previewLoading}
          preview={addOwnerFlow.preview}
          busy={addOwnerFlow.busy}
          isSelfAuthSession={addOwnerFlow.isSelfAuthSession}
          handleAdd={handleInlineSubmit}
          onBuildPreview={() => void addOwnerFlow.fetchPreview()}
          onRebuildPreview={() => void addOwnerFlow.fetchPreview()}
          txHash={addOwnerFlow.txHash}
          pageNotice={addOwnerFlow.pageNotice}
          pageError={addOwnerFlow.pageError}
          lastErrorDetail={addOwnerFlow.lastErrorDetail}
          eventLog={addOwnerFlow.eventLog}
        />
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="primary" asChild>
            <Link to="/add-owner">Continue on /add-owner</Link>
          </Button>
        </div>
      )}

      {canRunAddOwnerFlow && inlineRelay ? (
        <p className="text-[11px] text-zinc-600">
          Need the full-page flow?{' '}
          <a href={fullPageAddOwnerUrl} className="text-zinc-400 underline underline-offset-2 hover:text-zinc-300">
            Open /add-owner
          </a>
        </p>
      ) : null}

      {connectedSignerLabel ? (
        <p className="text-xs text-zinc-500">
          Connected signer: <span className="font-mono text-zinc-300">{connectedSignerLabel}</span>
        </p>
      ) : null}
    </div>
  )
}
