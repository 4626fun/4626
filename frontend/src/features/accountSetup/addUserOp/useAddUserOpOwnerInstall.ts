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
import {
  assessCswUserOpFunding,
  mapAddOwnerFundingErrorMessage,
  readCswUserOpFundingSnapshot,
  type CswFundingAssessment,
} from '@/lib/wallet/cswEntryPointFunding'
import { ENTRY_POINT_V06_BASE } from '@/lib/wallet/cswOwnerAbi'
import { readIsOwnerAddressIfDeployed } from '@/lib/wallet/cswOwnerRead'
import { withWalletRequestTimeout } from '@/lib/wallet/cswSendCalls'
import { getProductionBaseReadClient } from '@/lib/base/productionBaseReadClient'
import { detectInAppEnvironment, isBaseAppInAppContext } from '@/lib/wallet/inAppBrowser'
import {
  confirmOwnerInstall,
  fetchPrepareAddPrivyOwner,
  type PreparedOwnerTxRequest,
} from '@/lib/wallet/zoraAddOwnerApi'

type WalletRequest = (args: { method: string; params?: unknown[] }) => Promise<unknown>

const BASE_MAINNET_CHAIN_ID_HEX = '0x2105'

function getErrorMessage(error: unknown): string {
  const funding = mapAddOwnerFundingErrorMessage(error)
  if (funding) return funding
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

async function assertWalletAccountsMatchCsw(
  walletRequest: WalletRequest,
  cswAddress: string,
): Promise<void> {
  const accountsRaw = await walletRequest({ method: 'eth_requestAccounts' })
  const accounts = Array.isArray(accountsRaw) ? accountsRaw : []
  const expected = getAddress(cswAddress).toLowerCase()
  const matched = accounts.some((account) => {
    if (typeof account !== 'string' || !/^0x[a-fA-F0-9]{40}$/.test(account)) return false
    try {
      return getAddress(account).toLowerCase() === expected
    } catch {
      return false
    }
  })
  if (!matched) {
    throw new Error(
      'Base App is not connected as your canonical smart wallet. Tap Connect Base Account wallet (email Privy sign-in alone is not enough), then retry.',
    )
  }
}

export type AddUserOpOwnerInstallPublicClient = Pick<
  PublicClient,
  'getTransaction' | 'waitForTransactionReceipt' | 'readContract' | 'getBytecode' | 'request'
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
  const [submitPhase, setSubmitPhase] = useState<
    'idle' | 'preflight' | 'awaiting_signature' | 'broadcasting' | 'confirming' | 'verifying'
  >('idle')
  const [preparedTx, setPreparedTx] = useState<PreparedOwnerTxRequest | null>(null)
  const [fundingAssessment, setFundingAssessment] = useState<CswFundingAssessment | null>(null)
  const [fundingLoading, setFundingLoading] = useState(false)

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

  const refreshFunding = useCallback(async () => {
    if (!canonicalCswAddress) {
      setFundingAssessment(null)
      return null
    }
    const readClient =
      typeof window !== 'undefined' ? getProductionBaseReadClient() : publicClient
    if (!readClient) {
      setFundingAssessment(null)
      return null
    }
    setFundingLoading(true)
    try {
      const snapshot = await withWalletRequestTimeout('CSW gas balance read', 12_000, () =>
        readCswUserOpFundingSnapshot({
          publicClient: readClient,
          cswAddress: canonicalCswAddress,
        }),
      )
      const assessment = assessCswUserOpFunding(snapshot)
      setFundingAssessment(assessment)
      return assessment
    } catch {
      return null
    } finally {
      setFundingLoading(false)
    }
  }, [canonicalCswAddress, publicClient])

  useEffect(() => {
    if (!enabled || !canonicalCswAddress) {
      setFundingAssessment(null)
      return
    }
    void refreshFunding()
  }, [canonicalCswAddress, enabled, refreshFunding])

  const handleSubmitUserOp = useCallback(async (): Promise<boolean> => {
    if (!canonicalCswAddress || !privyEmbeddedEoaAddress) {
      setPageError('Canonical wallet or embedded signer is unavailable. Sign in and retry.')
      return false
    }

    setBusy(true)
    setSubmitPhase('preflight')
    setPageError(null)
    setPageNotice(null)
    appendEvent('--- submit ---')
    appendEvent(`lane:entrypoint_userop (validated Base App self-call path) via wallet_sendCalls → ${ENTRY_POINT_V06_BASE}`)

    try {
      let txRequest = preparedTx
      if (!txRequest || alreadyOwner) {
        setSubmitPhase('preflight')
        appendEvent('preflight:prepare')
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

      setSubmitPhase('preflight')
      appendEvent('preflight:funding')
      let funding: CswFundingAssessment | null = fundingAssessment?.ok === true ? fundingAssessment : null
      if (funding) {
        appendEvent(
          `preflight:funding_cached_ok total=${funding.snapshot.totalAvailableWei.toString()} wei`,
        )
      } else {
        appendEvent('preflight:funding_refresh')
        funding = (await refreshFunding().catch(() => null)) ?? fundingAssessment
      }
      if (funding && !funding.ok) {
        appendEvent(`preflight:funding_${funding.reason}`)
        // This will be turned into the clear "send ETH to your CSW" message by mapAddOwnerFundingErrorMessage
        throw new Error('Base App could not build the UserOp — insufficient gas prefund on canonical CSW')
      }
      if (funding?.ok) {
        appendEvent(`preflight:funding_ok total=${funding.snapshot.totalAvailableWei.toString()} wei`)
      } else if (fundingAssessment?.ok) {
        funding = fundingAssessment
        appendEvent(
          `preflight:funding_fallback_cached total=${fundingAssessment.snapshot.totalAvailableWei.toString()} wei`,
        )
      } else {
        throw new Error(
          'Could not verify CSW gas balance in time. Your displayed balance may still be valid — retry in a few seconds.',
        )
      }

      appendEvent('preflight:wallet_provider_lookup')
      const walletRequest = await withWalletRequestTimeout('Base App wallet provider', 15_000, () =>
        resolveWalletRequest(),
      )
      appendEvent('preflight:wallet_provider=ready')
      await withWalletRequestTimeout('Base network check', 15_000, () =>
        ensureBaseMainnetWalletContext(walletRequest),
      )
      appendEvent('preflight:chain=base_mainnet')
      await withWalletRequestTimeout('Base App wallet authorization', 60_000, () =>
        assertWalletAccountsMatchCsw(walletRequest, canonicalCswAddress),
      )
      appendEvent('preflight:wallet_accounts=canonical_csw')

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
      appendEvent('submit:wallet_sendCalls_start')

      const result = await addOwnerViaBaseAppSendCalls({
        walletRequest,
        csw,
        ownerToAdd,
        chainId: base.id,
        timeoutMs: 120_000,
        publicClient: publicClient as Pick<AddUserOpOwnerInstallPublicClient, 'request'> | undefined,
        onTelemetry: (event) => {
          appendEvent(`sendCalls:${event.step}`)
          if (event.step === 'preflight') setSubmitPhase('preflight')
          else if (event.step === 'prompt_sign') setSubmitPhase('awaiting_signature')
          else if (event.step === 'broadcast_success') setSubmitPhase('broadcasting')
          else if (event.step === 'status_poll') setSubmitPhase('confirming')
          else if (event.step === 'status_resolved') setSubmitPhase('verifying')
          else if (event.step === 'broadcast_error') setSubmitPhase('idle')
        },
      })

      let landedTxHash = result.transactionHash
      if (!landedTxHash && result.userOperationHash && publicClient) {
        appendEvent(`poll:user_op_hash=${result.userOperationHash}`)
        const deadline = Date.now() + 90_000
        while (!landedTxHash && Date.now() < deadline) {
          const receipt = (await publicClient.request({
            method: 'eth_getUserOperationReceipt',
            params: [result.userOperationHash],
          }).catch(() => null)) as { receipt?: { transactionHash?: string } } | null
          const candidate = receipt?.receipt?.transactionHash
          if (typeof candidate === 'string' && /^0x[0-9a-fA-F]{64}$/.test(candidate)) {
            landedTxHash = candidate as `0x${string}`
            break
          }
          await new Promise((resolve) => setTimeout(resolve, 2_000))
        }
      }

      if (!landedTxHash) {
        throw new Error(
          result.userOperationHash
            ? `UserOp submitted (${result.userOperationHash.slice(0, 10)}…) but bundle tx hash is still pending. Wait 30s and tap Rebuild preview — or check Base App activity.`
            : 'wallet_sendCalls completed without a transaction hash. Wait for Base App to finish, then retry.',
        )
      }

      setTxHash(landedTxHash)
      appendEvent(`tx_hash=${landedTxHash}`)
      setCallBundleId(result.callBundleId)

      if (publicClient) {
        await publicClient
          .waitForTransactionReceipt({ hash: landedTxHash, timeout: 90_000 })
          .catch(() => undefined)
        await verifyEntryPointHandleOpsTransaction({
          publicClient,
          txHash: landedTxHash,
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
        txHash: landedTxHash,
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
        `Owner install succeeded via EntryPoint handleOps (tx ${landedTxHash.slice(0, 10)}…). The CSW executed addOwnerAddress on itself inside the UserOp (msg.sender == address(this)).`,
      )
      await onSuccess?.()
      return true
    } catch (error) {
      appendEvent(`error:${getErrorMessage(error).slice(0, 220)}`)
      setPageError(getErrorMessage(error))
      return false
    } finally {
      setBusy(false)
      setSubmitPhase('idle')
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
    refreshFunding,
    fundingAssessment,
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
    submitPhase,
    inBaseApp,
    preparedTx,
    fundingAssessment,
    fundingLoading,
    refreshFunding,
    loadPrepare,
    handleSubmitUserOp,
  }
}
