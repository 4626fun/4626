import type { Config } from 'wagmi'
import { injected } from 'wagmi/connectors'

import {
  isWaitlistMessagingWagmiConnector,
  waitForMessagingWallet,
  WAITLIST_EMBEDDED_CONNECTOR_ID,
  WAITLIST_MESSAGING_WALLET_VERIFY_MS,
} from '@/lib/xmtp/waitForMessagingWallet'
import { isConnectorAlreadyConnectedError } from '@/lib/swap/connectGate'

import { refreshPrivyEmbeddedSignerSession } from '@/lib/privy/refreshEmbeddedSignerSession'
import {
  isPrivyUnifiedStackWallet,
  privyAuthorizedWalletPersonalSign,
  resolvePrivyUnifiedWalletId,
  type PrivyAuthorizationSignatureGenerator,
} from '@/lib/privy/privyAuthorizedWalletRpc'

import type { WaitlistConnectTrack } from './waitlistFlowState'

export { isWaitlistMessagingWagmiConnector, WAITLIST_EMBEDDED_CONNECTOR_ID }

export type PrepareWaitlistMessagingWalletInput = {
  wallets: unknown[]
  embeddedEoaAddress: string | null
  ensureEmbeddedWallet: () => Promise<{ address: string }>
  setActiveWallet?: (wallet: unknown) => Promise<unknown> | unknown
  getToken?: () => Promise<string | null>
  connectAsync: (variables: { connector: unknown }) => Promise<unknown>
  connectors: ReadonlyArray<{ id: string; name: string }>
  disconnectAsync?: () => Promise<unknown>
  activeConnectorId?: string | null
  messagingWalletReady: boolean
  wagmiConfig: Config
  connectTrack?: WaitlistConnectTrack
  canonicalCswAddress?: string | null
  /**
   * Privy user authorization-signature generator (from `useAuthorizationSignature`).
   * Required for unified-stack (owner_id) embedded wallets: their personal_sign
   * goes through the Wallet API and 401s without `privy-authorization-signature`.
   */
  generateAuthorizationSignature?: PrivyAuthorizationSignatureGenerator
  privyUser?: unknown
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
export function wrapWaitlistMessagingProvider(
  real: { request: (args: unknown) => Promise<unknown> },
  authorizedPersonalSign?: (messageHex: string) => Promise<string>,
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
      if (method === 'personal_sign' && typeof authorizedPersonalSign === 'function') {
        // Unified-stack (owner_id) embedded wallets: the SDK's own personal_sign
        // hits the Wallet API without a user authorization signature and 401s
        // ("No valid authorization signatures were provided"). Sign through the
        // authorized Wallet API lane instead; fall back to the raw provider so
        // legacy embedded wallets keep working.
        const params = Array.isArray(args?.params) ? args.params : []
        const hexParams = params.filter(
          (value: unknown): value is string => typeof value === 'string' && /^0x[0-9a-fA-F]*$/.test(value),
        )
        // EIP-1193 sends [message, address]; some providers reverse it. Skip
        // the 20-byte address param so we never sign the address by mistake.
        const messageHex = hexParams.find((value: string) => !/^0x[0-9a-fA-F]{40}$/.test(value)) ?? null
        if (messageHex) {
          try {
            return await authorizedPersonalSign(messageHex)
          } catch (error) {
            console.warn(
              '[waitlist-messaging] authorized personal_sign failed, falling back to embedded provider:',
              error,
            )
          }
        }
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
  authorizedPersonalSign?: (messageHex: string) => Promise<string>,
): Promise<PrepareWaitlistMessagingWalletResult> {
  const safeProvider = wrapWaitlistMessagingProvider(provider, authorizedPersonalSign)
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

function isCoinbaseMessagingConnectorId(connectorId: string | null | undefined): boolean {
  const id = String(connectorId ?? '').trim().toLowerCase()
  return id.includes('coinbase')
}

function findCoinbaseMessagingConnector(
  connectors: ReadonlyArray<{ id: string; name: string }>,
): { id: string; name: string } | null {
  for (const connector of connectors) {
    const id = connector.id.toLowerCase()
    const name = connector.name.toLowerCase()
    if (id.includes('coinbase') || name.includes('coinbase')) return connector
  }
  return null
}

async function prepareBaseAppMessagingWallet(
  input: Pick<
    PrepareWaitlistMessagingWalletInput,
    | 'connectAsync'
    | 'connectors'
    | 'disconnectAsync'
    | 'activeConnectorId'
    | 'messagingWalletReady'
    | 'wagmiConfig'
    | 'canonicalCswAddress'
  >,
): Promise<PrepareWaitlistMessagingWalletResult> {
  const canonicalAddress = normalizeAddress(input.canonicalCswAddress)
  if (!canonicalAddress) {
    return {
      ok: false,
      error: 'Your canonical Coinbase Smart Wallet is not on your profile yet.',
    }
  }

  const coinbasePredicate = (connectorId: string | undefined) =>
    isCoinbaseMessagingConnectorId(connectorId)

  if (input.messagingWalletReady) {
    const settled = await waitForMessagingWallet(input.wagmiConfig, {
      expectedAddress: canonicalAddress,
      connectorPredicate: coinbasePredicate,
      timeoutMs: WAITLIST_MESSAGING_WALLET_VERIFY_MS,
    })
    if (settled) return { ok: true }
  }

  const coinbaseConnector = findCoinbaseMessagingConnector(input.connectors)
  if (!coinbaseConnector) {
    return {
      ok: false,
      error: 'Connect your Base Account wallet, then retry Connect messaging.',
    }
  }

  const activeConnectorId = input.activeConnectorId ?? null
  if (
    activeConnectorId &&
    !isCoinbaseMessagingConnectorId(activeConnectorId) &&
    typeof input.disconnectAsync === 'function'
  ) {
    try {
      await input.disconnectAsync()
    } catch {
      // Best-effort — stale Privy/injected sessions must not block Base App connect.
    }
  }

  try {
    await input.connectAsync({ connector: coinbaseConnector })
  } catch (error) {
    if (!isConnectorAlreadyConnectedError(error)) {
      const message = error instanceof Error ? error.message : String(error)
      return {
        ok: false,
        error: message || 'Could not connect your Base Account wallet for messaging.',
      }
    }
  }

  const settled = await waitForMessagingWallet(input.wagmiConfig, {
    expectedAddress: canonicalAddress,
    connectorPredicate: coinbasePredicate,
  })
  if (settled) return { ok: true }

  return {
    ok: false,
    error:
      'Base Account wallet connected but wagmi is still syncing. Wait a moment and retry Connect messaging.',
  }
}

export async function prepareWaitlistMessagingWallet(
  input: PrepareWaitlistMessagingWalletInput,
): Promise<PrepareWaitlistMessagingWalletResult> {
  if (input.connectTrack === 'base-app-direct') {
    return prepareBaseAppMessagingWallet(input)
  }

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
    if (typeof window !== 'undefined') {
      const h = window.location.hostname.toLowerCase()
      if (h === 'localhost' || h === '127.0.0.1') {
        return {
          ok: false,
          error:
            'Embedded signer session not ready on localhost (privy.4626.fun custom domain). Sign out completely, hard refresh, and sign in with email OTP again. If linking Zora/OAuth, also allowlist localhost:5173/5174 in your Privy Local Dev client Allowed Origins.',
        }
      }
    }
    return {
      ok: false,
      error: 'Embedded signer is not ready to sign yet. Refresh the page and retry Connect messaging.',
    }
  }

  try {
    await refreshPrivyEmbeddedSignerSession({
      wallet: embeddedWallet,
      setActiveWallet: input.setActiveWallet,
      getToken: input.getToken,
      logLabel: 'waitlist-messaging-prepare',
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return {
      ok: false,
      error: message || 'Sign-in for chat expired. Refresh session or sign in again with email OTP.',
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

  const unifiedWalletId =
    typeof input.generateAuthorizationSignature === 'function' &&
    isPrivyUnifiedStackWallet(embeddedWallet, input.privyUser)
      ? resolvePrivyUnifiedWalletId({
          wallet: embeddedWallet,
          user: input.privyUser,
          address: embeddedAddress,
        })
      : null
  const authorizedPersonalSign =
    unifiedWalletId && typeof input.generateAuthorizationSignature === 'function'
      ? (messageHex: string) =>
          privyAuthorizedWalletPersonalSign({
            walletId: unifiedWalletId,
            messageHex,
            generateAuthorizationSignature: input.generateAuthorizationSignature!,
            getToken: input.getToken,
          })
      : undefined

  // The privy connector is not mounted on email/Zora waitlist tracks — use the
  // synthetic embedded provider directly to avoid waking extension injectors.
  const embeddedConnect = await connectEmbeddedWaitlistProvider(
    input,
    provider,
    embeddedAddress,
    authorizedPersonalSign,
  )
  if (embeddedConnect.ok) return embeddedConnect

  return embeddedConnect
}
