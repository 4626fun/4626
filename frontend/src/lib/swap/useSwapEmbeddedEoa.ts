import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useActiveWallet, useAuthorizationSignature, useWallets } from '@privy-io/react-auth'
import { Address, getAddress, isAddress, toHex, type Hex } from 'viem'

import { extractPrivyWalletsFromUser } from '@/lib/privy/embeddedWallet'
import {
  privyAuthorizedWalletSecp256k1Sign,
  resolvePrivyUnifiedWalletId,
  type PrivyAuthorizationSignatureGenerator,
} from '@/lib/privy/privyAuthorizedWalletRpc'
import { refreshPrivyEmbeddedSignerSession } from '@/lib/privy/refreshEmbeddedSignerSession'
import { isRawEcdsaDigest, signRawEcdsaDigest } from '@/lib/wallet/signRawEcdsaDigest'
import { ensureProviderOnBase } from '@/lib/wallet/safeSwitchToBase'

function normalizePrivyText(value: unknown): string {
  return String(value ?? '').trim().toLowerCase()
}

function normalizeAddressOrNull(value: unknown): Address | null {
  const raw = typeof value === 'string' ? value.trim() : ''
  if (!raw || !isAddress(raw)) return null
  return getAddress(raw as Address)
}

function pickPrivyEmbeddedEoaAddressFromUser(user: any): Address | null {
  const walletCandidates = [
    ...(user?.wallet && typeof user.wallet === 'object' ? [user.wallet] : []),
    ...(Array.isArray(user?.wallets) ? user.wallets : []),
  ]
  for (const wallet of walletCandidates) {
    const chainType = normalizePrivyText((wallet as any)?.chain_type ?? (wallet as any)?.chainType)
    if (chainType.includes('solana')) continue
    const clientType = normalizePrivyText(
      (wallet as any)?.wallet_client_type ??
        (wallet as any)?.walletClientType ??
        (wallet as any)?.connector_type ??
        (wallet as any)?.connectorType ??
        (wallet as any)?.type,
    )
    if (!(clientType === 'privy' || clientType.includes('embedded') || clientType.includes('privy'))) continue
    const address = normalizeAddressOrNull((wallet as any)?.address)
    if (address) return address
  }

  const linked = Array.isArray(user?.linkedAccounts)
    ? (user.linkedAccounts as any[])
    : Array.isArray(user?.linked_accounts)
      ? (user.linked_accounts as any[])
      : []
  for (const account of linked) {
    const type = normalizePrivyText((account as any)?.type)
    const chainType = normalizePrivyText((account as any)?.chain_type ?? (account as any)?.chainType)
    if (chainType.includes('solana')) continue
    const clientType = normalizePrivyText(
      (account as any)?.wallet_client_type ??
        (account as any)?.walletClientType ??
        (account as any)?.connector_type ??
        (account as any)?.connectorType ??
        (account as any)?.provider,
    )
    if (!(type.includes('wallet') && (clientType === 'privy' || clientType.includes('embedded') || clientType.includes('privy')))) {
      continue
    }
    const address = normalizeAddressOrNull((account as any)?.address)
    if (address) return address
  }
  return null
}

function ensureSignatureHex(value: unknown, context: string): Hex {
  if (typeof value === 'string' && /^0x[0-9a-fA-F]+$/.test(value)) return value as Hex
  const record = value && typeof value === 'object' ? (value as Record<string, unknown>) : null
  const direct = record?.signature ?? record?.sig
  if (typeof direct === 'string' && /^0x[0-9a-fA-F]+$/.test(direct)) return direct as Hex
  const nested = record?.result
  if (nested && typeof nested === 'object') {
    const nestedSig = (nested as Record<string, unknown>).signature
    if (typeof nestedSig === 'string' && /^0x[0-9a-fA-F]+$/.test(nestedSig)) return nestedSig as Hex
  }
  throw new Error(`Invalid signature returned from ${context}`)
}

