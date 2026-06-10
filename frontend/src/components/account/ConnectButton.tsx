import { useAccount, useConnect, useDisconnect } from 'wagmi'
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Wallet, ChevronDown } from 'lucide-react'
import { Link } from 'react-router-dom'
import { AccountTray } from '@/components/ui/AccountTray'
import { Button } from '@/components/ui/Button'
import { useQuery } from '@tanstack/react-query'
import { useSiweAuth } from '@/hooks/useSiweAuth'
import { useCanonicalIdentity } from '@/hooks/useCanonicalIdentity'
import { useAccountMe } from '@/hooks/useAccountMe'
import { useChatIdentity } from '@/components/chat/useChatIdentity'
import {
  OPEN_ACCOUNT_TRAY_EVENT,
  type AccountTrayOpenDetail,
} from '@/components/account/trayEvents'
import { detectEthereumProviderCollision } from '@/lib/wallet/providerCollision'
import { usePrivy } from '@privy-io/react-auth'
import { usePrivyClientStatus } from '@/lib/privy/client'
import { resolvePublicPointsDisplay } from '@/lib/waitlist/canonicalAccountScore'
import {
  fetchAccountTrayPoints,
  isAccountTrayPointsAuthError,
} from '@/lib/waitlist/accountTrayPoints'
import type { PointsActivityRow } from '@/lib/waitlist/pointsActivity'
import { API_ENDPOINTS } from '@/lib/api/apiEndpoints'
import type { ApiEnvelope } from '@/lib/api/apiEnvelope'
import {
  formatLeaderboardDisplayName,
  formatWholeNumber,
  type LeaderboardEntry,
} from '@/features/waitlist/leaderboardUi'
import { LeaderboardIdentityCell } from '@/features/waitlist/LeaderboardIdentityCell'
import { apiFetch } from '@/lib/api/apiBase'
import { filterHiddenInjectedConnectors } from '@/lib/wallet/wagmiConnectorSelection'
import {
  CanonicalIdentityCard,
  CanonicalIdentityDropdown,
} from '@/components/account/CanonicalIdentityCard'
import {
  buildTrayAssetHoldings,
  collectTrayZoraTokenKeys,
  sumTrayAssetUsd,
  type TrayAssetHolding,
  type TrayNetworkHolding,
  type TrayTokenHolding,
  type TrayWalletSource,
} from '@/components/account/trayPortfolioHelpers'
import { useAccountTrayPortfolio } from '@/components/account/useAccountTrayPortfolio'
import { fetchTrayZoraHoldingsForWallets } from '@/lib/zora/walletHoldings'

type ConnectButtonStateInput = {
  sessionHydrated: boolean
  isConnected: boolean
  connectedAddress: string | null | undefined
  sessionAddress: string | null | undefined
}

export function deriveConnectButtonState(input: ConnectButtonStateInput): 'hydrating' | 'connected-wallet' | 'session-restored' | 'signed-out' {
  if (!input.sessionHydrated) return 'hydrating'
  if (input.isConnected && typeof input.connectedAddress === 'string' && input.connectedAddress.trim().length > 0) {
    return 'connected-wallet'
  }
  if (typeof input.sessionAddress === 'string' && input.sessionAddress.trim().length > 0) {
    return 'session-restored'
  }
  return 'signed-out'
}

type ConnectButtonVariant = 'default' | 'nav'

type ExternalWalletButtonsInput = {
  filteredConnectorCount: number
}

export function shouldAllowExternalWalletButtons(input: ExternalWalletButtonsInput): boolean {
  // Collision states can still safely offer external wallets as long as
  // injected connectors were filtered out first (e.g. keep Coinbase visible).
  return input.filteredConnectorCount > 0
}

type ResolveIdentityInput = {
  variant: ConnectButtonVariant
  identityAddress: string | null
  showMenu: boolean
  showOptions: boolean
}

export function shouldResolveConnectIdentity(input: ResolveIdentityInput): boolean {
  if (!input.identityAddress) return false
  if (input.variant !== 'nav') return true
  return input.showMenu || input.showOptions
}

export function ExternalWalletOptions(props: {
  authBusy: boolean
  hasMultipleInjectedProviders: boolean
  lockedEthereumProviderGlobal: boolean
  shouldHideInjectedConnector: boolean
  showPrivyDivider?: boolean
  onClose: () => void
}) {
  const { connect, connectors, isPending } = useConnect()

  const filteredConnectors = useMemo(() => {
    return filterHiddenInjectedConnectors(connectors, props.shouldHideInjectedConnector)
  }, [connectors, props.shouldHideInjectedConnector])

  const allowExternalWalletButtons = shouldAllowExternalWalletButtons({
    filteredConnectorCount: filteredConnectors.length,
  })

  return (
    <>
      {props.showPrivyDivider ? (
        <>
          <div className="h-px bg-white/8 my-1" />
          <div className="px-4 py-1 text-[10px] text-zinc-600 uppercase tracking-wider">External wallets</div>
        </>
      ) : null}
      {props.hasMultipleInjectedProviders ? (
        <div className="px-4 py-2 app-meta-value text-zinc-500">
          Multiple wallet extensions detected. Choose Rabby, Coinbase Wallet, or WalletConnect directly.
        </div>
      ) : props.lockedEthereumProviderGlobal ? (
        <div className="px-4 py-2 app-meta-value text-zinc-500">
          Wallet extension collision detected (`window.ethereum` is locked). Choose Rabby, Coinbase Wallet, or WalletConnect directly.
        </div>
      ) : null}
      {allowExternalWalletButtons
        ? filteredConnectors.map((connector) => (
            <button
              key={connector.uid}
              type="button"
              disabled={isPending || props.authBusy}
              className="w-full text-left py-3 px-4 hover:bg-white/4 transition-colors disabled:opacity-50"
              onClick={() => {
                connect({ connector })
                props.onClose()
              }}
            >
              <span className="label block">{connector.name}</span>
            </button>
          ))
        : null}
    </>
  )
}

type WalletIdentityPresentationInput = {
  address: string
  basename: string | null
  basenameAvatar: string | null
  miniUsername: string | null
  miniAvatarUrl: string | null
}

type WalletIdentityPresentation = {
  primaryLabel: string
  secondaryLabel: string
  avatarUrl: string | null
  avatarFallback: string
}

