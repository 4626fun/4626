import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'

import { ConnectButton } from '@/components/ConnectButton'
import { JoinWaitlistCta } from '@/components/waitlist/JoinWaitlistCta'
import { useAdminStatus } from '@/hooks/useAdminStatus'
import { getMarketingWaitlistEntryUrl } from '@/lib/auth/waitlistEntry'
import { isPublicSiteMode } from '@/lib/flags'
import { getHostMode } from '@/lib/host'
import { Logo } from './Logo'
import { TextScramble } from './TextScramble'

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

  if (item.to.includes('#')) {
    const [toPath, toHash = ''] = item.to.split('#')
    const wantPath = toPath || '/'
    const wantHash = `#${toHash}`
    if (pathname === wantPath && hash === wantHash) return true
    const prefixes = item.activePrefixes && item.activePrefixes.length > 0 ? item.activePrefixes : [item.to]
    return prefixes.includes('/waitlist') && pathname === '/waitlist'
  }

  if (item.to === '/') return pathname === '/'
  const prefixes = item.activePrefixes && item.activePrefixes.length > 0 ? item.activePrefixes : [item.to]
  return prefixes.some((p) => (p === '/' ? pathname === '/' : pathname === p || pathname.startsWith(`${p}/`)))
}

function useSafeAdminStatus() {
  try {
    return useAdminStatus()
  } catch {
    return { isAdmin: false }
  }
}

export function VaultNavBar(props: { interactive?: boolean }) {
  const interactive = props.interactive ?? true
  const location = useLocation()
  const publicMode = isPublicSiteMode()
  const hostMode = getHostMode()
  const { isAdmin } = useSafeAdminStatus()
  const [brandHovered, setBrandHovered] = useState(false)
  const baseItems = publicMode || hostMode === 'marketing' ? NAV_ITEMS_PUBLIC : NAV_ITEMS
  const items = interactive && isAdmin && hostMode !== 'marketing' ? [...baseItems, ADMIN_ITEM] : baseItems
  const brandHref = hostMode === 'marketing' ? '/' : '/swap'
  const showConnect = interactive && !publicMode && hostMode !== 'marketing'

  const renderNavLinks = () =>
    items.map((item) => {
      const active = isActiveLink(location, item)
      if (item.to === '/#waitlist') {
        return (
          <JoinWaitlistCta
            key={item.to}
            className="group relative inline-flex h-8 items-center justify-center rounded-xl border-0 px-2.5 outline-none transition-all duration-200 focus-visible:ring-1 focus-visible:ring-white/25"
            showArrow={false}
            onPrivyDisabled={() => window.location.assign(getMarketingWaitlistEntryUrl('needs-session'))}
          >
            <span
              className={`relative z-10 text-[10px] font-medium tracking-[0.01em] ${
                active ? 'text-white' : 'text-zinc-500 group-hover:text-zinc-300'
              }`}
            >
              {item.label}
            </span>
          </JoinWaitlistCta>
        )
      }
      return (
        <Link
          key={item.to}
          to={item.to}
          aria-current={active ? 'page' : undefined}
          className="group relative inline-flex h-8 items-center justify-center rounded-xl border-0 px-2.5 outline-none transition-all duration-200 focus-visible:ring-1 focus-visible:ring-white/25"
        >
          <span
            className={`relative z-10 text-[10px] font-medium tracking-[0.01em] ${
              active ? 'text-white' : 'text-zinc-500 group-hover:text-zinc-300'
            }`}
          >
            {item.label}
          </span>
        </Link>
      )
    })

  return (
    <header className="hidden md:block sticky top-0 left-0 right-0 z-50 transition-all duration-500">
      <div className="absolute inset-0 bg-vault-bg/74 backdrop-blur-xl shadow-[0_10px_34px_-12px_rgba(0,0,0,0.88)]" />
      <div className="absolute bottom-0 left-0 right-0 h-px bg-white/8" />

      <div className="relative max-w-[1400px] mx-auto h-14 px-4 md:px-6 lg:px-8 flex items-center gap-3">
        <Link
          to={brandHref}
          className="flex items-center gap-2.5 group cursor-pointer shrink-0"
          onMouseEnter={() => setBrandHovered(true)}
          onMouseLeave={() => setBrandHovered(false)}
          onFocus={() => setBrandHovered(true)}
          onBlur={() => setBrandHovered(false)}
        >
          <Logo showText={false} width={28} height={28} forceHover={brandHovered} />
          <span className="text-[12px] tracking-[0.04em] text-white font-medium leading-none">
            <TextScramble text="4626.fun" trigger={brandHovered} speed={0.75} complexity="simple" />
          </span>
        </Link>

        <nav className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-1 overflow-x-auto whitespace-nowrap scrollbar-hide">
            {renderNavLinks()}
          </div>
        </nav>

        {showConnect ? (
          <div className="shrink-0 origin-right scale-[0.72] lg:scale-[0.82] xl:scale-95 transition-transform">
            <ConnectButton variant="nav" />
          </div>
        ) : null}
      </div>
    </header>
  )
}
