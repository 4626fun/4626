import { useEffect, useMemo, useState } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { ROOM_CREATOR_COIN_DEFAULTS } from '@/lib/alfaclub/lpCreatorPlanner'
import { useAlfaClubLpCreatorPlanner } from '@/hooks/useAlfaClubLpCreatorPlanner'

function parseTokenId(value: string): bigint {
  const trimmed = value.trim()
  if (!/^\d+$/.test(trimmed)) return 0n
  const parsed = BigInt(trimmed)
  return parsed > 0n ? parsed : 0n
}

function formatUsd(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: value >= 100 ? 0 : 2,
  }).format(value)
}

function formatNumber(value: number | null | undefined, maximumFractionDigits = 4): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return value.toLocaleString('en-US', { maximumFractionDigits })
}

function formatAddress(value: string | null | undefined): string {
  if (!value) return '—'
  return `${value.slice(0, 6)}...${value.slice(-4)}`
}

function formatRoomType(value: string): string {
  if (value === 'trading') return 'Trading'
  if (value === 'social') return 'Social'
  return 'Unknown'
}

function routeLabel(prefersLp: boolean, side: 'buy' | 'sell'): string {
  if (side === 'buy') return prefersLp ? 'Pool is cheaper' : 'Room curve is cheaper'
  return prefersLp ? 'Pool pays more' : 'Room curve pays more'
}

function routeTone(prefersLp: boolean): string {
  return prefersLp
    ? 'bg-emerald-400/10 text-emerald-200 ring-emerald-400/20'
    : 'bg-amber-400/10 text-amber-200 ring-amber-400/20'
}