function formatAddress(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

function normalizeBasename(value: string | null): string | null {
  const trimmed = typeof value === 'string' ? value.trim() : ''
  if (!trimmed) return null
  return trimmed.replace(/\.base\.eth$/i, '') || null
}

function formatUsdValue(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '--'
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`
  if (value >= 1_000) return `$${(value / 1_000).toFixed(2)}K`
  return `$${value.toFixed(2)}`
}

function formatTokenAmount(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '--'
  if (value >= 10_000) return value.toLocaleString(undefined, { maximumFractionDigits: 0 })
  if (value >= 100) return value.toLocaleString(undefined, { maximumFractionDigits: 2 })
  if (value >= 1) return value.toLocaleString(undefined, { maximumFractionDigits: 4 })
  return value.toLocaleString(undefined, { maximumFractionDigits: 6 })
}

type TrayPointsOverview = {
  points: {
    total: number
    invite: number
    signup: number
    links: number
    tasks: number
    csw: number
    social: number
    checkins: number
    bonus: number
    agent: number
  }
  rank: {
    invite: number | null
    total: number | null
  }
  totalCount: number
}

function buildTrayPointsOverviewRows(points: TrayPointsOverview['points']) {
  const safe = (value: unknown) => {
    const n = typeof value === 'number' ? value : Number(value)
    return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0
  }

  const buckets: Record<string, number> = {
    Invites: safe(points.invite),
    Signup: safe(points.signup),
    Links: safe(points.links),
    CSW: safe(points.csw),
    Social: safe(points.social),
    'Check-ins': safe(points.checkins),
    Tasks: safe(points.tasks),
    Bonus: safe(points.bonus),
    Agent: safe(points.agent),
  }

  const total = safe(points.total)
  const accounted = Object.values(buckets).reduce((sum, value) => sum + value, 0)
  const remainder = total - accounted
  if (remainder > 0) {
    buckets['Check-ins'] = (buckets['Check-ins'] ?? 0) + remainder
  }

  return Object.entries(buckets)
    .map(([label, value]) => ({ label, value }))
    .filter((item) => item.value > 0)
}

export function deriveWalletIdentityPresentation(input: WalletIdentityPresentationInput): WalletIdentityPresentation {
  const shortAddress = formatAddress(input.address)
  const normalizedMiniUsername = typeof input.miniUsername === 'string' ? input.miniUsername.trim().replace(/^@+/, '') : ''
  if (normalizedMiniUsername) {
    return {
      primaryLabel: `@${normalizedMiniUsername}`,
      secondaryLabel: shortAddress,
      avatarUrl: input.miniAvatarUrl,
      avatarFallback: normalizedMiniUsername.charAt(0).toUpperCase(),
    }
  }

  const basename = normalizeBasename(input.basename)
  if (basename) {
    return {
      primaryLabel: basename,
      secondaryLabel: shortAddress,
      avatarUrl: input.basenameAvatar,
      avatarFallback: basename.charAt(0).toUpperCase(),
    }
  }

  return {
    primaryLabel: shortAddress,
    secondaryLabel: 'Base account',
    avatarUrl: input.miniAvatarUrl ?? input.basenameAvatar,
    avatarFallback: shortAddress.charAt(0).toUpperCase(),
  }
}

function IdentityButton({
  presentation,
  connected,
  menuOpen,
  onToggle,
}: {
  presentation: WalletIdentityPresentation
  connected: boolean
  menuOpen: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="group relative flex h-9 w-[164px] items-center gap-2.5 overflow-hidden rounded-full bg-[linear-gradient(180deg,rgba(255,255,255,0.1),rgba(255,255,255,0.04))] px-2.5 py-1 shadow-[0_10px_28px_-18px_rgba(0,0,0,0.9)] backdrop-blur-xl transition-all duration-200 hover:bg-[linear-gradient(180deg,rgba(255,255,255,0.14),rgba(255,255,255,0.06))]"
    >
      <div className="relative shrink-0">
        {presentation.avatarUrl ? (
          <img
            src={presentation.avatarUrl}
            alt=""
            className="h-7 w-7 rounded-full object-cover ring-1 ring-white/12"
          />
        ) : (
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[linear-gradient(135deg,rgb(var(--brand-primary)/0.95),rgb(var(--brand-hover)/0.7))] text-[11px] font-semibold text-white ring-1 ring-white/12">
            {presentation.avatarFallback}
          </div>
        )}
        <span
          className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border border-[rgb(8,8,8)] ${connected ? 'bg-cyan-400' : 'bg-emerald-400'}`}
          aria-hidden="true"
        />
      </div>
      <span className="min-w-0 flex-1 truncate text-left text-[11px] font-medium text-white">
        {presentation.primaryLabel}
        <span className="ml-1 text-[10px] font-normal text-zinc-500">{presentation.secondaryLabel}</span>
      </span>
      <ChevronDown className={`h-3 w-3 shrink-0 text-zinc-500 transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
    </button>
  )
}

function DropdownLayer({
  onClose,
  panelClassName,
  children,
}: {
  onClose: () => void
  panelClassName: string
  children: ReactNode
}) {
  return (
    <>
      <div
        className="fixed inset-0 z-40"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className={panelClassName}>{children}</div>
    </>
  )
}

export function ConnectButton({
  variant = 'default',
}: {
  variant?: ConnectButtonVariant
}) {
  const { address, isConnected } = useAccount()
  const { disconnect } = useDisconnect()
  const auth = useSiweAuth()
  const { getAccessToken } = usePrivy()
  const canonicalIdentity = useCanonicalIdentity()
  const { me: accountProfile, refresh: refreshAccountProfile } = useAccountMe()
  const [disconnectingMainWallet, setDisconnectingMainWallet] = useState(false)
  const [trayTab, setTrayTab] = useState<'tokens' | 'activity'>('tokens')
  const [traySection, setTraySection] = useState<'account' | 'portfolio' | 'points'>('account')
  const privyStatus = usePrivyClientStatus()
  const prefersPrivyWalletLogin = privyStatus === 'ready'
  const [showMenu, setShowMenu] = useState(false)
  const [showOptions, setShowOptions] = useState(false)
  const mountedRef = useRef(true)
  const optionsPanelClassName = 'absolute right-0 top-full mt-3 w-64 card p-3 z-50 space-y-1'
  const isPhoneViewport = useIsPhoneViewport()
  const trayPin = isPhoneViewport ? 'bottom' : 'right'
  const trayStyles = useMemo(() => {
    if (isPhoneViewport) {
      return {
        header: {
          minHeight: '0px',
        },
        content: {
          paddingTop: '0.5rem',
          paddingBottom: '0.75rem',
        },
      }
    }
    return {
      header: {
        minHeight: '0px',
      },
      content: {
        paddingTop: '0.5rem',
        paddingBottom: '0.75rem',
      },
    }
  }, [isPhoneViewport])

  const disconnectMainWallet = useCallback(async () => {
    const externalAddress = canonicalIdentity.externalEoaAddress
    if (disconnectingMainWallet) return
    setDisconnectingMainWallet(true)
    try {
      if (externalAddress) {
        await apiFetch('/api/wallet/disconnect-external', {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ address: externalAddress }),
          withCredentials: true,
        })
      }
      disconnect()
      refreshAccountProfile()
      setShowMenu(false)
    } finally {
      setDisconnectingMainWallet(false)
    }
  }, [refreshAccountProfile, canonicalIdentity.externalEoaAddress, disconnect, disconnectingMainWallet])

  const providerCollision = useMemo(() => detectEthereumProviderCollision(), [])
  const { hasMultipleInjectedProviders, lockedEthereumProviderGlobal } = providerCollision
  const shouldHideInjectedConnector = providerCollision.shouldDisableInjectedConnector
  const { trayWalletSources, trayHoldings, trayTokenRows, trayPortfolioQuery } = useAccountTrayPortfolio()
  const trayWalletKey = useMemo(
    () => trayWalletSources.map((wallet) => wallet.address.toLowerCase()).sort().join(','),
    [trayWalletSources],
  )
  const zoraTokenWalletSources = useMemo<TrayWalletSource[]>(() => trayWalletSources, [trayWalletSources])
  void zoraTokenWalletSources
  const trayZoraHoldingsQuery = useQuery({
    queryKey: ['account-tray', 'zora-holdings', trayWalletKey],
    enabled: auth.hasSession && showMenu && trayWalletSources.length > 0,
    staleTime: 60_000,
    retry: 0,
    queryFn: async () =>
      fetchTrayZoraHoldingsForWallets(
        trayWalletSources.map((wallet) => wallet.address),
        { topTokenCount: 100 },
      ),
  })
  const trayZoraCreatorTokens = useMemo(
    () => trayZoraHoldingsQuery.data?.creator ?? [],
    [trayZoraHoldingsQuery.data?.creator],
  )
  const trayZoraContentTokens = useMemo(
    () => trayZoraHoldingsQuery.data?.content ?? [],
    [trayZoraHoldingsQuery.data?.content],
  )
  const trayZoraTrendTokens = useMemo(
    () => trayZoraHoldingsQuery.data?.trend ?? [],
    [trayZoraHoldingsQuery.data?.trend],
  )
  const trayZoraTokenKeys = useMemo(
    () => collectTrayZoraTokenKeys(trayZoraCreatorTokens, trayZoraContentTokens, trayZoraTrendTokens),
    [trayZoraCreatorTokens, trayZoraContentTokens, trayZoraTrendTokens],
  )
  const trayHoldingsList = useMemo<TrayAssetHolding[]>(
    () => buildTrayAssetHoldings(trayTokenRows, { excludeTokenKeys: trayZoraTokenKeys }),
    [trayTokenRows, trayZoraTokenKeys],
  )
  const trayPortfolioDisplayUsd = useMemo(() => {
    const visibleTotal =
      sumTrayAssetUsd(trayHoldingsList) +
      sumTrayAssetUsd(trayZoraCreatorTokens) +
      sumTrayAssetUsd(trayZoraContentTokens) +
      sumTrayAssetUsd(trayZoraTrendTokens)
    return visibleTotal > 0 ? visibleTotal : trayHoldings.aggregateUsd
  }, [trayHoldingsList, trayZoraCreatorTokens, trayZoraContentTokens, trayZoraTrendTokens, trayHoldings.aggregateUsd])
  const trayPortfolioSourceNote = useMemo(() => {
    const sources = trayPortfolioQuery.data?.sources
    if (!sources) return null
    const values = Object.values(sources).filter(Boolean)
    if (values.length === 0) return null
    if (values.every((s) => s === 'base-etherscan')) {
      return 'Balances from Base (Etherscan). DeFi positions and other chains are not included.'
    }
    if (values.some((s) => s === 'base-etherscan')) {
      return 'Some wallets use Base-only balance data (Etherscan fallback).'
    }
    return null
  }, [trayPortfolioQuery.data?.sources])
  const trayHoldingsLoading = trayPortfolioQuery.isLoading
  const trayZoraTokensLoading = trayZoraHoldingsQuery.isLoading
  const sessionAddress = auth.authAddress ?? null
  const trayAccountPointsQuery = useQuery({
    queryKey: ['account-tray', 'accounts-me-points'],
    enabled: auth.hasSession && showMenu && privyStatus === 'ready',
    staleTime: 15_000,
    retry: (failureCount, error) => !isAccountTrayPointsAuthError(error) && failureCount < 1,
    queryFn: async () => {
      const token =
        typeof getAccessToken === 'function' ? await getAccessToken().catch(() => null) : null
      return fetchAccountTrayPoints(40, token)
    },
  })
  const trayPointsAuthRequired = isAccountTrayPointsAuthError(trayAccountPointsQuery.error)
  const trayPointsOverview = useMemo((): TrayPointsOverview | null => {
    const tray = trayAccountPointsQuery.data
    if (!tray || tray.signupId <= 0) return null
    return {
      points: tray.points,
      rank: tray.rank,
      totalCount: tray.totalCount,
    }
  }, [trayAccountPointsQuery.data])
  const trayPointsDisplay = resolvePublicPointsDisplay({
    score: accountProfile?.score ?? null,
    positionTotal: trayAccountPointsQuery.data?.points.total ?? null,
  })
  const buttonState = deriveConnectButtonState({
    sessionHydrated: auth.sessionHydrated,
    isConnected,
    connectedAddress: address,
    sessionAddress,
  })

  const identityAddress = buttonState === 'connected-wallet' ? address ?? null : buttonState === 'session-restored' ? sessionAddress : null
  const shouldResolveIdentity = shouldResolveConnectIdentity({
    variant,
    identityAddress,
    showMenu,
    showOptions,
  })
  const sharedIdentity = useChatIdentity(shouldResolveIdentity ? identityAddress : null)
  const basename = shouldResolveIdentity && sharedIdentity.source !== 'address' ? sharedIdentity.displayName : null
  const unifiedAvatar = shouldResolveIdentity ? sharedIdentity.avatar : null
  const toggleMenu = () => {
    setShowOptions(false)
    setShowMenu((current) => !current)
    setTrayTab('tokens')
    setTraySection('account')
  }
  const toggleOptions = () => {
    setShowMenu(false)
    setShowOptions((current) => !current)
  }
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])
  useEffect(() => {
    if (typeof window === 'undefined') return
    const handleOpenTray = (event: Event) => {
      if (buttonState === 'signed-out') {
        setShowMenu(false)
        setShowOptions(true)
        return
      }
      if (buttonState === 'hydrating') return
      const customEvent = event as CustomEvent<AccountTrayOpenDetail>
      const section = customEvent.detail?.section ?? 'portfolio'
      const nextTab = customEvent.detail?.tab ?? (section === 'portfolio' ? 'tokens' : trayTab)
      setTraySection(section)
      setTrayTab(nextTab)
      setShowOptions(false)
      setShowMenu(true)
    }
    window.addEventListener(OPEN_ACCOUNT_TRAY_EVENT, handleOpenTray as EventListener)
    return () => window.removeEventListener(OPEN_ACCOUNT_TRAY_EVENT, handleOpenTray as EventListener)
  }, [buttonState, trayTab])
  const closeMenuAfterTrayClose = useCallback(() => {
    const close = () => {
      if (mountedRef.current) setShowMenu(false)
    }
    if (typeof queueMicrotask === 'function') {
      queueMicrotask(close)
      return
    }
    globalThis.setTimeout(close, 0)
  }, [])

  if (buttonState === 'hydrating') {
    if (variant === 'nav') {
      return (
        <button
          type="button"
          disabled
          className="inline-flex h-9 w-[164px] items-center justify-center gap-2 rounded-full bg-white/8 px-3 text-[11px] font-medium text-zinc-200 transition disabled:opacity-50"
        >
          <Wallet className="w-4 h-4" />
          <span className="tracking-[0.01em]">Checking session…</span>
        </button>
      )
    }
    return (
      <Button
        type="button"
        variant="primary"
        disabled
        className="flex min-w-[152px] items-center justify-center gap-2"
      >
        <Wallet className="w-4 h-4" />
        <span className="label">Checking session…</span>
      </Button>
    )
  }

  // Connected - show address with disconnect option
  if (buttonState === 'connected-wallet' && isConnected && address) {
    const presentation = deriveWalletIdentityPresentation({
      address,
      basename,
      basenameAvatar: unifiedAvatar,
      miniUsername: null,
      miniAvatarUrl: unifiedAvatar,
    })

    // Show the canonical card as long as a SIWE session is active. The
    // card handles `cswAddress === null` internally (shows a "Linking
    // smart wallet…" state while /api/accounts/me resolves, and a
    // "No CSW linked yet" state when the profile hasn't linked one).
    // Previously this was gated on cswAddress being non-null, which
    // caused the card to fall back to the legacy IdentityButton — and
    // the legacy button displays the Privy embedded EOA as the primary
    // address, which for Privy-native flows is NOT the CSW. Users saw
    // 0xceca… (embedded EOA) in place of 0xab6d… (actual CSW).
    const showCanonicalCard = auth.hasSession

    return (
      <div className="relative">
        {showCanonicalCard ? (
          <CanonicalIdentityCard
            identity={canonicalIdentity}
            menuOpen={showMenu}
            onToggle={toggleMenu}
            variant="nav"
            activeNetworkLabel={trayHoldings.activeNetworkLabel}
            activeNetworkUsd={trayHoldings.activeNetworkUsd}
          />
        ) : (
          <IdentityButton presentation={presentation} connected menuOpen={showMenu} onToggle={toggleMenu} />
        )}

        {showMenu && (
          <AccountTray
            pin={trayPin}
            showHandleBar={isPhoneViewport}
            accessibilityLabel="Account menu"
            onCloseComplete={closeMenuAfterTrayClose}
            onRequestClose={() => setShowMenu(false)}
            styles={trayStyles}
            closeAccessibilityLabel="Close account menu"
          >
              {auth.hasSession ? (
                <RelayTrayPrimaryTabs section={traySection} onChange={setTraySection} />
              ) : null}
              {showCanonicalCard && (!auth.hasSession || traySection === 'account') ? (
                <>
                  <CanonicalIdentityDropdown
                    identity={canonicalIdentity}
                    onRequestConnectWallet={() => {
                      setShowMenu(false)
                      setShowOptions(true)
                    }}
                    onRequestSignOut={() => {
                      void auth.signOut()
                      setShowMenu(false)
                    }}
                    signingOut={auth.busy}
                    onRequestDisconnectMainWallet={() => {
                      void disconnectMainWallet()
                    }}
                    disconnectingMainWallet={disconnectingMainWallet}
                  />
                  <div className="h-px bg-white/8 my-2" />
                </>
              ) : null}
              {auth.hasSession && traySection === 'portfolio' ? (
                <RelayTrayPortfolioModule
                  tab={trayTab}
                  onTabChange={setTrayTab}
                  aggregateUsd={trayPortfolioDisplayUsd}
                  activeNetworkLabel={trayHoldings.activeNetworkLabel}
                  rows={trayHoldings.rows}
                  loading={trayHoldingsLoading}
                  holdings={trayHoldingsList}
                  holdingsLoading={trayPortfolioQuery.isLoading}
                  portfolioSourceNote={trayPortfolioSourceNote}
                  zoraCreatorTokens={trayZoraCreatorTokens}
                  zoraContentTokens={trayZoraContentTokens}
                  zoraTrendTokens={trayZoraTrendTokens}
                  zoraTokensLoading={trayZoraTokensLoading}
                />
              ) : null}
              {auth.hasSession && traySection === 'points' ? (
                <RelayTrayPointsModule
                  pointsTotal={trayPointsOverview?.points.total ?? trayPointsDisplay.points}
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
              {!auth.hasSession ? (
                <button
                  type="button"
                  onClick={() => {
                    void auth.signIn()
                    setShowMenu(false)
                  }}
                  disabled={auth.busy}
                  className="w-full text-left py-3 px-4 hover:bg-white/4 transition-colors disabled:opacity-60"
                >
                  <span className="label block">{auth.busy ? 'Signing in…' : 'Sign in'}</span>
                  <span className="app-meta-value text-zinc-600 block mt-1">No transaction.</span>
                </button>
              ) : traySection === 'account' ? (
                <div className="px-4 py-3">
                  <div className="label text-emerald-200">Signed in</div>
                  <div className="app-meta-value text-zinc-600 mt-1">
                    {getSignedInSessionCopy({
                      walletMatchesSession: auth.walletMatchesSession,
                      sessionAddress: sessionAddress ?? null,
                      connectedAddress: address ?? null,
                      embeddedAddress: canonicalIdentity.privyEmbeddedAddress,
                    })}
                  </div>
                </div>
              ) : null}
              {auth.hasSession ? <div className="mt-auto" /> : null}
              {auth.hasSession ? (
                <div className="border-t border-white/8 bg-black/20">
                  <button
                    type="button"
                    onClick={() => setShowMenu(false)}
                    className="w-full text-left py-3 px-4 hover:bg-white/4 transition-colors"
                  >
                    <span className="label block text-zinc-300">Help</span>
                  </button>
                  <Link
                    to="/accounts"
                    onClick={() => setShowMenu(false)}
                    className="block w-full py-3 px-4 hover:bg-white/4 transition-colors"
                  >
                    <span className="label block text-zinc-300">Accounts</span>
                  </Link>
                  <Link
                    to="/accounts"
                    onClick={() => setShowMenu(false)}
                    className="block w-full py-3 px-4 hover:bg-white/4 transition-colors"
                  >
                    <span className="label block text-zinc-300">Settings</span>
                  </Link>
                </div>
              ) : null}
              {auth.error ? <div className="px-4 text-[11px] text-red-400/90">{auth.error}</div> : null}
          </AccountTray>
        )}
      </div>
    )
  }

  // Session restored, but no active wagmi connection.
  // This happens after cross-origin Privy handoff where the 4626
  // auth session exists but the client wallet provider is not yet
  // connected on this page load.
  if (buttonState === 'session-restored' && sessionAddress) {
    const presentation = deriveWalletIdentityPresentation({
      address: sessionAddress,
      basename,
      basenameAvatar: unifiedAvatar,
      miniUsername: null,
      miniAvatarUrl: unifiedAvatar,
    })

    // Same rationale as the connected-wallet branch above: show the
    // canonical card whenever a session exists and let the card handle
    // loading / missing-CSW states internally.
    const showCanonicalCard = true

    return (
      <div className="relative">
        {showCanonicalCard ? (
          <CanonicalIdentityCard
            identity={canonicalIdentity}
            menuOpen={showMenu}
            onToggle={toggleMenu}
            variant="nav"
            activeNetworkLabel={trayHoldings.activeNetworkLabel}
            activeNetworkUsd={trayHoldings.activeNetworkUsd}
          />
        ) : (
          <IdentityButton presentation={presentation} connected={false} menuOpen={showMenu} onToggle={toggleMenu} />
        )}

        {showMenu && (
          <AccountTray
            pin={trayPin}
            showHandleBar={isPhoneViewport}
            accessibilityLabel="Account menu"
            onCloseComplete={closeMenuAfterTrayClose}
            onRequestClose={() => setShowMenu(false)}
            styles={trayStyles}
            closeAccessibilityLabel="Close account menu"
          >
              <RelayTrayPrimaryTabs section={traySection} onChange={setTraySection} />
              {traySection === 'account' ? (
                <>
                  <div className="px-4 py-3">
                    <div className="app-meta-value text-zinc-500">
                      Signed in. Connect your main wallet to finish setup.
                    </div>
                  </div>
                  {showCanonicalCard ? (
                    <>
                      <CanonicalIdentityDropdown
                        identity={canonicalIdentity}
                        onRequestConnectWallet={() => {
                          setShowMenu(false)
                          setShowOptions(true)
                        }}
                        onRequestSignOut={() => {
                          void auth.signOut()
                          setShowMenu(false)
                        }}
                        signingOut={auth.busy}
                        onRequestDisconnectMainWallet={() => {
                          void disconnectMainWallet()
                        }}
                        disconnectingMainWallet={disconnectingMainWallet}
                      />
                      <div className="h-px bg-white/8 my-2" />
                    </>
                  ) : (
                    <div className="px-4 py-3">
                      <div className="label text-emerald-200">Signed in</div>
                      <div className="app-meta-value text-zinc-600 mt-1">
                        Session signer: {formatAddress(sessionAddress)}.
                      </div>
                    </div>
                  )}
                </>
              ) : traySection === 'portfolio' ? (
                <RelayTrayPortfolioModule
                  tab={trayTab}
                  onTabChange={setTrayTab}
                  aggregateUsd={trayPortfolioDisplayUsd}
                  activeNetworkLabel={trayHoldings.activeNetworkLabel}
                  rows={trayHoldings.rows}
                  loading={trayHoldingsLoading}
                  holdings={trayHoldingsList}
                  holdingsLoading={trayPortfolioQuery.isLoading}
                  portfolioSourceNote={trayPortfolioSourceNote}
                  zoraCreatorTokens={trayZoraCreatorTokens}
                  zoraContentTokens={trayZoraContentTokens}
                  zoraTrendTokens={trayZoraTrendTokens}
                  zoraTokensLoading={trayZoraTokensLoading}
                />
              ) : (
                <RelayTrayPointsModule
                  pointsTotal={trayPointsOverview?.points.total ?? trayPointsDisplay.points}
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
              )}
              {auth.error ? <div className="px-4 text-[11px] text-red-400/90">{auth.error}</div> : null}
              <div className="mt-auto" />
              <div className="border-t border-white/8 bg-black/20">
                <button
                  type="button"
                  onClick={() => setShowMenu(false)}
                  className="w-full text-left py-3 px-4 hover:bg-white/4 transition-colors"
                >
                  <span className="label block text-zinc-300">Help</span>
                </button>
                <Link
                  to="/accounts"
                  onClick={() => setShowMenu(false)}
                  className="block w-full py-3 px-4 hover:bg-white/4 transition-colors"
                >
                  <span className="label block text-zinc-300">Accounts</span>
                </Link>
                <Link
                  to="/accounts"
                  onClick={() => setShowMenu(false)}
                  className="block w-full py-3 px-4 hover:bg-white/4 transition-colors"
                >
                  <span className="label block text-zinc-300">Settings</span>
                </Link>
              </div>
          </AccountTray>
        )}

        {showOptions && (
          <DropdownLayer onClose={() => setShowOptions(false)} panelClassName={optionsPanelClassName}>
            <ExternalWalletOptions
              authBusy={auth.busy}
              hasMultipleInjectedProviders={hasMultipleInjectedProviders}
              lockedEthereumProviderGlobal={lockedEthereumProviderGlobal}
              shouldHideInjectedConnector={shouldHideInjectedConnector}
              onClose={() => setShowOptions(false)}
            />
          </DropdownLayer>
        )}
      </div>
    )
  }

  // Disconnected - Privy-first sign in
  const signInOnClick = () => {
    if (prefersPrivyWalletLogin) {
      void (async () => {
        const signed = await auth.signIn({ method: 'privy' })
        if (!signed) {
          setShowMenu(false)
          setShowOptions(true)
        }
      })()
    } else {
      toggleOptions()
    }
  }
  const signInLabel = auth.busy ? 'Signing in…' : 'Sign in'

  return (
    <div className="relative">
      {variant === 'nav' ? (
        <button
          type="button"
          disabled={auth.busy}
          onClick={signInOnClick}
          className="inline-flex h-9 w-[164px] items-center justify-center gap-2 rounded-full bg-white/8 px-3 text-[11px] font-medium text-zinc-100 transition-all duration-200 hover:bg-white/12 disabled:opacity-50"
        >
          <Wallet className="w-4 h-4" />
          <span className="tracking-[0.01em]">{signInLabel}</span>
        </button>
      ) : (
        <Button
          type="button"
          variant="primary"
          disabled={auth.busy}
          onClick={signInOnClick}
          className="flex min-w-[136px] items-center justify-center gap-2"
        >
          <Wallet className="w-4 h-4" />
          <span className="label">{signInLabel}</span>
        </Button>
      )}
      {auth.error ? <div className="mt-2 max-w-[280px] text-[11px] text-red-400/90">{auth.error}</div> : null}

      {showOptions && (
        <DropdownLayer onClose={() => setShowOptions(false)} panelClassName={optionsPanelClassName}>
            {prefersPrivyWalletLogin ? (
              <>
                <button
                  type="button"
                  disabled={auth.busy}
                  className="w-full text-left py-3 px-4 hover:bg-white/4 transition-colors disabled:opacity-50"
                  onClick={() => {
                    setShowOptions(false)
                    void auth.signIn({ method: 'privy' })
                  }}
                >
                  <span className="label block">Sign in with email or wallet</span>
                  <span className="app-meta-value text-zinc-500 block mt-1">Verified email first, or continue with wallet</span>
                </button>
              </>
            ) : null}
            <ExternalWalletOptions
              authBusy={auth.busy}
              hasMultipleInjectedProviders={hasMultipleInjectedProviders}
              lockedEthereumProviderGlobal={lockedEthereumProviderGlobal}
              shouldHideInjectedConnector={shouldHideInjectedConnector}
              showPrivyDivider={prefersPrivyWalletLogin}
              onClose={() => setShowOptions(false)}
            />
        </DropdownLayer>
      )}
    </div>
  )
}

function RelayTrayPrimaryTabs(props: {
  section: 'account' | 'portfolio' | 'points'
  onChange: (section: 'account' | 'portfolio' | 'points') => void
}) {
  return (
    <div className="px-4 pt-1 pb-2">
      <div className="inline-flex items-center gap-1 rounded-lg border border-white/8 bg-black/20 p-1">
        {(['account', 'portfolio', 'points'] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => props.onChange(value)}
            className={`rounded-md px-2 py-1 text-[12px] font-medium transition-colors ${
              props.section === value
                ? 'bg-white/[0.08] text-white'
                : 'text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-200'
            }`}
          >
            {value === 'account' ? 'Account' : value === 'portfolio' ? 'Portfolio' : 'Points'}
          </button>
        ))}
      </div>
    </div>
  )
}

function RelayTrayPortfolioModule(props: {
  tab: 'tokens' | 'activity'
  onTabChange: (tab: 'tokens' | 'activity') => void
  aggregateUsd: number
  activeNetworkLabel: string
  rows: TrayNetworkHolding[]
  loading: boolean
  holdings: TrayAssetHolding[]
  holdingsLoading: boolean
  portfolioSourceNote?: string | null
  zoraCreatorTokens: TrayTokenHolding[]
  zoraContentTokens: TrayTokenHolding[]
  zoraTrendTokens: TrayTokenHolding[]
  zoraTokensLoading: boolean
}) {
  const [networksExpanded, setNetworksExpanded] = useState(false)
  const topRows = props.rows.slice(0, 6)
  const activityRows = props.rows.slice(0, 4)
  const topHoldings = props.holdings
  const hasBalanceWithoutTokens =
    !props.holdingsLoading && topHoldings.length === 0 && props.aggregateUsd > 0.01
  const hasZoraTokens =
    props.zoraCreatorTokens.length > 0 ||
    props.zoraContentTokens.length > 0 ||
    props.zoraTrendTokens.length > 0

  return (
    <div className="flex min-h-0 flex-1 flex-col px-4 pt-2 pb-3">
      <div className="text-[30px] font-semibold leading-none tracking-tight text-white tabular-nums">
        {formatUsdValue(props.aggregateUsd)}
      </div>
      <div className="mt-1 text-[10px] text-zinc-500 truncate">{props.activeNetworkLabel}</div>
      {props.portfolioSourceNote ? (
        <div className="mt-1.5 text-[10px] leading-snug text-zinc-500">{props.portfolioSourceNote}</div>
      ) : null}

      <div className="mt-3 flex items-center gap-2 border-b border-white/8 pb-1">
        {(['tokens', 'activity'] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => props.onTabChange(value)}
            className={`rounded-md px-2 py-1 text-[12px] font-medium transition-colors ${
              props.tab === value
                ? 'text-white bg-white/[0.08]'
                : 'text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.04]'
            }`}
          >
            {value === 'tokens' ? 'Tokens' : 'Activity'}
          </button>
        ))}
      </div>

      {props.tab === 'tokens' ? (
        <div className="mt-3 flex-1">
          <div className="pb-1.5 text-[10px] uppercase tracking-[0.12em] text-zinc-500">Holdings</div>
          {props.loading || props.holdingsLoading ? (
            <div className="text-[11px] text-zinc-500">Loading token balances…</div>
            ) : topHoldings.length === 0 ? (
              <div className="text-[11px] text-zinc-500">
                {hasBalanceWithoutTokens
                  ? `Portfolio total is ${formatUsdValue(props.aggregateUsd)}, but individual tokens could not be loaded. Try again in a moment.`
                  : hasZoraTokens
                    ? 'No other Base token balances. Zora coins are listed below.'
                    : 'No token balances found yet.'}
              </div>
          ) : (
            <div className="divide-y divide-white/5">
              {topHoldings.map((token) => (
                <RelayTrayHoldingRow key={`holding:${token.tokenKey}`} token={token} />
              ))}
            </div>
          )}

          {topRows.length > 0 ? (
            <div className="mt-4 border-t border-white/8 pt-3">
              <button
                type="button"
                onClick={() => setNetworksExpanded((current) => !current)}
                className="flex w-full items-center justify-between gap-2 py-1 text-left"
              >
                <span className="text-[10px] uppercase tracking-[0.12em] text-zinc-500">
                  By network ({topRows.length})
                </span>
                <ChevronDown
                  className={`h-3.5 w-3.5 shrink-0 text-zinc-500 transition-transform ${networksExpanded ? 'rotate-180' : ''}`}
                />
              </button>
              {networksExpanded ? (
                <div className="mt-1 divide-y divide-white/5">
                  {topRows.map((row) => (
                    <div key={row.networkId} className="flex items-center gap-2 py-2">
                      {row.networkLogoUrl ? (
                        <img src={row.networkLogoUrl} alt="" className="h-5 w-5 shrink-0 rounded-full border border-white/10" />
                      ) : (
                        <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04]">
                          <span className="h-2.5 w-2.5 rounded-sm bg-[rgb(var(--brand-primary))]" />
                        </span>
                      )}
                      <span className="min-w-0 flex-1 truncate text-[12px] text-zinc-200">{row.networkLabel}</span>
                      <span className="text-[12px] tabular-nums text-zinc-300">{formatUsdValue(row.usdTotal)}</span>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          {props.zoraCreatorTokens.length > 0 ||
          props.zoraContentTokens.length > 0 ||
          props.zoraTrendTokens.length > 0 ||
          props.zoraTokensLoading ? (
            <div className="mt-4 space-y-4 border-t border-white/8 pt-3">
              {props.zoraTokensLoading ? (
                <div className="text-[11px] text-zinc-500">Loading Zora coin holdings…</div>
              ) : (
                <>
                  {props.zoraCreatorTokens.length > 0 ? (
                    <div>
                      <div className="pb-1.5 text-[10px] uppercase tracking-[0.12em] text-zinc-500">
                        Zora creator coins
                      </div>
                      <div className="divide-y divide-white/5">
                        {props.zoraCreatorTokens.map((token) => (
                          <RelayTrayHoldingRow
                            key={`zora-creator:${token.tokenKey}`}
                            token={token}
                            subtitle="Creator coin"
                          />
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {props.zoraTrendTokens.length > 0 ? (
                    <div>
                      <div className="pb-1.5 text-[10px] uppercase tracking-[0.12em] text-zinc-500">
                        Zora trend coins
                      </div>
                      <div className="divide-y divide-white/5">
                        {props.zoraTrendTokens.map((token) => (
                          <RelayTrayHoldingRow
                            key={`zora-trend:${token.tokenKey}`}
                            token={token}
                            subtitle="Trend coin"
                          />
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {props.zoraContentTokens.length > 0 ? (
                    <div>
                      <div className="pb-1.5 text-[10px] uppercase tracking-[0.12em] text-zinc-500">
                        Zora content coins
                      </div>
                      <div className="divide-y divide-white/5">
                        {props.zoraContentTokens.map((token) => (
                          <RelayTrayHoldingRow
                            key={`zora-content:${token.tokenKey}`}
                            token={token}
                            subtitle="Content coin"
                          />
                        ))}
                      </div>
                    </div>
                  ) : null}
                </>
              )}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="mt-2 flex-1 divide-y divide-white/5">
          {activityRows.length === 0 && topHoldings.length === 0 ? (
            <div className="py-2 text-[11px] text-zinc-500">No recent portfolio activity yet.</div>
          ) : (
            <>
              {activityRows.map((row) => (
                <div key={`activity:${row.networkId}`} className="flex items-center justify-between py-2">
                  <span className="min-w-0">
                    <span className="block truncate text-[12px] text-zinc-200">{row.networkLabel}</span>
                    <span className="block text-[10px] text-zinc-600">Network exposure</span>
                  </span>
                  <span className="text-[12px] tabular-nums text-zinc-300">{formatUsdValue(row.usdTotal)}</span>
                </div>
              ))}
              {topHoldings.slice(0, 3).map((token) => (
                <div key={`activity-token:${token.tokenKey}`} className="flex items-center justify-between py-2">
                  <span className="min-w-0">
                    <span className="block truncate text-[12px] text-zinc-200">{token.symbol}</span>
                    <span className="block text-[10px] text-zinc-600">Top holding snapshot</span>
                  </span>
                  <span className="text-[12px] tabular-nums text-zinc-300">{formatUsdValue(token.usdValue)}</span>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}

function RelayTrayHoldingRow(props: { token: TrayAssetHolding; subtitle?: string }) {
  return (
    <div className="flex items-center gap-2.5 py-2.5">
      {props.token.logoUrl ? (
        <img src={props.token.logoUrl} alt="" className="h-8 w-8 shrink-0 rounded-full border border-white/10" />
      ) : (
        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04]">
          <span className="h-3 w-3 rounded-sm bg-[rgb(var(--brand-primary))]" />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium text-white">{props.token.symbol}</span>
        <span className="block truncate text-[11px] text-zinc-500">
          {formatTokenAmount(props.token.amount)}
          {props.subtitle ? ` · ${props.subtitle}` : ''}
        </span>
      </span>
      <span className="text-[13px] font-medium tabular-nums text-zinc-100">{formatUsdValue(props.token.usdValue)}</span>
    </div>
  )
}

type PointsTrayTab = 'overview' | 'history' | 'leaderboard'

const POINTS_TRAY_TABS: { id: PointsTrayTab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'history', label: 'History' },
  { id: 'leaderboard', label: 'Leaderboard' },
]

type TrayLeaderboardResponse = {
  totalCount: number
  leaderboard: LeaderboardEntry[]
  me: LeaderboardEntry | null
}

async function fetchTrayLeaderboard(limit: number): Promise<TrayLeaderboardResponse> {
  const res = await apiFetch(
    `${API_ENDPOINTS.waitlist.leaderboard}?pointsType=total&page=1&limit=${limit}`,
    {
      method: 'GET',
      headers: { Accept: 'application/json' },
    },
  )
  const json = (await res.json().catch(() => null)) as ApiEnvelope<TrayLeaderboardResponse> | null
  if (!res.ok || !json?.success || !json.data) {
    throw new Error(json?.error || 'Leaderboard request failed')
  }
  return json.data
}

function RelayTrayPointsModule(props: {
  pointsTotal: number
  position: TrayPointsOverview | null
  pointsLoading: boolean
  activity: PointsActivityRow[]
  activityLoading: boolean
  activityError?: boolean
  activityAuthRequired?: boolean
  leaderboardEligible: boolean
  hasAccountProfile: boolean
  signupId: number
}) {
  const [pointsTab, setPointsTab] = useState<PointsTrayTab>('overview')
  const totalRank = props.position?.rank.total ?? null
  const inviteRank = props.position?.rank.invite ?? null
  const totalCount = props.position?.totalCount ?? 0
  const breakdownRows = props.position ? buildTrayPointsOverviewRows(props.position.points) : []
  const canonicalTotal = props.position?.points.total ?? props.pointsTotal
  const activityRows = props.activity.filter((row) => row.waitlistPoints > 0)

  return (
    <div className="flex min-h-0 flex-1 flex-col px-4 pt-2 pb-3">
      <div className="text-[10px] uppercase tracking-[0.12em] text-zinc-500">Points</div>
      {props.pointsLoading ? (
        <div className="mt-2 text-[11px] text-zinc-500">Loading points…</div>
      ) : (
        <>
          <div className="mt-2 text-[30px] font-semibold leading-none tracking-tight text-white tabular-nums">
            {canonicalTotal.toLocaleString()}
          </div>

          <div className="mt-3 flex items-center gap-2 border-b border-white/8 pb-1">
            {POINTS_TRAY_TABS.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => setPointsTab(id)}
                className={`rounded-md px-2 py-1 text-[12px] font-medium transition-colors ${
                  pointsTab === id
                    ? 'bg-white/[0.08] text-white'
                    : 'text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {pointsTab === 'overview' ? (
            <div className="mt-3 space-y-3">
              {props.position ? (
                <>
                  <div>
                    <div className="pb-2 text-[10px] uppercase tracking-[0.12em] text-zinc-500">Category breakdown</div>
                    {breakdownRows.length === 0 ? (
                      <div className="text-[11px] text-zinc-400">No point awards yet.</div>
                    ) : (
                      <div className="divide-y divide-white/6">
                        {breakdownRows.map((item) => (
                          <div key={item.label} className="flex items-center justify-between py-2.5">
                            <span className="text-[12px] text-zinc-300">{item.label}</span>
                            <span className="text-[12px] tabular-nums text-zinc-200">
                              {item.value.toLocaleString()}
                            </span>
                          </div>
                        ))}
                        <div className="flex items-center justify-between py-2.5">
                          <span className="text-[12px] font-medium text-zinc-200">Total</span>
                          <span className="text-[12px] font-medium tabular-nums text-white">
                            {canonicalTotal.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="text-[11px] text-zinc-400">
                  {!props.hasAccountProfile
                    ? 'Verify your email on the waitlist to create your 4626 profile and earn points.'
                    : !props.leaderboardEligible
                      ? 'Complete email verification to appear on the leaderboard and see rank.'
                      : 'Point breakdown is not available yet.'}
                </div>
              )}
            </div>
          ) : pointsTab === 'history' ? (
            <div className="mt-3 flex min-h-0 flex-1 flex-col">
              <div className="pb-2 text-[10px] uppercase tracking-[0.12em] text-zinc-500">What you earned</div>
              {props.activityLoading ? (
                <div className="text-[11px] text-zinc-500">Loading point history…</div>
              ) : props.activityAuthRequired ? (
                <div className="text-[11px] text-zinc-400">
                  Sign in with email (Privy) to load point history, then reopen the tray.
                </div>
              ) : props.activityError ? (
                <div className="text-[11px] text-zinc-400">Could not load history. Try again in a moment.</div>
              ) : activityRows.length === 0 ? (
                <div className="text-[11px] text-zinc-400">
                  No point awards yet. Link accounts, invite friends, complete tasks, or check in on social to earn
                  points.
                </div>
              ) : (
                <div className="min-h-0 flex-1 divide-y divide-white/6">
                  {activityRows.map((row) => (
                    <RelayTrayPointsHistoryRow key={row.id} row={row} />
                  ))}
                </div>
              )}
            </div>
          ) : (
            <RelayTrayPointsLeaderboardPanel
              signupId={props.signupId}
              totalRank={totalRank}
              inviteRank={inviteRank}
              totalCount={totalCount}
              leaderboardEligible={props.leaderboardEligible}
              hasAccountProfile={props.hasAccountProfile}
              active={pointsTab === 'leaderboard'}
            />
          )}
        </>
      )}
    </div>
  )
}

