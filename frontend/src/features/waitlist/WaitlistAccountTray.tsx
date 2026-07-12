import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion, useReducedMotion } from 'framer-motion'

import { CreatorEconomyTrayModule } from '@/components/account/CreatorEconomyTrayModule'
import { JazziconAvatar } from '@/components/account/JazziconAvatar'
import {
  CoinbaseSmartWalletAvatar,
} from '@/components/account/CanonicalIdentityCard'
import {
  RelayTrayPointsModule,
  useIsPhoneViewport,
  type TrayPointsOverview,
} from '@/components/account/ConnectButton'
import { AccountTray } from '@/components/ui/AccountTray'
import type { AccountSetupMe } from '@/features/accountSetup/types'
import { useBasenameForAddress } from '@/hooks/useBasenameForAddress'
import { useCreatorCoinBadge } from '@/hooks/useCreatorCoinBadge'
import { useCreatorEconomySummary } from '@/hooks/useCreatorEconomySummary'
import type { CreatorEconomySigningStatus } from '@/lib/creatorEconomy/types'
import { APP_ORIGIN, getMarketingBaseUrl } from '@/lib/env/host'
import { fetchAccountTrayPoints, isAccountTrayPointsAuthError } from '@/lib/waitlist/accountTrayPoints'
import { resolvePublicPointsDisplay } from '@/lib/waitlist/canonicalAccountScore'
import { cn } from '@/lib/shared/utils'

import { WaitlistPostJoinShell } from './WaitlistPostJoinShell'
import { useWaitlistCanonicalIdentity } from './useWaitlistCanonicalIdentity'
import { useWaitlistPostJoinAttention } from './useWaitlistPostJoinAttention'

type WaitlistTraySection = 'account' | 'points'

function shortAddress(address: string | null | undefined): string | null {
  if (!address) return null
  const trimmed = address.trim()
  if (trimmed.length < 10) return trimmed
  return `${trimmed.slice(0, 6)}…${trimmed.slice(-4)}`
}

function resolveWaitlistSigningStatus(params: {
  setupRequired: boolean
  hasCsw: boolean
  embeddedAuthorized: boolean | null
  hasExternal: boolean
}): CreatorEconomySigningStatus {
  if (params.setupRequired) return 'action_required'
  if (params.hasExternal && !params.hasCsw) return 'external'
  if (!params.hasCsw) return 'setup'
  if (params.embeddedAuthorized === false && !params.hasExternal) return 'unavailable'
  if (params.embeddedAuthorized === true || params.hasExternal) return 'ready'
  return 'setup'
}

function WaitlistTrayTabs({
  section,
  onChange,
}: {
  section: WaitlistTraySection
  onChange: (next: WaitlistTraySection) => void
}) {
  const tabs: { id: WaitlistTraySection; label: string }[] = [
    { id: 'account', label: 'Account' },
    { id: 'points', label: 'Points' },
  ]
  return (
    <div className="mx-5 flex items-end gap-5 border-b border-white/[0.06]">
      {tabs.map((tab) => {
        const active = section === tab.id
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={cn(
              'relative pb-2.5 text-[14px] font-medium tracking-[-0.01em] transition-colors',
              active ? 'text-white' : 'text-zinc-400 hover:text-zinc-300',
            )}
          >
            {tab.label}
            {active ? (
              <motion.span
                layoutId="waitlist-tray-tab-underline"
                className="absolute inset-x-0 -bottom-px h-px bg-white"
                transition={{ type: 'spring', stiffness: 480, damping: 38 }}
              />
            ) : null}
          </button>
        )
      })}
    </div>
  )
}

function SummaryRow({
  title,
  value,
  href,
  onClick,
}: {
  title: string
  value: string
  href?: string
  onClick?: () => void
}) {
  const className =
    'flex w-full items-center justify-between gap-3 py-3 text-left transition-colors hover:bg-white/[0.03]'
  const body = (
    <>
      <span className="min-w-0">
        <span className="block text-[13px] font-medium text-zinc-200">{title}</span>
        <span className="mt-0.5 block text-[12px] text-zinc-400">{value}</span>
      </span>
      <span className="shrink-0 text-[13px] text-zinc-400" aria-hidden>
        ›
      </span>
    </>
  )
  if (href) {
    return (
      <a href={href} className={className}>
        {body}
      </a>
    )
  }
  return (
    <button type="button" onClick={onClick} className={className}>
      {body}
    </button>
  )
}

