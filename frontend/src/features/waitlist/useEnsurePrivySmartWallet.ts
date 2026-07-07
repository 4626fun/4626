import { useCallback, useEffect, useRef, useState } from 'react'
import { useSmartWallets } from '@privy-io/react-auth/smart-wallets'
import { getAddress, isAddress } from 'viem'

import { invalidateAccountMeCache } from '@/hooks/useAccountMe'
import { useEnsurePrivyEmbeddedWallet } from '@/lib/privy/embeddedWallet'
import { useSafePrivy } from '@/lib/privy/safeHooks'

const SMART_WALLET_WAIT_MS = 12_000
const POLL_MS = 400

function normalizeAddress(value: unknown): string | null {
  const raw = typeof value === 'string' ? value.trim() : ''
  if (!raw || !isAddress(raw)) return null
  return getAddress(raw).toLowerCase()
}

export type EnsurePrivySmartWalletResult =
  | { ok: true; smartWalletAddress: string; embeddedEoaAddress: string; created: boolean }
  | { ok: false; error: string }

export function useEnsurePrivySmartWallet(params: { enabled: boolean }) {
  const privy = useSafePrivy()
  const { client } = useSmartWallets()
  const { embeddedEoaAddress, ensureEmbeddedWallet, isCreatingEmbeddedWallet } =
    useEnsurePrivyEmbeddedWallet()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [smartWalletAddress, setSmartWalletAddress] = useState<string | null>(null)
  const provisionedRef = useRef(false)

  const readSmartWalletAddress = useCallback((): string | null => {
    const fromClient = normalizeAddress(client?.account?.address)
    if (fromClient) return fromClient
    return smartWalletAddress
  }, [client?.account?.address, smartWalletAddress])

  useEffect(() => {
    if (!params.enabled) return
    const fromClient = normalizeAddress(client?.account?.address)
    if (fromClient) setSmartWalletAddress(fromClient)
  }, [client?.account?.address, params.enabled])

  const ensurePrivyWallets = useCallback(async (): Promise<EnsurePrivySmartWalletResult> => {
    if (!params.enabled) {
      return { ok: false, error: 'Wallet provisioning is not enabled.' }
    }
    if (!privy.authenticated) {
      return { ok: false, error: 'Sign in with email before creating your 4626 wallet.' }
    }

    setBusy(true)
    setError(null)
    try {
      const embedded = await ensureEmbeddedWallet()
      const embeddedAddress = normalizeAddress(embedded.address)
      if (!embeddedAddress) {
        return { ok: false, error: 'Could not provision your embedded signer.' }
      }

      let resolvedSmart = readSmartWalletAddress()
      const deadline = Date.now() + SMART_WALLET_WAIT_MS
      while (!resolvedSmart && Date.now() < deadline) {
        await new Promise((resolve) => window.setTimeout(resolve, POLL_MS))
        resolvedSmart = normalizeAddress(client?.account?.address) ?? readSmartWalletAddress()
      }

      if (!resolvedSmart) {
        return {
          ok: false,
          error:
            'Your 4626 smart wallet is still being created. Wait a few seconds and try again.',
        }
      }

      setSmartWalletAddress(resolvedSmart)
      if (!provisionedRef.current) {
        provisionedRef.current = true
        invalidateAccountMeCache()
      }

      return {
        ok: true,
        smartWalletAddress: resolvedSmart,
        embeddedEoaAddress: embeddedAddress,
        created: embedded.created || !readSmartWalletAddress(),
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setError(message || 'Could not create your 4626 wallet.')
      return { ok: false, error: message || 'Could not create your 4626 wallet.' }
    } finally {
      setBusy(false)
    }
  }, [
    client?.account?.address,
    ensureEmbeddedWallet,
    params.enabled,
    privy.authenticated,
    readSmartWalletAddress,
  ])

  return {
    busy: busy || isCreatingEmbeddedWallet,
    error,
    embeddedEoaAddress,
    smartWalletAddress: readSmartWalletAddress(),
    ensurePrivyWallets,
  }
}
