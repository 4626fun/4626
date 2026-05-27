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

async function connectEmbeddedWaitlistProvider(
  input: Pick<PrepareWaitlistMessagingWalletInput, 'connectAsync' | 'wagmiConfig'>,
  provider: { request: (args: unknown) => Promise<unknown> },
  embeddedAddress: string | null,
): Promise<PrepareWaitlistMessagingWalletResult> {
  try {
    await input.connectAsync({
      connector: injected({
        target: {
          id: WAITLIST_EMBEDDED_CONNECTOR_ID,
          name: 'Privy Embedded',
          provider: () => provider as any,
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

  const embeddedConnect = await connectEmbeddedWaitlistProvider(input, provider, embeddedAddress)
  if (embeddedConnect.ok) return embeddedConnect

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
        return embeddedConnect
      }
    }

    const settled = await waitForMessagingWallet(input.wagmiConfig, {
      expectedAddress: embeddedAddress,
      connectorPredicate: isWaitlistMessagingWagmiConnector,
    })
    if (settled) return { ok: true }
  }

  return embeddedConnect
}
