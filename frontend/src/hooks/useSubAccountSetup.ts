/**
 * useSubAccountSetup
 *
 * React hook that orchestrates the sub-account setup flow:
 *   - Finds the Base Account (CSW) wallet and the Privy embedded wallet
 *   - Creates or retrieves a sub-account
 *   - Installs the embedded EOA as an on-chain owner of the sub-account
 *   - Configures the embedded wallet as the sub-account signer
 */

import { useCallback, useMemo, useRef, useState } from 'react'
import { useWallets, useBaseAccountSdk, useConnectWallet, useActiveWallet, toViemAccount } from '@privy-io/react-auth'
import type { Address } from 'viem'
import {
  provisionSubAccount,
  confirmSubAccountEmbeddedOwner,
  finalizeSubAccountSigner,
  setupSubAccount as runSubAccountSetup,
  type SubAccountSetupResult,
  type SubAccountSetupStageEvent,
} from '@/lib/wallet/subAccountSetup'

type SubAccountSetupState = {
  subAccountAddress: Address | null
  parentAddress: Address | null
  isSettingUp: boolean
  error: Error | null
  lastStage: SubAccountSetupStageEvent | null
  created: boolean
}

function buildWalletBundle(params: {
  baseAccountWallet: any
  embeddedWallet: any
  baseAccountSdk: any
  onStageEvent?: (event: SubAccountSetupStageEvent) => void
}) {
  return {
    baseAccountWallet: params.baseAccountWallet as any,
    embeddedWallet: params.embeddedWallet as any,
    baseAccountSdk: params.baseAccountSdk as any,
    toViemAccountFn: toViemAccount,
    onStageEvent: params.onStageEvent,
  }
}

