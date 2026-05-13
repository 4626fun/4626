import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { usePublicClient, useWalletClient } from 'wagmi'
import { base } from 'viem/chains'
import { decodeAbiParameters, formatEther, type Hex, type PublicClient } from 'viem'

import { PageMeta } from '@/components/seo/PageMeta'
import { useAccountSetupController } from '@/features/accountSetup/useAccountSetupController'
import { detectInAppEnvironment, externalBrowserUrlFor } from '@/lib/wallet/inAppBrowser'
import { apiFetch } from '@/lib/api/apiBase'
import { _submitOwnerViaSelfBuiltUserOp } from '@/lib/wallet/onboardingWallet'
import { _submitOwnerViaFunderEoa } from '@/lib/wallet/relayFunderEoaSubmit'
import { _submitOwnerViaSendCalls, waitForCallsTxHash } from '@/lib/wallet/cswSendCalls'
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

// Relay Protocol's depository on Base. Reference tx where this CSW deposited:
// https://basescan.org/tx/0x34edd28dd9611f4e06374dfe87645de4fc3fd94c83f96b5b1406c6ee10d2aadf
// (UserOp executeBatch -> RelayDepository.depositNative(depositor, id))
const RELAY_DEPOSITORY_BASE = '0x4cd00e387622c35bddb9b4c962c136462338bc31' as const
const RELAY_EXECUTION_QUOTE_AMOUNT_WEI = '20000000000000'
const ENTRY_POINT_USER_OPERATION_EVENT_TOPIC =
  '0x49628fd1471006c1482da88028e9ce4dbb080b815c9b0344d39e5a8e6ec1419f' as const
const RELAY_NATIVE_DEPOSIT_EVENT_TOPIC =
  '0x8032066556caf3967d8fec4ad22a2d9e1e9576556b2903a0fcd5b1fd201e3477' as const
/** One EIP-5792 call. Shape matches what the backend preview returns. */
type Eip5792Call = {
  to: `0x${string}`
  data: `0x${string}`
  value: `0x${string}`
}

/**
 * Relay-orchestrated submission metadata. When present, the single `userCall`
 * (a deposit-into-RelayRouter tx) is what the wallet should submit; Relay's
 * solver runs the destination mutation off-chain.
 */
type PreviewRelayFlow = {
  requestId: `0x${string}`
  userCall: Eip5792Call
  feeUsd: string | null
}

type RelayQuoteExecutePayload = {
  requestId: `0x${string}`
  txValueWei: string
  statusEndpoint: string | null
}

type AADepositDiagnostics = {
  txHash: `0x${string}`
  blockNumber: bigint
  userOpHash: `0x${string}` | null
  userOpNonce: bigint | null
  userOpSuccess: boolean | null
  actualGasCostWei: bigint | null
  actualGasUsed: bigint | null
  relayDepositFrom: `0x${string}` | null
  relayDepositAmountWei: bigint | null
  relayDepositRequestId: `0x${string}` | null
  expectedRequestId: `0x${string}`
  checks: {
    hasEntryPointUserOpForCsw: boolean
    hasRelayDepositForCsw: boolean
    requestIdMatches: boolean
  }
}

type RemoveOwnerPreview = {
  /** Legacy: raw mutation calldata. Only used in the funder-EOA fallback lane. */
  txRequest: {
    chainId: 8453
    to: `0x${string}`
    data: `0x${string}`
    value: '0x0'
  }
  /**
   * EIP-5792 calls to pass to wallet_sendCalls. When relay is present, this
   * is exactly the Relay-orchestrated user transaction; otherwise it's the
   * raw mutation call (which only the funder-EOA lane can actually dispatch).
   */
  calls: Eip5792Call[]
  /** Relay quote details, null if the upstream quote failed. */
  relay: PreviewRelayFlow | null
  preflight: {
    selectedFunction: 'removeOwnerAtIndex' | 'removeLastOwner'
    selectedBy: 'heuristic' | 'simulation'
    targetOwnerIndex: number
    targetOwnerBytes: `0x${string}`
    targetOwnerAddress: `0x${string}` | null
    highestPopulatedOwnerIndex: number
    ownerCount: number
    nextOwnerIndex: number
    simulation: {
      ok: boolean
      error: string | null
      removeOwnerAtIndex: { ok: boolean; error: string | null }
      removeLastOwner: { ok: boolean; error: string | null }
    }
    relayQuoteError: string | null
  }
}

function extractExecuteQuotePayload(raw: unknown): RelayQuoteExecutePayload | null {
  if (!raw || typeof raw !== 'object') return null
  const obj = raw as Record<string, unknown>

  let requestId: `0x${string}` | null = null
  let txValueWei: string | null = null
  let statusEndpoint: string | null = null

  const steps = Array.isArray(obj.steps) ? obj.steps : []
  for (const step of steps) {
    if (!step || typeof step !== 'object') continue
    const stepObj = step as Record<string, unknown>
    if (!requestId && typeof stepObj.requestId === 'string' && /^0x[0-9a-fA-F]{64}$/.test(stepObj.requestId)) {
      requestId = stepObj.requestId as `0x${string}`
    }
    if (!statusEndpoint && stepObj.check && typeof stepObj.check === 'object') {
      const endpoint = (stepObj.check as Record<string, unknown>).endpoint
      if (typeof endpoint === 'string' && endpoint.trim()) {
        statusEndpoint = endpoint
      }
    }
    if (txValueWei) continue
    const items = Array.isArray(stepObj.items) ? stepObj.items : []
    for (const item of items) {
      if (!item || typeof item !== 'object') continue
      const data = (item as Record<string, unknown>).data
      if (!data || typeof data !== 'object') continue
      const value = (data as Record<string, unknown>).value
      if (typeof value === 'string' && /^[0-9]+$/.test(value)) {
        txValueWei = value
        break
      }
      if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
        txValueWei = Math.trunc(value).toString(10)
        break
      }
    }
  }

  if (!requestId) {
    const protocol = obj.protocol
    if (protocol && typeof protocol === 'object') {
      const v2 = (protocol as Record<string, unknown>).v2
      if (v2 && typeof v2 === 'object') {
        const orderId = (v2 as Record<string, unknown>).orderId
        if (typeof orderId === 'string' && /^0x[0-9a-fA-F]{64}$/.test(orderId)) {
          requestId = orderId as `0x${string}`
        }
      }
    }
  }

  if (!requestId || !txValueWei) return null
  return { requestId, txValueWei, statusEndpoint }
}

function topicAddress(topic: string | undefined): `0x${string}` | null {
  if (!topic || typeof topic !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(topic)) return null
  return (`0x${topic.slice(26)}` as `0x${string}`).toLowerCase() as `0x${string}`
}

function toHex32Topic(value: `0x${string}`): `0x${string}` {
  const clean = value.slice(2).toLowerCase()
  return (`0x${clean.padStart(64, '0')}`) as `0x${string}`
}

async function verifyAARelayDepositShape(params: {
  publicClient: PublicClient | undefined
  txHash: `0x${string}`
  cswAddress: `0x${string}`
  expectedRequestId: `0x${string}`
}): Promise<
  | { ok: true; diagnostics: AADepositDiagnostics }
  | { ok: false; reason: string; diagnostics?: AADepositDiagnostics }
