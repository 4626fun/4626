import { Suspense, lazy, useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ArrowLeftRight, Mail, Search, ShieldCheck, Vault, Wallet } from 'lucide-react'
import {
  buildCanonicalMarketingWaitlistUrl,
  getCanonicalMarketingWaitlistPath,
  isMarketingWaitlistEntryLocation,
} from '@/lib/auth/waitlistEntry'
import { isPublicSiteMode } from '@/lib/flags/flags'
import { getHostMode, getMarketingBaseUrl } from '@/lib/env/host'
import { PageTransitionOutlet } from '@/components/layout/PageTransition'
import { FlagToolbarBridge } from '@/components/flags/FlagToolbarBridge'
import { XmtpChatProvider } from '@/lib/xmtp/provider'
import { VaultNavBar } from '@/components/brand/VaultNavBar'
import {
  ACCOUNT_WALLET_SUMMARY_EVENT,
  requestOpenAccountTray,
  type AccountWalletSummaryDetail,
} from '@/components/account/trayEvents'

const LazyChatSurface = lazy(async () => {
  const mod = await import('../chat/ChatSurface')
  return { default: mod.ChatSurface }
})

type MobileNavItem = {
  label: string
  path: string
  icon: any
  activePrefixes?: string[]
}

const navItems: MobileNavItem[] = [
  { path: '/swap', icon: ArrowLeftRight, label: 'Trade', activePrefixes: ['/swap'] },
  { path: '/explore/creators', icon: Search, label: 'Explore', activePrefixes: ['/explore'] },
  { path: '/deploy', icon: Vault, label: 'Deploy', activePrefixes: ['/deploy', '/status', '/vault'] },
  { path: '/wallet', icon: Wallet, label: 'Wallet', activePrefixes: [] },
]

const navItemsPublic: MobileNavItem[] = [
  { path: getCanonicalMarketingWaitlistPath(), icon: Mail, label: 'Waitlist' },
]

const adminNavItem: MobileNavItem = { path: '/admin/waitlist', icon: ShieldCheck, label: 'Admin', activePrefixes: ['/admin'] }

function isActiveLink(location: { pathname: string; search?: string; hash?: string }, item: MobileNavItem): boolean {
  const pathname = location.pathname

  if (item.path === getCanonicalMarketingWaitlistPath()) {
    return isMarketingWaitlistEntryLocation({ pathname })
  }

  if (item.path === '/') return pathname === '/'
  const prefixes = item.activePrefixes && item.activePrefixes.length > 0 ? item.activePrefixes : [item.path]
  return prefixes.some((p) => (p === '/' ? pathname === '/' : pathname === p || pathname.startsWith(`${p}/`)))
}

function isBaseInAppBrowser(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent.toLowerCase()
  return (
    ua.includes('coinbase') ||
    ua.includes('cbios') ||
    ua.includes('cbandroid') ||
    ua.includes('baseapp') ||
    ua.includes(' base/')
  )
}

function formatUsdCompact(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '--'
  const amount = Number(value)
  if (amount >= 1_000_000_000) return `$${(amount / 1_000_000_000).toFixed(2)}B`
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(2)}M`
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(2)}K`
  return `$${amount.toFixed(2)}`
}

function hasCoinbaseInjectedProvider(): boolean {
  if (typeof window === 'undefined') return false
  const ethereum = (window as any).ethereum
  if (!ethereum) return false
  if (Boolean(ethereum.isCoinbaseWallet)) return true
  if (Array.isArray(ethereum.providers)) {
    return ethereum.providers.some((provider: any) => Boolean(provider?.isCoinbaseWallet))
  }
  return false
}

function isBaseInAppContext(): boolean {
  return isBaseInAppBrowser() || hasCoinbaseInjectedProvider()
}

