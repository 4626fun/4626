import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { createWalletClient, custom, getAddress, isAddress } from 'viem'
import { base } from 'viem/chains'

import { useAddUserOpOwnerInstall } from '@/features/accountSetup/addUserOp/useAddUserOpOwnerInstall'
import { sendCoinbaseSmartWalletUserOperation } from '@/lib/aa/coinbaseErc4337'
import { trackEvent } from '@/lib/analytics/analytics'
import { getProductionBaseReadClient } from '@/lib/base/productionBaseReadClient'
import { usePrivyWalletsFromContext } from '@/lib/privy/walletHooksContext'
import {
  completeActivation,
  fetchActivationStatus,
  provisionAutomationOwner,
  type ActivationStatusResponse,
} from './activationApi'
import {
  INITIAL_ACTIVATION_STATE,
  activationReducer,
  type ActivationFailureStage,
} from './activationStateMachine'
import {
  executeOneSignatureActivation,
  type ActivationExecutionStage,
} from './executeActivation'
import { buildSilentServerOwnerUserOp } from './silentServerOwnerUserOp'

type Params = {
  canonicalCswAddress: string | null | undefined
  embeddedEoaAddress: string | null | undefined
  authHeaders: () => Promise<Record<string, string>>
  baseWalletMatchesParent: boolean
  onReady?: () => void | Promise<void>
  onPendingHashChange?: (hash: string | null) => void
  onPhaseChange?: (phase: string | null) => void
}

function errorMessage(error: unknown): string {
  return error instanceof Error && error.message.trim()
    ? error.message
    : String(error ?? 'Activation failed')
}

