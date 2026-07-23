import { type ComponentProps, type CSSProperties, type ReactNode, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import {
  CanonicalIdentityDropdown,
} from '@/components/account/CanonicalIdentityCard'
import type { AccountTraySection } from '@/components/account/trayEvents'
import { AccountTray } from '@/components/ui/AccountTray'
import { getMarketingBaseUrl } from '@/lib/env/host'

/** Site-wide account tray section ids — shared by app + waitlist. */
export type RelayAccountTraySection = AccountTraySection

const RELAY_ACCOUNT_TRAY_STYLES = {
  header: {
    minHeight: '0px',
  } satisfies CSSProperties,
  content: {
    paddingTop: '0.5rem',
    paddingBottom: '0.75rem',
  } satisfies CSSProperties,
}

export function useRelayAccountTrayStyles() {
  return RELAY_ACCOUNT_TRAY_STYLES
}

export function useIsPhoneViewport(): boolean {
  const [isPhone, setIsPhone] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia('(max-width: 767px)').matches
  })

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mediaQuery = window.matchMedia('(max-width: 767px)')
    const handleChange = (event: MediaQueryListEvent) => setIsPhone(event.matches)
    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  return isPhone
}

export function RelayTrayPrimaryTabs(props: {
  section: RelayAccountTraySection
  onChange: (section: RelayAccountTraySection) => void
  /** Defaults to all three tabs. */
  sections?: readonly RelayAccountTraySection[]
}) {
  const sections = props.sections ?? (['identity', 'portfolio', 'points'] as const)
  return (
    <div className="px-4 pt-1 pb-2">
      <div className="inline-flex items-center gap-1 rounded-lg border border-white/8 bg-black/20 p-1">
        {sections.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => props.onChange(value)}
            className={`rounded-md px-2 py-1 text-[12px] font-medium transition-colors ${
              props.section === value
                ? 'bg-white/[0.08] text-white'
                : 'text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200'
            }`}
          >
            {value === 'identity' ? 'Wallets' : value === 'portfolio' ? 'Portfolio' : 'Points'}
          </button>
        ))}
      </div>
    </div>
  )
}

/** Wallets tab body: connected wallets first, optional extras below. */
export function RelayAccountTrayIdentityPanel(props: {
  banner?: ReactNode
  walletSection?: ReactNode
  identityDropdown: ComponentProps<typeof CanonicalIdentityDropdown>
  children?: ReactNode
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-3 pt-1">
      {props.banner ? <div className="mb-2">{props.banner}</div> : null}
      {props.walletSection ?? <CanonicalIdentityDropdown {...props.identityDropdown} />}
      {props.children ? (
        <>
          <div className="mt-4 h-px bg-white/[0.06]" />
          {props.children}
        </>
      ) : null}
    </div>
  )
}

export function RelayAccountTrayPortfolioUnavailable(props: {
  enterAppHref: string
  onNavigate?: () => void
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pt-2 pb-3">
      <div className="text-[30px] font-semibold leading-none tracking-tight text-white tabular-nums">—</div>
      <div className="mt-1 text-[10px] text-zinc-500 truncate">Portfolio · Base</div>
      <p className="mt-6 text-sm leading-relaxed text-zinc-400">
        Token balances and activity are available in the app.
      </p>
      <a
        href={props.enterAppHref}
        onClick={props.onNavigate}
        className="mt-4 inline-flex w-full items-center justify-center rounded-full border border-white/10 bg-white/[0.06] px-4 py-2.5 text-[13px] font-medium text-zinc-100 transition hover:bg-white/[0.1]"
      >
        Enter app
      </a>
    </div>
  )
}

type RelayAccountTrayFooterProps = {
  onClose: () => void
  onSignOut: () => void | Promise<void>
  signOutBusy?: boolean
  signOutDisabled?: boolean
  helpHref?: string
  accountsHref: string
  settingsHref: string
  /** Use client-side router links when the tray lives inside the app shell. */
  linkMode?: 'router' | 'anchor'
}

