import { useCallback, useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CheckCircle2, Copy, ExternalLink, Mail, RefreshCw, ShieldCheck, Trash2, Wallet } from 'lucide-react'
import { encodeFunctionData, getAddress, type Address, type Hex } from 'viem'
import { base } from 'viem/chains'
import { useAccount, usePublicClient, useSwitchChain, useWalletClient } from 'wagmi'
import { useExportWallet, usePrivy } from '@privy-io/react-auth'
import { ProfileCard } from 'ethereum-identity-kit'

import { apiFetch } from '@/lib/apiBase'
import { getAppBaseUrl, getMarketingBaseUrl } from '@/lib/host'
import { isPrivyClientEnabled } from '@/lib/flags'
import { useSiweAuth } from '@/hooks/useSiweAuth'
import { useFarcasterAuth } from '@/hooks/useFarcasterAuth'
import { useMiniAppContext } from '@/hooks/useMiniAppContext'
import { getFarcasterUserByAddress, getFarcasterUserByFid } from '@/lib/neynar-api'
import { useZoraCoin, useZoraProfile } from '@/lib/zora/hooks'
import { Alert } from '@/components/ui/Alert'
import { Skeleton } from '@/components/ui/Skeleton'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { WalletProviderIcon } from '@/components/ui/WalletProviderIcon'
import { AccountModeIndicator } from '@/components/ui/AccountModeIndicator'
import { PageMeta } from '@/components/seo/PageMeta'
import { isEoaAddressByCode } from '@/wallet/canonicalWalletPolicy'
import { buildSettingsTasks, deriveWaitlistRewards, type WaitlistPositionData } from '@/lib/rewards/waitlistRewards'

type ApiEnvelope<T> = { success: boolean; data?: T; error?: string }

type ConnectedAccount = {
  address: string
  chain: string | null
  walletType: string | null
  provider: string | null
  source: string
  isPrimary: boolean
  isCanonicalSmartWallet: boolean
  isCanonicalSolanaWallet: boolean
  isOperationalSolanaWallet: boolean
  isEmbeddedEoa: boolean
  verifiedAt: string | null
}

type WaitlistMeResponse = {
  profileId: number
  email: string | null
  contactPreference: string | null
  primaryWallet: string | null
  primarySmartWallet: string | null
  primaryEmbeddedEoa: string | null
  baseSubAccount: string | null
  embeddedWallet: string | null
  embeddedWalletChain: string | null
  embeddedWalletClientType: string | null
  cswAddress: string | null
  solanaWallet: string | null
  canonicalSolanaWallet: string | null
  operationalSolanaWallet: string | null
  farcasterFid: number | null
  preprovCoinAddress: string | null
  preprovCoinSymbol: string | null
  preprovFarcasterUsername: string | null
  preprovZoraHandle: string | null
  lensHandle: string | null
  lensAccountAddress: string | null
  lensOwnerAddress: string | null
  privyUserId: string | null
  appAccessStatus: string | null
  updatedAt: string | null
  connectedAccounts: ConnectedAccount[]
}

type SetCanonicalSolanaResponse = {
  canonicalSolanaWallet: string
  operationalSolanaWallet: string | null
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function isEvmAddress(value: string | null | undefined): value is string {
  const input = typeof value === 'string' ? value.trim() : ''
  return /^0x[a-fA-F0-9]{40}$/.test(input)
}

function isSolanaAddress(value: string | null | undefined): value is string {
  const input = typeof value === 'string' ? value.trim() : ''
  if (!input) return false
  if (input.length < 32 || input.length > 44) return false
  return /^[1-9A-HJ-NP-Za-km-z]+$/.test(input)
}

function formatRole(
  account: ConnectedAccount,
  opts?: { canonicalSmartWalletAddress?: string | null; primarySmartWalletAddress?: string | null },
): string[] {
  const labels: string[] = []
  const canonicalLc = opts?.canonicalSmartWalletAddress?.toLowerCase() ?? null
  const primarySmartWalletLc = opts?.primarySmartWalletAddress?.toLowerCase() ?? null
  const addressLc = account.address.toLowerCase()
  const walletType = (account.walletType ?? '').toLowerCase()
  const provider = (account.provider ?? '').toLowerCase()
  // When a canonical address is resolved, treat it as the single source of truth
  // to prevent stale synced flags from labeling multiple wallets as canonical.
  const isCanonicalSmartWallet = canonicalLc ? canonicalLc === addressLc : account.isCanonicalSmartWallet

  if (account.isPrimary) labels.push('Primary')
  if (isCanonicalSmartWallet) labels.push('Canonical Smart Wallet from Zora')
  if (account.isCanonicalSolanaWallet) labels.push('Canonical Solana Wallet')
  if (account.isOperationalSolanaWallet) labels.push('Operational Solana Wallet')
  if (walletType === 'smart_wallet' && primarySmartWalletLc && primarySmartWalletLc === addressLc)
    labels.push('Primary Smart Wallet')
  if (account.isEmbeddedEoa) labels.push('User Wallet')
  if (!isCanonicalSmartWallet && walletType === 'smart_wallet') {
    labels.push(provider.includes('privy') ? 'Deploy Session Signer (Privy)' : 'App Smart Wallet')
  }
  if (labels.length === 0) labels.push('Connected')
  return labels
}

function humanizeToken(value: string | null | undefined): string | null {
  const raw = typeof value === 'string' ? value.trim() : ''
  if (!raw) return null
  const byWords = raw
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!byWords) return null
  return byWords.replace(/\b\w/g, (m) => m.toUpperCase())
}

function formatWalletTypeLabel(value: string | null | undefined): string {
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : ''
  if (raw === 'smart_wallet') return 'Smart Wallet'
  if (raw === 'embedded_eoa') return 'User Wallet'
  if (raw === 'external_eoa') return 'User Wallet'
  return humanizeToken(value) ?? 'Wallet'
}

function formatChainLabel(value: string | null | undefined): string {
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : ''
  if (!raw) return 'EVM'
  if (raw === 'evm') return 'EVM'
  return humanizeToken(raw) ?? 'EVM'
}

function inferProviderLabel(account: ConnectedAccount): string {
  const providerRaw = typeof account.provider === 'string' ? account.provider.trim().toLowerCase() : ''
  const provider = providerRaw.replace(/[_-]+/g, ' ')
  const walletType = typeof account.walletType === 'string' ? account.walletType.trim().toLowerCase() : ''

  if (
    provider.includes('coinbase') ||
    provider.includes('base account') ||
    provider.includes('coinbase smart wallet') ||
    (walletType === 'smart_wallet' && account.isCanonicalSmartWallet)
  ) {
    return 'Coinbase Smart Wallet'
  }
  if (provider.includes('rabby')) return 'Rabby'
  if (provider.includes('metamask')) return 'MetaMask'
  if (provider.includes('walletconnect')) return 'WalletConnect'
  if (provider.includes('privy')) return 'Privy'
  if (walletType === 'embedded_eoa') return 'Privy Embedded'
  if (walletType === 'smart_wallet') return 'Coinbase Smart Wallet'
  return humanizeToken(providerRaw) ?? 'Unknown'
}

function formatAccountSummary(account: ConnectedAccount): string {
  const provider = inferProviderLabel(account)
  const providerRaw = typeof account.provider === 'string' ? account.provider.trim().toLowerCase() : ''
  const walletTypeRaw = typeof account.walletType === 'string' ? account.walletType.trim().toLowerCase() : ''
  if (walletTypeRaw === 'smart_wallet' && providerRaw.includes('privy')) {
    return 'Privy Smart Wallet signer'
  }
  const walletType = formatWalletTypeLabel(account.walletType)
  const chain = formatChainLabel(account.chain)
  const parts: string[] = []

  if (provider === 'Coinbase Smart Wallet') {
    parts.push('Coinbase Smart Wallet')
  } else {
    if (walletType && walletType !== 'Wallet') parts.push(walletType)
    if (provider && provider !== 'Unknown' && provider !== walletType) parts.push(provider)
  }
  if (chain && chain !== 'EVM') parts.push(chain)

  return parts.join(' · ') || provider || walletType || 'Wallet'
}

function formatDateTime(value: string | null | undefined): string | null {
  const raw = typeof value === 'string' ? value.trim() : ''
  if (!raw) return null
  const ms = Date.parse(raw)
  if (!Number.isFinite(ms)) return null
  return new Date(ms).toLocaleString()
}

