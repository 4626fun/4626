/**
 * `/dev/toshi-probe` — focused mobile-Toshi diagnostic page.
 *
 * Purpose: when the canonical "Install signing key" flow on /add-owner fails
 * inside Toshi/Base App's in-app browser ("Error generating transaction"),
 * this page lets the user run each candidate method against the connected
 * provider one tap at a time and surfaces the exact response/error so we
 * can pick the right fallback lane in onboardingWallet.ts.
 *
 * Each probe is intentionally a NO-OP self-call (transferOwnership(self) is
 * not used; we use a benign view function selector that any contract call
 * will simulate-revert on, but the wallet will still produce its accept
 * vs. reject behaviour).  The probes never broadcast an owner install — that
 * remains exclusively on /add-owner.
 *
 * Probe matrix:
 *  1. wallet_getCapabilities          — detects atomicBatch / paymasterService / sendCalls support
 *  2. eth_signTypedData_v4 (UO hash)  — does Toshi's passkey sign typedData?
 *  3. wallet_prepareCalls (self-call) — does Toshi accept the prepare path for self-calls?
 *  4. wallet_sendCalls (paymaster)    — does paymasterService capability bypass Toshi's eGe self-call block?
 *  5. eth_sendTransaction (self)      — reproduces the screen the user is seeing today
 */

import { useMemo, useState } from 'react'
import { useAccount, useWalletClient } from 'wagmi'

import { PageMeta } from '@/components/seo/PageMeta'

type ProbeStatus = 'idle' | 'running' | 'ok' | 'err'

type ProbeResult = {
  status: ProbeStatus
  detail?: string
  raw?: unknown
  durationMs?: number
}

const CSW_ADDRESS = '0x4beabd0afbcc2f0440cdef1c3c745d43fae704ef' as `0x${string}`
const CHAIN_ID_HEX = '0x2105' // 8453, Base
const PAYMASTER_URL = '/api/paymaster'

// Inert self-call: 4 random bytes that don't match any selector on the CSW.
// The CSW's fallback() reverts on unknown selectors, so simulation will fail
// regardless — we don't care about simulation success, we care about which
// error class (or accept→broadcast attempt) the wallet returns BEFORE
// simulation, so we can map error → root cause without any onchain effect.
// Using 0xdeadbeef as the bait selector for clarity.
const PROBE_DATA = '0xdeadbeef' as `0x${string}`

function formatError(err: unknown): string {
  if (err instanceof Error) {
    const msg = err.message
    const code = (err as any).code
    const data = (err as any).data
    const parts: string[] = []
    if (code !== undefined) parts.push(`code=${code}`)
    if (msg) parts.push(msg)
    if (data && typeof data === 'object') parts.push(`data=${JSON.stringify(data).slice(0, 200)}`)
    return parts.join(' | ')
  }
  try {
    return JSON.stringify(err)
  } catch {
    return String(err)
  }
}

function safeStringify(value: unknown, max = 1500): string {
  try {
    const s = JSON.stringify(value, null, 2)
    return s.length > max ? `${s.slice(0, max)}\n…(truncated)` : s
  } catch {
    const s = String(value)
    return s.length > max ? `${s.slice(0, max)}…` : s
  }
}

