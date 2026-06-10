import { getAccount, getWalletClient } from '@wagmi/core'
import type { Config, Connector } from 'wagmi'
import type { WalletClient } from 'viem'
import { base } from 'wagmi/chains'

export const WAITLIST_EMBEDDED_CONNECTOR_ID = 'privy-embedded-waitlist'

/** Wagmi settle poll after embedded wallet connect. */
export const WAITLIST_MESSAGING_WALLET_SETTLE_MS = 8_000

/** Short re-verify when hooks already report messaging wallet ready. */
export const WAITLIST_MESSAGING_WALLET_VERIFY_MS = 500

export function isWaitlistMessagingWagmiConnector(connectorId: string | null | undefined): boolean {
  const id = String(connectorId ?? '').trim().toLowerCase()
  if (!id) return false
  return id === WAITLIST_EMBEDDED_CONNECTOR_ID || id.includes('privy')
}

export type ResolvedMessagingWallet = {
  address: `0x${string}`
  walletClient: WalletClient
  connector: Connector | undefined
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

function normalizeAddress(value: unknown): string | null {
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : ''
  return /^0x[a-f0-9]{40}$/.test(raw) ? raw : null
}

export async function waitForMessagingWallet(
  config: Config,
  options?: {
    timeoutMs?: number
    expectedAddress?: string | null
    connectorPredicate?: (connectorId: string | undefined) => boolean
  },
): Promise<ResolvedMessagingWallet | null> {
  const timeoutMs = options?.timeoutMs ?? WAITLIST_MESSAGING_WALLET_SETTLE_MS
  const expectedAddress = normalizeAddress(options?.expectedAddress ?? null)
  const connectorPredicate = options?.connectorPredicate ?? (() => true)
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    const account = getAccount(config)
    const connectorId = account.connector?.id
    if (account.isConnected && account.address && connectorPredicate(connectorId)) {
      const connectedAddress = normalizeAddress(account.address)
      if (!connectedAddress) {
        await sleep(250)
        continue
      }
      if (expectedAddress && connectedAddress !== expectedAddress) {
        await sleep(250)
        continue
      }
      try {
        const walletClient = await getWalletClient(config, { chainId: base.id })
        const walletAddress = normalizeAddress(walletClient?.account?.address ?? account.address)
        if (walletClient && walletAddress) {
          return {
            address: walletAddress as `0x${string}`,
            walletClient,
            connector: account.connector,
          }
        }
      } catch {
        // Wagmi can briefly throw while the connector settles.
      }
    }
    await sleep(250)
  }

  return null
}
