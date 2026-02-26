import { useAccount, useConnect, useDisconnect } from 'wagmi'
import { useMemo, useState } from 'react'
import { Wallet, ChevronDown } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useSiweAuth } from '@/hooks/useSiweAuth'
import { usePrivyClientStatus } from '@/lib/privy/client'

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

  const hasMultipleInjectedProviders =
    typeof window !== 'undefined' &&
    Array.isArray((window as any)?.ethereum?.providers) &&
    ((window as any).ethereum.providers as any[]).length > 1
  const lockedEthereumProviderGlobal =
    typeof window !== 'undefined' &&
    (() => {
      const descriptor = Object.getOwnPropertyDescriptor(window, 'ethereum')
      if (!descriptor) return false
      return typeof descriptor.get === 'function' && typeof descriptor.set !== 'function'
    })()
  const shouldHideInjectedConnector = hasMultipleInjectedProviders || lockedEthereumProviderGlobal

  const filteredConnectors = useMemo(() => {
    if (!shouldHideInjectedConnector) return connectors
    return connectors.filter((connector) => {
      const id = String((connector as any)?.id ?? '').toLowerCase()
      return !id.includes('injected')
    })
  }, [connectors, shouldHideInjectedConnector])

  const formatAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`

  // Connected - show address with disconnect option
  if (isConnected && address) {
    return (
      <div className="relative">
        <button
          onClick={() => setShowMenu(!showMenu)}
          className="btn-primary btn-no-icon flex items-center gap-3"
        >
          <div className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
          <span className="mono text-sm">{formatAddress(address)}</span>
          <ChevronDown className={`w-3 h-3 text-zinc-600 transition-transform ${showMenu ? 'rotate-180' : ''}`} />
        </button>

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
              {!auth.isSignedIn ? (
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
                  <div className="text-[11px] text-zinc-600 mt-1">Session matches connected wallet.</div>
                </div>
              )}
              {auth.isSignedIn ? (
                <Link
                  to="/account"
                  onClick={() => setShowMenu(false)}
                  className="block w-full py-3 px-4 hover:bg-white/4 transition-colors"
                >
                  <span className="label block text-zinc-300">Account settings</span>
                </Link>
              ) : null}
              {auth.isSignedIn ? (
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

  // Disconnected - show connect options
  return (
    <div className="relative">
      <button
        type="button"
        disabled={isPending || auth.busy}
        onClick={() => {
          if (!prefersPrivyWalletLogin) {
            setShowOptions(!showOptions)
            return
          }
          void (async () => {
            const signed = await auth.signIn({ method: 'zora' })
            if (!signed) setShowOptions(true)
          })()
        }}
        className="btn-accent btn-no-icon disabled:opacity-50 flex items-center gap-2"
      >
        <Wallet className="w-4 h-4" />
        <span className="label">{isPending || auth.busy ? 'Connecting…' : 'Connect'}</span>
      </button>

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
            {prefersPrivyWalletLogin ? (
              <button
                type="button"
                disabled={auth.busy}
                className="w-full text-left py-3 px-4 hover:bg-white/4 transition-colors disabled:opacity-50"
                onClick={() => {
                  setShowOptions(false)
                  void auth.signIn({ method: 'zora' })
                }}
              >
                <span className="label block">Continue with Zora</span>
                <span className="text-[11px] text-zinc-500 block mt-1">Sign in on Zora first</span>
              </button>
            ) : null}
            {prefersPrivyWalletLogin ? (
              <button
                type="button"
                disabled={auth.busy}
                className="w-full text-left py-3 px-4 hover:bg-white/4 transition-colors disabled:opacity-50"
                onClick={() => {
                  setShowOptions(false)
                  void auth.signIn({ method: 'privy' })
                }}
              >
                <span className="label block">Try another way</span>
                <span className="text-[11px] text-zinc-500 block mt-1">Try this if wallet login does not open</span>
              </button>
            ) : null}
            {filteredConnectors.map((connector) => (
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
            ))}
          </div>
        </>
      )}
    </div>
  )
}
