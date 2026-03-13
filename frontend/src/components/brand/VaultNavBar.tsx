import { Link, useLocation } from 'react-router-dom'
import { Menu } from 'lucide-react'
import { motion } from 'framer-motion'

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
  { label: 'TRADE', to: '/swap', activePrefixes: ['/swap'] },
  { label: 'EXPLORE', to: '/explore/creators', activePrefixes: ['/explore'] },
  { label: 'VAULT', to: '/deploy', activePrefixes: ['/deploy', '/status', '/vault'] },
  { label: 'PORTFOLIO', to: '/portfolio', activePrefixes: ['/portfolio'] },
]

const NAV_ITEMS_PUBLIC: NavItem[] = [
  { label: 'WAITLIST', to: '/#waitlist', activePrefixes: ['/#waitlist', '/waitlist'] },
]

const ADMIN_ITEM: NavItem = { label: 'ADMIN', to: '/admin/waitlist', activePrefixes: ['/admin'] }

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

  return (
    <header className="hidden md:block sticky top-0 left-0 right-0 z-50 transition-all duration-500">
      <div className="absolute inset-0 bg-vault-bg/70 backdrop-blur-xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.8)]" />

      <div className="absolute bottom-0 left-0 right-0 h-px bg-linear-to-r from-transparent via-brand-primary/25 to-transparent opacity-60" />

      <div className="relative max-w-[1400px] mx-auto px-6 md:px-12 h-24 flex items-center justify-between">
        <Link to={brandHref} className="flex items-center gap-4 group cursor-pointer">
          <Logo showText={false} width={40} height={40} />
          <div className="flex flex-col justify-center">
            <span className="text-sm tracking-widest text-white font-medium transition-colors duration-300 leading-none">
              4626
              <span className="text-transparent bg-clip-text bg-linear-to-r from-brand-primary to-brand-accent ml-0.5">.fun</span>
            </span>
            <span className="mt-1 text-[9px] tracking-[0.22em] uppercase text-zinc-500 leading-none">
              Earn Together
            </span>
          </div>
        </Link>

        <nav className="hidden md:flex items-center gap-10 absolute left-1/2 -translate-x-1/2">
          {items.map((item) => {
            const active = isActiveLink(location, item)
            return (
              <Link
                key={item.to}
                to={item.to}
                className="relative py-4 px-2 group"
              >
                <span
                  className={`text-[10px] tracking-[0.25em] font-medium transition-colors duration-300 relative z-10 ${
                    active ? 'text-white' : 'text-zinc-500 group-hover:text-brand-accent'
                  }`}
                >
                  {item.label}
                </span>

                {active && (
                  <motion.div
                    layoutId="vaultNavActiveDot"
                    className="absolute bottom-2 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-brand-primary shadow-[0_0_10px_#0052FF]"
                  />
                )}

                <div className="absolute inset-0 -z-10 rounded-full bg-brand-primary/5 opacity-0 blur-lg transition-opacity duration-200 group-hover:opacity-100" />
              </Link>
            )
          })}
        </nav>

        <div className="hidden md:flex items-center gap-3">
          {showConnect ? <ConnectButton /> : null}
        </div>

        <div className="md:hidden text-white/50 hover:text-white cursor-pointer" title="Menu">
          <Menu />
        </div>
      </div>
    </header>
  )
}