export function ToshiProbe() {
  const { address: connectedAddress, chainId, connector } = useAccount()
  const { data: walletClient } = useWalletClient()

  const [providerInfo, setProviderInfo] = useState<string>('')
  const [results, setResults] = useState<Record<string, ProbeResult>>({})
  const [resolvedSender, setResolvedSender] = useState<string | null>(null)

  // Capture whatever we can about the injected provider on mount-ish.
  const providerSummary = useMemo(() => {
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
    const eth = typeof window !== 'undefined' ? (window as any).ethereum : null
    const isToshi =
      Boolean(eth?.isToshi) ||
      /toshi|coinbasewallet/i.test(ua)
    return {
      userAgent: ua,
      hasInjectedEthereum: Boolean(eth),
      injectedFlags: eth
        ? Object.fromEntries(
            ['isToshi', 'isCoinbaseWallet', 'isMetaMask', 'isCoinbaseBrowser']
              .map((k) => [k, Boolean(eth?.[k])]),
          )
        : null,
      detectedToshi: isToshi,
      wagmiConnectorId: connector?.id ?? null,
      wagmiConnectorName: connector?.name ?? null,
      connectedAddress: connectedAddress ?? null,
      chainId: chainId ?? null,
      walletClientReady: Boolean(walletClient),
    }
  }, [connectedAddress, chainId, connector, walletClient])

  function getRequest():
    | ((args: { method: string; params?: unknown[] }) => Promise<unknown>)
    | null {
    // Prefer the injected provider directly. Wagmi often fails to connect
    // inside in-app browsers (Coinbase Wallet, Base App) because the
    // configured connectors are popup-based; the page sees window.ethereum
    // but no wagmi session. Bypassing wagmi here lets us probe the actual
    // injected provider's capabilities even when wagmi is silent.
    if (typeof window !== 'undefined') {
      const eth = (window as any).ethereum
      if (eth && typeof eth.request === 'function') {
        return (args) => eth.request(args)
      }
    }
    if (walletClient && typeof walletClient.request === 'function') {
      return (args) => walletClient.request(args as any) as Promise<unknown>
    }
    return null
  }

  // Resolve a usable address for `from` in probes 2-5.  Prefer wagmi's
  // connected address; fall back to eth_requestAccounts on the injected
  // provider so we still have a sender even when wagmi is silent.
  async function resolveSender(): Promise<`0x${string}` | null> {
    if (connectedAddress) {
      setResolvedSender(connectedAddress)
      return connectedAddress as `0x${string}`
    }
    if (typeof window === 'undefined') return null
    const eth = (window as any).ethereum
    if (!eth || typeof eth.request !== 'function') return null
    try {
      const accounts = (await eth.request({ method: 'eth_requestAccounts' })) as string[]
      const first = Array.isArray(accounts) ? accounts[0] : null
      const addr = typeof first === 'string' && first.startsWith('0x') ? (first as `0x${string}`) : null
      setResolvedSender(addr)
      return addr
    } catch (err) {
      setResolvedSender(`error: ${err instanceof Error ? err.message : String(err)}`)
      return null
    }
  }

  const probeRequestAccounts = () =>
    runProbe('requestAccounts', async () => {
      const req = getRequest()
      if (!req) throw new Error('No injected provider available')
      const result = await req({ method: 'eth_requestAccounts' })
      const first = Array.isArray(result) ? (result as unknown[])[0] : null
      if (typeof first === 'string') setResolvedSender(first)
      return { detail: `Got ${Array.isArray(result) ? result.length : 0} account(s)`, raw: result }
    })

  async function runProbe(
    key: string,
    fn: () => Promise<{ detail: string; raw?: unknown }>,
  ) {
    setResults((prev) => ({ ...prev, [key]: { status: 'running' } }))
    const t0 = Date.now()
    try {
      const out = await fn()
      setResults((prev) => ({
        ...prev,
        [key]: {
          status: 'ok',
          detail: out.detail,
          raw: out.raw,
          durationMs: Date.now() - t0,
        },
      }))
    } catch (err) {
      setResults((prev) => ({
        ...prev,
        [key]: {
          status: 'err',
          detail: formatError(err),
          raw: err,
          durationMs: Date.now() - t0,
        },
      }))
    }
  }

  // ── Probe 1: wallet_getCapabilities ──
  const probeCapabilities = () =>
    runProbe('capabilities', async () => {
      const req = getRequest()
      if (!req) throw new Error('No injected provider available')
      const result = await req({
        method: 'wallet_getCapabilities',
        params: [connectedAddress ?? CSW_ADDRESS],
      })
      return { detail: 'OK — see raw output below', raw: result }
    })

  // ── Probe 2: eth_signTypedData_v4 ──
  // Sign an EIP-712 typed-data envelope that mimics what Coinbase's
  // executeWithoutChainIdValidation typed-data signing flow uses.  This
  // surfaces whether Toshi's passkey will produce a SignatureWrapper for
  // typed data without us going through wallet_prepareCalls.
  const probeSignTypedData = () =>
    runProbe('signTypedData', async () => {
      const req = getRequest()
      if (!req) throw new Error('No injected provider available')
      const sender = await resolveSender()
      if (!sender) throw new Error('No sender (eth_requestAccounts returned none)')
      const typedData = {
        domain: {
          name: 'Coinbase Smart Wallet',
          version: '1',
          chainId: 8453,
          verifyingContract: CSW_ADDRESS,
        },
        types: {
          EIP712Domain: [
            { name: 'name', type: 'string' },
            { name: 'version', type: 'string' },
            { name: 'chainId', type: 'uint256' },
            { name: 'verifyingContract', type: 'address' },
          ],
          ProbeMessage: [{ name: 'note', type: 'string' }],
        },
        primaryType: 'ProbeMessage',
        message: { note: 'toshi probe — not a UserOp' },
      }
      const result = await req({
        method: 'eth_signTypedData_v4',
        params: [sender, JSON.stringify(typedData)],
      })
      return {
        detail: `Returned ${typeof result === 'string' ? `${(result as string).length}-char hex` : typeof result}`,
        raw: result,
      }
    })

  // ── Probe 3: wallet_prepareCalls ──
  const probePrepareCalls = () =>
    runProbe('prepareCalls', async () => {
      const req = getRequest()
      if (!req) throw new Error('No injected provider available')
      const sender = await resolveSender()
      if (!sender) throw new Error('No sender (eth_requestAccounts returned none)')
      const result = await req({
        method: 'wallet_prepareCalls',
        params: [
          {
            chainId: CHAIN_ID_HEX,
            from: sender,
            calls: [{ to: CSW_ADDRESS, data: PROBE_DATA, value: '0x0' }],
            atomicRequired: false,
            version: '2.0.0',
            capabilities: {
              paymasterUrl: PAYMASTER_URL,
              paymasterService: {
                url: PAYMASTER_URL,
                [CHAIN_ID_HEX]: { url: PAYMASTER_URL },
              },
            },
          },
        ],
      })
      return { detail: 'wallet_prepareCalls accepted — see raw', raw: result }
    })

  // ── Probe 4: wallet_sendCalls + paymasterService ──
  // Same payload as 3 but submits.  This is the lane the engineer's comment
  // says is blocked by eGe self-call check; verifying whether that blocks
  // sponsored calls too is the whole point of this probe.
  const probeSendCalls = () =>
    runProbe('sendCalls', async () => {
      const req = getRequest()
      if (!req) throw new Error('No injected provider available')
      const sender = await resolveSender()
      if (!sender) throw new Error('No sender (eth_requestAccounts returned none)')
      const result = await req({
        method: 'wallet_sendCalls',
        params: [
          {
            chainId: CHAIN_ID_HEX,
            from: sender,
            calls: [{ to: CSW_ADDRESS, data: PROBE_DATA, value: '0x0' }],
            atomicRequired: false,
            version: '2.0.0',
            capabilities: {
              paymasterUrl: PAYMASTER_URL,
              paymasterService: {
                url: PAYMASTER_URL,
                [CHAIN_ID_HEX]: { url: PAYMASTER_URL },
              },
            },
          },
        ],
      })
      return { detail: 'wallet_sendCalls accepted — see raw', raw: result }
    })

  // ── Probe 5: eth_sendTransaction (reproduce current failure) ──
  const probeEthSendTx = () =>
    runProbe('ethSendTx', async () => {
      const req = getRequest()
      if (!req) throw new Error('No injected provider available')
      const sender = await resolveSender()
      if (!sender) throw new Error('No sender (eth_requestAccounts returned none)')
      const result = await req({
        method: 'eth_sendTransaction',
        params: [
          {
            from: sender,
            to: CSW_ADDRESS,
            data: PROBE_DATA,
            value: '0x0',
          },
        ],
      })
      return { detail: 'tx submitted', raw: result }
    })

  function copyAll() {
    const blob = JSON.stringify(
      {
        time: new Date().toISOString(),
        provider: providerSummary,
        resolvedSender,
        results,
      },
      null,
      2,
    )
    setProviderInfo(blob)
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(blob).catch(() => null)
    }
  }

  const probes: Array<{ key: string; label: string; fn: () => Promise<void>; warn?: string }> = [
    {
      key: 'requestAccounts',
      label: '0. eth_requestAccounts (wakes the injected provider)',
      fn: probeRequestAccounts,
      warn: 'tap this FIRST so subsequent probes have a sender',
    },
    { key: 'capabilities', label: '1. wallet_getCapabilities', fn: probeCapabilities },
    {
      key: 'signTypedData',
      label: '2. eth_signTypedData_v4 (probe envelope)',
      fn: probeSignTypedData,
      warn: 'will prompt passkey',
    },
    {
      key: 'prepareCalls',
      label: '3. wallet_prepareCalls (sponsored self-call)',
      fn: probePrepareCalls,
      warn: 'may prompt passkey',
    },
    {
      key: 'sendCalls',
      label: '4. wallet_sendCalls + paymasterService (sponsored self-call)',
      fn: probeSendCalls,
      warn: 'inert payload (0xdeadbeef) — will revert if wallet broadcasts, costs nothing',
    },
    {
      key: 'ethSendTx',
      label: '5. eth_sendTransaction (reproduces current failure)',
      fn: probeEthSendTx,
      warn: 'inert payload (0xdeadbeef) — same as before, just exercises the failure path',
    },
  ]

  return (
    <div className="min-h-screen bg-black text-white">
      <PageMeta title="Toshi probe" description="Diagnostic probes for /add-owner failures" canonicalPath="/dev/toshi-probe" />
      <div className="mx-auto w-full max-w-xl px-5 py-10 space-y-5">
        <div className="space-y-1">
          <div className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">Diagnostics</div>
          <h1 className="text-2xl font-semibold tracking-tight">Toshi probe</h1>
          <p className="text-xs text-zinc-400">
            Tap each probe in order. Each reports how the connected wallet responds. The payload is{' '}
            <code className="font-mono text-zinc-300">0xdeadbeef</code> — an unknown selector that
            reverts on the CSW's fallback. No state change, no owner installs, no real cost; we're
            only measuring which methods the wallet accepts vs rejects.
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/40 p-4 text-[11px] font-mono leading-snug text-zinc-300 space-y-2">
          <pre className="whitespace-pre-wrap break-all">{safeStringify(providerSummary)}</pre>
          {resolvedSender ? (
            <div className="rounded-lg bg-black/40 p-2">
              <span className="text-zinc-500">resolved sender:</span> {resolvedSender}
            </div>
          ) : null}
        </div>

        <div className="space-y-3">
          {probes.map((p) => {
            const r = results[p.key] ?? { status: 'idle' as ProbeStatus }
            const statusColor =
              r.status === 'ok'
                ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-100'
                : r.status === 'err'
                  ? 'border-rose-400/30 bg-rose-500/10 text-rose-100'
                  : r.status === 'running'
                    ? 'border-amber-400/30 bg-amber-500/10 text-amber-100'
                    : 'border-white/10 bg-black/30 text-zinc-300'
            return (
              <div key={p.key} className={`rounded-2xl border p-4 ${statusColor}`}>
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-medium">{p.label}</div>
                  <button
                    type="button"
                    onClick={() => void p.fn()}
                    disabled={r.status === 'running'}
                    className="rounded-lg border border-white/20 px-3 py-1 text-[11px] hover:border-white/40 disabled:opacity-50"
                  >
                    {r.status === 'running' ? 'running…' : 'run'}
                  </button>
                </div>
                {p.warn ? (
                  <div className="mt-1 text-[10px] uppercase tracking-[0.15em] text-amber-300/80">
                    ⚠ {p.warn}
                  </div>
                ) : null}
                {r.status !== 'idle' ? (
                  <div className="mt-3 space-y-2 text-[11px]">
                    <div>
                      <span className="opacity-70">status:</span> {r.status}
                      {typeof r.durationMs === 'number' ? ` (${r.durationMs}ms)` : ''}
                    </div>
                    {r.detail ? (
                      <div>
                        <span className="opacity-70">detail:</span>{' '}
                        <span className="break-all">{r.detail}</span>
                      </div>
                    ) : null}
                    {r.raw !== undefined ? (
                      <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded-lg bg-black/40 p-2 font-mono text-[10px]">
                        {safeStringify(r.raw)}
                      </pre>
                    ) : null}
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>

        <div className="space-y-3">
          <button
            type="button"
            onClick={() => copyAll()}
            className="rounded-lg border border-white/20 px-3 py-2 text-xs hover:border-white/40"
          >
            Copy all results to clipboard
          </button>
          {providerInfo ? (
            <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded-2xl border border-white/10 bg-black/40 p-3 font-mono text-[10px] text-zinc-300">
              {providerInfo}
            </pre>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export default ToshiProbe
