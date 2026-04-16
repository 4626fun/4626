/**
 * useSubAccountSetup
 *
 * React hook that orchestrates the sub-account setup flow:
 *   - Finds the Base Account (CSW) wallet and the Privy embedded wallet
 *   - Creates or retrieves a sub-account
 *   - Configures the embedded wallet as the sub-account signer
 *
 * Usage:
 *   const { setupSubAccount, subAccountAddress, isSettingUp, error } = useSubAccountSetup()
 *
 *   // Call once during onboarding:
 *   await setupSubAccount()
 *   // subAccountAddress is now the app's execution address
 */

import { useCallback, useMemo, useRef, useState } from 'react'
import { useWallets, useBaseAccountSdk, toViemAccount } from '@privy-io/react-auth'
import type { Address } from 'viem'
import {
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

export function useSubAccountSetup() {
  const { wallets } = useWallets()
  const { baseAccountSdk } = useBaseAccountSdk()

  const [state, setState] = useState<SubAccountSetupState>({
    subAccountAddress: null,
    parentAddress: null,
    isSettingUp: false,
    error: null,
    lastStage: null,
    created: false,
  })

  const setupInProgressRef = useRef(false)

  // Find the Base Account (CSW) wallet and the Privy embedded wallet
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

  const setup = useCallback(async (): Promise<SubAccountSetupResult | null> => {
    if (setupInProgressRef.current) return null
    if (!baseAccountWallet || !embeddedWallet || !baseAccountSdk) {
      const missing = []
      if (!baseAccountWallet) missing.push('Base Account wallet')
      if (!embeddedWallet) missing.push('Privy embedded wallet')
      if (!baseAccountSdk) missing.push('Base Account SDK')
      const err = new Error(`Sub-account setup requires: ${missing.join(', ')}`)
      setState((prev) => ({ ...prev, error: err }))
      return null
    }

    setupInProgressRef.current = true
    setState((prev) => ({
      ...prev,
      isSettingUp: true,
      error: null,
      lastStage: null,
    }))

    try {
      const result = await runSubAccountSetup({
        baseAccountWallet: baseAccountWallet as any,
        embeddedWallet: embeddedWallet as any,
        baseAccountSdk: baseAccountSdk as any,
        toViemAccountFn: toViemAccount,
        onStageEvent: (event) => {
          setState((prev) => ({ ...prev, lastStage: event }))
        },
      })

      setState((prev) => ({
        ...prev,
        subAccountAddress: result.subAccountAddress,
        parentAddress: result.parentAddress,
        isSettingUp: false,
        created: result.created,
      }))

      return result
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      setState((prev) => ({ ...prev, isSettingUp: false, error }))
      return null
    } finally {
      setupInProgressRef.current = false
    }
  }, [baseAccountWallet, embeddedWallet, baseAccountSdk])

  return {
    /** Run the sub-account setup flow. */
    setupSubAccount: setup,
    /** The sub-account address (execution address for the app). */
    subAccountAddress: state.subAccountAddress,
    /** The parent CSW address (universal account). */
    parentAddress: state.parentAddress,
    /** Whether setup is currently in progress. */
    isSettingUp: state.isSettingUp,
    /** The last error, if any. */
    error: state.error,
    /** The last stage event from the setup flow. */
    lastStage: state.lastStage,
    /** Whether a new sub-account was created (vs reusing an existing one). */
    created: state.created,
    /** Whether setup can be initiated (all required wallets/SDK available). */
    canSetup,
    /** The detected Base Account wallet instance. */
    baseAccountWallet,
    /** The detected Privy embedded wallet instance. */
    embeddedWallet,
  }
}