function newRunId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `activation-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function useEnable4626Activation(params: Params) {
  const [state, dispatch] = useReducer(activationReducer, INITIAL_ACTIVATION_STATE)
  const [status, setStatus] = useState<ActivationStatusResponse | null>(null)
  const [statusLoading, setStatusLoading] = useState(false)
  const [activationBusy, setActivationBusy] = useState(false)
  const activationBusyRef = useRef(false)
  const authHeadersRef = useRef(params.authHeaders)
  const wallets = usePrivyWalletsFromContext()

  useEffect(() => {
    authHeadersRef.current = params.authHeaders
  }, [params.authHeaders])

  const visibleInstall = useAddUserOpOwnerInstall({
    canonicalCswAddress: params.canonicalCswAddress,
    privyEmbeddedEoaAddress: params.embeddedEoaAddress,
    authHeaders: params.authHeaders,
    publicClient: undefined,
    enabled: Boolean(params.canonicalCswAddress),
    onPendingHashChange: params.onPendingHashChange,
    onPhaseChange: params.onPhaseChange,
  })

  const emitStage = useCallback(
    (
      stage: string,
      outcome: 'started' | 'succeeded' | 'failed',
      runId: string | null,
      startedAtMs?: number,
    ) => {
      trackEvent('enable_4626_activation_stage', {
        stage,
        outcome,
        runId,
        ...(typeof startedAtMs === 'number'
          ? { durationMs: Math.max(0, Date.now() - startedAtMs) }
          : {}),
      })
    },
    [],
  )

  const refreshStatus = useCallback(async (): Promise<ActivationStatusResponse | null> => {
    if (!params.canonicalCswAddress || !params.embeddedEoaAddress) {
      dispatch({
        type: 'STATUS_RESOLVED',
        snapshot: {
          privySessionReady: Boolean(params.embeddedEoaAddress),
          hasParentCsw: Boolean(params.canonicalCswAddress),
          baseWalletMatchesParent: params.baseWalletMatchesParent,
          embeddedOwnerConfirmed: false,
          serverWalletExpected: false,
          serverOwnerConfirmed: false,
          xmtpProvisioned: false,
        },
      })
      return null
    }
    setStatusLoading(true)
    try {
      const headers = await authHeadersRef.current()
      const next = await fetchActivationStatus({ headers })
      setStatus(next)
      dispatch({
        type: 'STATUS_RESOLVED',
        snapshot: {
          privySessionReady: true,
          hasParentCsw: true,
          baseWalletMatchesParent: params.baseWalletMatchesParent,
          embeddedOwnerConfirmed: next.embeddedOwnerConfirmed,
          serverWalletExpected: Boolean(next.serverWalletAddress),
          serverOwnerConfirmed: next.serverOwnerConfirmed,
          xmtpProvisioned: next.xmtpProvisioned,
        },
      })
      return next
    } catch (error) {
      dispatch({ type: 'FAIL', stage: 'status', message: errorMessage(error) })
      return null
    } finally {
      setStatusLoading(false)
    }
  }, [
    params.baseWalletMatchesParent,
    params.canonicalCswAddress,
    params.embeddedEoaAddress,
  ])

  useEffect(() => {
    void refreshStatus()
  }, [refreshStatus])

  const embeddedWallet = useMemo(() => {
    const expected =
      params.embeddedEoaAddress && isAddress(params.embeddedEoaAddress)
        ? getAddress(params.embeddedEoaAddress).toLowerCase()
        : null
    if (!expected) return null
    return wallets.find((wallet) => {
      const address = typeof wallet.address === 'string' ? wallet.address.trim() : ''
      return isAddress(address) && getAddress(address).toLowerCase() === expected
    }) ?? null
  }, [params.embeddedEoaAddress, wallets])

  const fail = useCallback(
    (stage: ActivationFailureStage, error: unknown, runId: string, startedAtMs?: number) => {
      const message = errorMessage(error)
      emitStage(stage, 'failed', runId, startedAtMs)
      dispatch({ type: 'FAIL', stage, message })
    },
    [emitStage],
  )

  const enable = useCallback(async (): Promise<boolean> => {
    if (activationBusyRef.current) return false
    if (
      !params.canonicalCswAddress ||
      !isAddress(params.canonicalCswAddress) ||
      !params.embeddedEoaAddress ||
      !isAddress(params.embeddedEoaAddress)
    ) {
      dispatch({
        type: 'FAIL',
        stage: 'prepare',
        message: 'Link your parent Coinbase Smart Wallet before enabling 4626.',
      })
      return false
    }
    if (!params.baseWalletMatchesParent && !status?.embeddedOwnerConfirmed && !state.embeddedOwnerConfirmed) {
      dispatch({
        type: 'STATUS_RESOLVED',
        snapshot: {
          privySessionReady: true,
          hasParentCsw: true,
          baseWalletMatchesParent: false,
          embeddedOwnerConfirmed: state.embeddedOwnerConfirmed,
          serverWalletExpected: Boolean(status?.serverWalletAddress),
          serverOwnerConfirmed: status?.serverOwnerConfirmed === true,
          xmtpProvisioned: status?.xmtpProvisioned === true,
        },
      })
      return false
    }

    activationBusyRef.current = true
    setActivationBusy(true)
    const runId = newRunId()
    const runStartedAtMs = Date.now()
    dispatch({ type: 'START', runId })
    emitStage('preparing', 'started', runId)
    let activeFailureStage: ActivationFailureStage = 'prepare'
    try {
      const csw = getAddress(params.canonicalCswAddress)
      const embedded = getAddress(params.embeddedEoaAddress)
      const onExecutionStage = (stage: ActivationExecutionStage) => {
        switch (stage) {
          case 'visible_signature':
            activeFailureStage = 'visible_signature'
            dispatch({ type: 'VISIBLE_SIGNATURE_REQUIRED' })
            emitStage('awaiting_visible_signature', 'started', runId)
            return
          case 'embedded_owner_confirmed':
            activeFailureStage = 'silent_server_owner_install'
            dispatch({ type: 'EMBEDDED_OWNER_CONFIRMED' })
            emitStage('confirming_embedded_owner', 'succeeded', runId, runStartedAtMs)
            return
          case 'silent_server_owner_install':
            activeFailureStage = 'silent_server_owner_install'
            dispatch({ type: 'SILENT_SERVER_INSTALL_STARTED' })
            emitStage('installing_server_owner_silently', 'started', runId)
            return
          case 'server_owner_confirmed':
            activeFailureStage = 'xmtp_provisioning'
            dispatch({ type: 'SERVER_OWNER_CONFIRMED' })
            return
          case 'xmtp_provisioning':
            activeFailureStage = 'xmtp_provisioning'
            dispatch({ type: 'XMTP_PROVISIONING_STARTED' })
            emitStage('provisioning_xmtp', 'started', runId)
            return
          case 'ready':
            dispatch({ type: 'XMTP_PROVISIONED' })
            emitStage('provisioning_xmtp', 'succeeded', runId, runStartedAtMs)
            emitStage('ready', 'succeeded', runId, runStartedAtMs)
            return
          default: {
            const exhaustive: never = stage
            return exhaustive
          }
        }
      }

      await executeOneSignatureActivation({
        readStatus: async () => {
          const current = await refreshStatus()
          if (!current) throw new Error('activation_status_unavailable')
          return current
        },
        submitVisibleEmbeddedOwnerInstall: async () => {
          const submitted = await visibleInstall.handleSubmitUserOp()
          if (submitted) {
            dispatch({ type: 'VISIBLE_SIGNATURE_SUBMITTED' })
            emitStage('awaiting_visible_signature', 'succeeded', runId, runStartedAtMs)
            activeFailureStage = 'embedded_owner_confirmation'
          }
          return submitted
        },
        provisionServerOwner: async () => {
          return provisionAutomationOwner({ headers: await authHeadersRef.current() })
        },
        submitSilentServerOwnerInstall: async (provisioned) => {
          if (!provisioned.txRequest) throw new Error('Missing automation owner self-call.')
          const userOp = buildSilentServerOwnerUserOp({
            parentCsw: csw,
            embeddedEoa: embedded,
            expectedServerWallet: provisioned.agentWalletAddress,
            txRequest: provisioned.txRequest,
          })
          const walletAny = embeddedWallet as {
            getEthereumProvider?: () => Promise<unknown>
            provider?: unknown
          } | null
          const provider =
            walletAny?.provider ??
            (typeof walletAny?.getEthereumProvider === 'function'
              ? await walletAny.getEthereumProvider()
              : null)
          if (!provider || typeof (provider as { request?: unknown }).request !== 'function') {
            throw new Error('Privy embedded signer is unavailable for silent automation setup.')
          }
          const walletClient = createWalletClient({
            account: embedded,
            chain: base,
            transport: custom(provider as { request: (args: unknown) => Promise<unknown> }),
          })
          await sendCoinbaseSmartWalletUserOperation({
            publicClient: getProductionBaseReadClient() as never,
            walletClient: walletClient as never,
            bundlerUrl: '/api/paymaster',
            smartWallet: userOp.smartWallet,
            ownerAddress: userOp.ownerAddress,
            calls: userOp.calls,
            ownerApprovalContext: {
              approvalRunId: runId,
              stage: 'enable_4626_server_owner',
              executionMode: 'canonical4337',
              attempt: 1,
              activationOwnerPolicyToken: provisioned.activationToken,
            },
            waitForOnChainReceipt: true,
            retryOnInvalidSignature: true,
            retryOnPrefund: false,
          })
          dispatch({ type: 'SILENT_SERVER_INSTALL_SUBMITTED' })
          emitStage('installing_server_owner_silently', 'succeeded', runId, runStartedAtMs)
          activeFailureStage = 'server_owner_confirmation'
        },
        completeXmtpProvisioning: async (activationToken) => {
          await completeActivation({
            headers: await authHeadersRef.current(),
            activationToken,
          })
        },
        onStage: onExecutionStage,
      })
      await params.onReady?.()
      return true
    } catch (error) {
      fail(activeFailureStage, error, runId, runStartedAtMs)
      return false
    } finally {
      activationBusyRef.current = false
      setActivationBusy(false)
    }
  }, [
    embeddedWallet,
    emitStage,
    fail,
    params,
    refreshStatus,
    state.embeddedOwnerConfirmed,
    status,
    visibleInstall,
  ])

  return {
    state,
    status,
    statusLoading,
    busy: activationBusy || visibleInstall.busy || visibleInstall.prepareLoading,
    visibleInstall,
    enable,
    refreshStatus,
  }
}
