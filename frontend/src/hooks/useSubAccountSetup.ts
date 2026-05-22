/**
 * useSubAccountSetup
 *
 * React hook that orchestrates the sub-account setup flow:
 *   - Finds the Base Account (CSW) wallet and the Privy embedded wallet
 *   - Creates or retrieves a sub-account
 *   - Installs the embedded EOA as an on-chain owner of the sub-account
 *   - Configures the embedded wallet as the sub-account signer
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useBaseAccountSdk, useConnectWallet, useActiveWallet, toViemAccount } from '@privy-io/react-auth'
import { usePrivyWalletsFromContext } from '@/lib/privy/walletHooksContext'
import type { Address } from 'viem'
import {
  provisionSubAccount,
  confirmSubAccountEmbeddedOwner,
  finalizeSubAccountSigner,
  resolveSubAccountSetupContext,
  type SubAccountSetupStageEvent,
} from '@/lib/wallet/subAccountSetup'
import { registerBaseAppSubAccountLink } from '@/lib/wallet/subAccountBaseAppRegister'

type SubAccountSetupState = {
  subAccountAddress: Address | null
  parentAddress: Address | null
  isSettingUp: boolean
  error: Error | null
  lastStage: SubAccountSetupStageEvent | null
  created: boolean
}

type ConnectedWalletLike = {
  address?: string
  walletClientType?: string
  wallet_client_type?: string
  getEthereumProvider?: () => Promise<unknown>
  provider?: unknown
}

type ResolvedSetupBundle = {
  baseAccountWallet: ConnectedWalletLike
  embeddedWallet: ConnectedWalletLike
  baseAccountSdk: NonNullable<ReturnType<typeof useBaseAccountSdk>['baseAccountSdk']>
}

type SetupRequirementSnapshot = {
  baseAccountWallet?: ConnectedWalletLike | null
  embeddedWallet?: ConnectedWalletLike | null
  baseAccountSdk?: ResolvedSetupBundle['baseAccountSdk'] | null
}

function isBaseAccountWallet(wallet: ConnectedWalletLike): boolean {
  const type = wallet.walletClientType ?? wallet.wallet_client_type ?? ''
  return type === 'base_account' || type === 'coinbase_wallet'
}

function findBaseAccountWallet(wallets: ConnectedWalletLike[]): ConnectedWalletLike | null {
  return wallets.find(isBaseAccountWallet) ?? null
}

function findEmbeddedWallet(wallets: ConnectedWalletLike[]): ConnectedWalletLike | null {
  return (
    wallets.find(
      (w) => w.walletClientType === 'privy' || w.wallet_client_type === 'privy',
    ) ?? null
  )
}

function buildWalletBundle(params: {
  baseAccountWallet: ConnectedWalletLike
  embeddedWallet: ConnectedWalletLike
  baseAccountSdk: ResolvedSetupBundle['baseAccountSdk']
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

export type SubAccountSetupControls = ReturnType<typeof useSubAccountSetup>

export function useSubAccountSetup() {
  const wallets = usePrivyWalletsFromContext()
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
  const connectedBaseAccountWalletRef = useRef<ConnectedWalletLike | null>(null)

  const baseAccountWallet = useMemo(() => findBaseAccountWallet(wallets), [wallets])

  const embeddedWallet = useMemo(() => findEmbeddedWallet(wallets), [wallets])

  useEffect(() => {
    if (baseAccountWallet) {
      connectedBaseAccountWalletRef.current = baseAccountWallet
    }
  }, [baseAccountWallet])

  const canSetup = Boolean(baseAccountWallet && embeddedWallet && baseAccountSdk)

  const recordMissingSetupRequirements = useCallback((bundle: SetupRequirementSnapshot) => {
    const missing: string[] = []
    if (!bundle.baseAccountWallet) missing.push('Base Account wallet')
    if (!bundle.embeddedWallet) missing.push('Privy embedded wallet')
    if (!bundle.baseAccountSdk) missing.push('Base Account SDK')
    const err = new Error(`Sub-account setup requires: ${missing.join(', ')}`)
    lastSetupErrorRef.current = err
    setState((prev) => ({ ...prev, error: err }))
    return err
  }, [])

  const connectBaseAccountWallet = useCallback(async (): Promise<boolean> => {
    const existing =
      baseAccountWallet ??
      connectedBaseAccountWalletRef.current ??
      findBaseAccountWallet(wallets)
    if (existing) {
      connectedBaseAccountWalletRef.current = existing
      return true
    }
    if (!embeddedWallet || !baseAccountSdk) {
      recordMissingSetupRequirements({
        baseAccountWallet: null,
        embeddedWallet: embeddedWallet ?? null,
        baseAccountSdk: baseAccountSdk ?? null,
      })
      return false
    }

    try {
      const result = await Promise.resolve(
        connectWallet({
          walletList: ['base_account', 'coinbase_wallet'],
          walletChainType: 'ethereum-only',
          description: 'Connect your Base App wallet to enable 4626 signing.',
        }),
      ).catch((connectError: unknown) => {
        const message = connectError instanceof Error ? connectError.message : String(connectError ?? '')
        if (message.toLowerCase().includes('user') && message.toLowerCase().includes('reject')) {
          return null
        }
        throw connectError
      })

      const selectedWallet =
        result && typeof result === 'object' && 'wallet' in (result as Record<string, unknown>)
          ? ((result as { wallet?: ConnectedWalletLike }).wallet ?? null)
          : ((result as ConnectedWalletLike | null) ?? null)

      if (selectedWallet && isBaseAccountWallet(selectedWallet)) {
        connectedBaseAccountWalletRef.current = selectedWallet
      }

      if (selectedWallet && typeof setActiveWallet === 'function') {
        await Promise.resolve(setActiveWallet(selectedWallet as Parameters<typeof setActiveWallet>[0])).catch(
          () => null,
        )
      }

      if (selectedWallet) {
        return true
      }

      const err = new Error('Connect Base App first, then try again.')
      lastSetupErrorRef.current = err
      setState((prev) => ({ ...prev, error: err }))
      return false
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      lastSetupErrorRef.current = error
      setState((prev) => ({ ...prev, error }))
      return false
    }
  }, [
    baseAccountSdk,
    baseAccountWallet,
    connectWallet,
    embeddedWallet,
    recordMissingSetupRequirements,
    setActiveWallet,
    wallets,
  ])

  const resolveSetupBundle = useCallback(async (): Promise<ResolvedSetupBundle | null> => {
    let resolvedBase =
      baseAccountWallet ??
      connectedBaseAccountWalletRef.current ??
      findBaseAccountWallet(wallets)

    if (!resolvedBase) {
      const connected = await connectBaseAccountWallet()
      if (!connected) return null
      resolvedBase =
        connectedBaseAccountWalletRef.current ??
        baseAccountWallet ??
        findBaseAccountWallet(wallets)
    }

    const resolvedEmbedded = embeddedWallet ?? findEmbeddedWallet(wallets)
    const resolvedSdk = baseAccountSdk

    if (!resolvedBase || !resolvedEmbedded || !resolvedSdk) {
      recordMissingSetupRequirements({
        baseAccountWallet: resolvedBase,
        embeddedWallet: resolvedEmbedded,
        baseAccountSdk: resolvedSdk,
      })
      return null
    }

    return {
      baseAccountWallet: resolvedBase,
      embeddedWallet: resolvedEmbedded,
      baseAccountSdk: resolvedSdk,
    }
  }, [
    baseAccountSdk,
    baseAccountWallet,
    connectBaseAccountWallet,
    embeddedWallet,
    recordMissingSetupRequirements,
    wallets,
  ])

  const runWithGuard = useCallback(
    async <T,>(fn: (bundle: ResolvedSetupBundle) => Promise<T>): Promise<T | null> => {
      if (setupInProgressRef.current) return null

      const bundle = await resolveSetupBundle()
      if (!bundle) return null

      setupInProgressRef.current = true
      lastSetupErrorRef.current = null
      setState((prev) => ({
        ...prev,
        isSettingUp: true,
        error: null,
        lastStage: null,
      }))

      try {
        return await fn(bundle)
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err))
        lastSetupErrorRef.current = error
        setState((prev) => ({ ...prev, isSettingUp: false, error }))
        return null
      } finally {
        setupInProgressRef.current = false
      }
    },
    [resolveSetupBundle],
  )

  const onStageEvent = useCallback((event: SubAccountSetupStageEvent) => {
    setState((prev) => ({ ...prev, lastStage: event }))
  }, [])

  const provision = useCallback(async () => {
    return runWithGuard(async (bundle) => {
      const walletBundle = buildWalletBundle({ ...bundle, onStageEvent })
      const result = await provisionSubAccount(walletBundle)
      setState((prev) => ({
        ...prev,
        subAccountAddress: result.subAccountAddress,
        parentAddress: result.parentAddress,
        created: result.created,
        isSettingUp: false,
      }))
      return result
    })
  }, [onStageEvent, runWithGuard])

  const confirmEmbeddedOwner = useCallback(
    async (addresses: {
      parentAddress: Address
      subAccountAddress: Address
      provider: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> }
    }) => {
      return runWithGuard(async (bundle) => {
        const ownerResult = await confirmSubAccountEmbeddedOwner({
          provider: addresses.provider,
          parentAddress: addresses.parentAddress,
          subAccountAddress: addresses.subAccountAddress,
          embeddedEoaAddress: bundle.embeddedWallet.address as Address,
          onStageEvent,
        })
        setState((prev) => ({ ...prev, isSettingUp: false }))
        return ownerResult
      })
    },
    [onStageEvent, runWithGuard],
  )

  const finalizeSigner = useCallback(
    async (addresses: { parentAddress: Address; subAccountAddress: Address }) => {
      return runWithGuard(async (bundle) => {
        const embedded = bundle.embeddedWallet as {
          address: string
          getEthereumProvider?: () => Promise<unknown>
        }
        if (typeof setActiveWallet === 'function') {
          try {
            await Promise.resolve(setActiveWallet(embedded as never))
          } catch {
            /* best-effort — configureSubAccountSigner only needs toViemAccount */
          }
        }
        if (typeof embedded.getEthereumProvider === 'function') {
          try {
            await embedded.getEthereumProvider()
          } catch {
            /* provider may attach lazily on first sign; proceed to SDK wiring */
          }
        }

        const walletBundle = buildWalletBundle({ ...bundle, onStageEvent })
        await finalizeSubAccountSigner({
          ...walletBundle,
          parentAddress: addresses.parentAddress,
          subAccountAddress: addresses.subAccountAddress,
        })
        setState((prev) => ({ ...prev, isSettingUp: false }))
        return true
      })
    },
    [onStageEvent, runWithGuard, setActiveWallet],
  )

  const getLastSetupError = useCallback(() => lastSetupErrorRef.current ?? state.error, [state.error])

  const installSubAccountOwnerOnly = useCallback(
    async (addresses: { parentAddress: Address; subAccountAddress: Address }) => {
      return runWithGuard(async (bundle) => {
        const walletBundle = buildWalletBundle({ ...bundle, onStageEvent })
        const ctx = await resolveSubAccountSetupContext(walletBundle)

        await finalizeSubAccountSigner({
          ...walletBundle,
          parentAddress: addresses.parentAddress,
          subAccountAddress: addresses.subAccountAddress,
        })

        const registered = await registerBaseAppSubAccountLink({
          parentAddress: addresses.parentAddress,
          subAccountAddress: addresses.subAccountAddress,
          embeddedEoaAddress: ctx.embeddedAddress,
        })
        if (!registered.ok) {
          throw new Error(registered.message)
        }

        let ownerResult: {
          alreadyOwner: boolean
          transactionHash: `0x${string}` | null
          onChainOwnerInstalled: boolean
          onChainOwnerWarning: string | null
        } = {
          alreadyOwner: false,
          transactionHash: null,
          onChainOwnerInstalled: false,
          onChainOwnerWarning: null,
        }

        try {
          const installed = await confirmSubAccountEmbeddedOwner({
            provider: ctx.provider,
            parentAddress: addresses.parentAddress,
            subAccountAddress: addresses.subAccountAddress,
            embeddedEoaAddress: ctx.embeddedAddress,
            onStageEvent,
          })
          ownerResult = {
            alreadyOwner: installed.alreadyOwner,
            transactionHash: installed.transactionHash,
            onChainOwnerInstalled: true,
            onChainOwnerWarning: null,
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          ownerResult.onChainOwnerWarning = message
        }

        setState((prev) => ({
          ...prev,
          subAccountAddress: addresses.subAccountAddress,
          parentAddress: addresses.parentAddress,
          isSettingUp: false,
        }))

        return {
          registered: true,
          ...ownerResult,
        }
      })
    },
    [onStageEvent, runWithGuard],
  )

  return {
    provisionSubAccount: provision,
    confirmSubAccountEmbeddedOwner: confirmEmbeddedOwner,
    installSubAccountOwnerOnly,
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
