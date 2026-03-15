import { Link, useLocation } from 'react-router-dom'

import { ConnectButton } from '@/components/ConnectButton'
import { useAdminStatus } from '@/hooks/useAdminStatus'
import { isPublicSiteMode } from '@/lib/flags'
import { getHostMode } from '@/lib/host'
import { Logo } from './Logo'

type NavItem = {
  label: string
  to: string
  activePrefixes?: string[]
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Trade', to: '/swap', activePrefixes: ['/swap'] },
  { label: 'Explore', to: '/explore/creators', activePrefixes: ['/explore'] },
  { label: 'Vault', to: '/deploy', activePrefixes: ['/deploy', '/status', '/vault'] },
  { label: 'Wallet', to: '/portfolio', activePrefixes: ['/portfolio'] },
]

const NAV_ITEMS_PUBLIC: NavItem[] = [
  { label: 'Waitlist', to: '/#waitlist', activePrefixes: ['/#waitlist', '/waitlist'] },
]

const ADMIN_ITEM: NavItem = { label: 'Admin', to: '/admin/waitlist', activePrefixes: ['/admin'] }

function isActiveLink(location: { pathname: string; hash?: string }, item: NavItem): boolean {
  const pathname = location.pathname
  const hash = location.hash ?? ''

  // Hash links (e.g. "/#waitlist") are active only when both match.
  if (item.to.includes('#')) {
    const [toPath, toHash = ''] = item.to.split('#')
    const wantPath = toPath || '/'
    const wantHash = `#${toHash}`
    if (pathname === wantPath && hash === wantHash) return true
    // Back-compat: allow `/waitlist` route to count as active for the waitlist item.
    const prefixes = item.activePrefixes && item.activePrefixes.length > 0 ? item.activePrefixes : [item.to]
    return prefixes.includes('/waitlist') && pathname === '/waitlist'
  }

  if (item.to === '/') return pathname === '/'
  const prefixes = item.activePrefixes && item.activePrefixes.length > 0 ? item.activePrefixes : [item.to]
  return prefixes.some((p) => (p === '/' ? pathname === '/' : pathname === p || pathname.startsWith(`${p}/`)))
}

export function VaultNavBar() {
  const location = useLocation()
  const publicMode = isPublicSiteMode()
  const hostMode = getHostMode()
  const { isAdmin } = useAdminStatus()
  const baseItems = publicMode || hostMode === 'marketing' ? NAV_ITEMS_PUBLIC : NAV_ITEMS
  const items = isAdmin && hostMode !== 'marketing' ? [...baseItems, ADMIN_ITEM] : baseItems
  const brandHref = hostMode === 'marketing' ? '/' : '/swap'
  const showConnect = !publicMode && hostMode !== 'marketing'

  const renderNavLinks = (compact: boolean) =>
    items.map((item) => {
      const active = isActiveLink(location, item)
      return (
        <Link
          key={item.to}
          to={item.to}
          className={`group relative inline-flex items-center justify-center rounded-full border transition-all duration-200 ${
            compact ? 'px-2 py-1.5 lg:px-2.5 lg:py-2' : 'px-3 py-2.5'
          } ${
            active
              ? 'border-white/18 bg-white/12 shadow-[0_10px_22px_-16px_rgba(0,0,0,0.9)]'
              : 'border-transparent hover:border-white/10 hover:bg-white/6'
          }`}
        >
          <span
            className={`relative z-10 font-medium ${
              compact ? 'text-[10px] tracking-[0.02em]' : 'text-[11px] tracking-[0.01em]'
            } ${active ? 'text-white' : 'text-zinc-500 group-hover:text-brand-accent'}`}
          >
            {item.label}
          </span>
        </Link>
      )
    })

  return (
    <header className="hidden md:block sticky top-0 left-0 right-0 z-50 transition-all duration-500">
      <div className="absolute inset-0 bg-vault-bg/70 backdrop-blur-xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.8)]" />

      <div className="absolute bottom-0 left-0 right-0 h-px bg-linear-to-r from-transparent via-brand-primary/25 to-transparent opacity-60" />

      <div className="relative max-w-[1400px] mx-auto px-4 md:px-8 lg:px-10 xl:px-12 py-2 xl:py-0">
        <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 lg:gap-5 xl:h-24">
          <Link to={brandHref} className="flex items-center gap-3 lg:gap-4 group cursor-pointer shrink-0">
            <Logo showText={false} width={40} height={40} />
            <div className="flex flex-col justify-center">
              <span className="text-[13px] lg:text-sm tracking-[0.2em] lg:tracking-widest text-white font-medium transition-colors duration-300 leading-none">
                4626
                <span className="text-transparent bg-clip-text bg-linear-to-r from-brand-primary to-brand-accent ml-0.5">.fun</span>
              </span>
              <span className="mt-1 hidden xl:block text-[9px] tracking-[0.22em] uppercase text-zinc-500 leading-none">
                Earn Together
              </span>
            </div>
          </Link>

          <nav className="hidden xl:flex min-w-0 items-center justify-center">
            <div className="flex min-w-0 items-center justify-center gap-2 overflow-x-auto whitespace-nowrap scrollbar-hide px-1">
              {renderNavLinks(false)}
            </div>
          </nav>

          <div className="hidden md:flex items-center justify-end gap-2 shrink-0">
            {showConnect ? (
              <div className="origin-right scale-[0.78] lg:scale-[0.88] xl:scale-100 transition-transform">
                <ConnectButton />
              </div>
            ) : null}
          </div>
        </div>

        <nav className="mt-2 lg:mt-1 hidden md:flex xl:hidden min-w-0 items-center">
          <div className="mx-auto w-full max-w-3xl rounded-2xl border border-white/10 bg-linear-to-b from-white/8 to-white/3 p-1 backdrop-blur-sm">
            <div className="flex w-full min-w-0 items-center justify-center gap-1 overflow-x-auto whitespace-nowrap scrollbar-hide px-0.5">
              {renderNavLinks(true)}
            </div>
          </div>
        </nav>

        {!showConnect ? (
          <div className="mt-1 hidden md:block xl:hidden">
            <div className="h-px w-full bg-linear-to-r from-transparent via-white/8 to-transparent" />
          </div>
        ) : (
          <div className="mt-1 hidden md:block xl:hidden">
            <div className="h-px w-full bg-linear-to-r from-transparent via-brand-primary/15 to-transparent" />
          </div>
        )}
      </div>
    </header>
  )
}
