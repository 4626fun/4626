import { useAccount, useConnect, useDisconnect } from 'wagmi'
import { useMemo, useState } from 'react'
import { Wallet, ChevronDown } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useSiweAuth } from '@/hooks/useSiweAuth'
import { useIdentity } from '@/hooks/useIdentity'
import { getAgentIdentity } from '@/components/chat/agentIdentity'
import { detectEthereumProviderCollision } from '@/lib/wallet/providerCollision'
import { usePrivyClientStatus } from '@/lib/privy/client'

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

type ExternalWalletButtonsInput = {
  filteredConnectorCount: number
}

export function shouldAllowExternalWalletButtons(input: ExternalWalletButtonsInput): boolean {
  // Collision states can still safely offer external wallets as long as
  // injected connectors were filtered out first (e.g. keep Coinbase visible).
  return input.filteredConnectorCount > 0
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
      className="group relative flex min-w-[196px] items-center gap-3 overflow-hidden rounded-2xl border border-white/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.14),rgba(255,255,255,0.06))] px-3 py-2.5 shadow-[0_14px_40px_-18px_rgba(0,0,0,0.9)] backdrop-blur-xl transition hover:border-white/18 hover:bg-[linear-gradient(180deg,rgba(255,255,255,0.18),rgba(255,255,255,0.08))]"
    >
      <div className="relative shrink-0">
        {presentation.avatarUrl ? (
          <img
            src={presentation.avatarUrl}
            alt=""
            className="h-9 w-9 rounded-full object-cover ring-1 ring-white/12"
          />
        ) : (
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[linear-gradient(135deg,rgba(0,82,255,0.95),rgba(90,138,255,0.7))] text-sm font-semibold text-white ring-1 ring-white/12">
            {presentation.avatarFallback}
          </div>
        )}
        <span
          className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[rgb(8,8,8)] ${connected ? 'bg-cyan-400' : 'bg-emerald-400'}`}
          aria-hidden="true"
        />
      </div>
      <span className="min-w-0 flex-1 text-left">
        <span className="block truncate text-sm font-medium text-white">{presentation.primaryLabel}</span>
        <span className="block truncate text-[11px] text-zinc-400">{presentation.secondaryLabel}</span>
      </span>
      <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-zinc-500 transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
    </button>
  )
}

/**
 * Simple Connect Button
 * 
 * Shows available connectors and handles connection.
 */
export function ConnectButtonWeb3() {
  const { address, isConnected } = useAccount()
  const { connect, connectors, isPending } = useConnect()
  const { disconnect } = useDisconnect()
  const auth = useSiweAuth()
  const privyStatus = usePrivyClientStatus()
  const prefersPrivyWalletLogin = privyStatus === 'ready'
  const [showMenu, setShowMenu] = useState(false)
  const [showOptions, setShowOptions] = useState(false)

  const providerCollision = useMemo(() => detectEthereumProviderCollision(), [])
  const { hasMultipleInjectedProviders, lockedEthereumProviderGlobal } = providerCollision
  const shouldHideInjectedConnector = providerCollision.shouldDisableInjectedConnector

  const filteredConnectors = useMemo(() => {
    if (!shouldHideInjectedConnector) return connectors
    return connectors.filter((connector) => {
      const id = String((connector as any)?.id ?? '').toLowerCase()
      return !id.includes('injected')
    })
  }, [connectors, shouldHideInjectedConnector])
  const allowExternalWalletButtons = shouldAllowExternalWalletButtons({
    filteredConnectorCount: filteredConnectors.length,
  })
  const sessionAddress = auth.authAddress ?? null
  const buttonState = deriveConnectButtonState({
    sessionHydrated: auth.sessionHydrated,
    isConnected,
    connectedAddress: address,
    sessionAddress,
  })

  const identityAddress = buttonState === 'connected-wallet' ? address ?? null : buttonState === 'session-restored' ? sessionAddress : null
  const shouldResolveIdentity = Boolean(identityAddress)
  const sharedIdentity = useIdentity(shouldResolveIdentity ? identityAddress : null)
  const basename = shouldResolveIdentity ? sharedIdentity.basename : null
  const basenameAvatar = shouldResolveIdentity ? sharedIdentity.basenameAvatar : null
  const sharedAgentIdentity = getAgentIdentity(identityAddress)
  const unifiedAvatar = sharedAgentIdentity?.avatar ?? sharedIdentity.avatar ?? basenameAvatar

  if (buttonState === 'hydrating') {
    return (
      <button
        type="button"
        disabled
        className="btn-accent btn-no-icon disabled:opacity-50 flex min-w-[152px] items-center justify-center gap-2"
      >
        <Wallet className="w-4 h-4" />
        <span className="label">Checking session…</span>
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

    return (
      <div className="relative">
        <IdentityButton presentation={presentation} connected menuOpen={showMenu} onToggle={() => setShowMenu(!showMenu)} />

        {showMenu && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setShowMenu(false)}
            />
            <div className="absolute right-0 top-full mt-4 w-56 card p-4 z-50 space-y-2">
              <a
                href={`https://basescan.org/address/${address}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full py-3 px-4 hover:bg-white/4 transition-colors"
              >
                <span className="label block">View on Basescan</span>
              </a>
              <div className="h-px bg-white/8 my-2" />
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
                  <span className="text-[11px] text-zinc-600 block mt-1">No transaction.</span>
                </button>
              ) : (
                <div className="px-4 py-3">
                  <div className="label text-emerald-200">Signed in</div>
                  <div className="text-[11px] text-zinc-600 mt-1">
                    {auth.walletMatchesSession
                      ? 'Session matches connected wallet.'
                      : `4626 session is active as ${formatAddress(sessionAddress ?? address)}.`}
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
            </div>
          </>
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

    return (
      <div className="relative">
        <IdentityButton presentation={presentation} connected={false} menuOpen={showMenu} onToggle={() => setShowMenu(!showMenu)} />

        {showMenu && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setShowMenu(false)}
            />
            <div className="absolute right-0 top-full mt-4 w-56 card p-4 z-50 space-y-2">
              <div className="px-4 py-3">
                <div className="label text-emerald-200">Signed in</div>
                <div className="text-[11px] text-zinc-600 mt-1">4626 session is active.</div>
              </div>
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
                <span className="text-[11px] text-zinc-600 block mt-1">Optional local wallet connection</span>
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
            </div>
          </>
        )}

        {showOptions && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setShowOptions(false)}
            />
            <div className="absolute right-0 top-full mt-3 w-64 card p-3 z-50 space-y-1">
              {hasMultipleInjectedProviders ? (
                <div className="px-4 py-2 text-[11px] text-zinc-500">
                  Multiple wallet extensions detected. Use Coinbase Wallet.
                </div>
              ) : lockedEthereumProviderGlobal ? (
                <div className="px-4 py-2 text-[11px] text-zinc-500">
                  Wallet extension collision detected (`window.ethereum` is locked). Use Coinbase Wallet.
                </div>
              ) : null}
              {allowExternalWalletButtons
                ? filteredConnectors.map((connector) => (
                    <button
                      key={connector.uid}
                      type="button"
                      disabled={isPending || auth.busy}
                      className="w-full text-left py-3 px-4 hover:bg-white/4 transition-colors disabled:opacity-50"
                      onClick={() => {
                        connect({ connector })
                        setShowOptions(false)
                      }}
                    >
                      <span className="label block">{connector.name}</span>
                    </button>
                  ))
                : null}
            </div>
          </>
        )}
      </div>
    )
  }

  // Disconnected - Privy-first sign in
  return (
    <div className="relative">
      <button
        type="button"
        disabled={isPending || auth.busy}
        onClick={() => {
          if (prefersPrivyWalletLogin) {
            void (async () => {
              const signed = await auth.signIn({ method: 'privy' })
              setShowOptions(!signed)
            })()
          } else {
            setShowOptions(!showOptions)
          }
        }}
        className="btn-accent btn-no-icon disabled:opacity-50 flex min-w-[136px] items-center justify-center gap-2"
      >
        <Wallet className="w-4 h-4" />
        <span className="label">{isPending || auth.busy ? 'Signing in…' : 'Sign in'}</span>
      </button>
      {auth.error ? <div className="mt-2 max-w-[280px] text-[11px] text-red-400/90">{auth.error}</div> : null}

      {showOptions && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowOptions(false)}
          />
          <div className="absolute right-0 top-full mt-3 w-64 card p-3 z-50 space-y-1">
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
                  <span className="label block">Sign in with email or social</span>
                  <span className="text-[11px] text-zinc-500 block mt-1">Email, Google, or Apple</span>
                </button>
                <div className="h-px bg-white/8 my-1" />
                <div className="px-4 py-1 text-[10px] text-zinc-600 uppercase tracking-wider">External wallets</div>
              </>
            ) : null}
            {hasMultipleInjectedProviders ? (
              <div className="px-4 py-2 text-[11px] text-zinc-500">
                Multiple wallet extensions detected. Use Coinbase Wallet.
              </div>
            ) : lockedEthereumProviderGlobal ? (
              <div className="px-4 py-2 text-[11px] text-zinc-500">
                Wallet extension collision detected (`window.ethereum` is locked). Use Coinbase Wallet.
              </div>
            ) : null}
            {allowExternalWalletButtons
              ? filteredConnectors.map((connector) => (
                  <button
                    key={connector.uid}
                    type="button"
                    disabled={isPending || auth.busy}
                    className="w-full text-left py-3 px-4 hover:bg-white/4 transition-colors disabled:opacity-50"
                    onClick={() => {
                      connect({ connector })
                      setShowOptions(false)
                    }}
                  >
                    <span className="label block">{connector.name}</span>
                  </button>
                ))
              : null}
          </div>
        </>
      )}
    </div>
  )
}