function findScrollableAncestor(target: EventTarget | null): HTMLElement | null {
  if (typeof window === 'undefined' || typeof document === 'undefined') return null
  if (!(target instanceof Element)) return null

  let node: Element | null = target
  while (node && node !== document.body) {
    const el = node as HTMLElement
    const overflowY = window.getComputedStyle(el).overflowY
    const scrollable = (overflowY === 'auto' || overflowY === 'scroll') && el.scrollHeight > el.clientHeight
    if (scrollable) return el
    node = node.parentElement
  }
  return null
}

export function Layout(props: { interactive?: boolean; chatEnabled?: boolean }) {
  const interactive = props.interactive ?? true
  const chatEnabled = props.chatEnabled ?? true
  const location = useLocation()
  const publicMode = isPublicSiteMode()
  const hostMode = getHostMode()
  const canonicalMarketingWaitlistHref =
    hostMode === 'marketing'
      ? getCanonicalMarketingWaitlistPath()
      : buildCanonicalMarketingWaitlistUrl(getMarketingBaseUrl())
  const [isMobileChatOverlayActive, setIsMobileChatOverlayActive] = useState(false)
  const [mobileWalletUsd, setMobileWalletUsd] = useState<number | null>(null)
  const [hideMobileNavForBaseApp] = useState(() => isBaseInAppContext())
  const isWaitlistSurface = isMarketingWaitlistEntryLocation(location)
  const showWaitlistFocusedShell = isWaitlistSurface
  const shouldOverlayMobileNav = location.pathname.startsWith('/explore')
  const isAdminRoute = location.pathname.startsWith('/admin')
  const showTopNavBar = !showWaitlistFocusedShell
  const baseItems = publicMode || hostMode === 'marketing' || isWaitlistSurface ? navItemsPublic : navItems
  const items = isAdminRoute && hostMode !== 'marketing' ? [...baseItems, adminNavItem] : baseItems
  const shouldEnableChat = interactive && chatEnabled && hostMode === 'app' && !isWaitlistSurface

  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleOverlayChange = (event: Event) => {
      const customEvent = event as CustomEvent<{ active?: boolean }>
      setIsMobileChatOverlayActive(Boolean(customEvent.detail?.active))
    }

    window.addEventListener('vault-mobile-chat-overlay-change', handleOverlayChange as EventListener)
    return () => window.removeEventListener('vault-mobile-chat-overlay-change', handleOverlayChange as EventListener)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const handleWalletSummary = (event: Event) => {
      const customEvent = event as CustomEvent<AccountWalletSummaryDetail>
      const nextValue = customEvent.detail?.activeNetworkUsd
      setMobileWalletUsd(typeof nextValue === 'number' && Number.isFinite(nextValue) ? nextValue : null)
    }
    window.addEventListener(ACCOUNT_WALLET_SUMMARY_EVENT, handleWalletSummary as EventListener)
    return () => window.removeEventListener(ACCOUNT_WALLET_SUMMARY_EVENT, handleWalletSummary as EventListener)
  }, [])

  const hideMobileNavForMarketingHost = hostMode === 'marketing'
  const hideMobileNav =
    isMobileChatOverlayActive ||
    hideMobileNavForBaseApp ||
    hideMobileNavForMarketingHost ||
    isWaitlistSurface

  useEffect(() => {
    if (typeof document === 'undefined') return
    const className = 'baseapp-scroll-lock'
    const { documentElement, body } = document

    if (hideMobileNavForBaseApp) {
      documentElement.classList.add(className)
      body.classList.add(className)
    } else {
      documentElement.classList.remove(className)
      body.classList.remove(className)
    }

    return () => {
      documentElement.classList.remove(className)
      body.classList.remove(className)
    }
  }, [hideMobileNavForBaseApp])

  useEffect(() => {
    if (!hideMobileNavForBaseApp || typeof window === 'undefined' || typeof document === 'undefined') return

    let touchStartY = 0

    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 1) return
      touchStartY = event.touches[0]?.clientY ?? 0
    }

    const onTouchMove = (event: TouchEvent) => {
      if (!event.cancelable || event.touches.length !== 1) return
      const currentY = event.touches[0]?.clientY ?? 0
      const pullingDownFromTop = currentY - touchStartY > 8
      if (!pullingDownFromTop) return

      const scrollable = findScrollableAncestor(event.target)
      const scrollTop = scrollable
        ? scrollable.scrollTop
        : Math.max(window.scrollY, document.documentElement.scrollTop, document.body.scrollTop)

      if (scrollTop <= 0) {
        event.preventDefault()
      }
    }

    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchmove', onTouchMove, { passive: false })

    return () => {
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchmove', onTouchMove)
    }
  }, [hideMobileNavForBaseApp])

  useEffect(() => {
    if (typeof document === 'undefined') return

    const managedAttr = 'data-cv-managed-inert'

    const syncInertForAriaHiddenRoots = () => {
      const hiddenRoots = document.querySelectorAll<HTMLElement>('[data-aria-hidden="true"][aria-hidden="true"]')
      hiddenRoots.forEach((node) => {
        if (!node.hasAttribute(managedAttr)) {
          node.setAttribute('inert', '')
          node.setAttribute(managedAttr, 'true')
        }
      })

      const managedNodes = document.querySelectorAll<HTMLElement>(`[${managedAttr}="true"]`)
      managedNodes.forEach((node) => {
        const stillAriaHidden = node.getAttribute('aria-hidden') === 'true' && node.getAttribute('data-aria-hidden') === 'true'
        if (!stillAriaHidden) {
          node.removeAttribute('inert')
          node.removeAttribute(managedAttr)
        }
      })
    }

    syncInertForAriaHiddenRoots()

    const observer = new MutationObserver(syncInertForAriaHiddenRoots)
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['aria-hidden', 'data-aria-hidden'],
    })

    return () => {
      observer.disconnect()
      document.querySelectorAll<HTMLElement>(`[${managedAttr}="true"]`).forEach((node) => {
        node.removeAttribute('inert')
        node.removeAttribute(managedAttr)
      })
    }
  }, [])

  return (
    <div className={`vault-shell relative flex min-h-0 flex-1 flex-col bg-transparent ${showWaitlistFocusedShell ? 'min-h-dvh' : ''}`}>
      {showTopNavBar ? <VaultNavBar interactive={interactive} /> : null}

      {/* Skip to content link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-200 focus:rounded-lg focus:bg-brand-primary focus:px-4 focus:py-2 focus:text-white focus:text-sm focus:font-medium"
      >
        Skip to content
      </a>

      {shouldEnableChat ? (
        <XmtpChatProvider>
          {/* Main */}
          <main id="main-content" className={`flex min-h-0 flex-1 flex-col overflow-x-clip ${shouldOverlayMobileNav || hideMobileNav ? 'pb-0' : 'pb-24'} md:pb-0`}>
            <PageTransitionOutlet />
          </main>

          {/* Chat discovery and dock — app domain only (XMTP installations are per-origin; avoid 4626.fun) */}
          <Suspense fallback={null}>
            <LazyChatSurface />
          </Suspense>
        </XmtpChatProvider>
      ) : (
        <main id="main-content" className={`flex min-h-0 flex-1 flex-col overflow-x-clip ${shouldOverlayMobileNav || hideMobileNav ? 'pb-0' : 'pb-24'} md:pb-0`}>
          <PageTransitionOutlet />
        </main>
      )}

      {/* Vercel Flags Explorer bridge — exposes flag state to the Toolbar */}
      <FlagToolbarBridge />

      {/* Mobile Nav - Minimal */}
      <nav
        aria-label="Mobile navigation"
        className={`md:hidden fixed bottom-0 left-0 right-0 z-70 border-t border-white/8 bg-linear-to-t from-black/85 to-vault-bg/78 backdrop-blur-xl shadow-[0_-10px_30px_-18px_rgba(0,0,0,0.95)] ${
          hideMobileNav ? 'hidden' : ''
        }`}
      >
        <div className="mx-auto flex max-w-[540px] items-center justify-center gap-1.5 overflow-x-auto scrollbar-hide py-2.5 px-2 sm:py-3 sm:px-4">
          {items.map((item) => {
            const { path, icon: Icon, label } = item
            const isActive = isActiveLink(location, item)
            if (path === getCanonicalMarketingWaitlistPath()) {
              const content = (
                <>
                  <Icon
                    aria-hidden="true"
                    className={`h-4 w-4 transition-colors ${
                      isActive ? 'text-vault-text' : 'text-vault-subtext group-hover:text-vault-text'
                    }`}
                  />
                  <span className={`text-[8px] font-medium uppercase tracking-[0.08em] ${isActive ? 'text-vault-text' : 'text-vault-subtext'}`}>
                    {label}
                  </span>
                </>
              )
              const className = `flex flex-col items-center justify-center gap-1 group min-h-10 min-w-[48px] sm:min-w-[52px] px-2 rounded-xl border transition-all duration-200 active:scale-[0.97] ${
                isActive
                  ? 'border-brand-primary/35 bg-brand-primary/12 shadow-[0_10px_22px_-16px_rgb(var(--brand-primary)/0.9)]'
                  : 'border-transparent hover:-translate-y-px hover:border-white/10 hover:bg-white/6'
              }`
              return hostMode === 'marketing' ? (
                <Link
                  key={path}
                  to={canonicalMarketingWaitlistHref}
                  aria-label={label}
                  aria-current={isActive ? 'page' : undefined}
                  className={className}
                >
                  {content}
                </Link>
              ) : (
                <a
                  key={path}
                  href={canonicalMarketingWaitlistHref}
                  aria-label={label}
                  aria-current={isActive ? 'page' : undefined}
                  className={className}
                >
                  {content}
                </a>
              )
            }
            if (path === '/wallet' && interactive && hostMode === 'app') {
              return (
                <button
                  key={path}
                  type="button"
                  aria-label={label}
                  aria-current={isActive ? 'page' : undefined}
                  className="flex flex-col items-center justify-center gap-1 group min-h-10 min-w-[48px] sm:min-w-[52px] px-2 rounded-xl transition-all duration-200 active:scale-[0.97] hover:-translate-y-px hover:bg-white/6"
                  onClick={() => requestOpenAccountTray({ section: 'portfolio', tab: 'tokens', source: 'mobile-nav' })}
                >
                  <img
                    src="/base/base-chain-light.svg"
                    alt=""
                    aria-hidden="true"
                    className="h-3.5 w-3.5 object-contain"
                    loading="lazy"
                  />
                  <span className={`text-[9px] font-semibold tabular-nums ${isActive ? 'text-vault-text' : 'text-vault-subtext'}`}>
                    {formatUsdCompact(mobileWalletUsd)}
                  </span>
                </button>
              )
            }
            return (
              <Link
                key={path}
                to={path}
                aria-label={label}
                aria-current={isActive ? 'page' : undefined}
                className={`flex flex-col items-center justify-center gap-1 group min-h-10 min-w-[48px] sm:min-w-[52px] px-2 rounded-xl border transition-all duration-200 active:scale-[0.97] ${
                  isActive
                    ? 'border-brand-primary/35 bg-brand-primary/12 shadow-[0_10px_22px_-16px_rgb(var(--brand-primary)/0.9)]'
                    : 'border-transparent hover:-translate-y-px hover:border-white/10 hover:bg-white/6'
                }`}
              >
                <Icon
                  aria-hidden="true"
                  className={`h-4 w-4 transition-colors ${
                    isActive ? 'text-vault-text' : 'text-vault-subtext group-hover:text-vault-text'
                  }`}
                />
                <span className={`text-[8px] font-medium uppercase tracking-[0.08em] ${isActive ? 'text-vault-text' : 'text-vault-subtext'}`}>
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
