import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getAddress, isAddress } from 'viem'
import { useAccount, usePublicClient, useWalletClient } from 'wagmi'

import { apiFetch } from '@/lib/apiBase'
import { pickCanonicalSmartWalletAddress, type WaitlistMeData } from '@/hooks/canonicalWalletUtils'
import { probeWalletCapabilities } from './getCapabilities'
import { detectSignerType } from './detectSignerType'
import { checkEoaOwnershipOfCsw } from './ownership'
import { resolveActiveAccount } from './resolveActiveAccount'
import { readPreferredAccountMode, writePreferredAccountMode } from './storage'
import { deriveAccountUiFlags } from './deriveUiFlags'
import {
  isAllowedCanonicalSigner,
  isTargetCanonicalCsw,
  resolvePolicyCanonicalAddress,
  shouldApplyCanonicalEnforcement,
} from '../canonicalWalletPolicy'
import type { AccountCapabilities, AccountModePreference, ResolvedAccountContext } from './types'

type ApiEnvelope<T> = { success: boolean; data?: T; error?: string }

const BASE_CHAIN_ID = 8453
const EMPTY_CAPABILITIES: AccountCapabilities = {
  paymasterService: false,
  atomicStatus: 'unknown',
  supports5792: false,
}

type AccountContextValue = ResolvedAccountContext & {
  preferredMode: AccountModePreference | null
  loading: boolean
  actions: {
    refresh: () => Promise<void>
    setPreferredMode: (mode: AccountModePreference) => void
  }
}

const AccountContext = createContext<AccountContextValue | null>(null)

function toChainIdHex(chainId: number | null): `0x${string}` | null {
  if (typeof chainId !== 'number' || !Number.isFinite(chainId) || chainId <= 0) return null
  return `0x${Math.floor(chainId).toString(16)}` as `0x${string}`
}

function normalizeAddress(value: string | undefined): `0x${string}` | undefined {
  if (!value || !isAddress(value)) return undefined
  return getAddress(value).toLowerCase() as `0x${string}`
}

