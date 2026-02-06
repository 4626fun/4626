import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Copy, ExternalLink, ShieldCheck } from 'lucide-react'
import { useAccount, useBlockNumber, useChainId, usePublicClient, useReadContract, useSwitchChain, useWalletClient } from 'wagmi'
import { base } from 'wagmi/chains'
import {
  decodeEventLog,
  encodeFunctionData,
  erc20Abi,
  formatUnits,
  getAddress,
  isAddress,
  parseAbiItem,
  parseUnits,
  type Address,
  type Hex,
} from 'viem'
import { usePrivy, useWallets } from '@privy-io/react-auth'
import { useSmartWallets } from '@privy-io/react-auth/smart-wallets'

import { useMiniAppContext } from '@/hooks'
import { useSiweAuth } from '@/hooks/useSiweAuth'
import { ConnectButton } from '@/components/ConnectButton'
import { CONTRACTS } from '@/config/contracts'
import { resolveCdpPaymasterUrl } from '@/lib/aa/cdp'
import { sendCoinbaseSmartWalletUserOperation } from '@/lib/aa/coinbaseErc4337'

type SignManifestResult = { header: string; payload: string; signature: string }

const DEFAULT_DOMAIN = '4626.fun'
const MAX_DOMAIN_LEN = 255
const CANONICAL_SMART_WALLET = '0xAb6d5C10b03300326CD7fAb7267Ae192842967b5'
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'
const ERC8004_IDENTITY_REGISTRY = '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432'
const ERC8004_AGENT_URI_DEFAULT = 'https://4626.fun/.well-known/agent-registration.json'

type LegacyVaultHint = {
  id: string
  label: string
  vault?: string
  wrapper?: string
  shareOft?: string
  vesting?: string
  vaultHint?: string
}

type LegacyVaultResolved = {
  id: string
  label: string
  vault: string
  wrapper: string
  shareOft: string
  vesting: string
  vaultHint?: string
  resolvedFrom: 'static' | 'registry' | 'unknown'
}

const LEGACY_VAULT_HINTS: LegacyVaultHint[] = [
  {
    id: 'legacy-1',
    label: 'Legacy ShareOFT (0x5f65…)',
    shareOft: '0x5F65ADef2F587AA228a1F37e9FAD0370defe4626',
    wrapper: '0x349fFADbF1ea15f72608cF9EC6a776D985fD7DeC',
    vault: '0x51E8Eaa4366C83b012F19Df44e6Fa3A8ac5d699e',
    vesting: '0xf98a12a31c677788025a7a141ee050c2e3f861c6',
  },
  {
    id: 'legacy-2',
    label: 'Legacy ShareOFT (0x25f6…)',
    shareOft: '0x25f61d3F2CAaF96974e7ea5A8b499b0617b94626',
    wrapper: '0xcd66e39a575495164680a3583ffc5cfa81cb971e',
    vault: '0x62f30a8815C1EBF8639d554f17E4200832F0Ba77',
    vesting: '0x35f40efa13748560715af00af8abc221bab2fe07',
  },
  {
    id: 'legacy-3',
    label: 'Legacy vault (0x2648…2D75)',
    vault: '0x264855c322db4224ddb3aa84f1d64392d7537cb6',
    wrapper: '0x772f102B8747C70aFDd1A616bBa22a6C8286A026',
    shareOft: '0xbbBA5b9c70D2edEf732f1DeA19Cca0e36789e69d',
    vaultHint: '0x264855c3...2D7537CB6',
  },
  {
    id: 'legacy-4',
    label: 'Legacy vault (0xcF30…91d0)',
    vault: '0xcf30b1e8c682a2adcede2b22601b75f54ed91d0c',
    wrapper: '0xE7675FA61c4431194481F3Fb31d1e4a73177eE6C',
    shareOft: '0x7DDe0A769Aeda835fC441f66B271678661dD4626',
    vesting: '0xE40c781BaCE1282D1B721FBa2Ff86B6F8fe94Ad9',
    vaultHint: '0xcF30B1e8...54ED91d0C',
  },
  {
    id: 'legacy-5',
    label: 'Legacy vault (0xc8A5…0EBD)',
    vaultHint: '0xc8A5093d...d4Ff0EBD4',
  },
]

function parseVaultHint(hint?: string): { prefix: string; suffix: string } | null {
  if (!hint) return null
  const raw = hint.trim()
  if (!raw) return null
  if (isAddress(raw)) return { prefix: raw.toLowerCase(), suffix: '' }
  const parts = raw.split('...')
  if (parts.length !== 2) return null
  const prefix = parts[0].trim().toLowerCase()
  const suffix = parts[1].trim().toLowerCase()
  if (!prefix || !suffix) return null
  return { prefix, suffix }
}

function matchVaultHint(hint: string | undefined, vaults: string[]): string | null {
  const parsed = parseVaultHint(hint)
  if (!parsed) return null
  if (parsed.suffix === '' && isAddress(parsed.prefix)) return parsed.prefix
  const matches = vaults.filter((vault) => vault.startsWith(parsed.prefix) && vault.endsWith(parsed.suffix))
  return matches.length === 1 ? matches[0] : null
}

function getLegacyVestingStartBlock(): bigint {
  const raw = import.meta.env.VITE_BASE_VESTING_START_BLOCK as string | undefined
  if (!raw) return 15_000_000n
  const n = Number(raw)
  if (!Number.isFinite(n) || n <= 0) return 15_000_000n
  return BigInt(Math.floor(n))
}

const CREATOR_REGISTRY_ABI = [
  {
    type: 'function',
    name: 'getAllCreatorCoins',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address[]' }],
  },
  {
    type: 'function',
    name: 'getCreatorCoin',
    stateMutability: 'view',
    inputs: [{ name: '_token', type: 'address' }],
    outputs: [
      { name: 'token', type: 'address' },
      { name: 'name', type: 'string' },
      { name: 'symbol', type: 'string' },
      { name: 'vault', type: 'address' },
      { name: 'shareOFT', type: 'address' },
      { name: 'wrapper', type: 'address' },
      { name: 'oracle', type: 'address' },
      { name: 'gaugeController', type: 'address' },
      { name: 'creator', type: 'address' },
      { name: 'pool', type: 'address' },
      { name: 'poolFee', type: 'uint24' },
      { name: 'primaryChainId', type: 'uint16' },
      { name: 'isActive', type: 'bool' },
      { name: 'registeredAt', type: 'uint256' },
    ],
  },
] as const

const CREATOR_SHARE_VESTING_EVENT = parseAbiItem(
  'event CreatorShareVestingDeployed(address indexed shareOFT, address indexed beneficiary, address vesting, uint256 amount, uint64 startTimestamp, uint64 durationSeconds)',
)
const PHASE1_DEPLOYED_EVENT = parseAbiItem(
  'event Phase1Deployed(address indexed creatorToken, address indexed owner, address oftBootstrapRegistry, address vault, address wrapper, address shareOFT)',
)

async function fetchLegacyVesting(
  publicClient: any,
  shareOft: Address,
  beneficiary: Address,
): Promise<Address | null> {
  const batcher = CONTRACTS.creatorVaultBatcher
  if (!batcher || !isAddress(batcher)) return null
  try {
    const logs = await publicClient.getLogs({
      address: batcher as Address,
      event: CREATOR_SHARE_VESTING_EVENT,
      args: { shareOFT: shareOft, beneficiary },
      fromBlock: getLegacyVestingStartBlock(),
      toBlock: 'latest',
    })
    const log = logs[logs.length - 1]
    const vesting = (log?.args as any)?.vesting as Address | undefined
    return vesting && isAddress(vesting) ? vesting : null
  } catch {
    return null
  }
}

async function fetchLegacyPhase1Map(publicClient: any): Promise<Map<string, { vault: Address; wrapper: Address; shareOft: Address }>> {
  const batcher = CONTRACTS.creatorVaultBatcher
  if (!batcher || !isAddress(batcher)) return new Map()
  try {
    const logs = await publicClient.getLogs({
      address: batcher as Address,
      event: PHASE1_DEPLOYED_EVENT,
      fromBlock: getLegacyVestingStartBlock(),
      toBlock: 'latest',
    })
    const map = new Map<string, { vault: Address; wrapper: Address; shareOft: Address }>()
    for (const log of logs ?? []) {
      const args = (log as any)?.args ?? {}
      const vault = args.vault as Address | undefined
      const wrapper = args.wrapper as Address | undefined
      const shareOft = args.shareOFT as Address | undefined
      if (!vault || !wrapper || !shareOft) continue
      if (!isAddress(vault) || !isAddress(wrapper) || !isAddress(shareOft)) continue
      map.set(String(vault).toLowerCase(), {
        vault: getAddress(vault),
        wrapper: getAddress(wrapper),
        shareOft: getAddress(shareOft),
      })
    }
    return map
  } catch {
    return new Map()
  }
}

const VESTING_ABI = [
  { name: 'releasable', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'release', type: 'function', stateMutability: 'nonpayable', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'beneficiary', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
] as const

const COINBASE_SMART_WALLET_OWNER_LINK_ABI = [
  {
    type: 'function',
    name: 'isOwnerAddress',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const

const ERC8004_IDENTITY_REGISTRY_ABI = [
  { name: 'register', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'agentURI', type: 'string' }], outputs: [{ type: 'uint256' }] },
  { name: 'setAgentURI', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'agentId', type: 'uint256' }, { name: 'newURI', type: 'string' }], outputs: [] },
  { name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'owner', type: 'address' }], outputs: [{ type: 'uint256' }] },
] as const

const ERC8004_REGISTERED_EVENT = parseAbiItem(
  'event Registered(uint256 indexed agentId, string agentURI, address indexed owner)',
)

const WRAPPER_ABI = [
  { name: 'unwrap', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'amount', type: 'uint256' }], outputs: [{ type: 'uint256' }] },
] as const

const VAULT_ABI = [
  {
    name: 'queueWithdrawal',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'shares', type: 'uint256' },
      { name: 'receiver', type: 'address' },
    ],
    outputs: [],
  },
  { name: 'claimQueuedWithdrawal', type: 'function', stateMutability: 'nonpayable', inputs: [], outputs: [{ type: 'uint256' }] },
  {
    name: 'redeem',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'shares', type: 'uint256' },
      { name: 'receiver', type: 'address' },
      { name: 'owner', type: 'address' },
    ],
    outputs: [{ type: 'uint256' }],
  },
  { name: 'previewRedeem', type: 'function', stateMutability: 'view', inputs: [{ name: 'shares', type: 'uint256' }], outputs: [{ type: 'uint256' }] },
  { name: 'largeWithdrawalThreshold', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
] as const

