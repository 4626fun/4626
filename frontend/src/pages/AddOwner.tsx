import { useMemo } from 'react'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/Button'
import { PageMeta } from '@/components/seo/PageMeta'
import { AddOwnerActionPanel } from '@/features/accountSetup/addOwner/AddOwnerActionPanel'
import { useAddOwnerFlow } from '@/features/accountSetup/addOwner/useAddOwnerFlow'
import { useAccountSetupController } from '@/features/accountSetup/useAccountSetupController'
import { pickPrivyEmbeddedEoaWallet } from '@/lib/privy/privyEmbeddedEoa'
import { detectInAppEnvironment, externalBrowserUrlFor } from '@/lib/wallet/inAppBrowser'

export function AddOwnerPage() {
  const controller = useAccountSetupController({ zoraReturnPath: '/add-owner' })
  const {
    canonicalCswAddress,
    loading,
    privyAuthed,
    login,
    loadMe,
    ownerSignerAddress,
    activeExternalOwnerWallet,
    privyWallets,
    connectOwnerWallet,
  } = controller

  const inAppEnv = useMemo(() => detectInAppEnvironment(), [])
  const externalUrl = useMemo(() => externalBrowserUrlFor('/add-owner'), [])

  const privyEmbeddedEoaAddress = useMemo(() => {
    const candidates = (Array.isArray(privyWallets) ? privyWallets : []) as Array<Record<string, unknown>>
    const found = pickPrivyEmbeddedEoaWallet(candidates)
    const address = found?.address
    return typeof address === 'string' ? address.toLowerCase() : null
  }, [privyWallets])

  const {
    preview,
    previewLoading,
    busy,
    pageError,
    pageNotice,
    txHash,
    eventLog,
    lastErrorDetail,
    isSelfAuthSession,
    signingReady,
    signingBlockedReason,
    fetchPreview,
    handleAdd,
  } = useAddOwnerFlow({
    canonicalCswAddress,
    ownerSignerAddress,
    privyEmbeddedEoaAddress,
    privyExternalOwnerWallet: activeExternalOwnerWallet,
  })

  const onAddSuccess = async () => {
    const ok = await handleAdd()
    if (ok) {
      await loadMe({ showSpinner: false })
    }
  }

  return (
    <div className="relative min-h-0 w-full bg-transparent text-white">
      <PageMeta
        title="Install signing key"
        description="Install your Privy embedded signer onto your canonical Coinbase Smart Wallet via Relay two-leg execution with strict completion checks."
        canonicalPath="/add-owner"
      />
      <div className="mx-auto w-full max-w-2xl px-6 py-16 space-y-6">
        <div className="space-y-2">
          <div className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">Account setup</div>
          <h1 className="text-3xl font-semibold tracking-tight">Install signing key</h1>
          <p className="text-sm text-zinc-400">
            Install your Privy embedded signer onto your canonical Coinbase Smart Wallet through the
            Relay two-leg route. This page only reports success when Relay execution succeeds and
            addOwnerAddress is confirmed on-chain.
          </p>
        </div>

        {!privyAuthed ? (
          <div className="card rounded-2xl border border-white/10 bg-black/40 p-6 space-y-3">
            <p className="text-sm text-zinc-300">Sign in to install the signing key on your wallet.</p>
            <Button
              type="button"
              variant="primary"
              onClick={() => void login({ loginMethods: ['email', 'wallet'] } as any)}
            >
              Sign in / Continue
            </Button>
          </div>
        ) : null}

        {privyAuthed && loading ? (
          <div className="rounded-2xl border border-white/10 bg-black/40 p-6 text-sm text-zinc-400">
            Loading your account…
          </div>
        ) : null}

        {inAppEnv?.isAnyWalletInApp && !isSelfAuthSession ? (
          <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 p-6 space-y-4 text-amber-100">
            <div className="space-y-1">
              <div className="text-[11px] uppercase tracking-[0.2em] text-amber-300/80">
                Open in your browser
              </div>
              <div className="text-sm font-semibold">
                {inAppEnv.isCoinbaseInApp
                  ? "Coinbase Wallet's in-app browser can block the passkey popup"
                  : 'This in-app browser can block the passkey popup'}
              </div>
            </div>
            <p className="text-xs leading-relaxed text-amber-100/85">
              You&apos;re connected as an external signer (not the CSW itself). In-app browsers can
              block prompts or return stale signer context. Open in a regular browser for the best
              chance of success.
            </p>
            <a
              href={externalUrl}
              target="_blank"
              rel="noopener noreferrer external"
              className="inline-flex items-center justify-center rounded-xl bg-amber-300 px-4 py-2 text-xs font-semibold text-black hover:bg-amber-200"
            >
              Open 4626.fun/add-owner in browser
            </a>
          </div>
        ) : null}

        {inAppEnv?.isAnyWalletInApp && isSelfAuthSession ? (
          <div className="rounded-2xl border border-emerald-400/25 bg-emerald-500/5 p-4 text-xs text-emerald-100/85">
            In-app browser detected with a CSW self-auth session. This page uses Relay-bound preview
            execution from the active signer context. If the wallet prompt stalls, open the page in
            an external browser and retry.
          </div>
        ) : null}

        {privyAuthed && !loading ? (
          <div className="space-y-4">
            {!canonicalCswAddress ? (
              <div className="card rounded-2xl border border-white/10 bg-black/40 p-6 text-sm text-zinc-400">
                <div>No canonical Coinbase Smart Wallet is linked yet.</div>
                <div className="mt-2 text-xs text-zinc-500">
                  Connect your CSW first — head to{' '}
                  <Link to="/accounts" className="underline underline-offset-2">
                    /accounts
                  </Link>
                  .
                </div>
              </div>
            ) : (
              <>
                <div className="card rounded-2xl border border-white/10 bg-black/40 p-6 space-y-3">
                  <dl className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
                    <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                      <dt className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">
                        Canonical CSW
                      </dt>
                      <dd className="mt-1 break-all font-mono text-zinc-300">{canonicalCswAddress}</dd>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                      <dt className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">
                        Privy signer to add
                      </dt>
                      <dd className="mt-1 break-all font-mono text-zinc-300">
                        {privyEmbeddedEoaAddress ?? 'resolving…'}
                      </dd>
                    </div>
                  </dl>
                  {!signingReady ? (
                    <div className="rounded-xl border border-white/10 bg-black/30 p-4 text-sm space-y-3">
                      <p className="text-zinc-300">
                        {signingBlockedReason ??
                          'Connect a wallet that owns this CSW (or open this page in Base App with your smart wallet) before building the Relay preview.'}
                      </p>
                      <Button type="button" variant="primary" onClick={() => void connectOwnerWallet()}>
                        Connect owner wallet
                      </Button>
                    </div>
                  ) : null}
                </div>

                {signingReady ? (
                  <AddOwnerActionPanel
                    previewLoading={previewLoading}
                    preview={preview}
                    busy={busy}
                    isSelfAuthSession={isSelfAuthSession}
                    handleAdd={onAddSuccess}
                    onBuildPreview={() => void fetchPreview()}
                    onRebuildPreview={() => void fetchPreview()}
                    txHash={txHash}
                    pageNotice={pageNotice}
                    pageError={pageError}
                    lastErrorDetail={lastErrorDetail}
                    eventLog={eventLog}
                  />
                ) : null}
              </>
            )}
          </div>
        ) : null}

        <div className="text-[11px] text-zinc-500 space-y-1">
          <div>
            Need to remove an owner instead?{' '}
            <Link to="/remove-owner" className="underline underline-offset-2">
              /remove-owner
            </Link>
            .
          </div>
          <div>
            Need to fund the CSW before submitting?{' '}
            <Link to="/csw-funding" className="underline underline-offset-2">
              /csw-funding
            </Link>
            .
          </div>
        </div>
      </div>
    </div>
  )
}

export default AddOwnerPage
