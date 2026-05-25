import { useEffect, useState } from 'react'
import { toViemAccount } from '@privy-io/react-auth'
import type { Address } from 'viem'

import { BASE_CHAIN_ID } from '@/lib/uniswap/swapUtils'
import {
  configureSubAccountSigner,
  getExistingSubAccount,
  resolveSubAccountProvider,
} from '@/lib/wallet/subAccountSetup'

export type SubAccountRuntimeState = {
  ready: boolean
  provider: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> } | null
  status: 'idle' | 'checking' | 'ready' | 'missing-wallet' | 'mismatch' | 'missing-provider' | 'error'
  message: string | null
}

type StoredSubAccountRuntimeState = SubAccountRuntimeState & {
  key: string | null
}

function normalizeAddressOrNull(value: unknown): Address | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return /^0x[a-fA-F0-9]{40}$/.test(trimmed) ? (trimmed as Address) : null
}

function normalizePrivyText(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
}

export function useSwapSubAccountRuntime(params: {
  enabled: boolean
  canonicalAddress: Address | null
  baseSubAccountAddress: Address | null
  baseAccountWallet: any | null
  embeddedWallet: any | null
  baseAccountSdk: any | null
}): SubAccountRuntimeState {
  const [state, setState] = useState<StoredSubAccountRuntimeState>({
    key: null,
    ready: false,
    provider: null,
    status: 'idle',
    message: null,
  })
  const walletAddress = normalizeAddressOrNull(params.baseAccountWallet?.address)
  const runtimeKey =
    params.enabled &&
    params.canonicalAddress &&
    params.baseSubAccountAddress &&
    walletAddress &&
    params.embeddedWallet &&
    params.baseAccountSdk
      ? [
          params.canonicalAddress.toLowerCase(),
          params.baseSubAccountAddress.toLowerCase(),
          walletAddress.toLowerCase(),
          normalizePrivyText(params.embeddedWallet?.address) ?? '',
        ].join(':')
      : null

  useEffect(() => {
    let cancelled = false

    const canonicalAddress = params.canonicalAddress
    const baseSubAccountAddress = params.baseSubAccountAddress
    if (
      !runtimeKey ||
      !canonicalAddress ||
      !baseSubAccountAddress ||
      !params.baseAccountWallet ||
      !params.embeddedWallet ||
      !params.baseAccountSdk
    ) {
      return () => {
        cancelled = true
      }
    }

    ;(async () => {
      try {
        if (!walletAddress || walletAddress.toLowerCase() !== canonicalAddress.toLowerCase()) {
          if (!cancelled) {
            setState({
              key: runtimeKey,
              ready: false,
              provider: null,
              status: 'mismatch',
              message: 'Connected Base Account does not match your canonical smart wallet.',
            })
          }
          return
        }

        if (typeof params.baseAccountWallet.switchChain === 'function') {
          await params.baseAccountWallet.switchChain(BASE_CHAIN_ID).catch(() => null)
        }

        const provider = await resolveSubAccountProvider({
          baseAccountWallet: params.baseAccountWallet,
          embeddedWallet: params.embeddedWallet,
          baseAccountSdk: params.baseAccountSdk,
          toViemAccountFn: toViemAccount,
        }).catch(() => null)
        if (!provider?.request) {
          if (!cancelled) {
            setState({
              key: runtimeKey,
              ready: false,
              provider: null,
              status: 'missing-provider',
              message: 'Base Account provider is unavailable.',
            })
          }
          return
        }

        const existing = await getExistingSubAccount({
          provider,
          parentAddress: canonicalAddress,
        }).catch(() => null)
        if (!existing?.address || existing.address.toLowerCase() !== baseSubAccountAddress.toLowerCase()) {
          if (!cancelled) {
            setState({
              key: runtimeKey,
              ready: false,
              provider: null,
              status: 'mismatch',
              message: 'Connected Base Account did not expose the persisted 4626 sub-account.',
            })
          }
          return
        }

        configureSubAccountSigner({
          baseAccountSdk: params.baseAccountSdk,
          toViemAccountFn: toViemAccount,
          embeddedWallet: params.embeddedWallet,
        })

        if (!cancelled) {
          setState({
            key: runtimeKey,
            ready: true,
            provider,
            status: 'ready',
            message: null,
          })
        }
      } catch (error) {
        if (!cancelled) {
          setState({
            key: runtimeKey,
            ready: false,
            provider: null,
            status: 'error',
            message: error instanceof Error ? error.message : String(error ?? 'Sub-account signer setup failed.'),
          })
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [
    params.baseAccountSdk,
    params.baseAccountWallet,
    params.baseSubAccountAddress,
    params.canonicalAddress,
    params.embeddedWallet,
    params.enabled,
    runtimeKey,
    walletAddress,
  ])

  if (!params.enabled) {
    return { ready: false, provider: null, status: 'idle', message: null }
  }
  if (!params.canonicalAddress || !params.baseSubAccountAddress) {
    return {
      ready: false,
      provider: null,
      status: 'missing-wallet',
      message: 'Canonical CSW or sub-account is missing.',
    }
  }
  if (!params.baseAccountWallet || !params.embeddedWallet || !params.baseAccountSdk) {
    return {
      ready: false,
      provider: null,
      status: 'missing-wallet',
      message: 'Reconnect with Base Account to use your 4626 sub-account.',
    }
  }
  if (!runtimeKey || state.key !== runtimeKey) {
    return { ready: false, provider: null, status: 'checking', message: null }
  }
  return state
}

export function isBaseAccountWallet(wallet: unknown): boolean {
  const record = wallet && typeof wallet === 'object' ? (wallet as Record<string, unknown>) : null
  const type = normalizePrivyText(record?.walletClientType ?? record?.wallet_client_type ?? record?.connector_type)
  return type === 'base_account' || type === 'coinbase_wallet'
}
