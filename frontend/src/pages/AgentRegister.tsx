import { useCallback, useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Bot, CheckCircle2, ExternalLink, Loader2, Shield, Sparkles, Zap } from 'lucide-react'
import { getAddress, parseAbiItem, parseEventLogs, type Address, type Hex } from 'viem'
import { base } from 'viem/chains'
import { useAccount, usePublicClient, useSwitchChain, useWalletClient } from 'wagmi'

import { META, PageMeta } from '@/components/seo/PageMeta'
import { apiFetch } from '@/lib/apiBase'
import { signInWithSiwaAgent } from '@/lib/siwaAgentAuth'

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

type ApiEnvelope<T> = { success: boolean; data?: T; error?: string }

type WaitlistMeData = {
  profileId: number
  cswAddress?: string | null
  primarySmartWallet?: string | null
  baseSubAccount?: string | null
  farcasterFid?: number | null
  preprovFarcasterUsername?: string | null
  lensHandle?: string | null
  lensAccountAddress?: string | null
  erc8128AgentId?: string | null
  connectedAccounts?: Array<{ address?: string | null; isCanonicalSmartWallet?: boolean }>
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
  const publicClient = usePublicClient({ chainId: base.id }) ?? usePublicClient()
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

  const canonicalSmartWalletAddress = useMemo(() => {
    const row = waitlistMeQuery.data
    const candidates: Array<string | null | undefined> = [
      ...(Array.isArray(row?.connectedAccounts)
        ? row.connectedAccounts
            .filter((item) => item?.isCanonicalSmartWallet)
            .map((item) => (typeof item?.address === 'string' ? item.address : null))
        : []),
      row?.cswAddress,
      row?.primarySmartWallet,
      row?.baseSubAccount,
    ]
    for (const value of candidates) {
      if (!isAddressLike(value)) continue
      return value.toLowerCase()
    }
    return null
  }, [waitlistMeQuery.data])
  const isConnectedCanonicalCsw = Boolean(canonicalSmartWalletAddress && connectedAddressLc === canonicalSmartWalletAddress)
  const canSubmit = Boolean(canUseConnectedWallet && isConnectedCanonicalCsw && agentUri.trim())

  const agentQuery = useQuery({
    queryKey: ['agent-register', 'xmtp-agent', canonicalSmartWalletAddress, connectedAddressLc],
    queryFn: async (): Promise<AgentData | null> => {
      const res = await apiFetch('/api/v1/agents/creators?listed=false&limit=200')
      const json = (await res.json().catch(() => null)) as ApiEnvelope<{ agents: AgentData[] }> | null
      if (!res.ok || !json?.success || !json.data) return null
      const needles = new Set([canonicalSmartWalletAddress, connectedAddressLc].filter(Boolean))
      const match = json.data.agents.find((item) => {
        const creator = String(item.creatorAddress ?? '').toLowerCase()
        const csw = String(item.cswAddress ?? '').toLowerCase()
        return needles.has(creator) || (csw && needles.has(csw))
      })
      return match ?? null
    },
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
    if (connectedAddressLc !== canonicalSmartWalletAddress) {
      setError(
        `Connect your canonical Zora CSW (${canonicalSmartWalletAddress}) before registering. This ensures the CSW itself becomes the onchain agent owner.`,
      )
      return
    }
    const uri = agentUri.trim()
    if (!uri) return

    setBusy(true)
    setError(null)
    setSuccess(null)
    setTxHash(null)
    setRegisteredAgentId(null)
    try {
      await ensureBaseChain()
      const account = getAddress(connectedAddress as Address)

      const sim = await publicClient.simulateContract({
        account,
        address: registryAddress,
        abi: ERC8004_IDENTITY_REGISTRY_ABI,
        functionName: 'register',
        args: [uri],
      })
      const hashRaw = await walletClient.writeContract(sim.request)
      const tx = String(hashRaw ?? '').trim() as Hex
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
    connectedAddress,
    connectedAddressLc,
    ensureBaseChain,
    publicClient,
    registryAddress,
    walletClient,
  ])

  useEffect(() => {
    if (!registeredAgentId) return
    setSiwaAgentIdInput((prev) => (prev.trim() ? prev : registeredAgentId))
  }, [registeredAgentId])

  const hasXmtpAgent = Boolean(agentQuery.data?.xmtpAgentAddress)
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
        {!isConnectedCanonicalCsw ? (
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
          {!isConnected ? <span className="text-xs text-zinc-500">Connect wallet to continue.</span> : null}
          {isConnected && !isConnectedCanonicalCsw ? (
            <span className="text-xs text-amber-300">Switch to your canonical Zora CSW to register.</span>
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
            <div className="font-mono text-zinc-200">{agentQuery.data?.xmtpAgentAddress ? shortAddress(agentQuery.data.xmtpAgentAddress) : 'Not enabled yet'}</div>
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

