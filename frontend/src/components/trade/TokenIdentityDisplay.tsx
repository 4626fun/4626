import { shortAddress, type TokenDisplay } from '@/lib/uniswap/swapUtils'
import { TokenLogo } from '@/components/ui/TokenLogo'

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
        <TokenLogo symbol={display.symbol} logoUrl={display.logoUrl} logoUrls={display.logoUrls} size="sm" />
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