export function useSubAccountSetup() {
  const { wallets } = useWallets()
  const { baseAccountSdk } = useBaseAccountSdk()
  const { connectWallet } = useConnectWallet()
  const { setActiveWallet } = useActiveWallet()

  const [state, setState] = useState<SubAccountSetupState>({
    subAccountAddress: null,
    parentAddress: null,
    isSettingUp: false,
    error: null,
    lastStage: null,
    created: false,
  })

  const setupInProgressRef = useRef(false)
  const lastSetupErrorRef = useRef<Error | null>(null)

  const baseAccountWallet = useMemo(
    () =>
      wallets.find(
        (w) =>
          (w as any).walletClientType === 'base_account' ||
          (w as any).walletClientType === 'coinbase_wallet' ||
          (w as any).wallet_client_type === 'coinbase_wallet',
      ) ?? null,
    [wallets],
  )

  const embeddedWallet = useMemo(
    () =>
      wallets.find(
        (w) =>
          (w as any).walletClientType === 'privy' ||
          (w as any).wallet_client_type === 'privy',
      ) ?? null,
    [wallets],
  )

  const canSetup = Boolean(baseAccountWallet && embeddedWallet && baseAccountSdk)

  const runWithGuard = useCallback(
    async <T,>(fn: () => Promise<T>): Promise<T | null> => {
      if (setupInProgressRef.current) return null
      if (!baseAccountWallet || !embeddedWallet || !baseAccountSdk) {
        const missing = []
        if (!baseAccountWallet) missing.push('Base Account wallet')
        if (!embeddedWallet) missing.push('Privy embedded wallet')
        if (!baseAccountSdk) missing.push('Base Account SDK')
        const err = new Error(`Sub-account setup requires: ${missing.join(', ')}`)
        lastSetupErrorRef.current = err
        setState((prev) => ({ ...prev, error: err }))
        return null
      }

      setupInProgressRef.current = true
      lastSetupErrorRef.current = null
      setState((prev) => ({
        ...prev,
        isSettingUp: true,
        error: null,
        lastStage: null,
      }))

      try {
        return await fn()
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err))
        lastSetupErrorRef.current = error
        setState((prev) => ({ ...prev, isSettingUp: false, error }))
        return null
      } finally {
        setupInProgressRef.current = false
      }
    },
    [baseAccountSdk, baseAccountWallet, embeddedWallet],
  )

  const onStageEvent = useCallback((event: SubAccountSetupStageEvent) => {
    setState((prev) => ({ ...prev, lastStage: event }))
  }, [])

  const provision = useCallback(async () => {
    return runWithGuard(async () => {
      const bundle = buildWalletBundle({
        baseAccountWallet,
        embeddedWallet,
        baseAccountSdk,
        onStageEvent,
      })
      const result = await provisionSubAccount(bundle)
      setState((prev) => ({
        ...prev,
        subAccountAddress: result.subAccountAddress,
        parentAddress: result.parentAddress,
        created: result.created,
        isSettingUp: false,
      }))
      return result
    })
  }, [baseAccountSdk, baseAccountWallet, embeddedWallet, onStageEvent, runWithGuard])

  const confirmEmbeddedOwner = useCallback(
    async (addresses: {
      parentAddress: Address
      subAccountAddress: Address
      provider: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> }
    }) => {
      return runWithGuard(async () => {
        const ownerResult = await confirmSubAccountEmbeddedOwner({
          provider: addresses.provider,
          parentAddress: addresses.parentAddress,
          subAccountAddress: addresses.subAccountAddress,
          embeddedEoaAddress: embeddedWallet!.address as Address,
          onStageEvent,
        })
        setState((prev) => ({ ...prev, isSettingUp: false }))
        return ownerResult
      })
    },
    [embeddedWallet, onStageEvent, runWithGuard],
  )

  const finalizeSigner = useCallback(
    async (addresses: { parentAddress: Address; subAccountAddress: Address }) => {
      return runWithGuard(async () => {
        const bundle = buildWalletBundle({
          baseAccountWallet,
          embeddedWallet,
          baseAccountSdk,
          onStageEvent,
        })
        await finalizeSubAccountSigner({
          ...bundle,
          parentAddress: addresses.parentAddress,
          subAccountAddress: addresses.subAccountAddress,
        })
        setState((prev) => ({ ...prev, isSettingUp: false }))
        return true
      })
    },
    [baseAccountSdk, baseAccountWallet, embeddedWallet, onStageEvent, runWithGuard],
  )

  const connectBaseAccountWallet = useCallback(async (): Promise<boolean> => {
    if (canSetup) return true
    if (!embeddedWallet || !baseAccountSdk) return false

    try {
      const result = await connectWallet({
        walletList: ['base_account', 'coinbase_wallet'],
        walletChainType: 'ethereum-only',
        description: 'Connect your Base App wallet to enable 4626 signing.',
      }).catch((connectError: unknown) => {
        const message = connectError instanceof Error ? connectError.message : String(connectError ?? '')
        if (message.toLowerCase().includes('user') && message.toLowerCase().includes('reject')) {
          return null
        }
        throw connectError
      })

      const selectedWallet =
        result && typeof result === 'object' && 'wallet' in (result as Record<string, unknown>)
          ? ((result as { wallet?: unknown }).wallet ?? null)
          : (result ?? null)

      if (selectedWallet && typeof setActiveWallet === 'function') {
        await Promise.resolve(setActiveWallet(selectedWallet)).catch(() => null)
      }

      return Boolean(selectedWallet)
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      lastSetupErrorRef.current = error
      setState((prev) => ({ ...prev, error }))
      return false
    }
  }, [baseAccountSdk, canSetup, connectWallet, embeddedWallet, setActiveWallet])

  const getLastSetupError = useCallback(() => lastSetupErrorRef.current ?? state.error, [state.error])

  const setup = useCallback(async (): Promise<SubAccountSetupResult | null> => {
    return runWithGuard(async () => {
      const result = await runSubAccountSetup(
        buildWalletBundle({
          baseAccountWallet,
          embeddedWallet,
          baseAccountSdk,
          onStageEvent,
        }),
      )
      setState((prev) => ({
        ...prev,
        subAccountAddress: result.subAccountAddress,
        parentAddress: result.parentAddress,
        isSettingUp: false,
        created: result.created,
      }))
      return result
    })
  }, [baseAccountSdk, baseAccountWallet, embeddedWallet, onStageEvent, runWithGuard])

  return {
    setupSubAccount: setup,
    provisionSubAccount: provision,
    confirmSubAccountEmbeddedOwner: confirmEmbeddedOwner,
    finalizeSubAccountSigner: finalizeSigner,
    subAccountAddress: state.subAccountAddress,
    parentAddress: state.parentAddress,
    isSettingUp: state.isSettingUp,
    error: state.error,
    lastStage: state.lastStage,
    created: state.created,
    canSetup,
    baseAccountWallet,
    embeddedWallet,
    connectBaseAccountWallet,
    getLastSetupError,
  }
}
