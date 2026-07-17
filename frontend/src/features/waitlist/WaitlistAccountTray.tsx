import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'

import { JazziconAvatar } from '@/components/account/JazziconAvatar'
import {
  CoinbaseSmartWalletAvatar,
} from '@/components/account/CanonicalIdentityCard'
import {
  RelayTrayPointsModule,
  RelayTrayPrimaryTabs,
  useIsPhoneViewport,
  type TrayPointsOverview,
} from '@/components/account/ConnectButton'
import {
  RelayAccountTrayFooter,
  RelayAccountTrayIdentityPanel,
  RelayAccountTrayPortfolioUnavailable,
  useRelayAccountTrayStyles,
  type RelayAccountTraySection,
} from '@/components/account/relayAccountTrayShared'
import { AccountTray } from '@/components/ui/AccountTray'
import type { AccountSetupMe } from '@/features/accountSetup/types'
import { useBasenameForAddress } from '@/hooks/useBasenameForAddress'
import { useCreatorCoinBadge } from '@/hooks/useCreatorCoinBadge'
import { useCreatorEconomySummary } from '@/hooks/useCreatorEconomySummary'
import type { CreatorEconomySigningStatus } from '@/lib/creatorEconomy/types'
import { APP_ORIGIN } from '@/lib/env/host'
import { fetchAccountTrayPoints, isAccountTrayPointsAuthError } from '@/lib/waitlist/accountTrayPoints'
import { resolvePublicPointsDisplay } from '@/lib/waitlist/canonicalAccountScore'

import { WaitlistPostJoinShell } from './WaitlistPostJoinShell'
import { useWaitlistCanonicalIdentity } from './useWaitlistCanonicalIdentity'
import { useWaitlistPostJoinAttention } from './useWaitlistPostJoinAttention'

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
 * Top-right account tray for the waitlist route — same shell, tabs, identity
 * panel, portfolio placeholder, points module, and footer as the app tray.
 * Wagmi-free via `useWaitlistCanonicalIdentity`; waitlist-only linking UI
 * renders as an extra block on the Identity tab.
 */
export function WaitlistAccountTray(props: WaitlistAccountTrayProps) {
  const hasSession = Boolean(props.joinedSessionAddress)
  const [open, setOpen] = useState(false)
  const [section, setSection] = useState<RelayAccountTraySection>('identity')
  const isPhoneViewport = useIsPhoneViewport()
  const trayStyles = useRelayAccountTrayStyles(isPhoneViewport)
  const [autoOpened, setAutoOpened] = useState(false)

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
  const hasCreatorCoin = Boolean(coinBadge && !coinBadge.loading && coinBadge.symbol)

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
          styles={trayStyles}
        >
          <div className="flex min-h-0 flex-1 flex-col">
            <RelayTrayPrimaryTabs section={section} onChange={setSection} />

            {section === 'identity' ? (
              <RelayAccountTrayIdentityPanel
                economyView={economy.view}
                economyLoading={economy.loading}
                economyVariant="waitlist"
                absoluteAppLinks
                identityDropdown={{
                  identity,
                  omitPrimaryIdentity: !hasCreatorCoin,
                  onRequestConnectWallet: props.onRequestConnectWallet,
                  onRequestDisconnectMainWallet: props.onRequestDisconnectMainWallet,
                  disconnectingMainWallet: props.disconnectingMainWallet,
                  onRequestSignOut: props.onSignOut,
                  signingOut: props.signOutBusy,
                  signOutDisabled: props.signOutDisabled,
                }}
              >
                <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.12em] text-zinc-400">
                  Identities
                </div>
                {props.identitiesPanel}
                <WaitlistPostJoinShell
                  enabled
                  onSignOut={props.onSignOut}
                  signOutBusy={props.signOutBusy}
                />
              </RelayAccountTrayIdentityPanel>
            ) : null}

            {section === 'portfolio' ? (
              <RelayAccountTrayPortfolioUnavailable
                enterAppHref={`${APP_ORIGIN}/swap`}
                onNavigate={() => setOpen(false)}
              />
            ) : null}

            {section === 'points' ? (
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
            ) : null}

            <RelayAccountTrayFooter
              linkMode="anchor"
              accountsHref={`${APP_ORIGIN}/accounts`}
              settingsHref={`${APP_ORIGIN}/accounts`}
              onClose={() => setOpen(false)}
              onSignOut={props.onSignOut}
              signOutBusy={props.signOutBusy}
              signOutDisabled={props.signOutDisabled}
            />
          </div>
        </AccountTray>
      ) : null}
    </>
  )
}