const QUEUED_WITHDRAWAL_ABI = [
  {
    name: 'queuedWithdrawals',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [
      { name: 'shares', type: 'uint256' },
      { name: 'unlockBlock', type: 'uint256' },
      { name: 'receiver', type: 'address' },
    ],
  },
] as const

type TxState = {
  status: 'idle' | 'pending' | 'success' | 'error'
  hash?: `0x${string}`
  error?: string
}

function normalizeDomain(input: string): string {
  const s = String(input || '').trim().slice(0, MAX_DOMAIN_LEN)
  if (!s) return DEFAULT_DOMAIN
  // Basic allowlist: hostname chars + dots + optional port.
  if (!/^[a-z0-9.-]+(?::\d{1,5})?$/i.test(s)) return DEFAULT_DOMAIN
  return s
}

function tryParseJson(input: string): unknown | null {
  try {
    return JSON.parse(input)
  } catch {
    return null
  }
}

function shortAddress(addr: string): string {
  if (addr.length <= 12) return addr
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

function formatToken(value: bigint | undefined): string {
  if (value === undefined) return '—'
  const raw = formatUnits(value, 18)
  return raw.replace(/\.0+$/, '').replace(/(\.\d+?)0+$/, '$1')
}

function buildTxHref(hash?: string): string | null {
  if (!hash) return null
  return `https://basescan.org/tx/${hash}`
}

function TxMeta({ state }: { state?: TxState }) {
  if (!state || state.status === 'idle') return null
  return (
    <div className="text-xs text-zinc-500 space-y-1">
      {state.hash ? (
        <a className="inline-flex items-center gap-2 text-brand-accent hover:text-brand-primary" href={buildTxHref(state.hash) ?? undefined} target="_blank" rel="noreferrer">
          View transaction
          <ExternalLink className="w-3 h-3" />
        </a>
      ) : null}
      {state.status === 'pending' ? <div className="text-amber-300/80">Transaction pending…</div> : null}
      {state.status === 'success' ? <div className="text-emerald-300/90">Confirmed.</div> : null}
      {state.status === 'error' ? <div className="text-red-400">{state.error ?? 'Transaction failed'}</div> : null}
    </div>
  )
}

function usePaymasterSessionGuard() {
  const siwe = useSiweAuth()
  const privyAny = usePrivy() as any
  const privyReady = Boolean(privyAny?.ready)
  const privyAuthenticated = Boolean(privyAny?.authenticated)
  const getPrivyAccessToken: (() => Promise<string | null>) | null =
    typeof privyAny?.getAccessToken === 'function' ? privyAny.getAccessToken.bind(privyAny) : null

  const ensurePaymasterSession = async (): Promise<boolean> => {
    if (siwe.isSignedIn) return true
    if (privyReady && privyAuthenticated && getPrivyAccessToken) {
      try {
        const token = await getPrivyAccessToken()
        if (token) {
          const addr = await siwe.signInWithPrivyToken(token)
          if (addr) return true
        }
      } catch {
        // ignore
      }
    }
    return false
  }

  return { ensurePaymasterSession }
}

function AgentRegistration() {
  const { address, isConnected } = useAccount()
  const chainId = useChainId()
  const { switchChainAsync, isPending: switchPending } = useSwitchChain()
  const { data: walletClient } = useWalletClient({ chainId: base.id })
  const publicClient = usePublicClient({ chainId: base.id })
  const { wallets: privyWallets } = useWallets()
  const { ensurePaymasterSession } = usePaymasterSessionGuard()
  const [embeddedPrivyEoaAddress, setEmbeddedPrivyEoaAddress] = useState<string | null>(null)
  const [agentUri, setAgentUri] = useState(ERC8004_AGENT_URI_DEFAULT)
  const [registerTxState, setRegisterTxState] = useState<TxState>({ status: 'idle' })
  const [updateTxState, setUpdateTxState] = useState<TxState>({ status: 'idle' })
  const [registeredAgentId, setRegisteredAgentId] = useState<string | null>(null)
  const [agentIdInput, setAgentIdInput] = useState<string>('')
  const [resolveState, setResolveState] = useState<{ status: 'idle' | 'loading' | 'success' | 'error'; error?: string }>({
    status: 'idle',
  })

  const connectedAddress = useMemo(() => {
    if (!address || !isAddress(address)) return null
    return getAddress(address)
  }, [address])

  const embeddedPrivyWallet = useMemo(() => {
    const ws = Array.isArray(privyWallets) ? (privyWallets as any[]) : []
    const normalizeType = (w: any) =>
      String(w?.wallet_client_type ?? w?.walletClientType ?? w?.connector_type ?? w?.connectorType ?? w?.type ?? '')
        .trim()
        .toLowerCase()
    return (
      ws.find((w) => {
        const t = normalizeType(w)
        return t === 'privy' || t.includes('privy') || t.includes('embedded')
      }) ?? null
    )
  }, [privyWallets])

  const canonicalCswAddress = useMemo(() => getAddress(CANONICAL_SMART_WALLET), [])
  const isCanonical = connectedAddress?.toLowerCase() === CANONICAL_SMART_WALLET.toLowerCase()

  const canonicalOwnerQuery = useReadContract({
    address: CANONICAL_SMART_WALLET as Address,
    abi: COINBASE_SMART_WALLET_OWNER_LINK_ABI,
    functionName: 'isOwnerAddress',
    args: [connectedAddress ?? ZERO_ADDRESS],
    chainId: base.id,
    query: { enabled: !!connectedAddress },
  })
  const connectedIsCanonicalOwner = canonicalOwnerQuery.data === true

  const embeddedOwnerQuery = useReadContract({
    address: CANONICAL_SMART_WALLET as Address,
    abi: COINBASE_SMART_WALLET_OWNER_LINK_ABI,
    functionName: 'isOwnerAddress',
    args: [embeddedPrivyEoaAddress ? (embeddedPrivyEoaAddress as Address) : ZERO_ADDRESS],
    chainId: base.id,
    query: { enabled: !!embeddedPrivyEoaAddress },
  })
  const embeddedIsCanonicalOwner = embeddedOwnerQuery.data === true

  const registryBalanceQuery = useReadContract({
    address: ERC8004_IDENTITY_REGISTRY as Address,
    abi: ERC8004_IDENTITY_REGISTRY_ABI,
    functionName: 'balanceOf',
    args: [canonicalCswAddress],
    chainId: base.id,
    query: { enabled: !!publicClient },
  })
  const registryBalance = typeof registryBalanceQuery.data === 'bigint' ? registryBalanceQuery.data : null

  useEffect(() => {
    let cancelled = false
    if (!embeddedPrivyWallet) {
      setEmbeddedPrivyEoaAddress(null)
      return () => {}
    }
    ;(async () => {
      try {
        const provider = await (embeddedPrivyWallet as any).getEthereumProvider?.()
        if (!provider?.request) return
        const accounts = (await provider.request({ method: 'eth_accounts' })) as string[] | null
        const a0 = Array.isArray(accounts) ? accounts[0] : null
        const addr = typeof a0 === 'string' && isAddress(a0) ? getAddress(a0) : null
        if (!cancelled) setEmbeddedPrivyEoaAddress(addr)
      } catch {
        if (!cancelled) setEmbeddedPrivyEoaAddress(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [embeddedPrivyWallet])

  const isBase = chainId === base.id
  const canSubmitViaOwner = (connectedIsCanonicalOwner || embeddedIsCanonicalOwner) && !isCanonical

  const updateRegisterTx = (patch: Partial<TxState>) => {
    setRegisterTxState((prev) => {
      const nextStatus = patch.status ?? prev.status ?? 'idle'
      return { ...prev, ...patch, status: nextStatus } as TxState
    })
  }

  const updateUpdateTx = (patch: Partial<TxState>) => {
    setUpdateTxState((prev) => {
      const nextStatus = patch.status ?? prev.status ?? 'idle'
      return { ...prev, ...patch, status: nextStatus } as TxState
    })
  }

  const updateResolveState = (patch: Partial<{ status: 'idle' | 'loading' | 'success' | 'error'; error?: string }>) => {
    setResolveState((prev) => ({
      status: patch.status ?? prev.status,
      error: patch.error ?? (patch.status === 'error' ? prev.error : undefined),
    }))
  }

  const extractAgentId = (receipt: { logs?: Array<{ address: string; data: Hex; topics: Hex[] }> }) => {
    const logs = receipt.logs ?? []
    const registryLower = ERC8004_IDENTITY_REGISTRY.toLowerCase()
    for (const log of logs) {
      if (String(log.address || '').toLowerCase() !== registryLower) continue
      try {
        const parsed = decodeEventLog({
          abi: [ERC8004_REGISTERED_EVENT],
          data: log.data,
          topics: log.topics as unknown as [Hex, ...Hex[]] | [],
        })
        if (parsed.eventName === 'Registered') {
          const args = parsed.args as { agentId?: bigint }
          if (args?.agentId !== undefined) return String(args.agentId)
        }
      } catch {
        continue
      }
    }
    return null
  }

  const applyRegisteredAgentId = (agentId: string | null): boolean => {
    if (!agentId) return false
    setRegisteredAgentId(agentId)
    setAgentIdInput(agentId)
    updateResolveState({ status: 'success' })
    return true
  }

  const handleRegistrationReceipt = async (receipt: { logs?: Array<{ address: string; data: Hex; topics: Hex[] }> }) => {
    const agentId = extractAgentId(receipt)
    if (applyRegisteredAgentId(agentId)) return
    await resolveAgentIdFromChain({ skipBalanceCheck: true })
  }

  async function registerAgent() {
    if (!publicClient) return
    updateRegisterTx({ status: 'pending', error: undefined, hash: undefined })
    setRegisteredAgentId(null)
    try {
      if (!isBase) {
        throw new Error('Please switch to Base network to continue.')
      }
      const trimmedUri = agentUri.trim()
      if (!trimmedUri) throw new Error('Agent URI is required.')

      const registryAddress = ERC8004_IDENTITY_REGISTRY as Address

      if (isCanonical) {
        if (!walletClient) throw new Error('Connect the canonical smart wallet to continue.')
        const hash = await (walletClient as any).writeContract({
          account: (walletClient as any).account,
          chain: base as any,
          address: registryAddress,
          abi: ERC8004_IDENTITY_REGISTRY_ABI,
          functionName: 'register',
          args: [trimmedUri],
        })
        updateRegisterTx({ status: 'pending', hash })
        const receipt = await (publicClient as any).waitForTransactionReceipt({ hash })
        await handleRegistrationReceipt(receipt)
        updateRegisterTx({ status: 'success' })
        return
      }

      if (embeddedIsCanonicalOwner && embeddedPrivyWallet && embeddedPrivyEoaAddress) {
        const embeddedProvider = await (embeddedPrivyWallet as any).getEthereumProvider?.()
        if (!embeddedProvider?.request) {
          throw new Error('Privy embedded wallet provider not available')
        }
        const sessionOk = await ensurePaymasterSession()
        if (!sessionOk) {
          throw new Error('Sign in required for gas sponsorship.')
        }
        const paymasterEnv = import.meta.env.VITE_CDP_PAYMASTER_URL as string | undefined
        const bundlerUrl = resolveCdpPaymasterUrl(paymasterEnv) || '/api/paymaster'
        const data = encodeFunctionData({
          abi: ERC8004_IDENTITY_REGISTRY_ABI as any,
          functionName: 'register' as any,
          args: [trimmedUri],
        })
        const embeddedWalletClient = {
          request: async (args: { method: string; params?: any[] }) => embeddedProvider.request(args),
        }
        const result = await sendCoinbaseSmartWalletUserOperation({
          publicClient: publicClient as any,
          walletClient: embeddedWalletClient as any,
          bundlerUrl,
          smartWallet: canonicalCswAddress as Address,
          ownerAddress: embeddedPrivyEoaAddress as Address,
          calls: [{ to: registryAddress, data }],
          version: '1',
          userOpSignMode: 'eth_sign',
          skipPaymaster: false,
        })
        updateRegisterTx({ status: 'pending', hash: result.transactionHash })
        const receipt = await (publicClient as any).waitForTransactionReceipt({ hash: result.transactionHash })
        await handleRegistrationReceipt(receipt)
        updateRegisterTx({ status: 'success' })
        return
      }

      if (connectedIsCanonicalOwner && connectedAddress) {
        if (!walletClient) throw new Error('Connect the owner wallet to continue.')
        const sessionOk = await ensurePaymasterSession()
        if (!sessionOk) {
          throw new Error('Sign in required for gas sponsorship.')
        }
        const paymasterEnv = import.meta.env.VITE_CDP_PAYMASTER_URL as string | undefined
        const bundlerUrl = resolveCdpPaymasterUrl(paymasterEnv) || '/api/paymaster'
        const data = encodeFunctionData({
          abi: ERC8004_IDENTITY_REGISTRY_ABI as any,
          functionName: 'register' as any,
          args: [trimmedUri],
        })
        const result = await sendCoinbaseSmartWalletUserOperation({
          publicClient: publicClient as any,
          walletClient: walletClient as any,
          bundlerUrl,
          smartWallet: canonicalCswAddress as Address,
          ownerAddress: connectedAddress as Address,
          calls: [{ to: registryAddress, data }],
          version: '1',
          skipPaymaster: false,
        })
        updateRegisterTx({ status: 'pending', hash: result.transactionHash })
        const receipt = await (publicClient as any).waitForTransactionReceipt({ hash: result.transactionHash })
        await handleRegistrationReceipt(receipt)
        updateRegisterTx({ status: 'success' })
        return
      }

      throw new Error('Connect the canonical smart wallet or an owner wallet to continue.')
    } catch (e: any) {
      const msg = String(e?.shortMessage || e?.message || 'Transaction failed')
      const lower = msg.toLowerCase()
      const friendly = lower.includes('requested resource not available') || lower.includes('resource not available')
        ? 'Bundler endpoint does not support ERC-4337 methods. Set `VITE_CDP_BUNDLER_URL` and retry.'
        : msg
      updateRegisterTx({ status: 'error', error: friendly })
    }
  }

  async function updateAgentUri() {
    if (!publicClient) return
    updateUpdateTx({ status: 'pending', error: undefined, hash: undefined })
    try {
      if (!isBase) {
        throw new Error('Please switch to Base network to continue.')
      }
      const trimmedUri = agentUri.trim()
      if (!trimmedUri) throw new Error('Agent URI is required.')
      const rawId = agentIdInput.trim()
      if (!/^\d+$/.test(rawId)) throw new Error('Agent ID must be a non-negative integer.')
      const agentId = BigInt(rawId)

      const registryAddress = ERC8004_IDENTITY_REGISTRY as Address

      if (isCanonical) {
        if (!walletClient) throw new Error('Connect the canonical smart wallet to continue.')
        const hash = await (walletClient as any).writeContract({
          account: (walletClient as any).account,
          chain: base as any,
          address: registryAddress,
          abi: ERC8004_IDENTITY_REGISTRY_ABI,
          functionName: 'setAgentURI',
          args: [agentId, trimmedUri],
        })
        updateUpdateTx({ status: 'pending', hash })
        await (publicClient as any).waitForTransactionReceipt({ hash })
        updateUpdateTx({ status: 'success' })
        return
      }

      if (embeddedIsCanonicalOwner && embeddedPrivyWallet && embeddedPrivyEoaAddress) {
        const embeddedProvider = await (embeddedPrivyWallet as any).getEthereumProvider?.()
        if (!embeddedProvider?.request) {
          throw new Error('Privy embedded wallet provider not available')
        }
        const sessionOk = await ensurePaymasterSession()
        if (!sessionOk) {
          throw new Error('Sign in required for gas sponsorship.')
        }
        const paymasterEnv = import.meta.env.VITE_CDP_PAYMASTER_URL as string | undefined
        const bundlerUrl = resolveCdpPaymasterUrl(paymasterEnv) || '/api/paymaster'
        const data = encodeFunctionData({
          abi: ERC8004_IDENTITY_REGISTRY_ABI as any,
          functionName: 'setAgentURI' as any,
          args: [agentId, trimmedUri],
        })
        const embeddedWalletClient = {
          request: async (args: { method: string; params?: any[] }) => embeddedProvider.request(args),
        }
        const result = await sendCoinbaseSmartWalletUserOperation({
          publicClient: publicClient as any,
          walletClient: embeddedWalletClient as any,
          bundlerUrl,
          smartWallet: canonicalCswAddress as Address,
          ownerAddress: embeddedPrivyEoaAddress as Address,
          calls: [{ to: registryAddress, data }],
          version: '1',
          userOpSignMode: 'eth_sign',
          skipPaymaster: false,
        })
        updateUpdateTx({ status: 'pending', hash: result.transactionHash })
        await (publicClient as any).waitForTransactionReceipt({ hash: result.transactionHash })
        updateUpdateTx({ status: 'success' })
        return
      }

      if (connectedIsCanonicalOwner && connectedAddress) {
        if (!walletClient) throw new Error('Connect the owner wallet to continue.')
        const sessionOk = await ensurePaymasterSession()
        if (!sessionOk) {
          throw new Error('Sign in required for gas sponsorship.')
        }
        const paymasterEnv = import.meta.env.VITE_CDP_PAYMASTER_URL as string | undefined
        const bundlerUrl = resolveCdpPaymasterUrl(paymasterEnv) || '/api/paymaster'
        const data = encodeFunctionData({
          abi: ERC8004_IDENTITY_REGISTRY_ABI as any,
          functionName: 'setAgentURI' as any,
          args: [agentId, trimmedUri],
        })
        const result = await sendCoinbaseSmartWalletUserOperation({
          publicClient: publicClient as any,
          walletClient: walletClient as any,
          bundlerUrl,
          smartWallet: canonicalCswAddress as Address,
          ownerAddress: connectedAddress as Address,
          calls: [{ to: registryAddress, data }],
          version: '1',
          skipPaymaster: false,
        })
        updateUpdateTx({ status: 'pending', hash: result.transactionHash })
        await (publicClient as any).waitForTransactionReceipt({ hash: result.transactionHash })
        updateUpdateTx({ status: 'success' })
        return
      }

      throw new Error('Connect the canonical smart wallet or an owner wallet to continue.')
    } catch (e: any) {
      const msg = String(e?.shortMessage || e?.message || 'Transaction failed')
      const lower = msg.toLowerCase()
      const friendly = lower.includes('requested resource not available') || lower.includes('resource not available')
        ? 'Bundler endpoint does not support ERC-4337 methods. Set `VITE_CDP_BUNDLER_URL` and retry.'
        : msg
      updateUpdateTx({ status: 'error', error: friendly })
    }
  }

  async function resolveAgentIdFromChain(opts?: { skipBalanceCheck?: boolean }) {
    if (!publicClient) return
    updateResolveState({ status: 'loading', error: undefined })
    try {
      if (!isBase) {
        throw new Error('Please switch to Base network to continue.')
      }
      if (!opts?.skipBalanceCheck && registryBalance === 0n) {
        throw new Error('No agents registered for the canonical CSW yet.')
      }

      const latest = await publicClient.getBlockNumber()
      const window = 2_000_000n
      const fromBlock = latest > window ? latest - window : 0n
      let logs = (await publicClient.getLogs({
        address: ERC8004_IDENTITY_REGISTRY as Address,
        event: ERC8004_REGISTERED_EVENT,
        args: { owner: canonicalCswAddress },
        fromBlock,
        toBlock: 'latest',
      })) as Array<{ args?: { agentId?: bigint } }>

      if (!logs.length && fromBlock !== 0n) {
        logs = (await publicClient.getLogs({
          address: ERC8004_IDENTITY_REGISTRY as Address,
          event: ERC8004_REGISTERED_EVENT,
          args: { owner: canonicalCswAddress },
          fromBlock: 0n,
          toBlock: 'latest',
        })) as Array<{ args?: { agentId?: bigint } }>
      }

      const last = logs[logs.length - 1]
      const agentId = last?.args?.agentId
      if (agentId === undefined) {
        throw new Error('No registration log found for the canonical CSW.')
      }
      setAgentIdInput(String(agentId))
      updateResolveState({ status: 'success' })
    } catch (e: any) {
      const msg = String(e?.shortMessage || e?.message || 'Failed to resolve agent ID')
      updateResolveState({ status: 'error', error: msg })
    }
  }

  return (
    <section id="agent-registration" className="cinematic-section">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        <div className="rounded-2xl border border-white/5 bg-white/3 overflow-hidden">
          <div className="px-6 py-6 sm:px-8 sm:py-8 space-y-6">
            <div className="space-y-2">
              <div className="label">Agent registry</div>
              <div className="text-xl sm:text-2xl text-zinc-100 font-medium tracking-tight">Register ERC-8004 agent</div>
              <div className="text-sm text-zinc-600 max-w-prose">
                Registers the canonical CSW in the ERC-8004 Identity Registry on Base.
              </div>
            </div>

            {!isConnected ? (
              <div className="rounded-xl border border-white/10 bg-black/30 p-5 space-y-3">
                <div className="label">Connect</div>
                <ConnectButton />
              </div>
            ) : (
              <div className="rounded-xl border border-white/10 bg-black/30 p-5 space-y-2 text-sm">
                <div className="text-zinc-400">Connected wallet</div>
                <div className="font-mono text-zinc-200">{connectedAddress}</div>
                <div className="text-xs text-zinc-500">
                  Canonical CSW: <span className="font-mono text-zinc-300">{shortAddress(canonicalCswAddress)}</span>
                </div>
                {canSubmitViaOwner ? (
                  <div className="text-emerald-300/90">Owner detected. Transactions will be submitted via the canonical smart wallet.</div>
                ) : null}
                {!isCanonical && !canSubmitViaOwner ? (
                  <div className="text-amber-300/80">
                    Connected wallet is not the canonical smart wallet. Registering is disabled.
                  </div>
                ) : null}
                {!isBase ? (
                  <button
                    type="button"
                    onClick={async () => {
                      if (!switchChainAsync) return
                      await switchChainAsync({ chainId: base.id })
                    }}
                    disabled={switchPending}
                    className="btn-accent w-full disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {switchPending ? 'Switching…' : 'Switch to Base'}
                  </button>
                ) : null}
              </div>
            )}

            <div className="rounded-xl border border-white/10 bg-black/30 p-5 space-y-3">
              <div className="text-sm text-zinc-300">Agent registration URL</div>
              <input
                value={agentUri}
                onChange={(e) => setAgentUri(e.target.value)}
                placeholder={ERC8004_AGENT_URI_DEFAULT}
                className="w-full bg-transparent border border-white/10 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-white/20 font-mono"
              />
              <div className="text-xs text-zinc-600">
                Registry: <span className="font-mono text-zinc-400">{shortAddress(ERC8004_IDENTITY_REGISTRY)}</span> · Chain: Base
              </div>
              {registryBalance !== null ? (
                <div className="text-xs text-zinc-500">
                  Agents registered for canonical CSW: <span className="text-zinc-300">{registryBalance.toString()}</span>
                </div>
              ) : null}
              {registeredAgentId ? (
                <div className="text-xs text-emerald-300/90">
                  Registered agentId: <span className="font-mono">{registeredAgentId}</span>
                </div>
              ) : null}
              <div className="text-xs text-zinc-600">Agent ID (for updates)</div>
              <input
                value={agentIdInput}
                onChange={(e) => setAgentIdInput(e.target.value)}
                placeholder="e.g. 1"
                className="w-full bg-transparent border border-white/10 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-white/20 font-mono"
              />
              <button
                type="button"
                onClick={() => void resolveAgentIdFromChain()}
                disabled={resolveState.status === 'loading' || !isConnected || (!isCanonical && !canSubmitViaOwner)}
                className="btn-ghost w-full disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {resolveState.status === 'loading' ? 'Resolving…' : 'Resolve agent ID from chain'}
              </button>
              {resolveState.status === 'error' ? (
                <div className="text-xs text-red-400">{resolveState.error}</div>
              ) : resolveState.status === 'success' ? (
                <div className="text-xs text-emerald-300/90">Agent ID resolved.</div>
              ) : null}
              <button
                type="button"
                onClick={() => void updateAgentUri()}
                disabled={updateTxState.status === 'pending' || !isConnected || (!isCanonical && !canSubmitViaOwner)}
                className="btn-ghost w-full disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {updateTxState.status === 'pending' ? 'Updating…' : 'Update agent URI'}
              </button>
              <TxMeta state={updateTxState} />
              <button
                type="button"
                onClick={() => void registerAgent()}
                disabled={registerTxState.status === 'pending' || !isConnected || (!isCanonical && !canSubmitViaOwner)}
                className="btn-accent w-full disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {registerTxState.status === 'pending' ? 'Registering…' : 'Register agent'}
              </button>
              <TxMeta state={registerTxState} />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function LegacyWithdrawals() {
  const { address, isConnected } = useAccount()
  const chainId = useChainId()
  const { switchChainAsync, isPending: switchPending } = useSwitchChain()
  const { data: walletClient } = useWalletClient({ chainId: base.id })
  const publicClient = usePublicClient({ chainId: base.id })
  const { wallets: privyWallets } = useWallets()
  const { ensurePaymasterSession } = usePaymasterSessionGuard()
  const { client: smartWalletClient } = useSmartWallets()
  const { data: blockNumber } = useBlockNumber({ chainId: base.id, watch: true })
  const [embeddedPrivyEoaAddress, setEmbeddedPrivyEoaAddress] = useState<string | null>(null)

  const connectedAddress = useMemo(() => {
    if (!address || !isAddress(address)) return null
    return getAddress(address)
  }, [address])

  const privySmartWalletAddress = useMemo(() => {
    try {
      const addr = smartWalletClient?.account?.address
      return addr && isAddress(addr) ? getAddress(addr) : null
    } catch {
      return null
    }
  }, [smartWalletClient])

  const privyWalletCswAddress = useMemo(() => {
    const ws = Array.isArray(privyWallets) ? (privyWallets as any[]) : []
    const normalizeType = (w: any) =>
      String(w?.wallet_client_type ?? w?.walletClientType ?? w?.connector_type ?? w?.connectorType ?? w?.type ?? '')
        .trim()
        .toLowerCase()
    const csw = ws.find((w) => {
      const t = normalizeType(w)
      return t.includes('coinbase_smart_wallet') || t.includes('coinbase-smart-wallet')
    })
    const raw = typeof (csw as any)?.address === 'string' ? String((csw as any).address) : ''
    return isAddress(raw) ? getAddress(raw) : null
  }, [privyWallets])
  const embeddedPrivyWallet = useMemo(() => {
    const ws = Array.isArray(privyWallets) ? (privyWallets as any[]) : []
    const normalizeType = (w: any) =>
      String(w?.wallet_client_type ?? w?.walletClientType ?? w?.connector_type ?? w?.connectorType ?? w?.type ?? '')
        .trim()
        .toLowerCase()
    return (
      ws.find((w) => {
        const t = normalizeType(w)
        return t === 'privy' || t.includes('privy') || t.includes('embedded')
      }) ?? null
    )
  }, [privyWallets])
  const canonicalCswAddress = useMemo(() => getAddress(CANONICAL_SMART_WALLET), [])
  const privyCswAddress = privySmartWalletAddress ?? privyWalletCswAddress
  const privyCswIsCanonical = useMemo(() => {
    if (!privyCswAddress) return false
    return privyCswAddress.toLowerCase() === canonicalCswAddress.toLowerCase()
  }, [canonicalCswAddress, privyCswAddress])

  const canonicalOwnerQuery = useReadContract({
    address: CANONICAL_SMART_WALLET as Address,
    abi: COINBASE_SMART_WALLET_OWNER_LINK_ABI,
    functionName: 'isOwnerAddress',
    args: [connectedAddress ?? '0x0000000000000000000000000000000000000000'],
    chainId: base.id,
    query: { enabled: !!connectedAddress },
  })
  const connectedIsCanonicalOwner = canonicalOwnerQuery.data === true
  const embeddedOwnerQuery = useReadContract({
    address: CANONICAL_SMART_WALLET as Address,
    abi: COINBASE_SMART_WALLET_OWNER_LINK_ABI,
    functionName: 'isOwnerAddress',
    args: [embeddedPrivyEoaAddress ? (embeddedPrivyEoaAddress as Address) : ZERO_ADDRESS],
    chainId: base.id,
    query: { enabled: !!embeddedPrivyEoaAddress },
  })
  const embeddedIsCanonicalOwner = embeddedOwnerQuery.data === true

  const [receiver, setReceiver] = useState<string>('')
  const [amounts, setAmounts] = useState<Record<string, string>>({})
  const [txStates, setTxStates] = useState<Record<string, TxState>>({})
  const [legacyOverrides, setLegacyOverrides] = useState<Record<string, Partial<LegacyVaultResolved>>>({})
  const [legacyResolveStatus, setLegacyResolveStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [legacyResolveError, setLegacyResolveError] = useState<string | null>(null)

  const legacyVaults = useMemo<LegacyVaultResolved[]>(() => {
    return LEGACY_VAULT_HINTS.map((hint) => {
      const override = legacyOverrides[hint.id] ?? {}
      return {
        id: hint.id,
        label: hint.label,
        vaultHint: hint.vaultHint,
        vault: override.vault ?? hint.vault ?? ZERO_ADDRESS,
        wrapper: override.wrapper ?? hint.wrapper ?? ZERO_ADDRESS,
        shareOft: override.shareOft ?? hint.shareOft ?? ZERO_ADDRESS,
        vesting: override.vesting ?? hint.vesting ?? ZERO_ADDRESS,
        resolvedFrom: override.resolvedFrom ?? (hint.vault ? 'static' : 'unknown'),
      }
    })
  }, [legacyOverrides])

  const unresolvedHintIds = useMemo(() => {
    return LEGACY_VAULT_HINTS.filter((hint) => hint.vaultHint && !legacyOverrides[hint.id]?.vault)
      .map((hint) => hint.id)
      .join(',')
  }, [legacyOverrides])

  useEffect(() => {
    if (connectedAddress && !receiver) setReceiver(connectedAddress)
  }, [connectedAddress, receiver])
  useEffect(() => {
    let cancelled = false
    if (!embeddedPrivyWallet) {
      setEmbeddedPrivyEoaAddress(null)
      return () => {}
    }
    ;(async () => {
      try {
        const provider = await (embeddedPrivyWallet as any).getEthereumProvider?.()
        if (!provider?.request) return
        const accounts = (await provider.request({ method: 'eth_accounts' })) as string[] | null
        const a0 = Array.isArray(accounts) ? accounts[0] : null
        const addr = typeof a0 === 'string' && isAddress(a0) ? getAddress(a0) : null
        if (!cancelled) setEmbeddedPrivyEoaAddress(addr)
      } catch {
        if (!cancelled) setEmbeddedPrivyEoaAddress(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [embeddedPrivyWallet])

  const isBase = chainId === base.id
  const isCanonical = connectedAddress?.toLowerCase() === CANONICAL_SMART_WALLET.toLowerCase()
  const hasEmbeddedSigner = Boolean(embeddedPrivyEoaAddress && embeddedPrivyWallet)
  const canSubmitViaOwner = (connectedIsCanonicalOwner || embeddedIsCanonicalOwner) && !isCanonical
  const canUseSmartWallet = Boolean(
    publicClient &&
      ((isCanonical && walletClient) ||
        (embeddedIsCanonicalOwner && hasEmbeddedSigner) ||
        (connectedIsCanonicalOwner && walletClient)),
  )
  const detectedCsw = useMemo(() => {
    if (isCanonical) return { address: canonicalCswAddress, source: 'connected' as const }
    if (connectedIsCanonicalOwner) return { address: canonicalCswAddress, source: 'owner' as const }
    if (privyCswIsCanonical) return { address: canonicalCswAddress, source: 'privy' as const }
    if (privyCswAddress) return { address: privyCswAddress, source: 'privy-noncanonical' as const }
    return { address: null, source: null }
  }, [canonicalCswAddress, connectedIsCanonicalOwner, isCanonical, privyCswAddress, privyCswIsCanonical])
  const detectedCswLabel = useMemo(() => {
    switch (detectedCsw.source) {
      case 'privy':
        return 'Privy smart wallet'
      case 'privy-noncanonical':
        return 'Privy smart wallet (non-canonical)'
      case 'connected':
        return 'Connected wallet'
      case 'owner':
        return 'Owner check'
      default:
        return null
    }
  }, [detectedCsw.source])
  const detectedCswMismatch = useMemo(() => {
    if (!detectedCsw.address) return false
    return detectedCsw.address.toLowerCase() !== canonicalCswAddress.toLowerCase()
  }, [canonicalCswAddress, detectedCsw.address])

  useEffect(() => {
    let cancelled = false
    if (!publicClient || !unresolvedHintIds) return () => {}

    const registryAddress = CONTRACTS.registry
    if (!registryAddress || !isAddress(registryAddress)) return () => {}

    setLegacyResolveStatus('loading')
    setLegacyResolveError(null)

    ;(async () => {
      try {
        const tokens = (await publicClient.readContract({
          address: registryAddress as Address,
          abi: CREATOR_REGISTRY_ABI,
          functionName: 'getAllCreatorCoins',
        })) as Address[]

        if (!tokens || tokens.length === 0) {
          if (!cancelled) setLegacyResolveStatus('done')
          return
        }

        const calls = tokens.map((token) => ({
          address: registryAddress as Address,
          abi: CREATOR_REGISTRY_ABI,
          functionName: 'getCreatorCoin',
          args: [token],
        }))

        const results: any[] = []
        const chunkSize = 120
        for (let i = 0; i < calls.length; i += chunkSize) {
          const chunk = calls.slice(i, i + chunkSize)
          const chunkResults = await publicClient.multicall({ contracts: chunk, allowFailure: true })
          results.push(...chunkResults)
        }

        const vaultMap = new Map<string, { vault: Address; wrapper: Address; shareOft: Address }>()
        results.forEach((res) => {
          if (res.status !== 'success') return
          const info = res.result as any
          const vault = info?.vault as Address | undefined
          const wrapper = info?.wrapper as Address | undefined
          const shareOft = (info?.shareOFT ?? info?.shareOft) as Address | undefined
          if (!vault || !wrapper || !shareOft) return
          if (!isAddress(vault) || !isAddress(wrapper) || !isAddress(shareOft)) return
          vaultMap.set(String(vault).toLowerCase(), {
            vault: getAddress(vault),
            wrapper: getAddress(wrapper),
            shareOft: getAddress(shareOft),
          })
        })

        const phase1Map = await fetchLegacyPhase1Map(publicClient)
        for (const [vaultKey, record] of phase1Map.entries()) {
          if (!vaultMap.has(vaultKey)) vaultMap.set(vaultKey, record)
        }

        const vaultKeys = Array.from(vaultMap.keys())
        const updates: Record<string, Partial<LegacyVaultResolved>> = {}

        for (const hint of LEGACY_VAULT_HINTS) {
          const hintVault = hint.vault && isAddress(hint.vault) ? getAddress(hint.vault) : null
          const hintVaultKey = hintVault ? hintVault.toLowerCase() : null
          const match =
            hintVaultKey && vaultMap.has(hintVaultKey)
              ? hintVaultKey
              : hint.vaultHint
                ? matchVaultHint(hint.vaultHint, vaultKeys)
                : null
          if (!match) continue
          const record = vaultMap.get(match)
          if (!record) continue
          updates[hint.id] = {
            vault: record.vault,
            wrapper: record.wrapper,
            shareOft: record.shareOft,
            resolvedFrom: 'registry',
          }
        }

        for (const [id, update] of Object.entries(updates)) {
          if (!update.shareOft || !isAddress(update.shareOft)) continue
          const vesting = await fetchLegacyVesting(publicClient, update.shareOft as Address, canonicalCswAddress as Address)
          if (vesting) {
            updates[id] = { ...update, vesting: getAddress(vesting) }
          }
        }

        if (!cancelled && Object.keys(updates).length > 0) {
          setLegacyOverrides((prev) => ({ ...prev, ...updates }))
        }
        if (!cancelled) setLegacyResolveStatus('done')
      } catch (e) {
        if (!cancelled) {
          setLegacyResolveStatus('error')
          setLegacyResolveError('Failed to resolve legacy deployments from the registry.')
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [publicClient, canonicalCswAddress, unresolvedHintIds])

  const updateTx = (key: string, patch: Partial<TxState>) => {
    setTxStates((prev) => {
      const current = prev[key]
      const nextStatus = patch.status ?? current?.status ?? 'idle'
      return {
        ...prev,
        [key]: { ...current, ...patch, status: nextStatus } as TxState,
      }
    })
  }

  async function sendTx(
    key: string,
    config: {
      address: Address
      abi: readonly unknown[]
      functionName: string
      args?: readonly unknown[]
    },
  ) {
    if (!publicClient) return
    updateTx(key, { status: 'pending', error: undefined, hash: undefined })
    try {
      if (!isBase) {
        throw new Error('Please switch to Base network to continue.')
      }
      if (isCanonical) {
        if (!walletClient) throw new Error('Connect the canonical smart wallet to continue.')
        const hash = await (walletClient as any).writeContract({
          account: (walletClient as any).account,
          chain: base as any,
          address: config.address,
          abi: config.abi,
          functionName: config.functionName,
          args: config.args ?? [],
        })
        updateTx(key, { status: 'pending', hash })
        await (publicClient as any).waitForTransactionReceipt({ hash })
        updateTx(key, { status: 'success' })
        return
      }
      if (embeddedIsCanonicalOwner && embeddedPrivyWallet && embeddedPrivyEoaAddress) {
        const embeddedProvider = await (embeddedPrivyWallet as any).getEthereumProvider?.()
        if (!embeddedProvider?.request) {
          throw new Error('Privy embedded wallet provider not available')
        }
        const sessionOk = await ensurePaymasterSession()
        if (!sessionOk) {
          throw new Error('Sign in required for gas sponsorship.')
        }
        const paymasterEnv = import.meta.env.VITE_CDP_PAYMASTER_URL as string | undefined
        const bundlerUrl = resolveCdpPaymasterUrl(paymasterEnv) || '/api/paymaster'
        const data = encodeFunctionData({
          abi: config.abi as any,
          functionName: config.functionName as any,
          args: config.args ?? [],
        })
        const embeddedWalletClient = {
          request: async (args: { method: string; params?: any[] }) => embeddedProvider.request(args),
        }
        const result = await sendCoinbaseSmartWalletUserOperation({
          publicClient: publicClient as any,
          walletClient: embeddedWalletClient as any,
          bundlerUrl,
          smartWallet: canonicalCswAddress as Address,
          ownerAddress: embeddedPrivyEoaAddress as Address,
          calls: [{ to: config.address, data }],
          version: '1',
          userOpSignMode: 'eth_sign',
          skipPaymaster: false,
        })
        updateTx(key, { status: 'pending', hash: result.transactionHash })
        await (publicClient as any).waitForTransactionReceipt({ hash: result.transactionHash })
        updateTx(key, { status: 'success' })
        return
      }
      if (connectedIsCanonicalOwner && connectedAddress) {
        if (!walletClient) throw new Error('Connect the owner wallet to continue.')
        const sessionOk = await ensurePaymasterSession()
        if (!sessionOk) {
          throw new Error('Sign in required for gas sponsorship.')
        }
        const paymasterEnv = import.meta.env.VITE_CDP_PAYMASTER_URL as string | undefined
        const bundlerUrl = resolveCdpPaymasterUrl(paymasterEnv) || '/api/paymaster'
        const data = encodeFunctionData({
          abi: config.abi as any,
          functionName: config.functionName as any,
          args: config.args ?? [],
        })
        const result = await sendCoinbaseSmartWalletUserOperation({
          publicClient: publicClient as any,
          walletClient: walletClient as any,
          bundlerUrl,
          smartWallet: canonicalCswAddress as Address,
          ownerAddress: connectedAddress as Address,
          calls: [{ to: config.address, data }],
          version: '1',
          skipPaymaster: false,
        })
        updateTx(key, { status: 'pending', hash: result.transactionHash })
        await (publicClient as any).waitForTransactionReceipt({ hash: result.transactionHash })
        updateTx(key, { status: 'success' })
        return
      }
      throw new Error('Connect the canonical smart wallet or an owner wallet to continue.')
    } catch (e: any) {
      const msg = String(e?.shortMessage || e?.message || 'Transaction failed')
      const lower = msg.toLowerCase()
      const friendly = lower.includes('requested resource not available') || lower.includes('resource not available')
        ? 'Bundler endpoint does not support ERC-4337 methods. Set `VITE_CDP_BUNDLER_URL` and retry.'
        : msg
      updateTx(key, { status: 'error', error: friendly })
    }
  }

  async function sendBatchTx(key: string, calls: Array<{ to: Address; data: Hex }>) {
    if (!publicClient) return
    updateTx(key, { status: 'pending', error: undefined, hash: undefined })
    try {
      if (!isBase) {
        throw new Error('Please switch to Base network to continue.')
      }
      if (!calls.length) {
        throw new Error('No actions to submit.')
      }
      if (isCanonical) {
        throw new Error('Connect an owner wallet to submit 1-click withdrawals.')
      }
      if (embeddedIsCanonicalOwner && embeddedPrivyWallet && embeddedPrivyEoaAddress) {
        const embeddedProvider = await (embeddedPrivyWallet as any).getEthereumProvider?.()
        if (!embeddedProvider?.request) {
          throw new Error('Privy embedded wallet provider not available')
        }
        const sessionOk = await ensurePaymasterSession()
        if (!sessionOk) {
          throw new Error('Sign in required for gas sponsorship.')
        }
        const paymasterEnv = import.meta.env.VITE_CDP_PAYMASTER_URL as string | undefined
        const bundlerUrl = resolveCdpPaymasterUrl(paymasterEnv) || '/api/paymaster'
        const embeddedWalletClient = {
          request: async (args: { method: string; params?: any[] }) => embeddedProvider.request(args),
        }
        const result = await sendCoinbaseSmartWalletUserOperation({
          publicClient: publicClient as any,
          walletClient: embeddedWalletClient as any,
          bundlerUrl,
          smartWallet: canonicalCswAddress as Address,
          ownerAddress: embeddedPrivyEoaAddress as Address,
          calls,
          version: '1',
          userOpSignMode: 'eth_sign',
          skipPaymaster: false,
        })
        updateTx(key, { status: 'pending', hash: result.transactionHash })
        await (publicClient as any).waitForTransactionReceipt({ hash: result.transactionHash })
        updateTx(key, { status: 'success' })
        return
      }
      if (connectedIsCanonicalOwner && connectedAddress) {
        if (!walletClient) throw new Error('Connect the owner wallet to continue.')
        const sessionOk = await ensurePaymasterSession()
        if (!sessionOk) {
          throw new Error('Sign in required for gas sponsorship.')
        }
        const paymasterEnv = import.meta.env.VITE_CDP_PAYMASTER_URL as string | undefined
        const bundlerUrl = resolveCdpPaymasterUrl(paymasterEnv) || '/api/paymaster'
        const result = await sendCoinbaseSmartWalletUserOperation({
          publicClient: publicClient as any,
          walletClient: walletClient as any,
          bundlerUrl,
          smartWallet: canonicalCswAddress as Address,
          ownerAddress: connectedAddress as Address,
          calls,
          version: '1',
          skipPaymaster: false,
        })
        updateTx(key, { status: 'pending', hash: result.transactionHash })
        await (publicClient as any).waitForTransactionReceipt({ hash: result.transactionHash })
        updateTx(key, { status: 'success' })
        return
      }
      throw new Error('Connect the canonical smart wallet or an owner wallet to continue.')
    } catch (e: any) {
      const msg = String(e?.shortMessage || e?.message || 'Transaction failed')
      const lower = msg.toLowerCase()
      const friendly = lower.includes('requested resource not available') || lower.includes('resource not available')
        ? 'Bundler endpoint does not support ERC-4337 methods. Set `VITE_CDP_BUNDLER_URL` and retry.'
        : msg
      updateTx(key, { status: 'error', error: friendly })
    }
  }

  function parseAmount(input: string): bigint | null {
    const raw = input.trim()
    if (!raw) return null
    try {
      const amount = parseUnits(raw, 18)
      return amount > 0n ? amount : null
    } catch {
      return null
    }
  }

  const receiverValid = isAddress(receiver)

  return (
    <section id="legacy-withdrawals" className="cinematic-section">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        <div className="rounded-2xl border border-white/5 bg-white/3 overflow-hidden">
          <div className="px-6 py-6 sm:px-8 sm:py-8 space-y-6">
            <div className="space-y-2">
              <div className="label">Legacy withdraw</div>
              <div className="text-xl sm:text-2xl text-zinc-100 font-medium tracking-tight">Withdraw old ShareOFT balances</div>
              <div className="text-sm text-zinc-600 max-w-prose">
                This panel submits the onchain steps to withdraw legacy ShareOFT via wrappers + vaults. Connect the canonical
                smart wallet <span className="font-mono text-zinc-300">{shortAddress(CANONICAL_SMART_WALLET)}</span>.
              </div>
            </div>

            {!isConnected ? (
              <div className="rounded-xl border border-white/10 bg-black/30 p-5 space-y-3">
                <div className="label">Connect</div>
                <ConnectButton />
              </div>
            ) : (
              <div className="rounded-xl border border-white/10 bg-black/30 p-5 space-y-2 text-sm">
                <div className="text-zinc-400">Connected wallet</div>
                <div className="font-mono text-zinc-200">{connectedAddress}</div>
                <div className="text-xs text-zinc-500">
                  Canonical CSW: <span className="font-mono text-zinc-300">{shortAddress(canonicalCswAddress)}</span>
                </div>
                {detectedCsw.address ? (
                  <div className="text-xs text-zinc-500">
                    Detected CSW{detectedCswLabel ? ` (${detectedCswLabel})` : ''}:{' '}
                    <span className="font-mono text-zinc-300">{shortAddress(detectedCsw.address)}</span>
                  </div>
                ) : (
                  <div className="text-xs text-amber-300/80">
                    CSW not detected yet. Sign in with wallet or connect the CSW directly.
                  </div>
                )}
                {detectedCswMismatch ? (
                  <div className="text-xs text-amber-300/80">
                    Detected smart wallet does not match the canonical CSW. Switch to the canonical CSW to proceed.
                  </div>
                ) : null}
                {canSubmitViaOwner ? (
                  <div className="text-emerald-300/90">
                    Owner detected. Transactions will be submitted via the canonical smart wallet.
                  </div>
                ) : null}
                {embeddedPrivyEoaAddress && !embeddedIsCanonicalOwner ? (
                  <div className="text-xs text-amber-300/80">
                    Privy embedded wallet is not linked to the canonical CSW.{' '}
                    <a className="underline hover:text-amber-200" href="/deploy#gasfree">
                      Enable gas-free deploys
                    </a>{' '}
                    to use it for signing.
                  </div>
                ) : embeddedIsCanonicalOwner ? (
                  <div className="text-xs text-emerald-300/80">
                    Privy embedded wallet linked. Signatures use Privy by default.
                  </div>
                ) : null}
                {connectedIsCanonicalOwner && !isCanonical ? (
                  <div className="text-xs text-zinc-500">
                    Optional: switch to the canonical CSW for direct signing.
                  </div>
                ) : null}
                {!isCanonical && !canSubmitViaOwner ? (
                  <div className="text-amber-300/80">
                    Connected wallet is not the canonical smart wallet. Unwrap/queue actions are disabled.
                  </div>
                ) : null}
                {!isBase ? (
                  <button
                    type="button"
                    onClick={async () => {
                      if (!switchChainAsync) return
                      await switchChainAsync({ chainId: base.id })
                    }}
                    disabled={switchPending}
                    className="btn-accent w-full disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {switchPending ? 'Switching…' : 'Switch to Base'}
                  </button>
                ) : null}
              </div>
            )}

            <div className="rounded-xl border border-white/10 bg-black/30 p-5 space-y-3">
              <div className="text-sm text-zinc-300">Withdrawal receiver</div>
              <input
                value={receiver}
                onChange={(e) => setReceiver(e.target.value)}
                placeholder="0x..."
                className="w-full bg-transparent border border-white/10 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-white/20 font-mono"
              />
              {!receiverValid ? <div className="text-xs text-red-400">Receiver address is invalid.</div> : null}
              <div className="text-xs text-zinc-600">Queue withdrawals will send Creator Coin to this address.</div>
            </div>

            {legacyResolveStatus === 'loading' ? (
              <div className="text-xs text-zinc-500">Resolving legacy deployments from registry…</div>
            ) : null}
            {legacyResolveError ? <div className="text-xs text-amber-300/80">{legacyResolveError}</div> : null}

            <div className="grid gap-6">
              {legacyVaults.map((legacy) => {
                const amountInput = amounts[legacy.id] ?? ''
                const parsedAmount = parseAmount(amountInput)
                const sharesToQueue = parsedAmount ? parsedAmount * 1000n : null
                const hasShareOft = isAddress(legacy.shareOft)
                const hasWrapper = isAddress(legacy.wrapper)
                const hasVault = isAddress(legacy.vault)
                const hasVesting = isAddress(legacy.vesting)
                const hasResolvedContracts = hasShareOft && hasWrapper && hasVault
                const balanceAccount = canUseSmartWallet ? canonicalCswAddress : connectedAddress ?? ZERO_ADDRESS
                const balanceLabel = canUseSmartWallet ? 'CSW balance' : 'Connected balance'
                const balanceQuery = useReadContract({
                  address: legacy.shareOft as Address,
                  abi: erc20Abi,
                  functionName: 'balanceOf',
                  args: [balanceAccount as Address],
                  query: { enabled: hasShareOft && canUseSmartWallet },
                })
                const releasableQuery = useReadContract({
                  address: legacy.vesting as Address,
                  abi: VESTING_ABI,
                  functionName: 'releasable',
                  query: { enabled: hasVesting },
                })
                const queuedQuery = useReadContract({
                  address: legacy.vault as Address,
                  abi: QUEUED_WITHDRAWAL_ABI,
                  functionName: 'queuedWithdrawals',
                  args: [canonicalCswAddress],
                  chainId: base.id,
                  query: { enabled: canUseSmartWallet && isBase && hasVault },
                })
                const thresholdQuery = useReadContract({
                  address: legacy.vault as Address,
                  abi: VAULT_ABI,
                  functionName: 'largeWithdrawalThreshold',
                  chainId: base.id,
                  query: { enabled: isBase && hasVault },
                })
                const previewRedeemQuery = useReadContract({
                  address: legacy.vault as Address,
                  abi: VAULT_ABI,
                  functionName: 'previewRedeem',
                  args: [sharesToQueue ?? 0n],
                  chainId: base.id,
                  query: { enabled: isBase && hasVault && !!sharesToQueue },
                })
                const releaseKey = `release-${legacy.id}`
                const unwrapKey = `unwrap-${legacy.id}`
                const queueKey = `queue-${legacy.id}`
                const claimKey = `claim-${legacy.id}`
                const oneClickKey = `oneclick-${legacy.id}`

                const balance = balanceQuery.data as bigint | undefined
                const releasable = releasableQuery.data as bigint | undefined
                const largeWithdrawalThreshold = thresholdQuery.data as bigint | undefined
                const previewRedeem = previewRedeemQuery.data as bigint | undefined
                const hasReleasable = typeof releasable === 'bigint' && releasable > 0n
                const isBalanceZero = typeof balance === 'bigint' && balance === 0n
                const queued = queuedQuery.data as
                  | readonly [bigint, bigint, Address]
                  | { shares: bigint; unlockBlock: bigint; receiver: Address }
                  | undefined
                const isQueuedObject = (
                  value: typeof queued,
                ): value is { shares: bigint; unlockBlock: bigint; receiver: Address } => {
                  return Boolean(value) && !Array.isArray(value)
                }
                const queuedTuple = Array.isArray(queued)
                  ? queued
                  : isQueuedObject(queued)
                    ? ([queued.shares, queued.unlockBlock, queued.receiver] as const)
                    : null
                const queuedShares = queuedTuple ? queuedTuple[0] : undefined
                const queuedUnlockBlock = queuedTuple ? queuedTuple[1] : undefined
                const hasQueued = typeof queuedShares === 'bigint' && queuedShares > 0n
                const currentBlock = typeof blockNumber === 'bigint' ? blockNumber : null
                const isUnlocked =
                  hasQueued && typeof queuedUnlockBlock === 'bigint' && currentBlock !== null
                    ? currentBlock >= queuedUnlockBlock
                    : false
                const blocksRemaining =
                  hasQueued && typeof queuedUnlockBlock === 'bigint' && currentBlock !== null && queuedUnlockBlock > currentBlock
                    ? queuedUnlockBlock - currentBlock
                    : null
                const maxAvailable =
                  (typeof balance === 'bigint' ? balance : 0n) + (hasReleasable ? (releasable ?? 0n) : 0n)
                const oneClickAmount = parsedAmount ?? (maxAvailable > 0n ? maxAvailable : null)
                const oneClickShares = typeof oneClickAmount === 'bigint' ? oneClickAmount * 1000n : null
                const exceedsAvailable =
                  typeof oneClickAmount === 'bigint' && typeof maxAvailable === 'bigint' ? oneClickAmount > maxAvailable : false
                const previewRedeemOneClickQuery = useReadContract({
                  address: legacy.vault as Address,
                  abi: VAULT_ABI,
                  functionName: 'previewRedeem',
                  args: [oneClickShares ?? 0n],
                  chainId: base.id,
                  query: { enabled: isBase && hasVault && !!oneClickShares },
                })
                const previewRedeemOneClick = previewRedeemOneClickQuery.data as bigint | undefined
                const shouldQueue =
                  typeof previewRedeem === 'bigint' && typeof largeWithdrawalThreshold === 'bigint'
                    ? previewRedeem >= largeWithdrawalThreshold
                    : true
                const shouldQueueOneClick =
                  typeof previewRedeemOneClick === 'bigint' && typeof largeWithdrawalThreshold === 'bigint'
                    ? previewRedeemOneClick >= largeWithdrawalThreshold
                    : true
                const canUnwrap = isConnected && isBase && canUseSmartWallet && hasResolvedContracts && !!parsedAmount
                const canQueue = isConnected && isBase && canUseSmartWallet && hasVault && !!parsedAmount && receiverValid && shouldQueue
                const canRedeem = isConnected && isBase && canUseSmartWallet && hasVault && !!parsedAmount && receiverValid && !shouldQueue
                const canClaim = isConnected && isBase && canUseSmartWallet && hasVault && hasQueued && isUnlocked
                const canOneClick =
                  isConnected &&
                  isBase &&
                  canUseSmartWallet &&
                  hasResolvedContracts &&
                  receiverValid &&
                  typeof oneClickAmount === 'bigint' &&
                  oneClickAmount > 0n &&
                  !exceedsAvailable
                const queueConfig = {
                  address: legacy.vault as Address,
                  abi: VAULT_ABI,
                  functionName: 'queueWithdrawal',
                  args: [sharesToQueue ?? 0n, receiver as Address],
                }
                const redeemConfig = {
                  address: legacy.vault as Address,
                  abi: VAULT_ABI,
                  functionName: 'redeem',
                  args: [sharesToQueue ?? 0n, receiver as Address, canonicalCswAddress as Address],
                }
                const oneClickCalls: Array<{ to: Address; data: Hex }> = []
                if (hasVesting && hasReleasable) {
                  oneClickCalls.push({
                    to: legacy.vesting as Address,
                    data: encodeFunctionData({ abi: VESTING_ABI as any, functionName: 'release' }),
                  })
                }
                if (typeof oneClickAmount === 'bigint' && oneClickAmount > 0n) {
                  oneClickCalls.push({
                    to: legacy.wrapper as Address,
                    data: encodeFunctionData({
                      abi: WRAPPER_ABI as any,
                      functionName: 'unwrap',
                      args: [oneClickAmount],
                    }),
                  })
                  if (shouldQueueOneClick) {
                    oneClickCalls.push({
                      to: legacy.vault as Address,
                      data: encodeFunctionData({
                        abi: VAULT_ABI as any,
                        functionName: 'queueWithdrawal',
                        args: [oneClickShares ?? 0n, receiver as Address],
                      }),
                    })
                  } else {
                    oneClickCalls.push({
                      to: legacy.vault as Address,
                      data: encodeFunctionData({
                        abi: VAULT_ABI as any,
                        functionName: 'redeem',
                        args: [oneClickShares ?? 0n, receiver as Address, canonicalCswAddress as Address],
                      }),
                    })
                  }
                }

                return (
                  <div key={legacy.id} className="rounded-xl border border-white/10 bg-black/30 p-5 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="text-sm text-zinc-300">{legacy.label}</div>
                        <div className="text-xs text-zinc-600 font-mono">ShareOFT {hasShareOft ? legacy.shareOft : '—'}</div>
                        <div className="text-xs text-zinc-600 font-mono">Wrapper {hasWrapper ? legacy.wrapper : '—'}</div>
                        <div className="text-xs text-zinc-600 font-mono">Vault {hasVault ? legacy.vault : '—'}</div>
                        <div className="text-xs text-zinc-600 font-mono">Vesting {hasVesting ? legacy.vesting : '—'}</div>
                        {!hasResolvedContracts ? (
                          <div className="text-xs text-amber-300/80">
                            {legacyResolveStatus === 'loading'
                              ? 'Resolving wrapper/shareOFT/vault from registry…'
                              : 'Registry match not found for this vault.'}
                          </div>
                        ) : null}
                        {!hasVesting ? (
                          <div className="text-xs text-amber-300/80">
                            Vesting contract not found for the canonical CSW.
                          </div>
                        ) : null}
                      </div>
                        <div className="text-xs text-zinc-500">
                          {balanceLabel}: <span className="text-zinc-200">{formatToken(balance)}</span>
                        </div>
                        {hasReleasable && isBalanceZero ? (
                          <div className="text-xs text-amber-300/80">
                            Release from vesting to move ShareOFT into the canonical smart wallet.
                          </div>
                        ) : null}
                        {exceedsAvailable ? (
                          <div className="text-xs text-amber-300/80">
                            One-click amount exceeds available ShareOFT.
                          </div>
                        ) : null}
                    </div>

                    <div className="rounded-lg border border-white/10 p-4 space-y-2">
                      <div className="text-sm text-zinc-300">One-click withdraw</div>
                      <div className="text-xs text-zinc-500">
                        {shouldQueueOneClick
                          ? 'Release + unwrap + queue in a single transaction.'
                          : 'Release + unwrap + withdraw now in a single transaction.'}
                      </div>
                      <button
                        type="button"
                        onClick={() => sendBatchTx(oneClickKey, oneClickCalls)}
                        disabled={!canOneClick}
                        className="btn-accent w-full disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        One-click withdraw
                      </button>
                      <TxMeta state={txStates[oneClickKey]} />
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="rounded-lg border border-white/10 p-4 space-y-2">
                        <div className="text-sm text-zinc-300">Step 1 · Release vested ShareOFT</div>
                        <div className="text-xs text-zinc-500">
                          Releasable now: <span className="text-zinc-200">{formatToken(releasable)}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            sendTx(releaseKey, {
                              address: legacy.vesting as Address,
                              abi: VESTING_ABI,
                              functionName: 'release',
                            })
                          }
                          disabled={!isBase || !walletClient || !canUseSmartWallet || !hasVesting}
                          className="btn-accent w-full disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Release from vesting
                        </button>
                        <TxMeta state={txStates[releaseKey]} />
                      </div>

                      <div className="rounded-lg border border-white/10 p-4 space-y-2">
                        <div className="text-sm text-zinc-300">Step 2 · Unwrap ShareOFT → Vault shares</div>
                        <div className="text-xs text-zinc-500">Amount to unwrap</div>
                        <div className="flex gap-2">
                          <input
                            value={amountInput}
                            onChange={(e) => setAmounts((prev) => ({ ...prev, [legacy.id]: e.target.value }))}
                            placeholder="0.0"
                            className="flex-1 bg-transparent border border-white/10 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-white/20 font-mono"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              if (balance) setAmounts((prev) => ({ ...prev, [legacy.id]: formatToken(balance) }))
                            }}
                            className="px-3 py-2 rounded-lg border border-white/10 text-xs text-zinc-300 hover:border-white/20"
                          >
                            Max
                          </button>
                        </div>
                        <div className="text-xs text-zinc-600">
                          Vault shares to queue: <span className="text-zinc-200">{sharesToQueue ? formatToken(sharesToQueue) : '—'}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            sendTx(unwrapKey, {
                              address: legacy.wrapper as Address,
                              abi: WRAPPER_ABI,
                              functionName: 'unwrap',
                              args: [parsedAmount ?? 0n],
                            })
                          }
                          disabled={!canUnwrap}
                          className="btn-accent w-full disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Unwrap ShareOFT
                        </button>
                        <TxMeta state={txStates[unwrapKey]} />
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="rounded-lg border border-white/10 p-4 space-y-2">
                        <div className="text-sm text-zinc-300">
                          {shouldQueue ? 'Step 3 · Queue withdrawal' : 'Step 3 · Withdraw now'}
                        </div>
                        <div className="text-xs text-zinc-500">
                          {shouldQueue
                            ? 'Large withdrawals require queueing. Wait 10 blocks, then claim.'
                            : 'Small withdrawals redeem immediately (no queue).'}
                        </div>
                        <button
                          type="button"
                          onClick={() => sendTx(queueKey, shouldQueue ? queueConfig : redeemConfig)}
                          disabled={shouldQueue ? !canQueue : !canRedeem}
                          className="btn-accent w-full disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {shouldQueue ? 'Queue withdrawal' : 'Withdraw now'}
                        </button>
                        <TxMeta state={txStates[queueKey]} />
                      </div>

                      <div className="rounded-lg border border-white/10 p-4 space-y-2">
                        <div className="text-sm text-zinc-300">Step 4 · Claim queued withdrawal</div>
                        <div className="text-xs text-zinc-500">Use after 10 blocks have passed.</div>
                        {hasQueued ? (
                          <div className="text-xs text-zinc-500">
                            {isUnlocked
                              ? 'Queued withdrawal is ready to claim.'
                              : blocksRemaining !== null
                                ? `Unlocks in ~${blocksRemaining.toString()} blocks.`
                                : 'Queued withdrawal pending.'}
                          </div>
                        ) : (
                          <div className="text-xs text-zinc-500">No queued withdrawal found.</div>
                        )}
                        <button
                          type="button"
                          onClick={() =>
                            sendTx(claimKey, {
                              address: legacy.vault as Address,
                              abi: VAULT_ABI,
                              functionName: 'claimQueuedWithdrawal',
                            })
                          }
                          disabled={!canClaim}
                          className="btn-accent w-full disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Claim withdrawal
                        </button>
                        <TxMeta state={txStates[claimKey]} />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="rounded-xl border border-white/10 bg-black/30 p-5 text-xs text-zinc-500">
              Note: the deferred auction allocation held by the batcher is not withdrawable here. This panel focuses on
              vesting + wrapper withdrawals.
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export function AdminOps() {
  const mini = useMiniAppContext()
  const [capabilities, setCapabilities] = useState<string[] | null>(null)
  const [capsError, setCapsError] = useState<string | null>(null)

  const [domain, setDomain] = useState<string>(() => {
    if (typeof window === 'undefined') return DEFAULT_DOMAIN
    const qs = new URLSearchParams(window.location.search)
    const fromQuery = qs.get('domain')
    if (fromQuery) return normalizeDomain(fromQuery)
    const host = (window.location.hostname || '').trim()
    return normalizeDomain(host || DEFAULT_DOMAIN)
  })

  const [result, setResult] = useState<SignManifestResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)

  const dashboardItems = useMemo(
    () => [
      {
        id: 'waitlist',
        label: 'Approve users',
        description: 'Review waitlist signups and access status.',
        to: '/admin/waitlist',
        kind: 'route' as const,
      },
      {
        id: 'creator-access',
        label: 'Approve deploy list',
        description: 'Creator launch approvals and allowlist.',
        to: '/admin/creator-access',
        kind: 'route' as const,
      },
      {
        id: 'deploy-strategies',
        label: 'Deploy strategies',
        description: 'Charm + Ajna strategy deployments.',
        to: '/admin/deploy-strategies',
        kind: 'route' as const,
      },
      {
        id: 'deployment-status',
        label: 'Manage deployments',
        description: 'Protocol + vault status checks.',
        to: '/status',
        kind: 'route' as const,
      },
      {
        id: 'agent-registry',
        label: 'Agent registry',
        description: 'Register/update ERC-8004 agent.',
        to: '#agent-registration',
        kind: 'anchor' as const,
      },
      {
        id: 'legacy-withdrawals',
        label: 'Withdraw legacy assets',
        description: 'Withdraw old ShareOFT balances.',
        to: '#legacy-withdrawals',
        kind: 'anchor' as const,
      },
      {
        id: 'manifest-signing',
        label: 'Manifest signing',
        description: 'Generate accountAssociation JSON.',
        to: '#manifest-signing',
        kind: 'anchor' as const,
      },
    ],
    [],
  )

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const { sdk } = await import('@farcaster/miniapp-sdk')
        const caps = await sdk.getCapabilities().catch(() => null)
        if (cancelled) return

        if (!caps) {
          setCapabilities(null)
          setCapsError('Capabilities not available (not running inside an embedded app host).')
          return
        }

        setCapabilities(Array.from(caps).map(String))
        setCapsError(null)
      } catch (e: unknown) {
        if (cancelled) return
        setCapabilities(null)
        setCapsError(e instanceof Error ? e.message : 'Failed to read capabilities')
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  const canSignManifest = useMemo(() => {
    if (!capabilities) return null
    return capabilities.includes('experimental.signManifest')
  }, [capabilities])

  const accountAssociationJson = useMemo(() => {
    if (!result) return null
    return {
      accountAssociation: {
        header: result.header,
        payload: result.payload,
        signature: result.signature,
      },
    }
  }, [result])

  const decodedHeader = useMemo(() => {
    const h = result?.header
    if (!h) return null
    if (typeof window === 'undefined') return null

    // base64url decode
    const padded = h.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((h.length + 3) % 4)
    const json = atob(padded)
    return tryParseJson(json)
  }, [result?.header])

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1200)
    } catch {
      // ignore
    }
  }

  async function sign() {
    setError(null)
    setResult(null)
    setBusy(true)
    try {
      const { sdk } = await import('@farcaster/miniapp-sdk')
      const signed = await sdk.experimental.signManifest({ domain: domain.trim() || DEFAULT_DOMAIN })
      setResult({ header: signed.header, payload: signed.payload, signature: signed.signature })
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Manifest signing failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="relative pb-24 md:pb-0">
      <section id="admin-dashboard" className="cinematic-section">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="rounded-2xl border border-white/5 bg-white/3 overflow-hidden">
            <div className="px-6 py-6 sm:px-8 sm:py-8 space-y-6">
              <div className="space-y-2">
                <div className="label">Admin Ops</div>
                <div className="text-xl sm:text-2xl text-zinc-100 font-medium tracking-tight">Dashboard</div>
                <div className="text-sm text-zinc-600 max-w-prose">
                  Jump to the admin tools you use most often.
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {dashboardItems.map((item) =>
                  item.kind === 'route' ? (
                    <Link
                      key={item.id}
                      to={item.to}
                      className="rounded-xl border border-white/10 bg-black/30 px-4 py-4 text-left hover:border-white/20 transition-colors"
                    >
                      <div className="text-sm text-zinc-100">{item.label}</div>
                      <div className="text-xs text-zinc-500 mt-1">{item.description}</div>
                    </Link>
                  ) : (
                    <a
                      key={item.id}
                      href={item.to}
                      className="rounded-xl border border-white/10 bg-black/30 px-4 py-4 text-left hover:border-white/20 transition-colors"
                    >
                      <div className="text-sm text-zinc-100">{item.label}</div>
                      <div className="text-xs text-zinc-500 mt-1">{item.description}</div>
                    </a>
                  ),
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="manifest-signing" className="cinematic-section">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="rounded-2xl border border-white/5 bg-white/3 overflow-hidden">
            <div className="px-6 py-6 sm:px-8 sm:py-8 space-y-6">
              <div className="space-y-2">
                <div className="label">Admin Ops</div>
                <div className="text-xl sm:text-2xl text-zinc-100 font-medium tracking-tight">Manifest signing (developer)</div>
                <div className="text-sm text-zinc-600 max-w-prose">
                  Use this page <span className="text-zinc-300">inside the Base app preview</span> to generate the{' '}
                  <span className="font-mono text-zinc-300">accountAssociation</span> block for{' '}
                  <span className="font-mono text-zinc-300">{domain}</span>.
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-black/30 p-5 space-y-3">
                <div className="text-sm text-zinc-200">Domain to sign</div>
                <div className="text-xs text-zinc-600">
                  This must match the <span className="font-mono text-zinc-400">canonicalDomain</span> in{' '}
                  <span className="font-mono text-zinc-400">/.well-known/farcaster.json</span>.
                </div>
                <input
                  className="w-full bg-transparent border border-white/10 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-white/20"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  placeholder={DEFAULT_DOMAIN}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <a
                  href={`https://${normalizeDomain(domain)}/.well-known/farcaster.json?t=${Date.now()}`}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-zinc-200 hover:border-white/20 transition-colors inline-flex items-center justify-between"
                >
                  <span className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-300" />
                    View manifest
                  </span>
                  <ExternalLink className="w-4 h-4 text-zinc-600" />
                </a>

                <a
                  href="https://www.base.dev/preview"
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-zinc-200 hover:border-white/20 transition-colors inline-flex items-center justify-between"
                >
                  <span className="flex items-center gap-2">
                    <ExternalLink className="w-4 h-4 text-zinc-500" />
                    Base Build preview
                  </span>
                  <ExternalLink className="w-4 h-4 text-zinc-600" />
                </a>
              </div>

              <div className="rounded-xl border border-white/10 bg-black/30 p-5 space-y-3">
                <div className="text-sm text-zinc-200 flex items-center justify-between gap-3">
                  <span>Environment</span>
                  <span className="text-[11px] font-mono text-zinc-500">
                    {mini.isMiniApp === null ? 'Detecting…' : mini.isMiniApp ? 'Embedded' : 'Web'}
                  </span>
                </div>

                <div className="text-xs text-zinc-600 space-y-1">
                  <div>
                    User: <span className="text-zinc-400">{mini.username ? `@${mini.username}` : '—'}</span>
                    {mini.fid ? <span className="text-zinc-700"> · </span> : null}
                    {mini.fid ? <span className="text-zinc-500">FID {mini.fid}</span> : null}
                  </div>
                  <div>
                    Capabilities:{' '}
                    {capabilities ? (
                      <span className="text-zinc-400">
                        {canSignManifest === true ? 'signManifest supported' : canSignManifest === false ? 'signManifest not supported' : '—'}
                      </span>
                    ) : (
                      <span className="text-zinc-500">{capsError ?? '—'}</span>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => void sign()}
                  disabled={busy || mini.isMiniApp === false || canSignManifest === false}
                  className="w-full sm:w-auto btn-accent rounded-lg px-5 py-3 text-sm disabled:opacity-60"
                  title={mini.isMiniApp === false ? 'Open this page inside Base app preview to sign.' : undefined}
                >
                  {busy ? 'Signing…' : 'Generate accountAssociation'}
                </button>

                {error ? <div className="text-[11px] text-red-400/90">{error}</div> : null}
              </div>

              {accountAssociationJson ? (
                <div className="rounded-xl border border-white/10 bg-black/30 p-5 space-y-3">
                  <div className="text-sm text-zinc-200 flex items-center justify-between gap-3">
                    <span>Copy/paste this</span>
                    <button
                      type="button"
                      onClick={() => void copy(JSON.stringify(accountAssociationJson.accountAssociation, null, 2))}
                      className="inline-flex items-center gap-2 text-xs text-zinc-500 hover:text-zinc-200 transition-colors"
                      title="Copy accountAssociation JSON"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      {copied ? 'Copied' : 'Copy'}
                    </button>
                  </div>

                  <pre className="text-[11px] leading-relaxed text-zinc-300 bg-black/40 border border-white/5 rounded-lg p-4 overflow-auto">
{JSON.stringify(accountAssociationJson.accountAssociation, null, 2)}
                  </pre>

                  {decodedHeader && typeof decodedHeader === 'object' ? (
                    <div className="text-[11px] text-zinc-600">
                      Header (decoded): <span className="text-zinc-500">{JSON.stringify(decodedHeader)}</span>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <AgentRegistration />
      <LegacyWithdrawals />
    </div>
  )
}