function RelayTrayPointsLeaderboardPanel(props: {
  signupId: number
  totalRank: number | null
  inviteRank: number | null
  totalCount: number
  leaderboardEligible: boolean
  hasAccountProfile: boolean
  active: boolean
}) {
  const leaderboardQuery = useQuery({
    queryKey: ['account-tray-leaderboard', props.signupId],
    enabled: props.active,
    staleTime: 30_000,
    queryFn: () => fetchTrayLeaderboard(20),
  })

  const rows = leaderboardQuery.data?.leaderboard ?? []
  const meInList = rows.some((row) => row.signupId === props.signupId)
  const meRow = leaderboardQuery.data?.me ?? null

  return (
    <div className="mt-3 flex min-h-0 flex-1 flex-col">
      {props.leaderboardEligible && (props.totalRank || props.inviteRank) ? (
        <div className="mb-3 grid grid-cols-2 gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-[0.12em] text-zinc-500">Total rank</div>
            <div className="mt-1 text-[18px] font-semibold tabular-nums text-zinc-100">
              {props.totalRank ? `#${props.totalRank.toLocaleString()}` : '—'}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-[0.12em] text-zinc-500">Invite rank</div>
            <div className="mt-1 text-[18px] font-semibold tabular-nums text-zinc-100">
              {props.inviteRank ? `#${props.inviteRank.toLocaleString()}` : '—'}
            </div>
          </div>
        </div>
      ) : null}

      {props.totalCount > 0 ? (
        <div className="mb-2 text-[10px] text-zinc-500">
          {props.totalCount.toLocaleString()} profiles on the leaderboard
        </div>
      ) : null}

      {leaderboardQuery.isLoading ? (
        <div className="text-[11px] text-zinc-500">Loading leaderboard…</div>
      ) : leaderboardQuery.isError ? (
        <div className="text-[11px] text-zinc-400">Could not load leaderboard. Try again in a moment.</div>
      ) : !props.hasAccountProfile ? (
        <div className="text-[11px] text-zinc-400">
          Verify your email on the waitlist to create your 4626 profile and appear on the leaderboard.
        </div>
      ) : !props.leaderboardEligible ? (
        <div className="text-[11px] text-zinc-400">
          Complete email verification to appear on the leaderboard and see rank.
        </div>
      ) : rows.length === 0 ? (
        <div className="text-[11px] text-zinc-400">No leaderboard entries yet.</div>
      ) : (
        <div className="min-h-0 flex-1 divide-y divide-white/6">
          {rows.map((row) => (
            <RelayTrayPointsLeaderboardRow
              key={row.signupId}
              row={row}
              isMe={row.signupId === props.signupId}
            />
          ))}
          {meRow && !meInList ? (
            <>
              <div className="py-2 text-center text-[10px] uppercase tracking-[0.12em] text-zinc-600">Your rank</div>
              <RelayTrayPointsLeaderboardRow row={meRow} isMe />
            </>
          ) : null}
        </div>
      )}

      <Link
        to="/leaderboard"
        className="mt-3 inline-flex text-[12px] font-medium text-brand-200 hover:text-brand-100"
      >
        View full leaderboard
      </Link>
    </div>
  )
}

