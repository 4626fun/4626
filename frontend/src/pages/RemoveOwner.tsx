import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { usePublicClient, useWalletClient } from 'wagmi'
import { base } from 'viem/chains'
import { formatEther, type Hex, type PublicClient } from 'viem'

import { PageMeta } from '@/components/seo/PageMeta'
import { useAccountSetupController } from '@/features/accountSetup/useAccountSetupController'
import { detectInAppEnvironment, externalBrowserUrlFor } from '@/lib/wallet/inAppBrowser'
import { apiFetch } from '@/lib/api/apiBase'
import { _submitOwnerViaSelfBuiltUserOp } from '@/lib/wallet/onboardingWallet'
import { _submitOwnerViaFunderEoa } from '@/lib/wallet/relayFunderEoaSubmit'
import { _submitOwnerViaCswSelfCall } from '@/lib/wallet/cswSelfCallSubmit'

// Relay Protocol's depository on Base. Reference tx where this CSW deposited:
// https://basescan.org/tx/0x34edd28dd9611f4e06374dfe87645de4fc3fd94c83f96b5b1406c6ee10d2aadf
// (UserOp executeBatch -> RelayDepository.depositNative(depositor, id))
const RELAY_DEPOSITORY_BASE = '0x4cd00e387622c35bddb9b4c962c136462338bc31' as const

