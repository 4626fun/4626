import { useMemo } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ShieldCheck } from 'lucide-react'
import { useAccount } from 'wagmi'

import { PageTransitionNestedOutlet } from '@/components/layout/PageTransition'

import { useSiweAuth } from '@/hooks/useSiweAuth'
import { deriveAdminWalletRoles } from '@/lib/wallet/adminWalletRoles'

const ADMIN_TABS = [
  {
    label: 'Waitlist',
    to: '/admin/waitlist',
    description: 'Signups and verification',
  },
  {
    label: 'Vault Allowlist',
    to: '/admin/creator-access',
    description: 'Launch requests',
  },
  {
    label: 'Agent Setup',
    to: '/admin/agent-setup',
    description: 'XMTP and gating',
  },
  {
    label: 'Ops',
    to: '/admin/ops',
    description: 'Manifests and withdrawals',
  },
  {
    label: 'Deploy Strategies',
    to: '/admin/deploy-strategies',
    description: 'Charm + Ajna',
  },
  {
    label: 'Image Gen',
    to: '/admin/imagegen',
    description: 'Composition workflow',
  },
  {
    label: 'UserOp Health',
    to: '/admin/userop-health',
    description: 'Paymaster telemetry',
  },
  {
    label: 'Control Plane',
    to: '/admin/control-plane',
    description: 'Operation lifecycle',
  },
] as const

function shortAddr(value: string | null | undefined): string {
  if (!value) return '—'
  if (value.length < 10) return value
  return `${value.slice(0, 6)}…${value.slice(-4)}`
}

/**
 * Shared layout for all /admin/* routes.
 *
 * Handles:
 *  1. Connect-wallet gate
 *  2. SIWE sign-in gate
 *  3. Left-rail navigation between admin sections
 *
 * Once authenticated, child routes render via <Outlet />.
 */
export function AdminLayout() {
  const { address } = useAccount()
  const { busy: authBusy, error: authError, signIn, signOut, authAddress } = useSiweAuth()
  const location = useLocation()
  const walletRoles = useMemo(
    () =>
      deriveAdminWalletRoles({
        sessionWallet: authAddress,
        connectedWallet: address,
      }),
    [address, authAddress],
  )
  const hasSessionAddress = Boolean(walletRoles.adminWallet)
  const hasAddressMismatch = Boolean(walletRoles.sessionWallet && walletRoles.connectedWallet && !walletRoles.connectedMatchesSession)
  const handleSignIn = async () => {
    if (authBusy) return
    if (hasAddressMismatch) {
      await signOut()
    }
    await signIn({ method: 'siwe' })
  }

  const activeTab = useMemo(() => {
    const path = location.pathname
    return ADMIN_TABS.find((tab) => path === tab.to || path.startsWith(`${tab.to}/`)) ?? null
  }, [location.pathname])

  if (!hasSessionAddress) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="max-w-md w-full">
          <div className="rounded-xl border border-white/10 bg-black/30 p-6 space-y-4 text-center">
            <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto">
              <ShieldCheck className="w-7 h-7 text-zinc-300" />
            </div>
            <div className="font-display text-xl text-white">Admin</div>
            <div className="text-xs text-zinc-600">Sign in (no transaction) to verify admin access.</div>
            <button
              type="button"
              onClick={() => void handleSignIn()}
              disabled={authBusy}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-white/5 border border-white/10 px-5 py-3 text-sm text-zinc-200 hover:text-white hover:border-white/20 transition-colors disabled:opacity-60"
            >
              {authBusy ? 'Signing in...' : 'Restore admin connection'}
            </button>

            {authError ? <div className="text-[11px] text-red-400/90">{authError}</div> : null}
            <div className="text-[10px] text-zinc-700 mt-2 space-y-1">
              <div>Connected signer: {address ? shortAddr(address) : 'No wallet'}</div>
              <div>Admin session: {authAddress ? shortAddr(authAddress) : 'Not signed in'}</div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6 sm:py-10">
      {hasAddressMismatch ? (
        <div className="mb-6 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-xs text-amber-200 space-y-3">
          <div>
            Connected wallet and session wallet differ. Admin authorization uses your active session; signatures and
            transactions use your connected signer.
          </div>
          <div className="text-[11px] text-amber-100/90 space-y-1">
            <div>Admin session: {shortAddr(walletRoles.sessionWallet)}</div>
            <div>Connected signer: {shortAddr(walletRoles.connectedWallet)}</div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void handleSignIn()}
              disabled={authBusy}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-amber-400/10 border border-amber-300/20 px-3 py-2 text-[11px] text-amber-100 hover:bg-amber-400/15 transition-colors disabled:opacity-60"
            >
              {authBusy ? 'Switching...' : 'Switch admin session to connected wallet'}
            </button>
            <button
              type="button"
              onClick={() => void signOut()}
              disabled={authBusy}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-transparent border border-white/10 px-3 py-2 text-[11px] text-zinc-300 hover:text-white hover:border-white/20 transition-colors disabled:opacity-60"
            >
              {authBusy ? 'Signing out...' : 'Sign out current session'}
            </button>
          </div>
        </div>
      ) : null}

      <div className="flex flex-col lg:flex-row lg:items-start gap-4 lg:gap-8">
        <aside className="lg:w-56 xl:w-60 shrink-0">
          <div className="lg:sticky lg:top-20 space-y-3">
            <div className="px-1">
              <div className="text-[10px] uppercase tracking-[0.14em] text-zinc-600">Admin</div>
              <div className="mt-1 text-[11px] text-zinc-500 font-mono">{shortAddr(walletRoles.adminWallet)}</div>
            </div>

            <nav
              aria-label="Admin sections"
              className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible -mx-1 px-1 pb-1 lg:pb-0 scrollbar-thin"
            >
              {ADMIN_TABS.map((tab) => {
                const active = activeTab?.to === tab.to
                return (
                  <Link
                    key={tab.to}
                    to={tab.to}
                    className={`shrink-0 lg:shrink rounded-lg px-3 py-2.5 border text-left transition-colors min-w-[9.5rem] lg:min-w-0 ${
                      active
                        ? 'border-brand-primary/40 bg-brand-primary/10 text-zinc-100'
                        : 'border-transparent lg:border-white/5 bg-black/20 text-zinc-400 hover:text-zinc-200 hover:border-white/15'
                    }`}
                  >
                    <div className="text-[12px] font-medium leading-tight">{tab.label}</div>
                    <div className="hidden lg:block text-[10px] text-zinc-600 mt-0.5 leading-snug">{tab.description}</div>
                  </Link>
                )
              })}
            </nav>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <PageTransitionNestedOutlet />
        </main>
      </div>
    </div>
  )
}