> {
  if (!params.publicClient) {
    return { ok: false, reason: 'Public client unavailable; cannot verify AA relay deposit shape.' }
  }
  const receipt = await params.publicClient.getTransactionReceipt({ hash: params.txHash })
  const expectedCsw = params.cswAddress.toLowerCase()
  const expectedRequestIdTopic = toHex32Topic(params.expectedRequestId)

  let userOpHash: `0x${string}` | null = null
  let userOpNonce: bigint | null = null
  let userOpSuccess: boolean | null = null
  let actualGasCostWei: bigint | null = null
  let actualGasUsed: bigint | null = null
  let relayDepositFrom: `0x${string}` | null = null
  let relayDepositAmountWei: bigint | null = null
  let relayDepositRequestId: `0x${string}` | null = null
  let hasEntryPointUserOpForCsw = false
  let hasRelayDepositForCsw = false
  let hasMatchingRequestId = false

  for (const log of receipt.logs) {
    const addressLower = log.address.toLowerCase()
    const topic0 = log.topics?.[0]?.toLowerCase() ?? ''
    if (
      addressLower === ENTRY_POINT_V06_ADDRESS.toLowerCase() &&
      topic0 === ENTRY_POINT_USER_OPERATION_EVENT_TOPIC
    ) {
      const senderTopicAddress = topicAddress(log.topics?.[2])
      if (senderTopicAddress && senderTopicAddress.toLowerCase() === expectedCsw) {
        hasEntryPointUserOpForCsw = true
      }
      const opHashTopic = log.topics?.[1]
      if (typeof opHashTopic === 'string' && /^0x[0-9a-fA-F]{64}$/.test(opHashTopic)) {
        userOpHash = opHashTopic as `0x${string}`
      }
      try {
        const [nonce, success, actualGasCost, gasUsed] = decodeAbiParameters(
          [
            { type: 'uint256' },
            { type: 'bool' },
            { type: 'uint256' },
            { type: 'uint256' },
          ],
          log.data,
        )
        userOpNonce = nonce as bigint
        userOpSuccess = success as boolean
        actualGasCostWei = actualGasCost as bigint
        actualGasUsed = gasUsed as bigint
      } catch {}
      continue
    }
    if (
      addressLower === RELAY_DEPOSITORY_BASE.toLowerCase() &&
      topic0 === RELAY_NATIVE_DEPOSIT_EVENT_TOPIC
    ) {
      try {
        const [from, _amount, requestId] = decodeAbiParameters(
          [{ type: 'address' }, { type: 'uint256' }, { type: 'bytes32' }],
          log.data,
        )
        if (String(from).toLowerCase() === expectedCsw) {
          hasRelayDepositForCsw = true
        }
        relayDepositFrom = String(from).toLowerCase() as `0x${string}`
        relayDepositAmountWei = _amount as bigint
        relayDepositRequestId = requestId as `0x${string}`
        if ((requestId as string).toLowerCase() === expectedRequestIdTopic.toLowerCase()) {
          hasMatchingRequestId = true
        }
      } catch {
        return { ok: false, reason: 'Could not decode RelayNativeDeposit log data.' }
      }
    }
  }

  const diagnostics: AADepositDiagnostics = {
    txHash: params.txHash,
    blockNumber: receipt.blockNumber,
    userOpHash,
    userOpNonce,
    userOpSuccess,
    actualGasCostWei,
    actualGasUsed,
    relayDepositFrom,
    relayDepositAmountWei,
    relayDepositRequestId,
    expectedRequestId: params.expectedRequestId,
    checks: {
      hasEntryPointUserOpForCsw,
      hasRelayDepositForCsw,
      requestIdMatches: hasMatchingRequestId,
    },
  }

  if (!hasEntryPointUserOpForCsw) {
    return {
      ok: false,
      reason:
        'Deposit tx missing EntryPoint UserOperationEvent for canonical CSW (no CSW -> EntryPoint leg).',
      diagnostics,
    }
  }
  if (!hasRelayDepositForCsw) {
    return {
      ok: false,
      reason:
        'Deposit tx missing RelayNativeDeposit for canonical CSW (no CSW -> RelayDepository leg).',
      diagnostics,
    }
  }
  if (!hasMatchingRequestId) {
    return {
      ok: false,
      reason:
        'Deposit tx RelayNativeDeposit requestId does not match the expected request-bound Relay quote.',
      diagnostics,
    }
  }
  return { ok: true, diagnostics }
}

type OnchainOwnerRow = {
  index: number
  ownerBytes: `0x${string}`
  ownerAddress: `0x${string}` | null
  // 'unreadable' = the on-chain read for this slot threw; we don't actually
  // know whether it's empty or populated. Don't gate the UI on this state
  // alone — surface the error so the user can retry or fall back to
  // typing an index manually.
  type: 'EOA' | 'passkey' | 'empty' | 'unknown' | 'unreadable'
  readError?: string | null
}

type LiveDiagnostics = {
  status: 'loading' | 'ready' | 'error'
  ownerCount: number | null
  nextOwnerIndex: number | null
  owners: OnchainOwnerRow[]
  cswEthBalance: bigint | null
  relayDepositoryEthBalance: bigint | null
  error: string | null
}

const INITIAL_DIAGNOSTICS: LiveDiagnostics = {
  status: 'loading',
  ownerCount: null,
  nextOwnerIndex: null,
  owners: [],
  cswEthBalance: null,
  relayDepositoryEthBalance: null,
  error: null,
}

const CSW_OWNER_ABI = [
  {
    type: 'function',
    name: 'ownerCount',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'nextOwnerIndex',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'ownerAtIndex',
    stateMutability: 'view',
    inputs: [{ type: 'uint256' }],
    outputs: [{ type: 'bytes' }],
  },
] as const

function classifyOwnerBytes(ownerBytes: `0x${string}`): OnchainOwnerRow['type'] {
  const lenBytes = (ownerBytes.length - 2) / 2
  if (lenBytes === 0) return 'empty'
  if (lenBytes === 32) return 'EOA'
  if (lenBytes === 64) return 'passkey'
  return 'unknown'
}

function decodeOwnerAddress(ownerBytes: `0x${string}`): `0x${string}` | null {
  const lenBytes = (ownerBytes.length - 2) / 2
  if (lenBytes !== 32) return null
  // 32-byte slot = abi-encoded address (left-padded). Address is last 20 bytes.
  const tail = ownerBytes.slice(-40)
  if (!/^[0-9a-fA-F]{40}$/.test(tail)) return null
  return (`0x${tail}` as `0x${string}`)
}

