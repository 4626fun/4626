import { useAccount, useConnect, useDisconnect } from 'wagmi'
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Wallet, ChevronDown } from 'lucide-react'
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
  type AccountTraySection,
  type AccountTrayTab,
} from '@/components/account/trayEvents'
import { detectEthereumProviderCollision } from '@/lib/wallet/providerCollision'
import { usePrivy } from '@privy-io/react-auth'
import { usePrivyClientStatus } from '@/lib/privy/client'
import { resolvePublicPointsDisplay } from '@/lib/waitlist/canonicalAccountScore'
import {
  fetchAccountTrayPoints,
  isAccountTrayPointsAuthError,
} from '@/lib/waitlist/accountTrayPoints'
import { apiFetch } from '@/lib/api/apiBase'
import { filterHiddenInjectedConnectors } from '@/lib/wallet/wagmiConnectorSelection'
import {
  CanonicalIdentityCard,
} from '@/components/account/CanonicalIdentityCard'
import {
  RelayTrayPointsModule,
  type TrayPointsOverview,
} from '@/components/account/relayAccountTrayPoints'
import { RelayTrayPortfolioModule } from '@/components/account/relayAccountTrayPortfolio'
import {
  RelayAccountTrayIdentityPanel,
  RelayAccountTrayShell,
  useIsPhoneViewport,
} from '@/components/account/relayAccountTrayShared'

export type { TrayPointsOverview } from '@/components/account/relayAccountTrayPoints'
export {
  RelayTrayPointsModule,
} from '@/components/account/relayAccountTrayPoints'
export {
  RelayTrayPrimaryTabs,
  useIsPhoneViewport,
} from '@/components/account/relayAccountTrayShared'
import {
  buildTrayAssetHoldings,
  collectTrayZoraTokenKeys,
  sumTrayAssetUsd,
  type TrayAssetHolding,
  type TrayWalletSource,
} from '@/components/account/trayPortfolioHelpers'
import { useAccountTrayPortfolio } from '@/components/account/useAccountTrayPortfolio'
import {
  fetchTrayZoraHoldingsForWallets,
  ZORA_HOLDINGS_MAX_TOP_TOKENS,
} from '@/lib/zora/walletHoldings'

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

const PRIVY_LAST_AUTH_HINT_KEY = 'cv:privy:lastAuthAt'

type WalletPreferredLoginInput = {
  lastAuthAtRaw: string | null | undefined
}

