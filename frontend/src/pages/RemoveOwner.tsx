import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { usePublicClient, useWalletClient } from 'wagmi'
import { base } from 'viem/chains'
import { type Hex, type PublicClient } from 'viem'

import { PageMeta } from '@/components/seo/PageMeta'
import { RemoveOwnerActionPanel } from '@/features/accountSetup/removeOwner/RemoveOwnerActionPanel'
import { useAccountSetupController } from '@/features/accountSetup/useAccountSetupController'
import { RemoveOwnerOwnerSlotsCard } from '@/features/accountSetup/removeOwner/RemoveOwnerOwnerSlotsCard'
import { detectInAppEnvironment, externalBrowserUrlFor } from '@/lib/wallet/inAppBrowser'
import { apiFetch } from '@/lib/api/apiBase'
import { _submitOwnerViaSelfBuiltUserOp } from '@/lib/wallet/onboardingWallet'
import { _submitOwnerViaFunderEoa } from '@/lib/wallet/relayFunderEoaSubmit'
import { _submitOwnerViaSendCalls, waitForCallsTxHash } from '@/lib/wallet/cswSendCalls'
import { removeOwnerViaBaseAppSendCalls } from '@/lib/wallet/baseAppOwnerCalls'
import {
  buildWebAuthnSignatureWrapper,
  generateKeysCoinbasePasteSnippet,
  parseKeysCoinbasePasteResponse,
  verifyChallengeMatchesHash,
} from '@/lib/wallet/keysCoinbasePasteFlow'
import {
  buildRelayExecuteRequestBody,
  ENTRY_POINT_V06_ADDRESS,
  finalizeReplayableOwnerUserOp,
  prepareReplayableOwnerUserOpForExternalSignature,
  type V06UserOpFields,
} from '@/lib/wallet/onboardingWalletReplayable'
import * as RemoveOwnerHelpers from '@/lib/removeOwner/removeOwnerHelpers'

// Relay Protocol's depository on Base. Reference tx where this CSW deposited:
// https://basescan.org/tx/0x34edd28dd9611f4e06374dfe87645de4fc3fd94c83f96b5b1406c6ee10d2aadf
// (UserOp executeBatch -> RelayDepository.depositNative(depositor, id))
const RELAY_DEPOSITORY_BASE = RemoveOwnerHelpers.RELAY_DEPOSITORY_BASE
type RelayTwoLegDiagnostics = RemoveOwnerHelpers.RelayTwoLegDiagnostics
type AADepositDiagnostics = RemoveOwnerHelpers.AADepositDiagnostics
type RemoveOwnerPreview = RemoveOwnerHelpers.RemoveOwnerPreview
type OnchainOwnerRow = RemoveOwnerHelpers.OnchainOwnerRow
type LiveDiagnostics = RemoveOwnerHelpers.LiveDiagnostics

const normalizeRelayStatusEndpoint = RemoveOwnerHelpers.normalizeRelayStatusEndpoint
const extractRelayStatusText = RemoveOwnerHelpers.extractRelayStatusText
const deriveRelayQuoteSeedAmountWei = RemoveOwnerHelpers.deriveRelayQuoteSeedAmountWei
const extractExecuteQuotePayload = RemoveOwnerHelpers.extractExecuteQuotePayload
const validateRelayQuoteIsNativeOnly = RemoveOwnerHelpers.validateRelayQuoteIsNativeOnly
const findForbiddenRelayCurrency = RemoveOwnerHelpers.findForbiddenRelayCurrency
const validatePreviewRelayUserCallIsNativeDepository =
  RemoveOwnerHelpers.validatePreviewRelayUserCallIsNativeDepository
const pollRelayStatusEndpoint = RemoveOwnerHelpers.pollRelayStatusEndpoint
const verifyAARelayDepositShape = RemoveOwnerHelpers.verifyAARelayDepositShape
const INITIAL_DIAGNOSTICS = RemoveOwnerHelpers.INITIAL_DIAGNOSTICS
const CSW_OWNER_ABI = RemoveOwnerHelpers.CSW_OWNER_ABI
const classifyOwnerBytes = RemoveOwnerHelpers.classifyOwnerBytes
const decodeOwnerAddress = RemoveOwnerHelpers.decodeOwnerAddress

