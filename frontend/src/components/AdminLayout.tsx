import { useMemo } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { ShieldCheck } from 'lucide-react'
import { useAccount } from 'wagmi'

import { useSiweAuth } from '@/hooks/useSiweAuth'

const ADMIN_TABS = [
  {
    label: 'Waitlist',
    to: '/admin/waitlist',
    description: 'Signups and verification metadata',
  },
  {
    label: 'Creator Access',
    to: '/admin/creator-access',
    description: 'Allowlist requests and approvals',
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
  const hasSessionAddress = Boolean(authAddress)

  const hasAddressMismatch = address && authAddress && address.toLowerCase() !== authAddress.toLowerCase()
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

            {hasAddressMismatch ? (
              <>
                <div className="text-xs text-amber-400">
                  Session mismatch: signed in as a different wallet.
                </div>
                <div className="text-[11px] text-zinc-500">
                  Refresh the session to match your connected wallet.
                </div>
                <div className="flex flex-col items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void handleSignIn()}
                    disabled={authBusy}
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-white/5 border border-white/10 px-5 py-3 text-sm text-zinc-200 hover:text-white hover:border-white/20 transition-colors disabled:opacity-60"
                  >
                    {authBusy ? 'Refreshing...' : 'Refresh session'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void signOut()}
                    disabled={authBusy}
                    className="text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors"
                  >
                    {authBusy ? 'Signing out...' : 'Sign out'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="text-xs text-zinc-600">Sign in (no transaction) to verify admin access.</div>
                <button
                  type="button"
                  onClick={() => void handleSignIn()}
                  disabled={authBusy}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-white/5 border border-white/10 px-5 py-3 text-sm text-zinc-200 hover:text-white hover:border-white/20 transition-colors disabled:opacity-60"
                >
                  {authBusy ? 'Signing in...' : 'Sign in with wallet'}
                </button>
              </>
            )}

            {authError ? <div className="text-[11px] text-red-400/90">{authError}</div> : null}
            <div className="text-[10px] text-zinc-700 mt-2 space-y-1">
              <div>Connected: {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'No'}</div>
              <div>Auth: {authAddress ? `${authAddress.slice(0, 6)}...${authAddress.slice(-4)}` : 'Not signed in'}</div>
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
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-xs text-amber-200">
          Connected wallet and session wallet differ. Admin access uses your active session; refresh sign-in if you need to switch.
        </div>
      ) : null}
      {/* Tab navigation */}
      <div className="rounded-xl border border-white/10 bg-black/30 p-2">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
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
      <Outlet />
    </div>
  )
}