export function LpCreatorPlanner() {
  const [tokenIdInput, setTokenIdInput] = useState('1659')
  const [creatorCoinInput, setCreatorCoinInput] = useState(ROOM_CREATOR_COIN_DEFAULTS['1659'] ?? '')
  const [selectedKeys, setSelectedKeys] = useState(5)
  const [manualCreatorCoinAmount, setManualCreatorCoinAmount] = useState('')

  const tokenId = useMemo(() => parseTokenId(tokenIdInput), [tokenIdInput])
  const planner = useAlfaClubLpCreatorPlanner({
    tokenId,
    creatorCoin: creatorCoinInput,
    selectedKeys,
    manualCreatorCoinAmount,
  })

  useEffect(() => {
    const roomDefaultCoin = ROOM_CREATOR_COIN_DEFAULTS[tokenIdInput.trim()]
    if (roomDefaultCoin) setCreatorCoinInput(roomDefaultCoin)
  }, [tokenIdInput])

  useEffect(() => {
    const maxKeys = planner.roomMeta?.maxKeys ?? 20
    setSelectedKeys((current) => Math.max(2, Math.min(current, maxKeys)))
  }, [planner.roomMeta?.maxKeys])

  const selectedOutcome = planner.selectedOutcome
  const roomMeta = planner.roomMeta
  const hasValidInputs = tokenId > 0n && creatorCoinInput.trim().length > 0
  const isCustomAmount = manualCreatorCoinAmount.trim().length > 0
  const quickKeyChoices = useMemo(() => {
    const max = roomMeta?.maxKeys ?? 20
    return [...new Set([2, Math.min(5, max), Math.min(10, max), max])].filter(
      (keys) => keys >= 2,
    )
  }, [roomMeta?.maxKeys])

  return (
    <section className="mt-8 overflow-hidden rounded-3xl bg-black/35 ring-1 ring-white/[0.06]">
      <div className="border-b border-white/[0.06] p-5 sm:p-6">
        <div>
          <span className="label">Creator tool</span>
          <h2 className="mt-3 text-2xl font-semibold text-zinc-100 sm:text-3xl">
            Plan your key pool
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-400">
            Choose your room and how many keys you want to supply. We’ll calculate the Creator Coin
            amount that places your pool near the room’s current key price.
          </p>
        </div>
      </div>

      <div className="p-5 sm:p-6">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
          <div className="space-y-6">
            <div>
              <div className="flex items-center gap-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-sky-400/15 text-xs font-semibold text-sky-200">
                  1
                </span>
                <div>
                  <h3 className="text-sm font-semibold text-zinc-100">Choose your room</h3>
                  <p className="text-xs text-zinc-500">Enter the room’s FriendKey ID and Creator Coin.</p>
                </div>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-[140px_minmax(0,1fr)]">
                <label className="block">
                  <span className="text-xs text-zinc-400">Room ID</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={tokenIdInput}
                    onChange={(event) => setTokenIdInput(event.target.value)}
                    placeholder="1659"
                    className="mt-2 h-11 w-full rounded-xl bg-black/45 px-3 text-sm text-zinc-100 ring-1 ring-white/[0.08] outline-none transition focus:ring-sky-500/40"
                  />
                </label>
                <label className="block">
                  <span className="text-xs text-zinc-400">Creator Coin address</span>
                  <input
                    type="text"
                    value={creatorCoinInput}
                    onChange={(event) => setCreatorCoinInput(event.target.value)}
                    placeholder="0x..."
                    className="mt-2 h-11 w-full rounded-xl bg-black/45 px-3 font-mono text-xs text-zinc-100 ring-1 ring-white/[0.08] outline-none transition focus:ring-sky-500/40"
                  />
                </label>
              </div>
            </div>

            <div className="border-t border-white/[0.06] pt-6">
              <div className="flex items-center gap-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-sky-400/15 text-xs font-semibold text-sky-200">
                  2
                </span>
                <div>
                  <h3 className="text-sm font-semibold text-zinc-100">Choose how many keys to supply</h3>
                  <p className="text-xs text-zinc-500">More keys create a deeper pool with less price movement.</p>
                </div>
              </div>
              <div className="mt-5 flex items-end justify-between">
                <div>
                  <span className="text-4xl font-semibold tracking-tight text-white">{selectedKeys}</span>
                  <span className="ml-2 text-sm text-zinc-400">room keys</span>
                </div>
                <span className="text-xs text-zinc-500">Up to {roomMeta?.maxKeys ?? 20}</span>
              </div>
              <input
                aria-label="Keys supplied"
                type="range"
                min={2}
                max={roomMeta?.maxKeys ?? 20}
                step={1}
                value={selectedKeys}
                onChange={(event) => setSelectedKeys(Number(event.target.value))}
                className="mt-4 w-full accent-sky-400"
              />
              <div className="mt-3 flex flex-wrap gap-2">
                {quickKeyChoices.map((keys) => (
                  <button
                    key={keys}
                    type="button"
                    onClick={() => setSelectedKeys(keys)}
                    className={`rounded-full px-3 py-1.5 text-xs ring-1 transition ${
                      selectedKeys === keys
                        ? 'bg-sky-400/15 text-sky-100 ring-sky-400/30'
                        : 'bg-white/[0.03] text-zinc-400 ring-white/[0.08] hover:text-zinc-200'
                    }`}
                  >
                    {keys} keys
                  </button>
                ))}
              </div>
            </div>

            <details className="border-t border-white/[0.06] pt-5">
              <summary className="cursor-pointer text-xs font-medium text-zinc-400 hover:text-zinc-200">
                Advanced: try a custom Creator Coin amount
              </summary>
              <label className="mt-4 block">
                <span className="text-xs text-zinc-500">
                  Creator Coins to pair with {selectedKeys} keys
                </span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={manualCreatorCoinAmount}
                  onChange={(event) => setManualCreatorCoinAmount(event.target.value)}
                  placeholder="Leave blank for our recommendation"
                  className="mt-2 h-11 w-full rounded-xl bg-black/45 px-3 text-sm text-zinc-100 ring-1 ring-white/[0.08] outline-none transition focus:ring-sky-500/40"
                />
              </label>
              <p className="mt-2 text-xs leading-relaxed text-zinc-500">
                A custom amount changes the opening pool price. The chart continues to show the recommended
                curve-matched range.
              </p>
              {planner.manualOverrideInvalid ? (
                <p className="mt-2 text-xs text-amber-300">Enter a positive numeric amount.</p>
              ) : null}
            </details>
          </div>

          <div className="min-w-0">
            {!hasValidInputs ? (
              <div className="flex min-h-72 items-center justify-center rounded-2xl bg-white/[0.02] p-6 text-center ring-1 ring-white/[0.06]">
                <p className="max-w-sm text-sm text-zinc-500">
                  Enter a room ID and Creator Coin address to calculate a pool.
                </p>
              </div>
      ) : planner.loading ? (
              <div
                className="flex min-h-72 items-center justify-center rounded-2xl bg-white/[0.02] p-6 text-sm text-zinc-400 ring-1 ring-white/[0.06]"
                role="status"
              >
                Reading the room curve and Creator Coin price…
              </div>
      ) : planner.error ? (
              <div className="flex min-h-72 items-center justify-center rounded-2xl bg-red-400/[0.04] p-6 text-center ring-1 ring-red-400/10">
                <div>
                  <p className="text-sm text-red-200">We couldn’t calculate this pool.</p>
                  <p className="mt-1 max-w-sm text-xs text-zinc-500">
                    Check the room ID and Creator Coin address, then try again.
                  </p>
                </div>
              </div>
            ) : roomMeta && selectedOutcome ? (
              <div className="space-y-4">
                <div className="rounded-2xl bg-sky-400/[0.07] p-5 ring-1 ring-sky-400/20 sm:p-6">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-medium uppercase tracking-[0.14em] text-sky-200">
                      {isCustomAmount ? 'Your custom pool' : 'Recommended pairing'}
                    </span>
                    <span className="rounded-full bg-black/25 px-2.5 py-1 text-[11px] text-zinc-400">
                      Room #{roomMeta.tokenId.toString()} · {formatRoomType(roomMeta.roomTypeKey)}
                    </span>
                  </div>
                  <p className="mt-5 text-sm text-zinc-300">Pair</p>
                  <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <span className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                      {formatNumber(selectedOutcome.creatorCoinAmount, 2)}
                    </span>
                    <span className="text-lg font-medium text-sky-100">{roomMeta.creatorCoinSymbol}</span>
                  </div>
                  <p className="mt-2 text-sm text-zinc-400">
                    worth {formatUsd(selectedOutcome.creatorCoinUsd)}, with{' '}
                    <span className="font-medium text-zinc-200">{selectedOutcome.keys} room keys</span>
                  </p>
                  {!isCustomAmount ? (
                    <p className="mt-4 text-xs leading-relaxed text-zinc-500">
                      This opening ratio targets the midpoint between the room’s current buy and sell prices.
                    </p>
                  ) : null}
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl bg-white/[0.03] p-4 ring-1 ring-white/[0.06]">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-zinc-300">When someone buys 1 key</span>
                      <span className={`rounded-full px-2 py-1 text-[10px] ring-1 ${routeTone(selectedOutcome.buyPrefersLp)}`}>
                        {routeLabel(selectedOutcome.buyPrefersLp, 'buy')}
                      </span>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <p className="text-zinc-500">Your pool</p>
                        <p className="mt-1 text-base font-semibold text-zinc-100">
                          {formatUsd(selectedOutcome.lpBuyOneUsdc)}
                        </p>
                      </div>
                      <div>
                        <p className="text-zinc-500">Room curve</p>
                        <p className="mt-1 text-base font-semibold text-zinc-300">
                          {formatUsd(selectedOutcome.curveBuyOneUsdc)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl bg-white/[0.03] p-4 ring-1 ring-white/[0.06]">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-zinc-300">When someone sells 1 key</span>
                      <span className={`rounded-full px-2 py-1 text-[10px] ring-1 ${routeTone(selectedOutcome.sellPrefersLp)}`}>
                        {routeLabel(selectedOutcome.sellPrefersLp, 'sell')}
                      </span>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <p className="text-zinc-500">Your pool</p>
                        <p className="mt-1 text-base font-semibold text-zinc-100">
                          {formatUsd(selectedOutcome.lpSellOneUsdc)}
                        </p>
                      </div>
                      <div>
                        <p className="text-zinc-500">Room curve</p>
                        <p className="mt-1 text-base font-semibold text-zinc-300">
                          {formatUsd(selectedOutcome.curveSellOneUsdc)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex min-h-72 items-center justify-center rounded-2xl bg-white/[0.02] p-6 text-center ring-1 ring-white/[0.06]">
                <p className="max-w-sm text-sm text-zinc-500">
                  We found the room, but its Creator Coin price is not available yet.
                </p>
              </div>
            )}
          </div>
        </div>

        {roomMeta && planner.series.length > 0 ? (
          <div className="mt-8 border-t border-white/[0.06] pt-7">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h3 className="text-sm font-semibold text-zinc-100">How pool depth changes the price</h3>
                <p className="mt-1 text-xs text-zinc-500">
                  More keys narrow the gap between what buyers pay and sellers receive.
                </p>
              </div>
              <div className="flex flex-wrap gap-3 text-[11px] text-zinc-400">
                <span className="flex items-center gap-1.5">
                  <span className="h-0.5 w-4 bg-sky-400" /> Buyer pays
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-0.5 w-4 bg-emerald-400" /> Seller receives
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-0.5 w-4 border-t border-dashed border-amber-300" /> Curve midpoint
                </span>
              </div>
            </div>
            <div className="mt-4 h-[280px] w-full rounded-2xl bg-black/25 p-3 ring-1 ring-white/[0.06]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={planner.series} margin={{ top: 8, right: 12, bottom: 18, left: 0 }}>
                  <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis
                    dataKey="keys"
                    allowDecimals={false}
                    tick={{ fill: 'rgba(161,161,170,0.8)', fontSize: 11 }}
                    tickLine={false}
                    axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                    label={{
                      value: 'Keys supplied',
                      position: 'insideBottom',
                      offset: -8,
                      fill: 'rgba(113,113,122,0.9)',
                      fontSize: 10,
                    }}
                    height={38}
                  />
                  <YAxis
                    tick={{ fill: 'rgba(161,161,170,0.8)', fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => formatUsd(Number(value))}
                    width={64}
                  />
                  <Tooltip
                    contentStyle={{
                      background: 'rgba(9,9,11,0.96)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: 12,
                      fontSize: 12,
                    }}
                    labelFormatter={(keys) => `${String(keys)} keys supplied`}
                    formatter={(value: unknown, name: unknown) => [formatUsd(Number(value)), String(name)]}
                  />
                  <ReferenceLine
                    y={roomMeta.curveMidUsdc}
                    stroke="rgba(250,204,21,0.72)"
                    strokeDasharray="4 4"
                  />
                  <ReferenceLine
                    x={selectedKeys}
                    stroke="rgba(255,255,255,0.22)"
                    strokeDasharray="3 4"
                  />
                  <Line
                    type="monotone"
                    dataKey="lpBuyOneUsdc"
                    name="Buyer pays"
                    stroke="#38bdf8"
                    strokeWidth={2.5}
                    dot={false}
                    isAnimationActive={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="lpSellOneUsdc"
                    name="Seller receives"
                    stroke="#34d399"
                    strokeWidth={2.5}
                    dot={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-zinc-500">
              <span>
                {roomMeta.creatorCoinName} price: {formatUsd(roomMeta.creatorCoinUsdPrice)}
              </span>
              <span>Room keys outstanding: {roomMeta.totalSupply.toString()}</span>
              <span>Pool fee: {(roomMeta.feeBps / 100).toFixed(2)}%</span>
              <span>Creator: {formatAddress(roomMeta.creator)}</span>
            </div>
          </div>
        ) : null}

        <div className="mt-6 rounded-xl bg-white/[0.025] px-4 py-3 text-xs leading-relaxed text-zinc-500 ring-1 ring-white/[0.05]">
          This estimates an ERC-20 / ERC-1155 secondary market. It does not buy, mint, stake, or move
          keys. Prices can change before a pool is created.
        </div>
      </div>
    </section>
  )
}
