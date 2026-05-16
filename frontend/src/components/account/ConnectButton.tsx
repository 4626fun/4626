import { useAccount, useConnect, useDisconnect } from 'wagmi'
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Wallet, ChevronDown } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Tray } from '@coinbase/cds-web/overlays/tray/Tray'
import { useQuery } from '@tanstack/react-query'
import { useSiweAuth } from '@/hooks/useSiweAuth'
import { useIdentity } from '@/hooks/useIdentity'
import { useCanonicalIdentity } from '@/hooks/useCanonicalIdentity'
import { getAgentIdentity } from '@/components/chat/agentIdentity'
import { detectEthereumProviderCollision } from '@/lib/wallet/providerCollision'
import { usePrivyClientStatus } from '@/lib/privy/client'
import { fetchDebankTokenList, fetchDebankTotalBalanceBatch, type DebankToken } from '@/lib/debank/client'
import { apiFetch } from '@/lib/api/apiBase'
import { filterHiddenInjectedConnectors } from '@/lib/wallet/wagmiConnectorSelection'
import {
  CanonicalIdentityCard,
  CanonicalIdentityDropdown,
} from '@/components/account/CanonicalIdentityCard'

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

function isEvmAddress(value: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(value.trim())
}

async function mapWithLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const output: R[] = []
  let index = 0
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    while (index < items.length) {
      const current = index++
      output[current] = await fn(items[current]!)
    }
  })
  await Promise.all(workers)
  return output
}

type TrayWalletKind = 'canonical' | 'external'

type TrayWalletSource = {
  kind: TrayWalletKind
  address: string
  label: string
}

type TrayNetworkWalletBreakdown = {
  kind: TrayWalletKind
  label: string
  address: string
  usdValue: number
}

type TrayNetworkHolding = {
  networkId: string
  networkLabel: string
  networkLogoUrl: string | null
  usdTotal: number
  wallets: TrayNetworkWalletBreakdown[]
}

type TrayTokenHolding = {
  tokenAddress: string
  symbol: string
  name: string
  logoUrl: string | null
  amount: number
  usdValue: number
  walletCount: number
}

type TrayWalletTokenRow = {
  token: DebankToken
  wallet: TrayWalletSource
}

type TrayAssetHolding = {
  tokenAddress: string
  symbol: string
  name: string
  logoUrl: string | null
  amount: number
  usdValue: number
}

type WaitlistPositionSnapshot = {
  points: {
    total: number
    invite: number
    signup: number
    tasks: number
    csw: number
    social: number
    bonus: number
  }
  rank: {
    invite: number | null
    total: number | null
  }
  totalCount: number
}

async function fetchZoraCoinViaApi(address: string): Promise<unknown | null> {
  const qs = new URLSearchParams({
    address,
    chain: '8453',
  })
  const response = await apiFetch(`/api/zora/coin?${qs.toString()}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  })
  if (!response.ok) return null
  const json = (await response.json().catch(() => null)) as { data?: unknown } | null
  return json?.data ?? null
}

async function fetchWaitlistPositionByWallet(wallet: string): Promise<WaitlistPositionSnapshot | null> {
  const qs = new URLSearchParams({ wallet })
  const response = await apiFetch(`/api/waitlist/position?${qs.toString()}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  })
  if (!response.ok) return null
  const json = (await response.json().catch(() => null)) as { success?: boolean; data?: WaitlistPositionSnapshot | null } | null
  if (!json?.success) return null
  return json.data ?? null
}

