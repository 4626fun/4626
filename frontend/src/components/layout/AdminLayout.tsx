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
    description: 'Signups and verification metadata',
  },
  {
    label: 'Vault Allowlist',
    to: '/admin/creator-access',
    description: 'Vault launch requests and approved wallets',
  },
  {
    label: 'Agent Setup',
    to: '/admin/agent-setup',
    description: 'XMTP agent, vault link, gating',
  },
  {
    label: 'Ops',
    to: '/admin/ops',
    description: 'Manifest signing, legacy withdrawals',
  },
  {
    label: 'Deploy Strategies',
    to: '/admin/deploy-strategies',
    description: 'Charm + Ajna strategy deployments',
  },
  {
    label: 'Image Gen',
    to: '/admin/imagegen',
    description: 'Reference-guided composition workflow',
  },
  {
    label: 'UserOp Health',
    to: '/admin/userop-health',
    description: 'ERC-4337 / paymaster telemetry',
  },
  {
    label: 'Control Plane',
    to: '/admin/control-plane',
    description: 'Operation lifecycle, timelines, stuck runs',
  },
] as const

/**
 * Shared layout for all /admin/* routes.
 *
 * Handles:
 *  1. Connect-wallet gate
 *  2. SIWE sign-in gate
 *  3. Tab navigation between admin sections
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

  // Determine which tab is active (support prefix matching for nested routes)
  const activeTab = useMemo(() => {
    const path = location.pathname
    // Check most-specific first
    return ADMIN_TABS.find((tab) => path === tab.to || path.startsWith(tab.to + '/')) ?? null
  }, [location.pathname])

  // --- Gate: no active session ---
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
              <div>Connected signer: {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'No wallet'}</div>
              <div>Admin session: {authAddress ? `${authAddress.slice(0, 6)}...${authAddress.slice(-4)}` : 'Not signed in'}</div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // --- Authenticated: show tabs + child route ---
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 space-y-6">
      {hasAddressMismatch ? (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-xs text-amber-200 space-y-3">
          <div>
            Connected wallet and session wallet differ. Admin authorization uses your active session; signatures and transactions use your connected
            signer.
          </div>
          <div className="text-[11px] text-amber-100/90 space-y-1">
            <div>
              Admin session: {walletRoles.sessionWallet ? `${walletRoles.sessionWallet.slice(0, 6)}...${walletRoles.sessionWallet.slice(-4)}` : 'Missing'}
            </div>
            <div>
              Connected signer:{' '}
              {walletRoles.connectedWallet ? `${walletRoles.connectedWallet.slice(0, 6)}...${walletRoles.connectedWallet.slice(-4)}` : 'No wallet'}
            </div>
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
      {/* Tab navigation */}
      <div className="rounded-xl border border-white/10 bg-black/30 p-2">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-8">
          {ADMIN_TABS.map((tab) => {
            const active = activeTab?.to === tab.to
            return (
              <Link
                key={tab.to}
                to={tab.to}
                className={`rounded-lg px-4 py-3 border text-left transition-colors ${
                  active
                    ? 'border-brand-primary/40 bg-brand-primary/10 text-zinc-100'
                    : 'border-white/10 bg-black/20 text-zinc-400 hover:text-zinc-200 hover:border-white/20'
                }`}
              >
                <div className="text-[11px] font-medium">{tab.label}</div>
                <div className="text-xs text-zinc-500 mt-1">{tab.description}</div>
              </Link>
            )
          })}
        </div>
      </div>

      {/* Child route */}
      <PageTransitionNestedOutlet />
    </div>
  )
}
