import { useAccount, useConnect, useDisconnect } from 'wagmi'
import { type ReactNode, useEffect, useMemo, useState } from 'react'
import { Wallet, ChevronDown } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Tray } from '@coinbase/cds-web/overlays/tray/Tray'
import { useSiweAuth } from '@/hooks/useSiweAuth'
import { useIdentity } from '@/hooks/useIdentity'
import { useCanonicalIdentity } from '@/hooks/useCanonicalIdentity'
import { getAgentIdentity } from '@/components/chat/agentIdentity'
import { detectEthereumProviderCollision } from '@/lib/wallet/providerCollision'
import { usePrivyClientStatus } from '@/lib/privy/client'
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

function ExternalWalletOptions(props: {
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
          Multiple wallet extensions detected. Use Coinbase Wallet.
        </div>
      ) : props.lockedEthereumProviderGlobal ? (
        <div className="px-4 py-2 app-meta-value text-zinc-500">
          Wallet extension collision detected (`window.ethereum` is locked). Use Coinbase Wallet.
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
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[linear-gradient(135deg,rgba(0,82,255,0.95),rgba(90,138,255,0.7))] text-[11px] font-semibold text-white ring-1 ring-white/12">
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
  const privyStatus = usePrivyClientStatus()
  const prefersPrivyWalletLogin = privyStatus === 'ready'
  const [showMenu, setShowMenu] = useState(false)
  const [showOptions, setShowOptions] = useState(false)
  const optionsPanelClassName = 'absolute right-0 top-full mt-3 w-64 card p-3 z-50 space-y-1'
  const isPhoneViewport = useIsPhoneViewport()
  const trayPin = isPhoneViewport ? 'bottom' : 'right'
  const trayStyles = useMemo(() => {
    if (isPhoneViewport) {
      return {
        content: {
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
      content: {
        paddingBottom: 'var(--space-3)',
      },
    }
  }, [isPhoneViewport])

  const providerCollision = useMemo(() => detectEthereumProviderCollision(), [])
  const { hasMultipleInjectedProviders, lockedEthereumProviderGlobal } = providerCollision
  const shouldHideInjectedConnector = providerCollision.shouldDisableInjectedConnector
  const sessionAddress = auth.authAddress ?? null
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
  }
  const toggleOptions = () => {
    setShowMenu(false)
    setShowOptions((current) => !current)
  }

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
          />
        ) : (
          <IdentityButton presentation={presentation} connected menuOpen={showMenu} onToggle={toggleMenu} />
        )}

        {showMenu && (
          <Tray
            pin={trayPin}
            showHandleBar={isPhoneViewport}
            title="Account"
            accessibilityLabel="Account menu"
            onCloseComplete={() => setShowMenu(false)}
            styles={trayStyles}
            closeAccessibilityLabel="Close account menu"
          >
              {showCanonicalCard ? (
                <>
                  <CanonicalIdentityDropdown
                    identity={canonicalIdentity}
                    onRequestConnectWallet={() => {
                      setShowMenu(false)
                      setShowOptions(true)
                    }}
                  />
                  <div className="h-px bg-white/8 my-2" />
                </>
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
              ) : (
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
              )}
              {auth.hasSession ? (
                <Link
                  to="/accounts"
                  onClick={() => setShowMenu(false)}
                  className="block w-full py-3 px-4 hover:bg-white/4 transition-colors"
                >
                  <span className="label block text-zinc-300">Account settings</span>
                </Link>
              ) : null}
              {auth.hasSession ? (
                <button
                  type="button"
                  onClick={() => {
                    void auth.signOut()
                    setShowMenu(false)
                  }}
                  disabled={auth.busy}
                  className="w-full text-left py-3 px-4 hover:bg-white/4 transition-colors disabled:opacity-60"
                >
                  <span className="label block text-zinc-300">{auth.busy ? 'Signing out…' : 'Sign out'}</span>
                </button>
              ) : null}
              {auth.error ? <div className="px-4 text-[11px] text-red-400/90">{auth.error}</div> : null}
              <div className="h-px bg-white/8 my-2" />
              <button
                onClick={() => {
                  disconnect()
                  setShowMenu(false)
                }}
                className="w-full text-left py-3 px-4 hover:bg-white/4 transition-colors"
              >
                <span className="label block text-zinc-600">Disconnect</span>
              </button>
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
          />
        ) : (
          <IdentityButton presentation={presentation} connected={false} menuOpen={showMenu} onToggle={toggleMenu} />
        )}

        {showMenu && (
          <Tray
            pin={trayPin}
            showHandleBar={isPhoneViewport}
            title="Account"
            accessibilityLabel="Account menu"
            onCloseComplete={() => setShowMenu(false)}
            styles={trayStyles}
            closeAccessibilityLabel="Close account menu"
          >
              {showCanonicalCard ? (
                <>
                  <CanonicalIdentityDropdown
                    identity={canonicalIdentity}
                    onRequestConnectWallet={() => {
                      setShowMenu(false)
                      setShowOptions(true)
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
              <Link
                to="/accounts"
                onClick={() => setShowMenu(false)}
                className="block w-full py-3 px-4 hover:bg-white/4 transition-colors"
              >
                <span className="label block text-zinc-300">Account settings</span>
              </Link>
              <button
                type="button"
                onClick={() => {
                  setShowMenu(false)
                  setShowOptions(true)
                }}
                className="w-full text-left py-3 px-4 hover:bg-white/4 transition-colors"
              >
                <span className="label block text-zinc-300">Connect wallet</span>
                <span className="app-meta-value text-zinc-600 block mt-1">Optional local wallet connection</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  void auth.signOut()
                  setShowMenu(false)
                }}
                disabled={auth.busy}
                className="w-full text-left py-3 px-4 hover:bg-white/4 transition-colors disabled:opacity-60"
              >
                <span className="label block text-zinc-300">{auth.busy ? 'Signing out…' : 'Sign out'}</span>
              </button>
              {auth.error ? <div className="px-4 text-[11px] text-red-400/90">{auth.error}</div> : null}
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