function normalizeHandle(value: string | null | undefined): string | null {
  const raw = typeof value === 'string' ? value.trim() : ''
  if (!raw) return null
  return raw.startsWith('@') ? raw.slice(1) : raw
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function formatUsdCompact(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return '—'
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`
  if (value >= 1_000) return `$${(value / 1_000).toFixed(2)}K`
  return `$${value.toFixed(2)}`
}

function formatCountCompact(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return '—'
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`
  return value.toLocaleString()
}

type KnownAddress = {
  address: string
  badges: string[]
  subtitle: string | null
  provider: string | null
  walletType: string | null
  isCanonicalSmartWallet: boolean
  rank: number
  verifiedAt: string | null
}

type KnownAddressWithOwners = KnownAddress & {
  ownerSlots: SmartWalletOwner[]
}

type AssociatedAccount = {
  label: string
  value: string
  href?: string
  mono?: boolean
}

type SmartWalletOwner = {
  index: number
  ownerBytes: string
  ownerAddress: string | null
  isAddressOwner: boolean
}

type SmartWalletOwnersResponse = {
  smartWallet: string
  ownerCount: number
  nextOwnerIndex: number | null
  owners: SmartWalletOwner[]
}

type CreatorAgentSummary = {
  creatorAddress: string
  xmtpAgentAddress: string
  agentType: 'eoa' | 'csw'
  cswAddress: string | null
  listedPublicly: boolean
  createdAt: string
}

type CreatorAgentListResponse = {
  count: number
  agents: CreatorAgentSummary[]
  nextCursor: string | null
}

type ProvisionWalletResponse = {
  walletId: string
  address: string
}

const COINBASE_SMART_WALLET_OWNER_VIEW_ABI = [
  {
    type: 'function',
    name: 'isOwnerAddress',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const

const COINBASE_SMART_WALLET_OWNER_MGMT_ABI = [
  {
    type: 'function',
    name: 'addOwnerAddress',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'removeOwnerAtIndex',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'index', type: 'uint256' }, { name: 'owner', type: 'bytes' }],
    outputs: [],
  },
] as const

function useSafeExportWalletHook(enabled: boolean) {
  try {
    const value = useExportWallet() as any
    if (!enabled || !value || typeof value.exportWallet !== 'function') {
      return {
        exportWallet: async () => {
          throw new Error('Embedded wallet export is unavailable.')
        },
      } as { exportWallet: (options?: { address: string }) => Promise<void> }
    }
    return value as { exportWallet: (options?: { address: string }) => Promise<void> }
  } catch {
    return {
      exportWallet: async () => {
        throw new Error('Embedded wallet export is unavailable.')
      },
    } as { exportWallet: (options?: { address: string }) => Promise<void> }
  }
}

function useSafePrivyUserHook(enabled: boolean): { user: any | null } {
  try {
    const value = usePrivy() as any
    if (!enabled) return { user: null }
    return { user: value?.user ?? null }
  } catch {
    return { user: null }
  }
}

export function AccountSettings() {
  const auth = useSiweAuth()
  const miniApp = useMiniAppContext()
  const farcasterAuth = useFarcasterAuth()
  const { address: connectedAddressRaw, chainId } = useAccount()
  const { data: walletClient } = useWalletClient({ chainId: base.id })
  const publicClient = usePublicClient({ chainId: base.id })
  const { switchChainAsync } = useSwitchChain()
  const privyEnabled = isPrivyClientEnabled()
  const { exportWallet } = useSafeExportWalletHook(privyEnabled)
  const { user: privyUser } = useSafePrivyUserHook(privyEnabled)
  const [profile, setProfile] = useState<WaitlistMeResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [emailDraft, setEmailDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null)
  const [exportBusy, setExportBusy] = useState(false)
  const [exportMessage, setExportMessage] = useState<string | null>(null)
  const [ownersActionMessage, setOwnersActionMessage] = useState<string | null>(null)
  const [ownersActionError, setOwnersActionError] = useState<string | null>(null)
  const [revokeBusyIndex, setRevokeBusyIndex] = useState<number | null>(null)
  const [revokeConfirmOwner, setRevokeConfirmOwner] = useState<SmartWalletOwner | null>(null)
  const [enableOneClickBusy, setEnableOneClickBusy] = useState(false)
  const [enableAutomationBusy, setEnableAutomationBusy] = useState(false)
  const [automationActionMessage, setAutomationActionMessage] = useState<string | null>(null)
  const [automationActionError, setAutomationActionError] = useState<string | null>(null)
  const [selectedCanonicalSolanaWallet, setSelectedCanonicalSolanaWallet] = useState('')
  const [solanaWalletActionBusy, setSolanaWalletActionBusy] = useState(false)
  const [tasksCopyNotice, setTasksCopyNotice] = useState<string | null>(null)

  const loadProfile = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await apiFetch('/api/waitlist/me', { method: 'GET' })
      const json = (await res.json().catch(() => null)) as ApiEnvelope<WaitlistMeResponse | null> | null
      if (!res.ok || !json?.success) {
        throw new Error(typeof json?.error === 'string' ? json.error : 'Failed to load account.')
      }
      const nextProfile = (json?.data ?? null) as WaitlistMeResponse | null
      setProfile(nextProfile)
      setEmailDraft(nextProfile?.email ?? '')
    } catch (e: any) {
      setProfile(null)
      setEmailDraft('')
      setError(typeof e?.message === 'string' ? e.message : 'Failed to load account.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!auth.sessionHydrated) return
    if (!auth.isSignedIn) {
      setLoading(false)
      return
    }
    void loadProfile()
  }, [auth.isSignedIn, auth.sessionHydrated, loadProfile])

  const canSaveEmail = useMemo(() => {
    const trimmed = emailDraft.trim().toLowerCase()
    if (!EMAIL_RE.test(trimmed)) return false
    return trimmed !== (profile?.email ?? '').trim().toLowerCase()
  }, [emailDraft, profile?.email])

  const canonicalSolanaWalletAddress = useMemo(() => {
    const canonical = profile?.canonicalSolanaWallet
    const legacy = profile?.solanaWallet
    if (isSolanaAddress(canonical)) return canonical
    if (isSolanaAddress(legacy)) return legacy
    return null
  }, [profile?.canonicalSolanaWallet, profile?.solanaWallet])

  const operationalSolanaWalletAddress = useMemo(() => {
    const operational = profile?.operationalSolanaWallet
    if (isSolanaAddress(operational)) return operational
    return null
  }, [profile?.operationalSolanaWallet])

  const linkedSolanaWallets = useMemo(() => {
    const map = new Map<string, { address: string; summary: string }>()
    for (const account of profile?.connectedAccounts ?? []) {
      if (!isSolanaAddress(account.address)) continue
      const chain = typeof account.chain === 'string' ? account.chain.trim().toLowerCase() : ''
      if (chain && !chain.includes('solana')) continue
      map.set(account.address, {
        address: account.address,
        summary: formatAccountSummary(account),
      })
    }
    if (canonicalSolanaWalletAddress && !map.has(canonicalSolanaWalletAddress)) {
      map.set(canonicalSolanaWalletAddress, {
        address: canonicalSolanaWalletAddress,
        summary: 'Canonical Solana Wallet',
      })
    }
    if (operationalSolanaWalletAddress && !map.has(operationalSolanaWalletAddress)) {
      map.set(operationalSolanaWalletAddress, {
        address: operationalSolanaWalletAddress,
        summary: 'Operational Solana Wallet',
      })
    }
    return Array.from(map.values())
  }, [canonicalSolanaWalletAddress, operationalSolanaWalletAddress, profile?.connectedAccounts])

  useEffect(() => {
    const fallback = canonicalSolanaWalletAddress ?? linkedSolanaWallets[0]?.address ?? ''
    setSelectedCanonicalSolanaWallet((prev) => (prev && linkedSolanaWallets.some((w) => w.address === prev) ? prev : fallback))
  }, [canonicalSolanaWalletAddress, linkedSolanaWallets])

  const onSaveEmail = useCallback(async () => {
    if (!canSaveEmail || saving) return
    setSaving(true)
    setSuccess(null)
    setError(null)
    try {
      const trimmedEmail = emailDraft.trim().toLowerCase()
      const res = await apiFetch('/api/waitlist/update-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          currentEmail: profile?.email ?? null,
          newEmail: trimmedEmail,
        }),
      })
      const json = (await res.json().catch(() => null)) as ApiEnvelope<{ email: string }> | null
      if (!res.ok || !json?.success || !json.data?.email) {
        throw new Error(typeof json?.error === 'string' ? json.error : 'Failed to update email.')
      }
      const nextEmail = String(json.data.email)
      setProfile((prev) => (prev ? { ...prev, email: nextEmail, contactPreference: 'email' } : prev))
      setEmailDraft(nextEmail)
      setSuccess('Email updated.')
      void loadProfile()
    } catch (e: any) {
      setError(typeof e?.message === 'string' ? e.message : 'Failed to update email.')
    } finally {
      setSaving(false)
    }
  }, [canSaveEmail, emailDraft, loadProfile, profile?.email, saving])

  const canSetCanonicalSolanaWallet = useMemo(() => {
    if (!isSolanaAddress(selectedCanonicalSolanaWallet)) return false
    if (!linkedSolanaWallets.some((wallet) => wallet.address === selectedCanonicalSolanaWallet)) return false
    if (solanaWalletActionBusy) return false
    if (!canonicalSolanaWalletAddress) return true
    return selectedCanonicalSolanaWallet !== canonicalSolanaWalletAddress
  }, [canonicalSolanaWalletAddress, linkedSolanaWallets, selectedCanonicalSolanaWallet, solanaWalletActionBusy])

  const onSetCanonicalSolanaWallet = useCallback(async () => {
    if (!canSetCanonicalSolanaWallet || !isSolanaAddress(selectedCanonicalSolanaWallet)) return
    setSolanaWalletActionBusy(true)
    setSuccess(null)
    setError(null)
    try {
      const res = await apiFetch('/api/wallet/solana/setCanonical', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ wallet: selectedCanonicalSolanaWallet }),
      })
      const json = (await res.json().catch(() => null)) as ApiEnvelope<SetCanonicalSolanaResponse> | null
      if (!res.ok || !json?.success || !json?.data?.canonicalSolanaWallet) {
        throw new Error(typeof json?.error === 'string' ? json.error : 'Failed to set canonical Solana wallet.')
      }
      const nextCanonical = json.data.canonicalSolanaWallet
      const nextOperational = json.data.operationalSolanaWallet ?? null
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              canonicalSolanaWallet: nextCanonical,
              operationalSolanaWallet: nextOperational,
              solanaWallet: nextCanonical,
            }
          : prev,
      )
      setSuccess('Canonical Solana wallet updated.')
      void loadProfile()
    } catch (e: any) {
      setError(typeof e?.message === 'string' ? e.message : 'Failed to set canonical Solana wallet.')
    } finally {
      setSolanaWalletActionBusy(false)
    }
  }, [canSetCanonicalSolanaWallet, loadProfile, selectedCanonicalSolanaWallet])

  const onCopyAddress = useCallback((address: string) => {
    void navigator.clipboard.writeText(address).then(() => {
      setCopiedAddress(address.toLowerCase())
      window.setTimeout(() => setCopiedAddress((prev) => (prev === address.toLowerCase() ? null : prev)), 1500)
    }).catch(() => {
      // ignore clipboard failures
    })
  }, [])

  const privyCrossAppSmartWalletAddress = useMemo(() => {
    const linked = Array.isArray(privyUser?.linkedAccounts)
      ? (privyUser.linkedAccounts as any[])
      : Array.isArray(privyUser?.linked_accounts)
        ? (privyUser.linked_accounts as any[])
        : []
    const crossAppAccounts = linked.filter((a: any) => String(a?.type ?? '').trim().toLowerCase() === 'cross_app')
    for (const account of crossAppAccounts) {
      const wallets = Array.isArray(account?.smart_wallets)
        ? (account.smart_wallets as any[])
        : Array.isArray(account?.smartWallets)
          ? (account.smartWallets as any[])
          : []
      for (const wallet of wallets) {
        const raw = typeof wallet?.address === 'string' ? wallet.address.trim() : ''
        if (isEvmAddress(raw)) return raw
      }
    }
    return null
  }, [privyUser])

  // Resolve Zora-linked wallets (prefer handle when available) so canonical CSW
  // can be anchored to the creator's Zora identity instead of stale local flags.
  const zoraCanonicalSeedIdentifier = useMemo(() => {
    const fromHandle = normalizeHandle(profile?.preprovZoraHandle)
    if (fromHandle) return fromHandle
    const primaryWallet = profile?.primaryWallet
    if (isEvmAddress(primaryWallet)) return primaryWallet
    return undefined
  }, [profile?.preprovZoraHandle, profile?.primaryWallet])
  const zoraCanonicalSeedQuery = useZoraProfile(zoraCanonicalSeedIdentifier)
  const zoraCanonicalSeedProfile = zoraCanonicalSeedQuery.data ?? null

  const canonicalSmartWalletAddress = useMemo(() => {
    if (!profile) return null
    const connectedSmartWallets = (profile.connectedAccounts ?? [])
      .filter((a) => isEvmAddress(a.address) && String(a.walletType ?? '').toLowerCase() === 'smart_wallet')
      .map((a) => a.address.toLowerCase())
    const connectedSmartWalletSet = new Set(connectedSmartWallets)
    const zoraCandidates = [
      zoraCanonicalSeedProfile?.publicWallet?.walletAddress,
      ...((zoraCanonicalSeedProfile?.linkedWallets?.edges ?? []).map((edge) => edge?.node?.walletAddress ?? null)),
    ]
    for (const candidate of zoraCandidates) {
      if (!isEvmAddress(candidate)) continue
      if (connectedSmartWalletSet.has(candidate.toLowerCase())) return getAddress(candidate)
    }
    const canonicalFromAccounts = (profile.connectedAccounts ?? [])
      .filter((a) => a.isCanonicalSmartWallet && isEvmAddress(a.address))
      .sort((a, b) => {
        const aProvider = String(a.provider ?? '').toLowerCase()
        const bProvider = String(b.provider ?? '').toLowerCase()
        // Prefer non-Privy CSWs when both are marked canonical.
        if (aProvider.includes('privy') !== bProvider.includes('privy')) {
          return aProvider.includes('privy') ? 1 : -1
        }
        const aMs = Date.parse(a.verifiedAt ?? '')
        const bMs = Date.parse(b.verifiedAt ?? '')
        if (Number.isFinite(aMs) && Number.isFinite(bMs)) return bMs - aMs
        if (Number.isFinite(aMs)) return -1
        if (Number.isFinite(bMs)) return 1
        return a.address.localeCompare(b.address)
      })[0]
    if (canonicalFromAccounts?.address) return canonicalFromAccounts.address
    if (isEvmAddress(profile.cswAddress)) return profile.cswAddress
    if (isEvmAddress(profile.primarySmartWallet)) return profile.primarySmartWallet
    if (isEvmAddress(profile.baseSubAccount)) return profile.baseSubAccount
    if (isEvmAddress(privyCrossAppSmartWalletAddress)) return privyCrossAppSmartWalletAddress
    return null
  }, [privyCrossAppSmartWalletAddress, profile, zoraCanonicalSeedProfile])

  const primarySmartWalletAddress = useMemo(() => {
    if (canonicalSmartWalletAddress) return canonicalSmartWalletAddress
    const primarySmartWallet = profile?.primarySmartWallet
    if (isEvmAddress(primarySmartWallet)) return primarySmartWallet
    return null
  }, [canonicalSmartWalletAddress, profile?.primarySmartWallet])

  const connectedAddress = useMemo(() => {
    if (!isEvmAddress(connectedAddressRaw)) return null
    return getAddress(connectedAddressRaw)
  }, [connectedAddressRaw])
  const identityLookupAddress = useMemo(() => {
    if (canonicalSmartWalletAddress && isEvmAddress(canonicalSmartWalletAddress)) return canonicalSmartWalletAddress
    if (connectedAddress && isEvmAddress(connectedAddress)) return connectedAddress
    if (isEvmAddress(profile?.primaryWallet)) return profile.primaryWallet
    return null
  }, [canonicalSmartWalletAddress, connectedAddress, profile?.primaryWallet])

  const accountSurfaceUrl = connectedAddress
    ? `${getAppBaseUrl()}/portfolio/${connectedAddress}`
    : `${getAppBaseUrl()}/portfolio`

  const appAccountUrl = `${getAppBaseUrl()}/account`

  const embeddedExportAddress = useMemo(() => {
    const primaryEmbeddedEoa = profile?.primaryEmbeddedEoa
    if (isEvmAddress(primaryEmbeddedEoa)) return primaryEmbeddedEoa
    const embeddedWallet = profile?.embeddedWallet
    if (isEvmAddress(embeddedWallet)) return embeddedWallet
    const embedded = (profile?.connectedAccounts ?? []).find((a) => a.isEmbeddedEoa && isEvmAddress(a.address))
    if (embedded) return embedded.address
    return null
  }, [profile?.connectedAccounts, profile?.embeddedWallet, profile?.primaryEmbeddedEoa])

  const smartWalletOwnersQuery = useQuery({
    queryKey: ['smartWalletOwners', canonicalSmartWalletAddress ?? 'none'],
    enabled: Boolean(canonicalSmartWalletAddress),
    staleTime: 20_000,
    retry: 0,
    queryFn: async () => {
      if (!canonicalSmartWalletAddress) return null
      const params = new URLSearchParams({ smartWallet: canonicalSmartWalletAddress })
      const res = await apiFetch(`/api/deploy/smartWalletOwners?${params.toString()}`, { method: 'GET' })
      const json = (await res.json().catch(() => null)) as ApiEnvelope<SmartWalletOwnersResponse> | null
      if (!res.ok || !json?.success || !json.data) {
        throw new Error(typeof json?.error === 'string' ? json.error : 'Failed to load smart wallet owners.')
      }
      return json.data
    },
  })

  const creatorAutomationQuery = useQuery({
    queryKey: ['creatorAutomation', canonicalSmartWalletAddress ?? 'none'],
    enabled: Boolean(canonicalSmartWalletAddress),
    staleTime: 15_000,
    retry: 0,
    queryFn: async (): Promise<{ enabled: boolean; agentAddress: string | null }> => {
      if (!canonicalSmartWalletAddress) return { enabled: false, agentAddress: null }
      const params = new URLSearchParams({
        creatorAddress: canonicalSmartWalletAddress,
        listed: 'false',
        limit: '5',
      })
      const res = await apiFetch(`/api/v1/agents/creators?${params.toString()}`, { method: 'GET' })
      const json = (await res.json().catch(() => null)) as ApiEnvelope<CreatorAgentListResponse> | null
      if (!res.ok || !json?.success || !json.data) {
        throw new Error(typeof json?.error === 'string' ? json.error : 'Failed to load automation status.')
      }
      const cswAgent = (json.data.agents ?? []).find((agent) => String(agent.agentType ?? '').toLowerCase() === 'csw') ?? null
      return {
        enabled: Boolean(cswAgent),
        agentAddress: cswAgent?.xmtpAgentAddress ?? null,
      }
    },
  })

  const rewardsPositionQuery = useQuery({
    queryKey: ['accountRewardsPosition', profile?.email ?? 'none', canonicalSmartWalletAddress ?? profile?.primaryWallet ?? 'none'],
    enabled: Boolean(profile && (profile.email || canonicalSmartWalletAddress || profile?.primaryWallet)),
    staleTime: 20_000,
    retry: 0,
    queryFn: async (): Promise<WaitlistPositionData | null> => {
      if (!profile) return null
      const params = new URLSearchParams()
      if (profile.email) params.set('email', profile.email)
      const walletForLookup = canonicalSmartWalletAddress ?? (isEvmAddress(profile.primaryWallet) ? profile.primaryWallet : null)
      if (walletForLookup) params.set('wallet', walletForLookup.toLowerCase())
      if (!params.toString()) return null

      const res = await apiFetch(`/api/waitlist/position?${params.toString()}`, { method: 'GET', headers: { Accept: 'application/json' } })
      const json = (await res.json().catch(() => null)) as ApiEnvelope<WaitlistPositionData | null> | null
      if (!res.ok || !json?.success) {
        throw new Error(typeof json?.error === 'string' ? json.error : 'Failed to load rewards progress.')
      }
      return json.data ?? null
    },
  })

  const smartWalletOwners = useMemo(
    () => smartWalletOwnersQuery.data?.owners ?? [],
    [smartWalletOwnersQuery.data?.owners],
  )
  const addressOwnerCount = useMemo(
    () => smartWalletOwners.filter((owner) => owner.isAddressOwner && isEvmAddress(owner.ownerAddress)).length,
    [smartWalletOwners],
  )
  const connectedAddressIsOwner = useMemo(() => {
    if (!connectedAddress) return false
    const connectedLc = connectedAddress.toLowerCase()
    return smartWalletOwners.some((owner) => owner.ownerAddress?.toLowerCase() === connectedLc)
  }, [connectedAddress, smartWalletOwners])
  const embeddedOwnerAlreadyLinked = useMemo(() => {
    if (!embeddedExportAddress) return false
    const targetLc = embeddedExportAddress.toLowerCase()
    return smartWalletOwners.some((owner) => owner.ownerAddress?.toLowerCase() === targetLc)
  }, [embeddedExportAddress, smartWalletOwners])
  const automationEnabled = creatorAutomationQuery.data?.enabled === true

  const ensureBaseChain = useCallback(async () => {
    if (chainId === base.id) return
    if (!switchChainAsync) {
      throw new Error('Switch to Base in your wallet to manage Smart Wallet owners.')
    }
    await switchChainAsync({ chainId: base.id })
  }, [chainId, switchChainAsync])

  const onRevokeOwner = useCallback(async (owner: SmartWalletOwner) => {
    if (!canonicalSmartWalletAddress || !isEvmAddress(canonicalSmartWalletAddress)) {
      setOwnersActionError('Missing canonical Smart Wallet address.')
      return
    }
    if (!connectedAddress) {
      setOwnersActionError('Connect an owner User wallet to revoke an owner.')
      return
    }
    if (!walletClient || !publicClient) {
      setOwnersActionError('Wallet client unavailable. Reconnect and try again.')
      return
    }
    if (!owner.ownerBytes || !/^0x[0-9a-fA-F]+$/.test(owner.ownerBytes)) {
      setOwnersActionError('Invalid owner entry.')
      return
    }
    if (owner.ownerAddress && owner.ownerAddress.toLowerCase() === connectedAddress.toLowerCase()) {
      setOwnersActionError('For safety, you cannot revoke your currently connected owner from this page.')
      return
    }
    if (owner.isAddressOwner && addressOwnerCount <= 1) {
      setOwnersActionError('Cannot revoke the last address owner.')
      return
    }

    setOwnersActionError(null)
    setOwnersActionMessage(null)
    setRevokeBusyIndex(owner.index)
    try {
      await ensureBaseChain()

      const callerIsOwner = (await publicClient.readContract({
        address: getAddress(canonicalSmartWalletAddress) as Address,
        abi: COINBASE_SMART_WALLET_OWNER_VIEW_ABI,
        functionName: 'isOwnerAddress',
        args: [connectedAddress as Address],
      })) as boolean
      if (!callerIsOwner) {
        throw new Error('Connected wallet is not an owner of this smart wallet.')
      }

      const data = encodeFunctionData({
        abi: COINBASE_SMART_WALLET_OWNER_MGMT_ABI,
        functionName: 'removeOwnerAtIndex',
        args: [BigInt(owner.index), owner.ownerBytes as Hex],
      })
      const hash = await walletClient.sendTransaction({
        to: getAddress(canonicalSmartWalletAddress) as Address,
        data,
        value: 0n,
        account: connectedAddress as Address,
        chain: base,
      })
      await publicClient.waitForTransactionReceipt({ hash })
      await smartWalletOwnersQuery.refetch()
      void loadProfile()
      setOwnersActionMessage(`Owner revoked at index ${owner.index}.`)
    } catch (e: any) {
      setOwnersActionError(typeof e?.message === 'string' ? e.message : 'Failed to revoke owner.')
    } finally {
      setRevokeBusyIndex(null)
    }
  }, [
    addressOwnerCount,
    canonicalSmartWalletAddress,
    connectedAddress,
    ensureBaseChain,
    loadProfile,
    publicClient,
    smartWalletOwnersQuery,
    walletClient,
  ])

  const onEnableOneClickActions = useCallback(async () => {
    if (enableOneClickBusy) return
    if (!canonicalSmartWalletAddress || !isEvmAddress(canonicalSmartWalletAddress)) {
      setOwnersActionError('Missing canonical Smart Wallet address.')
      return
    }
    if (!embeddedExportAddress || !isEvmAddress(embeddedExportAddress)) {
      setOwnersActionError('No Privy embedded wallet detected yet.')
      return
    }
    if (!connectedAddress) {
      setOwnersActionError('Connect an owner wallet to approve this setup.')
      return
    }
    if (!walletClient || !publicClient) {
      setOwnersActionError('Wallet client unavailable. Reconnect and try again.')
      return
    }

    setOwnersActionError(null)
    setOwnersActionMessage(null)
    setEnableOneClickBusy(true)
    try {
      await ensureBaseChain()

      const canonical = getAddress(canonicalSmartWalletAddress) as Address
      const ownerToAdd = getAddress(embeddedExportAddress) as Address
      const connectedOwner = getAddress(connectedAddress) as Address

      const ownerIsEoa = await isEoaAddressByCode({
        address: ownerToAdd,
        getBytecode: async (address) => {
          const code = await publicClient.getBytecode({ address })
          return code ?? null
        },
      }).catch(() => false)
      if (!ownerIsEoa) {
        throw new Error('Only EOA wallets can be added as Smart Wallet owners. Contract owners are blocked.')
      }

      const callerIsOwner = (await publicClient.readContract({
        address: canonical,
        abi: COINBASE_SMART_WALLET_OWNER_VIEW_ABI,
        functionName: 'isOwnerAddress',
        args: [connectedOwner],
      })) as boolean
      if (!callerIsOwner) {
        throw new Error('Connected wallet is not an owner of this smart wallet.')
      }

      const alreadyLinked = (await publicClient.readContract({
        address: canonical,
        abi: COINBASE_SMART_WALLET_OWNER_VIEW_ABI,
        functionName: 'isOwnerAddress',
        args: [ownerToAdd],
      })) as boolean
      if (alreadyLinked) {
        await smartWalletOwnersQuery.refetch()
        setOwnersActionMessage('1-click actions are already enabled for your Privy embedded wallet.')
        return
      }

      const data = encodeFunctionData({
        abi: COINBASE_SMART_WALLET_OWNER_MGMT_ABI,
        functionName: 'addOwnerAddress',
        args: [ownerToAdd],
      })

      const hash = await walletClient.sendTransaction({
        to: canonical,
        data,
        value: 0n,
        account: connectedOwner,
        chain: base,
      })
      await publicClient.waitForTransactionReceipt({ hash })

      await Promise.all([
        smartWalletOwnersQuery.refetch(),
        loadProfile(),
      ])
      setOwnersActionMessage('ERC-4337 Account Abstraction is enabled for your Privy embedded wallet.')
    } catch (e: any) {
      setOwnersActionError(typeof e?.message === 'string' ? e.message : 'Failed to enable 1-click actions.')
    } finally {
      setEnableOneClickBusy(false)
    }
  }, [
    canonicalSmartWalletAddress,
    connectedAddress,
    embeddedExportAddress,
    enableOneClickBusy,
    ensureBaseChain,
    loadProfile,
    publicClient,
    smartWalletOwnersQuery,
    walletClient,
  ])

  const onEnableAutomation = useCallback(async () => {
    if (enableAutomationBusy || automationEnabled) return
    if (!canonicalSmartWalletAddress || !isEvmAddress(canonicalSmartWalletAddress)) {
      setAutomationActionError('Missing canonical Smart Wallet address.')
      return
    }
    if (!connectedAddress) {
      setAutomationActionError('Connect an owner wallet to approve automation.')
      return
    }
    if (!walletClient || !publicClient) {
      setAutomationActionError('Wallet client unavailable. Reconnect and try again.')
      return
    }

    setAutomationActionError(null)
    setAutomationActionMessage(null)
    setEnableAutomationBusy(true)
    try {
      await ensureBaseChain()

      const canonical = getAddress(canonicalSmartWalletAddress) as Address
      const connectedOwner = getAddress(connectedAddress) as Address

      const callerIsOwner = (await publicClient.readContract({
        address: canonical,
        abi: COINBASE_SMART_WALLET_OWNER_VIEW_ABI,
        functionName: 'isOwnerAddress',
        args: [connectedOwner],
      })) as boolean
      if (!callerIsOwner) {
        throw new Error('Connected wallet is not an owner of this smart wallet.')
      }

      const provisionRes = await apiFetch('/api/v1/agents/creators/provision-wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ creatorAddress: canonical }),
      })
      const provisionJson = (await provisionRes.json().catch(() => null)) as ApiEnvelope<ProvisionWalletResponse> | null
      if (!provisionRes.ok || !provisionJson?.success || !provisionJson.data) {
        throw new Error(typeof provisionJson?.error === 'string' ? provisionJson.error : 'Failed to provision Keepr signer.')
      }
      const signerAddressRaw = provisionJson.data.address
      const signerWalletId = provisionJson.data.walletId
      if (!isEvmAddress(signerAddressRaw) || !signerWalletId) {
        throw new Error('Provisioned Keepr signer is invalid.')
      }
      const signerAddress = getAddress(signerAddressRaw) as Address

      const signerAlreadyOwner = (await publicClient.readContract({
        address: canonical,
        abi: COINBASE_SMART_WALLET_OWNER_VIEW_ABI,
        functionName: 'isOwnerAddress',
        args: [signerAddress],
      })) as boolean
      if (!signerAlreadyOwner) {
        const addOwnerData = encodeFunctionData({
          abi: COINBASE_SMART_WALLET_OWNER_MGMT_ABI,
          functionName: 'addOwnerAddress',
          args: [signerAddress],
        })
        const hash = await walletClient.sendTransaction({
          to: canonical,
          data: addOwnerData,
          value: 0n,
          account: connectedOwner,
          chain: base,
        })
        await publicClient.waitForTransactionReceipt({ hash })
      }

      const enableRes = await apiFetch('/api/v1/agents/creators/enable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentType: 'csw',
          cswAddress: canonical,
          privyWalletId: signerWalletId,
          listedPublicly: true,
        }),
      })
      const enableJson = (await enableRes.json().catch(() => null)) as ApiEnvelope<{ creatorAddress: string }> | null
      if (!enableRes.ok || !enableJson?.success) {
        throw new Error(typeof enableJson?.error === 'string' ? enableJson.error : 'Failed to enable automation.')
      }

      await Promise.all([
        smartWalletOwnersQuery.refetch(),
        creatorAutomationQuery.refetch(),
        loadProfile(),
      ])
      setAutomationActionMessage('Keepr signer is enabled for 24/7 automation. You can revoke it anytime.')
    } catch (e: any) {
      setAutomationActionError(typeof e?.message === 'string' ? e.message : 'Failed to enable Keepr signer.')
    } finally {
      setEnableAutomationBusy(false)
    }
  }, [
    automationEnabled,
    canonicalSmartWalletAddress,
    connectedAddress,
    creatorAutomationQuery,
    enableAutomationBusy,
    ensureBaseChain,
    loadProfile,
    publicClient,
    smartWalletOwnersQuery,
    walletClient,
  ])

  const knownAddresses = useMemo<KnownAddress[]>(() => {
    if (!profile) return []
    type Draft = {
      address: string
      badges: Set<string>
      subtitle: string | null
      provider: string | null
      walletType: string | null
      isCanonicalSmartWallet: boolean
      rank: number
      verifiedAt: string | null
    }
    const map = new Map<string, Draft>()
    const upsert = (
      address: string | null | undefined,
      badge: string,
      rank: number,
      subtitle?: string | null,
      verifiedAt?: string | null,
      opts?: {
        provider?: string | null
        walletType?: string | null
        isCanonicalSmartWallet?: boolean
      },
    ) => {
      if (!isEvmAddress(address)) return
      const normalized = address.toLowerCase()
      const existing = map.get(normalized)
      if (!existing) {
        map.set(normalized, {
          address,
          badges: new Set([badge]),
          subtitle: subtitle ?? null,
          provider: opts?.provider ?? null,
          walletType: opts?.walletType ?? null,
          isCanonicalSmartWallet: Boolean(opts?.isCanonicalSmartWallet),
          rank,
          verifiedAt: verifiedAt ?? null,
        })
        return
      }
      existing.badges.add(badge)
      if (rank > existing.rank) {
        existing.rank = rank
        existing.subtitle = subtitle ?? existing.subtitle
        existing.provider = opts?.provider ?? existing.provider
        existing.walletType = opts?.walletType ?? existing.walletType
      } else if (!existing.subtitle && subtitle) {
        existing.subtitle = subtitle
      } else if (!existing.provider && opts?.provider) {
        existing.provider = opts.provider
      }
      if (!existing.walletType && opts?.walletType) {
        existing.walletType = opts.walletType
      }
      existing.isCanonicalSmartWallet = existing.isCanonicalSmartWallet || Boolean(opts?.isCanonicalSmartWallet)
      if (!existing.verifiedAt && verifiedAt) {
        existing.verifiedAt = verifiedAt
      } else if (existing.verifiedAt && verifiedAt) {
        const prevMs = Date.parse(existing.verifiedAt)
        const nextMs = Date.parse(verifiedAt)
        if (Number.isFinite(prevMs) && Number.isFinite(nextMs) && nextMs > prevMs) {
          existing.verifiedAt = verifiedAt
        }
      }
    }

    upsert(canonicalSmartWalletAddress, 'Canonical Smart Wallet from Zora', 100, 'Coinbase Smart Wallet', null, {
      provider: 'coinbase_wallet',
      walletType: 'smart_wallet',
      isCanonicalSmartWallet: true,
    })
    upsert(primarySmartWalletAddress, 'Primary Smart Wallet', 98, 'Coinbase Smart Wallet', null, {
      provider: 'coinbase_wallet',
      walletType: 'smart_wallet',
      isCanonicalSmartWallet: true,
    })
    upsert(profile.primaryWallet, 'Primary Wallet', 80, 'External Wallet', null, {
      walletType: 'external_eoa',
    })
    upsert(profile.primaryEmbeddedEoa, 'Primary User Wallet', 70, 'Privy Embedded', null, {
      provider: 'privy',
      walletType: 'embedded_eoa',
    })
    upsert(profile.embeddedWallet, 'User Wallet', 68, 'Privy Embedded', null, {
      provider: 'privy',
      walletType: 'embedded_eoa',
    })
    if (
      isEvmAddress(profile.baseSubAccount) &&
      (!canonicalSmartWalletAddress || profile.baseSubAccount.toLowerCase() !== canonicalSmartWalletAddress.toLowerCase())
    ) {
      upsert(profile.baseSubAccount, 'Linked Smart Wallet', 74, 'Coinbase Smart Wallet', null, {
        provider: 'coinbase_wallet',
        walletType: 'smart_wallet',
      })
    }

    for (const account of profile.connectedAccounts ?? []) {
      const roles = formatRole(account, {
        canonicalSmartWalletAddress,
        primarySmartWalletAddress,
      })
      const subtitle = formatAccountSummary(account)
      const isCanonical = Boolean(
        canonicalSmartWalletAddress && account.address.toLowerCase() === canonicalSmartWalletAddress.toLowerCase(),
      )
      const isPrimarySmartWallet = Boolean(
        primarySmartWalletAddress && account.address.toLowerCase() === primarySmartWalletAddress.toLowerCase(),
      )
      const baseRank = isCanonical ? 100 : isPrimarySmartWallet ? 98 : account.isPrimary ? 80 : account.isEmbeddedEoa ? 70 : 50
      if (roles.length === 0) {
        upsert(account.address, 'Connected', baseRank, subtitle, account.verifiedAt, {
          provider: account.provider,
          walletType: account.walletType,
          isCanonicalSmartWallet: account.isCanonicalSmartWallet,
        })
      } else {
        for (const role of roles) {
          upsert(account.address, role, baseRank, subtitle, account.verifiedAt, {
            provider: account.provider,
            walletType: account.walletType,
            isCanonicalSmartWallet: account.isCanonicalSmartWallet,
          })
        }
      }
    }

    return Array.from(map.values())
      .map((item) => ({
        address: item.address,
        badges: Array.from(item.badges.values()),
        subtitle: item.subtitle,
        provider: item.provider,
        walletType: item.walletType,
        isCanonicalSmartWallet: item.isCanonicalSmartWallet,
        rank: item.rank,
        verifiedAt: item.verifiedAt,
      }))
      .sort((a, b) => b.rank - a.rank || a.address.localeCompare(b.address))
  }, [canonicalSmartWalletAddress, primarySmartWalletAddress, profile])

  const ownerSlotsByAddress = useMemo(() => {
    const map = new Map<string, SmartWalletOwner[]>()
    for (const owner of smartWalletOwners) {
      if (!owner.ownerAddress || !isEvmAddress(owner.ownerAddress)) continue
      const key = owner.ownerAddress.toLowerCase()
      const existing = map.get(key) ?? []
      existing.push(owner)
      map.set(key, existing)
    }
    for (const entry of map.values()) {
      entry.sort((a, b) => a.index - b.index)
    }
    return map
  }, [smartWalletOwners])

  const knownAddressesWithOwners = useMemo<KnownAddressWithOwners[]>(() => {
    const map = new Map<string, KnownAddressWithOwners>()
    for (const item of knownAddresses) {
      const key = item.address.toLowerCase()
      map.set(key, {
        ...item,
        ownerSlots: ownerSlotsByAddress.get(key) ?? [],
      })
    }

    for (const [address, ownerSlots] of ownerSlotsByAddress.entries()) {
      if (map.has(address)) continue
      map.set(address, {
        address: getAddress(address),
        badges: ['Smart Wallet Owner'],
        subtitle: 'Canonical Smart Wallet owner',
        provider: null,
        walletType: 'external_eoa',
        isCanonicalSmartWallet: false,
        rank: 76,
        verifiedAt: null,
        ownerSlots,
      })
    }

    return Array.from(map.values()).sort((a, b) => b.rank - a.rank || a.address.localeCompare(b.address))
  }, [knownAddresses, ownerSlotsByAddress])

  const zoraProfileIdentifier = useMemo(() => {
    const fromHandle = normalizeHandle(profile?.preprovZoraHandle)
    if (fromHandle) return fromHandle
    if (canonicalSmartWalletAddress) return canonicalSmartWalletAddress
    const primaryWallet = profile?.primaryWallet
    if (isEvmAddress(primaryWallet)) return primaryWallet
    return undefined
  }, [canonicalSmartWalletAddress, profile?.preprovZoraHandle, profile?.primaryWallet])

  const zoraProfileQuery = useZoraProfile(zoraProfileIdentifier)
  const zoraProfile = zoraProfileQuery.data ?? null
  const zoraHandle = normalizeHandle(typeof zoraProfile?.handle === 'string' ? zoraProfile.handle : null)

  const creatorCoinAddress = useMemo(() => {
    const zoraCoinAddress = zoraProfile?.creatorCoin?.address
    const fromProfile = isEvmAddress(zoraCoinAddress) ? zoraCoinAddress : null
    if (fromProfile) return fromProfile.toLowerCase() as Address
    const preprovCoinAddress = profile?.preprovCoinAddress
    if (isEvmAddress(preprovCoinAddress)) return preprovCoinAddress.toLowerCase() as Address
    return undefined
  }, [profile?.preprovCoinAddress, zoraProfile?.creatorCoin?.address])

  const zoraCoinQuery = useZoraCoin(creatorCoinAddress)
  const creatorCoin = zoraCoinQuery.data ?? null

  const farcasterIdentityQuery = useQuery({
    queryKey: ['accountFarcasterIdentity', profile?.farcasterFid ?? 'none', canonicalSmartWalletAddress ?? profile?.primaryWallet ?? 'none'],
    enabled: Boolean((typeof profile?.farcasterFid === 'number' && profile.farcasterFid > 0) || canonicalSmartWalletAddress || profile?.primaryWallet),
    staleTime: 60_000,
    retry: 0,
    queryFn: async () => {
      const fid = typeof profile?.farcasterFid === 'number' && profile.farcasterFid > 0 ? profile.farcasterFid : null
      if (fid) return await getFarcasterUserByFid(fid)
      const primaryWallet = profile?.primaryWallet
      const fallbackAddress = canonicalSmartWalletAddress ?? (isEvmAddress(primaryWallet) ? primaryWallet : null)
      if (!fallbackAddress) return null
      return await getFarcasterUserByAddress(fallbackAddress)
    },
  })

  const farcasterIdentity = farcasterIdentityQuery.data ?? null
  const effectiveFid = typeof farcasterIdentity?.fid === 'number' && farcasterIdentity.fid > 0 ? farcasterIdentity.fid : profile?.farcasterFid ?? null
  const farcasterUsername = normalizeHandle(
    typeof farcasterIdentity?.username === 'string'
      ? farcasterIdentity.username
      : profile?.preprovFarcasterUsername,
  )

  const rewardsSummary = useMemo(
    () =>
      deriveWaitlistRewards({
        position: rewardsPositionQuery.data ?? null,
        fallbackBorderTier: rewardsPositionQuery.data?.borderTier ?? 0,
        handle: zoraHandle ?? farcasterUsername ?? null,
        referralCode: rewardsPositionQuery.data?.referralCode ?? null,
        referralBaseUrl: 'https://4626.fun',
      }),
    [farcasterUsername, rewardsPositionQuery.data, zoraHandle],
  )

  const rewardsTasks = useMemo(
    () =>
      buildSettingsTasks({
        profileCompleted: Boolean(rewardsPositionQuery.data?.profileCompletedAt),
        xVerified: rewardsSummary.badgeEarned,
        emailVerified: Boolean(profile?.email && EMAIL_RE.test(profile.email)),
        hasReferralRef: Boolean(rewardsSummary.referralRef),
        hasQualifiedReferrals: (rewardsPositionQuery.data?.referrals?.qualifiedCount ?? 0) > 0,
      }),
    [profile?.email, rewardsPositionQuery.data?.profileCompletedAt, rewardsPositionQuery.data?.referrals?.qualifiedCount, rewardsSummary.badgeEarned, rewardsSummary.referralRef],
  )

  const onCopyRewardsReferral = useCallback(async () => {
    if (!rewardsSummary.referralRef) {
      setTasksCopyNotice('Referral link is not available yet.')
      window.setTimeout(() => setTasksCopyNotice(null), 1800)
      return
    }
    try {
      await navigator.clipboard.writeText(rewardsSummary.referralUrl)
      setTasksCopyNotice('Copied referral link.')
      window.setTimeout(() => setTasksCopyNotice(null), 1800)
    } catch {
      setTasksCopyNotice('Copy failed. Try again.')
      window.setTimeout(() => setTasksCopyNotice(null), 1800)
    }
  }, [rewardsSummary.referralRef, rewardsSummary.referralUrl])

  const creatorCoinDisplaySymbol = useMemo(() => {
    const fromCoin = typeof creatorCoin?.symbol === 'string' && creatorCoin.symbol.trim() ? creatorCoin.symbol.trim() : null
    if (fromCoin) return fromCoin
    const fromPreprov = typeof profile?.preprovCoinSymbol === 'string' && profile.preprovCoinSymbol.trim() ? profile.preprovCoinSymbol.trim() : null
    return fromPreprov ?? 'Creator Coin'
  }, [creatorCoin?.symbol, profile?.preprovCoinSymbol])

  const creatorCoinStats = useMemo(() => {
    const marketCap = asNumber(creatorCoin?.marketCap) ?? asNumber(zoraProfile?.creatorCoin?.marketCap)
    const volume24h = asNumber(creatorCoin?.volume24h)
    const holders = asNumber(creatorCoin?.uniqueHolders)
    return {
      marketCap,
      volume24h,
      holders,
    }
  }, [creatorCoin?.marketCap, creatorCoin?.volume24h, creatorCoin?.uniqueHolders, zoraProfile?.creatorCoin?.marketCap])

  const onExportEmbeddedWallet = useCallback(async () => {
    if (exportBusy) return
    if (!privyEnabled) {
      setExportMessage('Privy wallet features are disabled in this environment.')
      return
    }
    if (!embeddedExportAddress) {
      setExportMessage('No embedded wallet found to export.')
      return
    }
    setExportBusy(true)
    setExportMessage(null)
    try {
      await exportWallet({ address: embeddedExportAddress })
      setExportMessage('Export flow opened. Complete the secure modal to export your embedded wallet.')
    } catch (e: any) {
      const raw = typeof e?.message === 'string' ? e.message : 'Wallet export failed.'
      setExportMessage(raw)
    } finally {
      setExportBusy(false)
    }
  }, [embeddedExportAddress, exportBusy, exportWallet, privyEnabled])

  const associatedAccounts = useMemo<AssociatedAccount[]>(() => {
    const rows: AssociatedAccount[] = []
    const seen = new Set<string>()
    const add = (row: AssociatedAccount) => {
      const key = `${row.label}:${row.value}`.toLowerCase()
      if (seen.has(key)) return
      seen.add(key)
      rows.push(row)
    }

    if (effectiveFid) {
      add({
        label: 'Farcaster FID',
        value: String(effectiveFid),
        href: `https://warpcast.com/~/profiles/${effectiveFid}`,
      })
    }

    if (farcasterUsername) {
      add({
        label: 'Farcaster',
        value: `@${farcasterUsername}`,
        href: `https://warpcast.com/${farcasterUsername}`,
      })
    }

    if (zoraHandle) {
      add({
        label: 'Zora',
        value: `@${zoraHandle}`,
        href: `https://zora.co/@${zoraHandle}`,
      })
    }

    const lensHandle = normalizeHandle(profile?.lensHandle)
    if (lensHandle) {
      add({
        label: 'Lens',
        value: `@${lensHandle}`,
        href: `https://hey.xyz/u/${lensHandle}`,
      })
    }

    if (canonicalSolanaWalletAddress) {
      add({ label: 'Canonical Solana Wallet', value: canonicalSolanaWalletAddress, mono: true })
    } else if (profile?.solanaWallet) {
      add({ label: 'Solana Wallet', value: profile.solanaWallet, mono: true })
    }
    if (operationalSolanaWalletAddress) {
      add({ label: 'Operational Solana Wallet', value: operationalSolanaWalletAddress, mono: true })
    }
    const lensAccountAddress = profile?.lensAccountAddress
    if (isEvmAddress(lensAccountAddress)) {
      add({ label: 'Lens Account Address', value: lensAccountAddress, mono: true })
    }
    const lensOwnerAddress = profile?.lensOwnerAddress
    if (isEvmAddress(lensOwnerAddress)) {
      add({ label: 'Lens Owner Address', value: lensOwnerAddress, mono: true })
    }
    const farcasterCustodyAddress = farcasterIdentity?.custodyAddress
    if (isEvmAddress(farcasterCustodyAddress)) {
      add({ label: 'Farcaster Custody Wallet', value: farcasterCustodyAddress, mono: true })
    }
    for (const wallet of farcasterIdentity?.verifiedEthAddresses ?? []) {
      if (!isEvmAddress(wallet)) continue
      add({ label: 'Farcaster Verified Wallet', value: wallet, mono: true })
    }

    const zoraLinkedWallets = Array.isArray(zoraProfile?.linkedWallets?.edges)
      ? zoraProfile?.linkedWallets?.edges ?? []
      : []
    for (const edge of zoraLinkedWallets) {
      const walletAddress = edge?.node?.walletAddress
      if (!isEvmAddress(walletAddress)) continue
      add({ label: 'Zora Linked Wallet', value: walletAddress, mono: true })
    }

    const social = zoraProfile?.socialAccounts
    const twitterHandle = normalizeHandle(social?.twitter?.username)
    if (twitterHandle) add({ label: 'X', value: `@${twitterHandle}`, href: `https://x.com/${twitterHandle}` })
    const instagramHandle = normalizeHandle(social?.instagram?.username)
    if (instagramHandle) add({ label: 'Instagram', value: `@${instagramHandle}`, href: `https://instagram.com/${instagramHandle}` })
    const tiktokHandle = normalizeHandle(social?.tiktok?.username)
    if (tiktokHandle) add({ label: 'TikTok', value: `@${tiktokHandle}`, href: `https://tiktok.com/@${tiktokHandle}` })

    return rows
  }, [
    effectiveFid,
    farcasterIdentity?.custodyAddress,
    farcasterIdentity?.verifiedEthAddresses,
    farcasterUsername,
    profile?.lensAccountAddress,
    profile?.lensHandle,
    profile?.lensOwnerAddress,
    canonicalSolanaWalletAddress,
    operationalSolanaWalletAddress,
    profile?.solanaWallet,
    zoraHandle,
    zoraProfile?.linkedWallets?.edges,
    zoraProfile?.socialAccounts,
  ])

  const accessTone = useMemo(() => {
    const status = String(profile?.appAccessStatus ?? '').toLowerCase()
    if (status.includes('allow') || status.includes('approved')) {
      return {
        chip: 'border-emerald-400/35 bg-emerald-500/12 text-emerald-200',
        dot: 'bg-emerald-400',
        label: 'Approved',
      }
    }
    if (status.includes('wait') || status.includes('pending')) {
      return {
        chip: 'border-amber-400/35 bg-amber-500/12 text-amber-200',
        dot: 'bg-amber-400',
        label: 'Pending',
      }
    }
    return {
      chip: 'border-zinc-500/35 bg-zinc-500/10 text-zinc-300',
      dot: 'bg-zinc-500',
      label: humanizeToken(profile?.appAccessStatus) ?? 'Unknown',
    }
  }, [profile?.appAccessStatus])

  const topKnownAddress = knownAddressesWithOwners[0]?.address ?? null

  if (!auth.sessionHydrated || loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 space-y-5" aria-busy="true" aria-label="Loading account…">
        <div className="card rounded-2xl p-6 space-y-4">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-16 rounded-xl" />
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <div className="card rounded-xl p-6 space-y-3">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-11 w-full rounded-xl" />
            <Skeleton className="h-9 w-28 rounded-xl" />
          </div>
          <div className="card rounded-xl p-6 space-y-3">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-16 w-full rounded-xl" />
          </div>
        </div>
      </div>
    )
  }

  if (!auth.isSignedIn) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        <div className="card rounded-xl p-8 space-y-4">
          <div className="text-xl text-white">Sign in required</div>
          <div className="text-sm text-zinc-400">Sign in to manage your email and connected accounts.</div>
          <Button
            variant="primary"
            size="lg"
            onClick={() => void auth.signIn()}
            loading={auth.busy}
          >
            Sign in
          </Button>
          {auth.error ? <div className="text-xs text-red-400/90">{auth.error}</div> : null}
          <div>
            <a
              href={`${getMarketingBaseUrl()}/#waitlist`}
              className="inline-flex min-h-10 items-center text-sm text-zinc-400 hover:text-zinc-200"
            >
              Back to waitlist
            </a>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="relative mx-auto max-w-6xl space-y-5 px-3 py-6 sm:space-y-6 sm:px-6 sm:py-10">
      <PageMeta title="Account" description="Manage your connected wallet, smart account mode, and 4626 settings." canonicalPath="/account" />
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(120%_90%_at_50%_0%,rgba(0,82,255,0.12),transparent_58%)]" />
      </div>

      {/* Account Mode Indicator — Hero */}
      <div className="rounded-2xl border border-white/8 bg-white/2 p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="text-[10px] text-zinc-600 mb-2 font-medium tracking-[0.08em] uppercase">Execution context</div>
            <AccountModeIndicator />
          </div>
          <div className="text-[11px] text-zinc-600 sm:text-right">
            {canonicalSmartWalletAddress ? (
              <span>
                Smart Wallet:{' '}
                <span className="font-mono text-zinc-400">{canonicalSmartWalletAddress.slice(0, 6)}…{canonicalSmartWalletAddress.slice(-4)}</span>
              </span>
            ) : (
              <span className="text-amber-500/70">No Smart Wallet linked</span>
            )}
          </div>
        </div>
      </div>

      {/* CSW failure alert */}
      {profile && !canonicalSmartWalletAddress && (
        <Alert variant="warning" title="Smart Wallet not detected">
          Your account does not have a linked Coinbase Smart Wallet. Some features (1-click swaps, bundled transactions) require one. Try reconnecting or contact support if this is unexpected.
        </Alert>
      )}

      {identityLookupAddress ? (
        <section className="card rounded-2xl p-4 sm:p-6">
          <div className="mb-3 text-[12px] text-zinc-300">Ethereum identity</div>
          <ProfileCard
            addressOrName={identityLookupAddress}
            connectedAddress={connectedAddress ?? undefined}
            darkMode
            showPoaps={false}
            showFollowButton={false}
          />
        </section>
      ) : null}

      <section className="card space-y-3 rounded-2xl p-4 sm:space-y-4 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-[10px] font-medium text-zinc-600">Account</div>
            <h1 className="mt-1 text-[1.6rem] sm:text-[1.9rem] font-semibold text-white">Identity Control Plane</h1>
            <p className="mt-1 text-[13px] text-zinc-400 sm:text-sm">Wallet architecture, creator profile, and operational controls.</p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <a
              href={accountSurfaceUrl}
              className="inline-flex min-h-10 w-full items-center justify-center gap-1.5 rounded-xl border border-white/8 bg-white/4 px-3.5 text-sm font-medium text-vault-text hover:bg-white/8 hover:text-white transition-colors sm:w-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
            >
              Account URL
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
            <a
              href={appAccountUrl}
              className="inline-flex min-h-10 w-full items-center justify-center gap-1.5 rounded-xl border border-white/8 bg-white/4 px-3.5 text-sm font-medium text-vault-text hover:bg-white/8 hover:text-white transition-colors sm:w-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
            >
              App Account
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
            <Button
              variant="secondary"
              size="md"
              onClick={() => void loadProfile()}
              loading={loading}
              className="w-full sm:w-auto"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-3 xl:grid-cols-4">
          <div className="rounded-xl border border-white/10 bg-white/4 px-3 py-2.5 sm:py-3">
            <div className="text-[10px] font-medium text-zinc-500">◉ Connected Owner</div>
            <div className="mt-1 break-all font-mono text-[11px] text-zinc-100 sm:text-[12px]">{connectedAddress ?? 'Not connected'}</div>
          </div>
          <div className="rounded-xl border border-[#0052FF]/20 bg-[#0052FF]/10 px-3 py-2.5 sm:py-3">
            <div className="text-[10px] font-medium text-[#8fb1ff]">⬢ Canonical CSW</div>
            <div className="mt-1 break-all font-mono text-[11px] text-white sm:text-[12px]">{canonicalSmartWalletAddress ?? 'Not detected'}</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/4 px-3 py-2.5 sm:py-3">
            <div className="text-[10px] font-medium text-zinc-500">◈ Creator Coin</div>
            <div className="mt-1 text-[12px] text-zinc-100 sm:text-[13px]">{creatorCoinAddress ? creatorCoinDisplaySymbol : 'Not detected'}</div>
            {creatorCoinAddress ? <div className="truncate font-mono text-[10px] text-zinc-400 sm:text-[11px]">{creatorCoinAddress}</div> : null}
          </div>
          <div className={`rounded-xl border px-3 py-2.5 sm:py-3 ${accessTone.chip}`}>
            <div className="text-[10px] font-medium">Access</div>
            <div className="mt-1 inline-flex items-center gap-1.5 text-[12px] sm:text-[13px]">
              <span className={`h-1.5 w-1.5 rounded-full ${accessTone.dot}`} />
              {accessTone.label}
            </div>
          </div>
        </div>
      </section>

      {error && (
        <Alert variant="error" onDismiss={() => setError(null)}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert variant="success" onDismiss={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-4 sm:gap-6 xl:grid-cols-[1.25fr_1fr]">
      <section className="card rounded-xl p-4 space-y-4 sm:p-6">
        <div className="flex items-center gap-2 text-white">
          <Mail className="w-4 h-4" />
          <h2 className="text-base sm:text-lg">Email</h2>
        </div>
        <p className="text-[13px] text-zinc-400 sm:text-sm">Use a real email for updates and account recovery.</p>
        <div className="space-y-2">
          <label htmlFor="account-email" className="text-[11px] font-medium text-zinc-500">
            Email Address
          </label>
          <input
            id="account-email"
            type="email"
            value={emailDraft}
            onChange={(e) => setEmailDraft(e.target.value)}
            placeholder="you@example.com"
            className="min-h-11 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-brand-primary"
          />
        </div>
        <div className="flex flex-col items-start gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
          <button
            type="button"
            onClick={() => void onSaveEmail()}
            disabled={!canSaveEmail || saving}
            className="btn-accent min-h-11 w-full justify-center disabled:opacity-50 sm:w-auto"
          >
            {saving ? 'Saving…' : 'Update Email'}
          </button>
          <span className="text-xs text-zinc-500">
            Current: {profile?.email ? profile.email : 'Not set'}
          </span>
        </div>
      </section>

      <section className="card rounded-xl p-4 space-y-4 sm:p-6">
        <div className="flex items-center gap-2 text-white">
          <Wallet className="w-4 h-4" />
          <h2 className="text-base sm:text-lg">Connected Accounts</h2>
        </div>
        <p className="text-[13px] text-zinc-400 sm:text-sm">Wallets and linked accounts associated with your profile.</p>

        {canonicalSmartWalletAddress ? (
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-2.5 space-y-2 sm:p-3">
            <div className="flex flex-col items-start gap-1.5 text-xs text-zinc-500 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2">
              <span className="w-full">
                Canonical Smart Wallet from Zora:{' '}
                <span className="break-all font-mono text-zinc-300">{canonicalSmartWalletAddress}</span>
              </span>
              {connectedAddress ? (
                <span className="w-full">
                  Connected owner: <span className="break-all font-mono text-zinc-300">{connectedAddress}</span>
                </span>
              ) : (
                <span>Connect an owner to revoke owner slots.</span>
              )}
            </div>
            <div className="text-[11px] text-zinc-500">
              Non-canonical Privy smart wallets are shown as deploy-session signers, not as the canonical Smart Wallet.
            </div>
            <div id="account-aa-setup" className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-3 space-y-2">
              <div className="text-[12px] font-medium text-zinc-200">Enable 1-click actions</div>
              <p className="text-[11px] text-zinc-400">
                One-time wallet approval to enable ERC-4337 Account Abstraction with your canonical wallet.
              </p>
              <p className="text-[11px] text-zinc-500">
                No funds move. Canonical wallet stays in control. Revoke anytime.
              </p>
              <div className="text-[11px] text-zinc-500">
                {embeddedExportAddress ? (
                  <>
                    Privy embedded wallet target:{' '}
                    <span className="break-all font-mono text-zinc-300">{embeddedExportAddress}</span>
                  </>
                ) : (
                  'No Privy embedded wallet detected yet.'
                )}
              </div>
              <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="button"
                  onClick={() => void onEnableOneClickActions()}
                  disabled={
                    enableOneClickBusy ||
                    embeddedOwnerAlreadyLinked ||
                    !embeddedExportAddress ||
                    !connectedAddress ||
                    !connectedAddressIsOwner ||
                    !walletClient ||
                    !publicClient
                  }
                  className="btn-secondary min-h-11 w-full justify-center disabled:opacity-50 sm:w-auto"
                >
                  {embeddedOwnerAlreadyLinked
                    ? 'Enabled'
                    : enableOneClickBusy
                      ? 'Enabling…'
                      : 'Enable 1-click actions'}
                </button>
                <div className="text-[11px] text-zinc-500">
                  {!connectedAddress
                    ? 'Connect an owner wallet to continue.'
                    : !connectedAddressIsOwner
                      ? 'Connected wallet must be an owner of this smart wallet.'
                      : 'One approval transaction on Base.'}
                </div>
              </div>
            </div>
            <div id="account-automation-setup" className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-3 space-y-2">
              <div className="text-[12px] font-medium text-zinc-200">Enable Keepr signer (optional)</div>
              <p className="text-[11px] text-zinc-400">
                Optional one-time approval for unattended automation when you are offline.
              </p>
              <p className="text-[11px] text-zinc-500">
                Uses ERC-4337 with your canonical wallet. No funds move. Canonical wallet stays in control.
              </p>
              {creatorAutomationQuery.isLoading ? (
                <div className="text-[11px] text-zinc-500">Checking automation status…</div>
              ) : null}
              {creatorAutomationQuery.isError ? (
                <div className="text-[11px] text-red-300">
                  {creatorAutomationQuery.error instanceof Error
                    ? creatorAutomationQuery.error.message
                    : 'Failed to load automation status.'}
                </div>
              ) : null}
              {creatorAutomationQuery.data?.agentAddress ? (
                <div className="text-[11px] text-zinc-500">
                  Automation agent:{' '}
                  <span className="break-all font-mono text-zinc-300">{creatorAutomationQuery.data.agentAddress}</span>
                </div>
              ) : null}
              {automationActionMessage ? (
                <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
                  {automationActionMessage}
                </div>
              ) : null}
              {automationActionError ? (
                <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                  {automationActionError}
                </div>
              ) : null}
              <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="button"
                  onClick={() => void onEnableAutomation()}
                  disabled={
                    enableAutomationBusy ||
                    automationEnabled ||
                    !canonicalSmartWalletAddress ||
                    !connectedAddress ||
                    !connectedAddressIsOwner ||
                    !walletClient ||
                    !publicClient
                  }
                  className="btn-secondary min-h-11 w-full justify-center disabled:opacity-50 sm:w-auto"
                >
                  {automationEnabled
                    ? 'Keepr signer enabled'
                    : enableAutomationBusy
                      ? 'Enabling Keepr signer…'
                      : 'Enable Keepr signer'}
                </button>
                <div className="text-[11px] text-zinc-500">
                  {!connectedAddress
                    ? 'Connect an owner wallet to continue.'
                    : !connectedAddressIsOwner
                      ? 'Connected wallet must be an owner of this smart wallet.'
                      : 'One approval transaction on Base.'}
                </div>
              </div>
            </div>
            {ownersActionMessage ? (
              <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
                {ownersActionMessage}
              </div>
            ) : null}
            {ownersActionError ? (
              <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                {ownersActionError}
              </div>
            ) : null}
            {smartWalletOwnersQuery.isLoading ? <div className="text-xs text-zinc-500">Loading owner slots…</div> : null}
            {smartWalletOwnersQuery.isError ? (
              <div className="text-xs text-red-300">
                {smartWalletOwnersQuery.error instanceof Error
                  ? smartWalletOwnersQuery.error.message
                  : 'Failed to load owner slots.'}
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-2.5 space-y-3 sm:p-3">
          <div className="text-[11px] font-medium text-zinc-500">Solana Wallet Roles</div>
          <div className="space-y-2 text-sm text-zinc-300">
            <div>
              Canonical Solana Wallet:{' '}
              <span className="font-mono text-zinc-100 break-all">
                {canonicalSolanaWalletAddress ?? 'Not set'}
              </span>
            </div>
            <div>
              Operational Solana Wallet:{' '}
              <span className="font-mono text-zinc-100 break-all">
                {operationalSolanaWalletAddress ?? 'None'}
              </span>
            </div>
          </div>
          <div className="text-[11px] text-zinc-500">
            Canonical is the default custody destination. Operational is automation-only and should not be your primary funds destination.
          </div>
          {linkedSolanaWallets.length > 0 ? (
            <div className="space-y-2">
              <label htmlFor="canonical-solana-wallet" className="text-[11px] font-medium text-zinc-500">
                Set Canonical Solana Wallet
              </label>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <select
                  id="canonical-solana-wallet"
                  value={selectedCanonicalSolanaWallet}
                  onChange={(e) => setSelectedCanonicalSolanaWallet(e.target.value)}
                  className="min-h-11 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-brand-primary"
                >
                  {linkedSolanaWallets.map((wallet) => (
                    <option key={`solana-option:${wallet.address}`} value={wallet.address}>
                      {wallet.address} ({wallet.summary})
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => void onSetCanonicalSolanaWallet()}
                  disabled={!canSetCanonicalSolanaWallet}
                  className="btn-secondary min-h-11 w-full justify-center disabled:opacity-50 sm:w-auto"
                >
                  {solanaWalletActionBusy ? 'Updating…' : 'Set Canonical'}
                </button>
              </div>
            </div>
          ) : (
            <div className="text-xs text-zinc-500">
              No linked Solana wallets found yet. Link one first to set a canonical destination.
            </div>
          )}
        </div>

        {knownAddressesWithOwners.length > 0 ? (
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-3 space-y-3 sm:p-4">
            <div className="text-[11px] font-medium text-zinc-500">Known Addresses & Owner Slots</div>
            <div className="space-y-2">
              {knownAddressesWithOwners.map((item) => (
                <div key={`known:${item.address.toLowerCase()}`} className="rounded-lg border border-zinc-800 bg-zinc-950/70 px-3 py-2.5">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex items-start gap-2">
                      <WalletProviderIcon
                        provider={item.provider}
                        walletType={item.walletType}
                        isCanonicalSmartWallet={item.isCanonicalSmartWallet}
                        size={14}
                        className="mt-0.5"
                      />
                      <div className="font-mono text-xs sm:text-sm text-zinc-100 break-all">{item.address}</div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <a
                        href={`https://basescan.org/address/${item.address}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex min-h-9 items-center gap-1 rounded-md border border-zinc-700 px-2.5 py-1 text-[10px] text-zinc-300 hover:text-zinc-100"
                      >
                        BaseScan
                        <ExternalLink className="w-3 h-3" />
                      </a>
                      <button
                        type="button"
                        onClick={() => onCopyAddress(item.address)}
                        className="inline-flex min-h-9 items-center gap-1 rounded-md border border-zinc-700 px-2.5 py-1 text-[10px] text-zinc-300 hover:text-zinc-100"
                      >
                        {copiedAddress === item.address.toLowerCase() ? 'Copied' : 'Copy'}
                        <Copy className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {item.badges.map((badge) => (
                      <span key={`${item.address}:${badge}`} className="rounded-full border border-zinc-700 px-2 py-0.5 text-[10px] font-medium text-zinc-300">
                        {badge}
                      </span>
                    ))}
                  </div>
                  {item.subtitle ? <div className="mt-2 text-[11px] text-zinc-500">{item.subtitle}</div> : null}
                  {formatDateTime(item.verifiedAt) ? (
                    <div className="mt-1 text-[11px] text-zinc-500">Verified {formatDateTime(item.verifiedAt)}</div>
                  ) : null}
                  {item.ownerSlots.length > 0 ? (
                    <div className="mt-2 space-y-2 rounded-md border border-zinc-800 bg-black/20 p-2">
                      <div className="text-[11px] font-medium text-zinc-500">
                        Owner Slots: {item.ownerSlots.map((slot) => `#${slot.index}`).join(', ')}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {item.ownerSlots.map((slot) => {
                          const slotOwnerAddress = slot.ownerAddress && isEvmAddress(slot.ownerAddress) ? getAddress(slot.ownerAddress) : null
                          const isConnectedOwner = Boolean(
                            slotOwnerAddress && connectedAddress && slotOwnerAddress.toLowerCase() === connectedAddress.toLowerCase(),
                          )
                          const disableRevoke =
                            revokeBusyIndex !== null ||
                            !connectedAddressIsOwner ||
                            !slotOwnerAddress ||
                            isConnectedOwner ||
                            addressOwnerCount <= 1
                          return (
                            <button
                              key={`revoke:${item.address.toLowerCase()}:${slot.index}`}
                              type="button"
                              onClick={() => {
                                if (!disableRevoke) setRevokeConfirmOwner(slot)
                              }}
                              disabled={disableRevoke}
                              className="inline-flex min-h-9 items-center gap-1 rounded-md border border-red-500/30 bg-red-500/10 px-2.5 py-1 text-[10px] text-red-200 disabled:opacity-40 hover:bg-red-500/20 transition-colors"
                              title={
                                !connectedAddressIsOwner
                                  ? 'Connected wallet is not an owner'
                                  : isConnectedOwner
                                    ? 'Cannot revoke connected owner from this page'
                                    : addressOwnerCount <= 1
                                      ? 'Cannot revoke the last address owner'
                                      : `Revoke owner at index #${slot.index}`
                              }
                              aria-label={`Revoke owner at slot #${slot.index}`}
                            >
                              {revokeBusyIndex === slot.index ? `Revoking #${slot.index}…` : `Revoke #${slot.index}`}
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {profile?.connectedAccounts?.length ? (
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-3 space-y-2 sm:p-4">
            <div className="text-[11px] font-medium text-zinc-500">Sync Summary</div>
            <div className="text-sm text-zinc-300">
              {knownAddressesWithOwners.length} unique addresses from {profile.connectedAccounts.length} synced records.
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 px-4 py-3 text-sm text-zinc-400">
            No connected accounts found for this profile yet.
          </div>
        )}
      </section>
      </div>

      <section className="card rounded-xl p-4 space-y-4 sm:p-6">
        <div className="flex items-center gap-2 text-white">
          <ShieldCheck className="w-4 h-4" />
          <h2 className="text-base sm:text-lg">Creator Profile</h2>
        </div>
        <p className="text-[13px] text-zinc-400 sm:text-sm">Creator coin, public profile stats, and associated identities.</p>

        {creatorCoinAddress ? (
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 px-3 py-3 space-y-3 sm:px-4 sm:py-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
              <div>
                <div className="text-sm text-zinc-100">{creatorCoinDisplaySymbol}</div>
                <div className="font-mono text-xs text-zinc-400 break-all">{creatorCoinAddress}</div>
              </div>
              <a
                href={`https://zora.co/coin/base:${creatorCoinAddress}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-9 items-center gap-1 rounded-md border border-zinc-700 px-2.5 py-1 text-[10px] text-zinc-300 hover:text-zinc-100"
              >
                View on Zora
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <div className="rounded-md border border-zinc-800 bg-black/30 px-2 py-2">
                <div className="text-[10px] font-medium text-zinc-500">Market Cap</div>
                <div className="mt-1 text-sm text-zinc-100">{formatUsdCompact(creatorCoinStats.marketCap)}</div>
              </div>
              <div className="rounded-md border border-zinc-800 bg-black/30 px-2 py-2">
                <div className="text-[10px] font-medium text-zinc-500">24h Volume</div>
                <div className="mt-1 text-sm text-zinc-100">{formatUsdCompact(creatorCoinStats.volume24h)}</div>
              </div>
              <div className="rounded-md border border-zinc-800 bg-black/30 px-2 py-2">
                <div className="text-[10px] font-medium text-zinc-500">Holders</div>
                <div className="mt-1 text-sm text-zinc-100">{formatCountCompact(creatorCoinStats.holders)}</div>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 px-4 py-3 text-sm text-zinc-400">
            No creator coin detected yet for this account.
          </div>
        )}

        {associatedAccounts.length > 0 ? (
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-3 space-y-2 sm:p-4">
            <div className="text-[11px] font-medium text-zinc-500">Associated Accounts</div>
            <div className="space-y-2">
              {associatedAccounts.map((item) => (
                <div key={`${item.label}:${item.value}`} className="flex flex-col items-start gap-2 rounded-md border border-zinc-800 bg-zinc-950/60 px-3 py-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                  <div className="text-[11px] font-medium text-zinc-500">{item.label}</div>
                  {item.href ? (
                    <a
                      href={item.href}
                      target="_blank"
                      rel="noreferrer"
                      className={`text-sm text-zinc-200 hover:text-white ${item.mono ? 'break-all font-mono' : 'wrap-break-word'}`}
                    >
                      {item.value}
                    </a>
                  ) : (
                    <div className={`text-sm text-zinc-200 ${item.mono ? 'font-mono break-all' : ''}`}>{item.value}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 px-4 py-3 text-sm text-zinc-400">
            No associated social accounts found yet.
          </div>
        )}

        {miniApp.isMiniApp === true ? (
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-3 space-y-2 sm:px-4">
            <div className="text-[11px] font-medium text-zinc-500">Farcaster (Optional)</div>
            {effectiveFid ? (
              <div className="text-sm text-zinc-200">
                Linked as{' '}
                {farcasterUsername ? (
                  <a
                    href={`https://warpcast.com/${farcasterUsername}`}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-white"
                  >
                    @{farcasterUsername}
                  </a>
                ) : (
                  <span>FID {effectiveFid}</span>
                )}
                .
              </div>
            ) : (
              <div className="text-sm text-zinc-300">
                Link Farcaster only if you want optional social points. It is not required for swaps or vault actions.
              </div>
            )}
            {!effectiveFid ? (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="button"
                  onClick={() => void farcasterAuth.signIn()}
                  disabled={farcasterAuth.status === 'loading' || farcasterAuth.canSiwf === false}
                  className="btn-secondary min-h-10 w-full justify-center disabled:opacity-50 sm:w-auto"
                >
                  {farcasterAuth.status === 'loading' ? 'Verifying Farcaster…' : 'Link Farcaster'}
                </button>
                <a href="/account#account-points-tasks" className="text-xs text-zinc-500 hover:text-zinc-300">
                  View points tasks
                </a>
              </div>
            ) : null}
            {farcasterAuth.status === 'error' && farcasterAuth.error ? (
              <div className="text-xs text-rose-300">{farcasterAuth.error}</div>
            ) : null}
          </div>
        ) : null}

        <div id="account-points-tasks" className="rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-3 space-y-3 sm:px-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-[11px] font-medium text-zinc-500">Tasks to earn points</div>
              <div className="mt-1 text-sm text-zinc-300">
                {rewardsSummary.pointsBalance.toLocaleString()} points · {rewardsSummary.tierLabel}
              </div>
            </div>
            <div className="inline-flex items-center gap-2">
              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                rewardsSummary.badgeEarned
                  ? 'border-emerald-400/25 bg-emerald-500/10 text-emerald-200'
                  : 'border-zinc-700 bg-zinc-900/40 text-zinc-400'
              }`}>
                {rewardsSummary.badgeEarned ? 'Verified badge earned' : 'Badge pending'}
              </span>
            </div>
          </div>

          {rewardsPositionQuery.isLoading ? (
            <div className="text-xs text-zinc-500">Loading tasks…</div>
          ) : rewardsPositionQuery.isError ? (
            <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
              {rewardsPositionQuery.error instanceof Error ? rewardsPositionQuery.error.message : 'Failed to load rewards tasks.'}
            </div>
          ) : (
            <div className="space-y-2">
              {rewardsTasks.map((task) => (
                <div key={task.key} className="rounded-md border border-zinc-800 bg-zinc-950/60 px-3 py-2.5">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="text-sm text-zinc-100">{task.title}</div>
                      <div className="text-[11px] text-zinc-500">+{task.points} points</div>
                    </div>
                    <span className={`inline-flex w-fit rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                      task.status === 'completed'
                        ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200'
                        : task.status === 'available'
                          ? 'border-brand-primary/30 bg-brand-primary/10 text-brand-300'
                          : 'border-zinc-700 bg-zinc-900/40 text-zinc-500'
                    }`}>
                      {task.status}
                    </span>
                  </div>
                  <div className="mt-2">
                    {task.key === 'refer_friend' ? (
                      <button
                        type="button"
                        onClick={() => void onCopyRewardsReferral()}
                        disabled={task.status === 'locked'}
                        className="btn-secondary min-h-10 w-full justify-center disabled:opacity-50 sm:w-auto"
                      >
                        {task.ctaLabel}
                      </button>
                    ) : (
                      <a
                        href={task.href}
                        target={task.href.startsWith('http') ? '_blank' : undefined}
                        rel={task.href.startsWith('http') ? 'noreferrer' : undefined}
                        className={`btn-secondary min-h-10 w-full justify-center sm:w-auto ${
                          task.status === 'locked' ? 'pointer-events-none opacity-50' : ''
                        }`}
                      >
                        {task.ctaLabel}
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="rounded-md border border-zinc-800 bg-black/20 px-3 py-2 text-[11px] text-zinc-500">
            Referral link: <span className="font-mono text-zinc-300 break-all">{rewardsSummary.referralUrl}</span>
          </div>
          {tasksCopyNotice ? <div className="text-xs text-emerald-300">{tasksCopyNotice}</div> : null}
        </div>

        <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 px-3 py-3 space-y-2 sm:px-4">
          <div className="text-[11px] font-medium text-zinc-500">Embedded Wallet Export</div>
          <div className="text-sm text-zinc-300">
            {embeddedExportAddress ? (
              <>
                Export your Privy embedded User wallet: <span className="font-mono text-zinc-200 break-all">{embeddedExportAddress}</span>
              </>
            ) : (
              'No embedded wallet detected for this account yet.'
            )}
          </div>
          <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-3">
            <button
              type="button"
              onClick={() => void onExportEmbeddedWallet()}
              disabled={!embeddedExportAddress || exportBusy || !privyEnabled}
              className="btn-secondary min-h-11 w-full justify-center disabled:opacity-50 sm:w-auto"
            >
              {exportBusy ? 'Opening export…' : 'Export Embedded Wallet'}
            </button>
            <div className="text-xs text-zinc-500">Privy handles key export in a secure iframe; this app cannot read your private key.</div>
          </div>
          {exportMessage ? <div className="text-xs text-zinc-400">{exportMessage}</div> : null}
        </div>
      </section>

      <section className="card rounded-xl p-4 space-y-2.5 sm:p-6">
        <div className="flex items-center gap-2 text-white">
          <ShieldCheck className="w-4 h-4" />
          <h2 className="text-base sm:text-lg">Access</h2>
        </div>
        <div className="text-sm text-zinc-400">
          App access status: <span className="text-zinc-200">{humanizeToken(profile?.appAccessStatus) ?? 'Unknown'}</span>
        </div>
        <div className="text-sm text-zinc-400">
          Last updated: <span className="text-zinc-200">{formatDateTime(profile?.updatedAt) ?? '—'}</span>
        </div>
        {profile?.privyUserId ? (
          <div className="text-sm text-zinc-400">
            Privy user: <span className="break-all font-mono text-zinc-300">{profile.privyUserId}</span>
          </div>
        ) : null}
        {success ? (
          <div className="mt-2 inline-flex items-center gap-2 text-emerald-300 text-sm">
            <CheckCircle2 className="w-4 h-4" />
            Changes saved
          </div>
        ) : null}
      </section>

      {topKnownAddress ? (
        <div className="text-xs text-zinc-500">
          Primary wallet fingerprint: <span className="break-all font-mono text-zinc-300">{topKnownAddress}</span>
        </div>
      ) : null}

      {/* Revoke Owner Confirmation Modal */}
      <Modal
        open={revokeConfirmOwner !== null}
        onClose={() => setRevokeConfirmOwner(null)}
        title="Revoke owner?"
        description="Confirm owner revocation from smart wallet"
      >
        <div className="space-y-4">
          <Alert variant="warning" title="This action is permanent">
            Removing an owner cannot be undone from this page. You will need to re-add the owner manually if removed by mistake.
          </Alert>
          {revokeConfirmOwner && (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-3 space-y-1">
              <div className="text-xs text-zinc-500">Owner slot</div>
              <div className="font-mono text-sm text-zinc-100">#{revokeConfirmOwner.index}</div>
              {revokeConfirmOwner.ownerAddress && (
                <>
                  <div className="text-xs text-zinc-500 mt-2">Address</div>
                  <div className="font-mono text-xs text-zinc-300 break-all">{revokeConfirmOwner.ownerAddress}</div>
                </>
              )}
            </div>
          )}
        </div>
        <Modal.Footer>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setRevokeConfirmOwner(null)}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            size="sm"
            loading={revokeBusyIndex !== null}
            onClick={() => {
              if (revokeConfirmOwner) {
                void onRevokeOwner(revokeConfirmOwner).finally(() => {
                  setRevokeConfirmOwner(null)
                })
              }
            }}
          >
            <Trash2 className="w-3.5 h-3.5" />
            Revoke owner
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  )
}

export default AccountSettings
