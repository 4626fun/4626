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

  const chartData = useMemo(
    () =>
      planner.series.map((point) => ({
        ...point,
        creatorCoinChartValue: point.creatorCoinUsd,
      })),
    [planner.series],
  )

  const selectedOutcome = planner.selectedOutcome
  const roomMeta = planner.roomMeta
  const hasValidInputs = tokenId > 0n && creatorCoinInput.trim().length > 0

  return (
    <section className="mt-8 rounded-3xl bg-black/35 p-5 ring-1 ring-white/[0.06] sm:p-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <span className="label">Secondary-market seed planner</span>
          <h2 className="mt-3 text-2xl font-semibold text-zinc-100 sm:text-3xl">LP planner</h2>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-zinc-400">
            Model how many Creator Coins you would pair with deposited FriendKeys before opening a pool.
            This planner sizes a secondary-market seed and compares LP pricing against the live bonding
            curve. It does not mint keys for you.
          </p>
        </div>
        <div className="rounded-2xl bg-white/[0.03] px-4 py-3 text-xs text-zinc-400 ring-1 ring-white/[0.06]">
          Default room mapping includes room <span className="font-semibold text-zinc-200">1659</span>.
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <label className="block">
          <span className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">Room token ID</span>
          <input
            type="text"
            inputMode="numeric"
            value={tokenIdInput}
            onChange={(event) => setTokenIdInput(event.target.value)}
            placeholder="1659"
            className="mt-2 h-11 w-full rounded-2xl bg-black/45 px-4 text-sm text-zinc-100 ring-1 ring-white/[0.08] outline-none transition focus:ring-sky-500/40"
          />
        </label>

        <label className="block">
          <span className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">Creator coin</span>
          <input
            type="text"
            value={creatorCoinInput}
            onChange={(event) => setCreatorCoinInput(event.target.value)}
            placeholder="0x..."
            className="mt-2 h-11 w-full rounded-2xl bg-black/45 px-4 font-mono text-sm text-zinc-100 ring-1 ring-white/[0.08] outline-none transition focus:ring-sky-500/40"
          />
        </label>

        <label className="block xl:col-span-2">
          <span className="flex items-center justify-between text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">
            <span>Keys deposited</span>
            <span className="text-zinc-300">
              {selectedKeys} / {roomMeta?.maxKeys ?? 20}
            </span>
          </span>
          <input
            type="range"
            min={2}
            max={roomMeta?.maxKeys ?? 20}
            step={1}
            value={selectedKeys}
            onChange={(event) => setSelectedKeys(Number(event.target.value))}
            className="mt-4 w-full accent-sky-400"
          />
          <p className="mt-2 text-xs text-zinc-500">
            Planner series uses default key counts from 2 up to{' '}
            <span className="text-zinc-300">{roomMeta?.maxKeys ?? 20}</span>.
          </p>
        </label>
      </div>

      <label className="mt-4 block">
        <span className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">
          Manual creator-coin override
        </span>
        <input
          type="text"
          inputMode="decimal"
          value={manualCreatorCoinAmount}
          onChange={(event) => setManualCreatorCoinAmount(event.target.value)}
          placeholder="Optional human amount for the selected key count"
          className="mt-2 h-11 w-full rounded-2xl bg-black/45 px-4 text-sm text-zinc-100 ring-1 ring-white/[0.08] outline-none transition focus:ring-sky-500/40"
        />
        <p className="mt-2 text-xs text-zinc-500">
          Leave blank to curve-match automatically. If you enter an amount, only the selected-key outcome
          card uses the override.
        </p>
      </label>

      {planner.manualOverrideInvalid ? (
        <p className="mt-3 text-sm text-amber-300">Enter a valid creator-coin amount to use the manual override.</p>
      ) : null}

      {!hasValidInputs ? (
        <p className="mt-6 text-sm text-zinc-500">Enter a room token ID and creator coin to load the planner.</p>
      ) : planner.loading ? (
        <p className="mt-6 text-sm text-zinc-400" role="status">
          Loading room pricing, creator coin metadata, and Zora spot price…
        </p>
      ) : planner.error ? (
        <p className="mt-6 text-sm text-red-300" role="alert">
          Unable to load planner inputs: {planner.error.message}
        </p>
      ) : roomMeta ? (
        <>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
            <div className="rounded-2xl bg-white/[0.03] p-4 ring-1 ring-white/[0.06]">
              <div className="text-[11px] uppercase tracking-[0.14em] text-zinc-500">Room type</div>
              <div className="mt-2 text-sm font-semibold text-zinc-100">{formatRoomType(roomMeta.roomTypeKey)}</div>
              <div className="mt-1 text-xs text-zinc-500">Tier {roomMeta.roomTier ?? '—'}</div>
            </div>
            <div className="rounded-2xl bg-white/[0.03] p-4 ring-1 ring-white/[0.06]">
              <div className="text-[11px] uppercase tracking-[0.14em] text-zinc-500">Outstanding keys</div>
              <div className="mt-2 text-sm font-semibold text-zinc-100">{roomMeta.totalSupply.toString()}</div>
              <div className="mt-1 text-xs text-zinc-500">Planner cap {roomMeta.maxKeys}</div>
            </div>
            <div className="rounded-2xl bg-white/[0.03] p-4 ring-1 ring-white/[0.06]">
              <div className="text-[11px] uppercase tracking-[0.14em] text-zinc-500">Curve buy 1 key</div>
              <div className="mt-2 text-sm font-semibold text-zinc-100">{formatUsd(roomMeta.curveBuyOneUsdc)}</div>
              <div className="mt-1 text-xs text-zinc-500">After fee</div>
            </div>
            <div className="rounded-2xl bg-white/[0.03] p-4 ring-1 ring-white/[0.06]">
              <div className="text-[11px] uppercase tracking-[0.14em] text-zinc-500">Curve sell 1 key</div>
              <div className="mt-2 text-sm font-semibold text-zinc-100">{formatUsd(roomMeta.curveSellOneUsdc)}</div>
              <div className="mt-1 text-xs text-zinc-500">After fee</div>
            </div>
            <div className="rounded-2xl bg-white/[0.03] p-4 ring-1 ring-white/[0.06]">
              <div className="text-[11px] uppercase tracking-[0.14em] text-zinc-500">Creator coin</div>
              <div className="mt-2 text-sm font-semibold text-zinc-100">{roomMeta.creatorCoinSymbol}</div>
              <div className="mt-1 truncate font-mono text-xs text-zinc-500">{roomMeta.creatorCoin}</div>
            </div>
            <div className="rounded-2xl bg-white/[0.03] p-4 ring-1 ring-white/[0.06]">
              <div className="text-[11px] uppercase tracking-[0.14em] text-zinc-500">Spot USD</div>
              <div className="mt-2 text-sm font-semibold text-zinc-100">
                {formatUsd(roomMeta.creatorCoinUsdPrice)}
              </div>
              <div className="mt-1 text-xs text-zinc-500">Zora reference</div>
            </div>
          </div>

          {chartData.length === 0 ? (
            <div className="mt-6 rounded-2xl bg-white/[0.03] p-5 ring-1 ring-white/[0.06]">
              <p className="text-sm text-zinc-400">
                This room loaded, but the planner could not resolve a Creator Coin USD price from Zora yet.
              </p>
            </div>
          ) : (
            <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.8fr)_minmax(320px,1fr)]">
              <div className="rounded-3xl bg-black/25 p-4 ring-1 ring-white/[0.06]">
                <div className="mb-3 flex flex-col gap-1">
                  <h3 className="text-sm font-semibold text-zinc-100">Seed curve</h3>
                  <p className="text-xs text-zinc-500">
                    Deposit size vs. estimated LP entry/exit pricing for one key.
                  </p>
                </div>
                <div className="h-[320px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 8, right: 12, bottom: 16, left: 0 }}>
                      <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                      <XAxis
                        dataKey="keys"
                        allowDecimals={false}
                        tick={{ fill: 'rgba(161,161,170,0.8)', fontSize: 11 }}
                        tickLine={false}
                        axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                      />
                      <YAxis
                        tick={{ fill: 'rgba(161,161,170,0.8)', fontSize: 11 }}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(value) => formatNumber(Number(value), 2)}
                        width={64}
                      />
                      <Tooltip
                        contentStyle={{
                          background: 'rgba(9,9,11,0.96)',
                          border: '1px solid rgba(255,255,255,0.08)',
                          borderRadius: 16,
                          fontSize: 12,
                        }}
                        formatter={(value: unknown, name: unknown) => {
                          const numeric = Number(value)
                          if (name === 'Creator coin deposit') {
                            return [formatUsd(numeric), String(name)]
                          }
                          return [formatUsd(numeric), String(name)]
                        }}
                      />
                      <ReferenceLine
                        y={roomMeta.curveMidUsdc}
                        stroke="rgba(250,204,21,0.8)"
                        strokeDasharray="4 4"
                        label={{
                          value: 'Curve midpoint',
                          position: 'insideTopRight',
                          fill: 'rgba(250,204,21,0.9)',
                          fontSize: 10,
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="creatorCoinChartValue"
                        name="Creator coin deposit"
                        stroke="#f59e0b"
                        strokeWidth={2.5}
                        dot={false}
                        isAnimationActive={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="lpBuyOneUsdc"
                        name="LP buy 1 key"
                        stroke="#38bdf8"
                        strokeWidth={2.5}
                        dot={false}
                        isAnimationActive={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="lpSellOneUsdc"
                        name="LP sell 1 key"
                        stroke="#34d399"
                        strokeWidth={2.5}
                        dot={false}
                        isAnimationActive={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="rounded-3xl bg-black/25 p-4 ring-1 ring-white/[0.06]">
                <div className="mb-4">
                  <h3 className="text-sm font-semibold text-zinc-100">Selected outcome</h3>
                  <p className="mt-1 text-xs text-zinc-500">
                    Snapshot for {selectedOutcome?.keys ?? selectedKeys} deposited keys in room #{roomMeta.tokenId.toString()}.
                  </p>
                </div>

                {selectedOutcome ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl bg-white/[0.03] p-4 ring-1 ring-white/[0.06]">
                      <div className="text-[11px] uppercase tracking-[0.14em] text-zinc-500">Coin to deposit</div>
                      <div className="mt-2 text-base font-semibold text-zinc-100">
                        {formatNumber(selectedOutcome.creatorCoinAmount)} {roomMeta.creatorCoinSymbol}
                      </div>
                    </div>
                    <div className="rounded-2xl bg-white/[0.03] p-4 ring-1 ring-white/[0.06]">
                      <div className="text-[11px] uppercase tracking-[0.14em] text-zinc-500">Deposit value</div>
                      <div className="mt-2 text-base font-semibold text-zinc-100">
                        {formatUsd(selectedOutcome.creatorCoinUsd)}
                      </div>
                    </div>
                    <div className="rounded-2xl bg-white/[0.03] p-4 ring-1 ring-white/[0.06]">
                      <div className="text-[11px] uppercase tracking-[0.14em] text-zinc-500">LP buy vs curve</div>
                      <div className="mt-2 text-base font-semibold text-zinc-100">
                        {formatUsd(selectedOutcome.lpBuyOneUsdc)} vs {formatUsd(selectedOutcome.curveBuyOneUsdc)}
                      </div>
                    </div>
                    <div className="rounded-2xl bg-white/[0.03] p-4 ring-1 ring-white/[0.06]">
                      <div className="text-[11px] uppercase tracking-[0.14em] text-zinc-500">LP sell vs curve</div>
                      <div className="mt-2 text-base font-semibold text-zinc-100">
                        {formatUsd(selectedOutcome.lpSellOneUsdc)} vs {formatUsd(selectedOutcome.curveSellOneUsdc)}
                      </div>
                    </div>
                    <div className="rounded-2xl bg-white/[0.03] p-4 ring-1 ring-white/[0.06]">
                      <div className="text-[11px] uppercase tracking-[0.14em] text-zinc-500">Buyers prefer</div>
                      <div className="mt-2 text-base font-semibold text-zinc-100">
                        {selectedOutcome.buyPrefersLp ? 'LP / buy from pool' : 'Mint / buy from curve'}
                      </div>
                    </div>
                    <div className="rounded-2xl bg-white/[0.03] p-4 ring-1 ring-white/[0.06]">
                      <div className="text-[11px] uppercase tracking-[0.14em] text-zinc-500">Sellers prefer</div>
                      <div className="mt-2 text-base font-semibold text-zinc-100">
                        {selectedOutcome.sellPrefersLp ? 'LP / burn into pool' : 'Curve / sell to protocol'}
                      </div>
                    </div>
                    <div className="rounded-2xl bg-white/[0.03] p-4 ring-1 ring-white/[0.06]">
                      <div className="text-[11px] uppercase tracking-[0.14em] text-zinc-500">Curve midpoint</div>
                      <div className="mt-2 text-base font-semibold text-zinc-100">
                        {formatUsd(selectedOutcome.curveMidUsdc)}
                      </div>
                    </div>
                    <div className="rounded-2xl bg-white/[0.03] p-4 ring-1 ring-white/[0.06]">
                      <div className="text-[11px] uppercase tracking-[0.14em] text-zinc-500">Pool fee</div>
                      <div className="mt-2 text-base font-semibold text-zinc-100">{selectedOutcome.feeBps} bps</div>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-zinc-400">
                    A selected outcome will appear here once room pricing and the Creator Coin spot price are available.
                  </p>
                )}

                <div className="mt-4 rounded-2xl bg-sky-500/10 p-4 text-sm text-sky-100 ring-1 ring-sky-400/20">
                  Use this to seed a secondary market around live curve pricing, then decide whether LP buys and
                  sells look better than minting or burning directly.
                </div>
              </div>
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-zinc-500">
            <span>Creator: {formatAddress(roomMeta.creator)}</span>
            <span>Creator coin name: {roomMeta.creatorCoinName}</span>
            <span>Fee lane: {roomMeta.feeBps} bps</span>
          </div>
        </>
      ) : null}
    </section>
  )
}