export function RemoveOwnerPage() {
  const controller = useAccountSetupController({ zoraReturnPath: '/remove-owner' })
  const {
    canonicalCswAddress,
    loading,
    privyAuthed,
    login,
    ownerSignerAddress,
  } = controller
  const { data: walletClient } = useWalletClient()

  const inAppEnv = useMemo(() => detectInAppEnvironment(), [])
  const externalUrl = useMemo(() => externalBrowserUrlFor('/remove-owner'), [])

  const [diagnostics, setDiagnostics] = useState<LiveDiagnostics>(INITIAL_DIAGNOSTICS)
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [preview, setPreview] = useState<RemoveOwnerPreview | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const previewRequestIdRef = useRef(0)
  const [busy, setBusy] = useState(false)
  const [pageError, setPageError] = useState<string | null>(null)
  const [pageNotice, setPageNotice] = useState<string | null>(null)
  const [txHash, setTxHash] = useState<string | null>(null)
  const [depositTxHash, setDepositTxHash] = useState<string | null>(null)
  const [aaDepositDiagnostics, setAaDepositDiagnostics] = useState<AADepositDiagnostics | null>(null)
  const [relayTwoLegDiagnostics, setRelayTwoLegDiagnostics] = useState<RelayTwoLegDiagnostics | null>(null)
  const [eventLog, setEventLog] = useState<string[]>([])
  const [lastErrorDetail, setLastErrorDetail] = useState<{
    revertReason: string | null
    revertData: string | null
    relayTx: unknown
    rawBody: string | null
  } | null>(null)
  const [pasteFlow, setPasteFlow] = useState<{
    userOp: V06UserOpFields
    hashToSign: Hex
    snippet: string
    signerOwnerIndex: number
  } | null>(null)
  const [pasteResponse, setPasteResponse] = useState('')
  const [signingOwnerIndex, setSigningOwnerIndex] = useState(0)
  const [requirePasskey, setRequirePasskey] = useState(true)
  const [signerMismatch, setSignerMismatch] = useState<{
    recoveredRaw: string | null
    recoveredEip191: string | null
    claimedOwnerIndex: number | null
  } | null>(null)

  const wagmiPublicClient = usePublicClient({ chainId: base.id })
  const publicClient = wagmiPublicClient as PublicClient | undefined

  useEffect(() => {
    let cancelled = false
    if (!canonicalCswAddress || !publicClient) {
      setDiagnostics(INITIAL_DIAGNOSTICS)
      return () => {
        cancelled = true
      }
    }
    setDiagnostics({ ...INITIAL_DIAGNOSTICS, status: 'loading' })
    void (async () => {
      try {
        const cswAddress = canonicalCswAddress as `0x${string}`
        const [ownerCountRaw, nextOwnerIndexRaw, cswBalance, depositoryBalance] = await Promise.all([
          publicClient.readContract({
            address: cswAddress,
            abi: CSW_OWNER_ABI,
            functionName: 'ownerCount',
          }),
          publicClient.readContract({
            address: cswAddress,
            abi: CSW_OWNER_ABI,
            functionName: 'nextOwnerIndex',
          }),
          publicClient.getBalance({ address: cswAddress }),
          publicClient.getBalance({ address: RELAY_DEPOSITORY_BASE }),
        ])
        const nextOwnerIndex = Number(nextOwnerIndexRaw)
        const SCAN_HARD_CEILING = 256
        const rawScanLimit = Math.max(nextOwnerIndex, Number(ownerCountRaw))
        const scanLimit = Math.min(rawScanLimit, SCAN_HARD_CEILING)
        const slotResults = await Promise.allSettled(
          Array.from({ length: scanLimit }, (_, idx) =>
            publicClient.readContract({
              address: cswAddress,
              abi: CSW_OWNER_ABI,
              functionName: 'ownerAtIndex',
              args: [BigInt(idx)],
            }),
          ),
        )
        const owners: OnchainOwnerRow[] = slotResults.map((result, idx) => {
          if (result.status === 'rejected') {
            const message =
              result.reason instanceof Error
                ? result.reason.message
                : String(result.reason ?? 'read failed')
            return {
              index: idx,
              ownerBytes: '0x',
              ownerAddress: null,
              type: 'unreadable',
              readError: message,
            }
          }
          const ownerBytes = result.value as `0x${string}`
          return {
            index: idx,
            ownerBytes,
            ownerAddress: decodeOwnerAddress(ownerBytes),
            type: classifyOwnerBytes(ownerBytes),
            readError: null,
          }
        })
        if (cancelled) return
        setDiagnostics({
          status: 'ready',
          ownerCount: Number(ownerCountRaw),
          nextOwnerIndex,
          owners,
          cswEthBalance: cswBalance,
          relayDepositoryEthBalance: depositoryBalance,
          error: null,
        })
      } catch (err: any) {
        if (cancelled) return
        setDiagnostics({
          ...INITIAL_DIAGNOSTICS,
          status: 'error',
          error: typeof err?.message === 'string' ? err.message : 'Failed to load on-chain diagnostics.',
        })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [canonicalCswAddress, publicClient])

  useEffect(() => {
    if (diagnostics.owners.length === 0) return
    const passkeyOwner = diagnostics.owners.find((owner) => owner.type === 'passkey')
    if (passkeyOwner) {
      setSigningOwnerIndex((current) => {
        if (current === passkeyOwner.index) return current
        const currentRow = diagnostics.owners.find((owner) => owner.index === current)
        if (currentRow?.type === 'passkey') return current
        return passkeyOwner.index
      })
    }
  }, [diagnostics.owners])

  const isSelfAuthSession = useMemo(() => {
    if (!canonicalCswAddress || !ownerSignerAddress) return false
    return ownerSignerAddress.toLowerCase() === canonicalCswAddress.toLowerCase()
  }, [canonicalCswAddress, ownerSignerAddress])
  const strictTraceEnabled = useMemo(() => {
    if (typeof window === 'undefined') return false
    return new URLSearchParams(window.location.search).get('strictTrace') === '1'
  }, [])

  const pasteValidation = useMemo(() => {
    if (!pasteFlow || !pasteResponse.trim()) return null
    try {
      const parsed = parseKeysCoinbasePasteResponse(pasteResponse)
      const challengeError = verifyChallengeMatchesHash(parsed, pasteFlow.hashToSign)
      if (challengeError) return { ok: false as const, message: challengeError }
      return { ok: true as const, message: 'Payload valid for current UserOp hash.' }
    } catch (error) {
      return {
        ok: false as const,
        message: error instanceof Error ? error.message : 'Could not parse pasted payload.',
      }
    }
  }, [pasteFlow, pasteResponse])

  const signerOwnerIndexValidation = useMemo(() => {
    if (diagnostics.owners.length === 0 && diagnostics.status !== 'ready') {
      return {
        ok: true as const,
        message: `Owner slot scan is not ready yet; using signer owner index ${signingOwnerIndex}.`,
      }
    }
    const row = diagnostics.owners.find((owner) => owner.index === signingOwnerIndex)
    if (!row) {
      return {
        ok: false as const,
        message: `Signer owner index ${signingOwnerIndex} is not present in scanned owner slots.`,
      }
    }
    if (row.type === 'empty') {
      return {
        ok: false as const,
        message: `Signer owner index ${signingOwnerIndex} is empty.`,
      }
    }
    if (row.type === 'EOA') {
      return {
        ok: false as const,
        message: `Signer owner index ${signingOwnerIndex} is an EOA owner. The keys.coinbase.com lane requires a passkey owner slot.`,
      }
    }
    if (row.type === 'unreadable') {
      return {
        ok: true as const,
        message: `Signer owner index ${signingOwnerIndex} could not be read from RPC, but will be attempted.`,
      }
    }
    if (row.type === 'passkey') {
      return {
        ok: true as const,
        message: `Using passkey owner slot [${signingOwnerIndex}] for signature wrapper.`,
      }
    }
    return {
      ok: true as const,
      message: `Using owner slot [${signingOwnerIndex}] for signature wrapper.`,
    }
  }, [diagnostics.owners, diagnostics.status, signingOwnerIndex])

  const patternLockStatus = useMemo(() => {
    const checks = aaDepositDiagnostics?.checks
    const traceSatisfied =
      checks?.traceEntryPointToCsw == null && checks?.traceCswToDepository == null
        ? true
        : Boolean(checks?.traceEntryPointToCsw && checks?.traceCswToDepository)
    const locked = Boolean(
      checks?.hasEntryPointUserOpForCsw &&
        checks?.hasRelayDepositForCsw &&
        checks?.requestIdMatches &&
        traceSatisfied,
    )
    if (locked) {
      return {
        state: 'locked' as const,
        label: 'Pattern lock: locked',
        detail: 'EntryPoint UserOp + Relay deposit + requestId match verified.',
      }
    }
    if (aaDepositDiagnostics) {
      return {
        state: 'unlocked' as const,
        label: 'Pattern lock: unlocked',
        detail: 'Deposit transaction does not satisfy the required AA pattern.',
      }
    }
    return {
      state: 'pending' as const,
      label: 'Pattern lock: awaiting verification',
      detail: 'Submit/fund once to verify the EntryPoint + Relay deposit shape.',
    }
  }, [aaDepositDiagnostics])

  const appendEvent = (row: string) => {
    setEventLog((prev) => [...prev, row].slice(-40))
  }

  const resolveActiveWalletAccount = async (
    request: (args: { method: string; params?: unknown[] }) => Promise<unknown>,
  ): Promise<`0x${string}`> => {
    const accounts = (await request({ method: 'eth_accounts' })) as unknown
    const first =
      Array.isArray(accounts) && typeof accounts[0] === 'string' && /^0x[0-9a-fA-F]{40}$/.test(accounts[0])
        ? (accounts[0].toLowerCase() as `0x${string}`)
        : null
    if (!first) {
      throw new Error('No active wallet account found. Reconnect your external EOA and try again.')
    }
    return first
  }

  const fetchPreview = async (index: number) => {
    if (!canonicalCswAddress || !ownerSignerAddress) {
      setPageError('Connect a wallet that owns this CSW (or the CSW itself) first.')
      return
    }
    const requestId = ++previewRequestIdRef.current
    setPreviewLoading(true)
    setPageError(null)
    setLastErrorDetail(null)
    setSignerMismatch(null)
    setPageNotice(null)
    setPreview(null)
    setPasteFlow(null)
    setPasteResponse('')
    setTxHash(null)
    setDepositTxHash(null)
    setAaDepositDiagnostics(null)
    try {
      const res = await apiFetch('/api/onboarding/preview-remove-owner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cswAddress: canonicalCswAddress,
          connectedAddress: ownerSignerAddress,
          ownerIndex: index,
        }),
      })
      const json = (await res.json().catch(() => null)) as {
        success?: boolean
        error?: string
        data?: RemoveOwnerPreview
      } | null
      if (requestId !== previewRequestIdRef.current) return
      if (!res.ok || !json?.success || !json.data) {
        throw new Error(json?.error ?? `preview-remove-owner failed (${res.status})`)
      }
      setPreview(json.data)
    } catch (err: any) {
      if (requestId !== previewRequestIdRef.current) return
      setPageError(typeof err?.message === 'string' ? err.message : 'Failed to build remove-owner preview.')
    } finally {
      if (requestId === previewRequestIdRef.current) {
        setPreviewLoading(false)
      }
    }
  }

  const handleSelectIndex = (index: number) => {
    setSelectedIndex(index)
    void fetchPreview(index)
  }

  const handlePrepareKeysCoinbasePaste = async () => {
    if (!preview || !canonicalCswAddress) {
      setPageError('Select an owner index first.')
      return
    }
    if (!signerOwnerIndexValidation.ok) {
      setPageError(signerOwnerIndexValidation.message)
      return
    }
    setBusy(true)
    setPageError(null)
    setPageNotice(null)
    setLastErrorDetail(null)
    try {
      const prepared = await prepareReplayableOwnerUserOpForExternalSignature({
        csw: canonicalCswAddress as `0x${string}`,
        innerCallData: preview.txRequest.data as Hex,
        onTelemetry: (event) => {
          try {
            const detail =
              typeof event.detail === 'string' ? event.detail : JSON.stringify(event.detail)
            appendEvent(`paste_prepare.${event.step}: ${detail.slice(0, 320)}`)
          } catch {
            appendEvent(`paste_prepare.${event.step}: <unloggable>`)
          }
        },
      })
      const snippet = generateKeysCoinbasePasteSnippet(prepared.hashToSign)
      setPasteFlow({
        userOp: prepared.userOp,
        hashToSign: prepared.hashToSign,
        snippet,
        signerOwnerIndex: signingOwnerIndex,
      })
      setPasteResponse('')
      appendEvent(`paste_prepare:hash=${prepared.hashToSign}`)
      setPageNotice(
        `Copy the snippet, run it at keys.coinbase.com, authenticate with passkey owner slot [${signingOwnerIndex}], then paste the returned JSON below.`,
      )
      setDepositTxHash(null)
    } catch (err: any) {
      setPageError(err?.message ?? 'Failed to prepare keys.coinbase.com signing flow.')
    } finally {
      setBusy(false)
    }
  }

  const handleFundRelayDepositForPasteLane = async () => {
    if (!preview?.relay?.userCall) {
      setPageError(
        `Relay funding step is unavailable: ${preview?.preflight.relayQuoteError ?? 'missing relay quote'}.`,
      )
      return
    }
    if (!walletClient) {
      setPageError('Connect your wallet first.')
      return
    }
    if (!pasteFlow) {
      setPageError('Prepare the keys.coinbase.com snippet first.')
      return
    }
    if (!pasteValidation?.ok) {
      setPageError('Paste and validate the signed payload before funding the relay depository.')
      return
    }
    const previewRelayGuard = validatePreviewRelayUserCallIsNativeDepository(preview)
    if (previewRelayGuard) {
      setPageError(`Relay funding lane blocked: ${previewRelayGuard}.`)
      return
    }
    const request = (walletClient as any).request as
      | ((args: { method: string; params?: unknown[] }) => Promise<unknown>)
      | undefined
    if (!request) {
      setPageError('Connected wallet does not support JSON-RPC request(). Reconnect and try again.')
      return
    }
    if (!ownerSignerAddress || !canonicalCswAddress) {
      setPageError('Connect a distinct external EOA signer first.')
      return
    }
    if (ownerSignerAddress.toLowerCase() === canonicalCswAddress.toLowerCase()) {
      setPageError(
        'Non-paymaster relay funding requires an external EOA signer. ' +
          'Your current signer matches the CSW (self-auth), which is paymaster-backed.',
      )
      return
    }

    setBusy(true)
    setPageError(null)
    setPageNotice(null)
    setAaDepositDiagnostics(null)
    try {
      appendEvent(`paste_submit.deposit.start request=${preview.relay.requestId}`)
      const activeFrom = await resolveActiveWalletAccount(request)
      if (activeFrom !== ownerSignerAddress.toLowerCase()) {
        throw new Error(
          `Active wallet account ${activeFrom} does not match connected signer ${ownerSignerAddress.toLowerCase()}. ` +
            'Switch wallet account to the connected EOA and retry.',
        )
      }
      appendEvent('paste_submit.deposit.mode=eth_sendTransaction_external_eoa')
      const depositResult = (await request({
        method: 'eth_sendTransaction',
        params: [
          {
            from: activeFrom,
            to: preview.relay.userCall.to,
            data: preview.relay.userCall.data,
            value: preview.relay.userCall.value,
          },
        ],
      })) as string
      if (!depositResult || !/^0x([a-fA-F0-9]{64})$/.test(depositResult)) {
        throw new Error('Wallet did not return a valid Relay depository tx hash.')
      }
      if (publicClient) {
        await publicClient.waitForTransactionReceipt({
          hash: depositResult as `0x${string}`,
          confirmations: 1,
          timeout: 60_000,
        })
      }
      const shape = await verifyAARelayDepositShape({
        publicClient,
        txHash: depositResult as `0x${string}`,
        cswAddress: canonicalCswAddress as `0x${string}`,
        expectedRequestId: preview.relay.requestId,
        strictTrace: strictTraceEnabled,
      })
      if (!shape.ok) {
        setAaDepositDiagnostics(shape.diagnostics ?? null)
        throw new Error(`Deposit transaction shape check failed: ${shape.reason}`)
      }
      if (shape.diagnostics.userOpPaymaster) {
        setAaDepositDiagnostics(shape.diagnostics)
        throw new Error(
          `Deposit transaction used paymaster ${shape.diagnostics.userOpPaymaster}. ` +
            'Reconnect with a plain external EOA signer and retry.',
        )
      }
      setAaDepositDiagnostics(shape.diagnostics)
      appendEvent('paste_submit.deposit.shape_check=ok')
      setDepositTxHash(depositResult)
      appendEvent(`paste_submit.deposit.tx=${depositResult}`)
      appendEvent('paste_submit.deposit.confirmed')
      setPageNotice('Relay depository funding transaction sent via external EOA lane. Continue to step 5.')
    } catch (error) {
      setPageError(
        error instanceof Error ? error.message : 'Failed to fund Relay depository for paste-sign lane.',
      )
    } finally {
      setBusy(false)
    }
  }

  const handleSubmitKeysCoinbasePaste = async () => {
    if (!canonicalCswAddress) {
      setPageError('Canonical CSW not available.')
      return
    }
    if (!preview) {
      setPageError('Select an owner index and prepare a preview first.')
      return
    }
    if (!pasteFlow) {
      setPageError('Prepare the keys.coinbase.com signing snippet first.')
      return
    }
    if (!pasteValidation?.ok) {
      setPageError('Pasted payload is invalid. Fix step 3 before submitting owner removal.')
      return
    }
    if (!signerOwnerIndexValidation.ok) {
      setPageError(signerOwnerIndexValidation.message)
      return
    }
    if (!walletClient) {
      setPageError('Connect your wallet first.')
      return
    }
    const request = (walletClient as any).request as
      | ((args: { method: string; params?: unknown[] }) => Promise<unknown>)
      | undefined
    if (!request) {
      setPageError('Connected wallet does not support JSON-RPC request(). Reconnect and try again.')
      return
    }
    if (!ownerSignerAddress || !canonicalCswAddress) {
      setPageError('Connect a distinct external EOA signer first.')
      return
    }
    if (ownerSignerAddress.toLowerCase() === canonicalCswAddress.toLowerCase()) {
      setPageError(
        'Non-paymaster relay funding requires an external EOA signer. ' +
          'Your current signer matches the CSW (self-auth), which is paymaster-backed.',
      )
      return
    }
    setBusy(true)
    setPageError(null)
    setPageNotice(null)
    setLastErrorDetail(null)
    setSignerMismatch(null)
    setAaDepositDiagnostics(null)
    setRelayTwoLegDiagnostics(null)
    try {
      const parsed = parseKeysCoinbasePasteResponse(pasteResponse)
      const challengeError = verifyChallengeMatchesHash(parsed, pasteFlow.hashToSign)
      if (challengeError) throw new Error(challengeError)

      const signature = buildWebAuthnSignatureWrapper(parsed, pasteFlow.signerOwnerIndex)
      const { handleOpsCalldata } = finalizeReplayableOwnerUserOp({
        userOp: pasteFlow.userOp,
        signature,
        beneficiary: canonicalCswAddress as `0x${string}`,
      })
      appendEvent(`paste_submit.signature_len=${(signature.length - 2) / 2}`)
      appendEvent(`paste_submit.signer_owner_index=${pasteFlow.signerOwnerIndex}`)
      appendEvent(`paste_submit.handle_ops_len=${(handleOpsCalldata.length - 2) / 2}`)

      const relayBody = buildRelayExecuteRequestBody({
        chainId: base.id,
        csw: canonicalCswAddress as `0x${string}`,
        handleOpsCalldata,
        entryPoint: ENTRY_POINT_V06_ADDRESS,
      })
      appendEvent('paste_submit.quote.start')
      const relayQuoteAmountWei = await deriveRelayQuoteSeedAmountWei({
        publicClient,
        cswAddress: canonicalCswAddress as `0x${string}`,
        handleOpsCalldata,
      })
      appendEvent(`paste_submit.quote.seed_amount_wei=${relayQuoteAmountWei}`)
      const quoteRes = await apiFetch('/api/relay/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...relayBody,
          amount: relayQuoteAmountWei,
          recipient: canonicalCswAddress,
          originChainId: base.id,
          destinationChainId: base.id,
        }),
      })
      const quoteJson = (await quoteRes.json().catch(() => null)) as
        | {
            success?: boolean
            error?: string
            data?: unknown
          }
        | null
      if (!quoteRes.ok || !quoteJson?.success) {
        throw new Error(quoteJson?.error ?? `Relay quote failed (${quoteRes.status})`)
      }
      const nativeOnlyError = validateRelayQuoteIsNativeOnly(quoteJson.data)
      if (nativeOnlyError) {
        throw new Error(nativeOnlyError)
      }
      const forbiddenCurrency = findForbiddenRelayCurrency(quoteJson.data)
      if (forbiddenCurrency) {
        throw new Error(
          `Relay quote references forbidden non-native currency (${forbiddenCurrency}). This flow is ETH-native only.`,
        )
      }
      const quotePayload = extractExecuteQuotePayload(quoteJson.data)
      if (!quotePayload) {
        throw new Error('Relay quote did not return requestId + deposit value for router execution.')
      }
      appendEvent(`paste_submit.quote.request_id=${quotePayload.requestId}`)
      appendEvent(`paste_submit.quote.tx_value_wei=${quotePayload.txValueWei}`)
      const previewRelayGuard = validatePreviewRelayUserCallIsNativeDepository(preview)
      if (previewRelayGuard) {
        throw new Error(`Preview relay call failed native-depository guard: ${previewRelayGuard}.`)
      }
      const statusEndpoint = normalizeRelayStatusEndpoint(
        quotePayload.statusEndpoint,
        quotePayload.requestId,
      )
      setRelayTwoLegDiagnostics({
        requestId: quotePayload.requestId,
        statusEndpoint,
        depositTxHash: null,
        executionTxHash: null,
        status: 'quoted',
        statusText: null,
      })

      if (isSelfAuthSession) {
        setRelayTwoLegDiagnostics({
          requestId: quotePayload.requestId,
          statusEndpoint,
          depositTxHash: null,
          executionTxHash: null,
          status: 'execution_failed',
          statusText: 'self_auth_lane_forces_paymaster',
        })
        throw new Error(
          'Non-paymaster relay funding is not available in CSW self-auth mode. ' +
            'Connect a distinct external EOA (funder) and use the external-signer lane so the deposit is broadcast as a plain EOA tx.',
        )
      }
      const activeFrom = await resolveActiveWalletAccount(request)
      if (activeFrom !== ownerSignerAddress.toLowerCase()) {
        throw new Error(
          `Active wallet account ${activeFrom} does not match connected signer ${ownerSignerAddress.toLowerCase()}. ` +
            'Switch wallet account to the connected EOA and retry.',
        )
      }

      const depositValueHex = `0x${BigInt(quotePayload.txValueWei).toString(16)}` as `0x${string}`
      const quotedDepositCallData = (`0x49290c1c000000000000000000000000${canonicalCswAddress.slice(2).toLowerCase()}${quotePayload.requestId.slice(2)}` as `0x${string}`)

      appendEvent('paste_submit.deposit.execute_from_quote.start')
      appendEvent('paste_submit.execute.mode=eth_sendTransaction_direct')
      const depositResult = (await request({
        method: 'eth_sendTransaction',
        params: [
          {
            from: activeFrom,
            to: RELAY_DEPOSITORY_BASE,
            data: quotedDepositCallData,
            value: depositValueHex,
          },
        ],
      })) as string
      if (!depositResult || !/^0x([a-fA-F0-9]{64})$/.test(depositResult)) {
        throw new Error(`Direct deposit send did not return a valid tx hash for request ${quotePayload.requestId}.`)
      }
      if (publicClient) {
        await publicClient.waitForTransactionReceipt({
          hash: depositResult as `0x${string}`,
          confirmations: 1,
          timeout: 60_000,
        })
      }
      const shape = await verifyAARelayDepositShape({
        publicClient,
        txHash: depositResult as `0x${string}`,
        cswAddress: canonicalCswAddress as `0x${string}`,
        expectedRequestId: quotePayload.requestId,
        strictTrace: strictTraceEnabled,
      })
      if (!shape.ok) {
        setAaDepositDiagnostics(shape.diagnostics ?? null)
        throw new Error(`Request-bound deposit transaction shape check failed: ${shape.reason}`)
      }
      if (shape.diagnostics.userOpPaymaster) {
        setAaDepositDiagnostics(shape.diagnostics)
        setRelayTwoLegDiagnostics({
          requestId: quotePayload.requestId,
          statusEndpoint,
          depositTxHash: depositResult as `0x${string}`,
          executionTxHash: null,
          status: 'execution_failed',
          statusText: `paymaster_detected:${shape.diagnostics.userOpPaymaster}`,
        })
        throw new Error(
          `Deposit transaction used paymaster ${shape.diagnostics.userOpPaymaster}. This route requires a direct non-paymaster ETH deposit lane.`,
        )
      }
      setAaDepositDiagnostics(shape.diagnostics)
      appendEvent('paste_submit.execute.shape_check=ok')
      setDepositTxHash(depositResult)
      setTxHash(null)
      setRelayTwoLegDiagnostics({
        requestId: quotePayload.requestId,
        statusEndpoint,
        depositTxHash: depositResult as `0x${string}`,
        executionTxHash: null,
        status: 'deposit_submitted',
        statusText: null,
      })
      try {
        const indexRes = await apiFetch('/api/relay/index', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            txHash: depositResult,
            chainId: base.id,
          }),
        })
        const indexJson = (await indexRes.json().catch(() => null)) as
          | {
              success?: boolean
              error?: string
            }
          | null
        if (indexRes.ok && indexJson?.success) {
          appendEvent('paste_submit.indexing.accepted')
        } else {
          appendEvent(`paste_submit.indexing.failed=${indexJson?.error ?? indexRes.status}`)
        }
      } catch {
        appendEvent('paste_submit.indexing.failed=fetch_error')
      }
      setPageNotice(
        `Submitted request-bound Relay depository deposit via direct tx (tx ${depositResult.slice(0, 10)}…). ` +
          `Relay Router will execute the paired multicall containing EntryPoint.handleOps for request ${quotePayload.requestId.slice(0, 10)}…`,
      )
      if (!quotePayload.statusEndpoint || quotePayload.statusEndpoint.trim().startsWith('/')) {
        appendEvent(`paste_submit.status.poll.fallback_endpoint=${statusEndpoint}`)
      }
      if (statusEndpoint) {
        appendEvent(`paste_submit.status.poll.start endpoint=${statusEndpoint}`)
        setRelayTwoLegDiagnostics({
          requestId: quotePayload.requestId,
          statusEndpoint,
          depositTxHash: depositResult as `0x${string}`,
          executionTxHash: null,
          status: 'execution_pending',
          statusText: null,
        })
        const statusResult = await pollRelayStatusEndpoint({
          statusEndpoint,
          timeoutMs: 90_000,
          intervalMs: 2_000,
          onTick: (message) => appendEvent(`paste_submit.${message}`),
        })
        const statusText = extractRelayStatusText(statusResult.raw)
        if (!statusResult.done) {
          setRelayTwoLegDiagnostics({
            requestId: quotePayload.requestId,
            statusEndpoint,
            depositTxHash: depositResult as `0x${string}`,
            executionTxHash: statusResult.txHash,
            status: 'execution_pending',
            statusText,
          })
          setPageNotice(
            `Request-bound deposit is confirmed and Relay execution is still pending (${statusText ?? 'unknown'}) for request ${quotePayload.requestId.slice(0, 10)}…. ` +
              `Continue monitoring ${statusEndpoint}`,
          )
          appendEvent(`paste_submit.status.poll.pending_after_timeout=${statusText ?? 'unknown'}`)
          return
        }
        if (!statusResult.success) {
          setRelayTwoLegDiagnostics({
            requestId: quotePayload.requestId,
            statusEndpoint,
            depositTxHash: depositResult as `0x${string}`,
            executionTxHash: statusResult.txHash,
            status: 'execution_failed',
            statusText,
          })
          throw new Error(
            `Request-bound deposit succeeded, but Relay execution reported failure for request ${quotePayload.requestId}.`,
          )
        }
        appendEvent('paste_submit.status.poll.success')
        setRelayTwoLegDiagnostics({
          requestId: quotePayload.requestId,
          statusEndpoint,
          depositTxHash: depositResult as `0x${string}`,
          executionTxHash: statusResult.txHash,
          status: 'execution_succeeded',
          statusText,
        })
        if (statusResult.txHash) {
          setTxHash(statusResult.txHash)
          setPageNotice(
            `Owner removal execution confirmed (tx ${statusResult.txHash.slice(0, 10)}…). ` +
              `Deposit tx ${depositResult.slice(0, 10)}… was request-bound and matched.`,
          )
        } else {
          setPageNotice(
            `Relay execution reported success for request ${quotePayload.requestId.slice(0, 10)}…, ` +
              `but no execution tx hash was returned by status endpoint.`,
          )
        }
      } else {
        throw new Error(
          `Request-bound deposit succeeded, but no Relay status endpoint could be derived for request ${quotePayload.requestId}.`,
        )
      }
      setPreview(null)
      setSelectedIndex(null)
      setPasteFlow(null)
      setPasteResponse('')
    } catch (err: any) {
      setPageError(err?.message ?? 'Failed to submit pasted passkey signature.')
    } finally {
      setBusy(false)
    }
  }

  const handleRemove = async () => {
    if (!preview || !canonicalCswAddress || !walletClient) {
      setPageError('Connect your wallet and select an owner index first.')
      return
    }
    if (selectedIndex !== preview.preflight.targetOwnerIndex) {
      setPageError(
        `Preview is for index ${preview.preflight.targetOwnerIndex} but selection is ${selectedIndex ?? 'none'}. Re-click the owner row and retry.`,
      )
      return
    }
    const request = (walletClient as any).request as
      | ((args: { method: string; params?: unknown[] }) => Promise<unknown>)
      | undefined
    if (!request) {
      setPageError('Connected wallet does not support JSON-RPC request(). Reconnect and try again.')
      return
    }
    setBusy(true)
    setPageError(null)
    setLastErrorDetail(null)
    setSignerMismatch(null)
    setPageNotice(null)
    setTxHash(null)
    setEventLog([])
    appendEvent(`lane:${isSelfAuthSession ? 'csw_wallet_sendcalls' : 'relay_funder_eoa_two_step'}`)
    appendEvent(`target:function=${preview.preflight.selectedFunction}`)
    appendEvent(`target:index=${preview.preflight.targetOwnerIndex}`)
    appendEvent(`target:owner=${preview.preflight.targetOwnerAddress ?? '<bytes>'}`)
    appendEvent(`session:${isSelfAuthSession ? 'self_auth' : 'external_signer'}`)
    appendEvent(`signing:require_passkey=${requirePasskey}`)
    try {
      if (isSelfAuthSession) {
        const rawModeEnabled =
          typeof window !== 'undefined' &&
          new URLSearchParams(window.location.search).get('raw') === '1'

        if (!rawModeEnabled && !preview.relay) {
          const reason =
            preview.preflight.relayQuoteError ??
            'Relay quote unavailable; the self-auth lane requires Relay orchestration.'
          appendEvent(`csw_wallet_sendcalls:abort relay_quote_missing reason=${reason.slice(0, 200)}`)
          setPageError(
            `Cannot dispatch via wallet_sendCalls without a Relay quote. ${reason} ` +
              `(Append ?raw=1 to the URL to bypass Relay and send the raw mutation call.)`,
          )
          setBusy(false)
          return
        }
        appendEvent('csw_wallet_sendcalls:start')
        if (rawModeEnabled) {
          appendEvent('csw_wallet_sendcalls:mode=raw_csw_call')
          appendEvent(`raw:target=${preview.txRequest.to}`)
          appendEvent(`raw:selector=${preview.txRequest.data.slice(0, 10)}`)
          appendEvent(`raw:data_length=${(preview.txRequest.data.length - 2) / 2}`)
          const rawResult = await removeOwnerViaBaseAppSendCalls({
            walletRequest: async (args) => await request(args),
            csw: canonicalCswAddress as `0x${string}`,
            ownerIndex: preview.preflight.targetOwnerIndex,
            ownerBytes: preview.preflight.targetOwnerBytes,
            selectedFunction: preview.preflight.selectedFunction,
            chainId: base.id,
            timeoutMs: 60_000,
            intervalMs: 1_500,
            onTelemetry: (event) => {
              try {
                const detail =
                  typeof event.detail === 'string'
                    ? event.detail
                    : JSON.stringify(event.detail)
                const cap = event.step.includes('error') ? 4000 : 320
                appendEvent(`csw_wallet_sendcalls.${event.step}: ${detail.slice(0, cap)}`)
              } catch {
                appendEvent(`csw_wallet_sendcalls.${event.step}: <unloggable>`)
              }
            },
          })
          appendEvent(`csw_wallet_sendcalls:bundle_id=${rawResult.callBundleId}`)
          if (rawResult.transactionHash) {
            setTxHash(rawResult.transactionHash)
            setPageNotice(
              `Raw-mode wallet_sendCalls submitted on-chain (tx ${rawResult.transactionHash.slice(0, 10)}…). ` +
                `Watch Basescan for the RemoveOwnerAtIndex / AddOwner event on the CSW. ` +
                `If the tx reverted with Unauthorized() (0x82b42900) Base App's SDK did not route this through ` +
                `the EntryPoint as a UserOp — we'll need the funder-EOA lane instead.`,
            )
          } else {
            setTxHash(null)
            setPageNotice(
              `Raw-mode wallet_sendCalls submitted (bundle id ${rawResult.callBundleId}). ` +
                `Wallet did not surface an on-chain tx hash within 60s. Check Base App for status.`,
            )
          }
          setPreview(null)
          setSelectedIndex(null)
          return
        } else {
          appendEvent('csw_wallet_sendcalls:mode=relay_orchestrated')
          const relay = preview.relay!
          appendEvent(`relay:request_id=${relay.requestId}`)
          appendEvent(`relay:user_call_to=${relay.userCall.to}`)
          appendEvent(`relay:user_call_value=${relay.userCall.value}`)
          if (relay.feeUsd) {
            appendEvent(`relay:fee_usd=${relay.feeUsd}`)
          }
          const sendCallsCalls = preview.calls.map((c) => ({
            to: c.to,
            data: c.data,
            value: c.value,
          }))
          const sendCallsResult = await _submitOwnerViaSendCalls({
            walletRequest: async (args) => await request(args),
            csw: canonicalCswAddress as `0x${string}`,
            calls: sendCallsCalls.map((c) => ({
              to: c.to,
              data: c.data as Hex,
              value: c.value,
            })),
            chainId: base.id,
            onTelemetry: (event) => {
              try {
                const detail =
                  typeof event.detail === 'string'
                    ? event.detail
                    : JSON.stringify(event.detail)
                const cap = event.step.includes('error') ? 4000 : 240
                appendEvent(`csw_wallet_sendcalls.${event.step}: ${detail.slice(0, cap)}`)
                if (
                  event.step === 'broadcast_error' &&
                  event.detail &&
                  typeof event.detail === 'object'
                ) {
                  const d = event.detail as Record<string, unknown>
                  setLastErrorDetail({
                    revertReason: (d.error as string | null) ?? null,
                    revertData: null,
                    relayTx: null,
                    rawBody: null,
                  })
                }
              } catch {
                appendEvent(`csw_wallet_sendcalls.${event.step}: <unloggable>`)
              }
            },
          })
          appendEvent(`csw_wallet_sendcalls:bundle_id=${sendCallsResult.callBundleId}`)
          const resolution = await waitForCallsTxHash({
            walletRequest: async (args) => await request(args),
            callBundleId: sendCallsResult.callBundleId,
            timeoutMs: 60_000,
            intervalMs: 1_500,
            onTelemetry: (event) => {
              try {
                const detail =
                  typeof event.detail === 'string'
                    ? event.detail
                    : JSON.stringify(event.detail)
                const cap = event.step.includes('error') ? 4000 : 320
                appendEvent(`csw_wallet_sendcalls.${event.step}: ${detail.slice(0, cap)}`)
              } catch {
                appendEvent(`csw_wallet_sendcalls.${event.step}: <unloggable>`)
              }
            },
          })
        if (resolution.transactionHash) {
          setTxHash(resolution.transactionHash)
          if (rawModeEnabled) {
            setPageNotice(
              `Raw-mode wallet_sendCalls submitted on-chain (tx ${resolution.transactionHash.slice(0, 10)}…). ` +
                `Watch Basescan for the RemoveOwnerAtIndex / AddOwner event on the CSW. ` +
                `If the tx reverted with Unauthorized() (0x82b42900) Base App's SDK did not route this through ` +
                `the EntryPoint as a UserOp \u2014 we'll need the funder-EOA lane instead.`,
            )
          } else {
            const rid = preview.relay!.requestId.slice(0, 10)
            const shape = await verifyAARelayDepositShape({
              publicClient,
              txHash: resolution.transactionHash as `0x${string}`,
              cswAddress: canonicalCswAddress as `0x${string}`,
              expectedRequestId: preview.relay!.requestId,
              strictTrace: strictTraceEnabled,
            })
            if (!shape.ok) {
              setAaDepositDiagnostics(shape.diagnostics ?? null)
              throw new Error(`Deposit transaction shape check failed: ${shape.reason}`)
            }
            setAaDepositDiagnostics(shape.diagnostics)
            appendEvent('csw_wallet_sendcalls.shape_check=ok')
            setPageNotice(
              `Part 1 (deposit) submitted on-chain (tx ${resolution.transactionHash.slice(0, 10)}…). ` +
                `Relay will now dispatch Part 2 via EntryPoint.handleOps (solver/bundler lane), ` +
                `usually within the same block. Watch EntryPoint txs and the CSW's AA tx list on Basescan for the AddOwner/RemoveOwner event; ` +
                `request id ${rid}… can also be tracked via Relay /intents/status/v3.`,
            )
          }
        } else {
          setTxHash(null)
          if (rawModeEnabled) {
            setPageNotice(
              `Raw-mode wallet_sendCalls submitted (bundle id ${sendCallsResult.callBundleId}). ` +
                `Wallet did not surface an on-chain tx hash within 60s. Check Base App for status.`,
            )
          } else {
            const rid = preview.relay!.requestId
            setPageNotice(
              `Part 1 submitted via wallet_sendCalls (bundle id ${sendCallsResult.callBundleId}). ` +
                `Wallet did not surface an on-chain tx hash within 60s. ` +
                `Relay request id ${rid.slice(0, 10)}… can be polled at ` +
                `/intents/status/v3?requestId=${rid} for status.`,
            )
          }
        }
        setPreview(null)
        setSelectedIndex(null)
        return
        }
      }

      appendEvent('step1:sign_userop_start')
      const signResult = await _submitOwnerViaSelfBuiltUserOp({
        walletRequest: async (args) => await request(args),
        chainId: base.id,
        csw: canonicalCswAddress as `0x${string}`,
        innerCallData: preview.txRequest.data as Hex,
        requireWebAuthnOwnerSignature: requirePasskey,
        sessionKind: isSelfAuthSession ? 'self_auth' : 'external_signer',
        signOnly: true,
        onTelemetry: (event) => {
          try {
            const detail =
              typeof event.detail === 'string'
                ? event.detail
                : JSON.stringify(event.detail)
            const cap = event.step === 'error' ? 4000 : 240
            appendEvent(`step1.${event.step}: ${detail.slice(0, cap)}`)
            if (
              event.step === 'signature_preflight' &&
              event.detail &&
              typeof event.detail === 'object'
            ) {
              const d = event.detail as Record<string, unknown>
              const ownerRecoveryKind = d.ownerRecoveryKind as string | undefined
              if (
                ownerRecoveryKind === 'mismatch' ||
                ownerRecoveryKind === 'skipped_self_auth_session_key'
              ) {
                setSignerMismatch({
                  recoveredRaw: (d.recoveredRawAddress as string | null) ?? null,
                  recoveredEip191: (d.recoveredEip191Address as string | null) ?? null,
                  claimedOwnerIndex: (d.ownerIndex as number | null) ?? null,
                })
              }
            }
          } catch {
            appendEvent(`step1.${event.step}: <unloggable>`)
          }
        },
      })
      appendEvent(`step1:sign_userop_done (handleOps=${signResult.handleOpsCalldata.length - 2} hex chars)`)

      if (
        !ownerSignerAddress ||
        ownerSignerAddress.toLowerCase() === canonicalCswAddress.toLowerCase()
      ) {
        throw new Error(
          'External-signer lane requires a distinct funder EOA; the current connected address matches the CSW. ' +
            'Reconnect with an EOA wallet that holds ETH on Base and retry.',
        )
      }
      const funderEoa = ownerSignerAddress as `0x${string}`
      appendEvent(`step2:funder=${funderEoa}`)
      const submitResult = await _submitOwnerViaFunderEoa({
        walletRequest: async (args) => await request(args),
        funderEoa,
        csw: canonicalCswAddress as `0x${string}`,
        handleOpsCalldata: signResult.handleOpsCalldata,
        chainId: base.id,
        onTelemetry: (event) => {
          try {
            const detail =
              typeof event.detail === 'string'
                ? event.detail
                : JSON.stringify(event.detail)
            const cap = event.step.includes('error') ? 4000 : 240
            appendEvent(`step2.${event.step}: ${detail.slice(0, cap)}`)
            if (
              event.step === 'quote_error' &&
              event.detail &&
              typeof event.detail === 'object'
            ) {
              const d = event.detail as Record<string, unknown>
              setLastErrorDetail({
                revertReason: null,
                revertData: null,
                relayTx: null,
                rawBody:
                  typeof d.body === 'string'
                    ? (d.body as string)
                    : d.body
                      ? JSON.stringify(d.body)
                      : null,
              })
            }
            if (
              event.step === 'broadcast_error' &&
              event.detail &&
              typeof event.detail === 'object'
            ) {
              const d = event.detail as Record<string, unknown>
              setLastErrorDetail({
                revertReason: (d.error as string | null) ?? null,
                revertData: null,
                relayTx: null,
                rawBody: null,
              })
            }
          } catch {
            appendEvent(`step2.${event.step}: <unloggable>`)
          }
        },
      })
      setTxHash(submitResult.funderTxHash)
      setPageNotice(
        `Broadcast removal tx for owner[${preview.preflight.targetOwnerIndex}] via Relay. ` +
          (submitResult.statusCheckEndpoint
            ? 'Relay Router will pick up the request and execute the owner mutation on Base shortly.'
            : ''),
      )
      setPreview(null)
      setSelectedIndex(null)
    } catch (err: any) {
      setPageError(typeof err?.message === 'string' ? err.message : 'Failed to remove owner.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <PageMeta
        title="Remove owner"
        description="Remove an owner from your canonical Coinbase Smart Wallet via the Relay-sponsored UserOp lane, with live on-chain diagnostics."
        canonicalPath="/remove-owner"
      />
      <div className="mx-auto w-full max-w-2xl px-6 py-16 space-y-6">
        <div className="space-y-2">
          <div className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">
            Account setup
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">Remove owner</h1>
          <p className="text-sm text-zinc-400">
            Remove an owner from your canonical Coinbase Smart Wallet via the
            Relay-sponsored UserOp lane (
            <code className="font-mono text-zinc-300">wallet_sendCalls</code> →
            <code className="font-mono text-zinc-300"> EntryPoint.handleOps</code> →
            <code className="font-mono text-zinc-300"> RelayDepository.depositNative</code>).
            Live on-chain diagnostics below show which owner slots are populated and
            whether Relay&apos;s depository has a balance for your CSW so you can
            anticipate whether validation will pass before signing.
          </p>
        </div>

        {!privyAuthed ? (
          <div className="card rounded-2xl border border-white/10 bg-black/40 p-6 space-y-3">
            <p className="text-sm text-zinc-300">
              Sign in to manage owners on your wallet.
            </p>
            <button
              type="button"
              onClick={() => void login({ loginMethods: ['email', 'wallet'] } as any)}
              className="btn-accent btn-no-icon inline-flex"
            >
              Sign in / Continue
            </button>
          </div>
        ) : null}

        {privyAuthed && loading ? (
          <div className="rounded-2xl border border-white/10 bg-black/40 p-6 text-sm text-zinc-400">
            Loading your account…
          </div>
        ) : null}

        {inAppEnv?.isAnyWalletInApp && !isSelfAuthSession ? (
          <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 p-6 space-y-4 text-amber-100">
            <div className="space-y-1">
              <div className="text-[11px] uppercase tracking-[0.2em] text-amber-300/80">
                Open in your browser
              </div>
              <div className="text-sm font-semibold">
                {inAppEnv.isCoinbaseInApp
                  ? "Coinbase Wallet's in-app browser can block the passkey popup"
                  : 'This in-app browser can block the passkey popup'}
              </div>
            </div>
            <p className="text-xs leading-relaxed text-amber-100/85">
              You&apos;re connected as an external signer (not the CSW itself).
              Removing an owner needs the same passkey or EOA signature owner
              installs use, and in-app browsers can block or replace that signing
              context. Open in a regular browser for the best chance of success.
            </p>
            <a
              href={externalUrl}
              target="_blank"
              rel="noopener noreferrer external"
              className="inline-flex items-center justify-center rounded-xl bg-amber-300 px-4 py-2 text-xs font-semibold text-black hover:bg-amber-200"
            >
              Open 4626.fun/remove-owner in browser
            </a>
          </div>
        ) : null}

        {inAppEnv?.isAnyWalletInApp && isSelfAuthSession ? (
          <div className="rounded-2xl border border-emerald-400/25 bg-emerald-500/5 p-4 text-xs text-emerald-100/85">
            In-app browser detected with a CSW self-auth session. This page
            will submit via EIP-5792{' '}
            <code className="font-mono">wallet_sendCalls</code>: Base App
            builds the UserOp internally, signs it locally with the on-device
            passkey, and submits via its built-in bundler. The CSW pays its
            own gas from its EntryPoint deposit — no popup, no external
            funder. If you need a strict non-paymaster Relay deposit, switch to
            an external EOA signer/funder lane.
          </div>
        ) : null}

        {privyAuthed && !loading ? (
          <div className="space-y-4">
            {!canonicalCswAddress ? (
              <div className="card rounded-2xl border border-white/10 bg-black/40 p-6 text-sm text-zinc-400">
                <div>No canonical Coinbase Smart Wallet is linked yet.</div>
                <div className="mt-2 text-xs text-zinc-500">
                  Connect your CSW first — head to{' '}
                  <Link to="/accounts" className="underline underline-offset-2">
                    /accounts
                  </Link>
                  .
                </div>
              </div>
            ) : (
              <>
                <RemoveOwnerOwnerSlotsCard
                  canonicalCswAddress={canonicalCswAddress as `0x${string}`}
                  ownerSignerAddress={(ownerSignerAddress as `0x${string}` | null) ?? null}
                  isSelfAuthSession={isSelfAuthSession}
                  diagnostics={diagnostics}
                  selectedIndex={selectedIndex}
                  onSelectIndex={handleSelectIndex}
                />

                {/* Preview + submit */}
                <RemoveOwnerActionPanel
                  previewLoading={previewLoading}
                  preview={preview}
                  busy={busy}
                  signerOwnerIndexValidation={signerOwnerIndexValidation}
                  handlePrepareKeysCoinbasePaste={handlePrepareKeysCoinbasePaste}
                  pasteValidation={pasteValidation}
                  signingOwnerIndex={signingOwnerIndex}
                  setSigningOwnerIndex={setSigningOwnerIndex}
                  ownerIndexOptions={diagnostics.owners
                    .filter((owner) => owner.type !== 'empty')
                    .map((owner) => ({
                      index: owner.index,
                      type: owner.type,
                      ownerAddress: owner.ownerAddress,
                    }))}
                  pasteFlow={pasteFlow}
                  pasteResponse={pasteResponse}
                  setPasteResponse={setPasteResponse}
                  handleFundRelayDepositForPasteLane={handleFundRelayDepositForPasteLane}
                  depositTxHash={depositTxHash}
                  handleSubmitKeysCoinbasePaste={handleSubmitKeysCoinbasePaste}
                  requirePasskey={requirePasskey}
                  setRequirePasskey={setRequirePasskey}
                  setSignerMismatch={setSignerMismatch}
                  isSelfAuthSession={isSelfAuthSession}
                  inAppEnv={inAppEnv ? { isAnyWalletInApp: Boolean(inAppEnv.isAnyWalletInApp) } : null}
                  handleRemove={handleRemove}
                  txHash={txHash}
                  relayTwoLegDiagnostics={relayTwoLegDiagnostics}
                  patternLockStatus={patternLockStatus}
                  strictTraceEnabled={strictTraceEnabled}
                  aaDepositDiagnostics={aaDepositDiagnostics}
                  pageNotice={pageNotice}
                  pageError={pageError}
                  signerMismatch={signerMismatch}
                  lastErrorDetail={lastErrorDetail}
                  eventLog={eventLog}
                />
              </>
            )}
          </div>
        ) : null}

        <div className="text-[11px] text-zinc-500 space-y-1">
          <div>
            Looking to install a signing key instead?{' '}
            <Link to="/add-owner" className="underline underline-offset-2">
              /add-owner
            </Link>
            .
          </div>
          <div>
            Need to fund the CSW before submitting?{' '}
            <Link to="/csw-funding" className="underline underline-offset-2">
              /csw-funding
            </Link>
            .
          </div>
        </div>
      </div>
    </div>
  )
}

export default RemoveOwnerPage
