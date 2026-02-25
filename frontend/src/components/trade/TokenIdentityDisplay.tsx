import { useState } from 'react'

import { shortAddress, type TokenDisplay } from '@/lib/uniswap/swapUtils'

function TokenAvatar(props: { symbol: string; logoUrl: string | null; logoUrls?: string[] }) {
  const candidates = [
    props.logoUrl,
    ...(props.logoUrls ?? []),
  ].filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
  const uniqueCandidates = Array.from(new Set(candidates))
  const [idx, setIdx] = useState(0)
  const current = uniqueCandidates[idx] ?? null

  if (current) {
    return (
      <img
        src={current}
        alt={props.symbol}
        className="h-6 w-6 rounded-full object-cover border border-white/15 bg-black/30"
        loading="lazy"
        onError={() => setIdx((prev) => prev + 1)}
      />
    )
  }
  return (
    <div className="h-6 w-6 rounded-full border border-white/15 bg-zinc-800 text-[10px] font-semibold text-zinc-100 flex items-center justify-center">
      {props.symbol.slice(0, 1).toUpperCase()}
    </div>
  )
}

export function TokenIdentityDisplay({
  address,
  display,
  isLoading = false,
}: {
  address: string
  display: TokenDisplay
  isLoading?: boolean
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black/30 px-3 py-2">
      <div className="flex items-center gap-2 min-w-0">
        <TokenAvatar symbol={display.symbol} logoUrl={display.logoUrl} logoUrls={display.logoUrls} />
        <div className="min-w-0">
          <div className="text-xs text-zinc-200 truncate">
            {isLoading ? 'Resolving token metadata…' : display.name}
          </div>
          <div className="text-[11px] text-zinc-500">{display.symbol}</div>
        </div>
      </div>
      <div className="text-[11px] text-zinc-500 font-mono">{shortAddress(address)}</div>
    </div>
  )
}

