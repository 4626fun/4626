import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { usePublicClient } from 'wagmi'
import { base } from 'viem/chains'
import {
  encodeFunctionData,
  formatEther,
  parseEther,
  parseAbi,
  type PublicClient,
  type Hex,
} from 'viem'

import { Button } from '@/components/ui/Button'
import { PageMeta } from '@/components/seo/PageMeta'
import { useAccountSetupController } from '@/features/accountSetup/useAccountSetupController'
import { appendBuilderSuffixToHex } from '@/lib/base/baseBuilderCodes'
import { detectInAppEnvironment } from '@/lib/wallet/inAppBrowser'
import { RELAY_DEPOSITORY_BASE } from '@/lib/wallet/cswOwnerAbi'

// ───────────────────────────────────────────────────────────────────────────
// Constants
// ───────────────────────────────────────────────────────────────────────────

/** EntryPoint v0.6 on Base (and all chains; deterministic deployment). */
const ENTRY_POINT_V06 = '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789' as const

/**
 * EntryPoint v0.6 deposit balance accessor. `balanceOf` returns the per-account
 * native deposit the EntryPoint holds, in wei. This is what the EntryPoint
 * draws from to pay for UserOps when `paymasterAndData === '0x'`.
 *
 * Source: https://github.com/eth-infinitism/account-abstraction/blob/releases/v0.6/contracts/core/StakeManager.sol
 */
const ENTRY_POINT_ABI = parseAbi([
  'function balanceOf(address account) view returns (uint256)',
  'function depositTo(address account) payable',
])

// ───────────────────────────────────────────────────────────────────────────
// Types
// ───────────────────────────────────────────────────────────────────────────

type Balances = {
  status: 'idle' | 'loading' | 'ready' | 'error'
  cswEth: bigint | null
  entryPointDeposit: bigint | null
  relayDepositoryTotal: bigint | null
  block: bigint | null
  error: string | null
}

const INITIAL_BALANCES: Balances = {
  status: 'idle',
  cswEth: null,
  entryPointDeposit: null,
  relayDepositoryTotal: null,
  block: null,
  error: null,
}

// ───────────────────────────────────────────────────────────────────────────
// Page
// ───────────────────────────────────────────────────────────────────────────

/**
 * `/csw-funding` — read-only diagnostics + top-up form for the canonical CSW's
 * funding sources on Base. Three balances matter for a UserOp lane to succeed
 * without a paymaster:
 *
 *   1. **CSW ETH balance** — falls back to this when paymasterAndData === '0x'
 *      AND EntryPoint deposit isn't pre-funded. The EntryPoint sweeps the CSW's
 *      external balance during `_validatePrepayment`.
 *
 *   2. **EntryPoint deposit attributed to the CSW** — `EntryPoint.balanceOf(csw)`.
 *      When non-zero, the EntryPoint draws gas from this internal accounting
 *      bucket instead of touching the CSW's external balance. Top up via
 *      `EntryPoint.depositTo(csw)` payable with native ETH.
 *
 *      Reference UserOp where this worked:
 *      https://basescan.org/tx/0x34edd28dd9611f4e06374dfe87645de4fc3fd94c83f96b5b1406c6ee10d2aadf
 *      (UserOp 0xa6b54357…b4c3 — paymaster=0x000…, paid 0.00000106 ETH from
 *      EntryPoint deposit. The Deposited event added 0.00000182 ETH; this
 *      UserOp drained 0.00000106 ETH from it.)
 *
 *   3. **RelayDepository total balance** — aggregate across all users, not just
 *      this CSW's credit. RelayDepository doesn't expose per-user balanceOf
 *      on its public ABI, so we surface the contract's total balance for
 *      visibility only. To see THIS CSW's per-order credits, look at the
 *      RelayNativeDeposit events emitted by the depository.
 *
 * Top-up form posts `EntryPoint.depositTo(csw)` payable with a user-supplied
 * amount. The connected wallet pays \u2014 it can be anyone, not just an owner of
 * the CSW. Anyone can credit a smart wallet's EntryPoint deposit.
 */
