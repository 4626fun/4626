import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useWallets } from '@privy-io/react-auth'
import { useAccount, usePublicClient, useWalletClient } from 'wagmi'
import { Bot, CheckCircle, Copy, ExternalLink, Link2, Shield, Loader2, AlertTriangle, Wallet, Zap } from 'lucide-react'
import { encodeFunctionData, getAddress } from 'viem'

import {
  AjnaAutomationOptInCard,
  type AjnaAutomationPayload,
  type AjnaAutomationStatus,
} from '@/components/DeploymentSuccess'
import { getDeploymentsForOwner } from '@/hooks/useDeploymentTracker'
import { useSiweAuth } from '@/hooks/useSiweAuth'
import { apiFetch } from '@/lib/apiBase'
import { resolveBaseAppInviteUrl } from '@/lib/baseAppInvite'
import { getAppBaseUrl } from '@/lib/host'
import { pickPrivyEmbeddedEoaWallet } from '@/lib/privyEmbeddedEoa'

export { AjnaAutomationOptInCard } from '@/components/DeploymentSuccess'
export { pickPrivyEmbeddedEoaWallet } from '@/lib/privyEmbeddedEoa'

type ApiEnvelope<T> = { success: boolean; data?: T; error?: string }

type AgentData = {
  creatorAddress: string
  xmtpAgentAddress: string
  agentType?: 'eoa' | 'csw'
  cswAddress?: string | null
  listedPublicly: boolean
  createdAt: string
  updatedAt: string
}

type VaultUpsertResponse = {
  vaultAddress: `0x${string}`
  groupId: string
  lensGroupAddress: `0x${string}` | null
  configHash: string
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

type WaitlistMeData = {
  cswAddress?: string | null
  primarySmartWallet?: string | null
  baseSubAccount?: string | null
  connectedAccounts?: Array<{ address?: string | null; isCanonicalSmartWallet?: boolean }>
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isAddressLike(v: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/i.test(v)
}

function truncAddr(addr: string): string {
  if (addr.length < 12) return addr
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

function buildAgentChatActionLink(agentAddress: string): string {
  const url = new URL('/', getAppBaseUrl())
  url.searchParams.set('chatAction', 'help')
  url.searchParams.set('chatPeer', agentAddress)
  url.searchParams.set('chatName', 'Keepr Agent')
  return url.toString()
}

async function provisionServerWallet(creatorAddress: string): Promise<{ walletId: string; address: string }> {
  const res = await apiFetch('/api/v1/agents/creators/provision-wallet', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ creatorAddress }),
  })
  const json = (await res.json().catch(() => null)) as ApiEnvelope<{ walletId: string; address: string }> | null
  if (!res.ok || !json?.success || !json.data) {
    throw new Error(json?.error ?? 'Failed to provision Keepr signer')
  }
  return json.data
}

async function enableCswAgent(params: {
  cswAddress: string
  privyWalletId: string
  listed?: boolean
}): Promise<AgentData> {
  const res = await apiFetch('/api/v1/agents/creators/enable', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      listedPublicly: params.listed ?? true,
      agentType: 'csw',
      cswAddress: params.cswAddress,
      privyWalletId: params.privyWalletId,
    }),
  })
  const json = (await res.json().catch(() => null)) as ApiEnvelope<AgentData> | null
  if (!res.ok || !json?.success || !json.data) throw new Error(json?.error ?? 'Failed to enable CSW agent')
  return json.data
}

async function publishAgentProfile(): Promise<PublishData> {
  const res = await apiFetch('/api/v1/agents/publish', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ storeOnGrove: true }),
  })
  const json = (await res.json().catch(() => null)) as ApiEnvelope<PublishData> | null
  if (!res.ok || !json?.success || !json.data) throw new Error(json?.error ?? 'Failed to publish agent profile')
  return json.data
}

