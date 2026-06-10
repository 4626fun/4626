import type { Config } from 'wagmi'
import { injected } from 'wagmi/connectors'

import {
  isWaitlistMessagingWagmiConnector,
  waitForMessagingWallet,
  WAITLIST_EMBEDDED_CONNECTOR_ID,
  WAITLIST_MESSAGING_WALLET_VERIFY_MS,
} from '@/lib/xmtp/waitForMessagingWallet'
import { isConnectorAlreadyConnectedError } from '@/lib/swap/connectGate'

export { isWaitlistMessagingWagmiConnector, WAITLIST_EMBEDDED_CONNECTOR_ID }

export type PrepareWaitlistMessagingWalletInput = {
  wallets: unknown[]
  embeddedEoaAddress: string | null
  ensureEmbeddedWallet: () => Promise<{ address: string }>
  setActiveWallet?: (wallet: unknown) => Promise<unknown> | unknown
  connectAsync: (variables: { connector: unknown }) => Promise<unknown>
  connectors: ReadonlyArray<{ id: string; name: string }>
  disconnectAsync?: () => Promise<unknown>
  activeConnectorId?: string | null
  messagingWalletReady: boolean
  wagmiConfig: Config
}

export type PrepareWaitlistMessagingWalletResult =
  | { ok: true }
  | { ok: false; error: string }

function normalizeAddress(value: unknown): string | null {
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : ''
  return /^0x[a-f0-9]{40}$/.test(raw) ? raw : null
}

function isEmbeddedPrivyWalletRecord(value: unknown): boolean {
  const record = value && typeof value === 'object' ? (value as Record<string, unknown>) : null
  if (!record) return false
  const walletClientType = String(
    record.walletClientType ?? record.wallet_client_type ?? record.connector_type ?? record.type ?? '',
  ).toLowerCase()
  return walletClientType === 'privy' || walletClientType.includes('embedded') || walletClientType.includes('privy')
}

export function findLiveEmbeddedPrivyWallet(
  wallets: unknown[],
  embeddedEoaAddress: string | null,
): Record<string, unknown> | null {
  const target = normalizeAddress(embeddedEoaAddress)
  if (!target) return null

  let fallback: Record<string, unknown> | null = null
  for (const wallet of wallets) {
    const record = wallet && typeof wallet === 'object' ? (wallet as Record<string, unknown>) : null
    if (!record) continue
    const address = normalizeAddress(record.address)
    if (address !== target) continue
    if (isEmbeddedPrivyWalletRecord(record)) return record
    fallback = record
  }
  return fallback
}

async function resolveEmbeddedProvider(wallet: Record<string, unknown>): Promise<{ request: (args: unknown) => Promise<unknown> } | null> {
  const directProvider = wallet.provider
  if (
    directProvider &&
    typeof directProvider === 'object' &&
    typeof (directProvider as { request?: unknown }).request === 'function'
  ) {
    return directProvider as { request: (args: unknown) => Promise<unknown> }
  }

  const getEthereumProvider = wallet.getEthereumProvider
  if (typeof getEthereumProvider === 'function') {
    try {
      const provider = await getEthereumProvider.call(wallet)
      if (provider && typeof (provider as { request?: unknown }).request === 'function') {
        return provider as { request: (args: unknown) => Promise<unknown> }
      }
    } catch {
      return null
    }
  }

  if (typeof wallet.request === 'function') {
    return { request: wallet.request.bind(wallet) as (args: unknown) => Promise<unknown> }
  }

  return null
}

/**
 * Wraps a Privy embedded provider for the narrow waitlist messaging use case.
 * The synthetic `injected` connector we create for XMTP on /waitlist only needs
 * basic eth_ signing. We intercept `wallet_*` methods (wallet_getCapabilities,
 * wallet_requestPermissions, etc.) here so they never escape to a raw HTTP
 * transport (e.g. Alchemy). Callers in AccountContextProvider, wagmi connect
 * flows, and capability probes already have catch paths that treat these as
 * "no special capabilities".
 *
 * We also stub event methods (on/removeListener/etc.) because the underlying
 * embedded provider may only expose a minimal { request } object (not a full
 * EIP-1193 provider). wagmi's `injected` connector (and some internal watchers)
 * will call `provider.on(...)` during connect/activation, which would otherwise
 * throw "provider.on is not a function". For this manualConnectOnly messaging
 * path we don't need real event subscriptions.
 */
function wrapWaitlistMessagingProvider(
  real: { request: (args: unknown) => Promise<unknown> }
) {
  // Build so that event methods can return the provider (for any code that
  // chains .on().on() etc.). This prevents "provider.on is not a function"
  // when wagmi's injected connector (or other watchers) calls into the
  // synthetic provider returned by our target.provider() factory during
  // connectAsync for the waitlist messaging embedded EOA.
  let safe: any
  safe = {
    request: async (args: any) => {
      const method = typeof args?.method === 'string' ? args.method : ''
      if (method === 'wallet_getCapabilities') {
        // Empty response → parseCapabilities yields the safe "unknown/no caps" defaults.
        return {}
      }
      if (method === 'wallet_requestPermissions') {
        // Returning empty array satisfies many connector activation / permission probes.
        return []
      }
      if (method.startsWith('wallet_')) {
        // Any other wallet_ method in this embedded-only messaging context:
        // reject with a clear message. Existing catch blocks in probes will fall back.
        throw new Error(`wallet method ${method} not supported for waitlist messaging connector`)
      }
      return real.request(args)
    },
    // No-op EIP-1193-ish event methods. We don't need real subscriptions
    // for the manualConnectOnly waitlist XMTP messaging path.
    on: () => safe,
    removeListener: () => safe,
    addListener: () => safe,
    off: () => safe,
    emit: () => safe,
    removeAllListeners: () => safe,
  }
  return safe
}