export function CswFundingPage() {
  const [searchParams] = useSearchParams()
  const returnPath = searchParams.get('return')?.trim() || '/accounts'
  const fundingMode = searchParams.get('mode')?.trim().toLowerCase() ?? ''
  const suggestedAmount = searchParams.get('amount')?.trim() ?? ''

  const controller = useAccountSetupController({ zoraReturnPath: '/csw-funding' })
  const { canonicalCswAddress, loading, privyAuthed, login, ownerSignerAddress } =
    controller

  const inAppEnv = useMemo(() => detectInAppEnvironment(), [])
  const publicClient = usePublicClient({ chainId: base.id }) as PublicClient | undefined

  const [balances, setBalances] = useState<Balances>(INITIAL_BALANCES)

  // Top-up form state
  const [amountEthInput, setAmountEthInput] = useState('0.0001')
  const [nativeAmountEthInput, setNativeAmountEthInput] = useState('0.002')
  const [topUpBusy, setTopUpBusy] = useState(false)
  const [nativeTopUpBusy, setNativeTopUpBusy] = useState(false)
  const [topUpError, setTopUpError] = useState<string | null>(null)
  const [nativeTopUpError, setNativeTopUpError] = useState<string | null>(null)
  const [topUpTxHash, setTopUpTxHash] = useState<string | null>(null)
  const [nativeTopUpTxHash, setNativeTopUpTxHash] = useState<string | null>(null)

  useEffect(() => {
    if (suggestedAmount && /^\d+(\.\d+)?$/.test(suggestedAmount)) {
      setNativeAmountEthInput(suggestedAmount)
      if (fundingMode === 'native') {
        setAmountEthInput(suggestedAmount)
      }
    }
  }, [fundingMode, suggestedAmount])

  // Read all three balances together. We re-read after a successful top-up so
  // the user sees the new EntryPoint deposit reflected immediately.
  const refreshBalances = useCallback(async () => {
    if (!canonicalCswAddress || !publicClient) return
    setBalances((prev) => ({ ...prev, status: 'loading', error: null }))
    try {
      const csw = canonicalCswAddress as `0x${string}`
      const [cswEth, depositBn, relayTotal, blockNumber] = await Promise.all([
        publicClient.getBalance({ address: csw }),
        publicClient.readContract({
          address: ENTRY_POINT_V06,
          abi: ENTRY_POINT_ABI,
          functionName: 'balanceOf',
          args: [csw],
        }),
        publicClient.getBalance({ address: RELAY_DEPOSITORY_BASE }),
        publicClient.getBlockNumber(),
      ])
      setBalances({
        status: 'ready',
        cswEth,
        entryPointDeposit: depositBn as bigint,
        relayDepositoryTotal: relayTotal,
        block: blockNumber,
        error: null,
      })
    } catch (err) {
      setBalances({
        status: 'error',
        cswEth: null,
        entryPointDeposit: null,
        relayDepositoryTotal: null,
        block: null,
        error: err instanceof Error ? err.message : String(err ?? ''),
      })
    }
  }, [canonicalCswAddress, publicClient])

  useEffect(() => {
    void refreshBalances()
  }, [refreshBalances])

  // Parse the user-typed amount. Returns null if the input isn't a valid
  // positive ETH decimal we can format. We accept '0.0001', '0', '1.5', etc.
  const amountWei = useMemo(() => {
    const trimmed = amountEthInput.trim()
    if (!trimmed) return null
    if (!/^\d+(\.\d+)?$/.test(trimmed)) return null
    try {
      const wei = parseEther(trimmed)
      if (wei <= 0n) return null
      return wei
    } catch {
      return null
    }
  }, [amountEthInput])

  const nativeAmountWei = useMemo(() => {
    const trimmed = nativeAmountEthInput.trim()
    if (!trimmed) return null
    if (!/^\d+(\.\d+)?$/.test(trimmed)) return null
    try {
      const wei = parseEther(trimmed)
      if (wei <= 0n) return null
      return wei
    } catch {
      return null
    }
  }, [nativeAmountEthInput])

  const handleTopUp = useCallback(async () => {
    if (!canonicalCswAddress || !ownerSignerAddress) {
      setTopUpError('Connect a wallet first.')
      return
    }
    if (!amountWei) {
      setTopUpError('Enter a positive ETH amount.')
      return
    }
    setTopUpBusy(true)
    setTopUpError(null)
    setTopUpTxHash(null)
    try {
      // EntryPoint.depositTo(csw) payable. The caller's wallet pays from its
      // own native balance; the EntryPoint credits the CSW's internal balance.
      const data: Hex = encodeFunctionData({
        abi: ENTRY_POINT_ABI,
        functionName: 'depositTo',
        args: [canonicalCswAddress as `0x${string}`],
      })
      const attributedData = appendBuilderSuffixToHex(data, { chainId: base.id }) ?? data
      // eth_sendTransaction returns a tx hash. value goes as hex.
      const provider = (window as unknown as {
        ethereum?: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> }
      }).ethereum
      if (!provider?.request) {
        throw new Error('No injected wallet provider found. Open this page in a wallet browser.')
      }
      const valueHex = `0x${amountWei.toString(16)}`
      const txHash = (await provider.request({
        method: 'eth_sendTransaction',
        params: [
          {
            from: ownerSignerAddress,
            to: ENTRY_POINT_V06,
            data: attributedData,
            value: valueHex,
          },
        ],
      })) as `0x${string}`
      if (!txHash || typeof txHash !== 'string' || !txHash.startsWith('0x')) {
        throw new Error('Wallet did not return a transaction hash.')
      }
      setTopUpTxHash(txHash)
      // Refresh balances after a short delay so the on-chain state has time to
      // settle. We don't await inclusion here \u2014 user can see the pending tx
      // hash linked to Basescan immediately.
      setTimeout(() => void refreshBalances(), 3000)
    } catch (err) {
      setTopUpError(err instanceof Error ? err.message : String(err ?? ''))
    } finally {
      setTopUpBusy(false)
    }
  }, [amountWei, canonicalCswAddress, ownerSignerAddress, refreshBalances])

  const handleNativeTopUp = useCallback(async () => {
    if (!canonicalCswAddress || !ownerSignerAddress) {
      setNativeTopUpError('Connect a wallet first.')
      return
    }
    if (!nativeAmountWei) {
      setNativeTopUpError('Enter a positive ETH amount.')
      return
    }
    setNativeTopUpBusy(true)
    setNativeTopUpError(null)
    setNativeTopUpTxHash(null)
    try {
      const provider = (window as unknown as {
        ethereum?: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> }
      }).ethereum
      if (!provider?.request) {
        throw new Error('No injected wallet provider found. Open this page in a wallet browser.')
      }
      const valueHex = `0x${nativeAmountWei.toString(16)}`
      const txHash = (await provider.request({
        method: 'eth_sendTransaction',
        params: [
          {
            from: ownerSignerAddress,
            to: canonicalCswAddress,
            value: valueHex,
          },
        ],
      })) as `0x${string}`
      if (!txHash || typeof txHash !== 'string' || !txHash.startsWith('0x')) {
        throw new Error('Wallet did not return a transaction hash.')
      }
      setNativeTopUpTxHash(txHash)
      setTimeout(() => void refreshBalances(), 3000)
    } catch (err) {
      setNativeTopUpError(err instanceof Error ? err.message : String(err ?? ''))
    } finally {
      setNativeTopUpBusy(false)
    }
  }, [canonicalCswAddress, nativeAmountWei, ownerSignerAddress, refreshBalances])

  const fmt = (wei: bigint | null) => (wei == null ? '\u2014' : `${formatEther(wei)} ETH`)

  return (
    <div className="relative min-h-0 w-full bg-transparent text-white">
      <PageMeta
        title="CSW funding"
        description="Diagnose and top up your canonical Coinbase Smart Wallet's funding sources on Base: native balance, EntryPoint deposit, and RelayDepository balance."
        canonicalPath="/csw-funding"
      />
      <div className="mx-auto w-full max-w-2xl px-6 py-16 space-y-6">
        <div>
          <Link
            to={returnPath.startsWith('/') ? returnPath : '/accounts'}
            className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 hover:text-zinc-300"
          >
            ← Back to setup
          </Link>
          <h1 className="mt-2 text-2xl font-semibold">CSW funding</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Live diagnostics for funding sources on Base. For Relay owner install, the CSW needs
            enough <span className="text-zinc-300">native ETH</span> to cover the Relay deposit plus
            a small gas buffer. EntryPoint deposit helps other UserOp paths but does not substitute
            for the Relay deposit amount.
          </p>
          {fundingMode === 'native' && suggestedAmount ? (
            <p className="mt-2 text-xs text-brand-100/90">
              Suggested send: <span className="font-mono">{suggestedAmount} ETH</span> on Base to your
              canonical CSW below.
            </p>
          ) : null}
        </div>

        {!privyAuthed ? (
          <div className="rounded-2xl border border-white/10 bg-black/40 p-6 space-y-3">
            <p className="text-sm text-zinc-300">
              Connect first to see balances for your canonical CSW.
            </p>
            <Button type="button" variant="primary" onClick={() => void login()}>
              Connect
            </Button>
          </div>
        ) : null}

        {privyAuthed && loading ? (
          <div className="rounded-2xl border border-white/10 bg-black/40 p-6 text-sm text-zinc-400">
            Loading your account…
          </div>
        ) : null}

        {privyAuthed && !loading && !canonicalCswAddress ? (
          <div className="rounded-2xl border border-white/10 bg-black/40 p-6 text-sm text-zinc-400">
            No canonical CSW linked yet. Head to{' '}
            <Link to="/accounts" className="underline underline-offset-2">
              /accounts
            </Link>{' '}
            to connect one.
          </div>
        ) : null}

        {privyAuthed && !loading && canonicalCswAddress ? (
          <>
            {/* Identity */}
            <div className="card rounded-2xl border border-white/10 bg-black/40 p-6 space-y-3">
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
                  </dd>
                </div>
              </dl>
            </div>

            {/* Balances */}
            <div className="card rounded-2xl border border-white/10 bg-black/40 p-6 space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">
                  Funding sources
                </div>
                <div className="text-[10px] text-zinc-500">
                  {balances.status === 'loading'
                    ? 'loading…'
                    : balances.status === 'error'
                      ? 'error'
                      : balances.block != null
                        ? `block ${balances.block.toString()}`
                        : ''}
                </div>
              </div>

              {balances.status === 'error' ? (
                <div className="rounded-xl border border-rose-400/25 bg-rose-500/10 p-3 text-xs text-rose-100 break-all">
                  {balances.error}
                </div>
              ) : null}

              <ul className="space-y-2">
                <li className="rounded-xl border border-white/10 bg-black/30 p-3 text-xs space-y-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-medium text-zinc-200">
                      CSW native ETH balance
                    </span>
                    <span className="font-mono text-zinc-300">{fmt(balances.cswEth)}</span>
                  </div>
                  <p className="text-[10px] text-zinc-500 leading-relaxed">
                    Falls back to this when{' '}
                    <code className="font-mono">paymasterAndData</code> is empty
                    AND the EntryPoint deposit is insufficient. EntryPoint sweeps
                    this during <code className="font-mono">_validatePrepayment</code>.
                  </p>
                </li>

                <li className="rounded-xl border border-emerald-400/20 bg-emerald-500/5 p-3 text-xs space-y-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-medium text-emerald-100">
                      EntryPoint deposit (CSW)
                    </span>
                    <span className="font-mono text-emerald-100">
                      {fmt(balances.entryPointDeposit)}
                    </span>
                  </div>
                  <p className="text-[10px] text-emerald-100/70 leading-relaxed">
                    The bucket EntryPoint draws from first when{' '}
                    <code className="font-mono">paymasterAndData</code> is empty.
                    Top up via{' '}
                    <code className="font-mono">EntryPoint.depositTo(csw)</code>{' '}
                    payable below. Anyone can credit this on the CSW&apos;s behalf.
                  </p>
                </li>

                <li className="rounded-xl border border-white/10 bg-black/30 p-3 text-xs space-y-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-medium text-zinc-200">
                      RelayDepository total (all users)
                    </span>
                    <span className="font-mono text-zinc-300">
                      {fmt(balances.relayDepositoryTotal)}
                    </span>
                  </div>
                  <p className="text-[10px] text-zinc-500 leading-relaxed">
                    Aggregate ETH held by the depository \u2014 your CSW&apos;s
                    per-order credits live in <code className="font-mono">RelayNativeDeposit</code>{' '}
                    events, not in a per-user storage slot. Visible here for
                    sanity-checking when funding Relay-backed owner removal on{' '}
                    <Link to="/remove-owner" className="underline underline-offset-2">
                      /remove-owner
                    </Link>
                    .
                  </p>
                </li>
              </ul>

              <button
                type="button"
                onClick={() => void refreshBalances()}
                disabled={balances.status === 'loading'}
                className="text-[10px] uppercase tracking-[0.18em] text-zinc-400 hover:text-zinc-200"
              >
                Refresh balances
              </button>
            </div>

            {/* Native ETH top-up — required for Relay Part 1 depositNative */}
            <div className="card rounded-2xl border border-brand-primary/25 bg-brand-primary/5 p-6 space-y-3">
              <div className="text-[10px] uppercase tracking-[0.18em] text-brand-100/80">
                Top up CSW native balance (Relay)
              </div>
              <p className="text-xs text-zinc-300 leading-relaxed">
                Sends a plain native ETH transfer to your canonical CSW on Base. Relay Part 1 reads
                this balance for <code className="font-mono">depositNative</code>. Use Coinbase / Base
                App send if your connected wallet is the CSW itself and cannot pay a simple transfer.
              </p>

              <label className="block text-xs text-zinc-300">
                Amount (ETH)
                <input
                  type="text"
                  inputMode="decimal"
                  value={nativeAmountEthInput}
                  onChange={(e) => setNativeAmountEthInput(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-white/15 bg-black/50 px-3 py-2 font-mono text-sm text-white outline-none focus:border-white/35"
                  placeholder="0.002"
                  disabled={nativeTopUpBusy}
                />
              </label>

              <Button
                type="button"
                variant="primary"
                onClick={() => void handleNativeTopUp()}
                disabled={nativeTopUpBusy || !nativeAmountWei || !ownerSignerAddress}
              >
                {nativeTopUpBusy
                  ? 'Sending ETH…'
                  : !ownerSignerAddress
                    ? 'Connect a wallet first'
                    : !nativeAmountWei
                      ? 'Enter a positive ETH amount'
                      : `Send ${nativeAmountEthInput} ETH to CSW`}
              </Button>

              {nativeTopUpError ? (
                <div className="rounded-xl border border-rose-400/25 bg-rose-500/10 p-3 text-xs text-rose-100 break-all">
                  {nativeTopUpError}
                </div>
              ) : null}

              {nativeTopUpTxHash ? (
                <div className="rounded-xl border border-emerald-400/25 bg-emerald-500/10 p-3 text-xs text-emerald-100 break-all">
                  Submitted:{' '}
                  <a
                    href={`https://basescan.org/tx/${nativeTopUpTxHash}`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono underline"
                  >
                    {nativeTopUpTxHash}
                  </a>
                </div>
              ) : null}
            </div>

            {/* Top-up form */}
            <div className="card rounded-2xl border border-white/10 bg-black/40 p-6 space-y-3">
              <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">
                Top up EntryPoint deposit
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Sends an{' '}
                <code className="font-mono text-zinc-300">
                  EntryPoint.depositTo(csw)
                </code>{' '}
                tx from the connected wallet. The wallet pays in native ETH; the
                EntryPoint credits the CSW&apos;s internal deposit. The connected
                signer does NOT need to be a CSW owner \u2014 anyone can credit a
                smart wallet&apos;s EntryPoint deposit.
              </p>

              <label className="block text-xs text-zinc-300">
                Amount (ETH)
                <input
                  type="text"
                  inputMode="decimal"
                  value={amountEthInput}
                  onChange={(e) => setAmountEthInput(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-white/15 bg-black/50 px-3 py-2 font-mono text-sm text-white outline-none focus:border-white/35"
                  placeholder="0.0001"
                  disabled={topUpBusy}
                />
              </label>

              <Button
                type="button"
                variant="primary"
                onClick={() => void handleTopUp()}
                disabled={topUpBusy || !amountWei || !ownerSignerAddress}
              >
                {topUpBusy
                  ? 'Submitting deposit…'
                  : !ownerSignerAddress
                    ? 'Connect a wallet first'
                    : !amountWei
                      ? 'Enter a positive ETH amount'
                      : `Deposit ${amountEthInput} ETH to EntryPoint`}
              </Button>

              {topUpError ? (
                <div className="rounded-xl border border-rose-400/25 bg-rose-500/10 p-3 text-xs text-rose-100 break-all">
                  {topUpError}
                </div>
              ) : null}

              {topUpTxHash ? (
                <div className="rounded-xl border border-emerald-400/25 bg-emerald-500/10 p-3 text-xs text-emerald-100 break-all">
                  Submitted:{' '}
                  <a
                    href={`https://basescan.org/tx/${topUpTxHash}`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono underline"
                  >
                    {topUpTxHash}
                  </a>
                  <div className="mt-1 text-[10px] text-emerald-100/70">
                    Balances refresh automatically in a few seconds.
                  </div>
                </div>
              ) : null}

              {inAppEnv?.isAnyWalletInApp ? (
                <p className="text-[10px] leading-relaxed text-zinc-500">
                  In-app browser detected. Top-up uses a plain{' '}
                  <code className="font-mono">eth_sendTransaction</code>, which
                  works in any wallet. If your CSW is itself the connected
                  account, your wallet may route this through its native UserOp
                  flow (signing locally with the on-device passkey).
                </p>
              ) : null}
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}

export default CswFundingPage
