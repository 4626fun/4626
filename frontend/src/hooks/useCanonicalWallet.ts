import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getAddress, isAddress } from 'viem'

import { apiFetch } from '@/lib/apiBase'
import { pickCanonicalSmartWalletAddress, type WaitlistMeData } from './canonicalWalletUtils'

const COINBASE_SMART_WALLET_OWNER_CHECK_ABI = [
  {
    type: 'function',
    name: 'isOwnerAddress',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const

type ApiEnvelope<T> = { success: boolean; data?: T; error?: string }

export function useCanonicalWallet(params: {
  address: string | undefined
  publicClient: any
  walletReady: boolean
}) {
  const waitlistMeQuery = useQuery({
    queryKey: ['swap', 'waitlist-me'],
    queryFn: async (): Promise<WaitlistMeData | null> => {
      const res = await apiFetch('/api/waitlist/me', {
        method: 'GET',
        headers: { Accept: 'application/json' },
      })
      const json = (await res.json().catch(() => null)) as ApiEnvelope<WaitlistMeData | null> | null
      if (!res.ok || !json?.success) return null
      return json.data ?? null
    },
    staleTime: 15_000,
  })

  const canonicalSmartWalletAddress = useMemo(() => {
    return pickCanonicalSmartWalletAddress(waitlistMeQuery.data)
  }, [waitlistMeQuery.data])

  const signerAddress = useMemo(() => {
    if (!params.address || !isAddress(params.address)) return null
    return getAddress(params.address).toLowerCase() as `0x${string}`
  }, [params.address])

  // When the user connects WITH their CSW directly (e.g., Base miniapp / Coinbase
  // Wallet browser), signerAddress === canonicalSmartWalletAddress. In that case the
  // isOwnerAddress check is meaningless (a contract can't own itself as an EOA) and
  // will always return false — skip it and grant canOperateCanonical immediately.
  const isSelfConnect = Boolean(
    canonicalSmartWalletAddress &&
      signerAddress &&
      canonicalSmartWalletAddress.toLowerCase() === signerAddress.toLowerCase(),
  )

  const connectedOwnerQuery = useQuery({
    queryKey: ['swap', 'can-operate-canonical', canonicalSmartWalletAddress, signerAddress],
    enabled: Boolean(canonicalSmartWalletAddress && signerAddress && params.publicClient && !isSelfConnect),
    staleTime: 10_000,
    queryFn: async () => {
      if (!canonicalSmartWalletAddress || !signerAddress || !params.publicClient) return false
      try {
        const isOwner = (await params.publicClient.readContract({
          address: canonicalSmartWalletAddress as `0x${string}`,
          abi: COINBASE_SMART_WALLET_OWNER_CHECK_ABI,
          functionName: 'isOwnerAddress',
          args: [signerAddress],
        })) as boolean
        return isOwner === true
      } catch {
        return false
      }
    },
  })

  const canonicalAddress = canonicalSmartWalletAddress
    ? (canonicalSmartWalletAddress as `0x${string}`)
    : null
  // Self-connect (CSW is the directly-connected account) → always authorised.
  const canOperateCanonical = isSelfConnect || connectedOwnerQuery.data === true
  const identityReady = Boolean(
    canonicalAddress && signerAddress && params.publicClient && params.walletReady && canOperateCanonical,
  )

  return {
    canonicalAddress,
    signerAddress,
    canOperateCanonical,
    identityReady,
    waitlistMeQuery,
    connectedOwnerQuery,
  }
}

