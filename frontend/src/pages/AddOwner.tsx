import { useMemo } from 'react'
import { Link } from 'react-router-dom'

import { PageMeta } from '@/components/seo/PageMeta'
import { useAccountSetupController } from '@/features/accountSetup/useAccountSetupController'
import { detectInAppEnvironment, externalBrowserUrlFor } from '@/lib/wallet/inAppBrowser'
import { pickPrivyEmbeddedEoaWallet } from '@/lib/privy/privyEmbeddedEoa'

/**
 * `/add-owner` — single-purpose surface for installing the Privy embedded EOA
 * (the "4626 signing" key) onto the user's canonical Coinbase Smart Wallet as
 * an additional owner.
 *
 * Why this page exists separately from `/accounts`:
 *  - `/accounts` requires expanding "Advanced settings" → "Advanced recovery"
 *    and pasting the EOA address into the Rabby co-owner field. That field
 *    routes through `prepare-add-rabby-owner` (caller-supplied address).
 *  - This page calls `controller.onEnable4626Signing()` instead, which routes
 *    through `prepare-add-privy-owner`. The backend reads the user's Privy
 *    embedded EOA from their authenticated session (via
 *    `bootstrapCanonicalDelegationState`) so the user never has to look up,
 *    paste, or even see the address — the install is fully programmatic
 *    end-to-end.
 *
 * Submission lane: the canonical Coinbase passkey (owner[0]) signs the
 * replayable `executeWithoutChainIdValidation([addOwnerAddress(privyEoa)])`
 * UserOp via Coinbase `wallet_prepareCalls` / `wallet_sendPreparedCalls`.
 * This is the March 9 recovery shape documented in RECOVERY.md.
 */
