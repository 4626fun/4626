import { useMemo } from 'react'
import { Link } from 'react-router-dom'

import { PageMeta } from '@/components/seo/PageMeta'
import { useAccountSetupController } from '@/features/accountSetup/useAccountSetupController'
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
 * Submission lane: the canonical Coinbase passkey (owner[0]) signs
 * `executeWithoutChainIdValidation([addOwnerAddress(privyEoa)])` via Coinbase
 * `wallet_prepareCalls` / `wallet_sendPreparedCalls`. This is the path proven
 * by the May 4 owner[2] install (userOpHash 0x70255628…5b1a, AddOwner event
 * fired at index 2, success=true on EntryPoint v0.6). See RECOVERY.md.
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
  } = controller

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
            an additional owner. The address is read from your authenticated session — no
            paste required. Your passkey signs the install on-chain through the same flow
            you used during waitlist setup.
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

                <div className="space-y-3">
                  <button
                    type="button"
                    disabled={advancedBusy || installedAsOwner === true}
                    onClick={() => void handleInstall()}
                    className="btn-accent btn-no-icon inline-flex"
                  >
                    {advancedBusy
                      ? 'Installing…'
                      : installedAsOwner === true
                        ? 'Already installed'
                        : 'Install signing key'}
                  </button>
                  <p className="text-[11px] leading-relaxed text-zinc-500">
                    Your Coinbase passkey will be prompted to authorize a single
                    transaction:{' '}
                    <code className="font-mono text-zinc-400">
                      addOwnerAddress(privyEoa)
                    </code>{' '}
                    on your canonical CSW. Gas is sponsored by 4626.
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