/**
 * `/remove-owner` — Relay-sponsored owner-remove lane for the canonical CSW.
 *
 * Calls `_submitOwnerViaSelfBuiltUserOp` (which submits via
 * `/api/relay/execute` → Relay's `/execute/call` endpoint) with a
 * preview-remove-owner-produced `removeOwnerAtIndex` or `removeLastOwner`
 * inner call.
 *
 * Live on-chain diagnostics are surfaced before the user submits so they
 * can see whether the lane will actually validate. Specifically:
 *
 *   - Owner slot map: index, bytes length, decoded address, slot empty?
 *   - CSW ETH balance on Base (for any direct funding lane the user might
 *     try elsewhere)
 *   - RelayDepository ETH balance attributed to this CSW (for visibility;
 *     Relay Router execution may require a pre-deposit before multicall(handleOps))
 *
 * Reference txs that defined this lane:
 *   - https://basescan.org/tx/0x34edd28dd9611f4e06374dfe87645de4fc3fd94c83f96b5b1406c6ee10d2aadf
 *     (CSW UserOp executeBatch → RelayDepository.depositNative; pre-fund step)
 *   - https://basescan.org/tx/0xa9a06340a7725063f1dd9b0a29af6c72f4fbfe3a408b28dd28e2fd2db7649a36
 *     (Relay Router multicall → EntryPoint.handleOps → CSW
 *      addOwnerAddress; the owner-mutation half of the flow)
 *
 * If the deposit step is needed and you don't have a depository balance,
 * this page does NOT fund it for you. Fund Relay separately (or via a
 * future Step 1 button) and retry.
 */
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
  // Monotonically-increasing request id. Each call to fetchPreview captures
  // the id assigned to it; responses ignore themselves if a newer request has
  // since started. Protects against an earlier (slow) response overwriting a
  // later (faster) one and submitting the wrong removal target.
  const previewRequestIdRef = useRef(0)
  const [busy, setBusy] = useState(false)
  const [pageError, setPageError] = useState<string | null>(null)
  const [pageNotice, setPageNotice] = useState<string | null>(null)
  const [txHash, setTxHash] = useState<string | null>(null)
  const [depositTxHash, setDepositTxHash] = useState<string | null>(null)
  const [aaDepositDiagnostics, setAaDepositDiagnostics] = useState<AADepositDiagnostics | null>(null)
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
  // Default to passkey-only signing. Self-auth ECDSA via Coinbase Wallet's
  // `personal_sign` is documented to silently return signatures from rotated
  // session keys that are no longer installed as owners on the CSW — the
  // SignatureWrapper claims an ownerIndex but the ECDSA actually recovers to
  // an address that doesn't match the bytes stored at that slot, so EntryPoint
  // reverts with AA24 inside Relay simulation. Passkey signing
  // signs via WebAuthn, which the CSW validates with stored credentialId bytes
  // — no session-key drift possible. The user can opt back into session-key
  // mode if they explicitly want to (e.g. when no passkey is available).
  const [requirePasskey, setRequirePasskey] = useState(true)
  // When the signature recovers to an address that's not installed on the
  // CSW, we capture the recovered candidate(s) here so the page can suggest
  // an explicit recovery action (e.g. "install this address as an owner first").
  const [signerMismatch, setSignerMismatch] = useState<{
    recoveredRaw: string | null
    recoveredEip191: string | null
    claimedOwnerIndex: number | null
  } | null>(null)

  // Use the wagmi-configured public client so we hit the project's own Base
  // RPC (with multicall batching and any auth tokens) rather than viem's
  // unauthenticated default endpoint. mainnet.base.org is heavily rate-
  // limited and would silently fail later-in-batch reads, marking real
  // owner slots as empty.
  const wagmiPublicClient = usePublicClient({ chainId: base.id })
  const publicClient = wagmiPublicClient as PublicClient | undefined

  // Live on-chain diagnostics: refresh whenever the canonical CSW changes.
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
        // CSW owner indices are monotonic and can grow past 16 after add/remove
        // churn. Use the full nextOwnerIndex so all populated slots are visible.
        // A SCAN_HARD_CEILING guards against pathological / corrupted state from
        // ever loading thousands of slots; well above any realistic CSW (the
        // public Coinbase Smart Wallet implementation has never been observed
        // beyond two-digit owner indices).
        const SCAN_HARD_CEILING = 256
        const rawScanLimit = Math.max(nextOwnerIndex, Number(ownerCountRaw))
        const scanLimit = Math.min(rawScanLimit, SCAN_HARD_CEILING)
        // Fan out the per-slot reads in parallel — the wagmi public client
        // batches them through multicall, so this is one round-trip with
        // proper error attribution per slot instead of a serial loop where
        // an early throttle silently nukes later reads.
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
            // Don't claim "empty" — we don't know. Mark as unreadable so the
            // UI surfaces the error and the slot is still selectable.
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
          // Note: this is the RelayDepository's aggregate ETH balance, not
          // the per-depositor accounting. Per-depositor balance requires a
          // depository-side view we don't have a stable ABI for yet.
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
    const locked = Boolean(
      checks?.hasEntryPointUserOpForCsw && checks?.hasRelayDepositForCsw && checks?.requestIdMatches,
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
      // Drop the response if a newer fetchPreview has started in the meantime
      // so we never display or submit a stale payload for the wrong owner.
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
    const request = (walletClient as any).request as
      | ((args: { method: string; params?: unknown[] }) => Promise<unknown>)
      | undefined
    if (!request) {
      setPageError('Connected wallet does not support JSON-RPC request(). Reconnect and try again.')
      return
    }

    setBusy(true)
    setPageError(null)
    setPageNotice(null)
    setAaDepositDiagnostics(null)
    try {
      appendEvent(`paste_submit.deposit.start request=${preview.relay.requestId}`)
      if (isSelfAuthSession && canonicalCswAddress) {
        appendEvent('paste_submit.deposit.mode=wallet_sendCalls')
        const sendCallsResult = await _submitOwnerViaSendCalls({
          walletRequest: async (args) => await request(args),
          csw: canonicalCswAddress as `0x${string}`,
          calls: [
            {
              to: preview.relay.userCall.to,
              data: preview.relay.userCall.data as Hex,
              value: preview.relay.userCall.value,
            },
          ],
          chainId: base.id,
          onTelemetry: (event) => {
            try {
              const detail =
                typeof event.detail === 'string' ? event.detail : JSON.stringify(event.detail)
              appendEvent(`paste_submit.deposit.${event.step}: ${detail.slice(0, 280)}`)
            } catch {
              appendEvent(`paste_submit.deposit.${event.step}: <unloggable>`)
            }
          },
        })
        appendEvent(`paste_submit.deposit.bundle_id=${sendCallsResult.callBundleId}`)
        const resolution = await waitForCallsTxHash({
          walletRequest: async (args) => await request(args),
          callBundleId: sendCallsResult.callBundleId,
          timeoutMs: 60_000,
          intervalMs: 1_500,
          onTelemetry: (event) => {
            try {
              const detail =
                typeof event.detail === 'string' ? event.detail : JSON.stringify(event.detail)
              appendEvent(`paste_submit.deposit.${event.step}: ${detail.slice(0, 280)}`)
            } catch {
              appendEvent(`paste_submit.deposit.${event.step}: <unloggable>`)
            }
          },
        })
        if (!resolution.transactionHash) {
          throw new Error(
            `wallet_sendCalls deposit did not surface an on-chain tx hash yet (bundle: ${sendCallsResult.callBundleId}).`,
          )
        }
        const shape = await verifyAARelayDepositShape({
          publicClient,
          txHash: resolution.transactionHash as `0x${string}`,
          cswAddress: canonicalCswAddress as `0x${string}`,
          expectedRequestId: preview.relay.requestId,
        })
        if (!shape.ok) {
          setAaDepositDiagnostics(shape.diagnostics ?? null)
          throw new Error(`Deposit transaction shape check failed: ${shape.reason}`)
        }
        setAaDepositDiagnostics(shape.diagnostics)
        appendEvent('paste_submit.deposit.shape_check=ok')
        setDepositTxHash(resolution.transactionHash)
        appendEvent(`paste_submit.deposit.tx=${resolution.transactionHash}`)
        setPageNotice(
          'Relay depository funding submitted via CSW wallet_sendCalls (EntryPoint path). Continue to step 5.',
        )
      } else {
        appendEvent('paste_submit.deposit.mode=eth_sendTransaction_fallback')
        const depositResult = (await request({
          method: 'eth_sendTransaction',
          params: [
            {
              from: ownerSignerAddress ?? undefined,
              to: preview.relay.userCall.to,
              data: preview.relay.userCall.data,
              value: preview.relay.userCall.value,
            },
          ],
        })) as string
        if (!depositResult || !/^0x([a-fA-F0-9]{64})$/.test(depositResult)) {
          throw new Error('Wallet did not return a valid Relay depository tx hash.')
        }
        const shape = await verifyAARelayDepositShape({
          publicClient,
          txHash: depositResult as `0x${string}`,
          cswAddress: canonicalCswAddress as `0x${string}`,
          expectedRequestId: preview.relay.requestId,
        })
        if (!shape.ok) {
          setAaDepositDiagnostics(shape.diagnostics ?? null)
          throw new Error(`Deposit transaction shape check failed: ${shape.reason}`)
        }
        setAaDepositDiagnostics(shape.diagnostics)
        appendEvent('paste_submit.deposit.shape_check=ok')
        setDepositTxHash(depositResult)
        appendEvent(`paste_submit.deposit.tx=${depositResult}`)
        if (publicClient) {
          await publicClient.waitForTransactionReceipt({ hash: depositResult as `0x${string}` })
          appendEvent('paste_submit.deposit.confirmed')
        }
        setPageNotice(
          'Relay depository funding transaction sent via direct wallet tx fallback. Continue to step 5.',
        )
      }
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
    setBusy(true)
    setPageError(null)
    setPageNotice(null)
    setLastErrorDetail(null)
    setSignerMismatch(null)
    setAaDepositDiagnostics(null)
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
      const quoteRes = await apiFetch('/api/relay/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...relayBody,
          amount: RELAY_EXECUTION_QUOTE_AMOUNT_WEI,
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
      const quotePayload = extractExecuteQuotePayload(quoteJson.data)
      if (!quotePayload) {
        throw new Error('Relay quote did not return requestId + deposit value for router execution.')
      }
      appendEvent(`paste_submit.quote.request_id=${quotePayload.requestId}`)
      appendEvent(`paste_submit.quote.tx_value_wei=${quotePayload.txValueWei}`)

      const depositValueHex = `0x${BigInt(quotePayload.txValueWei).toString(16)}` as `0x${string}`
      const depositCallData = preview.relay?.userCall?.data
      const quotedDepositCallData =
        typeof depositCallData === 'string' &&
        /^0x[0-9a-fA-F]+$/.test(depositCallData) &&
        depositCallData.startsWith('0x49290c1c')
          ? (`0x49290c1c000000000000000000000000${canonicalCswAddress.slice(2).toLowerCase()}${quotePayload.requestId.slice(2)}` as `0x${string}`)
          : preview.relay?.userCall?.data
      if (!quotedDepositCallData) {
        throw new Error('Missing Relay depository calldata for request-bound execution.')
      }

      appendEvent('paste_submit.deposit.execute_from_quote.start')
      const sendCallsResult = await _submitOwnerViaSendCalls({
        walletRequest: async (args) => await request(args),
        csw: canonicalCswAddress as `0x${string}`,
        calls: [
          {
            to: RELAY_DEPOSITORY_BASE,
            data: quotedDepositCallData as Hex,
            value: depositValueHex,
          },
        ],
        chainId: base.id,
        onTelemetry: (event) => {
          try {
            const detail =
              typeof event.detail === 'string' ? event.detail : JSON.stringify(event.detail)
            appendEvent(`paste_submit.execute.${event.step}: ${detail.slice(0, 280)}`)
          } catch {
            appendEvent(`paste_submit.execute.${event.step}: <unloggable>`)
          }
        },
      })
      const resolution = await waitForCallsTxHash({
        walletRequest: async (args) => await request(args),
        callBundleId: sendCallsResult.callBundleId,
        timeoutMs: 60_000,
        intervalMs: 1_500,
        onTelemetry: (event) => {
          try {
            const detail =
              typeof event.detail === 'string' ? event.detail : JSON.stringify(event.detail)
            appendEvent(`paste_submit.execute.${event.step}: ${detail.slice(0, 280)}`)
          } catch {
            appendEvent(`paste_submit.execute.${event.step}: <unloggable>`)
          }
        },
      })
      if (!resolution.transactionHash) {
        throw new Error(
          `wallet_sendCalls did not return on-chain tx hash for request ${quotePayload.requestId}.`,
        )
      }
      const shape = await verifyAARelayDepositShape({
        publicClient,
        txHash: resolution.transactionHash as `0x${string}`,
        cswAddress: canonicalCswAddress as `0x${string}`,
        expectedRequestId: quotePayload.requestId,
      })
      if (!shape.ok) {
        setAaDepositDiagnostics(shape.diagnostics ?? null)
        throw new Error(`Request-bound deposit transaction shape check failed: ${shape.reason}`)
      }
      setAaDepositDiagnostics(shape.diagnostics)
      appendEvent('paste_submit.execute.shape_check=ok')
      setDepositTxHash(resolution.transactionHash)
      setTxHash(null)
      setPageNotice(
        `Submitted request-bound Relay depository deposit via CSW sendCalls (tx ${resolution.transactionHash.slice(0, 10)}…). ` +
          `Relay Router will execute the paired multicall containing EntryPoint.handleOps for request ${quotePayload.requestId.slice(0, 10)}…` +
          (quotePayload.statusEndpoint ? ` Track status: ${quotePayload.statusEndpoint}` : ''),
      )
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
    // Belt-and-suspenders: refuse to submit if the displayed preview doesn't
    // match the currently-selected slot. With the fetchPreview request-id
    // guard this should be impossible, but if React batches a stale render
    // we'd rather abort than execute the wrong removal.
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
      // Self-auth lane: use EIP-5792 wallet_sendCalls. Base App's wallet
      // builds the UserOp internally, signs it locally with the on-device
      // passkey, and submits via its built-in bundler.
      //
      // The actual on-chain pattern (re-derived 2026-05-11 from the May 5
      // owner[3] reference flow) is two transactions in the same Base block:
      //   Part 1 — CSW UserOp (wallet_sendCalls) -> EntryPoint.handleOps ->
      //            CSW.executeBatch -> RelayDepository.depositNative
      //   Part 2 — Relay solver/bundler dispatches destination mutation via
      //            EntryPoint.handleOps for the same request id
      //
      // The user only signs Part 1. Relay infrastructure then dispatches
      // Part 2 when it sees the request-bound depository event.
      // So `calls[]` here is exactly ONE entry: the depository deposit tx.
      //
      // When the Relay quote failed (preview.relay is null), `calls[]` falls
      // back to the raw mutation calldata — but Base App's self-auth lane
      // cannot actually dispatch that without Relay routing, so the page
      // surfaces relayQuoteError before letting the user submit.
      if (isSelfAuthSession) {
        // ─────────────────────────────────────────────────────────────────────
        // RAW-CSW-CALL MODE (?raw=1 in the URL)
        //
        // Debug toggle that bypasses Relay entirely and sends the raw mutation
        // call (e.g. removeOwnerAtIndex) directly to the CSW via
        // wallet_sendCalls. Base App's wallet may recognize this as an
        // owner-management call and route it through its internal SDK —
        // producing a passkey-signed UserOp on the replayable channel,
        // matching the May 5 Part 2 wire format (see
        // 4626_csw_owner_mutation_compiled.html sections 5-6 for why this
        // is theoretically valid: CSW._isValidSignature dispatches on
        // wrapper.ownerIndex, and ownerIndex=0 routes to WebAuthn).
        //
        // If Base App's SDK has no special handling for owner mutations,
        // this will either fail loudly or produce a non-replayable UserOp
        // that hits the onlyEntryPoint guard. Either way it's a clean
        // signal we can read from the event log.
        // ─────────────────────────────────────────────────────────────────────
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
        let sendCallsCalls: Eip5792Call[]
        if (rawModeEnabled) {
          // Build the raw mutation call: just the destination call, no Relay
          // deposit wrapper. preview.txRequest.{to,data,value} carries the
          // raw mutation calldata the page would have used in the funder-EOA
          // lane; reuse it here.
          appendEvent('csw_wallet_sendcalls:mode=raw_csw_call')
          appendEvent(`raw:target=${preview.txRequest.to}`)
          appendEvent(`raw:selector=${preview.txRequest.data.slice(0, 10)}`)
          appendEvent(`raw:data_length=${(preview.txRequest.data.length - 2) / 2}`)
          sendCallsCalls = [
            {
              to: preview.txRequest.to,
              data: preview.txRequest.data,
              value: preview.txRequest.value,
            },
          ]
        } else {
          appendEvent('csw_wallet_sendcalls:mode=relay_orchestrated')
          // Non-null here because of the rawModeEnabled-aware guard above.
          const relay = preview.relay!
          appendEvent(`relay:request_id=${relay.requestId}`)
          appendEvent(`relay:user_call_to=${relay.userCall.to}`)
          appendEvent(`relay:user_call_value=${relay.userCall.value}`)
          if (relay.feeUsd) {
            appendEvent(`relay:fee_usd=${relay.feeUsd}`)
          }
          sendCallsCalls = preview.calls.map((c) => ({
            to: c.to,
            data: c.data,
            value: c.value,
          }))
        }
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
        // wallet_sendCalls returns a CALL-BUNDLE ID, not a tx hash. Poll
        // wallet_getCallsStatus until the wallet reports a real on-chain
        // transactionHash so the UI's Basescan link is valid. If the wallet
        // doesn't support getCallsStatus or we time out, fall back to
        // surfacing the bundle id with a note (no broken explorer link).
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
                `request id ${rid}… can also be tracked via Relay /intents/status.`,
            )
          }
        } else {
          // Bundle id resolved no tx hash within the poll window. Don't show
          // it as a Basescan link (that would 404); instead surface a clear
          // notice with the bundle id so the user can check Base App for
          // status manually.
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
                `/intents/status?requestId=${rid} for status.`,
            )
          }
        }
        setPreview(null)
        setSelectedIndex(null)
        return
      }

      // External-signer lane: sign the inner CSW UserOp (passkey or
      // session-key, depending on requirePasskey + wallet capabilities).
      // signOnly=true means we DO NOT submit to /api/relay/execute — we just
      // capture the signed handleOps calldata for the funder step.
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

      // Step 2 (external-signer lane only): ask Relay for a quote with the
      // funder EOA as `user` and the CSW as `recipient`. The funder
      // broadcasts the returned tx via plain eth_sendTransaction — no
      // wallet_prepareCalls required.
      //
      // Because we early-returned for self-auth above, ownerSignerAddress is
      // guaranteed here to be a distinct address from the CSW. But still
      // guard defensively.
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
            funder.
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
                {/* Identity + balances */}
                <div className="card rounded-2xl border border-white/10 bg-black/40 p-6 space-y-4">
                  <dl className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
                    <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                      <dt className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">
                        Canonical CSW
                      </dt>
                      <dd className="mt-1 break-all font-mono text-zinc-300">
                        {canonicalCswAddress}
                      </dd>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                      <dt className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">
                        Connected signer
                      </dt>
                      <dd className="mt-1 break-all font-mono text-zinc-300">
                        {ownerSignerAddress ?? 'not connected'}
                        {isSelfAuthSession ? (
                          <span className="ml-2 text-[10px] text-emerald-300">
                            self-auth
                          </span>
                        ) : null}
                      </dd>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                      <dt className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">
                        CSW ETH balance
                      </dt>
                      <dd className="mt-1 font-mono text-zinc-300">
                        {diagnostics.cswEthBalance == null
                          ? '—'
                          : `${formatEther(diagnostics.cswEthBalance)} ETH`}
                      </dd>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                      <dt className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">
                        Relay depository (aggregate)
                      </dt>
                      <dd className="mt-1 font-mono text-zinc-300">
                        {diagnostics.relayDepositoryEthBalance == null
                          ? '—'
                          : `${formatEther(diagnostics.relayDepositoryEthBalance)} ETH`}
                      </dd>
                    </div>
                  </dl>
                </div>

                {/* Live owner slot diagnostics */}
                <div className="card rounded-2xl border border-white/10 bg-black/40 p-6 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">
                      On-chain owner slots
                    </div>
                    {diagnostics.status === 'loading' ? (
                      <div className="text-[10px] text-zinc-500">loading…</div>
                    ) : diagnostics.status === 'error' ? (
                      <div className="text-[10px] text-rose-300">error</div>
                    ) : (
                      <div className="text-[10px] text-zinc-500">
                        count={diagnostics.ownerCount ?? '—'} · next=
                        {diagnostics.nextOwnerIndex ?? '—'}
                      </div>
                    )}
                  </div>

                  {diagnostics.status === 'error' ? (
                    <div className="rounded-xl border border-rose-400/25 bg-rose-500/10 p-3 text-xs text-rose-100">
                      {diagnostics.error}
                    </div>
                  ) : null}

                  {diagnostics.owners.length > 0 ? (
                    <ul className="space-y-1">
                      {diagnostics.owners.map((owner) => {
                        const isSelected = selectedIndex === owner.index
                        const isEmpty = owner.type === 'empty'
                        const isUnreadable = owner.type === 'unreadable'
                        const label =
                          owner.ownerAddress ??
                          (owner.type === 'passkey'
                            ? `passkey ${owner.ownerBytes.slice(0, 30)}…`
                            : isEmpty
                              ? '(empty slot)'
                              : isUnreadable
                                ? '(read failed — RPC error, slot may still be populated)'
                                : owner.ownerBytes.slice(0, 36) + '…')
                        return (
                          <li key={owner.index}>
                            <button
                              type="button"
                              disabled={isEmpty}
                              onClick={() => !isEmpty && handleSelectIndex(owner.index)}
                              className={`flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2 text-xs font-mono ${
                                isEmpty
                                  ? 'border-white/5 bg-black/20 text-zinc-600 cursor-not-allowed'
                                  : isUnreadable
                                    ? isSelected
                                      ? 'border-amber-400/40 bg-amber-500/10 text-amber-100'
                                      : 'border-amber-400/25 bg-amber-500/5 text-amber-100/80 hover:border-amber-300/60'
                                    : isSelected
                                      ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-100'
                                      : 'border-white/10 bg-black/30 text-zinc-300 hover:border-white/25'
                              }`}
                              title={owner.readError ?? undefined}
                            >
                              <span className="min-w-0 truncate">
                                <span className="text-[10px] mr-2">[{owner.index}]</span>
                                <span>{label}</span>
                              </span>
                              <span className="text-[10px] text-zinc-500 shrink-0">
                                {owner.type}
                              </span>
                            </button>
                            {isUnreadable && owner.readError ? (
                              <div className="mt-1 text-[10px] text-amber-200/70 px-1">
                                read error: {owner.readError.slice(0, 120)}
                              </div>
                            ) : null}
                          </li>
                        )
                      })}
                    </ul>
                  ) : diagnostics.status === 'ready' ? (
                    <div className="text-xs text-zinc-500">No owner slots found.</div>
                  ) : null}

                  <p className="text-[11px] leading-relaxed text-zinc-500">
                    Coinbase Wallet&apos;s self-auth <code className="font-mono">
                    personal_sign</code> returns a signature wrapped at a specific
                    owner index based on its client-side session state. If that
                    index points at an empty slot above, the UserOp will fail
                    on-chain validation regardless of which lane submits it.
                  </p>
                </div>

                {/* Preview + submit */}
                <div className="card rounded-2xl border border-white/10 bg-black/40 p-6 space-y-4">
                  {previewLoading ? (
                    <div className="rounded-xl border border-white/10 bg-black/30 p-3 text-xs text-zinc-400">
                      Building remove preview…
                    </div>
                  ) : null}

                  {preview ? (
                    <div className="rounded-xl border border-white/10 bg-black/30 p-3 text-xs space-y-2">
                      <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">
                        Preview
                      </div>
                      <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <div>
                          <dt className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">
                            Selected function
                          </dt>
                          <dd className="mt-0.5 font-mono text-zinc-200">
                            {preview.preflight.selectedFunction}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">
                            Chosen by
                          </dt>
                          <dd className="mt-0.5 font-mono text-zinc-200">
                            {preview.preflight.selectedBy ?? 'heuristic'}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">
                            Target index
                          </dt>
                          <dd className="mt-0.5 font-mono text-zinc-200">
                            {preview.preflight.targetOwnerIndex}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">
                            Simulation
                          </dt>
                          <dd className="mt-0.5 font-mono">
                            {preview.preflight.simulation.ok ? (
                              <span className="text-emerald-300">ok</span>
                            ) : (
                              <span className="text-rose-300">
                                reverted:{' '}
                                {preview.preflight.simulation.error ?? 'unknown'}
                              </span>
                            )}
                          </dd>
                        </div>
                      </dl>
                      {preview.preflight.targetOwnerAddress ? (
                        <div className="text-[11px] text-zinc-400 break-all">
                          Removing:{' '}
                          <span className="font-mono text-zinc-300">
                            {preview.preflight.targetOwnerAddress}
                          </span>
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="space-y-3">
                    <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-3 text-[11px] text-emerald-100 space-y-2">
                      <div>
                        <div className="text-[10px] uppercase tracking-[0.18em] text-emerald-200/80">
                          Recommended lane
                        </div>
                        <div className="text-xs font-medium text-emerald-100">
                          Keys passkey flow
                        </div>
                      </div>
                      <p className="text-[10px] text-emerald-100/80">
                        Complete steps in order. Submit unlocks after payload validation and relay deposit.
                      </p>
                      <div className="space-y-2 rounded-xl border border-white/15 bg-black/30 p-2.5">
                        <div className="flex items-center justify-between text-xs">
                          <span>Step 1. Select owner slot</span>
                          <span className={preview ? 'text-emerald-300' : 'text-zinc-500'}>
                            {preview ? 'done' : 'pending'}
                          </span>
                        </div>
                        <div className="flex flex-col gap-2 text-xs sm:flex-row sm:items-center sm:justify-between">
                          <span>Step 2. Generate keys snippet</span>
                          <button
                            type="button"
                            disabled={
                              !preview ||
                              busy ||
                              previewLoading ||
                              !preview?.preflight.simulation.ok ||
                              !signerOwnerIndexValidation.ok
                            }
                            onClick={() => void handlePrepareKeysCoinbasePaste()}
                            className="btn-accent btn-no-icon inline-flex w-full sm:w-auto"
                          >
                            {busy ? 'Preparing...' : 'Generate snippet'}
                          </button>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span>Step 3. Paste signed JSON payload</span>
                          <span
                            className={
                              pasteValidation == null
                                ? 'text-zinc-500'
                                : pasteValidation.ok
                                  ? 'text-emerald-300'
                                  : 'text-rose-300'
                            }
                          >
                            {pasteValidation == null
                              ? 'pending'
                              : pasteValidation.ok
                                ? 'valid'
                                : 'invalid'}
                          </span>
                        </div>
                        <div className="rounded-lg border border-white/10 bg-black/35 p-2 space-y-2">
                          <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">
                            Passkey signer slot
                          </div>
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                            <label className="text-[10px] text-zinc-400">Owner index used in signature wrapper</label>
                            <input
                              type="number"
                              min={0}
                              step={1}
                              value={signingOwnerIndex}
                              onChange={(e) => {
                                const parsed = Number(e.target.value)
                                if (!Number.isFinite(parsed) || parsed < 0) return
                                setSigningOwnerIndex(Math.floor(parsed))
                              }}
                              className="w-24 rounded-lg border border-white/15 bg-black/40 px-2 py-1 font-mono text-[11px] text-zinc-200"
                            />
                            <select
                              value={signingOwnerIndex}
                              onChange={(e) => setSigningOwnerIndex(Number(e.target.value))}
                              className="rounded-lg border border-white/15 bg-black/40 px-2 py-1 text-[11px] text-zinc-200"
                            >
                              {diagnostics.owners.filter((owner) => owner.type !== 'empty').length === 0 ? (
                                <option value={signingOwnerIndex}>[{signingOwnerIndex}] manual</option>
                              ) : null}
                              {diagnostics.owners
                                .filter((owner) => owner.type !== 'empty')
                                .map((owner) => (
                                  <option key={owner.index} value={owner.index}>
                                    [{owner.index}] {owner.type}
                                    {owner.ownerAddress ? ` ${owner.ownerAddress.slice(0, 8)}…` : ''}
                                  </option>
                                ))}
                            </select>
                          </div>
                          <div
                            className={`text-[10px] ${
                              signerOwnerIndexValidation.ok ? 'text-emerald-300' : 'text-rose-300'
                            }`}
                          >
                            {signerOwnerIndexValidation.message}
                          </div>
                        </div>
                        {pasteFlow ? (
                          <>
                            <label className="text-[10px] uppercase tracking-[0.18em] text-emerald-200/80">
                              Keys snippet
                            </label>
                            <div className="text-[10px] text-zinc-400">
                              Prepared for signer owner slot [{pasteFlow.signerOwnerIndex}].
                            </div>
                            <textarea
                              readOnly
                              rows={7}
                              value={pasteFlow.snippet}
                              className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 font-mono text-[10px] text-zinc-200"
                            />
                            <button
                              type="button"
                              className="rounded-lg border border-white/20 bg-black/30 px-3 py-1.5 text-[11px] text-zinc-200 hover:border-white/35"
                              onClick={() => {
                                void navigator.clipboard.writeText(pasteFlow.snippet).catch(() => {})
                              }}
                            >
                              Copy keys.coinbase.com snippet
                            </button>
                            <textarea
                              rows={5}
                              value={pasteResponse}
                              onChange={(e) => setPasteResponse(e.target.value)}
                              placeholder="Paste the JSON output from keys.coinbase.com here"
                              className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 font-mono text-[11px] text-zinc-200 placeholder:text-zinc-500"
                            />
                            {pasteValidation ? (
                              <div
                                className={`rounded-lg border px-2 py-1 text-[10px] ${
                                  pasteValidation.ok
                                    ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200'
                                    : 'border-rose-400/30 bg-rose-500/10 text-rose-200'
                                }`}
                              >
                                {pasteValidation.message}
                              </div>
                            ) : null}
                          </>
                        ) : null}
                        <div className="flex flex-col gap-2 text-xs sm:flex-row sm:items-center sm:justify-between">
                          <span>Step 4. Send relay depository tx</span>
                          <button
                            type="button"
                            disabled={
                              busy ||
                              !preview?.relay?.userCall ||
                              !pasteFlow ||
                              !pasteValidation?.ok ||
                              !signerOwnerIndexValidation.ok ||
                              Boolean(depositTxHash)
                            }
                            onClick={() => void handleFundRelayDepositForPasteLane()}
                            className="rounded-lg border border-white/20 bg-black/30 px-3 py-1.5 text-[11px] text-zinc-200 hover:border-white/35 disabled:opacity-60 w-full sm:w-auto"
                          >
                            {depositTxHash ? 'Deposit sent' : busy ? 'Sending...' : 'Send deposit tx'}
                          </button>
                        </div>
                        <div className="flex flex-col gap-2 text-xs sm:flex-row sm:items-center sm:justify-between">
                          <span>Step 5. Quote + execute request-bound deposit</span>
                          <button
                            type="button"
                            disabled={
                              busy ||
                              !pasteFlow ||
                              !pasteValidation?.ok ||
                              !signerOwnerIndexValidation.ok
                            }
                            onClick={() => void handleSubmitKeysCoinbasePaste()}
                            className="btn-accent btn-no-icon inline-flex w-full sm:w-auto"
                          >
                            {busy ? 'Submitting...' : 'Submit owner removal'}
                          </button>
                        </div>
                      </div>
                    </div>

                    <details className="rounded-xl border border-white/10 bg-black/30 p-3 text-[11px] text-zinc-300">
                      <summary className="cursor-pointer text-[10px] uppercase tracking-[0.18em] text-zinc-500">
                        Advanced troubleshooting lanes
                      </summary>
                      <div className="mt-3 space-y-3">
                        <label className="flex items-start gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          className="mt-0.5"
                          checked={requirePasskey}
                          onChange={(e) => {
                            setRequirePasskey(e.target.checked)
                            setSignerMismatch(null)
                          }}
                          disabled={busy}
                        />
                        <span>
                          <span className="text-zinc-200 font-medium">
                            Sign with passkey owner slot
                          </span>
                          <span className="block text-[10px] text-zinc-500 mt-0.5">
                            Keeps signature checks strict for this fallback path.
                          </span>
                        </span>
                        </label>

                        {isSelfAuthSession ? (
                          <div className="rounded-xl border border-emerald-400/25 bg-emerald-500/5 p-3 text-[11px] text-emerald-100/85 space-y-1">
                            <div className="text-[10px] uppercase tracking-[0.18em] text-emerald-200/70">
                              EIP-5792 wallet_sendCalls lane
                            </div>
                            <p className="leading-relaxed">
                              Base App builds the UserOp from this call, signs it
                              locally with the on-device passkey, and submits via
                              its built-in bundler. The CSW pays its own gas from
                              its EntryPoint deposit.
                            </p>
                          </div>
                        ) : null}

                        <button
                          type="button"
                          disabled={
                            busy ||
                            !preview ||
                            previewLoading ||
                            ((inAppEnv?.isAnyWalletInApp ?? false) && !isSelfAuthSession) ||
                            (preview ? !preview.preflight.simulation.ok : false)
                          }
                          onClick={() => void handleRemove()}
                          className="inline-flex rounded-xl border border-white/25 bg-black/40 px-4 py-2 text-sm text-zinc-200 hover:border-white/40 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {busy
                            ? isSelfAuthSession
                              ? 'Submitting via wallet_sendCalls…'
                              : requirePasskey
                                ? 'Removing via passkey + Relay UserOp…'
                                : 'Removing via session-key + Relay UserOp…'
                            : isSelfAuthSession
                              ? `Remove owner at index ${preview?.preflight.targetOwnerIndex ?? '?'} via wallet_sendCalls`
                              : inAppEnv?.isAnyWalletInApp && !isSelfAuthSession
                                ? 'Open in browser to remove'
                                : !preview
                                  ? 'Select an owner above first'
                                  : `Remove owner at index ${preview.preflight.targetOwnerIndex} via Relay UserOp`}
                        </button>
                      </div>
                    </details>
                  </div>

                  {txHash ? (
                    <div className="rounded-xl border border-emerald-400/25 bg-emerald-500/10 p-3 text-xs text-emerald-100 break-all">
                      Submitted:{' '}
                      <a
                        href={`https://basescan.org/tx/${txHash}`}
                        target="_blank"
                        rel="noreferrer"
                        className="font-mono underline"
                      >
                        {txHash}
                      </a>
                    </div>
                  ) : null}

                  {depositTxHash ? (
                    <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/5 p-3 text-xs text-emerald-100 break-all">
                      Relay depository funding tx:{' '}
                      <a
                        href={`https://basescan.org/tx/${depositTxHash}`}
                        target="_blank"
                        rel="noreferrer"
                        className="font-mono underline"
                      >
                        {depositTxHash}
                      </a>
                    </div>
                  ) : null}

                  <div
                    className={`rounded-xl border p-3 text-xs ${
                      patternLockStatus.state === 'locked'
                        ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-100'
                        : patternLockStatus.state === 'unlocked'
                          ? 'border-rose-400/30 bg-rose-500/10 text-rose-100'
                          : 'border-white/10 bg-black/30 text-zinc-300'
                    }`}
                  >
                    <div className="text-[10px] uppercase tracking-[0.18em] opacity-80">AA Pattern</div>
                    <div className="mt-1 font-semibold">{patternLockStatus.label}</div>
                    <div className="mt-1 text-[11px] opacity-90">{patternLockStatus.detail}</div>
                  </div>

                  {aaDepositDiagnostics ? (
                    <div className="rounded-xl border border-cyan-400/25 bg-cyan-500/5 p-3 text-[11px] text-cyan-100 space-y-2">
                      <div className="text-[10px] uppercase tracking-[0.18em] text-cyan-200/80">
                        AA Deposit Diagnostics
                      </div>
                      <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <div>
                          <dt className="text-[10px] text-cyan-200/70">tx hash</dt>
                          <dd className="font-mono break-all">{aaDepositDiagnostics.txHash}</dd>
                        </div>
                        <div>
                          <dt className="text-[10px] text-cyan-200/70">block</dt>
                          <dd className="font-mono">{aaDepositDiagnostics.blockNumber.toString()}</dd>
                        </div>
                        <div>
                          <dt className="text-[10px] text-cyan-200/70">userOp hash</dt>
                          <dd className="font-mono break-all">{aaDepositDiagnostics.userOpHash ?? 'n/a'}</dd>
                        </div>
                        <div>
                          <dt className="text-[10px] text-cyan-200/70">userOp nonce</dt>
                          <dd className="font-mono">
                            {aaDepositDiagnostics.userOpNonce != null
                              ? aaDepositDiagnostics.userOpNonce.toString()
                              : 'n/a'}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-[10px] text-cyan-200/70">userOp success</dt>
                          <dd className="font-mono">
                            {aaDepositDiagnostics.userOpSuccess == null
                              ? 'n/a'
                              : aaDepositDiagnostics.userOpSuccess
                                ? 'true'
                                : 'false'}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-[10px] text-cyan-200/70">actual gas used</dt>
                          <dd className="font-mono">
                            {aaDepositDiagnostics.actualGasUsed != null
                              ? aaDepositDiagnostics.actualGasUsed.toString()
                              : 'n/a'}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-[10px] text-cyan-200/70">actual gas cost (wei)</dt>
                          <dd className="font-mono">
                            {aaDepositDiagnostics.actualGasCostWei != null
                              ? aaDepositDiagnostics.actualGasCostWei.toString()
                              : 'n/a'}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-[10px] text-cyan-200/70">actual gas cost (ETH)</dt>
                          <dd className="font-mono">
                            {aaDepositDiagnostics.actualGasCostWei != null
                              ? formatEther(aaDepositDiagnostics.actualGasCostWei)
                              : 'n/a'}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-[10px] text-cyan-200/70">relay deposit from</dt>
                          <dd className="font-mono break-all">{aaDepositDiagnostics.relayDepositFrom ?? 'n/a'}</dd>
                        </div>
                        <div>
                          <dt className="text-[10px] text-cyan-200/70">relay deposit amount (wei)</dt>
                          <dd className="font-mono">
                            {aaDepositDiagnostics.relayDepositAmountWei != null
                              ? aaDepositDiagnostics.relayDepositAmountWei.toString()
                              : 'n/a'}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-[10px] text-cyan-200/70">relay deposit amount (ETH)</dt>
                          <dd className="font-mono">
                            {aaDepositDiagnostics.relayDepositAmountWei != null
                              ? formatEther(aaDepositDiagnostics.relayDepositAmountWei)
                              : 'n/a'}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-[10px] text-cyan-200/70">requestId (deposit)</dt>
                          <dd className="font-mono break-all">
                            {aaDepositDiagnostics.relayDepositRequestId ?? 'n/a'}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-[10px] text-cyan-200/70">requestId (expected)</dt>
                          <dd className="font-mono break-all">{aaDepositDiagnostics.expectedRequestId}</dd>
                        </div>
                      </dl>
                      <div className="grid grid-cols-1 gap-1 sm:grid-cols-3">
                        <div className="font-mono text-[10px]">
                          entrypoint userOp:{' '}
                          <span className={aaDepositDiagnostics.checks.hasEntryPointUserOpForCsw ? 'text-emerald-300' : 'text-rose-300'}>
                            {aaDepositDiagnostics.checks.hasEntryPointUserOpForCsw ? 'ok' : 'missing'}
                          </span>
                        </div>
                        <div className="font-mono text-[10px]">
                          relay deposit:{' '}
                          <span className={aaDepositDiagnostics.checks.hasRelayDepositForCsw ? 'text-emerald-300' : 'text-rose-300'}>
                            {aaDepositDiagnostics.checks.hasRelayDepositForCsw ? 'ok' : 'missing'}
                          </span>
                        </div>
                        <div className="font-mono text-[10px]">
                          request match:{' '}
                          <span className={aaDepositDiagnostics.checks.requestIdMatches ? 'text-emerald-300' : 'text-rose-300'}>
                            {aaDepositDiagnostics.checks.requestIdMatches ? 'ok' : 'mismatch'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {pageNotice ? (
                    <div className="rounded-xl border border-emerald-400/25 bg-emerald-500/10 p-3 text-xs text-emerald-100">
                      {pageNotice}
                    </div>
                  ) : null}

                  {pageError ? (
                    <div className="rounded-xl border border-rose-400/25 bg-rose-500/10 p-3 text-xs text-rose-100 break-all">
                      {pageError}
                    </div>
                  ) : null}

                  {signerMismatch ? (
                    <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 p-3 text-[11px] text-amber-100 space-y-2">
                      <div className="text-[10px] uppercase tracking-[0.18em] text-amber-200/80">
                        Signer not installed on CSW
                      </div>
                      <p className="leading-relaxed">
                        The signature your wallet returned recovers to an
                        address that&apos;s not stored at any owner slot on this
                        CSW. Coinbase Wallet&apos;s self-auth session key has
                        likely rotated and the new key isn&apos;t installed. The
                        EntryPoint will reject this UserOp with{' '}
                        <code className="font-mono">AA24 signature error</code>.
                      </p>
                      <div className="space-y-1 font-mono break-all">
                        {signerMismatch.recoveredRaw ? (
                          <div>
                            <span className="text-[10px] text-amber-200/60">recovered (raw): </span>
                            {signerMismatch.recoveredRaw}
                          </div>
                        ) : null}
                        {signerMismatch.recoveredEip191 ? (
                          <div>
                            <span className="text-[10px] text-amber-200/60">recovered (eip-191): </span>
                            {signerMismatch.recoveredEip191}
                          </div>
                        ) : null}
                        {signerMismatch.claimedOwnerIndex != null ? (
                          <div>
                            <span className="text-[10px] text-amber-200/60">wrapper claimed ownerIndex: </span>
                            {signerMismatch.claimedOwnerIndex}
                          </div>
                        ) : null}
                      </div>
                      <p className="text-[10px] text-amber-200/80 leading-relaxed">
                        Recommended fix: enable the “Sign with passkey” toggle
                        above and retry. Owner[0] is a passkey, which uses
                        WebAuthn (not personal_sign) and is unaffected by
                        session-key rotation.
                      </p>
                    </div>
                  ) : null}

                  {lastErrorDetail ? (
                    <div className="rounded-xl border border-rose-400/25 bg-rose-500/5 p-3 text-[11px] text-rose-100 space-y-2">
                      <div className="text-[10px] uppercase tracking-[0.18em] text-rose-200/70">
                        Relay revert detail
                      </div>
                      {lastErrorDetail.revertReason ? (
                        <div>
                          <div className="text-[10px] text-rose-200/60">reason</div>
                          <div className="font-mono break-all">{lastErrorDetail.revertReason}</div>
                        </div>
                      ) : null}
                      {lastErrorDetail.revertData ? (
                        <div>
                          <div className="text-[10px] text-rose-200/60">revert data (first 4 bytes = AA selector)</div>
                          <div className="font-mono break-all">{lastErrorDetail.revertData}</div>
                        </div>
                      ) : null}
                      {lastErrorDetail.relayTx ? (
                        <details>
                          <summary className="cursor-pointer text-[10px] text-rose-200/60">relay tx blob</summary>
                          <pre className="mt-1 whitespace-pre-wrap break-all font-mono text-[10px]">
{JSON.stringify(lastErrorDetail.relayTx, null, 2)}
                          </pre>
                        </details>
                      ) : null}
                      {lastErrorDetail.rawBody ? (
                        <details>
                          <summary className="cursor-pointer text-[10px] text-rose-200/60">raw response (first 2k chars)</summary>
                          <pre className="mt-1 whitespace-pre-wrap break-all font-mono text-[10px]">
{lastErrorDetail.rawBody}
                          </pre>
                        </details>
                      ) : null}
                    </div>
                  ) : null}

                  {eventLog.length > 0 ? (
                    <details className="rounded-xl border border-white/10 bg-black/30 p-3 text-[11px] text-zinc-300">
                      <summary className="cursor-pointer text-[10px] uppercase tracking-[0.18em] text-zinc-500">
                        Lane events ({eventLog.length})
                      </summary>
                      <div className="mt-2 whitespace-pre-wrap break-all font-mono text-[10px]">
                        {eventLog.join('\n')}
                      </div>
                    </details>
                  ) : null}
                </div>
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
