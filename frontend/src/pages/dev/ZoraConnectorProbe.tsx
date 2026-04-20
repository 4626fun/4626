/**
 * Dev probe — determines which Privy cross-app capability bucket Zora has
 * the 4626 appId in:
 *
 *   1. Full transactional Connect mode → connect + signMessage + self-call tx all work
 *   2. Read-only Connect mode → connect works, signMessage / tx refused
 *   3. Connect mode not authorized at all → connect itself errors 401/403
 *
 * Every step is isolated and surfaces the raw error so we can classify
 * deterministically. This is *not* shipped user-facing — it's here so we
 * can answer the "does transactional cross-app actually work with Zora"
 * question once and for all, without guessing from Privy docs.
 *
 * Route is gated by `zoraGlobalWalletConnectorFlag`; when the flag is off
 * the connector is not registered and this page renders an instructions
 * panel explaining how to enable it.
 */

import { useEffect, useMemo, useState } from 'react'
import { encodeFunctionData, type Hex } from 'viem'
import { base } from 'viem/chains'
import { useAccount, useConnect, useDisconnect, usePublicClient, useWalletClient } from 'wagmi'

import { zoraGlobalWalletConnectorFlag } from '@/lib/flags/featureFlags'
import { ZORA_PRIVY_APP_ID } from '@/lib/privy/client'
import { ZORA_GLOBAL_WALLET_CONNECTOR_ID } from '@/lib/wallet/zoraGlobalWalletConnector'

