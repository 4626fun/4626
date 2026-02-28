import { useCallback, useMemo } from 'react'
import { encodeFunctionData, getAddress, isAddress, type Address, type Hex } from 'viem'
import { useAccount, usePublicClient, useWalletClient } from 'wagmi'
import { useWallets } from '@privy-io/react-auth'
import { base } from 'viem/chains'
import { useQuery } from '@tanstack/react-query'

import { resolveCdpPaymasterUrl } from '@/lib/aa/cdp'
import { sendCoinbaseSmartWalletUserOperation } from '@/lib/aa/coinbaseErc4337'
import { logger } from '@/lib/logger'

const COINBASE_SMART_WALLET_EXECUTE_BATCH_ABI = [
  {
    type: 'function',
    name: 'executeBatch',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: 'calls',
        type: 'tuple[]',
        components: [
          { name: 'target', type: 'address' },
          { name: 'value', type: 'uint256' },
          { name: 'data', type: 'bytes' },
        ],
      },
    ],
    outputs: [],
  },
] as const

const OWNER_CHECK_ABI = [
  {
    type: 'function',
    name: 'isOwnerAddress',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const

function isRecoverableUserOpError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error ?? '')
  const lc = msg.toLowerCase()
  return (
    lc.includes('userop signature verification failed') ||
    lc.includes('invalid signature') ||
    lc.includes('signature check failed') ||
    lc.includes('paymaster rejected') ||
    lc.includes('requested resource not available') ||
    lc.includes('paymaster unavailable') ||
    lc.includes('sponsorship')
  )
}

function isUserRejected(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error ?? '')
  const lc = msg.toLowerCase()
  const code = (error as any)?.code
  if (code === 4001 || code === 'ACTION_REJECTED') return true
  return (
    lc.includes('user rejected') ||
    lc.includes('user denied') ||
    lc.includes('user cancelled') ||
    lc.includes('action_rejected')
  )
}

function summarizeError(error: unknown): string {
  if (error instanceof Error) return error.message.slice(0, 300)
  return String(error ?? '').slice(0, 300)
}

export type PrivyCswExecuteResult = {
  userOpHash: Hex
  transactionHash: Hex
}

export type PrivyCswExecuteState = {
  ready: boolean
  smartWallet: Address | null
  signerAddress: Address | null
  signerType: 'privy-embedded' | 'connected-wallet' | null
  execute: (calls: Array<{ to: Address; value?: bigint; data?: Hex }>) => Promise<PrivyCswExecuteResult>
}

/**
 * Central hook for executing calls via the canonical Coinbase Smart Wallet.
 *
 * Signing priority:
 * 1. Privy embedded EOA (secp256k1_sign — no eth_sign popup, works with all wallets)
 * 2. Connected external wallet (signTypedData / personal_sign fallback)
 *
 * All pages should use this instead of calling sendCoinbaseSmartWalletUserOperation directly.
 */