export function AccountContextProvider(props: { children: ReactNode }) {
  const { address: connectedAddress, chainId } = useAccount()
  const { data: walletClient } = useWalletClient()
  const publicClient = usePublicClient()

  const signerAddress = useMemo(() => normalizeAddress(connectedAddress), [connectedAddress])
  const chainIdValue = typeof chainId === 'number' ? chainId : null
  const chainIdHex = useMemo(() => toChainIdHex(chainIdValue), [chainIdValue])

  const waitlistMeQuery = useQuery({
    queryKey: ['account-context', 'waitlist-me'],
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

  const capabilitiesQuery = useQuery({
    queryKey: ['account-context', 'capabilities', signerAddress, chainIdHex],
    enabled: Boolean(walletClient && signerAddress && chainIdHex),
    queryFn: async () =>
      probeWalletCapabilities({
        walletClient,
        signerAddress,
        chainIdHex,
      }),
    staleTime: 10_000,
  })

  const contractCodeQuery = useQuery({
    queryKey: ['account-context', 'contract-code', signerAddress, chainIdValue],
    enabled: Boolean(publicClient && signerAddress),
    queryFn: async (): Promise<boolean | null> => {
      if (!publicClient || !signerAddress) return null
      try {
        const code = await publicClient.getBytecode({ address: signerAddress })
        return Boolean(code && code !== '0x')
      } catch {
        return null
      }
    },
    staleTime: 10_000,
  })

  const capabilities = capabilitiesQuery.data ?? EMPTY_CAPABILITIES

  const signerType = useMemo(
    () =>
      detectSignerType({
        signerAddress,
        capabilities,
        hasContractCode: contractCodeQuery.data ?? null,
      }),
    [signerAddress, capabilities, contractCodeQuery.data],
  )

  const profileCswAddress = useMemo(() => {
    const picked = pickCanonicalSmartWalletAddress(waitlistMeQuery.data)
    return picked ? normalizeAddress(picked) : undefined
  }, [waitlistMeQuery.data])

  const policyCanonicalAddress = useMemo(
    () =>
      resolvePolicyCanonicalAddress({
        canonicalAddress: profileCswAddress,
        signerAddress,
      }) ?? undefined,
    [profileCswAddress, signerAddress],
  )

  const canonicalPolicyApplies = useMemo(
    () =>
      shouldApplyCanonicalEnforcement({
        canonicalAddress: policyCanonicalAddress,
        signerAddress,
      }),
    [policyCanonicalAddress, signerAddress],
  )

  const cswAddress = useMemo(() => {
    if (canonicalPolicyApplies && policyCanonicalAddress) return policyCanonicalAddress
    if (signerType === 'SMART_WALLET' && signerAddress) return signerAddress
    return profileCswAddress
  }, [canonicalPolicyApplies, policyCanonicalAddress, profileCswAddress, signerAddress, signerType])

  const [preferredModeVersion, setPreferredModeVersion] = useState(0)
  const preferredMode = useMemo(
    () => {
      void preferredModeVersion
      return readPreferredAccountMode({
        signerAddress,
        chainId: chainIdValue,
      })
    },
    [chainIdValue, preferredModeVersion, signerAddress],
  )

  const ownerCheckQuery = useQuery({
    queryKey: ['account-context', 'owner-check', signerAddress, cswAddress, chainIdValue],
    enabled: Boolean(signerType === 'EOA' && signerAddress && cswAddress && publicClient && chainIdValue === BASE_CHAIN_ID),
    queryFn: async (): Promise<boolean | null> => {
      const result = await checkEoaOwnershipOfCsw({
        publicClient,
        chainId: chainIdValue,
        expectedChainId: BASE_CHAIN_ID,
        cswAddress,
        ownerAddress: signerAddress,
      })
      return result.value
    },
    staleTime: 10_000,
  })

  const eoaIsOwnerOfCsw = useMemo(() => {
    if (signerType !== 'EOA' || !cswAddress) return null
    if (chainIdValue !== BASE_CHAIN_ID) return null
    return ownerCheckQuery.data ?? null
  }, [signerType, cswAddress, chainIdValue, ownerCheckQuery.data])

  const activeResolution = useMemo(() => {
    const baseResolution = resolveActiveAccount({
      signerType,
      signerAddress,
      cswAddress,
      eoaIsOwnerOfCsw,
      preferredMode,
    })

    if (!canonicalPolicyApplies || !policyCanonicalAddress) return baseResolution

    const signerIsCanonicalCsw = isTargetCanonicalCsw(signerAddress)
    const signerIsAllowedEoa =
      signerType === 'EOA' &&
      isAllowedCanonicalSigner(signerAddress) &&
      // Keep onchain ownership as an enforcement gate when available.
      eoaIsOwnerOfCsw !== false

    if (signerIsCanonicalCsw || signerIsAllowedEoa) {
      return {
        activeAccount: policyCanonicalAddress,
        activeAccountType: 'SMART_WALLET' as const,
        canUseSmartWalletMode: true,
      }
    }

    // Block accidental identity flips to non-canonical smart wallets for the
    // enforced account; user must connect the canonical CSW or an allowed EOA.
    return {
      activeAccount: undefined,
      activeAccountType: 'UNKNOWN' as const,
      canUseSmartWalletMode: false,
    }
  }, [
    canonicalPolicyApplies,
    cswAddress,
    eoaIsOwnerOfCsw,
    policyCanonicalAddress,
    preferredMode,
    signerAddress,
    signerType,
  ])

  const setPreferredMode = useCallback(
    (mode: AccountModePreference) => {
      writePreferredAccountMode(
        {
          signerAddress,
          chainId: chainIdValue,
        },
        mode,
      )
      setPreferredModeVersion((prev) => prev + 1)
    },
    [chainIdValue, signerAddress],
  )

  const refresh = useCallback(async () => {
    await Promise.all([
      waitlistMeQuery.refetch(),
      capabilitiesQuery.refetch(),
      contractCodeQuery.refetch(),
      ownerCheckQuery.refetch(),
    ])
  }, [waitlistMeQuery, capabilitiesQuery, contractCodeQuery, ownerCheckQuery])

  const uiFlags = useMemo(
    () =>
      deriveAccountUiFlags({
        activeAccountType: activeResolution.activeAccountType,
        signerType,
        cswAddress,
        eoaIsOwnerOfCsw,
        chainId: chainIdValue,
        expectedCswChainId: BASE_CHAIN_ID,
        canUseSmartWalletMode: activeResolution.canUseSmartWalletMode,
        capabilities,
      }),
    [
      activeResolution.activeAccountType,
      activeResolution.canUseSmartWalletMode,
      capabilities,
      chainIdValue,
      cswAddress,
      eoaIsOwnerOfCsw,
      signerType,
    ],
  )

  const value = useMemo<AccountContextValue>(
    () => ({
      chainId: chainIdValue,
      chainIdHex,
      signerAddress,
      signerType,
      cswAddress,
      eoaIsOwnerOfCsw,
      activeAccount: activeResolution.activeAccount,
      activeAccountType: activeResolution.activeAccountType,
      capabilities,
      uiFlags,
      preferredMode,
      loading:
        waitlistMeQuery.isLoading ||
        capabilitiesQuery.isLoading ||
        contractCodeQuery.isLoading ||
        ownerCheckQuery.isLoading,
      actions: {
        refresh,
        setPreferredMode,
      },
    }),
    [
      activeResolution.activeAccount,
      activeResolution.activeAccountType,
      capabilities,
      capabilitiesQuery.isLoading,
      chainIdHex,
      chainIdValue,
      contractCodeQuery.isLoading,
      cswAddress,
      eoaIsOwnerOfCsw,
      ownerCheckQuery.isLoading,
      preferredMode,
      refresh,
      setPreferredMode,
      signerAddress,
      signerType,
      uiFlags,
      waitlistMeQuery.isLoading,
    ],
  )

  return <AccountContext.Provider value={value}>{props.children}</AccountContext.Provider>
}

export function useAccountContext(): AccountContextValue {
  const ctx = useContext(AccountContext)
  if (!ctx) {
    throw new Error('useAccountContext must be used within AccountContextProvider')
  }
  return ctx
}