const CBSW_ABI = [
  {
    inputs: [{ name: 'owner', type: 'address' }],
    name: 'addOwnerAddress',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'isOwnerAddress',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const

type StepKind = 'idle' | 'pending' | 'ok' | 'err'
type StepStatus = { kind: StepKind; label: string; detail?: string }

const INITIAL: StepStatus = { kind: 'idle', label: 'not tested' }

export function ZoraConnectorProbe() {
  const flagOn = zoraGlobalWalletConnectorFlag()
  const { address, chainId, connector: activeConnector } = useAccount()
  const { connectors, connectAsync } = useConnect()
  const { disconnectAsync } = useDisconnect()
  const publicClient = usePublicClient({ chainId: base.id })
  const { data: walletClient } = useWalletClient()

  const zoraConnector = useMemo(
    () => connectors.find((c) => c.id === ZORA_GLOBAL_WALLET_CONNECTOR_ID),
    [connectors],
  )

  const [connectStatus, setConnectStatus] = useState<StepStatus>(INITIAL)
  const [signStatus, setSignStatus] = useState<StepStatus>(INITIAL)
  const [txStatus, setTxStatus] = useState<StepStatus>(INITIAL)
  const [isOwnerOfSelf, setIsOwnerOfSelf] = useState<boolean | null>(null)
  const [codeSizeHex, setCodeSizeHex] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    if (!address || !publicClient) {
      setIsOwnerOfSelf(null)
      setCodeSizeHex(null)
      return
    }
    // Two signals that confirm the connected wallet is the CBSW itself:
    //   (a) `isOwnerAddress(self)` returns true → CBSW where it lists itself; and
    //   (b) bytecode at the address is non-empty → it's a contract, not an EOA.
    void publicClient
      .readContract({
        address,
        abi: CBSW_ABI,
        functionName: 'isOwnerAddress',
        args: [address],
      })
      .then((v) => {
        if (!cancelled) setIsOwnerOfSelf(Boolean(v))
      })
      .catch(() => {
        if (!cancelled) setIsOwnerOfSelf(null)
      })
    void publicClient
      .getBytecode({ address })
      .then((code) => {
        if (!cancelled) setCodeSizeHex(code ? `${code.length - 2} hex chars` : 'EOA (no bytecode)')
      })
      .catch(() => {
        if (!cancelled) setCodeSizeHex(null)
      })
    return () => {
      cancelled = true
    }
  }, [address, publicClient])

  async function runConnect() {
    if (!zoraConnector) {
      setConnectStatus({
        kind: 'err',
        label: 'connector not registered',
        detail: 'Flag off or `@privy-io/cross-app-connect` not installed.',
      })
      return
    }
    setConnectStatus({ kind: 'pending', label: 'opening Zora popup…' })
    try {
      const res = await connectAsync({ connector: zoraConnector, chainId: base.id })
      const addr = res.accounts?.[0] ?? '—'
      setConnectStatus({
        kind: 'ok',
        label: 'connected',
        detail: `account=${addr}  chainId=${res.chainId}`,
      })
    } catch (err: any) {
      const msg = String(err?.message ?? err)
      setConnectStatus({ kind: 'err', label: classify(msg), detail: msg })
    }
  }

  async function runSignMessage() {
    if (!walletClient || !address) {
      setSignStatus({ kind: 'err', label: 'no wallet client', detail: 'Connect first.' })
      return
    }
    setSignStatus({ kind: 'pending', label: 'awaiting Zora popup signature…' })
    try {
      const sig = await walletClient.signMessage({
        account: address,
        message: `4626 zora-connector probe: ${new Date().toISOString()}`,
      })
      setSignStatus({
        kind: 'ok',
        label: 'signed',
        detail: `${sig.slice(0, 22)}…${sig.slice(-8)}`,
      })
    } catch (err: any) {
      const msg = String(err?.message ?? err)
      setSignStatus({ kind: 'err', label: classify(msg), detail: msg })
    }
  }

  async function runSelfAddOwner() {
    if (!walletClient || !address) {
      setTxStatus({ kind: 'err', label: 'no wallet client', detail: 'Connect first.' })
      return
    }
    // Send addOwnerAddress(self) — self-call. Succeeds only if:
    //   (i) connected wallet is the CBSW (smartWalletMode exposed it), and
    //   (ii) the UserOp is signed by an owner and submitted via a bundler.
    // We don't care whether the tx lands; we only care whether Zora accepts
    // the request via its popup. A revert after acceptance is still a pass.
    setTxStatus({ kind: 'pending', label: 'awaiting Zora popup for addOwnerAddress(self)…' })
    try {
      const data = encodeFunctionData({
        abi: CBSW_ABI,
        functionName: 'addOwnerAddress',
        args: [address],
      }) as Hex
      const hash = await walletClient.sendTransaction({
        account: address,
        to: address,
        data,
        value: 0n,
        chain: base,
      })
      setTxStatus({ kind: 'ok', label: 'submitted', detail: hash })
    } catch (err: any) {
      const msg = String(err?.message ?? err)
      setTxStatus({ kind: 'err', label: classify(msg), detail: msg })
    }
  }

  async function runReset() {
    try {
      await disconnectAsync()
    } catch {
      /* already disconnected */
    }
    setConnectStatus(INITIAL)
    setSignStatus(INITIAL)
    setTxStatus(INITIAL)
  }

  const verdict = deriveVerdict({ connectStatus, signStatus, txStatus })

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-6 py-10 text-sm">
      <header className="space-y-2">
        <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-zinc-500">
          4626 · dev probe
        </div>
        <h1 className="text-2xl font-medium">Zora global-wallet connector probe</h1>
        <p className="text-zinc-400">
          Classifies whether Zora's Privy app has Connect-mode cross-app enabled for this
          4626 appId. Three steps, each isolates one Privy capability — so we can tell
          transactional-ok from read-only-refused from not-authorized.
        </p>
        <div className="rounded border border-zinc-800 bg-zinc-950/60 p-3 text-[11px] leading-relaxed text-zinc-400">
          <span className="font-mono uppercase tracking-wide text-zinc-300">
            Last result on file:
          </span>{' '}
          Bucket 2 (read-only) <em>and</em> the surfaced signer is a Privy embedded EOA
          that is not on the CBSW owner list. Conclusion: this connector is{' '}
          <strong className="text-zinc-200">not viable</strong> for adding 4626 as a CBSW
          owner. The right path for Zora users is the{' '}
          <code className="rounded bg-zinc-900 px-1">subAccount.canSetup</code> branch in{' '}
          <code className="rounded bg-zinc-900 px-1">useAccountSetupController</code>{' '}
          (Base Account SDK). Re-run this probe only if Privy/Zora change their cross-app
          config.
        </div>
      </header>

      {!flagOn ? (
        <div className="rounded border border-amber-900 bg-amber-950/30 p-4 text-amber-200">
          <div className="font-mono text-[11px] uppercase tracking-wide">probe disabled</div>
          <p className="mt-2 text-xs">
            Set <code className="rounded bg-zinc-900 px-1">VITE_ZORA_GLOBAL_WALLET_CONNECTOR=1</code>{' '}
            and ensure <code className="rounded bg-zinc-900 px-1">@privy-io/cross-app-connect</code>{' '}
            is installed, then reload. The connector will appear in wagmi's connector list.
          </p>
        </div>
      ) : null}

      <section className="space-y-1 rounded border border-zinc-800 bg-zinc-950 p-4">
        <Row k="Zora appId" v={ZORA_PRIVY_APP_ID} />
        <Row
          k="Connector registered"
          v={zoraConnector ? 'yes' : 'no — flag off or package missing'}
        />
        <Row k="Active wagmi connector" v={activeConnector?.id ?? '—'} />
        <Row k="Address" v={address ?? '—'} />
        <Row k="ChainId" v={chainId ? String(chainId) : '—'} />
        <Row
          k="isOwnerAddress(self)"
          v={
            isOwnerOfSelf === null
              ? '—'
              : isOwnerOfSelf
                ? 'true  (CBSW lists itself as owner — means smartWalletMode worked)'
                : 'false (likely an EOA, or not a CBSW)'
          }
        />
        <Row k="Bytecode" v={codeSizeHex ?? '—'} />
      </section>

      <section className="space-y-2">
        <Step
          title="1. Connect"
          status={connectStatus}
          cta={{
            label: 'Run connect',
            onClick: runConnect,
            disabled: !zoraConnector || connectStatus.kind === 'pending',
          }}
        />
        <Step
          title="2. signMessage via Zora popup"
          status={signStatus}
          cta={{
            label: 'Run signMessage',
            onClick: runSignMessage,
            disabled: !walletClient || signStatus.kind === 'pending',
          }}
        />
        <Step
          title="3. eth_sendTransaction → addOwnerAddress(self)"
          status={txStatus}
          cta={{
            label: 'Run self-addOwner',
            onClick: runSelfAddOwner,
            disabled: !walletClient || txStatus.kind === 'pending',
          }}
        />
      </section>

      <section className="space-y-1 rounded border border-zinc-700 bg-zinc-900/60 p-4">
        <div className="font-mono text-[10px] uppercase tracking-wide text-zinc-400">verdict</div>
        <div className="text-base text-zinc-100">{verdict.label}</div>
        <div className="text-xs text-zinc-400">{verdict.hint}</div>
      </section>

      <button
        type="button"
        className="text-xs text-zinc-500 underline hover:text-zinc-300"
        onClick={runReset}
      >
        disconnect & reset results
      </button>
    </div>
  )
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex gap-4 font-mono text-[11px] leading-5">
      <div className="w-44 shrink-0 uppercase tracking-[0.08em] text-zinc-500">{k}</div>
      <div className="break-all text-zinc-200">{v}</div>
    </div>
  )
}

