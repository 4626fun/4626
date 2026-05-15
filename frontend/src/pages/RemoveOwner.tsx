import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { usePublicClient, useWalletClient } from 'wagmi'
import { base } from 'viem/chains'
import { type PublicClient } from 'viem'

import { PageMeta } from '@/components/seo/PageMeta'
import { RemoveOwnerActionPanel } from '@/features/accountSetup/removeOwner/RemoveOwnerActionPanel'
import { useAccountSetupController } from '@/features/accountSetup/useAccountSetupController'
import { RemoveOwnerOwnerSlotsCard } from '@/features/accountSetup/removeOwner/RemoveOwnerOwnerSlotsCard'
import { detectInAppEnvironment, externalBrowserUrlFor } from '@/lib/wallet/inAppBrowser'
import { apiFetch } from '@/lib/api/apiBase'
import { _submitOwnerViaSendCalls, waitForCallsTxHash } from '@/lib/wallet/cswSendCalls'
import * as RemoveOwnerHelpers from '@/lib/removeOwner/removeOwnerHelpers'

// Relay Protocol's depository on Base. Reference tx where this CSW deposited:
// https://basescan.org/tx/0x34edd28dd9611f4e06374dfe87645de4fc3fd94c83f96b5b1406c6ee10d2aadf
// (UserOp executeBatch -> RelayDepository.depositNative(depositor, id))
const RELAY_DEPOSITORY_BASE = RemoveOwnerHelpers.RELAY_DEPOSITORY_BASE
type AADepositDiagnostics = RemoveOwnerHelpers.AADepositDiagnostics
type RemoveOwnerPreview = RemoveOwnerHelpers.RemoveOwnerPreview
type OnchainOwnerRow = RemoveOwnerHelpers.OnchainOwnerRow
type LiveDiagnostics = RemoveOwnerHelpers.LiveDiagnostics

