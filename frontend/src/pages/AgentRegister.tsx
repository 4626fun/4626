import { useCallback, useEffect, useMemo, useState } from 'react'
import { useWallets } from '@privy-io/react-auth'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Bot, CheckCircle2, ExternalLink, Loader2, Shield, Sparkles, Zap } from 'lucide-react'
import { encodeFunctionData, getAddress, isAddress, parseAbiItem, parseEventLogs, toHex, type Address, type Hex } from 'viem'
import { base } from 'viem/chains'
import { useAccount, usePublicClient, useSwitchChain, useWalletClient } from 'wagmi'

import { META, PageMeta } from '@/components/seo/PageMeta'
import { resolveCdpPaymasterUrl } from '@/lib/aa/cdp'
import { sendCoinbaseSmartWalletUserOperation } from '@/lib/aa/coinbaseErc4337'
import { apiFetch } from '@/lib/apiBase'
import { signInWithSiwaAgent } from '@/lib/siwaAgentAuth'
import { useZoraProfile } from '@/lib/zora/hooks'

const DEFAULT_ERC8004_IDENTITY_REGISTRY = '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432'

const ERC8004_IDENTITY_REGISTRY_ABI = [
  {
    name: 'register',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'agentURI', type: 'string' }],
    outputs: [{ type: 'uint256' }],
  },
] as const

const ERC8004_REGISTERED_EVENT = parseAbiItem(
  'event Registered(uint256 indexed agentId, string agentURI, address indexed owner)',
)
const COINBASE_SMART_WALLET_OWNER_CHECK_ABI = [
  {
    type: 'function',
    name: 'isOwnerAddress',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const
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
const BASE_CHAIN_ID_HEX = '0x2105'

type ApiEnvelope<T> = { success: boolean; data?: T; error?: string }

type WaitlistMeData = {
  profileId: number
  primaryWallet?: string | null
  cswAddress?: string | null
  primarySmartWallet?: string | null
  baseSubAccount?: string | null
  preprovZoraHandle?: string | null
  farcasterFid?: number | null
  preprovFarcasterUsername?: string | null
  lensHandle?: string | null
  lensAccountAddress?: string | null
  erc8128AgentId?: string | null
  connectedAccounts?: Array<{
    address?: string | null
    walletType?: string | null
    provider?: string | null
    verifiedAt?: string | null
    isCanonicalSmartWallet?: boolean
  }>
}

type AgentData = {
  creatorAddress: string
  xmtpAgentAddress: string
  agentType?: 'eoa' | 'csw'
  cswAddress?: string | null
  listedPublicly: boolean
}

type PublishData = {
  registration: Record<string, unknown>
  groveStatus: 'stored' | 'unavailable' | 'skipped'
  grove?: {
    lensUri: string
    gatewayUrl: string
    storageKey: string
    statusUrl: string | null
  }
}

function isAddressLike(value: unknown): value is `0x${string}` {
  return typeof value === 'string' && /^0x[a-fA-F0-9]{40}$/.test(value.trim())
}

function shortAddress(address: string): string {
  const value = address.trim()
  if (!value) return '—'
  if (value.length < 12) return value
  return `${value.slice(0, 6)}…${value.slice(-4)}`
}

function normalizeHandle(value: string | null | undefined): string | null {
  const raw = typeof value === 'string' ? value.trim() : ''
  if (!raw) return null
  return raw.startsWith('@') ? raw.slice(1) : raw
}

function readErrorMessage(value: unknown, fallback: string): string {
  if (value instanceof Error && value.message.trim()) return value.message.trim()
  if (typeof value === 'string' && value.trim()) return value.trim()
  const maybe = value as any
  if (typeof maybe?.error === 'string' && maybe.error.trim()) return maybe.error.trim()
  if (typeof maybe?.message === 'string' && maybe.message.trim()) return maybe.message.trim()
  return fallback
}

function getReadableError(error: unknown): string {
  const msg = error instanceof Error ? error.message : String(error ?? 'Registration failed.')
  const lower = msg.toLowerCase()
  if (
    lower.includes('user rejected') ||
    lower.includes('rejected the request') ||
    lower.includes('action_rejected') ||
    lower.includes('user denied') ||
    lower.includes('user cancelled')
  ) {
    return 'Transaction cancelled in wallet.'
  }
  if (lower.includes('insufficient funds')) {
    return 'Insufficient funds for gas. Add Base ETH and retry.'
  }
  return msg
}

function isHexString(value: unknown): value is Hex {
  return typeof value === 'string' && /^0x[0-9a-fA-F]+$/.test(value)
}

function ensureSignatureHex(value: unknown, context: string): Hex {
  if (isHexString(value)) return value
  const record = value && typeof value === 'object' ? (value as Record<string, unknown>) : null
  const direct = record?.signature ?? record?.sig
  if (isHexString(direct)) return direct
  const nestedResult = record?.result
  if (nestedResult && typeof nestedResult === 'object') {
    const nestedSig = (nestedResult as Record<string, unknown>).signature
    if (isHexString(nestedSig)) return nestedSig
  }
  throw new Error(`Invalid signature returned from ${context}`)
}

function isRecoverableUserOpError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error ?? '')
  const lower = msg.toLowerCase()
  return (
    lower.includes('userop signature verification failed') ||
    lower.includes('invalid signature') ||
    lower.includes('signature check failed') ||
    lower.includes('paymaster rejected this request') ||
    lower.includes('requested resource not available') ||
    lower.includes('resource not available') ||
    lower.includes('paymaster unavailable') ||
    lower.includes('sponsorship')
  )
}

