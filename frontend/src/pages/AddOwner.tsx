import { useMemo } from 'react'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/Button'
import { PageMeta } from '@/components/seo/PageMeta'
import { AddOwnerSigningPanel } from '@/features/accountSetup/AddOwnerSigningPanel'
import { useAccountSetupController } from '@/features/accountSetup/useAccountSetupController'
import { pickPrivyEmbeddedEoaWallet } from '@/lib/privy/privyEmbeddedEoa'

export function AddOwnerPage() {
  const controller = useAccountSetupController({ zoraReturnPath: '/add-owner' })
  const {
    canonicalCswAddress,
    loading,
    login,
    loadMe,
    privyAuthed,
    privyWallets,
  } = controller

  const privyEmbeddedEoaAddress = useMemo(() => {
    const candidates = (Array.isArray(privyWallets) ? privyWallets : []) as Array<Record<string, unknown>>
    const found = pickPrivyEmbeddedEoaWallet(candidates)
    const address = found?.address
    return typeof address === 'string' ? address.toLowerCase() : null
  }, [privyWallets])

  return (
    <div className="min-h-screen bg-black text-white">
      <PageMeta
        title="Install signing key"
        description="Install your Privy embedded signer onto your canonical Coinbase Smart Wallet so 4626 can prepare and submit user operations on your behalf without prompting for a passkey on every action."
        canonicalPath="/add-owner"
      />
      <div className="mx-auto w-full max-w-xl px-6 py-16 space-y-6">
        <div className="space-y-2">
          <div className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">Account setup</div>
          <h1 className="text-3xl font-semibold tracking-tight">Install signing key</h1>
          <p className="text-sm text-zinc-400">
            Install your Privy embedded signer onto your canonical Coinbase Smart Wallet as an additional
            owner. Passkey owners approve through Coinbase prepared calls; connected EOA owners can use
            the Relay route.
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
                    <dt className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">Canonical CSW</dt>
                    <dd className="mt-1 break-all font-mono text-zinc-300">{canonicalCswAddress}</dd>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                    <dt className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">Privy signer</dt>
                    <dd className="mt-1 break-all font-mono text-zinc-300">
                      {privyEmbeddedEoaAddress ?? 'resolving…'}
                    </dd>
                  </div>
                </dl>
                <AddOwnerSigningPanel
                  controller={controller}
                  variant="standalone"
                  onInstallSuccess={() => loadMe({ showSpinner: false })}
                />
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