const normalizeRelayStatusEndpoint = RemoveOwnerHelpers.normalizeRelayStatusEndpoint
const validatePreviewRelayUserCallIsNativeDepository =
  RemoveOwnerHelpers.validatePreviewRelayUserCallIsNativeDepository
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
  const [aaDepositDiagnostics, setAaDepositDiagnostics] = useState<AADepositDiagnostics | null>(null)
  const [eventLog, setEventLog] = useState<string[]>([])
  const [lastErrorDetail, setLastErrorDetail] = useState<{
    revertReason: string | null
    revertData: string | null
    relayTx: unknown
    rawBody: string | null
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

  const isSelfAuthSession = useMemo(() => {
    if (!canonicalCswAddress || !ownerSignerAddress) return false
    return ownerSignerAddress.toLowerCase() === canonicalCswAddress.toLowerCase()
  }, [canonicalCswAddress, ownerSignerAddress])
  const strictTraceEnabled = useMemo(() => {
    if (typeof window === 'undefined') return false
    return new URLSearchParams(window.location.search).get('strictTrace') === '1'
  }, [])

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

  const fetchPreview = async (index: number) => {
    if (!canonicalCswAddress || !ownerSignerAddress) {
      setPageError('Connect a wallet that owns this CSW (or the CSW itself) first.')
      return
    }
    const requestId = ++previewRequestIdRef.current
    setPreviewLoading(true)
    setPageError(null)
    setLastErrorDetail(null)
    setPageNotice(null)
    setPreview(null)
    setTxHash(null)
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

  const setRelayErrorDetail = (input: { revertReason?: string | null; revertData?: string | null }) => {
    setLastErrorDetail({
      revertReason: input.revertReason ?? null,
      revertData: input.revertData ?? null,
      relayTx: null,
      rawBody: null,
    })
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
    setPageNotice(null)
    setTxHash(null)
    setEventLog([])
    appendEvent('lane:csw_wallet_sendcalls')
    appendEvent(`target:function=${preview.preflight.selectedFunction}`)
    appendEvent(`target:index=${preview.preflight.targetOwnerIndex}`)
    appendEvent(`target:owner=${preview.preflight.targetOwnerAddress ?? '<bytes>'}`)
    appendEvent(`session:${isSelfAuthSession ? 'self_auth' : 'external_signer'}`)
    try {
      if (!isSelfAuthSession) {
        throw new Error('Remove owner is currently limited to CSW self-auth sessions.')
      }
      if (!preview.relay) {
        throw new Error(
          preview.preflight.relayQuoteError ??
            'Relay quote unavailable; self-auth submission requires Relay orchestration.',
        )
      }
      const relayGuard = validatePreviewRelayUserCallIsNativeDepository(preview)
      if (relayGuard) {
        throw new Error(`Relay preview guard failed: ${relayGuard}.`)
      }
      appendEvent('csw_wallet_sendcalls:start')
      appendEvent('csw_wallet_sendcalls:mode=relay_orchestrated')
      appendEvent(`relay:request_id=${preview.relay.requestId}`)
      appendEvent(`relay:user_call_to=${preview.relay.userCall.to}`)
      appendEvent(`relay:user_call_value=${preview.relay.userCall.value}`)
      appendEvent(`relay:user_call_selector=${preview.relay.userCall.data.slice(0, 10)}`)
      if (preview.relay.feeUsd) {
        appendEvent(`relay:fee_usd=${preview.relay.feeUsd}`)
      }

      const sendCallsResult = await _submitOwnerViaSendCalls({
        walletRequest: async (args) => await request(args),
        csw: canonicalCswAddress as `0x${string}`,
        calls: preview.calls.map((call) => ({
          to: call.to,
          data: call.data,
          value: call.value,
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
              setRelayErrorDetail({
                revertReason: (d.error as string | null) ?? null,
                revertData: (d.revertData as string | null) ?? null,
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
      if (!resolution.transactionHash) {
        setTxHash(null)
        setPageNotice(
          `wallet_sendCalls submitted (bundle id ${sendCallsResult.callBundleId}). ` +
            `Wallet did not surface an on-chain tx hash within 60s. ` +
            `Relay request id ${preview.relay.requestId.slice(0, 10)}… can be polled at ` +
            `${normalizeRelayStatusEndpoint(null, preview.relay.requestId)}.`,
        )
        return
      }

      setTxHash(resolution.transactionHash)
      const shape = await verifyAARelayDepositShape({
        publicClient,
        txHash: resolution.transactionHash as `0x${string}`,
        cswAddress: canonicalCswAddress as `0x${string}`,
        expectedRequestId: preview.relay.requestId,
        strictTrace: strictTraceEnabled,
      })
      if (!shape.ok) {
        setAaDepositDiagnostics(shape.diagnostics ?? null)
        throw new Error(`Deposit transaction shape check failed: ${shape.reason}`)
      }
      setAaDepositDiagnostics(shape.diagnostics)
      appendEvent('csw_wallet_sendcalls.shape_check=ok')
      setPageNotice(
        `Relay deposit submitted on-chain (tx ${resolution.transactionHash.slice(0, 10)}…). ` +
          `Relay will execute owner removal for request ${preview.relay.requestId.slice(0, 10)}….`,
      )
      setPreview(null)
      setSelectedIndex(null)
    } catch (err: any) {
      if (err && typeof err === 'object') {
        const revertDataCandidate =
          typeof err.data === 'string' ? err.data : typeof err.revertData === 'string' ? err.revertData : null
        if (revertDataCandidate || typeof err.shortMessage === 'string') {
          setRelayErrorDetail({
            revertReason:
              typeof err.shortMessage === 'string'
                ? err.shortMessage
                : typeof err.message === 'string'
                  ? err.message
                  : null,
            revertData: revertDataCandidate,
          })
        }
      }
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
                  isSelfAuthSession={isSelfAuthSession}
                  inAppEnv={inAppEnv ? { isAnyWalletInApp: Boolean(inAppEnv.isAnyWalletInApp) } : null}
                  handleRemove={handleRemove}
                  txHash={txHash}
                  patternLockStatus={patternLockStatus}
                  strictTraceEnabled={strictTraceEnabled}
                  aaDepositDiagnostics={aaDepositDiagnostics}
                  pageNotice={pageNotice}
                  pageError={pageError}
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
