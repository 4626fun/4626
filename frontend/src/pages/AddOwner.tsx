import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { encodeFunctionData, isAddress } from 'viem'
import { useConnect, useDisconnect, useWalletClient } from 'wagmi'
import { base } from 'wagmi/chains'

import { selectPreferredWalletConnector } from '@/lib/wallet/wagmiConnectorSelection'

import { PageMeta } from '@/components/seo/PageMeta'
import { useAccountSetupController } from '@/features/accountSetup/useAccountSetupController'
import { pickPrivyEmbeddedEoaWallet } from '@/lib/privy/privyEmbeddedEoa'
import {
  _submitOwnerViaDirectSendTx,
  _submitOwnerViaRelayExecute,
  _submitOwnerViaReplayablePreparedCalls,
  type DirectSendLaneTelemetry,
  type RelayLaneTelemetry,
  type ReplayableLaneTelemetry,
} from '@/lib/wallet/onboardingWallet'

const ADD_OWNER_ADDRESS_ABI = [
  {
    type: 'function',
    name: 'addOwnerAddress',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
] as const

/**
 * `/add-owner` — single-purpose surface for installing the Privy embedded EOA
 * (the "4626 signing" key) onto the user's canonical Coinbase Smart Wallet as
 * an additional owner.
 *
 * Why this page exists separately from `/accounts`:
 *  - `/accounts` requires expanding "Advanced settings" → "Advanced recovery"
 *    and pasting the EOA address into the Rabby co-owner field. That field
 *    routes through `prepare-add-rabby-owner` (caller-supplied address).
 *  - This page calls `controller.onEnable4626Signing()` instead, which routes
 *    through `prepare-add-privy-owner`. The backend reads the user's Privy
 *    embedded EOA from their authenticated session (via
 *    `bootstrapCanonicalDelegationState`) so the user never has to look up,
 *    paste, or even see the address — the install is fully programmatic
 *    end-to-end.
 *
 * Submission lane is identical to the Mar 9 owner[2] install: passkey owner[0]
 * signs `executeWithoutChainIdValidation([addOwnerAddress(privyEoa)])` via
 * Coinbase `wallet_prepareCalls` / `wallet_sendPreparedCalls`. No EOA-owner
 * private key is required.
 */
const jsonReplacer = (_k: string, v: unknown) => (typeof v === 'bigint' ? v.toString() : v)

export function AddOwnerPage() {
  const controller = useAccountSetupController({ zoraReturnPath: '/add-owner' })
  const {
    advancedBusy,
    canonicalCswAddress,
    cswOwnersState,
    error,
    loading,
    notice,
    onEnable4626Signing,
    onResetOwnerApproval,
    privyAuthed,
    privyWallets,
    login,
  } = controller

  // Detect whether the Privy embedded EOA is already installed. Use the
  // shared `pickPrivyEmbeddedEoaWallet` helper so we accept all embedded
  // Privy wallet variants (privy, privy-v2, *embedded*, etc.) consistently
  // with the rest of the app.
  const privyEmbeddedEoaAddress = useMemo(() => {
    const candidates = (Array.isArray(privyWallets) ? privyWallets : []) as Array<
      Record<string, unknown>
    >
    const found = pickPrivyEmbeddedEoaWallet(candidates)
    const address = found?.address
    return typeof address === 'string' ? address.toLowerCase() : null
  }, [privyWallets])

  const installedAsOwner = useMemo(() => {
    if (!privyEmbeddedEoaAddress) return null
    return cswOwnersState.owners.some(
      (owner) =>
        owner.isAddressOwner &&
        typeof owner.ownerAddress === 'string' &&
        owner.ownerAddress.toLowerCase() === privyEmbeddedEoaAddress,
    )
  }, [cswOwnersState.owners, privyEmbeddedEoaAddress])

  const handleInstall = async () => {
    await onEnable4626Signing()
  }

  // ── Mar 9 replayable-lane diagnostic ─────────────────────────────────
  // Tries the exact signing path proved by tx 0x801b9d4b… — wraps the call
  // in `executeWithoutChainIdValidation` so Coinbase's RPC must use
  // REPLAYABLE_NONCE_KEY=8453 and return `getUserOpHashWithoutChainId` for
  // signing.  All steps are surfaced in the event log so we can see exactly
  // where (and if) it fails.
  const { data: walletClient } = useWalletClient()
  const { connectAsync, connectors, isPending: isConnectPending } = useConnect()
  const { disconnectAsync, isPending: isDisconnectPending } = useDisconnect()
  const [replayableConnectError, setReplayableConnectError] = useState<string | null>(null)
  const [replayableBusy, setReplayableBusy] = useState(false)
  // Mar 9 used NO paymaster (paymasterAndData="", gas=0) — sponsorship was
  // handled downstream by Relay's solver network. Default the diagnostic to
  // "none" so we faithfully reproduce that shape. "proxy" forces an absolute
  // URL to the /api/paymaster JSON-RPC proxy (which forwards to the real CDP
  // paymaster server-side) for probing whether Coinbase's bundler now requires
  // explicit sponsorship.
  const [paymasterMode, setPaymasterMode] = useState<'none' | 'proxy'>('none')
  const [replayableEvents, setReplayableEvents] = useState<
    Array<{ ts: number; step: ReplayableLaneTelemetry['step']; detail: Record<string, unknown> }>
  >([])
  const [replayableError, setReplayableError] = useState<string | null>(null)
  const [replayableTxHash, setReplayableTxHash] = useState<string | null>(null)

  // ── Mar 9 Relay-relayer lane ─────────────────────────────────────────
  // Runs the EXACT path proven by tx 0x801b9d4b…: prepare UserOp via
  // wallet_prepareCalls, sign with passkey, encode handleOps locally, POST
  // to /api/relay/execute (server-side proxy to https://api.relay.link/execute).
  // Bypasses Coinbase's wallet_sendPreparedCalls entirely.
  const [relayBusy, setRelayBusy] = useState(false)
  const [relayEvents, setRelayEvents] = useState<
    Array<{ ts: number; step: RelayLaneTelemetry['step']; detail: Record<string, unknown> }>
  >([])
  const [relayError, setRelayError] = useState<string | null>(null)
  const [relayResponse, setRelayResponse] = useState<unknown>(null)

  // ── Direct eth_sendTransaction lane (Base App webview-native) ──────────
  // Bypasses wallet_prepareCalls / keys.coinbase.com popups entirely. The
  // CSW signs for itself via Base App's NATIVE eth_sendTransaction handler,
  // which is the same handler that produced the Mar 9 tx (0x801b9d4b…).
  // This is the only lane that works inside the Base App in-app browser,
  // because webviews can't open the popup window the Coinbase Wallet SDK
  // requires for wallet_prepareCalls.
  const [directBusy, setDirectBusy] = useState(false)
  const [directEvents, setDirectEvents] = useState<
    Array<{ ts: number; step: DirectSendLaneTelemetry['step']; detail: Record<string, unknown> }>
  >([])
  const [directError, setDirectError] = useState<string | null>(null)
  const [directTxHash, setDirectTxHash] = useState<string | null>(null)

  const preferredConnector = useMemo(() => {
    // Prefer Coinbase Wallet (Base App SDK) since this diagnostic must run
    // inside the Base App dapp browser. Fall back to whatever the shared
    // selector picks (e.g. injected) for normal-browser smoke tests.
    const baseFirst = connectors.find((c) =>
      ['coinbaseWalletSDK', 'coinbaseWallet'].includes(String(c.id)),
    )
    if (baseFirst) return baseFirst
    return selectPreferredWalletConnector(connectors)
  }, [connectors])

  const handleReplayableConnect = async () => {
    setReplayableConnectError(null)
    if (!preferredConnector) {
      setReplayableConnectError('No wallet connector available in this context.')
      return
    }
    try {
      await connectAsync({ connector: preferredConnector, chainId: base.id })
    } catch (err) {
      setReplayableConnectError(
        err instanceof Error ? err.message : 'Failed to connect wallet.',
      )
    }
  }

  const handleReplayableDisconnect = async () => {
    setReplayableConnectError(null)
    try {
      await disconnectAsync()
    } catch (err) {
      setReplayableConnectError(
        err instanceof Error ? err.message : 'Failed to disconnect.',
      )
    }
  }

  const cswIsConnectedSelf = useMemo(() => {
    const connected = walletClient?.account?.address?.toLowerCase()
    return Boolean(
      canonicalCswAddress &&
        connected &&
        connected === canonicalCswAddress.toLowerCase(),
    )
  }, [walletClient, canonicalCswAddress])

  const handleReplayableLaneTry = async () => {
    setReplayableEvents([])
    setReplayableError(null)
    setReplayableTxHash(null)
    if (!walletClient || !walletClient.request) {
      setReplayableError('Connect a wallet first.')
      return
    }
    if (!canonicalCswAddress || !isAddress(canonicalCswAddress)) {
      setReplayableError('No canonical CSW.')
      return
    }
    if (!privyEmbeddedEoaAddress || !isAddress(privyEmbeddedEoaAddress)) {
      setReplayableError('No Privy embedded EOA available to install.')
      return
    }
    if (!cswIsConnectedSelf) {
      setReplayableError(
        'Connect via Base App so the CSW signs for itself (connected address must equal the CSW). Then retry.',
      )
      return
    }
    setReplayableBusy(true)
    try {
      const innerCallData = encodeFunctionData({
        abi: ADD_OWNER_ADDRESS_ABI,
        functionName: 'addOwnerAddress',
        args: [privyEmbeddedEoaAddress as `0x${string}`],
      })
      let paymasterUrl: string | null = null
      if (paymasterMode === 'proxy') {
        // Always absolute — Coinbase's bundler fetches the paymaster URL
        // server-side from its own infra, so a relative path 404s on their
        // origin. Prefer window.location.origin (works in normal browsers)
        // and fall back to the canonical marketing origin
        // (https://4626.fun) for environments — like Base App's webview —
        // that report an empty/opaque origin.
        let origin = typeof window !== 'undefined' ? String(window.location?.origin ?? '').trim() : ''
        if (!origin || origin === 'null') {
          origin = (import.meta.env.VITE_MARKETING_ORIGIN as string | undefined)?.trim() || 'https://4626.fun'
        }
        paymasterUrl = `${origin.replace(/\/$/, '')}/api/paymaster`
      }
      // mode === 'none' → leave paymasterUrl null (Mar 9 shape)
      const request = walletClient.request as (args: {
        method: string
        params?: unknown[]
      }) => Promise<unknown>
      const result = await _submitOwnerViaReplayablePreparedCalls({
        walletRequest: request,
        chainId: 8453,
        csw: canonicalCswAddress as `0x${string}`,
        innerCallData,
        paymasterUrl,
        onTelemetry: (event) => {
          setReplayableEvents((prev) => [
            ...prev,
            { ts: Date.now(), step: event.step, detail: event.detail },
          ])
        },
      })
      if (result.txHash) {
        setReplayableTxHash(result.txHash)
      } else {
        setReplayableError(
          'Submission completed but no on-chain tx hash yet. Check the event log.',
        )
      }
    } catch (err) {
      setReplayableError(err instanceof Error ? err.message : String(err ?? 'Unknown error'))
    } finally {
      setReplayableBusy(false)
    }
  }

  const handleDirectLaneTry = async () => {
    setDirectEvents([])
    setDirectError(null)
    setDirectTxHash(null)
    if (!walletClient || !walletClient.request) {
      setDirectError('Connect a wallet first.')
      return
    }
    if (!canonicalCswAddress || !isAddress(canonicalCswAddress)) {
      setDirectError('No canonical CSW.')
      return
    }
    if (!privyEmbeddedEoaAddress || !isAddress(privyEmbeddedEoaAddress)) {
      setDirectError('No Privy embedded EOA available to install.')
      return
    }
    if (!cswIsConnectedSelf) {
      setDirectError(
        'Connect via Base App so the CSW signs for itself (connected address must equal the CSW). Then retry.',
      )
      return
    }
    setDirectBusy(true)
    try {
      const innerCallData = encodeFunctionData({
        abi: ADD_OWNER_ADDRESS_ABI,
        functionName: 'addOwnerAddress',
        args: [privyEmbeddedEoaAddress as `0x${string}`],
      })
      const request = walletClient.request as (args: {
        method: string
        params?: unknown[]
      }) => Promise<unknown>
      const result = await _submitOwnerViaDirectSendTx({
        walletRequest: request,
        csw: canonicalCswAddress as `0x${string}`,
        innerCallData,
        onTelemetry: (event) => {
          setDirectEvents((prev) => [
            ...prev,
            { ts: Date.now(), step: event.step, detail: event.detail },
          ])
        },
      })
      setDirectTxHash(result.txHash)
    } catch (err) {
      setDirectError(err instanceof Error ? err.message : String(err ?? 'Unknown error'))
    } finally {
      setDirectBusy(false)
    }
  }

  const handleRelayLaneTry = async () => {
    setRelayEvents([])
    setRelayError(null)
    setRelayResponse(null)
    if (!walletClient || !walletClient.request) {
      setRelayError('Connect a wallet first.')
      return
    }
    if (!canonicalCswAddress || !isAddress(canonicalCswAddress)) {
      setRelayError('No canonical CSW.')
      return
    }
    if (!privyEmbeddedEoaAddress || !isAddress(privyEmbeddedEoaAddress)) {
      setRelayError('No Privy embedded EOA available to install.')
      return
    }
    if (!cswIsConnectedSelf) {
      setRelayError(
        'Connect via Base App so the CSW signs for itself (connected address must equal the CSW). Then retry.',
      )
      return
    }
    setRelayBusy(true)
    try {
      const innerCallData = encodeFunctionData({
        abi: ADD_OWNER_ADDRESS_ABI,
        functionName: 'addOwnerAddress',
        args: [privyEmbeddedEoaAddress as `0x${string}`],
      })
      const request = walletClient.request as (args: {
        method: string
        params?: unknown[]
      }) => Promise<unknown>
      const result = await _submitOwnerViaRelayExecute({
        walletRequest: request,
        chainId: 8453,
        csw: canonicalCswAddress as `0x${string}`,
        innerCallData,
        // Mar 9 used EntryPoint v0.6 + beneficiary == csw — keep the defaults.
        onTelemetry: (event) => {
          setRelayEvents((prev) => [
            ...prev,
            { ts: Date.now(), step: event.step, detail: event.detail },
          ])
        },
      })
      setRelayResponse(result.relayResponse)
    } catch (err) {
      setRelayError(err instanceof Error ? err.message : String(err ?? 'Unknown error'))
    } finally {
      setRelayBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <PageMeta
        title="Install signing key"
        description="Install your Privy embedded signer onto your canonical Coinbase Smart Wallet so 4626 can prepare and submit user operations on your behalf without prompting for a passkey on every action."
        canonicalPath="/add-owner"
      />
      <div className="mx-auto w-full max-w-xl px-6 py-16 space-y-6">
        <div className="space-y-2">
          <div className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">
            Account setup
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">Install signing key</h1>
          <p className="text-sm text-zinc-400">
            Install your Privy embedded signer onto your canonical Coinbase Smart Wallet as
            an additional owner. The address is read from your authenticated session — no
            paste required. Your passkey signs the install on-chain through the same flow
            you used during waitlist setup.
          </p>
        </div>

        {!privyAuthed ? (
          <div className="card rounded-2xl border border-white/10 bg-black/40 p-6 space-y-3">
            <p className="text-sm text-zinc-300">
              Sign in to install the signing key on your wallet.
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

        {privyAuthed && !loading ? (
          <div className="card rounded-2xl border border-white/10 bg-black/40 p-6 space-y-4">
            {!canonicalCswAddress ? (
              <div className="rounded-xl border border-white/10 bg-black/30 p-4 text-sm text-zinc-400">
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
                      Privy signer
                    </dt>
                    <dd className="mt-1 break-all font-mono text-zinc-300">
                      {privyEmbeddedEoaAddress ?? 'resolving…'}
                    </dd>
                  </div>
                </dl>

                {installedAsOwner === true ? (
                  <div className="rounded-xl border border-emerald-400/25 bg-emerald-500/10 p-4 text-xs text-emerald-100">
                    Signing key is already installed on this wallet. No further action
                    needed.
                  </div>
                ) : null}

                <div className="space-y-3">
                  <button
                    type="button"
                    disabled={advancedBusy || installedAsOwner === true}
                    onClick={() => void handleInstall()}
                    className="btn-accent btn-no-icon inline-flex"
                  >
                    {advancedBusy
                      ? 'Installing…'
                      : installedAsOwner === true
                        ? 'Already installed'
                        : 'Install signing key'}
                  </button>
                  <p className="text-[11px] leading-relaxed text-zinc-500">
                    Your Coinbase passkey will be prompted to authorize a single
                    transaction:{' '}
                    <code className="font-mono text-zinc-400">
                      addOwnerAddress(privyEoa)
                    </code>{' '}
                    on your canonical CSW. Gas is sponsored by 4626.
                  </p>
                </div>

                {notice ? (
                  <div className="rounded-xl border border-emerald-400/25 bg-emerald-500/10 p-3 text-xs text-emerald-100">
                    {notice}
                  </div>
                ) : null}

                {error ? (
                  <div className="space-y-2">
                    <div className="rounded-xl border border-rose-400/25 bg-rose-500/10 p-3 text-xs text-rose-100">
                      {error}
                    </div>
                    <button
                      type="button"
                      onClick={() => void onResetOwnerApproval()}
                      className="rounded-lg border border-white/15 px-3 py-1.5 text-[11px] text-zinc-300 hover:border-white/30"
                    >
                      Reset and retry
                    </button>
                  </div>
                ) : null}

                {/* ── Direct eth_sendTransaction lane (RECOMMENDED — Base App native) ── */}
                <div className="mt-4 rounded-xl border border-sky-300/30 bg-sky-500/[0.06] p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.18em] text-sky-300/80">
                        Recommended · Base App native
                      </div>
                      <div className="text-sm font-medium text-zinc-100">
                        Direct eth_sendTransaction
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={directBusy || installedAsOwner === true || !cswIsConnectedSelf}
                      onClick={() => void handleDirectLaneTry()}
                      className="rounded-lg border border-sky-300/40 bg-sky-400/10 px-3 py-1.5 text-[11px] text-sky-50 hover:border-sky-300/70 disabled:opacity-40"
                    >
                      {directBusy ? 'Running…' : 'Run'}
                    </button>
                  </div>
                  <p className="text-[11px] leading-relaxed text-zinc-400">
                    Sends the wrapped{' '}
                    <code className="font-mono text-zinc-300">executeWithoutChainIdValidation([addOwnerAddress(privyEoa)])</code>{' '}
                    calldata via a plain{' '}
                    <code className="font-mono text-zinc-300">eth_sendTransaction</code>{' '}
                    from the CSW to itself. Base App's native handler signs locally with the
                    on-device passkey — no popup, no keys.coinbase.com round-trip. This is
                    the only path that works inside the Base App in-app browser (webviews
                    block the popup that{' '}
                    <code className="font-mono text-zinc-300">wallet_prepareCalls</code>{' '}
                    requires).
                  </p>
                  {directTxHash ? (
                    <div className="rounded-lg border border-emerald-400/25 bg-emerald-500/10 p-3 text-[11px] text-emerald-100">
                      Submitted. tx:{' '}
                      <a
                        href={`https://basescan.org/tx/${directTxHash}`}
                        target="_blank"
                        rel="noreferrer"
                        className="underline underline-offset-2 break-all"
                      >
                        {directTxHash}
                      </a>
                    </div>
                  ) : null}
                  {directError ? (
                    <div className="rounded-lg border border-rose-400/25 bg-rose-500/10 p-3 text-[11px] text-rose-100 break-all">
                      {directError}
                    </div>
                  ) : null}
                  {directEvents.length > 0 ? (
                    <div className="rounded-lg border border-white/10 bg-black/40 p-3">
                      <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500 mb-2">
                        Event log
                      </div>
                      <ol className="space-y-2 text-[10px] font-mono text-zinc-300">
                        {directEvents.map((event, idx) => (
                          <li
                            key={`${event.ts}-${idx}`}
                            className="break-all border-l-2 border-white/10 pl-2"
                          >
                            <div className="text-zinc-500">
                              {new Date(event.ts).toISOString().split('T')[1]?.replace('Z', '')} ·{' '}
                              <span className="text-zinc-300">{event.step}</span>
                            </div>
                            <pre className="mt-1 whitespace-pre-wrap text-zinc-400">
                              {JSON.stringify(event.detail, jsonReplacer, 2)}
                            </pre>
                          </li>
                        ))}
                      </ol>
                    </div>
                  ) : null}
                </div>

                {/* ── Mar 9 replayable-lane diagnostic ── */}
                <div className="mt-4 rounded-xl border border-white/10 bg-black/30 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">
                        Diagnostic
                      </div>
                      <div className="text-sm font-medium text-zinc-200">
                        Try Mar 9 replayable lane
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={replayableBusy || installedAsOwner === true || !cswIsConnectedSelf}
                      onClick={() => void handleReplayableLaneTry()}
                      className="rounded-lg border border-white/15 px-3 py-1.5 text-[11px] text-zinc-100 hover:border-white/30 disabled:opacity-40"
                    >
                      {replayableBusy ? 'Running…' : 'Run'}
                    </button>
                  </div>
                  <p className="text-[11px] leading-relaxed text-zinc-500">
                    Wraps the inner call in{' '}
                    <code className="font-mono text-zinc-400">executeWithoutChainIdValidation</code>{' '}
                    and submits via wallet_prepareCalls / wallet_sendPreparedCalls. Forces
                    REPLAYABLE_NONCE_KEY=8453 so the wallet must sign{' '}
                    <code className="font-mono text-zinc-400">getUserOpHashWithoutChainId</code>{' '}
                    — the same hash signed by the passkey on Mar 9 (tx 0x801b9d4b…).
                  </p>
                  <div className="flex flex-wrap items-center gap-2 text-[11px]">
                    <span className="text-zinc-500">Paymaster:</span>
                    {(['none', 'proxy'] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setPaymasterMode(mode)}
                        disabled={replayableBusy}
                        className={
                          `rounded-md border px-2 py-0.5 transition-colors disabled:opacity-40 ` +
                          (paymasterMode === mode
                            ? 'border-emerald-300/60 bg-emerald-400/10 text-emerald-100'
                            : 'border-white/15 bg-black/30 text-zinc-300 hover:border-white/30')
                        }
                      >
                        {mode === 'none' ? 'None (Mar 9 shape)' : 'Proxy (CDP)'}
                      </button>
                    ))}
                  </div>
                  {!cswIsConnectedSelf ? (
                    <div className="rounded-lg border border-amber-400/25 bg-amber-500/10 p-3 text-[11px] text-amber-100 space-y-2">
                      <div>
                        Connect via Base App so the CSW signs for itself
                        (connected address must equal the canonical CSW). Currently
                        connected:{' '}
                        <span className="font-mono">
                          {walletClient?.account?.address ?? 'none'}
                        </span>
                        .
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={isConnectPending || replayableBusy}
                          onClick={() => void handleReplayableConnect()}
                          className="rounded-md border border-amber-300/40 bg-amber-400/10 px-2.5 py-1 text-[11px] text-amber-50 hover:border-amber-300/70 disabled:opacity-40"
                        >
                          {isConnectPending
                            ? 'Opening…'
                            : `Connect ${preferredConnector?.name ?? 'wallet'}`}
                        </button>
                        {walletClient?.account?.address ? (
                          <button
                            type="button"
                            disabled={isDisconnectPending || replayableBusy}
                            onClick={() => void handleReplayableDisconnect()}
                            className="rounded-md border border-white/15 bg-black/30 px-2.5 py-1 text-[11px] text-zinc-200 hover:border-white/30 disabled:opacity-40"
                          >
                            {isDisconnectPending ? 'Disconnecting…' : 'Disconnect'}
                          </button>
                        ) : null}
                      </div>
                      {replayableConnectError ? (
                        <div className="text-rose-200 break-all">{replayableConnectError}</div>
                      ) : null}
                    </div>
                  ) : null}
                  {replayableTxHash ? (
                    <div className="rounded-lg border border-emerald-400/25 bg-emerald-500/10 p-3 text-[11px] text-emerald-100">
                      Submitted. tx:{' '}
                      <a
                        href={`https://basescan.org/tx/${replayableTxHash}`}
                        target="_blank"
                        rel="noreferrer"
                        className="underline underline-offset-2 break-all"
                      >
                        {replayableTxHash}
                      </a>
                    </div>
                  ) : null}
                  {replayableError ? (
                    <div className="rounded-lg border border-rose-400/25 bg-rose-500/10 p-3 text-[11px] text-rose-100 break-all">
                      {replayableError}
                    </div>
                  ) : null}
                  {replayableEvents.length > 0 ? (
                    <div className="rounded-lg border border-white/10 bg-black/40 p-3">
                      <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500 mb-2">
                        Event log
                      </div>
                      <ol className="space-y-2 text-[10px] font-mono text-zinc-300">
                        {replayableEvents.map((event, idx) => (
                          <li
                            key={`${event.ts}-${idx}`}
                            className="break-all border-l-2 border-white/10 pl-2"
                          >
                            <div className="text-zinc-500">
                              {new Date(event.ts).toISOString().split('T')[1]?.replace('Z', '')} ·{' '}
                              <span className="text-zinc-300">{event.step}</span>
                            </div>
                            <pre className="mt-1 whitespace-pre-wrap text-zinc-400">
                              {JSON.stringify(event.detail, jsonReplacer, 2)}
                            </pre>
                          </li>
                        ))}
                      </ol>
                    </div>
                  ) : null}
                </div>

                {/* ── Mar 9 Relay-relayer diagnostic ── */}
                <div className="mt-4 rounded-xl border border-emerald-300/20 bg-emerald-500/[0.04] p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.18em] text-emerald-300/80">
                        Diagnostic · Mar 9 path
                      </div>
                      <div className="text-sm font-medium text-zinc-100">
                        Try Relay /execute lane
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={relayBusy || installedAsOwner === true || !cswIsConnectedSelf}
                      onClick={() => void handleRelayLaneTry()}
                      className="rounded-lg border border-emerald-300/40 bg-emerald-400/10 px-3 py-1.5 text-[11px] text-emerald-50 hover:border-emerald-300/70 disabled:opacity-40"
                    >
                      {relayBusy ? 'Running…' : 'Run'}
                    </button>
                  </div>
                  <p className="text-[11px] leading-relaxed text-zinc-400">
                    Reproduces tx{' '}
                    <a
                      href="https://basescan.org/tx/0x801b9d4b8f7470226c2f02d5252583f00d77da5cbb0b7dc8b73421ed8b491503"
                      target="_blank"
                      rel="noreferrer"
                      className="underline underline-offset-2"
                    >
                      0x801b9d4b…
                    </a>{' '}
                    end-to-end: prepare UserOp via{' '}
                    <code className="font-mono text-zinc-300">wallet_prepareCalls</code>,
                    sign with passkey, encode{' '}
                    <code className="font-mono text-zinc-300">EntryPoint.handleOps</code>{' '}
                    locally, POST to /api/relay/execute (server-side proxy to Relay).
                    Bypasses Coinbase's wallet_sendPreparedCalls entirely.
                  </p>
                  {relayResponse ? (
                    <div className="rounded-lg border border-emerald-400/25 bg-emerald-500/10 p-3 text-[11px] text-emerald-100 break-all">
                      <div className="font-medium">Submitted to Relay.</div>
                      <pre className="mt-2 whitespace-pre-wrap font-mono text-emerald-50/90">
                        {JSON.stringify(relayResponse, jsonReplacer, 2)}
                      </pre>
                    </div>
                  ) : null}
                  {relayError ? (
                    <div className="rounded-lg border border-rose-400/25 bg-rose-500/10 p-3 text-[11px] text-rose-100 break-all">
                      {relayError}
                    </div>
                  ) : null}
                  {relayEvents.length > 0 ? (
                    <div className="rounded-lg border border-white/10 bg-black/40 p-3">
                      <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500 mb-2">
                        Event log
                      </div>
                      <ol className="space-y-2 text-[10px] font-mono text-zinc-300">
                        {relayEvents.map((event, idx) => (
                          <li
                            key={`${event.ts}-${idx}`}
                            className="break-all border-l-2 border-white/10 pl-2"
                          >
                            <div className="text-zinc-500">
                              {new Date(event.ts).toISOString().split('T')[1]?.replace('Z', '')} ·{' '}
                              <span className="text-zinc-300">{event.step}</span>
                            </div>
                            <pre className="mt-1 whitespace-pre-wrap text-zinc-400">
                              {JSON.stringify(event.detail, jsonReplacer, 2)}
                            </pre>
                          </li>
                        ))}
                      </ol>
                    </div>
                  ) : null}
                </div>
              </>
            )}
          </div>
        ) : null}

        <div className="text-[11px] text-zinc-500">
          Need to install a different EOA address?{' '}
          <Link to="/accounts" className="underline underline-offset-2">
            Use the advanced co-owner flow on /accounts
          </Link>
          .
        </div>
      </div>
    </div>
  )
}

export default AddOwnerPage