export function RelayAccountTrayFooter(props: RelayAccountTrayFooterProps) {
  const helpHref = props.helpHref ?? `${getMarketingBaseUrl()}/faq`
  const rowClassName = 'block w-full py-3 px-4 transition-colors hover:bg-white/4'
  const labelClassName = 'label block text-zinc-300'

  const HelpRow =
    props.linkMode === 'router' ? (
      <Link to={helpHref} onClick={props.onClose} className={rowClassName}>
        <span className={labelClassName}>Help</span>
      </Link>
    ) : (
      <a href={helpHref} onClick={props.onClose} className={rowClassName}>
        <span className={labelClassName}>Help</span>
      </a>
    )

  const AccountsRow =
    props.linkMode === 'router' ? (
      <Link to={props.accountsHref} onClick={props.onClose} className={rowClassName}>
        <span className={labelClassName}>Accounts</span>
      </Link>
    ) : (
      <a href={props.accountsHref} onClick={props.onClose} className={rowClassName}>
        <span className={labelClassName}>Accounts</span>
      </a>
    )

  const SettingsRow =
    props.linkMode === 'router' ? (
      <Link to={props.settingsHref} onClick={props.onClose} className={rowClassName}>
        <span className={labelClassName}>Settings</span>
      </Link>
    ) : (
      <a href={props.settingsHref} onClick={props.onClose} className={rowClassName}>
        <span className={labelClassName}>Settings</span>
      </a>
    )

  return (
    <>
      <div className="mt-auto" />
      <div className="border-t border-white/8 bg-black/20">
        {HelpRow}
        {AccountsRow}
        {SettingsRow}
        <button
          type="button"
          onClick={() => void props.onSignOut()}
          disabled={props.signOutBusy === true || props.signOutDisabled === true}
          className="block w-full py-3 px-4 text-left transition-colors hover:bg-white/4 disabled:opacity-60"
        >
          <span className={labelClassName}>{props.signOutBusy ? 'Signing out…' : 'Sign out'}</span>
        </button>
      </div>
    </>
  )
}

type RelayAccountTrayShellProps = {
  open: boolean
  onClose: () => void
  onCloseComplete?: () => void
  section: RelayAccountTraySection
  onSectionChange: (section: RelayAccountTraySection) => void
  sections?: readonly RelayAccountTraySection[]
  wallets: ReactNode
  portfolio?: ReactNode
  /** Shown on Portfolio when `portfolio` is omitted (e.g. waitlist). */
  portfolioUnavailableHref?: string
  points: ReactNode
  footer: Omit<RelayAccountTrayFooterProps, 'onClose'>
  error?: string | null
  accessibilityLabel?: string
  closeAccessibilityLabel?: string
}

/**
 * One account sidebar for the whole site (app nav + waitlist).
 * Callers supply tab bodies; shell owns chrome, tabs, and footer.
 */
export function RelayAccountTrayShell(props: RelayAccountTrayShellProps) {
  const isPhoneViewport = useIsPhoneViewport()
  const trayStyles = useRelayAccountTrayStyles()

  if (!props.open) return null

  const portfolioBody =
    props.portfolio ??
    (props.portfolioUnavailableHref ? (
      <RelayAccountTrayPortfolioUnavailable
        enterAppHref={props.portfolioUnavailableHref}
        onNavigate={props.onClose}
      />
    ) : null)

  return (
    <AccountTray
      pin={isPhoneViewport ? 'bottom' : 'right'}
      showHandleBar={isPhoneViewport}
      accessibilityLabel={props.accessibilityLabel ?? '4626 account menu'}
      closeAccessibilityLabel={props.closeAccessibilityLabel ?? 'Close account menu'}
      onRequestClose={props.onClose}
      onCloseComplete={props.onCloseComplete}
      styles={trayStyles}
    >
      <div className="flex min-h-0 flex-1 flex-col">
        <RelayTrayPrimaryTabs
          section={props.section}
          onChange={props.onSectionChange}
          sections={props.sections}
        />

        {props.section === 'identity' ? props.wallets : null}
        {props.section === 'portfolio' ? portfolioBody : null}
        {props.section === 'points' ? props.points : null}

        {props.error ? (
          <div className="px-4 text-[11px] text-red-400/90">{props.error}</div>
        ) : null}

        <RelayAccountTrayFooter {...props.footer} onClose={props.onClose} />
      </div>
    </AccountTray>
  )
}