function buildTrayHoldings(params: {
  wallets: TrayWalletSource[]
  debankResults: Record<string, { totalUsdValue: number; chains: Array<{ id: string; name?: string; logoUrl?: string; usdValue: number }> } | null> | null
}): {
  aggregateUsd: number
  activeNetworkLabel: string
  activeNetworkUsd: number | null
  rows: TrayNetworkHolding[]
} {
  const aggregateUsd = params.wallets.reduce((sum, wallet) => {
    const entry = params.debankResults?.[wallet.address.toLowerCase()]
    return sum + (entry?.totalUsdValue ?? 0)
  }, 0)

  const map = new Map<string, TrayNetworkHolding>()
  for (const wallet of params.wallets) {
    const entry = params.debankResults?.[wallet.address.toLowerCase()]
    if (!entry) continue
    for (const chain of entry.chains ?? []) {
      const networkId = String(chain.id || '').trim().toLowerCase()
      if (!networkId) continue
      const chainValue = Number(chain.usdValue ?? 0)
      if (!Number.isFinite(chainValue) || chainValue <= 0) continue
      const existing = map.get(networkId)
      if (existing) {
        existing.usdTotal += chainValue
        existing.wallets.push({
          kind: wallet.kind,
          label: wallet.label,
          address: wallet.address,
          usdValue: chainValue,
        })
        continue
      }
      map.set(networkId, {
        networkId,
        networkLabel: String(chain.name || chain.id || networkId),
        networkLogoUrl: chain.logoUrl ? String(chain.logoUrl) : null,
        usdTotal: chainValue,
        wallets: [{
          kind: wallet.kind,
          label: wallet.label,
          address: wallet.address,
          usdValue: chainValue,
        }],
      })
    }
  }

  const rows = Array.from(map.values()).sort((a, b) => b.usdTotal - a.usdTotal)
  const preferredBase = rows.find((row) => row.networkId === 'base')
  const active = preferredBase ?? rows[0] ?? null
  return {
    aggregateUsd,
    activeNetworkLabel: active?.networkLabel ?? 'Base',
    activeNetworkUsd: active?.usdTotal ?? null,
    rows,
  }
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
  const canonicalIdentity = useCanonicalIdentity()
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
          paddingTop: 'var(--space-2)',
          paddingBottom: 'var(--space-3)',
        },
      }
    }
    return {
      container: {
        top: 'var(--space-4)',
        right: 'var(--space-2)',
        bottom: 'var(--space-2)',
        width: '26rem',
        maxWidth: 'calc(100vw - 1.5rem)',
        borderRadius: 'var(--borderRadius-600)',
      },
      header: {
        minHeight: '0px',
      },
      content: {
        paddingTop: 'var(--space-2)',
        paddingBottom: 'var(--space-3)',
      },
    }
  }, [isPhoneViewport])

  const providerCollision = useMemo(() => detectEthereumProviderCollision(), [])
  const { hasMultipleInjectedProviders, lockedEthereumProviderGlobal } = providerCollision
  const shouldHideInjectedConnector = providerCollision.shouldDisableInjectedConnector
  const trayWalletSources = useMemo<TrayWalletSource[]>(() => {
    const out: TrayWalletSource[] = []
    if (canonicalIdentity.cswAddress) {
      out.push({
        kind: 'canonical',
        address: canonicalIdentity.cswAddress,
        label: '4626 CSW',
      })
    }
    if (canonicalIdentity.externalEoaAddress) {
      out.push({
        kind: 'external',
        address: canonicalIdentity.externalEoaAddress,
        label: 'External EOA',
      })
    }
    return out
  }, [canonicalIdentity.cswAddress, canonicalIdentity.externalEoaAddress])
  const trayWalletKey = useMemo(
    () => trayWalletSources.map((wallet) => wallet.address.toLowerCase()).sort().join(','),
    [trayWalletSources],
  )
  const zoraTokenWalletSources = useMemo<TrayWalletSource[]>(() => trayWalletSources, [trayWalletSources])
  const zoraTokenWalletKey = useMemo(
    () => zoraTokenWalletSources.map((wallet) => wallet.address.toLowerCase()).sort().join(','),
    [zoraTokenWalletSources],
  )
  const trayBalancesQuery = useQuery({
    queryKey: ['account-tray', 'debank-total-balance', trayWalletKey],
    enabled: auth.hasSession && trayWalletSources.length > 0,
    staleTime: 60_000,
    retry: 0,
    queryFn: async () => {
      const result = await fetchDebankTotalBalanceBatch({
        addresses: trayWalletSources.map((wallet) => wallet.address),
      })
      return result?.results ?? null
    },
  })
  const trayHoldings = useMemo(
    () =>
      buildTrayHoldings({
        wallets: trayWalletSources,
        debankResults: trayBalancesQuery.data ?? null,
      }),
    [trayBalancesQuery.data, trayWalletSources],
  )
  const trayTokenRowsQuery = useQuery({
    queryKey: ['account-tray', 'debank-token-rows', zoraTokenWalletKey],
    enabled: auth.hasSession && zoraTokenWalletSources.length > 0,
    staleTime: 60_000,
    retry: 0,
    queryFn: async () => {
      const lists = await mapWithLimit(zoraTokenWalletSources, 2, async (wallet) => {
        const list = await fetchDebankTokenList({ address: wallet.address, chainId: 'base' })
        return {
          wallet,
          tokens: list?.tokens ?? [],
        }
      })
      return lists.flatMap((entry) =>
        entry.tokens.map((token) => ({
          token,
          wallet: entry.wallet,
        })),
      )
    },
  })
  const trayBaseTokens = useMemo<TrayAssetHolding[]>(() => {
    const rows = (trayTokenRowsQuery.data ?? []) as TrayWalletTokenRow[]
    const grouped = new Map<string, TrayAssetHolding>()
    for (const row of rows) {
      const token = row.token
      const tokenAddress = String(token.id || '').toLowerCase()
      if (!isEvmAddress(tokenAddress)) continue
      const amount = Number(token.amount ?? 0)
      const usdValue = Number(token.usdValue ?? 0)
      const existing = grouped.get(tokenAddress)
      if (existing) {
        existing.amount += Number.isFinite(amount) ? amount : 0
        existing.usdValue += Number.isFinite(usdValue) ? usdValue : 0
        continue
      }
      grouped.set(tokenAddress, {
        tokenAddress,
        symbol: String(token.symbol || '').trim() || formatAddress(tokenAddress),
        name: String(token.name || '').trim() || String(token.symbol || '').trim() || tokenAddress,
        logoUrl: token.logoUrl ? String(token.logoUrl) : null,
        amount: Number.isFinite(amount) ? amount : 0,
        usdValue: Number.isFinite(usdValue) ? usdValue : 0,
      })
    }
    return Array.from(grouped.values()).sort((a, b) => b.usdValue - a.usdValue)
  }, [trayTokenRowsQuery.data])
  const trayTokenAddressesKey = useMemo(() => {
    const addresses = (trayTokenRowsQuery.data ?? [])
      .map((row) => String(row.token.id || '').toLowerCase())
      .filter((value) => isEvmAddress(value))
      .sort()
    return Array.from(new Set(addresses)).join(',')
  }, [trayTokenRowsQuery.data])
  const trayZoraTokensQuery = useQuery({
    queryKey: ['account-tray', 'zora-token-map', trayTokenAddressesKey],
    enabled: auth.hasSession && trayTokenAddressesKey.length > 0,
    staleTime: 60_000,
    retry: 0,
    queryFn: async () => {
      const unique = trayTokenAddressesKey.split(',').filter(Boolean)
      const pairs = await mapWithLimit(unique, 6, async (addressLc) => {
        try {
          const coin = await fetchZoraCoinViaApi(addressLc)
          return [addressLc, coin] as const
        } catch {
          return [addressLc, null] as const
        }
      })
      const out: Record<string, unknown | null> = {}
      for (const [addressLc, coin] of pairs) {
        out[addressLc] = coin
      }
      return out
    },
  })
  const trayZoraTokens = useMemo<TrayTokenHolding[]>(() => {
    const rows = trayTokenRowsQuery.data ?? []
    const zoraMap = trayZoraTokensQuery.data ?? {}
    const grouped = new Map<string, TrayTokenHolding>()
    for (const row of rows) {
      const token = row.token as DebankToken
      const tokenAddress = String(token.id || '').toLowerCase()
      if (!isEvmAddress(tokenAddress)) continue
      if (!zoraMap[tokenAddress]) continue
      const amount = Number(token.amount ?? 0)
      const usdValue = Number(token.usdValue ?? 0)
      const existing = grouped.get(tokenAddress)
      if (existing) {
        existing.amount += Number.isFinite(amount) ? amount : 0
        existing.usdValue += Number.isFinite(usdValue) ? usdValue : 0
        existing.walletCount += 1
        continue
      }
      grouped.set(tokenAddress, {
        tokenAddress,
        symbol: String(token.symbol || '').trim() || formatAddress(tokenAddress),
        name: String(token.name || '').trim() || String(token.symbol || '').trim() || tokenAddress,
        logoUrl: token.logoUrl ? String(token.logoUrl) : null,
        amount: Number.isFinite(amount) ? amount : 0,
        usdValue: Number.isFinite(usdValue) ? usdValue : 0,
        walletCount: 1,
      })
    }
    return Array.from(grouped.values()).sort((a, b) => b.usdValue - a.usdValue)
  }, [trayTokenRowsQuery.data, trayZoraTokensQuery.data])
  const trayZoraTokensLoading = trayTokenRowsQuery.isLoading || trayZoraTokensQuery.isLoading
  const sessionAddress = auth.authAddress ?? null
  const trayPointsLookupWallet = useMemo(() => {
    const candidate =
      canonicalIdentity.cswAddress ??
      canonicalIdentity.externalEoaAddress ??
      canonicalIdentity.privyEmbeddedAddress ??
      sessionAddress ??
      address ??
      null
    return typeof candidate === 'string' && isEvmAddress(candidate) ? candidate : null
  }, [
    address,
    canonicalIdentity.cswAddress,
    canonicalIdentity.externalEoaAddress,
    canonicalIdentity.privyEmbeddedAddress,
    sessionAddress,
  ])
  const trayPointsQuery = useQuery({
    queryKey: ['account-tray', 'waitlist-position', trayPointsLookupWallet],
    enabled: auth.hasSession && Boolean(trayPointsLookupWallet),
    staleTime: 15_000,
    retry: 0,
    queryFn: async () => fetchWaitlistPositionByWallet(trayPointsLookupWallet as string),
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
  const sharedIdentity = useIdentity(shouldResolveIdentity ? identityAddress : null)
  const basename = shouldResolveIdentity ? sharedIdentity.basename : null
  const basenameAvatar = shouldResolveIdentity ? sharedIdentity.basenameAvatar : null
  const sharedAgentIdentity = shouldResolveIdentity ? getAgentIdentity(identityAddress) : null
  const unifiedAvatar = sharedAgentIdentity?.avatar ?? sharedIdentity.avatar ?? basenameAvatar
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
    return (
      <button
        type="button"
        disabled
        className={
          variant === 'nav'
            ? 'inline-flex h-9 w-[164px] items-center justify-center gap-2 rounded-full bg-white/8 px-3 text-[11px] font-medium text-zinc-200 transition disabled:opacity-50'
            : 'btn-accent btn-no-icon disabled:opacity-50 flex min-w-[152px] items-center justify-center gap-2'
        }
      >
        <Wallet className="w-4 h-4" />
        <span className={variant === 'nav' ? 'tracking-[0.01em]' : 'label'}>Checking session…</span>
      </button>
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
          <Tray
            pin={trayPin}
            showHandleBar={isPhoneViewport}
            title=""
            accessibilityLabel="Account menu"
            onCloseComplete={closeMenuAfterTrayClose}
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
                      disconnect()
                      setShowMenu(false)
                    }}
                  />
                  <div className="h-px bg-white/8 my-2" />
                </>
              ) : null}
              {auth.hasSession && traySection === 'portfolio' ? (
                <RelayTrayPortfolioModule
                  tab={trayTab}
                  onTabChange={setTrayTab}
                  aggregateUsd={trayHoldings.aggregateUsd}
                  activeNetworkLabel={trayHoldings.activeNetworkLabel}
                  rows={trayHoldings.rows}
                  loading={trayBalancesQuery.isLoading}
                  baseTokens={trayBaseTokens}
                  baseTokensLoading={trayTokenRowsQuery.isLoading}
                  zoraTokens={trayZoraTokens}
                  zoraTokensLoading={trayZoraTokensLoading}
                />
              ) : null}
              {auth.hasSession && traySection === 'points' ? (
                <RelayTrayPointsModule
                  points={trayPointsQuery.data ?? null}
                  loading={trayPointsQuery.isLoading}
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
                    to="/portfolio"
                    onClick={() => setShowMenu(false)}
                    className="block w-full py-3 px-4 hover:bg-white/4 transition-colors"
                  >
                    <span className="label block text-zinc-300">Profile</span>
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
          </Tray>
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
          <Tray
            pin={trayPin}
            showHandleBar={isPhoneViewport}
            title=""
            accessibilityLabel="Account menu"
            onCloseComplete={closeMenuAfterTrayClose}
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
                          disconnect()
                          setShowMenu(false)
                        }}
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
                  aggregateUsd={trayHoldings.aggregateUsd}
                  activeNetworkLabel={trayHoldings.activeNetworkLabel}
                  rows={trayHoldings.rows}
                  loading={trayBalancesQuery.isLoading}
                  baseTokens={trayBaseTokens}
                  baseTokensLoading={trayTokenRowsQuery.isLoading}
                  zoraTokens={trayZoraTokens}
                  zoraTokensLoading={trayZoraTokensLoading}
                />
              ) : (
                <RelayTrayPointsModule
                  points={trayPointsQuery.data ?? null}
                  loading={trayPointsQuery.isLoading}
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
                  to="/portfolio"
                  onClick={() => setShowMenu(false)}
                  className="block w-full py-3 px-4 hover:bg-white/4 transition-colors"
                >
                  <span className="label block text-zinc-300">Profile</span>
                </Link>
                <Link
                  to="/accounts"
                  onClick={() => setShowMenu(false)}
                  className="block w-full py-3 px-4 hover:bg-white/4 transition-colors"
                >
                  <span className="label block text-zinc-300">Settings</span>
                </Link>
              </div>
          </Tray>
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
  return (
    <div className="relative">
        <button
          type="button"
        disabled={auth.busy}
        onClick={() => {
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
        }}
        className={
          variant === 'nav'
            ? 'inline-flex h-9 w-[164px] items-center justify-center gap-2 rounded-full bg-white/8 px-3 text-[11px] font-medium text-zinc-100 transition-all duration-200 hover:bg-white/12 disabled:opacity-50'
            : 'btn-accent btn-no-icon disabled:opacity-50 flex min-w-[136px] items-center justify-center gap-2'
        }
        >
        <Wallet className="w-4 h-4" />
        <span className={variant === 'nav' ? 'tracking-[0.01em]' : 'label'}>
          {auth.busy ? 'Signing in…' : 'Sign in'}
        </span>
      </button>
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
  baseTokens: TrayAssetHolding[]
  baseTokensLoading: boolean
  zoraTokens: TrayTokenHolding[]
  zoraTokensLoading: boolean
}) {
  const [expandedNetworkId, setExpandedNetworkId] = useState<string | null>(null)
  const topRows = props.rows.slice(0, 6)
  const activityRows = props.rows.slice(0, 4)
  const topBaseTokens = props.baseTokens.slice(0, 6)

  return (
    <div className="px-4 pt-2 pb-3">
      <div className="rounded-xl bg-white/[0.02] p-3">
        <div className="text-[30px] font-semibold leading-none tracking-tight text-white tabular-nums">
          {formatUsdValue(props.aggregateUsd)}
        </div>
        <div className="mt-1 text-[10px] text-zinc-500 truncate">{props.activeNetworkLabel}</div>

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
          <div className="mt-2 space-y-1">
            {props.loading ? (
              <div className="rounded-lg border border-white/8 bg-black/20 px-3 py-2 text-[11px] text-zinc-500">
                Loading balances…
              </div>
            ) : topRows.length === 0 ? (
              <div className="rounded-lg border border-white/8 bg-black/20 px-3 py-2 text-[11px] text-zinc-500">
                No balances found yet.
              </div>
            ) : (
              topRows.map((row) => {
                const expanded = expandedNetworkId === row.networkId
                return (
                  <div key={row.networkId} className="rounded-lg border border-white/8 bg-black/20">
                    <button
                      type="button"
                      onClick={() => setExpandedNetworkId(expanded ? null : row.networkId)}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left"
                    >
                      {row.networkLogoUrl ? (
                        <img src={row.networkLogoUrl} alt="" className="h-5 w-5 shrink-0 rounded-full border border-white/10" />
                      ) : (
                        <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04]">
                          <span className="h-2.5 w-2.5 rounded-sm bg-[rgb(var(--brand-primary))]" />
                        </span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[12px] text-white">{row.networkLabel}</span>
                        <span className="block text-[10px] text-zinc-500">
                          {row.wallets.length} wallet lane{row.wallets.length > 1 ? 's' : ''}
                        </span>
                      </span>
                      <span className="text-[12px] font-medium tabular-nums text-zinc-100">{formatUsdValue(row.usdTotal)}</span>
                      <ChevronDown className={`h-3.5 w-3.5 text-zinc-500 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                    </button>
                    {expanded ? (
                      <div className="space-y-1 border-t border-white/8 px-3 py-2">
                        {row.wallets
                          .sort((a, b) => b.usdValue - a.usdValue)
                          .map((wallet) => (
                            <div key={`${row.networkId}:${wallet.kind}:${wallet.address}`} className="flex items-center justify-between gap-2">
                              <span className="min-w-0">
                                <span className="block truncate text-[11px] text-zinc-300">{wallet.label}</span>
                                <span className="block text-[10px] text-zinc-600">{formatAddress(wallet.address)}</span>
                              </span>
                              <span className="text-[11px] tabular-nums text-zinc-300">{formatUsdValue(wallet.usdValue)}</span>
                            </div>
                          ))}
                        {row.networkId === 'base' ? (
                          <div className="mt-2 border-t border-white/8 pt-2">
                            <div className="px-0.5 pb-1 text-[10px] uppercase tracking-[0.12em] text-zinc-500">
                              Asset breakdown
                            </div>
                            {props.baseTokensLoading ? (
                              <div className="rounded-lg border border-white/8 bg-black/20 px-2.5 py-1.5 text-[10px] text-zinc-500">
                                Loading assets…
                              </div>
                            ) : topBaseTokens.length === 0 ? (
                              <div className="rounded-lg border border-white/8 bg-black/20 px-2.5 py-1.5 text-[10px] text-zinc-500">
                                No Base token assets found.
                              </div>
                            ) : (
                              <div className="space-y-1">
                                {topBaseTokens.map((token) => (
                                  <div
                                    key={`base-asset:${token.tokenAddress}`}
                                    className="flex items-center justify-between gap-2 rounded-lg border border-white/8 bg-black/20 px-2.5 py-1.5"
                                  >
                                    <span className="min-w-0">
                                      <span className="block truncate text-[10px] text-zinc-200">{token.symbol}</span>
                                      <span className="block truncate text-[10px] text-zinc-600">
                                        {formatTokenAmount(token.amount)}
                                      </span>
                                    </span>
                                    <span className="text-[10px] tabular-nums text-zinc-300">{formatUsdValue(token.usdValue)}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                )
              })
            )}
            <div className="mt-3 border-t border-white/8 pt-2">
              <div className="px-1 pb-1 text-[10px] uppercase tracking-[0.12em] text-zinc-500">Zora tokens</div>
              {props.zoraTokensLoading ? (
                <div className="rounded-lg border border-white/8 bg-black/20 px-3 py-2 text-[11px] text-zinc-500">
                  Loading Zora token balances…
                </div>
              ) : props.zoraTokens.length === 0 ? (
                <div className="rounded-lg border border-white/8 bg-black/20 px-3 py-2 text-[11px] text-zinc-500">
                  No Zora-tagged token holdings found on Base.
                </div>
              ) : (
                <div className="max-h-56 space-y-1 overflow-y-auto pr-1">
                  {props.zoraTokens.map((token) => (
                    <div
                      key={`zora:${token.tokenAddress}`}
                      className="flex items-center gap-2 rounded-lg border border-white/8 bg-black/20 px-3 py-2"
                    >
                      {token.logoUrl ? (
                        <img src={token.logoUrl} alt="" className="h-5 w-5 shrink-0 rounded-full border border-white/10" />
                      ) : (
                        <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04]">
                          <span className="h-2.5 w-2.5 rounded-sm bg-[rgb(var(--brand-primary))]" />
                        </span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[12px] text-white">{token.symbol}</span>
                        <span className="block truncate text-[10px] text-zinc-600">
                          {formatTokenAmount(token.amount)} · {token.walletCount} wallet lane{token.walletCount > 1 ? 's' : ''}
                        </span>
                      </span>
                      <span className="text-[12px] tabular-nums text-zinc-300">{formatUsdValue(token.usdValue)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="mt-2 space-y-1">
            {activityRows.length === 0 && topBaseTokens.length === 0 ? (
              <div className="rounded-lg border border-white/8 bg-black/20 px-3 py-2 text-[11px] text-zinc-500">
                No recent portfolio activity yet.
              </div>
            ) : (
              <>
                {activityRows.map((row) => (
                  <div key={`activity:${row.networkId}`} className="flex items-center justify-between rounded-lg border border-white/8 bg-black/20 px-3 py-2">
                    <span className="min-w-0">
                      <span className="block truncate text-[12px] text-zinc-200">{row.networkLabel}</span>
                      <span className="block text-[10px] text-zinc-600">Network exposure</span>
                    </span>
                    <span className="text-[12px] tabular-nums text-zinc-300">{formatUsdValue(row.usdTotal)}</span>
                  </div>
                ))}
                {topBaseTokens.slice(0, 3).map((token) => (
                  <div
                    key={`activity-token:${token.tokenAddress}`}
                    className="flex items-center justify-between rounded-lg border border-white/8 bg-black/20 px-3 py-2"
                  >
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
    </div>
  )
}

function RelayTrayPointsModule(props: {
  points: WaitlistPositionSnapshot | null
  loading: boolean
}) {
  const total = props.points?.points.total ?? 0
  const totalRank = props.points?.rank.total ?? null
  const inviteRank = props.points?.rank.invite ?? null
  const totalCount = props.points?.totalCount ?? 0
  const breakdown = [
    { label: 'Invites', value: props.points?.points.invite ?? 0 },
    { label: 'Signup', value: props.points?.points.signup ?? 0 },
    { label: 'Tasks', value: props.points?.points.tasks ?? 0 },
    { label: 'CSW', value: props.points?.points.csw ?? 0 },
    { label: 'Social', value: props.points?.points.social ?? 0 },
    { label: 'Bonus', value: props.points?.points.bonus ?? 0 },
  ]

  return (
    <div className="px-4 pt-2 pb-3">
      <div className="rounded-xl bg-white/[0.02] p-3">
        <div className="text-[10px] uppercase tracking-[0.12em] text-zinc-500">Points</div>
        {props.loading ? (
          <div className="mt-2 rounded-lg border border-white/8 bg-black/20 px-3 py-2 text-[11px] text-zinc-500">
            Loading points…
          </div>
        ) : !props.points ? (
          <div className="mt-2 rounded-lg border border-white/8 bg-black/20 px-3 py-2 text-[11px] text-zinc-500">
            No points profile found yet.
          </div>
        ) : (
          <>
            <div className="mt-2 text-[30px] font-semibold leading-none tracking-tight text-white tabular-nums">
              {total.toLocaleString()}
            </div>
            <div className="mt-1 text-[10px] text-zinc-500">AMOE eligible points</div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-lg border border-white/8 bg-black/20 px-3 py-2">
                <div className="text-[10px] text-zinc-500">Total rank</div>
                <div className="text-[13px] text-zinc-200 tabular-nums">
                  {totalRank ? `#${totalRank.toLocaleString()}` : '—'}
                </div>
              </div>
              <div className="rounded-lg border border-white/8 bg-black/20 px-3 py-2">
                <div className="text-[10px] text-zinc-500">Invite rank</div>
                <div className="text-[13px] text-zinc-200 tabular-nums">
                  {inviteRank ? `#${inviteRank.toLocaleString()}` : '—'}
                </div>
              </div>
            </div>

            <div className="mt-2 text-[10px] text-zinc-500">
              Leaderboard pool: {Math.max(0, totalCount).toLocaleString()} profiles
            </div>

            <div className="mt-3 border-t border-white/8 pt-2">
              <div className="px-1 pb-1 text-[10px] uppercase tracking-[0.12em] text-zinc-500">Breakdown</div>
              <div className="space-y-1">
                {breakdown.map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center justify-between rounded-lg border border-white/8 bg-black/20 px-3 py-2"
                  >
                    <span className="text-[11px] text-zinc-300">{item.label}</span>
                    <span className="text-[11px] tabular-nums text-zinc-200">{item.value.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
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
