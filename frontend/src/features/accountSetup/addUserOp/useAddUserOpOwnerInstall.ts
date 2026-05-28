import { useCallback, useEffect, useState } from 'react'
import { useBaseAccountSdk } from '@privy-io/react-auth'
import { getAddress, type PublicClient } from 'viem'
import { base } from 'viem/chains'
import { useConnections } from 'wagmi'

import {
  assertAddOwnerSelfCallShape,
  verifyEntryPointHandleOpsTransaction,
} from '@/lib/wallet/addOwnerCallShape'
import { addOwnerViaBaseAppSendCalls, encodeAddOwnerCall } from '@/lib/wallet/baseAppOwnerCalls'
import { ENTRY_POINT_V06_BASE } from '@/lib/wallet/cswOwnerAbi'
import { readIsOwnerAddressIfDeployed } from '@/lib/wallet/cswOwnerRead'
import { detectInAppEnvironment, isBaseAppInAppContext } from '@/lib/wallet/inAppBrowser'
import {
  confirmOwnerInstall,
  fetchPrepareAddPrivyOwner,
  type PreparedOwnerTxRequest,
} from '@/lib/wallet/zoraAddOwnerApi'

type WalletRequest = (args: { method: string; params?: unknown[] }) => Promise<unknown>

const BASE_MAINNET_CHAIN_ID_HEX = '0x2105'

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message
  return 'UserOp owner install failed. Retry from Base App with your smart wallet connected.'
}

function isHexChainId(value: unknown): value is `0x${string}` {
  return typeof value === 'string' && /^0x[0-9a-f]+$/i.test(value)
}

async function ensureBaseMainnetWalletContext(walletRequest: WalletRequest): Promise<void> {
  const current = await walletRequest({ method: 'eth_chainId' })
  if (isHexChainId(current) && current.toLowerCase() === BASE_MAINNET_CHAIN_ID_HEX) return

  try {
    await walletRequest({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: BASE_MAINNET_CHAIN_ID_HEX }],
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error ?? '')
    throw new Error(
      `Base App must be on Base Mainnet for this experiment. ${message}`.trim(),
    )
  }

  const postSwitch = await walletRequest({ method: 'eth_chainId' })
  if (!isHexChainId(postSwitch) || postSwitch.toLowerCase() !== BASE_MAINNET_CHAIN_ID_HEX) {
    throw new Error('Base App is not on Base Mainnet. Switch networks and retry.')
  }
}

async function refreshWalletAuthorization(walletRequest: WalletRequest): Promise<void> {
  await walletRequest({ method: 'eth_requestAccounts' })
}

export type AddUserOpOwnerInstallPublicClient = Pick<
  PublicClient,
  'getTransaction' | 'waitForTransactionReceipt' | 'readContract' | 'getBytecode'
>

export type UseAddUserOpOwnerInstallParams = {
  canonicalCswAddress: string | null | undefined
  privyEmbeddedEoaAddress: string | null | undefined
  authHeaders: () => Promise<Record<string, string>>
  publicClient: AddUserOpOwnerInstallPublicClient | undefined
  enabled?: boolean
  onSuccess?: () => void | Promise<void>
}