export function shouldPreferWalletLoginAfterEmail(input: WalletPreferredLoginInput): boolean {
  const raw = typeof input.lastAuthAtRaw === 'string' ? input.lastAuthAtRaw.trim() : ''
  if (!raw) return false
  const timestampMs = Number(raw)
  return Number.isFinite(timestampMs) && timestampMs > 0
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
  const [trayTab, setTrayTab] = useState<AccountTrayTab>('tokens')
  const [traySection, setTraySection] = useState<AccountTraySection>('identity')
  const privyStatus = usePrivyClientStatus()
  const prefersPrivyWalletLogin = privyStatus === 'ready'
  const shouldPreferWalletLogin = useMemo(() => {
    if (typeof window === 'undefined') return false
    try {
      const raw = localStorage.getItem(PRIVY_LAST_AUTH_HINT_KEY)
      return shouldPreferWalletLoginAfterEmail({ lastAuthAtRaw: raw })
    } catch {
      return false
    }
  }, [])
  const [showMenu, setShowMenu] = useState(false)
  const [showOptions, setShowOptions] = useState(false)
  const mountedRef = useRef(true)
  const optionsPanelClassName = 'absolute right-0 top-full mt-3 w-64 card p-3 z-50 space-y-1'
  const isPhoneViewport = useIsPhoneViewport()

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

  const defaultTraySection = 'identity' as const

  const trayWalletKey = useMemo(
    () => trayWalletSources.map((wallet) => wallet.address.toLowerCase()).sort().join(','),
    [trayWalletSources],
  )
  const zoraTokenWalletSources = useMemo<TrayWalletSource[]>(() => trayWalletSources, [trayWalletSources])
  void zoraTokenWalletSources
  const pinnedCreatorCoinAddress = canonicalIdentity.creatorCoinAddress
  const trayZoraHoldingsQuery = useQuery({
    queryKey: [
      'account-tray',
      'zora-holdings',
      trayWalletKey,
      pinnedCreatorCoinAddress?.toLowerCase() ?? '',
      ZORA_HOLDINGS_MAX_TOP_TOKENS,
    ],
    enabled: auth.hasSession && showMenu && trayWalletSources.length > 0,
    staleTime: 60_000,
    retry: 0,
    queryFn: async () =>
      fetchTrayZoraHoldingsForWallets(
        trayWalletSources.map((wallet) => wallet.address),
        {
          topTokenCount: ZORA_HOLDINGS_MAX_TOP_TOKENS,
          extraTokenAddresses: pinnedCreatorCoinAddress ? [pinnedCreatorCoinAddress] : null,
        },
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
  const trayZoraTokensSettled =
    trayZoraHoldingsQuery.isFetched && !trayZoraHoldingsQuery.isLoading && !trayZoraHoldingsQuery.isFetching
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
    setShowMenu((current) => {
      const next = !current
      if (next) {
        setTrayTab('tokens')
        setTraySection(defaultTraySection)
      }
      return next
    })
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
      const section = customEvent.detail?.section ?? 'identity'
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

  const closeSessionTray = useCallback(() => {
    setShowMenu(false)
  }, [])

  const renderSessionAccountTray = (options?: { banner?: ReactNode }) => (
    <RelayAccountTrayShell
      open={showMenu}
      onClose={closeSessionTray}
      onCloseComplete={closeMenuAfterTrayClose}
      section={traySection}
      onSectionChange={setTraySection}
      accessibilityLabel="Account menu"
      wallets={
        <RelayAccountTrayIdentityPanel
          banner={options?.banner}
          identityDropdown={{
            identity: canonicalIdentity,
            onRequestConnectWallet: () => {
              setShowMenu(false)
              setShowOptions(true)
            },
            onRequestDisconnectMainWallet: () => {
              void disconnectMainWallet()
            },
            disconnectingMainWallet,
          }}
        />
      }
      portfolio={
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
          zoraTokensSettled={trayZoraTokensSettled}
        />
      }
      points={
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
      }
      footer={{
        linkMode: 'router',
        accountsHref: '/accounts',
        settingsHref: '/accounts',
        onSignOut: () => {
          void auth.signOut()
          setShowMenu(false)
        },
        signOutBusy: auth.busy,
      }}
      error={auth.error}
    />
  )

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

        {auth.hasSession
          ? renderSessionAccountTray()
          : showMenu ? (
              <AccountTray
                pin={isPhoneViewport ? 'bottom' : 'right'}
                showHandleBar={isPhoneViewport}
                accessibilityLabel="Account menu"
                onCloseComplete={closeMenuAfterTrayClose}
                onRequestClose={() => setShowMenu(false)}
                closeAccessibilityLabel="Close account menu"
              >
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
                  <span className="app-meta-value text-zinc-400 block mt-1">No transaction.</span>
                </button>
                {auth.error ? <div className="px-4 text-[11px] text-red-400/90">{auth.error}</div> : null}
              </AccountTray>
            ) : null}
      </div>
    )
  }

  // Session restored, but no active wagmi connection.
  // This happens after cross-origin Privy handoff where the 4626
  // auth session exists but the client wallet provider is not yet
  // connected on this page load.
  if (buttonState === 'session-restored' && sessionAddress) {
    return (
      <div className="relative">
        <CanonicalIdentityCard
          identity={canonicalIdentity}
          menuOpen={showMenu}
          onToggle={toggleMenu}
          variant="nav"
          activeNetworkLabel={trayHoldings.activeNetworkLabel}
          activeNetworkUsd={trayHoldings.activeNetworkUsd}
        />

        {renderSessionAccountTray({
          banner: (
            <div className="rounded-lg border border-white/8 bg-black/20 px-3 py-2 text-[12px] text-zinc-400">
              Signed in. Connect your main wallet to finish setup.
            </div>
          ),
        })}

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
        const signed = await auth.signIn({
          method: 'privy',
          preferBaseAccountWallet: shouldPreferWalletLogin,
        })
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
                  <span className="label block">Continue with email</span>
                  <span className="app-meta-value text-zinc-500 block mt-1">Use email OTP for first-time account setup and recovery.</span>
                </button>
                {shouldPreferWalletLogin ? (
                  <button
                    type="button"
                    disabled={auth.busy}
                    className="w-full text-left py-3 px-4 hover:bg-white/4 transition-colors disabled:opacity-50"
                    onClick={() => {
                      setShowOptions(false)
                      void auth.signIn({ method: 'privy', preferBaseAccountWallet: true })
                    }}
                  >
                    <span className="label block">Continue with wallet</span>
                    <span className="app-meta-value text-zinc-500 block mt-1">Returning sign-in using your linked Base wallet.</span>
                  </button>
                ) : null}
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