export function AddOwnerPage() {
  const controller = useAccountSetupController({ zoraReturnPath: '/add-owner' })
  const {
    advancedBusy,
    canonicalCswAddress,
    cswOwnersState,
    error,
    loading,
    notice,
    onEnable4626Signing,
    onResetOwnerApproval,
    privyAuthed,
    privyWallets,
    login,
    onchainEoaOwnerCandidates: rawOnchainEoaOwnerCandidates,
    connectedOnchainEoaOwner,
  } = controller
  const onchainEoaOwnerCandidates = rawOnchainEoaOwnerCandidates ?? []

  // Detect whether the Privy embedded EOA is already installed. Use the
  // shared `pickPrivyEmbeddedEoaWallet` helper so we accept all embedded
  // Privy wallet variants (privy, privy-v2, *embedded*, etc.) consistently
  // with the rest of the app.
  const privyEmbeddedEoaAddress = useMemo(() => {
    const candidates = (Array.isArray(privyWallets) ? privyWallets : []) as Array<
      Record<string, unknown>
    >
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

  // Coinbase/Base in-app browsers can block or substitute the popup signing
  // context. Recovery requires an external browser so keys.coinbase.com can
  // hand the WebAuthn challenge to the real passkey provider.
  // See `lib/wallet/inAppBrowser.ts` for full notes.
  const inAppEnv = useMemo(() => detectInAppEnvironment(), [])
  const externalAddOwnerUrl = useMemo(() => externalBrowserUrlFor('/add-owner'), [])

  const handleInstall = async () => {
    await onEnable4626Signing()
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <PageMeta
        title="Install signing key"
        description="Install your Privy embedded signer onto your canonical Coinbase Smart Wallet so 4626 can prepare and submit user operations on your behalf without prompting for a passkey on every action."
        canonicalPath="/add-owner"
      />
      <div className="mx-auto w-full max-w-xl px-6 py-16 space-y-6">
        <div className="space-y-2">
          <div className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">
            Account setup
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">Install signing key</h1>
          <p className="text-sm text-zinc-400">
            Install your Privy embedded signer onto your canonical Coinbase Smart Wallet as
            an additional owner. The primary path asks your Coinbase passkey to authorize
            <code className="mx-1 font-mono text-zinc-300">addOwnerAddress(privyEoa)</code>
            through the keys.coinbase.com popup; no EOA private key is required.
          </p>
        </div>

        {!privyAuthed ? (
          <div className="card rounded-2xl border border-white/10 bg-black/40 p-6 space-y-3">
            <p className="text-sm text-zinc-300">
              Sign in to install the signing key on your wallet.
            </p>
            <button
              type="button"
              onClick={() => void login({ loginMethods: ['email', 'wallet'] } as any)}
              className="btn-accent btn-no-icon inline-flex"
            >
              Sign in / Continue
            </button>
          </div>
        ) : null}

        {privyAuthed && loading ? (
          <div className="rounded-2xl border border-white/10 bg-black/40 p-6 text-sm text-zinc-400">
            Loading your account…
          </div>
        ) : null}

        {inAppEnv?.isAnyWalletInApp && installedAsOwner !== true ? (
          <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 p-6 space-y-4 text-amber-100">
            <div className="space-y-1">
              <div className="text-[11px] uppercase tracking-[0.2em] text-amber-300/80">
                Open in your browser
              </div>
              <div className="text-sm font-semibold">
                {inAppEnv.isCoinbaseInApp
                  ? "Coinbase Wallet's in-app browser can block the passkey popup"
                  : "This in-app browser can block the passkey popup"}
              </div>
            </div>
            <p className="text-xs leading-relaxed text-amber-100/85">
              Installing the signer requires a WebAuthn assertion from the Coinbase
              passkey owner of your smart wallet. In-app browsers can block or replace
              that popup signing context, which is why the &ldquo;Review request&rdquo; sheet
              may show &ldquo;Error generating transaction&rdquo;.
            </p>
            <p className="text-xs leading-relaxed text-amber-100/85">
              Tap below to open this page in your phone&apos;s default browser, then approve
              the Coinbase passkey prompt from there.
            </p>
            <a
              href={externalAddOwnerUrl}
              target="_blank"
              rel="noopener noreferrer external"
              className="inline-flex items-center justify-center rounded-xl bg-amber-300 px-4 py-2 text-xs font-semibold text-black hover:bg-amber-200"
            >
              Open 4626.fun/add-owner in browser
            </a>
            <details className="text-[11px] text-amber-100/70">
              <summary className="cursor-pointer">Why does this happen?</summary>
              <div className="mt-2 space-y-1">
                <div>
                  Detected: <code className="font-mono">isCoinbaseWallet=
                  {String(Boolean((window as any)?.ethereum?.isCoinbaseWallet))}</code>,{' '}
                  <code className="font-mono">isCoinbaseBrowser=
                  {String(Boolean((window as any)?.ethereum?.isCoinbaseBrowser))}</code>
                </div>
                <div>
                  This is a known Coinbase Wallet behaviour and not a problem with your
                  wallet&apos;s on-chain state. Your owner list is unchanged.
                </div>
              </div>
            </details>
          </div>
        ) : null}

        {privyAuthed && !loading ? (
          <div className="card rounded-2xl border border-white/10 bg-black/40 p-6 space-y-4">
            {!canonicalCswAddress ? (
              <div className="rounded-xl border border-white/10 bg-black/30 p-4 text-sm text-zinc-400">
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
                <dl className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
                  <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                    <dt className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">
                      Canonical CSW
                    </dt>
                    <dd className="mt-1 break-all font-mono text-zinc-300">
                      {canonicalCswAddress}
                    </dd>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                    <dt className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">
                      Privy signer
                    </dt>
                    <dd className="mt-1 break-all font-mono text-zinc-300">
                      {privyEmbeddedEoaAddress ?? 'resolving…'}
                    </dd>
                  </div>
                </dl>

                {installedAsOwner === true ? (
                  <div className="rounded-xl border border-emerald-400/25 bg-emerald-500/10 p-4 text-xs text-emerald-100">
                    Signing key is already installed on this wallet. No further action
                    needed.
                  </div>
                ) : null}

                {installedAsOwner !== true && onchainEoaOwnerCandidates.length > 0 ? (
                  <div className="rounded-xl border border-white/10 bg-black/30 p-4 text-xs space-y-2">
                    <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">
                      Optional EOA-owner fallback
                    </div>
                    <p className="leading-relaxed text-zinc-400">
                      If the passkey popup is unavailable and you can connect one of these
                      on-chain EOA owners, 4626 can use that owner as a fallback. The primary
                      install button below does not require one of these private keys.
                    </p>
                    <ul className="space-y-1">
                      {onchainEoaOwnerCandidates.map((c) => {
                        const matched =
                          connectedOnchainEoaOwner?.ownerAddress.toLowerCase() ===
                          c.ownerAddress.toLowerCase()
                        return (
                          <li
                            key={c.ownerAddress}
                            className={`flex items-center gap-2 break-all font-mono ${
                              matched ? 'text-emerald-300' : 'text-zinc-400'
                            }`}
                          >
                            <span className="text-[10px]">[{c.index}]</span>
                            <span>{c.ownerAddress}</span>
                            {matched ? <span className="text-[10px]">✓ connected</span> : null}
                          </li>
                        )
                      })}
                    </ul>
                    {!connectedOnchainEoaOwner ? (
                      <p className="text-[11px] text-zinc-500">
                        No connected wallet matches these EOA owners. That is okay for the
                        passkey path; use this list only if you intentionally want the fallback.
                      </p>
                    ) : null}
                  </div>
                ) : null}

                <div className="space-y-3">
                  <button
                    type="button"
                    disabled={
                      advancedBusy ||
                      installedAsOwner === true ||
                      (inAppEnv?.isAnyWalletInApp ?? false)
                    }
                    onClick={() => void handleInstall()}
                    className="btn-accent btn-no-icon inline-flex"
                  >
                    {advancedBusy
                      ? 'Installing…'
                      : installedAsOwner === true
                        ? 'Already installed'
                        : inAppEnv?.isAnyWalletInApp
                          ? 'Open in browser to install'
                          : 'Install signing key'}
                  </button>
                  <p className="text-[11px] leading-relaxed text-zinc-500">
                    The Coinbase passkey owner will sign the replayable owner-install request
                    for{' '}
                    <code className="font-mono text-zinc-400">
                      addOwnerAddress(privyEoa)
                    </code>{' '}
                    on your canonical CSW. Gas is handled through the prepared-calls flow.
                  </p>
                </div>

                {notice ? (
                  <div className="rounded-xl border border-emerald-400/25 bg-emerald-500/10 p-3 text-xs text-emerald-100">
                    {notice}
                  </div>
                ) : null}

                {error ? (
                  <div className="space-y-2">
                    <div className="rounded-xl border border-rose-400/25 bg-rose-500/10 p-3 text-xs text-rose-100">
                      {error}
                    </div>
                    <button
                      type="button"
                      onClick={() => void onResetOwnerApproval()}
                      className="rounded-lg border border-white/15 px-3 py-1.5 text-[11px] text-zinc-300 hover:border-white/30"
                    >
                      Reset and retry
                    </button>
                  </div>
                ) : null}
              </>
            )}
          </div>
        ) : null}

        <div className="text-[11px] text-zinc-500">
          Need to install a different EOA address?{' '}
          <Link to="/accounts" className="underline underline-offset-2">
            Use the advanced co-owner flow on /accounts
          </Link>
          .
        </div>
      </div>
    </div>
  )
}

export default AddOwnerPage