export function useAddUserOpOwnerInstall(params: UseAddUserOpOwnerInstallParams) {
  const {
    canonicalCswAddress,
    privyEmbeddedEoaAddress,
    authHeaders,
    publicClient,
    enabled = true,
    onSuccess,
  } = params

  const { baseAccountSdk } = useBaseAccountSdk()
  const connections = useConnections()

  const [prepareLoading, setPrepareLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [alreadyOwner, setAlreadyOwner] = useState(false)
  const [pageError, setPageError] = useState<string | null>(null)
  const [pageNotice, setPageNotice] = useState<string | null>(null)
  const [txHash, setTxHash] = useState<string | null>(null)
  const [callBundleId, setCallBundleId] = useState<string | null>(null)
  const [eventLog, setEventLog] = useState<string[]>([])
  const [preparedTx, setPreparedTx] = useState<PreparedOwnerTxRequest | null>(null)

  const inBaseApp = isBaseAppInAppContext(detectInAppEnvironment())

  const appendEvent = useCallback((row: string) => {
    setEventLog((prev) => [...prev, row].slice(-30))
  }, [])

  const resolveWalletRequest = useCallback(async (): Promise<WalletRequest> => {
    const sdk = baseAccountSdk as { getProvider?: () => { request?: WalletRequest } } | null | undefined
    if (sdk && typeof sdk.getProvider === 'function') {
      try {
        const provider = sdk.getProvider()
        if (provider && typeof provider.request === 'function') {
          appendEvent('wallet:base_account_sdk_provider')
          return (args) => provider.request!(args)
        }
      } catch {
        /* fall through */
      }
    }

    const isCoinbaseLikeConnector = (connectorId: unknown): boolean => {
      const id = String(connectorId ?? '').toLowerCase()
      return id === 'coinbasewalletsdk' || id === 'base-account' || id.includes('coinbase')
    }

    const connection = connections.find((conn) => isCoinbaseLikeConnector(conn.connector?.id))
    if (connection) {
      const provider = (await (connection.connector as { getProvider?: () => Promise<unknown> })
        .getProvider?.()) as { request?: WalletRequest } | null
      if (provider && typeof provider.request === 'function') {
        appendEvent('wallet:coinbase_wagmi_connector')
        return (args) => provider.request!(args)
      }
    }

    throw new Error(
      'Base App wallet provider unavailable. Open https://4626.fun/add in Base App with your smart wallet connected.',
    )
  }, [appendEvent, baseAccountSdk, connections])

  const loadPrepare = useCallback(async () => {
    if (!enabled || !canonicalCswAddress || !privyEmbeddedEoaAddress) return null
    setPrepareLoading(true)
    setPageError(null)
    try {
      const headers = await authHeaders()
      const prepared = await fetchPrepareAddPrivyOwner({ headers })
      if (prepared.alreadyOwner) {
        setAlreadyOwner(true)
        setPreparedTx(null)
        appendEvent('prepare:already_owner')
        return prepared
      }
      setAlreadyOwner(false)
      setPreparedTx(prepared.txRequest)
      appendEvent(`prepare:selector=${prepared.txRequest.data.slice(0, 10)}`)
      return prepared
    } catch (error) {
      setPageError(getErrorMessage(error))
      return null
    } finally {
      setPrepareLoading(false)
    }
  }, [appendEvent, authHeaders, canonicalCswAddress, enabled, privyEmbeddedEoaAddress])

  useEffect(() => {
    if (!enabled) return
    void loadPrepare()
  }, [enabled, loadPrepare])

  const handleSubmitUserOp = useCallback(async (): Promise<boolean> => {
    if (!canonicalCswAddress || !privyEmbeddedEoaAddress) {
      setPageError('Canonical wallet or embedded signer is unavailable. Sign in and retry.')
      return false
    }

    setBusy(true)
    setPageError(null)
    setPageNotice(null)
    setEventLog([])
    appendEvent(`lane:entrypoint_userop via wallet_sendCalls → ${ENTRY_POINT_V06_BASE}`)

    try {
      let txRequest = preparedTx
      if (!txRequest || alreadyOwner) {
        const prepared = await loadPrepare()
        if (prepared && 'alreadyOwner' in prepared && prepared.alreadyOwner) {
          setAlreadyOwner(true)
          setPageNotice('4626 signing is already enabled on your canonical wallet.')
          return true
        }
        if (prepared && 'txRequest' in prepared) {
          txRequest = prepared.txRequest
        }
      }
      if (!txRequest) {
        throw new Error('Could not prepare add-owner transaction.')
      }

      // Server preview is advisory only — submission always uses locally encoded CSW self-call.
      assertAddOwnerSelfCallShape({
        csw: canonicalCswAddress,
        txRequest,
      })
      appendEvent('preflight:server_preview=self_call_shape_ok')

      const walletRequest = await resolveWalletRequest()
      await ensureBaseMainnetWalletContext(walletRequest)
      await refreshWalletAuthorization(walletRequest)

      const csw = getAddress(canonicalCswAddress) as `0x${string}`
      const ownerToAdd = getAddress(privyEmbeddedEoaAddress) as `0x${string}`
      const localCall = encodeAddOwnerCall({ csw, ownerToAdd })
      assertAddOwnerSelfCallShape({
        csw,
        txRequest: { to: localCall.to, data: localCall.data as `0x${string}` },
      })
      appendEvent('preflight:local_encode=self_call_only (no RelayRouter multicall)')

      appendEvent(`submit:csw=${csw}`)
      appendEvent(`submit:owner=${ownerToAdd}`)

      const result = await addOwnerViaBaseAppSendCalls({
        walletRequest,
        csw,
        ownerToAdd,
        chainId: base.id,
        onTelemetry: (event) => {
          appendEvent(`sendCalls:${event.step}`)
        },
      })

      if (!result.transactionHash) {
        throw new Error(
          'wallet_sendCalls completed without a transaction hash. Wait for Base App to finish, then retry.',
        )
      }

      setTxHash(result.transactionHash)
      appendEvent(`tx_hash=${result.transactionHash}`)
      setCallBundleId(result.callBundleId)

      if (publicClient) {
        await publicClient
          .waitForTransactionReceipt({ hash: result.transactionHash, timeout: 90_000 })
          .catch(() => undefined)
        await verifyEntryPointHandleOpsTransaction({
          publicClient,
          txHash: result.transactionHash,
        })
        appendEvent(`verify:entrypoint_handleops=ok (${ENTRY_POINT_V06_BASE})`)
        const installed = await readIsOwnerAddressIfDeployed({
          publicClient,
          cswAddress: csw,
          ownerAddress: ownerToAdd,
        })
        appendEvent(`verify:is_owner=${String(installed)}`)
      }

      const headers = await authHeaders()
      const confirmed = await confirmOwnerInstall({
        cswAddress: canonicalCswAddress,
        ownerAddress: privyEmbeddedEoaAddress,
        txHash: result.transactionHash,
        headers,
      })

      if (
        !confirmed.isOwner &&
        confirmed.confirmationState !== 'pending_tx' &&
        confirmed.confirmationState !== 'owner_confirmed'
      ) {
        throw new Error('Transaction submitted but owner confirmation is still pending. Retry shortly.')
      }

      setAlreadyOwner(true)
      setPageNotice(
        `Owner install submitted via EntryPoint handleOps (tx ${result.transactionHash.slice(0, 10)}…). addOwner ran inside a UserOp where the CSW self-called.`,
      )
      await onSuccess?.()
      return true
    } catch (error) {
      appendEvent(`error:${getErrorMessage(error).slice(0, 220)}`)
      setPageError(getErrorMessage(error))
      return false
    } finally {
      setBusy(false)
    }
  }, [
    alreadyOwner,
    appendEvent,
    authHeaders,
    canonicalCswAddress,
    loadPrepare,
    onSuccess,
    preparedTx,
    privyEmbeddedEoaAddress,
    publicClient,
    resolveWalletRequest,
  ])

  return {
    prepareLoading,
    busy,
    alreadyOwner,
    pageError,
    pageNotice,
    txHash,
    callBundleId,
    eventLog,
    inBaseApp,
    preparedTx,
    loadPrepare,
    handleSubmitUserOp,
  }
}
