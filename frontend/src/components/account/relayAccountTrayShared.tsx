import { type ComponentProps, type CSSProperties, type ReactNode, useMemo } from 'react'
import { Link } from 'react-router-dom'

import {
  CanonicalIdentityDropdown,
} from '@/components/account/CanonicalIdentityCard'
import { CreatorEconomyTrayModule } from '@/components/account/CreatorEconomyTrayModule'
import type { CreatorEconomyView } from '@/lib/creatorEconomy/types'
import { getMarketingBaseUrl } from '@/lib/env/host'

export type RelayAccountTraySection = 'identity' | 'portfolio' | 'points'

export function useRelayAccountTrayStyles(isPhoneViewport: boolean) {
  return useMemo(
    () => ({
      header: {
        minHeight: '0px',
      } satisfies CSSProperties,
      content: {
        paddingTop: isPhoneViewport ? '0.5rem' : '0.5rem',
        paddingBottom: '0.75rem',
      } satisfies CSSProperties,
    }),
    [isPhoneViewport],
  )
}

export function RelayAccountTrayIdentityPanel(props: {
  economyView: CreatorEconomyView
  economyLoading: boolean
  economyVariant: 'app' | 'waitlist'
  absoluteAppLinks?: boolean
  banner?: ReactNode
  walletSection?: ReactNode
  identityDropdown: ComponentProps<typeof CanonicalIdentityDropdown>
  children?: ReactNode
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-3 pt-1">
      {props.banner ? <div className="mb-2">{props.banner}</div> : null}
      <div className="mb-1 text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-400">
        {props.economyView.symbolDisplay} economy
      </div>
      <div className="text-[18px] font-semibold tracking-[-0.02em] text-white">
        {props.economyView.statusLabel}
      </div>
      <CreatorEconomyTrayModule
        variant={props.economyVariant}
        absoluteAppLinks={props.absoluteAppLinks}
        loading={props.economyLoading}
        view={props.economyView}
      />
      <div className="mt-4 h-px bg-white/[0.06]" />
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
    <div className="flex min-h-0 flex-1 flex-col px-4 pt-2 pb-3">
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
