import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion, useReducedMotion } from 'framer-motion'

import { CreatorEconomyTrayModule } from '@/components/account/CreatorEconomyTrayModule'
import { JazziconAvatar } from '@/components/account/JazziconAvatar'
import {
  CanonicalIdentityDropdown,
  CoinbaseSmartWalletAvatar,
} from '@/components/account/CanonicalIdentityCard'
import {
  RelayTrayPointsModule,
  RelayTrayPrimaryTabs,
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

import { WaitlistPostJoinShell } from './WaitlistPostJoinShell'
import { useWaitlistCanonicalIdentity } from './useWaitlistCanonicalIdentity'
import { useWaitlistPostJoinAttention } from './useWaitlistPostJoinAttention'

type WaitlistTraySection = 'identity' | 'points'

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
  /** Social identities + linking wizard (X / wallet / Zora panels). */
  identitiesPanel: ReactNode
}

/**
 * Top-right account tray for the waitlist route — the wagmi-free counterpart
 * to the app's `ConnectButton` tray. Reuses the same tab chrome, economy
 * module, wallet rows (`CanonicalIdentityDropdown`), points module, and footer
 * as the app tray; waitlist-only post-join shell + identity linking live on
 * the Identity tab below the shared wallet block.
 */
export function WaitlistAccountTray(props: WaitlistAccountTrayProps) {
  const hasSession = Boolean(props.joinedSessionAddress)
  const [open, setOpen] = useState(false)
  const [section, setSection] = useState<WaitlistTraySection>('identity')
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
  // Hero shows CSW/basename when there is no creator coin — keep primary identity
  // out of the dropdown to avoid duplicate rows. When the hero is coin-forward,
  // surface the CSW under Wallets via the dropdown's primary-identity block.
  const omitPrimaryIdentityInDropdown = !hasCreatorCoin

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
            <div className="px-5 pb-4 pt-2">
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
                </div>
                <div className="shrink-0 pt-1 text-right">
                  <div className="text-[22px] font-semibold tabular-nums leading-none tracking-[-0.03em] text-white">
                    {trayPointsDisplay.points.toLocaleString()}
                  </div>
                  <div className="mt-1 text-[11px] text-zinc-400">points</div>
                </div>
              </div>
            </div>

            <RelayTrayPrimaryTabs
              section={section}
              onChange={(next) => setSection(next === 'portfolio' ? 'identity' : next)}
              sections={['identity', 'points']}
            />

            {section === 'identity' ? (
              <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-3 pt-1">
                <div className="mb-1 text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-400">
                  {economy.view.symbolDisplay} economy
                </div>
                <div className="text-[18px] font-semibold tracking-[-0.02em] text-white">
                  {economy.view.statusLabel}
                </div>
                <CreatorEconomyTrayModule
                  variant="waitlist"
                  absoluteAppLinks
                  loading={economy.loading}
                  view={economy.view}
                />

                <div className="mt-4 h-px bg-white/[0.06]" />

                <CanonicalIdentityDropdown
                  identity={identity}
                  omitPrimaryIdentity={omitPrimaryIdentityInDropdown}
                  onRequestConnectWallet={props.onRequestConnectWallet}
                  onRequestDisconnectMainWallet={props.onRequestDisconnectMainWallet}
                  disconnectingMainWallet={props.disconnectingMainWallet}
                  onRequestSignOut={props.onSignOut}
                  signingOut={props.signOutBusy}
                  signOutDisabled={props.signOutDisabled}
                />

                <div className="mt-4 h-px bg-white/[0.06]" />

                <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.12em] text-zinc-400">
                  Identities
                </div>
                {props.identitiesPanel}

                <WaitlistPostJoinShell
                  enabled
                  onSignOut={props.onSignOut}
                  signOutBusy={props.signOutBusy}
                />
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
