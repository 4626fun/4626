import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useCreateWallet, usePrivy, useWallets } from '@privy-io/react-auth'
import { getAddress, isAddress, type Address } from 'viem'

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

function normalizePrivyText(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
}

function normalizeAddressOrNull(value: unknown): Address | null {
  const raw = typeof value === 'string' ? value.trim() : ''
  if (!raw || !isAddress(raw)) return null
  return getAddress(raw as Address)
}

function isEmbeddedEthereumWalletRecord(value: unknown): value is { address?: unknown } {
  const record = value && typeof value === 'object' ? (value as Record<string, unknown>) : null
  if (!record) return false
  const chainType = normalizePrivyText(record.chain_type ?? record.chainType)
  if (chainType.includes('solana')) return false
  const walletClientType = normalizePrivyText(
    record.wallet_client_type ?? record.walletClientType ?? record.connector_type ?? record.connectorType ?? record.type ?? record.provider,
  )
  return walletClientType === 'privy' || walletClientType.includes('embedded') || walletClientType.includes('privy')
}

export function pickPrivyEmbeddedEoaAddressFromWallets(wallets: unknown): Address | null {
  const entries = Array.isArray(wallets) ? wallets : []
  for (const wallet of entries) {
    if (!isEmbeddedEthereumWalletRecord(wallet)) continue
    const address = normalizeAddressOrNull((wallet as Record<string, unknown>).address)
    if (address) return address
  }
  return null
}

export function pickPrivyEmbeddedEoaAddressFromUser(user: unknown): Address | null {
  const record = user && typeof user === 'object' ? (user as Record<string, unknown>) : null
  if (!record) return null

  const directWalletCandidates = [
    ...(record.wallet && typeof record.wallet === 'object' ? [record.wallet] : []),
    ...(Array.isArray(record.wallets) ? record.wallets : []),
  ]
  const directWalletAddress = pickPrivyEmbeddedEoaAddressFromWallets(directWalletCandidates)
  if (directWalletAddress) return directWalletAddress

  const linkedAccounts = Array.isArray(record.linkedAccounts)
    ? record.linkedAccounts
    : Array.isArray(record.linked_accounts)
      ? record.linked_accounts
      : []

  for (const account of linkedAccounts) {
    if (!isEmbeddedEthereumWalletRecord(account)) continue
    const address = normalizeAddressOrNull((account as Record<string, unknown>).address)
    if (address) return address
  }

  for (const account of linkedAccounts) {
    const nestedWallets = Array.isArray((account as Record<string, unknown>).embeddedWallets)
      ? (account as Record<string, unknown>).embeddedWallets
      : Array.isArray((account as Record<string, unknown>).embedded_wallets)
        ? (account as Record<string, unknown>).embedded_wallets
        : []
    const nestedAddress = pickPrivyEmbeddedEoaAddressFromWallets(nestedWallets)
    if (nestedAddress) return nestedAddress
  }

  return null
}

type CreateWalletFn = (() => Promise<unknown>) | null

type EmbeddedWalletSnapshot = {
  authenticated: boolean
  user: unknown
  wallets: unknown[]
  createWallet: CreateWalletFn
}

function useSafePrivy() {
  try {
    return usePrivy() as any
  } catch {
    return {
      authenticated: false,
      user: null,
    } as any
  }
}

function useSafeWallets() {
  try {
    return useWallets() as any
  } catch {
    return {
      wallets: [],
    } as any
  }
}

function useSafeCreateWallet() {
  try {
    return useCreateWallet() as any
  } catch {
    return {
      createWallet: null,
    } as any
  }
}

export function useEnsurePrivyEmbeddedWallet() {
  const privy = useSafePrivy()
  const { wallets } = useSafeWallets()
  const { createWallet } = useSafeCreateWallet()
  const [isCreatingEmbeddedWallet, setIsCreatingEmbeddedWallet] = useState(false)

  const embeddedEoaAddress = useMemo(() => {
    return pickPrivyEmbeddedEoaAddressFromWallets(wallets) ?? pickPrivyEmbeddedEoaAddressFromUser(privy.user)
  }, [privy.user, wallets])

  const snapshotRef = useRef<EmbeddedWalletSnapshot>({
    authenticated: Boolean(privy.authenticated),
    user: privy.user ?? null,
    wallets: Array.isArray(wallets) ? wallets : [],
    createWallet: typeof createWallet === 'function' ? createWallet : null,
  })

  useEffect(() => {
    snapshotRef.current = {
      authenticated: Boolean(privy.authenticated),
      user: privy.user ?? null,
      wallets: Array.isArray(wallets) ? wallets : [],
      createWallet: typeof createWallet === 'function' ? createWallet : null,
    }
  }, [createWallet, privy.authenticated, privy.user, wallets])

  const readLatestEmbeddedWallet = useCallback((): Address | null => {
    const snapshot = snapshotRef.current
    return pickPrivyEmbeddedEoaAddressFromWallets(snapshot.wallets) ?? pickPrivyEmbeddedEoaAddressFromUser(snapshot.user)
  }, [])

  const waitForEmbeddedWallet = useCallback(async (): Promise<Address | null> => {
    const deadline = Date.now() + 8_000
    while (Date.now() < deadline) {
      const address = readLatestEmbeddedWallet()
      if (address) return address
      await sleep(250)
    }
    return null
  }, [readLatestEmbeddedWallet])

  const ensureEmbeddedWallet = useCallback(async (): Promise<{ address: Address; created: boolean }> => {
    const existingAddress = readLatestEmbeddedWallet()
    if (existingAddress) {
      return {
        address: existingAddress,
        created: false,
      }
    }

    const snapshot = snapshotRef.current
    if (!snapshot.authenticated) {
      throw new Error('Sign in with Privy before provisioning your embedded wallet.')
    }
    if (!snapshot.createWallet) {
      throw new Error('Privy embedded wallet creation is unavailable in this session.')
    }

    setIsCreatingEmbeddedWallet(true)
    try {
      const createdWallet = await snapshot.createWallet()
      const createdWalletRecord = createdWallet && typeof createdWallet === 'object'
        ? (createdWallet as Record<string, unknown>)
        : null
      const createdWalletAccount =
        createdWalletRecord?.account && typeof createdWalletRecord.account === 'object'
          ? (createdWalletRecord.account as Record<string, unknown>)
          : null
      const createdAddress =
        normalizeAddressOrNull(createdWalletRecord?.address) ??
        normalizeAddressOrNull(createdWalletAccount?.address)
      if (createdAddress) {
        return {
          address: createdAddress,
          created: true,
        }
      }

      const settledAddress = await waitForEmbeddedWallet()
      if (settledAddress) {
        return {
          address: settledAddress,
          created: true,
        }
      }

      throw new Error('Privy embedded wallet provisioning did not complete. Retry in a moment.')
    } catch (error) {
      const message = typeof (error as { message?: unknown } | null)?.message === 'string'
        ? String((error as { message: string }).message)
        : String(error ?? '')
      if (/already has an embedded wallet/i.test(message)) {
        const settledAddress = await waitForEmbeddedWallet()
        if (settledAddress) {
          return {
            address: settledAddress,
            created: false,
          }
        }
      }
      throw error instanceof Error ? error : new Error(message || 'Privy embedded wallet provisioning failed.')
    } finally {
      setIsCreatingEmbeddedWallet(false)
    }
  }, [readLatestEmbeddedWallet, waitForEmbeddedWallet])

  return {
    embeddedEoaAddress,
    ensureEmbeddedWallet,
    isCreatingEmbeddedWallet,
  }
}
