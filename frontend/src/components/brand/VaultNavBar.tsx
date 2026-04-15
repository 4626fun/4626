import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'

import { ConnectButton } from '@/components/account/ConnectButton'
import { useAdminStatus } from '@/hooks/useAdminStatus'
import {
  buildCanonicalMarketingWaitlistUrl,
  getCanonicalMarketingWaitlistPath,
} from '@/lib/auth/waitlistEntry'
import { isPublicSiteMode } from '@/lib/flags/flags'
import { getHostMode, getMarketingBaseUrl } from '@/lib/env/host'
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
  { label: 'Deploy', to: '/deploy', activePrefixes: ['/deploy', '/status', '/vault'] },
  { label: 'Wallet', to: '/portfolio', activePrefixes: ['/portfolio'] },
]

const NAV_ITEMS_PUBLIC: NavItem[] = [
  { label: 'Waitlist', to: getCanonicalMarketingWaitlistPath() },
]

const ADMIN_ITEM: NavItem = { label: 'Admin', to: '/admin/waitlist', activePrefixes: ['/admin'] }

function isActiveLink(location: { pathname: string }, item: NavItem): boolean {
  const pathname = location.pathname

  if (item.to === '/') return pathname === '/'
  const prefixes = item.activePrefixes && item.activePrefixes.length > 0 ? item.activePrefixes : [item.to]
  return prefixes.some((p) => (p === '/' ? pathname === '/' : pathname === p || pathname.startsWith(`${p}/`)))
}

function useSafeAdminStatus(enabled: boolean) {
  try {
    return useAdminStatus({ enabled })
  } catch {
    return { isAdmin: false }
  }
}

export function VaultNavBar(props: { interactive?: boolean }) {
  const interactive = props.interactive ?? true
  const location = useLocation()
  const publicMode = isPublicSiteMode()
  const hostMode = getHostMode()
  const shouldLoadAdminStatus = interactive && hostMode !== 'marketing' && !publicMode
  const { isAdmin } = useSafeAdminStatus(shouldLoadAdminStatus)
  const [brandHovered, setBrandHovered] = useState(false)
  const canonicalMarketingWaitlistHref =
    hostMode === 'marketing'
      ? getCanonicalMarketingWaitlistPath()
      : buildCanonicalMarketingWaitlistUrl(getMarketingBaseUrl())
  const baseItems = publicMode || hostMode === 'marketing' ? NAV_ITEMS_PUBLIC : NAV_ITEMS
  const items = interactive && isAdmin && hostMode !== 'marketing' ? [...baseItems, ADMIN_ITEM] : baseItems
  const brandHref = hostMode === 'marketing' ? '/' : '/swap'
  const showConnect = interactive && !publicMode && hostMode !== 'marketing'

  const renderNavLinks = () =>
    items.map((item) => {
      const active = isActiveLink(location, item)
      if (item.to === getCanonicalMarketingWaitlistPath()) {
        const className = `group relative inline-flex h-8 items-center justify-center rounded-lg border-0 px-3 outline-none transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] focus-visible:ring-1 focus-visible:ring-white/25 ${
            ''
          }`
        const content = (
          <span
            className="relative z-10 text-[13px] font-medium tracking-[0.01em] text-zinc-300 transition-colors duration-150 ease-[cubic-bezier(0.4,0,0.2,1)]"
          >
            {item.label}
          </span>
        )
        if (hostMode === 'marketing') {
          return (
            <Link
              key={item.to}
              to={canonicalMarketingWaitlistHref}
              aria-current={active ? 'page' : undefined}
              className={className}
            >
              {content}
            </Link>
          )
        }
        return (
          <a
            key={item.to}
            href={canonicalMarketingWaitlistHref}
            aria-current={active ? 'page' : undefined}
            className={className}
          >
            {content}
          </a>
        )
      }
      return (
        <Link
          key={item.to}
          to={item.to}
          aria-current={active ? 'page' : undefined}
          className={`group relative inline-flex h-8 items-center justify-center rounded-lg border-0 px-3 outline-none transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] focus-visible:ring-1 focus-visible:ring-white/25 ${
            ''
          }`}
        >
          <span
            className="relative z-10 text-[13px] font-medium tracking-[0.01em] text-zinc-300 transition-colors duration-150 ease-[cubic-bezier(0.4,0,0.2,1)]"
          >
            {item.label}
          </span>
        </Link>
      )
    })

  return (
    <header className="hidden md:block sticky top-0 left-0 right-0 z-50">
      <div className="absolute inset-0 bg-vault-bg/74 backdrop-blur-xl" />

      <div className="relative h-14 w-full px-4 md:px-6 lg:px-8 flex items-center gap-3">
        <Link
          to={brandHref}
          className="flex items-center gap-2.5 group cursor-pointer shrink-0"
          onMouseEnter={() => setBrandHovered(true)}
          onMouseLeave={() => setBrandHovered(false)}
          onFocus={() => setBrandHovered(true)}
          onBlur={() => setBrandHovered(false)}
        >
          <Logo showText={false} width={28} height={28} forceHover={brandHovered} />
          <span className="text-[15px] tracking-[0.03em] text-white font-medium leading-none">
            <TextScramble text="4626.fun" trigger={brandHovered} speed={0.75} complexity="simple" />
          </span>
        </Link>

        <nav className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-1 overflow-x-auto whitespace-nowrap scrollbar-hide">
            {renderNavLinks()}
          </div>
        </nav>

        {showConnect ? (
          <div className="shrink-0">
            <ConnectButton variant="nav" />
          </div>
        ) : null}
      </div>
    </header>
  )
}