function createEmbeddedSignerWalletClient({
  address,
  getProvider,
  refreshSession,
  ensureSignatureHex,
  isRawEcdsaDigest,
  signRawEcdsaDigest,
  signSecp256k1Digest,
}: {
  address: Address
  getProvider: () => Promise<any | null>
  refreshSession: () => Promise<unknown>
  ensureSignatureHex: (value: unknown, context: string) => Hex
  isRawEcdsaDigest: (value: string) => boolean
  signRawEcdsaDigest: (args: {
    digest: `0x${string}`
    signerAddress: Address
    walletClient: any
    label: string
    refreshSession?: () => Promise<unknown>
  }) => Promise<Hex>
  signSecp256k1Digest?: (digest: Hex) => Promise<Hex>
}) {
  return {
    refreshSession,
    signSecp256k1Digest,
    request: async (args: { method: string; params?: any[] | Record<string, unknown> }) => {
      const provider = await getProvider()
      if (!provider?.request) throw new Error('Privy embedded EOA provider not available')
      await ensureProviderOnBase({ provider, label: 'Privy embedded EOA' })
      if (args?.method === 'secp256k1_sign' && typeof signSecp256k1Digest === 'function') {
        const params = Array.isArray(args.params) ? args.params : []
        const paramsRecord =
          args.params && !Array.isArray(args.params) && typeof args.params === 'object'
            ? (args.params as Record<string, unknown>)
            : null
        const hashCandidate =
          typeof params[0] === 'string'
            ? params[0]
            : params[1] && typeof params[1] === 'string'
              ? params[1]
              : typeof paramsRecord?.hash === 'string'
                ? String(paramsRecord.hash)
                : ''
        if (isRawEcdsaDigest(hashCandidate)) {
          return signSecp256k1Digest(hashCandidate as `0x${string}`)
        }
      }
      if (args?.method === 'eth_sign') {
        const params = Array.isArray(args.params) ? args.params : []
        const hashCandidate = typeof params[1] === 'string' ? params[1] : ''
        if (/^0x[0-9a-fA-F]{64}$/.test(hashCandidate)) {
          try {
            const rawSig = await provider.request({
              method: 'secp256k1_sign',
              params: [hashCandidate],
            })
            return ensureSignatureHex(rawSig, 'privyEmbeddedEoa.secp256k1_sign')
          } catch {
            // Fall through to provider eth_sign when secp256k1_sign is unavailable.
          }
        }
      }
      return await provider.request(args as any)
    },
    signMessage: async (args: { message: unknown }) => {
      const provider = await getProvider()
      if (!provider?.request) throw new Error('Privy embedded EOA provider not available')
      await ensureProviderOnBase({ provider, label: 'Privy embedded EOA' })
      const raw =
        typeof args?.message === 'object' && args.message !== null && 'raw' in (args.message as Record<string, unknown>)
          ? (args.message as Record<string, unknown>).raw
          : args?.message
      const msgHex = typeof raw === 'string' && raw.startsWith('0x') ? raw : toHex(String(raw ?? ''))
      if (isRawEcdsaDigest(msgHex)) {
        return signRawEcdsaDigest({
          digest: msgHex as `0x${string}`,
          signerAddress: address,
          walletClient: {
            refreshSession,
            signSecp256k1Digest,
            // Re-resolve the provider per request so retries after a session
            // refresh do not reuse a stale provider channel.
            request: async (requestArgs: any) => {
              const liveProvider = (await getProvider()) ?? provider
              return liveProvider.request(requestArgs as any)
            },
          },
          label: 'privyEmbeddedEoa',
          refreshSession,
        })
      }
      const rawSig = await provider.request({
        method: 'personal_sign',
        params: [msgHex, address],
      })
      return ensureSignatureHex(rawSig, 'privyEmbeddedEoa.personal_sign')
    },
    signTypedData: async (typedData: unknown) => {
      const provider = await getProvider()
      if (!provider?.request) throw new Error('Privy embedded EOA provider not available')
      await ensureProviderOnBase({ provider, label: 'Privy embedded EOA' })
      const rawSig = await provider.request({
        method: 'eth_signTypedData_v4',
        params: [address, JSON.stringify(typedData)],
      })
      return ensureSignatureHex(rawSig, 'privyEmbeddedEoa.signTypedData')
    },
  }
}