async function getAjnaAutomationStatus(vaultAddress: string): Promise<AjnaAutomationStatus | null> {
  const params = new URLSearchParams({ vaultAddress })
  const res = await apiFetch(`/api/keepr/vault/automation?${params.toString()}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  })
  const json = (await res.json().catch(() => null)) as ApiEnvelope<AjnaAutomationStatus | null> | null
  if (!res.ok || !json?.success) {
    throw new Error(json?.error ?? 'Failed to load Ajna automation status')
  }
  return json.data ?? null
}

async function enableAjnaAutomation(payload: AjnaAutomationPayload): Promise<AjnaAutomationStatus> {
  const res = await apiFetch('/api/keepr/vault/automation', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const json = (await res.json().catch(() => null)) as ApiEnvelope<AjnaAutomationStatus> | null
  if (!res.ok || !json?.success || !json.data) {
    throw new Error(json?.error ?? 'Failed to enable Ajna automation')
  }
  return json.data
}

async function revokeAjnaAutomation(vaultAddress: string): Promise<AjnaAutomationStatus> {
  const res = await apiFetch('/api/keepr/vault/automation', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ vaultAddress }),
  })
  const json = (await res.json().catch(() => null)) as ApiEnvelope<AjnaAutomationStatus> | null
  if (!res.ok || !json?.success || !json.data) {
    throw new Error(json?.error ?? 'Failed to revoke Ajna automation')
  }
  return json.data
}

function getPrivyWalletId(wallet: unknown): string | null {
  const raw = typeof (wallet as { id?: unknown } | null)?.id === 'string'
    ? String((wallet as { id: string }).id).trim()
    : ''
  return raw || null
}

type AjnaAutomationMutationSnapshot<TVariables> = {
  data?: AjnaAutomationStatus | null
  error?: unknown
  variables?: TVariables
}

function normalizeAjnaVaultCandidate(value: string | null | undefined): string | null {
  const raw = typeof value === 'string' ? value.trim() : ''
  return isAddressLike(raw) ? raw.toLowerCase() : null
}

function getAjnaMutationVaultAddress(variables: AjnaAutomationPayload | string | undefined): string | null {
  if (typeof variables === 'string') return normalizeAjnaVaultCandidate(variables)
  return normalizeAjnaVaultCandidate(variables?.vaultAddress)
}

function getAjnaErrorMessage(error: unknown): string | null {
  return error instanceof Error ? error.message : null
}

export function selectAjnaAutomationViewState(input: {
  normalizedVaultAddress: string | null
  queryStatus: AjnaAutomationStatus | null | undefined
  queryError?: unknown
  enableMutation: AjnaAutomationMutationSnapshot<AjnaAutomationPayload>
  revokeMutation: AjnaAutomationMutationSnapshot<string>
}): {
  status: AjnaAutomationStatus | null
  errorMessage: string | null
  statusUnavailable: boolean
} {
  const currentVaultAddress = normalizeAjnaVaultCandidate(input.normalizedVaultAddress)
  if (!currentVaultAddress) {
    return { status: null, errorMessage: null, statusUnavailable: false }
  }

  const matchesStatus = (status: AjnaAutomationStatus | null | undefined): boolean =>
    normalizeAjnaVaultCandidate(status?.vaultAddress ?? null) === currentVaultAddress

  const matchesMutation = (variables: AjnaAutomationPayload | string | undefined): boolean =>
    getAjnaMutationVaultAddress(variables) === currentVaultAddress

  const status = matchesStatus(input.queryStatus) ? input.queryStatus ?? null : null
  const mutationErrorMessage =
    (matchesMutation(input.enableMutation.variables) ? getAjnaErrorMessage(input.enableMutation.error) : null) ??
    (matchesMutation(input.revokeMutation.variables) ? getAjnaErrorMessage(input.revokeMutation.error) : null) ??
    null
  const queryErrorMessage = getAjnaErrorMessage(input.queryError)
  const statusUnavailable = status === null && queryErrorMessage !== null

  return {
    status,
    errorMessage: mutationErrorMessage ?? (statusUnavailable ? queryErrorMessage : null),
    statusUnavailable,
  }
}

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider ${
        ok ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-zinc-500/10 text-zinc-400 border border-zinc-500/20'
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${ok ? 'bg-emerald-400' : 'bg-zinc-500'}`} />
      {label}
    </span>
  )
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      }}
      className="text-zinc-500 hover:text-zinc-300 transition-colors"
      title="Copy"
    >
      {copied ? <CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

// Coinbase Smart Wallet ABI for addOwnerAddress + isOwnerAddress
const CSW_ABI = [
  {
    type: 'function' as const,
    name: 'addOwnerAddress',
    stateMutability: 'nonpayable' as const,
    inputs: [{ name: 'owner', type: 'address' as const }],
    outputs: [],
  },
  {
    type: 'function' as const,
    name: 'isOwnerAddress',
    stateMutability: 'view' as const,
    inputs: [{ name: 'account', type: 'address' as const }],
    outputs: [{ name: '', type: 'bool' as const }],
  },
] as const

export function AdminAgentSetup() {
  const { address } = useAccount()
  const { authAddress } = useSiweAuth()
  const { wallets: privyWallets } = useWallets()
  const queryClient = useQueryClient()
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()

  const creatorAddress = useMemo(() => {
    const addr = authAddress ?? address
    return addr ? String(addr).toLowerCase() : null
  }, [authAddress, address])

  const waitlistMeQuery = useQuery({
    queryKey: ['admin', 'waitlist-me', creatorAddress],
    queryFn: async (): Promise<WaitlistMeData | null> => {
      const res = await apiFetch('/api/waitlist/me', { method: 'GET', headers: { Accept: 'application/json' } })
      const json = (await res.json().catch(() => null)) as ApiEnvelope<WaitlistMeData | null> | null
      if (!res.ok || !json?.success) return null
      return json.data ?? null
    },
    enabled: Boolean(creatorAddress),
    staleTime: 15_000,
  })

  const canonicalCswAddress = useMemo(() => {
    const row = waitlistMeQuery.data
    const rawCandidates = [
      row?.cswAddress,
      row?.primarySmartWallet,
      row?.baseSubAccount,
      ...(Array.isArray(row?.connectedAccounts)
        ? row.connectedAccounts.filter((item) => item?.isCanonicalSmartWallet).map((item) => item?.address ?? null)
        : []),
    ]
    for (const candidate of rawCandidates) {
      const value = typeof candidate === 'string' ? candidate.trim() : ''
      if (!isAddressLike(value)) continue
      return value.toLowerCase()
    }
    return null
  }, [waitlistMeQuery.data])

  const privyEmbeddedEoaWallet = useMemo(() => {
    const wallets = Array.isArray(privyWallets) ? (privyWallets as any[]) : []
    return pickPrivyEmbeddedEoaWallet(wallets, canonicalCswAddress)
  }, [canonicalCswAddress, privyWallets])

  const privyEmbeddedEoaAddress = useMemo(() => {
    const rawAddress = typeof (privyEmbeddedEoaWallet as any)?.address === 'string'
      ? String((privyEmbeddedEoaWallet as any).address).trim()
      : ''
    if (!isAddressLike(rawAddress)) return null
    return rawAddress.toLowerCase()
  }, [privyEmbeddedEoaWallet])

  const privyEmbeddedEoaWalletId = useMemo(
    () => getPrivyWalletId(privyEmbeddedEoaWallet),
    [privyEmbeddedEoaWallet],
  )

  const baseAppInviteHref = useMemo(() => resolveBaseAppInviteUrl(), [])

  // -----------------------------------------------------------------------
  // Agent status
  // -----------------------------------------------------------------------
  const agentQuery = useQuery({
    queryKey: ['admin', 'agent', creatorAddress],
    queryFn: async (): Promise<AgentData | null> => {
      if (!creatorAddress) return null
      const res = await apiFetch('/api/v1/agents/creators?listed=false&limit=200')
      const json = (await res.json().catch(() => null)) as ApiEnvelope<{ agents: AgentData[] }> | null
      if (!res.ok || !json?.success || !json.data) return null
      const match = json.data.agents.find((a) => a.creatorAddress.toLowerCase() === creatorAddress)
      return match ?? null
    },
    enabled: Boolean(creatorAddress),
    staleTime: 15_000,
  })

  const [agentMode, setAgentMode] = useState<'csw' | 'eoa'>('csw')

  // -----------------------------------------------------------------------
  // Server wallet provisioning (for CSW mode — needed to sign server-side)
  // -----------------------------------------------------------------------
  const serverWalletQuery = useQuery({
    queryKey: ['admin', 'serverWallet', canonicalCswAddress],
    queryFn: async (): Promise<{ walletId: string; address: string } | null> => {
      if (!canonicalCswAddress) return null
      try {
        return await provisionServerWallet(canonicalCswAddress)
      } catch {
        return null
      }
    },
    enabled: Boolean(canonicalCswAddress) && agentMode === 'csw',
    staleTime: 60_000,
  })

  // -----------------------------------------------------------------------
  // Check if the server wallet is already an owner of the CSW
  // -----------------------------------------------------------------------
  const isOwnerQuery = useQuery({
    queryKey: ['admin', 'isOwner', canonicalCswAddress, serverWalletQuery.data?.address],
    queryFn: async (): Promise<boolean> => {
      if (!canonicalCswAddress || !serverWalletQuery.data?.address || !publicClient) return false
      try {
        const result = await publicClient.readContract({
          address: getAddress(canonicalCswAddress) as `0x${string}`,
          abi: CSW_ABI,
          functionName: 'isOwnerAddress',
          args: [getAddress(serverWalletQuery.data.address) as `0x${string}`],
        })
        return Boolean(result)
      } catch {
        // Not a CSW or contract call failed
        return false
      }
    },
    enabled: Boolean(canonicalCswAddress) && Boolean(serverWalletQuery.data?.address) && Boolean(publicClient),
    staleTime: 15_000,
  })

  // -----------------------------------------------------------------------
  // Add server wallet as owner of CSW
  // -----------------------------------------------------------------------
  const addOwnerMutation = useMutation({
    mutationFn: async () => {
      if (!walletClient || !canonicalCswAddress || !serverWalletQuery.data?.address) {
        throw new Error('Wallet not connected or server wallet not provisioned')
      }
      const data = encodeFunctionData({
        abi: CSW_ABI,
        functionName: 'addOwnerAddress',
        args: [getAddress(serverWalletQuery.data.address) as `0x${string}`],
      })
      const hash = await walletClient.sendTransaction({
        to: getAddress(canonicalCswAddress) as `0x${string}`,
        data,
        chain: walletClient.chain,
      })
      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash })
      }
      return hash
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'isOwner'] })
    },
  })

  // -----------------------------------------------------------------------
  // Enable agent
  // -----------------------------------------------------------------------
  const enableMutation = useMutation({
    mutationFn: async (params: {
      listed: boolean
      agentType?: 'eoa' | 'csw'
      cswAddress?: string
      privyWalletId?: string
    }) => {
      const body: Record<string, any> = { listedPublicly: params.listed }
      if (params.agentType === 'csw') {
        body.agentType = 'csw'
        body.cswAddress = params.cswAddress
        body.privyWalletId = params.privyWalletId
      }
      const res = await apiFetch('/api/v1/agents/creators/enable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = (await res.json().catch(() => null)) as ApiEnvelope<AgentData> | null
      if (!res.ok || !json?.success) throw new Error(json?.error ?? 'Failed to enable agent')
      return json.data!
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'agent'] })
    },
  })

  const agent = agentQuery.data
  const serverWallet = serverWalletQuery.data
  const isServerWalletOwner = isOwnerQuery.data === true

  // -----------------------------------------------------------------------
  // Vault link form state
  // -----------------------------------------------------------------------
  const [ajnaVaultAddress, setAjnaVaultAddress] = useState('')
  const [vaultAddress, setVaultAddress] = useState('')
  const [groupId, setGroupId] = useState('')
  const [lensGroupAddress, setLensGroupAddress] = useState('')
  const [lensMetadataUri, setLensMetadataUri] = useState('')
  const [creatorCoinAddress, setCreatorCoinAddress] = useState('')
  const [gatingEnabled, setGatingEnabled] = useState(true)
  const [gatingMode, setGatingMode] = useState<'shares' | 'none'>('shares')
  const [minShares, setMinShares] = useState('1')
  const [joinLocked, setJoinLocked] = useState(false)

  const lensGroupValid = useMemo(() => {
    const raw = lensGroupAddress.trim()
    return raw.length === 0 || isAddressLike(raw)
  }, [lensGroupAddress])

  const hydratedAjnaVaultAddress = useMemo(() => {
    if (!canonicalCswAddress) return ''

    const latestDeployment = getDeploymentsForOwner(canonicalCswAddress as `0x${string}`)
      .filter((record) => isAddressLike(record.contracts.vault))
      .sort((a, b) => b.deployedAt - a.deployedAt)[0]

    return latestDeployment?.contracts.vault?.toLowerCase() ?? ''
  }, [canonicalCswAddress])

  const effectiveAjnaVaultAddress = useMemo(() => {
    const raw = ajnaVaultAddress.trim()
    if (raw.length > 0) return raw
    return hydratedAjnaVaultAddress
  }, [ajnaVaultAddress, hydratedAjnaVaultAddress])

  const normalizedAjnaVaultAddress = useMemo(() => {
    const raw = effectiveAjnaVaultAddress.trim()
    return isAddressLike(raw) ? raw.toLowerCase() : null
  }, [effectiveAjnaVaultAddress])

  const vaultFormValid = useMemo(() => {
    return (
      isAddressLike(vaultAddress) &&
      groupId.trim().length > 0 &&
      lensGroupValid &&
      isAddressLike(creatorCoinAddress) &&
      creatorAddress !== null
    )
  }, [vaultAddress, groupId, lensGroupValid, creatorCoinAddress, creatorAddress])

  const vaultMutation = useMutation({
    mutationFn: async () => {
      if (!creatorAddress) throw new Error('Not signed in')
      const lensGroupAddressTrimmed = lensGroupAddress.trim()
      const lensMetadataUriTrimmed = lensMetadataUri.trim()

      const config = {
        version: 1,
        chainId: 8453,
        vault: {
          vaultAddress: vaultAddress.toLowerCase() as `0x${string}`,
          creatorCoinAddress: creatorCoinAddress.toLowerCase() as `0x${string}`,
          canonicalOwnerAddress: creatorAddress as `0x${string}`,
        },
        xmtp: {
          groupId: groupId.trim(),
          agentInboxId: agent?.xmtpAgentAddress ?? undefined,
        },
        lens:
          lensGroupAddressTrimmed || lensMetadataUriTrimmed
            ? {
                groupAddress: lensGroupAddressTrimmed
                  ? (lensGroupAddressTrimmed.toLowerCase() as `0x${string}`)
                  : undefined,
                metadataUri: lensMetadataUriTrimmed || undefined,
              }
            : undefined,
        gating: {
          enabled: gatingEnabled,
          joinLocked,
          mode: gatingMode,
          thresholds: gatingMode === 'shares' ? { minShares: String(minShares || '1') } : undefined,
          failClosed: true,
        },
        roles: {
          owner: creatorAddress as `0x${string}`,
        },
      }

      const res = await apiFetch('/api/keepr/vault/upsert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config }),
      })
      const json = (await res.json().catch(() => null)) as ApiEnvelope<VaultUpsertResponse> | null
      if (!res.ok || !json?.success) throw new Error(json?.error ?? 'Failed to link vault')
      return json.data!
    },
    onSuccess: (data) => {
      setAjnaVaultAddress(String(data.vaultAddress).toLowerCase())
      void queryClient.invalidateQueries({ queryKey: ['admin', 'agent'] })
    },
  })

  const ajnaAutomationQuery = useQuery({
    queryKey: ['admin', 'ajna-automation', normalizedAjnaVaultAddress],
    queryFn: async (): Promise<AjnaAutomationStatus | null> => {
      if (!normalizedAjnaVaultAddress) return null
      return getAjnaAutomationStatus(normalizedAjnaVaultAddress)
    },
    enabled: Boolean(normalizedAjnaVaultAddress),
    staleTime: 15_000,
  })

  const ajnaAutomationEnableMutation = useMutation({
    mutationFn: async (payload: AjnaAutomationPayload): Promise<AjnaAutomationStatus> => enableAjnaAutomation(payload),
    onSuccess: (data) => {
      const normalizedVaultAddress = normalizeAjnaVaultCandidate(data.vaultAddress)
      if (normalizedVaultAddress) {
        queryClient.setQueryData(['admin', 'ajna-automation', normalizedVaultAddress], {
          ...data,
          vaultAddress: normalizedVaultAddress,
        })
        setAjnaVaultAddress(normalizedVaultAddress)
      } else {
        setAjnaVaultAddress(data.vaultAddress)
      }
      void queryClient.invalidateQueries({ queryKey: ['admin', 'ajna-automation'] })
    },
  })

  const ajnaAutomationRevokeMutation = useMutation({
    mutationFn: async (vaultAddress: string): Promise<AjnaAutomationStatus> => revokeAjnaAutomation(vaultAddress),
    onSuccess: (data) => {
      const normalizedVaultAddress = normalizeAjnaVaultCandidate(data.vaultAddress)
      if (normalizedVaultAddress) {
        queryClient.setQueryData(['admin', 'ajna-automation', normalizedVaultAddress], {
          ...data,
          vaultAddress: normalizedVaultAddress,
        })
        setAjnaVaultAddress(normalizedVaultAddress)
      } else {
        setAjnaVaultAddress(data.vaultAddress)
      }
      void queryClient.invalidateQueries({ queryKey: ['admin', 'ajna-automation'] })
    },
  })

  const ajnaAutomationViewState = selectAjnaAutomationViewState({
    normalizedVaultAddress: normalizedAjnaVaultAddress,
    queryStatus: ajnaAutomationQuery.data,
    queryError: ajnaAutomationQuery.error,
    enableMutation: {
      data: ajnaAutomationEnableMutation.data,
      error: ajnaAutomationEnableMutation.error,
      variables: ajnaAutomationEnableMutation.variables,
    },
    revokeMutation: {
      data: ajnaAutomationRevokeMutation.data,
      error: ajnaAutomationRevokeMutation.error,
      variables: ajnaAutomationRevokeMutation.variables,
    },
  })
  const ajnaAutomationStatus = ajnaAutomationViewState.status
  const ajnaAutomationError = ajnaAutomationViewState.errorMessage
  const ajnaAutomationStatusUnavailable = ajnaAutomationViewState.statusUnavailable
  const publishMutation = useMutation({
    mutationFn: async (): Promise<PublishData> => publishAgentProfile(),
  })

  const oneClickMutation = useMutation({
    mutationFn: async (): Promise<{
      wallet: { walletId: string; address: string }
      ownerTxHash: `0x${string}` | null
      agent: AgentData
      publish: PublishData
    }> => {
      if (!creatorAddress) throw new Error('Connect your wallet first')
      if (!canonicalCswAddress) throw new Error('Create or connect your canonical Coinbase Smart Wallet first.')

      const wallet = serverWallet ?? (await provisionServerWallet(canonicalCswAddress))
      let ownerTxHash: `0x${string}` | null = null

      let ownerReady = isServerWalletOwner
      if (!ownerReady) {
        if (!walletClient) throw new Error('Connect an owner wallet to approve one onchain transaction')
        const data = encodeFunctionData({
          abi: CSW_ABI,
          functionName: 'addOwnerAddress',
          args: [getAddress(wallet.address) as `0x${string}`],
        })
        const hash = await walletClient.sendTransaction({
          to: getAddress(canonicalCswAddress) as `0x${string}`,
          data,
          chain: walletClient.chain,
        })
        ownerTxHash = hash
        if (publicClient) {
          await publicClient.waitForTransactionReceipt({ hash })
          try {
            const result = await publicClient.readContract({
              address: getAddress(canonicalCswAddress) as `0x${string}`,
              abi: CSW_ABI,
              functionName: 'isOwnerAddress',
              args: [getAddress(wallet.address) as `0x${string}`],
            })
            ownerReady = Boolean(result)
          } catch {
            ownerReady = false
          }
        }
        if (!ownerReady) {
          throw new Error('Owner link was not confirmed yet. Retry in a few seconds.')
        }
      }

      const agent = await enableCswAgent({
        cswAddress: canonicalCswAddress,
        privyWalletId: wallet.walletId,
        listed: true,
      })
      const publish = await publishAgentProfile()
      return { wallet, ownerTxHash, agent, publish }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'serverWallet'] })
      void queryClient.invalidateQueries({ queryKey: ['admin', 'isOwner'] })
      void queryClient.invalidateQueries({ queryKey: ['admin', 'agent'] })
    },
  })

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-display text-white">Agent Setup</h2>
          <p className="text-xs text-zinc-500 mt-1">Enable your XMTP agent, link a vault group, and configure gating.</p>
        </div>
        {creatorAddress ? <span className="app-meta-value text-zinc-600">{truncAddr(creatorAddress)}</span> : null}
      </div>

      <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 px-4 py-3">
        <div className="text-xs font-medium text-indigo-200">How this stack is actually used right now</div>
        <div className="mt-2 grid gap-2 app-meta-value text-zinc-300 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <span className="text-indigo-300">Coinbase Smart Wallet:</span> canonical creator identity and ownership checks.
          </div>
          <div>
            <span className="text-indigo-300">ERC-4337 + batching + paymaster:</span> gas-sponsored, multi-call admin/deploy actions.
          </div>
          <div>
            <span className="text-indigo-300">SIWA:</span> signed session auth for privileged agent API calls.
          </div>
          <div>
            <span className="text-indigo-300">ERC-8004:</span> onchain agent identity registration and reputation anchor.
          </div>
          <div>
            <span className="text-indigo-300">XMTP:</span> creator/agent messaging and notifications.
          </div>
          <div>
            <span className="text-indigo-300">Lens + Grove:</span> discovery plus portable, content-addressed agent metadata.
          </div>
        </div>
        <div className="mt-3 rounded-lg border border-white/10 bg-black/20 px-3 py-2 app-meta-value text-zinc-400">
          <span className="text-zinc-200">Also in stack:</span> ElizaOS + skills are the orchestration layer for agent behaviors and tool workflows. They are optional runtime logic on top of this identity/auth/messaging foundation.
        </div>
        <div className="mt-2 app-meta-value text-zinc-400">
          In short: <span className="text-zinc-200">CSW is identity</span>, <span className="text-zinc-200">ERC-4337/paymaster is execution</span>, <span className="text-zinc-200">SIWA is auth</span>, <span className="text-zinc-200">ERC-8004 + Lens/Grove are discoverability/reputation</span>, <span className="text-zinc-200">XMTP is communication</span>, and <span className="text-zinc-200">ElizaOS/skills are automation</span>.
        </div>
      </div>

      <AjnaAutomationOptInCard
        vaultAddress={effectiveAjnaVaultAddress}
        canonicalCswAddress={canonicalCswAddress}
        embeddedEoaAddress={privyEmbeddedEoaAddress}
        privyWalletId={privyEmbeddedEoaWalletId}
        status={ajnaAutomationStatus}
        statusUnavailable={ajnaAutomationStatusUnavailable}
        isSubmitting={ajnaAutomationEnableMutation.isPending}
        isRevoking={ajnaAutomationRevokeMutation.isPending}
        isStatusLoading={ajnaAutomationQuery.isLoading}
        errorMessage={ajnaAutomationError}
        onVaultAddressChange={setAjnaVaultAddress}
        onEnable={(payload) => {
          void ajnaAutomationEnableMutation.mutateAsync(payload)
        }}
        onRevoke={(nextVaultAddress) => {
          void ajnaAutomationRevokeMutation.mutateAsync(nextVaultAddress)
        }}
      />

      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs font-medium text-emerald-200">Unified Agent Publish (Week 4)</div>
            <div className="app-meta-value text-zinc-400">One click publishes ERC-8004 registration and stores deterministic Lens/Grove metadata.</div>
          </div>
          <button
            type="button"
            onClick={() => publishMutation.mutate()}
            disabled={publishMutation.isPending}
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-3 py-1.5 text-[11px] text-emerald-200 hover:bg-emerald-400/15 disabled:opacity-60"
          >
            {publishMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
            Publish Agent
          </button>
        </div>
        {publishMutation.data?.grove?.lensUri ? (
          <a href={publishMutation.data.grove.gatewayUrl} target="_blank" rel="noreferrer" className="app-meta-value text-emerald-300 underline">
            Published URI: {publishMutation.data.grove.lensUri}
          </a>
        ) : null}
        {publishMutation.error ? (
          <div className="app-meta-value text-red-300">{(publishMutation.error as Error).message}</div>
        ) : null}
      </div>

      {/* Step 1: Enable Agent */}
      <div className="rounded-xl border border-white/10 bg-black/30 overflow-hidden">
        <div className="px-5 py-4 border-b border-white/5 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
            <Bot className="w-4 h-4 text-indigo-400" />
          </div>
          <div>
            <div className="text-sm text-white font-medium">1. XMTP Agent</div>
            <div className="app-meta-value text-zinc-500">Set up your creator agent identity</div>
          </div>
          <div className="ml-auto">
            {agentQuery.isLoading ? (
              <Loader2 className="w-4 h-4 text-zinc-500 animate-spin" />
            ) : agent ? (
              <StatusBadge ok label={agent.agentType === 'csw' ? 'CSW Active' : 'Active'} />
            ) : (
              <StatusBadge ok={false} label="Not enabled" />
            )}
          </div>
        </div>

        <div className="px-5 py-4 space-y-4">
          {agent ? (
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Agent Address</div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-zinc-300">{truncAddr(agent.xmtpAgentAddress)}</span>
                    <CopyButton text={agent.xmtpAgentAddress} />
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Type</div>
                  <span className="text-xs text-zinc-300">
                    {agent.agentType === 'csw' ? 'Zora Smart Wallet' : 'Generated EOA'}
                  </span>
                </div>
              </div>
              {agent.agentType === 'csw' && agent.cswAddress && (
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Canonical Smart Wallet</div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-emerald-400">{truncAddr(agent.cswAddress)}</span>
                    <CopyButton text={agent.cswAddress} />
                    <a
                      href={`https://basescan.org/address/${agent.cswAddress}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-zinc-500 hover:text-zinc-300 transition-colors"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-2 text-xs">
                <a
                  href={buildAgentChatActionLink(agent.xmtpAgentAddress)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  Open guided chat <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <div className="flex items-center gap-2">
                {!agent.listedPublicly && (
                  <button
                    type="button"
                    onClick={() => void enableMutation.mutateAsync({ listed: true })}
                    disabled={enableMutation.isPending}
                    className="text-xs px-3 py-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
                  >
                    {enableMutation.isPending ? 'Updating...' : 'Make public'}
                  </button>
                )}
                {agent.listedPublicly && (
                  <button
                    type="button"
                    onClick={() => void enableMutation.mutateAsync({ listed: false })}
                    disabled={enableMutation.isPending}
                    className="text-xs px-3 py-1.5 rounded-lg border border-zinc-500/20 bg-zinc-500/10 text-zinc-400 hover:bg-zinc-500/20 transition-colors disabled:opacity-50"
                  >
                    {enableMutation.isPending ? 'Updating...' : 'Unlist'}
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Agent mode selector */}
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setAgentMode('csw')}
                  className={`text-left rounded-lg border p-3 transition-colors ${
                    agentMode === 'csw'
                      ? 'border-emerald-500/30 bg-emerald-500/5'
                      : 'border-white/10 bg-black/20 hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Wallet className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-medium text-white">Use my Zora Wallet</span>
                  </div>
                  <p className="app-meta-value text-zinc-500 leading-relaxed">
                    Your existing Coinbase Smart Wallet becomes the agent. Same address, same identity.
                  </p>
                  {agentMode === 'csw' && (
                    <span className="inline-flex items-center gap-1 mt-2 text-[9px] text-emerald-400 uppercase tracking-wider">
                      <Zap className="w-2.5 h-2.5" /> Recommended
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setAgentMode('eoa')}
                  className={`text-left rounded-lg border p-3 transition-colors ${
                    agentMode === 'eoa'
                      ? 'border-indigo-500/30 bg-indigo-500/5'
                      : 'border-white/10 bg-black/20 hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Bot className="w-4 h-4 text-indigo-400" />
                    <span className="text-xs font-medium text-white">Generate new identity</span>
                  </div>
                  <p className="app-meta-value text-zinc-500 leading-relaxed">
                    Creates a separate XMTP identity. Agent wallet address will be different from yours.
                  </p>
                </button>
              </div>

              {/* CSW flow */}
              {agentMode === 'csw' && (
                <div className="space-y-3 rounded-lg border border-emerald-500/10 bg-emerald-500/2 p-4">
                  {!canonicalCswAddress ? (
                    <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-3">
                      <div className="text-[11px] text-amber-200 font-medium">Canonical Coinbase Smart Wallet required</div>
                      <div className="mt-1 text-[10px] text-amber-100/80">
                        One-click agent setup is locked until your canonical Coinbase Smart Wallet is connected.
                      </div>
                      <a
                        href={baseAppInviteHref}
                        className="mt-2 inline-flex items-center gap-1 rounded-md border border-amber-300/30 bg-amber-400/10 px-2.5 py-1 text-[10px] text-amber-100 hover:bg-amber-400/20"
                      >
                        Open Base app <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  ) : null}

                  <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="text-[11px] text-emerald-200 font-medium">One-click setup</div>
                        <div className="app-meta-value text-zinc-400">
                          Provisions signer, links owner (if needed), enables CSW agent, and publishes profile.
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => void oneClickMutation.mutateAsync()}
                        disabled={oneClickMutation.isPending || !canonicalCswAddress}
                        className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-[11px] text-emerald-200 hover:bg-emerald-500/20 disabled:opacity-60"
                      >
                        {oneClickMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                        {oneClickMutation.isPending ? 'Running…' : 'Run one-click'}
                      </button>
                    </div>
                    {oneClickMutation.data?.ownerTxHash ? (
                      <div className="app-meta-value mt-2 text-zinc-400">
                        Owner tx: <span className="text-zinc-300">{truncAddr(oneClickMutation.data.ownerTxHash)}</span>
                      </div>
                    ) : null}
                    {oneClickMutation.data?.publish?.grove?.lensUri ? (
                      <div className="app-meta-value mt-1 text-zinc-400">
                        Published: <span className="text-zinc-300">{oneClickMutation.data.publish.grove.lensUri}</span>
                      </div>
                    ) : null}
                    {oneClickMutation.error ? (
                      <div className="mt-2 text-[10px] text-red-300">{(oneClickMutation.error as Error).message}</div>
                    ) : null}
                  </div>

                  {canonicalCswAddress && (
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Your Smart Wallet</div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-emerald-400">{truncAddr(canonicalCswAddress)}</span>
                        <CopyButton text={canonicalCswAddress} />
                      </div>
                    </div>
                  )}

                  {serverWalletQuery.isLoading && (
                    <div className="flex items-center gap-2 text-xs text-zinc-400">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Provisioning Keepr signer...
                    </div>
                  )}

                  {serverWallet && (
                    <>
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Keepr Signer</div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-zinc-300">{truncAddr(serverWallet.address)}</span>
                          <CopyButton text={serverWallet.address} />
                        </div>
                        <p className="app-meta-value mt-1 text-zinc-600">
                          This address powers optional unattended XMTP automation for your Smart Wallet.
                        </p>
                      </div>

                      {isOwnerQuery.isLoading ? (
                        <div className="flex items-center gap-2 text-xs text-zinc-400">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Checking owner status...
                        </div>
                      ) : isServerWalletOwner ? (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-xs text-emerald-400">
                            <CheckCircle className="w-3.5 h-3.5" /> Keepr signer is an authorized owner
                          </div>
                          <button
                            type="button"
                            onClick={() => void enableMutation.mutateAsync({
                              listed: true,
                              agentType: 'csw',
                              cswAddress: canonicalCswAddress!,
                              privyWalletId: serverWallet.walletId,
                            })}
                            disabled={enableMutation.isPending || !canonicalCswAddress}
                            className="inline-flex items-center gap-2 text-sm px-4 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
                          >
                            {enableMutation.isPending ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Activating...
                              </>
                            ) : (
                              <>
                                <Wallet className="w-3.5 h-3.5" /> Activate CSW Agent
                              </>
                            )}
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <p className="text-xs text-amber-400">
                            Add the Keepr signer as an owner of your Smart Wallet for optional unattended automation.
                          </p>
                          <button
                            type="button"
                            onClick={() => void addOwnerMutation.mutateAsync()}
                            disabled={addOwnerMutation.isPending || !walletClient}
                            className="inline-flex items-center gap-2 text-sm px-4 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/20 transition-colors disabled:opacity-50"
                          >
                            {addOwnerMutation.isPending ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Sending transaction...
                              </>
                            ) : (
                              <>
                                <Shield className="w-3.5 h-3.5" /> Add Owner (onchain tx)
                              </>
                            )}
                          </button>
                          {addOwnerMutation.isError && (
                            <div className="flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2">
                              <AlertTriangle className="w-3.5 h-3.5 text-red-400 mt-0.5 shrink-0" />
                              <span className="text-xs text-red-300">{(addOwnerMutation.error as Error)?.message}</span>
                            </div>
                          )}
                          {addOwnerMutation.isSuccess && (
                            <div className="flex items-center gap-2 text-xs text-emerald-400">
                              <CheckCircle className="w-3.5 h-3.5" /> Owner added! Verifying...
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* EOA flow */}
              {agentMode === 'eoa' && (
                <div className="space-y-3">
                  <p className="text-xs text-zinc-400">
                    This will generate a new XMTP identity (EOA) for your creator agent.
                    The private key is encrypted and stored securely.
                  </p>
                  <button
                    type="button"
                    onClick={() => void enableMutation.mutateAsync({ listed: true })}
                    disabled={enableMutation.isPending || !creatorAddress}
                    className="inline-flex items-center gap-2 text-sm px-4 py-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 hover:bg-indigo-500/20 transition-colors disabled:opacity-50"
                  >
                    {enableMutation.isPending ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Creating...
                      </>
                    ) : (
                      <>
                        <Bot className="w-3.5 h-3.5" /> Enable Agent
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}

          {enableMutation.isError && (
            <div className="flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2">
              <AlertTriangle className="w-3.5 h-3.5 text-red-400 mt-0.5 shrink-0" />
              <span className="text-xs text-red-300">{(enableMutation.error as Error)?.message}</span>
            </div>
          )}
        </div>
      </div>

      {/* Step 2: Link Vault Group */}
      <div className="rounded-xl border border-white/10 bg-black/30 overflow-hidden">
        <div className="px-5 py-4 border-b border-white/5 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
            <Link2 className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <div className="text-sm text-white font-medium">2. Link Vault Group</div>
            <div className="app-meta-value text-zinc-500">Connect your vault to XMTP chat and optional Lens group identity</div>
          </div>
        </div>

        <div className="px-5 py-4 space-y-4">
          {!agent ? (
            <p className="text-xs text-zinc-500">Enable your agent first (Step 1) before linking a vault.</p>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-zinc-500 mb-1.5">Vault Address</label>
                  <input
                    type="text"
                    value={vaultAddress}
                    onChange={(e) => setVaultAddress(e.target.value)}
                    placeholder="0x..."
                    className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-zinc-200 font-mono placeholder:text-zinc-700 focus:outline-none focus:border-amber-500/30"
                  />
                  {vaultAddress && !isAddressLike(vaultAddress) && (
                    <span className="text-[10px] text-red-400 mt-1">Invalid address</span>
                  )}
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-zinc-500 mb-1.5">Creator Coin Address</label>
                  <input
                    type="text"
                    value={creatorCoinAddress}
                    onChange={(e) => setCreatorCoinAddress(e.target.value)}
                    placeholder="0x..."
                    className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-zinc-200 font-mono placeholder:text-zinc-700 focus:outline-none focus:border-amber-500/30"
                  />
                  {creatorCoinAddress && !isAddressLike(creatorCoinAddress) && (
                    <span className="text-[10px] text-red-400 mt-1">Invalid address</span>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase tracking-wider text-zinc-500 mb-1.5">XMTP Group ID</label>
                <input
                  type="text"
                  value={groupId}
                  onChange={(e) => setGroupId(e.target.value)}
                  placeholder="Paste the XMTP conversation/group ID"
                  className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-zinc-200 font-mono placeholder:text-zinc-700 focus:outline-none focus:border-amber-500/30"
                />
                <p className="app-meta-value mt-1 text-zinc-600">
                  Find this in your XMTP client's group settings, or create a new group and copy its ID.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-zinc-500 mb-1.5">Lens Group Address (optional)</label>
                  <input
                    type="text"
                    value={lensGroupAddress}
                    onChange={(e) => setLensGroupAddress(e.target.value)}
                    placeholder="0x..."
                    className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-zinc-200 font-mono placeholder:text-zinc-700 focus:outline-none focus:border-amber-500/30"
                  />
                  {lensGroupAddress && !lensGroupValid && (
                    <span className="text-[10px] text-red-400 mt-1">Invalid Lens group address</span>
                  )}
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-zinc-500 mb-1.5">Lens Group Metadata URI (optional)</label>
                  <input
                    type="text"
                    value={lensMetadataUri}
                    onChange={(e) => setLensMetadataUri(e.target.value)}
                    placeholder="lens://... or https://..."
                    className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-zinc-200 placeholder:text-zinc-700 focus:outline-none focus:border-amber-500/30"
                  />
                </div>
              </div>
              <p className="app-meta-value text-zinc-600">
                Lens groups are useful for membership/discovery. XMTP remains the active chat transport.
              </p>
            </>
          )}
        </div>
      </div>

      {/* Step 3: Gating Config */}
      <div className="rounded-xl border border-white/10 bg-black/30 overflow-hidden">
        <div className="px-5 py-4 border-b border-white/5 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
            <Shield className="w-4 h-4 text-violet-400" />
          </div>
          <div>
            <div className="text-sm text-white font-medium">3. Access Gating</div>
            <div className="app-meta-value text-zinc-500">Control who can join your vault group</div>
          </div>
        </div>

        <div className="px-5 py-4 space-y-4">
          {!agent ? (
            <p className="text-xs text-zinc-500">Enable your agent first.</p>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={gatingEnabled}
                    onChange={(e) => setGatingEnabled(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-violet-500/60" />
                </label>
                <span className="text-xs text-zinc-300">Require vault shares to join</span>
              </div>

              {gatingEnabled && (
                <div className="grid gap-4 sm:grid-cols-2 pl-12">
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-zinc-500 mb-1.5">Gating Mode</label>
                    <select
                      value={gatingMode}
                      onChange={(e) => setGatingMode(e.target.value as 'shares' | 'none')}
                      className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-violet-500/30"
                    >
                      <option value="shares">Share balance check</option>
                      <option value="none">No check (open)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-zinc-500 mb-1.5">Min Shares</label>
                    <input
                      type="text"
                      value={minShares}
                      onChange={(e) => setMinShares(e.target.value)}
                      placeholder="1"
                      className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-zinc-200 font-mono placeholder:text-zinc-700 focus:outline-none focus:border-violet-500/30"
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={joinLocked}
                    onChange={(e) => setJoinLocked(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500/60" />
                </label>
                <div>
                  <span className="text-xs text-zinc-300">Lock joins</span>
                  <p className="app-meta-value text-zinc-600">Prevent new members from joining even if they pass gating checks</p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Submit */}
      {agent && (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => void vaultMutation.mutateAsync()}
            disabled={!vaultFormValid || vaultMutation.isPending}
            className="inline-flex items-center gap-2 text-sm px-5 py-2.5 rounded-lg bg-brand-primary/10 border border-brand-primary/20 text-brand-primary hover:bg-brand-primary/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {vaultMutation.isPending ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…
              </>
            ) : (
              'Save vault configuration'
            )}
          </button>

          {vaultMutation.isSuccess && (
            <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
              <CheckCircle className="w-3.5 h-3.5" /> Vault linked successfully
            </span>
          )}
        </div>
      )}

      {vaultMutation.isError && (
        <div className="flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3">
          <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
          <div className="text-xs text-red-300">
            <span className="font-medium">Failed to save:</span> {(vaultMutation.error as Error)?.message}
          </div>
        </div>
      )}
    </div>
  )
}