function RelayTrayPointsLeaderboardRow(props: { row: LeaderboardEntry; isMe: boolean }) {
  const { row, isMe } = props
  return (
    <div className={`py-2 ${isMe ? 'bg-brand-primary/10 -mx-1 px-1 rounded-md' : ''}`}>
      <div className="grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-2">
        <span className="text-[11px] font-semibold tabular-nums text-zinc-400">#{row.rank}</span>
        <div className="min-w-0 flex items-center gap-1.5">
          <LeaderboardIdentityCell
            display={formatLeaderboardDisplayName(row.display)}
            cswAddress={row.cswAddress}
            labelHint={row.labelHint}
            avatarUrl={row.avatarUrl}
            showZoraBadge={row.showZoraBadge}
            showBaseAppBadge={row.showBaseAppBadge}
            walletProvider={row.walletProvider}
          />
          {isMe ? (
            <span className="shrink-0 rounded-full border border-brand-primary/30 bg-brand-primary/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-brand-200">
              You
            </span>
          ) : null}
        </div>
        <span className="shrink-0 text-[12px] font-medium tabular-nums text-zinc-200">
          {formatWholeNumber(row.pointsTotal)}
        </span>
      </div>
    </div>
  )
}

function RelayTrayPointsHistoryRow(props: { row: PointsActivityRow }) {
  const { row } = props
  const signedPoints =
    row.waitlistPoints > 0 ? `+${row.waitlistPoints}` : String(row.waitlistPoints)
  const showRawAward = row.amount !== row.waitlistPoints

  return (
    <div className="py-2.5">
      <div className="flex items-start justify-between gap-3">
        <span className="min-w-0 text-[12px] font-medium leading-snug text-zinc-100">{row.label}</span>
        <span
          className={`shrink-0 text-[12px] font-medium tabular-nums ${
            row.waitlistPoints >= 0 ? 'text-emerald-300/90' : 'text-red-300/90'
          }`}
        >
          {signedPoints}
        </span>
      </div>
      {showRawAward ? (
        <div className="mt-0.5 text-[10px] text-zinc-500">
          Ledger {row.amount > 0 ? `+${row.amount}` : row.amount} → {row.waitlistPoints} points counted
        </div>
      ) : null}
      {row.createdAt ? (
        <div className="mt-0.5 text-[10px] text-zinc-500">
          {formatPointsActivityWhen(Date.parse(row.createdAt))}
        </div>
      ) : null}
    </div>
  )
}