export type WaitlistAccountTrayProps = {
  accountMe: AccountSetupMe | null
  accountMeLoading: boolean
  joinedSessionAddress: string | null
  /** The user's linked external wallet address, if any (waitlist's own link flow). */
  externalEoaAddress: string | null
  getPrivyAccessToken: (() => Promise<string | null>) | null
  onRequestConnectWallet: () => void
  onRequestDisconnectMainWallet: () => void
  disconnectingMainWallet: boolean
  onSignOut: () => void | Promise<void>
  signOutBusy: boolean
  signOutDisabled: boolean
  /**
   * Social identities + linking wizard. Wallet roles stay on `/accounts`;
   * this slot opens under Manage connections.
   */
  identitiesPanel: ReactNode
}

/**
 * Top-right account tray for the waitlist route — the wagmi-free counterpart
 * to the app's `ConnectButton` tray. Flat, editorial chrome (hero + underline
 * tabs + open sections) so marketing `/waitlist` stays calm without nested cards.
 */
export function WaitlistAccountTray(props: WaitlistAccountTrayProps) {
  const hasSession = Boolean(props.joinedSessionAddress)
  const [open, setOpen] = useState(false)
  const [section, setSection] = useState<WaitlistTraySection>('account')
  const [connectionsOpen, setConnectionsOpen] = useState(false)
  const isPhoneViewport = useIsPhoneViewport()
  const [autoOpened, setAutoOpened] = useState(false)
  const reduceMotion = useReducedMotion()

  const identity = useWaitlistCanonicalIdentity({
    accountMe: props.accountMe,
    accountMeLoading: props.accountMeLoading,
    hasSession,
    externalEoaAddress: props.externalEoaAddress,
  })

  const cswBasename = useBasenameForAddress(identity.cswAddress)
  const coinBadge = useCreatorCoinBadge(identity.creatorCoinAddress)
  const { setupRequired } = useWaitlistPostJoinAttention()

  const signingStatus = useMemo(
    () =>
      resolveWaitlistSigningStatus({
        setupRequired,
        hasCsw: Boolean(identity.cswAddress),
        embeddedAuthorized: identity.embeddedSignerAuthorizedOnCsw,
        hasExternal: Boolean(identity.externalEoaAddress),
      }),
    [
      setupRequired,
      identity.cswAddress,
      identity.embeddedSignerAuthorizedOnCsw,
      identity.externalEoaAddress,
    ],
  )

  const handleOrBasename =
    cswBasename.displayName ??
    props.accountMe?.accountSignals?.basename ??
    props.accountMe?.accountSignals?.zoraHandle ??
    null

  const economy = useCreatorEconomySummary({
    creatorCoinAddress: identity.creatorCoinAddress,
    cswAddress: identity.cswAddress,
    holderAddress: identity.cswAddress,
    handleOrBasename,
    accountMe: props.accountMe,
    accountSigningStatus: signingStatus,
    ownsCreatorEconomy: Boolean(identity.creatorCoinAddress),
    enabled: hasSession && open,
    mode: 'waitlist',
  })

  // Auto-open once when wallet setup needs attention. Must run in an effect —
  // setState during render races the post-join shell / chat mount and crashes
  // Base App after wallet verify. Defer to the next frame so we do not call
  // setState synchronously in the effect body (react-hooks/set-state-in-effect).
  useEffect(() => {
    if (!hasSession || !setupRequired || autoOpened) return
    const raf = requestAnimationFrame(() => {
      setAutoOpened(true)
      setOpen(true)
    })
    return () => cancelAnimationFrame(raf)
  }, [autoOpened, hasSession, setupRequired])

  const trayAccountPointsQuery = useQuery({
    queryKey: ['waitlist-account-tray', 'accounts-me-points', props.joinedSessionAddress],
    enabled: hasSession && open,
    staleTime: 15_000,
    retry: (failureCount, error) => !isAccountTrayPointsAuthError(error) && failureCount < 1,
    queryFn: async () => {
      const token = props.getPrivyAccessToken ? await props.getPrivyAccessToken().catch(() => null) : null
      return fetchAccountTrayPoints(40, token)
    },
  })
  const trayPointsAuthRequired = isAccountTrayPointsAuthError(trayAccountPointsQuery.error)
  const trayPointsOverview: TrayPointsOverview | null = (() => {
    const tray = trayAccountPointsQuery.data
    if (!tray || tray.signupId <= 0) return null
    return { points: tray.points, rank: tray.rank, totalCount: tray.totalCount }
  })()
  const trayPointsDisplay = resolvePublicPointsDisplay({
    score: props.accountMe?.score ?? null,
    positionTotal: trayAccountPointsQuery.data?.points.total ?? null,
  })

  if (!hasSession) return null

  const avatarAddress = identity.cswAddress ?? identity.externalEoaAddress ?? identity.privyEmbeddedAddress
  const displayName =
    handleOrBasename ??
    shortAddress(avatarAddress) ??
    'Your account'
  const hasCreatorCoin = Boolean(coinBadge && !coinBadge.loading && coinBadge.symbol)
  const heroName = hasCreatorCoin && coinBadge?.symbol ? `$${coinBadge.symbol}` : displayName
  const hasEconomy = economy.view.role !== 'none' || hasCreatorCoin
  const statusLine = hasEconomy
    ? [
        economy.view.handleOrBasename ?? handleOrBasename ?? 'Creator economy',
        economy.view.networkLabel,
      ]
        .filter(Boolean)
        .join(' · ')
    : 'Coinbase Smart Wallet · Base'

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open account menu"
        aria-haspopup="menu"
        aria-expanded={open}
        className="fixed right-3 top-3 z-40 flex items-center gap-2 rounded-full border border-white/10 bg-black/40 px-2.5 py-1.5 backdrop-blur-xl transition hover:border-white/18 hover:bg-black/55 sm:right-5 sm:top-5"
      >
        <span className="relative flex-shrink-0">
          {identity.cswAddress ? (
            <CoinbaseSmartWalletAvatar
              address={identity.cswAddress}
              basenameAvatar={cswBasename.avatar}
              size={22}
            />
          ) : cswBasename.avatar ? (
            <img
              src={cswBasename.avatar}
              alt=""
              width={22}
              height={22}
              className="size-[22px] rounded-full object-cover"
            />
          ) : (
            <JazziconAvatar address={avatarAddress} size={22} />
          )}
          {setupRequired ? (
            <span
              className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-amber-400 ring-2 ring-black"
              aria-hidden="true"
              title="Wallet setup needs your attention"
            />
          ) : null}
        </span>
        <span className="pr-0.5 text-[12px] font-medium tabular-nums text-zinc-200">
          {trayPointsDisplay.points.toLocaleString()}
        </span>
      </button>

      {open ? (
        <AccountTray
          pin={isPhoneViewport ? 'bottom' : 'right'}
          showHandleBar={isPhoneViewport}
          accessibilityLabel="4626 account menu"
          closeAccessibilityLabel="Close account menu"
          onRequestClose={() => setOpen(false)}
          styles={{
            container: {
              background: 'rgb(var(--vault-card))',
              boxShadow: '0 24px 64px -28px rgba(0,0,0,0.75)',
              borderColor: 'rgba(255,255,255,0.08)',
            },
            content: {
              paddingTop: '0.15rem',
              paddingLeft: '0',
              paddingRight: '0',
              paddingBottom: '0',
            },
          }}
        >
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className="px-5 pb-5 pt-2">
              <div className="flex items-start gap-4">
                <span className="relative shrink-0">
                  {hasCreatorCoin && coinBadge?.logoUrl ? (
                    <img
                      src={coinBadge.logoUrl}
                      alt=""
                      width={56}
                      height={56}
                      className="size-14 rounded-full object-cover"
                    />
                  ) : identity.cswAddress ? (
                    <CoinbaseSmartWalletAvatar
                      address={identity.cswAddress}
                      basenameAvatar={cswBasename.avatar}
                      size={56}
                    />
                  ) : cswBasename.avatar ? (
                    <img
                      src={cswBasename.avatar}
                      alt=""
                      width={56}
                      height={56}
                      className="size-14 rounded-full object-cover"
                    />
                  ) : (
                    <span className="block overflow-hidden rounded-full">
                      <JazziconAvatar address={avatarAddress} size={56} />
                    </span>
                  )}
                  {setupRequired ? (
                    <span className="absolute right-0 top-0 size-2.5 rounded-full bg-amber-400 ring-2 ring-[rgb(var(--vault-card))]" />
                  ) : null}
                </span>
                <div className="min-w-0 flex-1 pt-0.5">
                  <div className="truncate text-[22px] font-semibold leading-tight tracking-[-0.03em] text-white">
                    {heroName}
                  </div>
                  <div className="mt-1 text-[12px] leading-snug text-zinc-400">{statusLine}</div>
                  {hasEconomy && economy.view.statusLabel ? (
                    <div className="mt-1 text-[12px] font-medium text-zinc-300">
                      {economy.view.statusLabel}
                    </div>
                  ) : null}
                  {economy.view.legacyBadge ? (
                    <div className="mt-1 text-[11px] text-zinc-400">
                      Legacy stack · {economy.view.legacyBadge}
                    </div>
                  ) : null}
                </div>
                <div className="shrink-0 pt-1 text-right">
                  {hasEconomy && economy.view.role !== 'none' ? (
                    <>
                      <div className="text-[12px] font-medium text-zinc-300">
                        {economy.view.statusLabel}
                      </div>
                      <div className="mt-1 text-[11px] tabular-nums text-zinc-400">
                        {trayPointsDisplay.points.toLocaleString()} pts
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="text-[22px] font-semibold tabular-nums leading-none tracking-[-0.03em] text-white">
                        {trayPointsDisplay.points.toLocaleString()}
                      </div>
                      <div className="mt-1 text-[11px] text-zinc-400">points</div>
                    </>
                  )}
                </div>
              </div>
            </div>

            <WaitlistTrayTabs section={section} onChange={setSection} />

            {section === 'account' ? (
              <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 pb-5 pt-4">
                <CreatorEconomyTrayModule
                  variant="waitlist"
                  absoluteAppLinks
                  loading={economy.loading}
                  view={economy.view}
                />

                <div className="my-4 h-px bg-white/[0.06]" />

                <SummaryRow
                  title="Account & signing"
                  value={`${economy.view.accountSigningLabel}${
                    identity.cswAddress ? ' · Smart wallet + embedded signer' : ''
                  }`}
                  href={`${APP_ORIGIN}/accounts`}
                />

                <div className="h-px bg-white/[0.06]" />

                <SummaryRow
                  title="Connections"
                  value={economy.view.connectionsSummary}
                  onClick={() => setConnectionsOpen((value) => !value)}
                />
                {economy.view.nextConnectionBonus && !connectionsOpen ? (
                  <div className="pb-2 text-[12px] text-zinc-400">
                    Next recommended · {economy.view.nextConnectionBonus.label}
                    <span className="ml-1 tabular-nums text-zinc-300">
                      +{economy.view.nextConnectionBonus.points}
                    </span>
                  </div>
                ) : null}
                {connectionsOpen ? (
                  <div className="pb-2">
                    <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.12em] text-zinc-400">
                      Manage connections
                    </div>
                    <WaitlistPostJoinShell
                      enabled
                      onSignOut={props.onSignOut}
                      signOutBusy={props.signOutBusy}
                    />
                    {props.identitiesPanel}
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="mt-2 min-h-0 flex-1 px-2">
                <RelayTrayPointsModule
                  pointsTotal={trayPointsDisplay.points}
                  position={trayPointsOverview}
                  pointsLoading={trayAccountPointsQuery.isLoading}
                  activity={trayAccountPointsQuery.data?.activity ?? []}
                  activityLoading={trayAccountPointsQuery.isLoading}
                  activityError={trayAccountPointsQuery.isError && !trayPointsAuthRequired}
                  activityAuthRequired={trayPointsAuthRequired}
                  leaderboardEligible={trayAccountPointsQuery.data?.leaderboardEligible ?? false}
                  hasAccountProfile={(trayAccountPointsQuery.data?.signupId ?? 0) > 0}
                  signupId={trayAccountPointsQuery.data?.signupId ?? 0}
                />
              </div>
            )}

            <div className="mt-auto" />
            <div className="border-t border-white/8 bg-black/20">
              <a
                href={`${getMarketingBaseUrl()}/faq`}
                onClick={() => setOpen(false)}
                className="block w-full py-3 px-4 transition-colors hover:bg-white/4"
              >
                <span className="label block text-zinc-300">Help</span>
              </a>
              <a
                href={`${APP_ORIGIN}/accounts`}
                onClick={() => setOpen(false)}
                className="block w-full py-3 px-4 transition-colors hover:bg-white/4"
              >
                <span className="label block text-zinc-300">Accounts</span>
              </a>
              <a
                href={`${APP_ORIGIN}/accounts`}
                onClick={() => setOpen(false)}
                className="block w-full py-3 px-4 transition-colors hover:bg-white/4"
              >
                <span className="label block text-zinc-300">Settings</span>
              </a>
              <button
                type="button"
                onClick={() => void props.onSignOut()}
                disabled={props.signOutBusy || props.signOutDisabled}
                className="block w-full py-3 px-4 text-left transition-colors hover:bg-white/4 disabled:opacity-60"
              >
                <span className="label block text-zinc-300">
                  {props.signOutBusy ? 'Signing out…' : 'Sign out'}
                </span>
              </button>
            </div>
          </motion.div>
        </AccountTray>
      ) : null}
    </>
  )
}