async function connectEmbeddedWaitlistProvider(
  input: Pick<PrepareWaitlistMessagingWalletInput, 'connectAsync' | 'wagmiConfig'>,
  provider: { request: (args: unknown) => Promise<unknown> },
  embeddedAddress: string | null,
): Promise<PrepareWaitlistMessagingWalletResult> {
  const safeProvider = wrapWaitlistMessagingProvider(provider)
  try {
    await input.connectAsync({
      connector: injected({
        target: {
          id: WAITLIST_EMBEDDED_CONNECTOR_ID,
          name: 'Privy Embedded',
          provider: () => safeProvider as any,
        },
      }),
    })
  } catch (error) {
    if (!isConnectorAlreadyConnectedError(error)) {
      const message = error instanceof Error ? error.message : String(error)
      return {
        ok: false,
        error: message || 'Could not connect your embedded signer for messaging.',
      }
    }
  }

  const settled = await waitForMessagingWallet(input.wagmiConfig, {
    expectedAddress: embeddedAddress,
    connectorPredicate: isWaitlistMessagingWagmiConnector,
  })
  if (settled) return { ok: true }

  return {
    ok: false,
    error: 'Embedded signer connected but wagmi is still syncing. Wait a moment and retry Connect messaging.',
  }
}

export async function prepareWaitlistMessagingWallet(
  input: PrepareWaitlistMessagingWalletInput,
): Promise<PrepareWaitlistMessagingWalletResult> {
  if (input.messagingWalletReady) {
    const settled = await waitForMessagingWallet(input.wagmiConfig, {
      expectedAddress: input.embeddedEoaAddress,
      connectorPredicate: isWaitlistMessagingWagmiConnector,
      timeoutMs: WAITLIST_MESSAGING_WALLET_VERIFY_MS,
    })
    if (settled) return { ok: true }
  }

  let embeddedAddress = normalizeAddress(input.embeddedEoaAddress)
  try {
    const ensured = await input.ensureEmbeddedWallet()
    embeddedAddress = normalizeAddress(ensured.address) ?? embeddedAddress
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return {
      ok: false,
      error: message || 'Sign in with email before enabling messaging.',
    }
  }

  const embeddedWallet = findLiveEmbeddedPrivyWallet(input.wallets, embeddedAddress)
  if (!embeddedWallet) {
    return {
      ok: false,
      error: 'Embedded signer is still loading. Wait a few seconds, then retry Connect messaging.',
    }
  }

  if (typeof input.setActiveWallet === 'function') {
    try {
      await Promise.resolve(input.setActiveWallet(embeddedWallet))
    } catch {
      // Best-effort — some SDK builds attach providers only after activation.
    }
  }

  const provider = await resolveEmbeddedProvider(embeddedWallet)
  if (!provider) {
    return {
      ok: false,
      error: 'Embedded signer is not ready to sign yet. Refresh the page and retry Connect messaging.',
    }
  }

  const activeConnectorId = input.activeConnectorId ?? null
  if (
    activeConnectorId &&
    !isWaitlistMessagingWagmiConnector(activeConnectorId) &&
    typeof input.disconnectAsync === 'function'
  ) {
    try {
      await input.disconnectAsync()
    } catch {
      // Best-effort — stale Coinbase/injected reconnects must not block embedded connect.
    }
  }

  // Prefer the regular Privy connector (after we called setActiveWallet(embedded) above).
  // This avoids creating a synthetic `injected` connector (with custom target.provider)
  // which tends to wake up wallet extension content scripts (evmAsk.js, injected.js,
  // requestProvider.js etc). Those scripts then throw "injected is not defined",
  // "Cannot set property ethereum ... which has only a getter", and trigger the
  // provider.on errors we saw (both in our code and inside the extensions' own
  // inject logic).
  //
  // The privy connector is a first-class one that already knows how to talk to
  // Privy wallets (including the embedded EOA). After setActiveWallet the active
  // one should be our embedded; waitFor will verify the address matches.
  const privyConnector = input.connectors.find((connector) => {
    const id = connector.id.toLowerCase()
    const name = connector.name.toLowerCase()
    return id.includes('privy') || name.includes('privy')
  })

  if (privyConnector) {
    try {
      await input.connectAsync({ connector: privyConnector })
    } catch (error) {
      if (!isConnectorAlreadyConnectedError(error)) {
        // fall through to synthetic
      }
    }

    const settled = await waitForMessagingWallet(input.wagmiConfig, {
      expectedAddress: embeddedAddress,
      connectorPredicate: isWaitlistMessagingWagmiConnector,
    })
    if (settled) return { ok: true }
  }

  // Only if the normal Privy path didn't land on the exact embedded EOA we want
  // (can happen if Privy has several wallets in the session and the connector
  // picks a different one), fall back to the synthetic injected that directly
  // wires the embedded provider we resolved. The wrapper on it prevents the
  // "provider.on is not a function" and wallet_* leaks, and stubs the event
  // methods.
  const embeddedConnect = await connectEmbeddedWaitlistProvider(input, provider, embeddedAddress)
  if (embeddedConnect.ok) return embeddedConnect

  return embeddedConnect
}