export function useSwapEmbeddedEoa(params: {
  privyUser: any
  privyAuthenticated: boolean | null
  ensuredEmbeddedEoaAddress: Address | null
  ensureEmbeddedWallet: () => Promise<any>
  authAddress: Address | null
  canonicalAddress: Address | null
}) {
  const {
    privyUser,
    privyAuthenticated,
    ensuredEmbeddedEoaAddress,
    ensureEmbeddedWallet,
    authAddress,
    canonicalAddress,
  } = params
  const { wallets: privyLiveWallets } = useWallets()
  const { generateAuthorizationSignature } = useAuthorizationSignature()
  const privyWallets = useMemo(() => {
    const metadataWallets = extractPrivyWalletsFromUser(privyUser)
    const liveByAddress = new Map<string, any>()
    for (const w of (privyLiveWallets ?? []) as any[]) {
      const addr = typeof w?.address === 'string' ? w.address.toLowerCase() : ''
      if (addr) liveByAddress.set(addr, w)
    }
    const merged: any[] = []
    const seen = new Set<string>()
    for (const w of metadataWallets) {
      const addr = typeof (w as any)?.address === 'string' ? String((w as any).address).toLowerCase() : ''
      if (addr && liveByAddress.has(addr)) {
        merged.push(liveByAddress.get(addr))
        seen.add(addr)
      } else {
        merged.push(w)
        if (addr) seen.add(addr)
      }
    }
    for (const [addr, w] of liveByAddress.entries()) {
      if (!seen.has(addr)) merged.push(w)
    }
    return merged
  }, [privyLiveWallets, privyUser])

  const privyEmbeddedEoaAddressFromUser = useMemo(() => pickPrivyEmbeddedEoaAddressFromUser(privyUser), [privyUser])

  const privyEmbeddedEoaWallet = useMemo(() => {
    const wallets = Array.isArray(privyWallets) ? (privyWallets as any[]) : []
    const fallbackAddresses = new Set(
      [privyEmbeddedEoaAddressFromUser, ensuredEmbeddedEoaAddress, authAddress]
        .filter((value): value is Address => Boolean(value))
        .map((value) => value.toLowerCase()),
    )
    return (
      wallets.find((wallet) => {
        const walletType = normalizePrivyText(
          wallet?.wallet_client_type ?? wallet?.walletClientType ?? wallet?.connector_type ?? wallet?.type ?? '',
        )
        const address = normalizeAddressOrNull(wallet?.address)
        if (!address) return false
        if (canonicalAddress && address.toLowerCase() === canonicalAddress.toLowerCase()) return false
        const isEmbeddedType = walletType === 'privy' || walletType.includes('privy') || walletType.includes('embedded')
        if (isEmbeddedType) return true
        return fallbackAddresses.has(address.toLowerCase())
      }) ?? null
    )
  }, [
    authAddress,
    canonicalAddress,
    ensuredEmbeddedEoaAddress,
    privyEmbeddedEoaAddressFromUser,
    privyWallets,
  ])

  const privyEmbeddedEoaAddressInfo = useMemo(() => {
    const candidates: Array<{ address: Address | null; source: string }> = [
      { address: normalizeAddressOrNull((privyEmbeddedEoaWallet as any)?.address), source: 'wallets' },
      { address: privyEmbeddedEoaAddressFromUser, source: 'privy-user' },
      { address: ensuredEmbeddedEoaAddress, source: 'privy-embedded-hook' },
      { address: normalizeAddressOrNull(authAddress), source: 'session-auth-address' },
    ]
    for (const { address, source } of candidates) {
      if (address && (!canonicalAddress || address.toLowerCase() !== canonicalAddress.toLowerCase())) {
        return { address, source: source as any }
      }
    }
    return { address: null, source: null as any }
  }, [
    authAddress,
    canonicalAddress,
    ensuredEmbeddedEoaAddress,
    privyEmbeddedEoaAddressFromUser,
    privyEmbeddedEoaWallet,
  ])

  const privyEmbeddedEoaAddress = privyEmbeddedEoaAddressInfo.address
  const privyEmbeddedEoaAddressSource = privyEmbeddedEoaAddressInfo.source

  const privyEmbeddedEoaCanSign = useMemo(() => {
    const walletAny: any = privyEmbeddedEoaWallet as any
    if (!walletAny) return false
    if (typeof walletAny?.request === 'function') return true
    if (walletAny?.provider && typeof walletAny.provider.request === 'function') return true
    if (typeof walletAny?.getEthereumProvider === 'function') return true
    return false
  }, [privyEmbeddedEoaWallet])

  const getPrivyEmbeddedEoaProvider = useCallback(async () => {
    const walletAny: any = privyEmbeddedEoaWallet as any
    if (!walletAny) return null
    if (walletAny?.provider && typeof walletAny.provider.request === 'function') return walletAny.provider
    if (typeof walletAny.getEthereumProvider === 'function') {
      const provider = await walletAny.getEthereumProvider().catch(() => null)
      if (provider && typeof provider.request === 'function') return provider
    }
    if (typeof walletAny.request === 'function') {
      return { request: walletAny.request.bind(walletAny) }
    }
    return null
  }, [privyEmbeddedEoaWallet])

  // ── Embedded-wallet hydration recovery ────────────────────────────────
  const { setActiveWallet: setActivePrivyWallet } = useActiveWallet()
  const hydrationRecoveryRef = useRef<{ walletId: unknown; status: 'idle' | 'pending' | 'attempted' }>({
    walletId: null,
    status: 'idle',
  })
  const [hydrationRecoveryBusy, setHydrationRecoveryBusy] = useState(false)

  const recoverEmbeddedWalletProvider = useCallback(async () => {
    const walletAny: any = privyEmbeddedEoaWallet as any
    if (!walletAny) return false
    setHydrationRecoveryBusy(true)
    try {
      if (typeof setActivePrivyWallet === 'function') {
        try {
          await Promise.resolve(setActivePrivyWallet(walletAny as any))
        } catch (err) {
          console.warn('[swap] setActiveWallet on embedded wallet failed:', err)
        }
      }
      if (typeof walletAny.getEthereumProvider === 'function') {
        try {
          await walletAny.getEthereumProvider()
        } catch (err) {
          console.warn('[swap] getEthereumProvider on embedded wallet failed:', err)
          return false
        }
      }
      return true
    } finally {
      setHydrationRecoveryBusy(false)
    }
  }, [privyEmbeddedEoaWallet, setActivePrivyWallet])

  useEffect(() => {
    if (hydrationRecoveryRef.current.walletId !== privyEmbeddedEoaWallet) {
      hydrationRecoveryRef.current = { walletId: privyEmbeddedEoaWallet, status: 'idle' }
    }
    if (!privyEmbeddedEoaWallet) return
    if (privyEmbeddedEoaCanSign) return
    if (hydrationRecoveryRef.current.status !== 'idle') return
    hydrationRecoveryRef.current = { walletId: privyEmbeddedEoaWallet, status: 'pending' }
    void recoverEmbeddedWalletProvider().finally(() => {
      hydrationRecoveryRef.current = { walletId: privyEmbeddedEoaWallet, status: 'attempted' }
    })
  }, [privyEmbeddedEoaCanSign, privyEmbeddedEoaWallet, recoverEmbeddedWalletProvider])

  const embeddedWalletEnsureRef = useRef(false)
  useEffect(() => {
    if (embeddedWalletEnsureRef.current) return
    if (privyAuthenticated !== true) return
    if (privyEmbeddedEoaWallet) return
    if (!privyEmbeddedEoaAddress && !authAddress) return
    embeddedWalletEnsureRef.current = true
    void ensureEmbeddedWallet()
      .catch(() => {
        embeddedWalletEnsureRef.current = false
      })
  }, [authAddress, ensureEmbeddedWallet, privyAuthenticated, privyEmbeddedEoaAddress, privyEmbeddedEoaWallet])

  const refreshEmbeddedSignerSession = useCallback(async () => {
    return refreshPrivyEmbeddedSignerSession({
      wallet: privyEmbeddedEoaWallet,
      setActiveWallet: (wallet) => setActivePrivyWallet(wallet as Parameters<typeof setActivePrivyWallet>[0]),
      logLabel: 'swap',
    })
  }, [privyEmbeddedEoaWallet, setActivePrivyWallet])

  const privyUnifiedWalletId = useMemo(() => {
    if (!privyEmbeddedEoaAddress) return null
    return resolvePrivyUnifiedWalletId({
      wallet: privyEmbeddedEoaWallet,
      user: privyUser,
      address: privyEmbeddedEoaAddress,
    })
  }, [privyEmbeddedEoaAddress, privyEmbeddedEoaWallet, privyUser])

  const usePrivyAuthorizedSecp256k1 = Boolean(privyUnifiedWalletId)

  const signPrivyAuthorizedSecp256k1Digest = useCallback(
    async (digest: Hex) => {
      if (!privyUnifiedWalletId) {
        throw new Error('Privy embedded wallet id is not available for authorized signing.')
      }
      const generateAuthSig = generateAuthorizationSignature as PrivyAuthorizationSignatureGenerator
      return privyAuthorizedWalletSecp256k1Sign({
        walletId: privyUnifiedWalletId,
        hash: digest,
        generateAuthorizationSignature: generateAuthSig,
        refreshSession: refreshEmbeddedSignerSession,
      })
    },
    [generateAuthorizationSignature, privyUnifiedWalletId, refreshEmbeddedSignerSession],
  )

  const privyEmbeddedCanonicalWalletClient = useMemo(() => {
    if (!privyEmbeddedEoaAddress) return null
    return createEmbeddedSignerWalletClient({
      address: privyEmbeddedEoaAddress,
      getProvider: getPrivyEmbeddedEoaProvider,
      refreshSession: refreshEmbeddedSignerSession,
      ensureSignatureHex,
      isRawEcdsaDigest,
      signRawEcdsaDigest,
      signSecp256k1Digest: usePrivyAuthorizedSecp256k1 ? signPrivyAuthorizedSecp256k1Digest : undefined,
    })
  }, [
    getPrivyEmbeddedEoaProvider,
    privyEmbeddedEoaAddress,
    refreshEmbeddedSignerSession,
    signPrivyAuthorizedSecp256k1Digest,
    usePrivyAuthorizedSecp256k1,
  ])

  const manualRecover = useCallback(() => {
    if (!privyEmbeddedEoaWallet || privyEmbeddedEoaCanSign) return
    void recoverEmbeddedWalletProvider()
  }, [privyEmbeddedEoaWallet, privyEmbeddedEoaCanSign, recoverEmbeddedWalletProvider])

  return {
    privyEmbeddedEoaWallet,
    privyEmbeddedEoaAddress,
    privyEmbeddedEoaAddressSource,
    privyEmbeddedEoaCanSign,
    getPrivyEmbeddedEoaProvider,
    privyEmbeddedCanonicalWalletClient,
    hydrationRecoveryBusy,
    manualRecover,
  }
}