type RemoveOwnerPreview = {
  txRequest: {
    chainId: 8453
    to: `0x${string}`
    data: `0x${string}`
    value: '0x0'
  }
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
  }
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
 *     Relay's solver may require a pre-deposit before executing handleOps)
 *
 * Reference txs that defined this lane:
 *   - https://basescan.org/tx/0x34edd28dd9611f4e06374dfe87645de4fc3fd94c83f96b5b1406c6ee10d2aadf
 *     (CSW UserOp executeBatch → RelayDepository.depositNative; pre-fund step)
 *   - https://basescan.org/tx/0xa9a06340a7725063f1dd9b0a29af6c72f4fbfe3a408b28dd28e2fd2db7649a36
 *     (Relay solver → RelayRouter.multicall → EntryPoint.handleOps → CSW
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
  const [eventLog, setEventLog] = useState<string[]>([])
  const [lastErrorDetail, setLastErrorDetail] = useState<{
    revertReason: string | null
    revertData: string | null
    relayTx: unknown
    rawBody: string | null
  } | null>(null)
  // Default to passkey-only signing. Self-auth ECDSA via Coinbase Wallet's
  // `personal_sign` is documented to silently return signatures from rotated
  // session keys that are no longer installed as owners on the CSW — the
  // SignatureWrapper claims an ownerIndex but the ECDSA actually recovers to
  // an address that doesn't match the bytes stored at that slot, so EntryPoint
  // reverts with AA24 inside Relay's solver simulation. Passkey (owner[0])
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

  const isSelfAuthSession = useMemo(() => {
    if (!canonicalCswAddress || !ownerSignerAddress) return false
    return ownerSignerAddress.toLowerCase() === canonicalCswAddress.toLowerCase()
  }, [canonicalCswAddress, ownerSignerAddress])

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
    setTxHash(null)
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
    appendEvent(`lane:${isSelfAuthSession ? 'csw_self_call' : 'relay_funder_eoa_two_step'}`)
    appendEvent(`target:function=${preview.preflight.selectedFunction}`)
    appendEvent(`target:index=${preview.preflight.targetOwnerIndex}`)
    appendEvent(`target:owner=${preview.preflight.targetOwnerAddress ?? '<bytes>'}`)
    appendEvent(`session:${isSelfAuthSession ? 'self_auth' : 'external_signer'}`)
    appendEvent(`signing:require_passkey=${requirePasskey}`)
    try {
      // Branch on session kind.
      //
      // SELF-AUTH lane: the connected wallet IS the CSW itself (e.g. Base App
      // signed in as the smart wallet). We use a plain eth_sendTransaction
      // from CSW to CSW with the inner executeWithoutChainIdValidation
      // payload. Base App's native handler recognises the self-call shape,
      // signs locally with the on-device passkey, and submits via its own
      // bundler — no wallet_prepareCalls popup, no keys.coinbase.com round
      // trip. The CSW pays its own gas from its native balance.
      //
      // EXTERNAL-SIGNER lane: a distinct EOA wallet is connected (e.g. via
      // WalletConnect from a hot wallet that owns the CSW). We sign the
      // inner UserOp client-side, then route through Relay's quote +
      // funder-EOA broadcast so the connected wallet pays gas as a normal
      // EOA tx.
      if (isSelfAuthSession) {
        appendEvent('csw_self_call:start')
        const selfCallResult = await _submitOwnerViaCswSelfCall({
          walletRequest: async (args) => await request(args),
          csw: canonicalCswAddress as `0x${string}`,
          innerCallData: preview.txRequest.data as Hex,
          onTelemetry: (event) => {
            try {
              const detail =
                typeof event.detail === 'string'
                  ? event.detail
                  : JSON.stringify(event.detail)
              const cap = event.step.includes('error') ? 4000 : 240
              appendEvent(`csw_self_call.${event.step}: ${detail.slice(0, cap)}`)
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
              appendEvent(`csw_self_call.${event.step}: <unloggable>`)
            }
          },
        })
        setTxHash(selfCallResult.funderTxHash)
        setPageNotice(
          `Submitted self-call to remove owner[${preview.preflight.targetOwnerIndex}]. ` +
            `Tx broadcast by Base App; the CSW pays its own gas. Watch Basescan for confirmation.`,
        )
        setPreview(null)
        setSelectedIndex(null)
        return
      }

      // Step 1 (external-signer lane only): have the connected wallet sign
      // the inner CSW UserOp (passkey or
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
            ? 'Relay solver will pick up the request and execute the owner mutation on Base shortly.'
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
            <code className="font-mono text-zinc-300">/api/relay/execute</code> →
            Relay&apos;s <code className="font-mono text-zinc-300">/execute/call</code> →
            <code className="font-mono text-zinc-300"> EntryPoint.handleOps</code>).
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
            In-app browser detected with a CSW self-auth session. This page will
            submit a plain eth_sendTransaction from the CSW to itself; Base
            App&apos;s native handler signs locally with the on-device passkey,
            no popup needed.
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
                    <div className="rounded-xl border border-white/10 bg-black/30 p-3 text-[11px] text-zinc-300 space-y-2">
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
                            Sign with passkey (owner[0])
                          </span>
                          <span className="block text-[10px] text-zinc-500 mt-0.5 leading-relaxed">
                            Recommended. Self-auth ECDSA via Coinbase
                            Wallet&apos;s personal_sign can return signatures from
                            rotated session keys that aren&apos;t installed on the
                            CSW, which makes the EntryPoint reject the UserOp
                            with AA24. Uncheck to fall back to the session-key
                            ECDSA path at your own risk.
                          </span>
                        </span>
                      </label>
                    </div>

                    {isSelfAuthSession ? (
                      <div className="rounded-xl border border-emerald-400/25 bg-emerald-500/5 p-3 text-[11px] text-emerald-100/85 space-y-1">
                        <div className="text-[10px] uppercase tracking-[0.18em] text-emerald-200/70">
                          CSW self-call lane
                        </div>
                        <p className="leading-relaxed">
                          This session is signed in as the CSW itself, so the
                          submit will be a plain eth_sendTransaction from the
                          CSW to itself. Base App&apos;s native handler signs
                          locally with the on-device passkey — no popup, no
                          keys.coinbase.com round trip. The CSW pays its own
                          gas from its native balance ({
                            diagnostics.cswEthBalance == null
                              ? '—'
                              : `${formatEther(diagnostics.cswEthBalance)} ETH`
                          }).
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
                      className="btn-accent btn-no-icon inline-flex"
                    >
                      {busy
                        ? isSelfAuthSession
                          ? 'Submitting CSW self-call…'
                          : requirePasskey
                            ? 'Removing via passkey + Relay UserOp…'
                            : 'Removing via session-key + Relay UserOp…'
                        : isSelfAuthSession
                          ? `Remove owner at index ${preview?.preflight.targetOwnerIndex ?? '?'} via CSW self-call`
                          : inAppEnv?.isAnyWalletInApp && !isSelfAuthSession
                            ? 'Open in browser to remove'
                            : !preview
                              ? 'Select an owner above first'
                              : `Remove owner at index ${preview.preflight.targetOwnerIndex} via Relay UserOp`}
                    </button>
                    <p className="text-[11px] leading-relaxed text-zinc-500">
                      {isSelfAuthSession ? (
                        <>
                          Sends a plain{' '}
                          <code className="font-mono text-zinc-400">
                            eth_sendTransaction
                          </code>{' '}
                          from the CSW to itself with the inner{' '}
                          <code className="font-mono text-zinc-400">
                            executeWithoutChainIdValidation
                          </code>{' '}
                          payload. Base App&apos;s native handler signs locally
                          with the on-device passkey; the CSW pays its own gas.
                        </>
                      ) : (
                        <>
                          Signs an{' '}
                          <code className="font-mono text-zinc-400">
                            executeWithoutChainIdValidation
                          </code>{' '}
                          UserOp client-side, then has the connected funder EOA
                          broadcast the Relay-quoted{' '}
                          <code className="font-mono text-zinc-400">
                            RelayRouterV3.multicall
                          </code>{' '}
                          tx. Relay&apos;s solver picks up the deposit and
                          executes the inner UserOp on Base.
                        </>
                      )}
                    </p>
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
