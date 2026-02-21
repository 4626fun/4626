import type { ReactNode } from 'react'

import { ArrowDown } from 'lucide-react'

import { ConnectButtonWeb3 } from '@/components/ConnectButtonWeb3'
import { TokenIdentityDisplay } from '@/components/trade/TokenIdentityDisplay'
import { formatDisplayAmount, type TokenDisplay, type TokenOption } from '@/lib/uniswap/swapUtils'

export function SwapPanel(props: {
  tokenOptions: TokenOption[]
  tokenIn: string
  tokenOut: string
  tokenInDisplay: TokenDisplay
  tokenOutDisplay: TokenDisplay
  tokenInIdentityLoading: boolean
  tokenOutIdentityLoading: boolean
  amountInUnits: string
  estimatedOut: string
  tokenInSymbol: string
  tokenOutSymbol: string
  parsedSlippage: number
  isConnected: boolean
  identityReady: boolean
  isReady: boolean
  busy: string | null
  quoteIsStale: boolean
  status: string
  error: string
  showAdvanced: boolean
  slippagePct: string
  deadlineMinutes: string
  approvalRequired: boolean
  hasQuote: boolean
  hasSwapTx: boolean
  lifecycle: ReactNode
  onSetTokenIn: (next: string) => void
  onSetTokenOut: (next: string) => void
  onSetAmountInUnits: (next: string) => void
  onSetSlippagePct: (next: string) => void
  onSetDeadlineMinutes: (next: string) => void
  onSwitchTokens: () => void
  onReviewTrade: () => void
  onQuote: () => void
  onCheckApproval: () => void
  onBuildSwap: () => void
  onOpenApprovalConfirm: () => void
  onOpenSwapConfirm: () => void
  onRefreshQuote: () => void
}) {
  const coreOptions = props.tokenOptions.filter((opt) => opt.group === 'core')
  const ecosystemOptions = props.tokenOptions.filter((opt) => opt.group !== 'core')

  return (
    <>
      <div className="space-y-2 rounded-2xl border border-white/10 bg-[#101114]/90 p-4">
        <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">Sell</div>
        <div className="flex items-end justify-between gap-3">
          <input
            className="w-full bg-transparent text-4xl leading-none font-medium text-white outline-none"
            value={props.amountInUnits}
            onChange={(e) => props.onSetAmountInUnits(e.target.value)}
            placeholder="0.0"
          />
          <select
            value={props.tokenIn}
            onChange={(e) => props.onSetTokenIn(e.target.value)}
            className="rounded-full border border-white/20 bg-[#15161b] px-3 py-2 text-sm font-medium text-white"
          >
            <optgroup label="Core tokens">
              {coreOptions.map((opt) => (
                <option key={opt.address} value={opt.address}>{`${opt.symbol} - ${opt.name}`}</option>
              ))}
            </optgroup>
            <optgroup label="Creator ecosystem">
              {ecosystemOptions.map((opt) => (
                <option key={opt.address} value={opt.address}>{`${opt.symbol} - ${opt.name}`}</option>
              ))}
            </optgroup>
          </select>
        </div>
        <TokenIdentityDisplay
          address={props.tokenIn}
          display={props.tokenInDisplay}
          isLoading={props.tokenInIdentityLoading}
        />
      </div>

      <div className="relative z-10 -my-3 flex justify-center">
        <button
          type="button"
          onClick={props.onSwitchTokens}
          className="rounded-xl border border-white/20 bg-[#15161b] p-2 text-zinc-300 transition hover:text-white"
          title="Switch tokens"
        >
          <ArrowDown className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-2 rounded-2xl border border-white/10 bg-[#101114]/90 p-4">
        <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">Buy</div>
        <div className="flex items-end justify-between gap-3">
          <div className="w-full text-4xl leading-none font-medium text-white">
            {props.estimatedOut ? formatDisplayAmount(props.estimatedOut) : '0.0'}
          </div>
          <select
            value={props.tokenOut}
            onChange={(e) => props.onSetTokenOut(e.target.value)}
            className="rounded-full border border-white/20 bg-[#15161b] px-3 py-2 text-sm font-medium text-white"
          >
            <optgroup label="Core tokens">
              {coreOptions.map((opt) => (
                <option key={opt.address} value={opt.address}>{`${opt.symbol} - ${opt.name}`}</option>
              ))}
            </optgroup>
            <optgroup label="Creator ecosystem">
              {ecosystemOptions.map((opt) => (
                <option key={opt.address} value={opt.address}>{`${opt.symbol} - ${opt.name}`}</option>
              ))}
            </optgroup>
          </select>
        </div>
        <TokenIdentityDisplay
          address={props.tokenOut}
          display={props.tokenOutDisplay}
          isLoading={props.tokenOutIdentityLoading}
        />
      </div>

      <button
        type="button"
        onClick={props.onReviewTrade}
        disabled={
          !props.isConnected ||
          !props.identityReady ||
          !props.isReady ||
          props.busy !== null ||
          props.quoteIsStale ||
          props.tokenInIdentityLoading ||
          props.tokenOutIdentityLoading
        }
        className="mt-4 w-full rounded-2xl bg-fuchsia-500 px-4 py-3 text-lg font-semibold text-white transition hover:bg-fuchsia-400 disabled:opacity-50"
      >
        {props.busy === 'review' ? 'Reviewing…' : 'Review trade'}
      </button>
      {props.tokenIn.toLowerCase() === props.tokenOut.toLowerCase() ? (
        <div className="mt-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
          Choose two different tokens to generate a quote.
        </div>
      ) : null}

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-zinc-400">
        <div className="rounded-xl border border-white/10 bg-white/3 px-3 py-2">
          Pair: {props.tokenInSymbol} / {props.tokenOutSymbol}
        </div>
        <div className="rounded-xl border border-white/10 bg-white/3 px-3 py-2 text-right">
          Slippage {props.parsedSlippage}%
        </div>
      </div>
      {props.status ? <div className="mt-2 text-xs text-emerald-300">{props.status}</div> : null}
      {props.error ? <div className="mt-2 text-xs text-rose-300">{props.error}</div> : null}
      {!props.isConnected ? (
        <div className="mt-3">
          <ConnectButtonWeb3 />
        </div>
      ) : null}
      {props.isConnected && !props.identityReady ? (
        <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          Connect an owner signer for your canonical smart wallet to trade.
        </div>
      ) : null}

      {props.showAdvanced ? (
        <div className="mt-4 space-y-3 rounded-2xl border border-white/10 bg-black/25 p-3">
          <div>
            <label className="label">Slippage %</label>
            <input
              className="mt-1 w-full rounded-xl border border-zinc-700 bg-black/30 px-3 py-2 text-xs"
              value={props.slippagePct}
              onChange={(e) => props.onSetSlippagePct(e.target.value)}
              placeholder="0.5"
            />
          </div>
          <div>
            <label className="label">Deadline (minutes)</label>
            <input
              className="mt-1 w-full rounded-xl border border-zinc-700 bg-black/30 px-3 py-2 text-xs"
              value={props.deadlineMinutes}
              onChange={(e) => props.onSetDeadlineMinutes(e.target.value)}
              placeholder="15"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={props.onQuote}
              disabled={props.busy !== null || !props.identityReady}
              className="rounded-full border border-zinc-700 px-3 py-1.5 text-[11px] disabled:opacity-50"
            >
              Quote
            </button>
            <button
              type="button"
              onClick={props.onCheckApproval}
              disabled={props.busy !== null || !props.identityReady}
              className="rounded-full border border-zinc-700 px-3 py-1.5 text-[11px] disabled:opacity-50"
            >
              Approval
            </button>
            <button
              type="button"
              onClick={props.onBuildSwap}
              disabled={props.busy !== null || !props.hasQuote}
              className="rounded-full border border-zinc-700 px-3 py-1.5 text-[11px] disabled:opacity-50"
            >
              Build
            </button>
            <button
              type="button"
              onClick={props.onOpenApprovalConfirm}
              disabled={props.busy !== null || !props.approvalRequired}
              className="rounded-full border border-zinc-700 px-3 py-1.5 text-[11px] disabled:opacity-50"
            >
              Approve now
            </button>
            <button
              type="button"
              onClick={props.onOpenSwapConfirm}
              disabled={props.busy !== null || !props.hasSwapTx}
              className="rounded-full border border-zinc-700 px-3 py-1.5 text-[11px] disabled:opacity-50"
            >
              Swap now
            </button>
          </div>
        </div>
      ) : null}
      {props.quoteIsStale ? (
        <button
          type="button"
          onClick={props.onRefreshQuote}
          disabled={props.busy !== null || !props.identityReady}
          className="mt-2 rounded-full border border-amber-400/40 px-3 py-1 text-xs text-amber-200 disabled:opacity-50"
        >
          Refresh quote
        </button>
      ) : null}
      {props.lifecycle}
    </>
  )
}