function Step({
  title,
  status,
  cta,
}: {
  title: string
  status: StepStatus
  cta: { label: string; onClick: () => void; disabled?: boolean }
}) {
  const color =
    status.kind === 'ok'
      ? 'text-emerald-400'
      : status.kind === 'err'
        ? 'text-rose-400'
        : status.kind === 'pending'
          ? 'text-amber-300'
          : 'text-zinc-500'
  return (
    <div className="space-y-2 rounded border border-zinc-800 bg-zinc-950 p-3">
      <div className="flex items-center justify-between gap-4">
        <div className="font-mono text-[11px] uppercase tracking-wide text-zinc-200">{title}</div>
        <button
          type="button"
          className="rounded border border-zinc-700 px-2.5 py-1 text-xs text-zinc-200 hover:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-40"
          onClick={cta.onClick}
          disabled={cta.disabled}
        >
          {cta.label}
        </button>
      </div>
      <div className={`font-mono text-xs ${color}`}>{status.label}</div>
      {status.detail ? (
        <pre className="whitespace-pre-wrap break-all font-mono text-[10px] text-zinc-500">
          {status.detail}
        </pre>
      ) : null}
    </div>
  )
}

function classify(msg: string): string {
  const m = msg.toLowerCase()
  if (m.includes('read-only') || m.includes('read only') || m.includes('readonly')) {
    return 'read-only — Zora refused signing (bucket 2)'
  }
  if (
    m.includes('not authorized') ||
    m.includes('unauthorized') ||
    m.includes(' 401') ||
    m.includes(' 403')
  ) {
    return 'not authorized — 4626 appId not in Zora cross-app requester list (bucket 3)'
  }
  if (m.includes('user rejected') || m.includes('user denied') || m.includes('cancell')) {
    return 'user rejected in Zora popup'
  }
  if (m.includes('popup') && m.includes('block')) {
    return 'popup blocked by browser — allow popups for this origin'
  }
  if (m.includes('self calls are not allowed')) {
    return 'blocked by CBSW popup eGe self-call guard — smartWalletMode may be off'
  }
  return 'errored'
}

function deriveVerdict(s: {
  connectStatus: StepStatus
  signStatus: StepStatus
  txStatus: StepStatus
}): { label: string; hint: string } {
  if (s.connectStatus.kind === 'ok' && s.signStatus.kind === 'ok' && s.txStatus.kind === 'ok') {
    return {
      label: 'Bucket 1 — Full transactional Connect mode works',
      hint: 'Roll the connector to prod. The existing `onboardingWallet` Path-B UserOp flow will just work with the Zora CBSW as the connected wallet.',
    }
  }
  if (
    s.connectStatus.kind === 'ok' &&
    (s.signStatus.kind === 'err' || s.txStatus.kind === 'err')
  ) {
    return {
      label: 'Bucket 2 — Read-only: Zora shares address but refuses signatures',
      hint: 'No client-side fix. Ask Zora to flip off read-only mode for 4626 in their Privy dashboard, or ship a first-party Zora → 4626 flow.',
    }
  }
  if (s.connectStatus.kind === 'err') {
    return {
      label: 'Bucket 3 — Connect mode not authorized for this appId',
      hint: 'Ask Zora to add 4626 as an authorized cross-app requester. Until then, the pure-Zora user dead-end is unavoidable.',
    }
  }
  return {
    label: 'Run the three steps above to classify',
    hint: 'Each step isolates one Privy cross-app capability (connect → sign → tx).',
  }
}