function formatPointsActivityWhen(timestampMs: number): string {
  const deltaMs = Date.now() - timestampMs
  if (!Number.isFinite(deltaMs) || deltaMs < 0) return 'Just now'
  const minutes = Math.floor(deltaMs / 60_000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 48) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 14) return `${days}d ago`
  return new Date(timestampMs).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function useIsPhoneViewport(): boolean {
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

function getSignedInSessionCopy({
  walletMatchesSession,
  sessionAddress,
  connectedAddress,
  embeddedAddress,
}: {
  walletMatchesSession: boolean
  sessionAddress: string | null
  connectedAddress: string | null
  embeddedAddress: string | null
}): string {
  if (walletMatchesSession) return 'Session ready for sponsored smart-wallet actions.'

  if (!sessionAddress) return '4626 session is active.'

  if (embeddedAddress && normalizeAddressKey(sessionAddress) === normalizeAddressKey(embeddedAddress)) {
    if (connectedAddress && normalizeAddressKey(sessionAddress) !== normalizeAddressKey(connectedAddress)) {
      return `Embedded signer ready; connected wallet is available as fallback.`
    }
    return `Embedded signer ready for your smart wallet.`
  }

  if (connectedAddress && normalizeAddressKey(sessionAddress) !== normalizeAddressKey(connectedAddress)) {
    return `Session signer: ${formatAddress(sessionAddress)}; connected wallet is fallback.`
  }

  return `Session signer: ${formatAddress(sessionAddress)}.`
}

function normalizeAddressKey(value: string | null | undefined): string {
  return (value ?? '').toLowerCase()
}
