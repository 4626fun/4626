import { Suspense, useEffect, useState } from 'react'
import { Outlet, Link, useLocation } from 'react-router-dom'
import { ArrowLeftRight, Droplets, LayoutDashboard, Mail, ShieldCheck, Wallet } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { VaultNavBar } from './brand/VaultNavBar'
import { ChatWidget } from './chat/ChatWidget'
import { AccountModeIndicator } from './account/AccountModeIndicator'
import { isPublicSiteMode } from '@/lib/flags'
import { getHostMode } from '@/lib/host'
import { useAdminStatus } from '@/hooks/useAdminStatus'
import { apiFetch } from '@/lib/apiBase'

type MobileNavItem = {
  label: string
  path: string
  icon: any
  activePrefixes?: string[]
}

type ApiEnvelope<T> = { success: boolean; data?: T; error?: string }
type ResolvedAgentSubdomain = {
  label: string
  record: {
    ownerAddress: string
    fullName: string
    metadataLensUri: string | null
  } | null
}

const navItems: MobileNavItem[] = [
  { path: '/swap', icon: ArrowLeftRight, label: 'Trade', activePrefixes: ['/swap'] },
  { path: '/explore/creators', icon: LayoutDashboard, label: 'Explore', activePrefixes: ['/explore'] },
  { path: '/deploy', icon: Droplets, label: 'Vault', activePrefixes: ['/deploy', '/status', '/vault'] },
  { path: '/portfolio', icon: Wallet, label: 'Portfolio', activePrefixes: ['/portfolio'] },
]

const navItemsPublic: MobileNavItem[] = [
  { path: '/#waitlist', icon: Mail, label: 'Waitlist', activePrefixes: ['/#waitlist', '/waitlist'] },
]

const adminNavItem: MobileNavItem = { path: '/admin/waitlist', icon: ShieldCheck, label: 'Admin', activePrefixes: ['/admin'] }

function isActiveLink(location: { pathname: string; hash?: string }, item: MobileNavItem): boolean {
  const pathname = location.pathname
  const hash = location.hash ?? ''

  if (item.path.includes('#')) {
    const [toPath, toHash = ''] = item.path.split('#')
    const wantPath = toPath || '/'
    const wantHash = `#${toHash}`
    if (pathname === wantPath && hash === wantHash) return true
    return item.activePrefixes?.includes('/waitlist') ? pathname === '/waitlist' : false
  }

  if (item.path === '/') return pathname === '/'
  const prefixes = item.activePrefixes && item.activePrefixes.length > 0 ? item.activePrefixes : [item.path]
  return prefixes.some((p) => (p === '/' ? pathname === '/' : pathname === p || pathname.startsWith(`${p}/`)))
}

export function Layout() {
  const location = useLocation()
  const publicMode = isPublicSiteMode()
  const hostMode = getHostMode()
  const { isAdmin } = useAdminStatus()
  const [isMobileChatOverlayActive, setIsMobileChatOverlayActive] = useState(false)
  const shouldOverlayMobileNav = location.pathname.startsWith('/explore')
  const showAccountMode = hostMode !== 'marketing' && !publicMode
  const baseItems = publicMode || hostMode === 'marketing' ? navItemsPublic : navItems
  const items = isAdmin && hostMode !== 'marketing' ? [...baseItems, adminNavItem] : baseItems
  const resolvedSubdomain = useQuery({
    queryKey: ['agents', 'subdomain-resolve', hostMode],
    enabled: hostMode === 'app',
    staleTime: 60_000,
    queryFn: async (): Promise<ResolvedAgentSubdomain | null> => {
      const res = await apiFetch('/api/agents/subdomains/resolve', { method: 'GET' })
      const json = (await res.json().catch(() => null)) as ApiEnvelope<ResolvedAgentSubdomain> | null
      if (!res.ok || !json?.success) return null
      return json.data ?? null
    },
  })

  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleOverlayChange = (event: Event) => {
      const customEvent = event as CustomEvent<{ active?: boolean }>
      setIsMobileChatOverlayActive(Boolean(customEvent.detail?.active))
    }

    window.addEventListener('vault-mobile-chat-overlay-change', handleOverlayChange as EventListener)
    return () => window.removeEventListener('vault-mobile-chat-overlay-change', handleOverlayChange as EventListener)
  }, [])

  return (
    <div className="min-h-screen flex flex-col bg-vault-bg">
      <VaultNavBar />
      {showAccountMode ? <AccountModeIndicator /> : null}
      {resolvedSubdomain.data?.record ? (
        <div className="border-b border-vault-border/60 bg-black/50">
          <div className="max-w-7xl mx-auto px-6 py-2 text-[11px] uppercase tracking-[0.14em] text-vault-subtext flex items-center justify-between gap-2">
            <span>
              Agent subdomain: <span className="text-vault-text">{resolvedSubdomain.data.record.fullName}</span>
            </span>
            <Link className="text-brand-primary hover:text-brand-primary/80" to={`/portfolio?address=${resolvedSubdomain.data.record.ownerAddress}`}>
              View owner profile
            </Link>
          </div>
        </div>
      ) : null}

      {/* Skip to content link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[200] focus:rounded-lg focus:bg-brand-primary focus:px-4 focus:py-2 focus:text-white focus:text-sm focus:font-medium"
      >
        Skip to content
      </a>

      {/* Main */}
      <main id="main-content" className={`flex-1 ${shouldOverlayMobileNav ? 'pb-0' : 'pb-24'} md:pb-0`}>
        <Suspense
          fallback={
            <div className="max-w-7xl mx-auto px-6 py-12">
              <div className="flex items-center gap-3 text-xs font-mono uppercase tracking-[0.2em] text-vault-subtext" role="status">
                <div className="h-5 w-5 rounded-full border-2 border-vault-border border-t-brand-primary animate-spin" aria-hidden="true" />
                Loading…
              </div>
            </div>
          }
        >
          <Outlet />
        </Suspense>
      </main>

      {/* Chat widget — app domain only (XMTP installations are per-origin; avoid 4626.fun) */}
      {hostMode === 'app' && <ChatWidget />}

      {/* Mobile Nav - Minimal */}
      <nav
        aria-label="Mobile navigation"
        className={`md:hidden fixed bottom-0 left-0 right-0 z-70 border-t border-vault-border/60 bg-vault-bg/80 backdrop-blur-xl ${
          isMobileChatOverlayActive ? 'hidden' : ''
        }`}
      >
        <div className="flex items-center justify-around py-4 px-6" role="list">
          {items.map((item) => {
            const { path, icon: Icon, label } = item
            const isActive = isActiveLink(location, item)
            return (
              <Link
                key={path}
                to={path}
                aria-label={label}
                aria-current={isActive ? 'page' : undefined}
                className="flex flex-col items-center justify-center gap-2 group min-h-11 min-w-[56px] px-2"
                role="listitem"
              >
                <Icon
                  aria-hidden="true"
                  className={`w-5 h-5 transition-colors ${
                    isActive ? 'text-vault-text' : 'text-vault-subtext group-hover:text-vault-text'
                  }`}
                />
                <span className={`label ${isActive ? 'text-vault-text' : 'text-vault-subtext'}`}>
                  {label}
                </span>
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