function isUserRejectedError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error ?? '')
  const lower = msg.toLowerCase()
  return (
    lower.includes('user rejected') ||
    lower.includes('user denied') ||
    lower.includes('user cancelled') ||
    lower.includes('rejected by user') ||
    lower.includes('action_rejected')
  )
}

function isSupportedAgentUriScheme(value: string): boolean {
  const uri = value.trim().toLowerCase()
  return (
    uri.startsWith('https://') ||
    uri.startsWith('http://') ||
    uri.startsWith('ipfs://') ||
    uri.startsWith('ar://') ||
    uri.startsWith('data:')
  )
}

export function AgentRegister() {
  const [agentUri, setAgentUri] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [txHash, setTxHash] = useState<Hex | null>(null)
  const [registeredAgentId, setRegisteredAgentId] = useState<string | null>(null)
  const [siwaAgentIdInput, setSiwaAgentIdInput] = useState('')
  const [siwaStatus, setSiwaStatus] = useState<string | null>(null)
  const [siwaError, setSiwaError] = useState<string | null>(null)
  const [stackStatus, setStackStatus] = useState<string | null>(null)
  const [stackError, setStackError] = useState<string | null>(null)
  const [publishData, setPublishData] = useState<PublishData | null>(null)

  const { address: connectedAddress, chainId, isConnected, connector } = useAccount()
  const { data: walletClient } = useWalletClient()
  const { wallets: privyWallets } = useWallets()
  const basePublicClient = usePublicClient({ chainId: base.id })
  const fallbackPublicClient = usePublicClient()
  const publicClient = basePublicClient ?? fallbackPublicClient
  const { switchChainAsync } = useSwitchChain()

  const registryAddress = useMemo(() => {
    const fromEnv = String(import.meta.env.VITE_ERC8004_AGENT_REGISTRY ?? '').trim()
    return getAddress((fromEnv || DEFAULT_ERC8004_IDENTITY_REGISTRY) as Address)
  }, [])

  const canUseConnectedWallet = Boolean(!busy && isConnected && connectedAddress && walletClient && publicClient)
  const connectedAddressLc = String(connectedAddress ?? '').trim().toLowerCase() || null

  const ensureBaseChain = useCallback(async () => {
    if (chainId === base.id) return
    if (!switchChainAsync) throw new Error('Switch to Base in your wallet to continue.')
    await switchChainAsync({ chainId: base.id })
  }, [chainId, switchChainAsync])

  const waitlistMeQuery = useQuery({
    queryKey: ['agent-register', 'waitlist-me'],
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

  const zoraCanonicalSeedIdentifier = useMemo(() => {
    const row = waitlistMeQuery.data
    const fromHandle = normalizeHandle(row?.preprovZoraHandle)
    if (fromHandle) return fromHandle
    if (isAddressLike(row?.primaryWallet)) return row.primaryWallet
    return undefined
  }, [waitlistMeQuery.data])
  const zoraCanonicalSeedQuery = useZoraProfile(zoraCanonicalSeedIdentifier)
  const zoraCanonicalSeedProfile = zoraCanonicalSeedQuery.data ?? null

  const canonicalSmartWalletAddress = useMemo(() => {
    const row = waitlistMeQuery.data
    if (!row) return null
    const connectedSmartWallets = (row.connectedAccounts ?? [])
      .filter((item) => isAddressLike(item?.address) && String(item?.walletType ?? '').toLowerCase() === 'smart_wallet')
      .map((item) => String(item.address).toLowerCase())
    const connectedSmartWalletSet = new Set(connectedSmartWallets)
    const zoraCandidates = [
      zoraCanonicalSeedProfile?.publicWallet?.walletAddress,
      ...((zoraCanonicalSeedProfile?.linkedWallets?.edges ?? []).map((edge) => edge?.node?.walletAddress ?? null)),
    ]
    for (const candidate of zoraCandidates) {
      if (!isAddressLike(candidate)) continue
      if (connectedSmartWalletSet.has(candidate.toLowerCase())) return candidate.toLowerCase()
    }
    const canonicalFromAccounts = (row.connectedAccounts ?? [])
      .filter((item) => item?.isCanonicalSmartWallet && isAddressLike(item?.address))
      .sort((a, b) => {
        const aProvider = String(a.provider ?? '').toLowerCase()
        const bProvider = String(b.provider ?? '').toLowerCase()
        // Prefer non-Privy canonical CSWs when multiple records are marked canonical.
        if (aProvider.includes('privy') !== bProvider.includes('privy')) {
          return aProvider.includes('privy') ? 1 : -1
        }
        const aMs = Date.parse(String(a.verifiedAt ?? ''))
        const bMs = Date.parse(String(b.verifiedAt ?? ''))
        if (Number.isFinite(aMs) && Number.isFinite(bMs)) return bMs - aMs
        if (Number.isFinite(aMs)) return -1
        if (Number.isFinite(bMs)) return 1
        return String(a.address ?? '').localeCompare(String(b.address ?? ''))
      })[0]
    const candidates: Array<string | null | undefined> = [
      canonicalFromAccounts?.address,
      row?.cswAddress,
      row?.primarySmartWallet,
      row?.baseSubAccount,
    ]
    for (const value of candidates) {
      if (!isAddressLike(value)) continue
      return value.toLowerCase()
    }
    return null
  }, [waitlistMeQuery.data, zoraCanonicalSeedProfile])
  const isConnectedCanonicalCsw = Boolean(canonicalSmartWalletAddress && connectedAddressLc === canonicalSmartWalletAddress)
  const privyEmbeddedEoaWallet = useMemo(() => {
    const wallets = Array.isArray(privyWallets) ? (privyWallets as any[]) : []
    return (
      wallets.find((wallet) => {
        const walletType = String(
          wallet?.wallet_client_type ?? wallet?.walletClientType ?? wallet?.connector_type ?? wallet?.type ?? '',
        )
          .trim()
          .toLowerCase()
        if (!(walletType === 'privy' || walletType.includes('privy') || walletType.includes('embedded'))) return false
        const rawAddress = typeof wallet?.address === 'string' ? String(wallet.address).trim() : ''
        if (!rawAddress || !isAddress(rawAddress)) return false
        if (canonicalSmartWalletAddress && rawAddress.toLowerCase() === canonicalSmartWalletAddress.toLowerCase()) return false
        return true
      }) ?? null
    )
  }, [canonicalSmartWalletAddress, privyWallets])
  const privyEmbeddedEoaAddress = useMemo(() => {
    const rawAddress = typeof (privyEmbeddedEoaWallet as any)?.address === 'string'
      ? String((privyEmbeddedEoaWallet as any).address).trim()
      : ''
    if (!rawAddress || !isAddress(rawAddress)) return null
    return getAddress(rawAddress as Address)
  }, [privyEmbeddedEoaWallet])
  const privyEmbeddedEoaCanSign = useMemo(() => {
    const walletAny: any = privyEmbeddedEoaWallet as any
    if (!walletAny) return false
    if (typeof walletAny?.request === 'function') return true
    if (walletAny?.provider && typeof walletAny.provider.request === 'function') return true
    if (typeof walletAny?.getEthereumProvider === 'function') return true
    if (typeof walletAny?.signMessage === 'function') return true
    return false
  }, [privyEmbeddedEoaWallet])
  const ensureProviderOnBase = useCallback(async (provider: any, label: string) => {
    if (!provider?.request) return
    const current = await provider.request({ method: 'eth_chainId' }).catch(() => null)
    if (typeof current === 'string' && current.toLowerCase() !== BASE_CHAIN_ID_HEX) {
      try {
        await provider.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: BASE_CHAIN_ID_HEX }],
        })
      } catch {
        throw new Error(`Please switch ${label} to Base network to continue.`)
      }
    }
  }, [])
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
  const connectedWalletCanOperateCanonicalQuery = useQuery({
    queryKey: ['agent-register', 'can-operate-canonical', canonicalSmartWalletAddress, connectedAddressLc],
    enabled: Boolean(canonicalSmartWalletAddress && connectedAddressLc && publicClient),
    staleTime: 10_000,
    queryFn: async () => {
      if (!canonicalSmartWalletAddress || !connectedAddressLc || !publicClient) return false
      if (connectedAddressLc === canonicalSmartWalletAddress) return true
      try {
        const isOwner = (await publicClient.readContract({
          address: canonicalSmartWalletAddress as Address,
          abi: COINBASE_SMART_WALLET_OWNER_CHECK_ABI,
          functionName: 'isOwnerAddress',
          args: [connectedAddressLc as Address],
        })) as boolean
        return isOwner === true
      } catch {
        return false
      }
    },
  })
  const privyEmbeddedEoaCanOperateCanonicalQuery = useQuery({
    queryKey: ['agent-register', 'privy-embedded-can-operate-canonical', canonicalSmartWalletAddress, privyEmbeddedEoaAddress],
    enabled: Boolean(canonicalSmartWalletAddress && privyEmbeddedEoaAddress && publicClient),
    staleTime: 10_000,
    queryFn: async () => {
      if (!canonicalSmartWalletAddress || !privyEmbeddedEoaAddress || !publicClient) return false
      try {
        const isOwner = (await publicClient.readContract({
          address: canonicalSmartWalletAddress as Address,
          abi: COINBASE_SMART_WALLET_OWNER_CHECK_ABI,
          functionName: 'isOwnerAddress',
          args: [privyEmbeddedEoaAddress as Address],
        })) as boolean
        return isOwner === true
      } catch {
        return false
      }
    },
  })
  const canOperateCanonicalCsw =
    isConnectedCanonicalCsw ||
    connectedWalletCanOperateCanonicalQuery.data === true ||
    privyEmbeddedEoaCanOperateCanonicalQuery.data === true
  const canSubmit = Boolean(canUseConnectedWallet && canOperateCanonicalCsw && agentUri.trim())

  const creatorAddressForAgentLookup = canonicalSmartWalletAddress ?? connectedAddressLc

  const agentQuery = useQuery({
    queryKey: ['agent-register', 'xmtp-agent', creatorAddressForAgentLookup],
    queryFn: async (): Promise<AgentData | null> => {
      if (!creatorAddressForAgentLookup) return null
      const params = new URLSearchParams({
        listed: 'false',
        limit: '1',
        creatorAddress: creatorAddressForAgentLookup,
      })
      const res = await apiFetch(`/api/v1/agents/creators?${params.toString()}`)
      const json = (await res.json().catch(() => null)) as ApiEnvelope<{ agents: AgentData[] }> | null
      if (!res.ok || !json?.success || !json.data) return null
      const target = creatorAddressForAgentLookup.toLowerCase()
      const match = json.data.agents.find((item) => {
        const creator = String(item.creatorAddress ?? '').toLowerCase()
        const csw = String(item.cswAddress ?? '').toLowerCase()
        return creator === target || (csw && csw === target)
      })
      return match ?? null
    },
    enabled: Boolean(creatorAddressForAgentLookup),
    staleTime: 15_000,
  })

  const publishMutation = useMutation({
    mutationFn: async (): Promise<PublishData> => {
      const res = await apiFetch('/api/v1/agents/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ storeOnGrove: true }),
      })
      const json = (await res.json().catch(() => null)) as ApiEnvelope<PublishData> | null
      if (!res.ok || !json?.success || !json.data) {
        throw new Error(readErrorMessage(json?.error, 'Failed to publish agent registration to Lens Grove'))
      }
      return json.data
    },
    onSuccess: (data) => {
      setPublishData(data)
      if (data.grove?.gatewayUrl) {
        setAgentUri(data.grove.gatewayUrl)
      }
      if (data.grove?.lensUri) {
        setStackStatus(`Published to Lens Grove: ${data.grove.lensUri}`)
      } else {
        setStackStatus('Registration generated, but Lens Grove storage is unavailable right now.')
      }
      setStackError(null)
    },
    onError: (e) => {
      setStackError(getReadableError(e))
      setStackStatus(null)
    },
  })

  const siwaMutation = useMutation({
    mutationFn: async (): Promise<string> => {
      if (!walletClient || !connectedAddress) {
        throw new Error('Connect a wallet to create a SIWA receipt.')
      }
      const rawAgentId = (siwaAgentIdInput.trim() || registeredAgentId || '').trim()
      const agentId = Number(rawAgentId)
      if (!Number.isFinite(agentId) || Math.floor(agentId) !== agentId || agentId < 0) {
        throw new Error('Provide a valid ERC-8004 agent ID first.')
      }
      await ensureBaseChain()
      const result = await signInWithSiwaAgent({
        agentId,
        ownerAddress: canonicalSmartWalletAddress ?? undefined,
        signMessage: async (message: string) =>
          walletClient.signMessage({
            account: getAddress(connectedAddress as Address),
            message,
          }),
      })
      return `SIWA active (${result.verified}) until ${new Date(result.receiptExpiresAt).toLocaleString()}.`
    },
    onSuccess: (message) => {
      setSiwaStatus(message)
      setSiwaError(null)
    },
    onError: (e) => {
      setSiwaError(getReadableError(e))
      setSiwaStatus(null)
    },
  })

  const onRegister = useCallback(async () => {
    if (!canSubmit) return
    if (!connectedAddress || !walletClient || !publicClient) return
    if (!canonicalSmartWalletAddress) {
      setError('No canonical Zora Coinbase Smart Wallet found. Connect/sync your canonical CSW first.')
      return
    }
    if (!canOperateCanonicalCsw) {
      setError(
        `Connect your canonical Zora CSW (${canonicalSmartWalletAddress}) or an owner wallet of that CSW before registering.`,
      )
      return
    }
    const uri = agentUri.trim()
    if (!uri) return
    if (!isSupportedAgentUriScheme(uri)) {
      setError('Agent URI must use https://, http://, ipfs://, ar://, or data:. If using Grove, use gatewayUrl (not lens://).')
      return
    }

    setBusy(true)
    setError(null)
    setSuccess(null)
    setTxHash(null)
    setRegisteredAgentId(null)
    try {
      await ensureBaseChain()
      const account = getAddress(connectedAddress as Address)
      const canonicalCsw = getAddress(canonicalSmartWalletAddress as Address)

      let tx: Hex
      if (account.toLowerCase() === canonicalCsw.toLowerCase()) {
        const sim = await publicClient.simulateContract({
          account,
          address: registryAddress,
          abi: ERC8004_IDENTITY_REGISTRY_ABI,
          functionName: 'register',
          args: [uri],
        })
        const hashRaw = await walletClient.writeContract(sim.request)
        tx = String(hashRaw ?? '').trim() as Hex
      } else {
        const registerCallData = encodeFunctionData({
          abi: ERC8004_IDENTITY_REGISTRY_ABI,
          functionName: 'register',
          args: [uri],
        })
        const paymasterEnv = import.meta.env.VITE_CDP_PAYMASTER_URL as string | undefined
        const bundlerUrl = resolveCdpPaymasterUrl(paymasterEnv) || '/api/paymaster'
        const sendViaUserOp = async (args: {
          walletClientLike: any
          ownerAddress: Address
          userOpSignMode?: 'auto' | 'eth_sign' | 'signMessage'
          ownerIsContract?: boolean
          allowEoaSignMessageFallback?: boolean
          retryWithLowGasContractSigner?: boolean
        }): Promise<Hex> => {
          const result = await sendCoinbaseSmartWalletUserOperation({
            publicClient: publicClient as any,
            walletClient: args.walletClientLike as any,
            bundlerUrl,
            smartWallet: canonicalCsw,
            ownerAddress: args.ownerAddress,
            calls: [{ to: registryAddress, value: 0n, data: registerCallData }],
            version: '1',
            ...(args.userOpSignMode ? { userOpSignMode: args.userOpSignMode } : {}),
            ...(typeof args.ownerIsContract === 'boolean' ? { ownerIsContract: args.ownerIsContract } : {}),
            ...(typeof args.allowEoaSignMessageFallback === 'boolean'
              ? { allowEoaSignMessageFallback: args.allowEoaSignMessageFallback }
              : {}),
            ...(typeof args.retryWithLowGasContractSigner === 'boolean'
              ? { retryWithLowGasContractSigner: args.retryWithLowGasContractSigner }
              : {}),
          })
          return result.transactionHash
        }
        const sendDirectOwnerFallback = async (): Promise<Hex> => {
          const executeBatchData = encodeFunctionData({
            abi: COINBASE_SMART_WALLET_EXECUTE_BATCH_ABI as any,
            functionName: 'executeBatch',
            args: [
              [
                {
                  target: registryAddress,
                  value: 0n,
                  data: registerCallData,
                },
              ],
            ],
          })
          const walletAny = walletClient as any
          const txHashRaw =
            typeof walletAny?.sendTransaction === 'function'
              ? await walletAny.sendTransaction({
                  account,
                  chain: base as any,
                  to: canonicalCsw,
                  value: 0n,
                  data: executeBatchData,
                })
              : await walletAny.request({
                  method: 'eth_sendTransaction',
                  params: [
                    {
                      from: account,
                      to: canonicalCsw,
                      data: executeBatchData,
                      value: '0x0',
                    },
                  ],
                })
          const txHash = String(txHashRaw ?? '').trim()
          if (!/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
            throw new Error('Owner direct fallback returned an invalid transaction hash.')
          }
          return txHash as Hex
        }

        let sentTx: Hex | null = null
        if (privyEmbeddedEoaCanSign && privyEmbeddedEoaAddress && privyEmbeddedEoaCanOperateCanonicalQuery.data === true) {
          const embeddedProvider = await getPrivyEmbeddedEoaProvider()
          if (embeddedProvider?.request) {
            try {
              await ensureProviderOnBase(embeddedProvider, 'Privy embedded EOA')
              const embeddedWalletClientAdapter = {
                request: async (args: { method: string; params?: any[] }) => {
                  if (args?.method === 'eth_sign') {
                    const params = Array.isArray(args.params) ? args.params : []
                    const hashCandidate = typeof params[1] === 'string' ? params[1] : ''
                    if (/^0x[0-9a-fA-F]{64}$/.test(hashCandidate)) {
                      try {
                        const rawSig = await embeddedProvider.request({
                          method: 'secp256k1_sign',
                          params: [hashCandidate],
                        })
                        return ensureSignatureHex(rawSig, 'privyEmbeddedEoa.secp256k1_sign')
                      } catch {
                        // Fall through to provider eth_sign if secp256k1_sign is unavailable.
                      }
                    }
                  }
                  return await embeddedProvider.request(args as any)
                },
                signMessage: async (args: { message: unknown }) => {
                  const raw =
                    typeof args?.message === 'object' && args.message !== null && 'raw' in (args.message as Record<string, unknown>)
                      ? (args.message as Record<string, unknown>).raw
                      : args?.message
                  const msgHex = typeof raw === 'string' && raw.startsWith('0x') ? raw : toHex(String(raw ?? ''))
                  const rawSig = await embeddedProvider.request({
                    method: 'personal_sign',
                    params: [msgHex, privyEmbeddedEoaAddress],
                  })
                  return ensureSignatureHex(rawSig, 'privyEmbeddedEoa.personal_sign')
                },
                signTypedData: async (typedData: unknown) => {
                  const rawSig = await embeddedProvider.request({
                    method: 'eth_signTypedData_v4',
                    params: [privyEmbeddedEoaAddress, JSON.stringify(typedData)],
                  })
                  return ensureSignatureHex(rawSig, 'privyEmbeddedEoa.signTypedData')
                },
              }
              sentTx = await sendViaUserOp({
                walletClientLike: embeddedWalletClientAdapter,
                ownerAddress: getAddress(privyEmbeddedEoaAddress as Address),
                userOpSignMode: 'eth_sign',
                ownerIsContract: false,
                allowEoaSignMessageFallback: false,
                retryWithLowGasContractSigner: false,
              })
            } catch {
              // Fall back to connected owner signer path.
            }
          }
        }
        if (!sentTx) {
          try {
            sentTx = await sendViaUserOp({
              walletClientLike: walletClient as any,
              ownerAddress: account,
            })
          } catch (aaError) {
            if (isUserRejectedError(aaError)) throw aaError
            try {
              sentTx = await sendDirectOwnerFallback()
            } catch (fallbackError) {
              if (!isRecoverableUserOpError(aaError)) throw aaError
              const aaMessage = getReadableError(aaError)
              const fallbackMessage = getReadableError(fallbackError)
              throw new Error(
                `UserOperation failed (${aaMessage}) and owner fallback failed (${fallbackMessage}).`,
              )
            }
          }
        }
        tx = sentTx
      }

      if (!/^0x[a-fA-F0-9]{64}$/.test(tx)) throw new Error('Invalid tx hash returned from wallet.')

      setTxHash(tx)
      const receipt = await publicClient.waitForTransactionReceipt({ hash: tx })
      const parsed = parseEventLogs({
        abi: [ERC8004_REGISTERED_EVENT],
        logs: receipt.logs,
        eventName: 'Registered',
        strict: false,
      })
      const first = parsed[0] as any
      const agentIdRaw = first?.args?.agentId
      const agentId = typeof agentIdRaw === 'bigint' ? agentIdRaw.toString() : null
      setRegisteredAgentId(agentId)
      if (agentId) {
        setSiwaAgentIdInput((prev) => (prev.trim() ? prev : agentId))
      }

      setSuccess(agentId ? `Agent registered successfully (ID #${agentId}).` : 'Agent registered successfully.')
    } catch (e) {
      setError(getReadableError(e))
    } finally {
      setBusy(false)
    }
  }, [
    agentUri,
    canSubmit,
    canonicalSmartWalletAddress,
    canOperateCanonicalCsw,
    connectedAddress,
    ensureBaseChain,
    ensureProviderOnBase,
    getPrivyEmbeddedEoaProvider,
    publicClient,
    privyEmbeddedEoaAddress,
    privyEmbeddedEoaCanOperateCanonicalQuery.data,
    privyEmbeddedEoaCanSign,
    registryAddress,
    walletClient,
  ])

  useEffect(() => {
    if (!registeredAgentId) return
    setSiwaAgentIdInput((prev) => (prev.trim() ? prev : registeredAgentId))
  }, [registeredAgentId])

  const xmtpAgentAddress = useMemo(() => {
    const row = agentQuery.data
    if (!row) return null
    // In CSW mode, XMTP should resolve to the canonical CSW identity.
    if (row.agentType === 'csw' && canonicalSmartWalletAddress) return canonicalSmartWalletAddress
    if (isAddressLike(row.xmtpAgentAddress)) return row.xmtpAgentAddress.toLowerCase()
    return null
  }, [agentQuery.data, canonicalSmartWalletAddress])
  const hasXmtpAgent = Boolean(xmtpAgentAddress)
  const hasLensProfile = Boolean(waitlistMeQuery.data?.lensHandle || waitlistMeQuery.data?.lensAccountAddress)
  const farcasterFid =
    typeof waitlistMeQuery.data?.farcasterFid === 'number' && waitlistMeQuery.data.farcasterFid > 0
      ? waitlistMeQuery.data.farcasterFid
      : null
  const farcasterUsername = String(waitlistMeQuery.data?.preprovFarcasterUsername ?? '').trim() || null
  const hasFarcasterIdentity = Boolean(farcasterFid || farcasterUsername)
  const hasGroveRegistration = Boolean(publishData?.grove?.lensUri)
  const hasErc8128AgentId = Boolean(waitlistMeQuery.data?.erc8128AgentId?.trim())
  const hasSiwaReceipt = Boolean(siwaStatus)
  const eip7702Ready = useMemo(() => {
    const id = String(connector?.id ?? '').trim().toLowerCase()
    return id === 'coinbasewalletsdk'
  }, [connector?.id])

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
      <PageMeta
        title={META.agentRegister.title}
        description={META.agentRegister.description}
        canonicalPath="/agents/register"
      />

      <div className="mb-8 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-primary/10 flex items-center justify-center">
            <Bot className="w-5 h-5 text-brand-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-zinc-100 tracking-tight">Register Agent</h1>
            <p className="text-sm text-zinc-500 mt-0.5">ERC-8004 registration plus SIWA, XMTP, Lens/Grove, 8128, and 7702 readiness.</p>
          </div>
        </div>
        <Link
          to="/agents"
          className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-3 py-2 text-xs text-zinc-300 hover:text-zinc-100"
        >
          Back to Agents
        </Link>
      </div>

      <div className="space-y-4 rounded-2xl border border-white/5 bg-white/2 p-5">
        <div className="flex items-start gap-3 text-xs text-zinc-400">
          <Sparkles className="mt-0.5 h-4 w-4 text-brand-primary/80" />
          <div>
            Use an agent URI from your hosted metadata endpoint, IPFS, Arweave, or data URI.
            <div className="mt-1">
              Need help generating one?{' '}
              <Link to="/agents/uri-service" className="text-brand-primary hover:underline">
                Open Agent URI Service
              </Link>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-white/5 bg-black/20 px-3 py-2 text-[11px] text-zinc-500">
          Registry: <span className="font-mono text-zinc-300">{registryAddress}</span> (Base)
        </div>
        {!canOperateCanonicalCsw ? (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-200">
            Registration is locked to your canonical Zora CSW so the agent owner is your existing smart wallet.
            {canonicalSmartWalletAddress ? (
              <>
                {' '}Expected wallet: <span className="font-mono">{canonicalSmartWalletAddress}</span>.
              </>
            ) : (
              <> Connect/sync your canonical CSW first.</>
            )}
          </div>
        ) : null}

        <div className="space-y-2">
          <label htmlFor="agent-uri" className="text-xs uppercase tracking-[0.14em] text-zinc-500">
            Agent URI
          </label>
          <textarea
            id="agent-uri"
            value={agentUri}
            onChange={(e) => setAgentUri(e.target.value)}
            rows={6}
            placeholder="https://... or ipfs://... or ar://..."
            className="w-full rounded-lg border border-zinc-800 bg-zinc-950/70 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-brand-primary"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void onRegister()}
              disabled={!canSubmit}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-primary/15 px-3 py-2 text-sm font-medium text-brand-primary hover:bg-brand-primary/20 disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {busy ? 'Registering…' : 'Register Agent'}
            </button>
          {isConnected && !canOperateCanonicalCsw ? (
            <span className="text-xs text-amber-300">Connect your canonical CSW or one of its owner wallets to register.</span>
          ) : null}
          {isConnected && canOperateCanonicalCsw && !isConnectedCanonicalCsw ? (
            <span className="text-xs text-emerald-300">Owner wallet detected. Registration will execute via your canonical CSW.</span>
          ) : null}
        </div>

        {error ? <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</div> : null}

        {success ? (
          <div className="space-y-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
            <div className="inline-flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              <span>{success}</span>
            </div>
            {txHash ? (
              <a
                href={`https://basescan.org/tx/${txHash}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-emerald-100 hover:underline"
              >
                View transaction
                <ExternalLink className="h-3 w-3" />
              </a>
            ) : null}
            {registeredAgentId ? <div className="text-xs text-emerald-100/80">Registered Agent ID: #{registeredAgentId}</div> : null}
          </div>
        ) : null}
      </div>

      <div className="mt-5 space-y-4 rounded-2xl border border-white/5 bg-white/2 p-5">
        <div className="flex items-start gap-3 text-xs text-zinc-400">
          <Shield className="mt-0.5 h-4 w-4 text-brand-primary/80" />
          <div>
            This page now tracks the full agent stack currently shipped in this app and exposes the key follow-up actions.
          </div>
        </div>

        <div className="grid gap-2 text-xs text-zinc-300 sm:grid-cols-2">
          <div className="rounded-lg border border-white/8 bg-black/20 px-3 py-2">
            <div className="text-zinc-400">Canonical CSW</div>
            <div className="font-mono text-zinc-200">{canonicalSmartWalletAddress ? shortAddress(canonicalSmartWalletAddress) : 'Not detected'}</div>
          </div>
          <div className="rounded-lg border border-white/8 bg-black/20 px-3 py-2">
            <div className="text-zinc-400">XMTP Agent</div>
            <div className="font-mono text-zinc-200">{xmtpAgentAddress ? shortAddress(xmtpAgentAddress) : 'Not enabled yet'}</div>
          </div>
        </div>

        <div className="space-y-2 rounded-lg border border-white/8 bg-black/20 p-3 text-xs">
          <div className="flex items-center justify-between gap-3">
            <span className="text-zinc-200">ERC-8004 identity</span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] ${registeredAgentId ? 'bg-emerald-500/15 text-emerald-300' : 'bg-zinc-700/60 text-zinc-300'}`}>
              {registeredAgentId ? `Active (#${registeredAgentId})` : 'Pending'}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-zinc-200">XMTP messaging</span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] ${hasXmtpAgent ? 'bg-emerald-500/15 text-emerald-300' : 'bg-zinc-700/60 text-zinc-300'}`}>
              {hasXmtpAgent ? 'Enabled' : 'Pending'}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-zinc-200">Lens profile</span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] ${hasLensProfile ? 'bg-emerald-500/15 text-emerald-300' : 'bg-zinc-700/60 text-zinc-300'}`}>
              {hasLensProfile ? `Connected${waitlistMeQuery.data?.lensHandle ? ` (@${waitlistMeQuery.data.lensHandle})` : ''}` : 'Pending'}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-zinc-200">Farcaster identity</span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] ${hasFarcasterIdentity ? 'bg-emerald-500/15 text-emerald-300' : 'bg-zinc-700/60 text-zinc-300'}`}>
              {hasFarcasterIdentity
                ? `${farcasterUsername ? `@${farcasterUsername}` : ''}${farcasterFid ? `${farcasterUsername ? ' · ' : ''}FID ${farcasterFid}` : ''}`
                : 'Not linked'}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-zinc-200">Grove registration URI</span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] ${hasGroveRegistration ? 'bg-emerald-500/15 text-emerald-300' : 'bg-zinc-700/60 text-zinc-300'}`}>
              {hasGroveRegistration ? 'Published' : 'Pending'}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-zinc-200">ERC-8128 agent reference</span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] ${hasErc8128AgentId ? 'bg-emerald-500/15 text-emerald-300' : 'bg-zinc-700/60 text-zinc-300'}`}>
              {hasErc8128AgentId ? waitlistMeQuery.data?.erc8128AgentId : 'Not linked'}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-zinc-200">EIP-7702 execution readiness</span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] ${eip7702Ready ? 'bg-emerald-500/15 text-emerald-300' : 'bg-zinc-700/60 text-zinc-300'}`}>
              {eip7702Ready ? 'Ready (Coinbase wallet_sendCalls path)' : 'Wallet capability unknown'}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-zinc-200">SIWA receipt</span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] ${hasSiwaReceipt ? 'bg-emerald-500/15 text-emerald-300' : 'bg-zinc-700/60 text-zinc-300'}`}>
              {hasSiwaReceipt ? 'Active' : 'Not issued'}
            </span>
          </div>
        </div>

        <div className="space-y-3 rounded-lg border border-white/8 bg-black/20 p-3">
          <div className="text-xs uppercase tracking-[0.14em] text-zinc-500">Stack Actions</div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => publishMutation.mutate()}
              disabled={!isConnected || publishMutation.isPending}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-primary/15 px-3 py-2 text-xs font-medium text-brand-primary hover:bg-brand-primary/20 disabled:opacity-50"
            >
              {publishMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
              Publish to Lens Grove
            </button>
            <Link
              to="/admin/agent-setup"
              className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-3 py-2 text-xs text-zinc-300 hover:text-zinc-100"
            >
              Open XMTP + vault setup
            </Link>
          </div>

          <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
            <input
              value={siwaAgentIdInput}
              onChange={(e) => setSiwaAgentIdInput(e.target.value)}
              placeholder="Agent ID for SIWA (e.g. 2205)"
              className="w-full rounded-lg border border-zinc-800 bg-zinc-950/70 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-brand-primary"
            />
            <button
              type="button"
              onClick={() => siwaMutation.mutate()}
              disabled={!isConnected || siwaMutation.isPending}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs text-zinc-200 hover:text-white disabled:opacity-50"
            >
              {siwaMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
              Issue SIWA Receipt
            </button>
          </div>
          <div className="text-[11px] text-zinc-500">
            SIWA enables authenticated agent API calls. Use the same canonical owner context as your ERC-8004 identity.
          </div>
        </div>

        {stackError ? <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">{stackError}</div> : null}
        {stackStatus ? <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">{stackStatus}</div> : null}
        {siwaError ? <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">{siwaError}</div> : null}
        {siwaStatus ? <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">{siwaStatus}</div> : null}

        {publishData?.grove?.gatewayUrl ? (
          <a
            href={publishData.grove.gatewayUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs text-zinc-300 hover:text-zinc-100 hover:underline"
          >
            View Lens Grove gateway payload
            <ExternalLink className="h-3 w-3" />
          </a>
        ) : null}

        <div className="text-[11px] text-zinc-500">
          Note: ERC-8128 and EIP-7702 are surfaced as readiness/status checks from current app state and wallet capability.
        </div>
      </div>
    </div>
  )
}