export function usePrivyCswExecute(params: {
  smartWallet: string | null | undefined
  preferredOwnerAddress?: string | null | undefined
}): PrivyCswExecuteState {
  const smartWalletAddress = params.smartWallet && isAddress(params.smartWallet)
    ? getAddress(params.smartWallet as Address)
    : null
  const preferredOwnerAddress = params.preferredOwnerAddress && isAddress(params.preferredOwnerAddress)
    ? getAddress(params.preferredOwnerAddress as Address)
    : null

  const { address: connectedAddress } = useAccount()
  const { data: walletClient } = useWalletClient()
  const basePublicClient = usePublicClient({ chainId: base.id })
  const fallbackPublicClient = usePublicClient()
  const publicClient = basePublicClient ?? fallbackPublicClient
  const { wallets: privyWallets } = useWallets()

  const privyEmbeddedWallets = useMemo(() => {
    const wallets = Array.isArray(privyWallets) ? (privyWallets as any[]) : []
    return wallets.filter((w) => {
      const wType = String(w?.wallet_client_type ?? w?.walletClientType ?? w?.connector_type ?? w?.type ?? '').trim().toLowerCase()
      if (!(wType === 'privy' || wType.includes('privy') || wType.includes('embedded'))) return false
      const addr = typeof w?.address === 'string' ? w.address.trim() : ''
      if (!addr || !isAddress(addr)) return false
      if (smartWalletAddress && addr.toLowerCase() === smartWalletAddress.toLowerCase()) return false
      return true
    })
  }, [privyWallets, smartWalletAddress])

  const privyEmbeddedAddresses = useMemo(() => {
    return privyEmbeddedWallets
      .map((wallet: any) => {
        const raw = typeof wallet?.address === 'string' ? String(wallet.address).trim() : ''
        if (!raw || !isAddress(raw)) return null
        return getAddress(raw as Address)
      })
      .filter((value): value is Address => Boolean(value))
  }, [privyEmbeddedWallets])

  const orderedPrivyCandidates = useMemo(() => {
    const unique = new Set<string>()
    const ordered: Address[] = []
    const push = (value: Address | null) => {
      if (!value) return
      const key = value.toLowerCase()
      if (unique.has(key)) return
      unique.add(key)
      ordered.push(value)
    }
    push(preferredOwnerAddress)
    push(connectedAddress && isAddress(connectedAddress) ? getAddress(connectedAddress as Address) : null)
    for (const candidate of privyEmbeddedAddresses) push(candidate)
    return ordered
  }, [connectedAddress, preferredOwnerAddress, privyEmbeddedAddresses])

  const privyIsOwnerQuery = useQuery({
    queryKey: ['privy-csw-execute', 'owner-check', smartWalletAddress, orderedPrivyCandidates],
    enabled: Boolean(smartWalletAddress && orderedPrivyCandidates.length > 0 && publicClient),
    staleTime: 30_000,
    queryFn: async () => {
      if (!smartWalletAddress || orderedPrivyCandidates.length === 0 || !publicClient) return null
      for (const candidate of orderedPrivyCandidates) {
        try {
          const isOwner = await publicClient.readContract({
            address: smartWalletAddress,
            abi: OWNER_CHECK_ABI,
            functionName: 'isOwnerAddress',
            args: [candidate],
          })
          if (isOwner === true) return candidate
        } catch {
          continue
        }
      }
      return null
    },
  })

  const privyEoaAddress = privyIsOwnerQuery.data ?? null

  const privyEmbeddedWallet = useMemo(() => {
    if (!privyEoaAddress) return null
    return privyEmbeddedWallets.find((wallet: any) => {
      const raw = typeof wallet?.address === 'string' ? String(wallet.address).trim() : ''
      return raw && isAddress(raw) && getAddress(raw as Address).toLowerCase() === privyEoaAddress.toLowerCase()
    }) ?? null
  }, [privyEmbeddedWallets, privyEoaAddress])

  const connectedIsOwnerQuery = useQuery({
    queryKey: ['privy-csw-execute', 'connected-owner-check', smartWalletAddress, connectedAddress],
    enabled: Boolean(smartWalletAddress && connectedAddress && publicClient),
    staleTime: 30_000,
    queryFn: async () => {
      if (!smartWalletAddress || !connectedAddress || !publicClient) return false
      if (connectedAddress.toLowerCase() === smartWalletAddress.toLowerCase()) return true
      try {
        return (await publicClient.readContract({
          address: smartWalletAddress,
          abi: OWNER_CHECK_ABI,
          functionName: 'isOwnerAddress',
          args: [connectedAddress],
        })) === true
      } catch {
        return false
      }
    },
  })

  const privyCanSign = Boolean(privyEoaAddress && privyEmbeddedWallet)
  const connectedCanSign = Boolean(connectedAddress && walletClient && connectedIsOwnerQuery.data === true)

  const signerType = privyCanSign ? 'privy-embedded' as const
    : connectedCanSign ? 'connected-wallet' as const
    : null

  const signerAddress = privyCanSign ? privyEoaAddress
    : connectedCanSign ? connectedAddress ?? null
    : null

  const ready = Boolean(smartWalletAddress && signerType && publicClient)

  const getPrivyProvider = useCallback(async () => {
    const w: any = privyEmbeddedWallet as any
    if (!w) return null
    if (w?.provider && typeof w.provider.request === 'function') return w.provider
    if (typeof w.getEthereumProvider === 'function') {
      const p = await w.getEthereumProvider().catch(() => null)
      if (p && typeof p.request === 'function') return p
    }
    if (typeof w.request === 'function') return { request: w.request.bind(w) }
    return null
  }, [privyEmbeddedWallet])

  const execute = useCallback(async (
    calls: Array<{ to: Address; value?: bigint; data?: Hex }>,
  ): Promise<PrivyCswExecuteResult> => {
    if (!smartWalletAddress) throw new Error('No canonical smart wallet configured.')
    if (!publicClient) throw new Error('Public client not available.')
    if (!signerType) throw new Error('No signer available. Sign in first.')

    const paymasterEnv = import.meta.env.VITE_CDP_PAYMASTER_URL as string | undefined
    const bundlerUrl = resolveCdpPaymasterUrl(paymasterEnv) || '/api/paymaster'

    if (signerType === 'privy-embedded' && privyEoaAddress) {
      const provider = await getPrivyProvider()
      if (!provider?.request) throw new Error('Privy embedded wallet provider not available.')

      const embeddedWalletClient = {
        request: async (args: { method: string; params?: any[] }) => provider.request(args),
      }

      try {
        return await sendCoinbaseSmartWalletUserOperation({
          publicClient: publicClient as any,
          walletClient: embeddedWalletClient as any,
          bundlerUrl,
          smartWallet: smartWalletAddress,
          ownerAddress: privyEoaAddress,
          calls,
          version: '1',
          userOpSignMode: 'auto',
          allowEoaSignMessageFallback: true,
          skipPaymaster: false,
          retryOnInvalidSignature: false,
        })
      } catch (error: unknown) {
        if (isUserRejected(error)) throw error
        logger.warn('[usePrivyCswExecute] Privy embedded UserOp failed, trying direct executeBatch', {
          smartWallet: smartWalletAddress,
          ownerAddress: privyEoaAddress,
          error: summarizeError(error),
        })
        const executeBatchData = encodeFunctionData({
          abi: COINBASE_SMART_WALLET_EXECUTE_BATCH_ABI as any,
          functionName: 'executeBatch' as any,
          args: [calls.map((c) => ({ target: c.to, value: c.value ?? 0n, data: c.data ?? '0x' }))],
        })
        const txHashRaw = await provider.request({
          method: 'eth_sendTransaction',
          params: [{ from: privyEoaAddress, to: smartWalletAddress, data: executeBatchData }],
        })
        const txHash = String(txHashRaw ?? '').trim()
        if (!/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
          throw new Error('Privy embedded direct fallback did not return a valid transaction hash.')
        }
        return { userOpHash: txHash as Hex, transactionHash: txHash as Hex }
      }
    }

    if (signerType === 'connected-wallet' && connectedAddress && walletClient) {
      const isDirectCsw = connectedAddress.toLowerCase() === smartWalletAddress.toLowerCase()

      if (isDirectCsw) {
        throw new Error(
          'Direct CSW connection detected but Privy embedded signing is preferred. ' +
          'Sign in via Privy to use your embedded wallet.',
        )
      }

      try {
        return await sendCoinbaseSmartWalletUserOperation({
          publicClient: publicClient as any,
          walletClient: walletClient as any,
          bundlerUrl,
          smartWallet: smartWalletAddress,
          ownerAddress: connectedAddress,
          calls,
          version: '1',
          userOpSignMode: 'auto',
          allowEoaSignMessageFallback: true,
          skipPaymaster: false,
        })
      } catch (aaError: unknown) {
        if (isUserRejected(aaError)) throw aaError
        if (!isRecoverableUserOpError(aaError)) throw aaError
        logger.warn('[usePrivyCswExecute] Connected wallet UserOp failed, trying direct executeBatch', {
          smartWallet: smartWalletAddress,
          ownerAddress: connectedAddress,
          error: summarizeError(aaError),
        })
        const executeBatchData = encodeFunctionData({
          abi: COINBASE_SMART_WALLET_EXECUTE_BATCH_ABI as any,
          functionName: 'executeBatch' as any,
          args: [calls.map((c) => ({ target: c.to, value: c.value ?? 0n, data: c.data ?? '0x' }))],
        })
        const walletAny = walletClient as any
        const txHashRaw = typeof walletAny?.sendTransaction === 'function'
          ? await walletAny.sendTransaction({
              account: connectedAddress,
              chain: base as any,
              to: smartWalletAddress,
              value: 0n,
              data: executeBatchData,
            })
          : await walletAny.request({
              method: 'eth_sendTransaction',
              params: [{ from: connectedAddress, to: smartWalletAddress, data: executeBatchData, value: '0x0' }],
            })
        const txHash = String(txHashRaw ?? '').trim()
        if (!/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
          throw new Error('Connected wallet direct fallback did not return a valid transaction hash.')
        }
        return { userOpHash: txHash as Hex, transactionHash: txHash as Hex }
      }
    }

    throw new Error('No valid signer available. Sign in via Privy to continue.')
  }, [smartWalletAddress, publicClient, signerType, privyEoaAddress, connectedAddress, walletClient, getPrivyProvider])

  return {
    ready,
    smartWallet: smartWalletAddress,
    signerAddress,
    signerType,
    execute,
  }
}
