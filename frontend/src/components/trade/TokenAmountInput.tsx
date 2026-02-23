import { TokenIdentityDisplay } from '@/components/trade/TokenIdentityDisplay'
import { formatDisplayAmount, type TokenDisplay, type TokenOption } from '@/lib/uniswap/swapUtils'

type TokenAmountInputProps = {
  label: string
  amount: string
  token: string
  tokenOptions: TokenOption[]
  display: TokenDisplay
  isLoading: boolean
  onAmountChange?: (next: string) => void
  onTokenChange: (next: string) => void
  amountPlaceholder?: string
  readOnlyAmount?: boolean
  fiatValueLabel?: string
  balanceLabel?: string
}

export function TokenAmountInput(props: TokenAmountInputProps) {
  const coreOptions = props.tokenOptions.filter((opt) => opt.group === 'core')
  const ecosystemOptions = props.tokenOptions.filter((opt) => opt.group !== 'core')

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">{props.label}</div>
        <div className="text-[11px] text-zinc-500">{props.balanceLabel ?? 'Balance --'}</div>
      </div>
      <div className="grid grid-cols-[1fr_auto] items-end gap-3">
        {props.readOnlyAmount ? (
          <div className="min-h-[52px] text-4xl leading-none font-semibold text-white tabular-nums">
            {props.amount ? formatDisplayAmount(props.amount) : props.amountPlaceholder || '0.0'}
          </div>
        ) : (
          <input
            inputMode="decimal"
            className="min-h-[52px] w-full bg-transparent text-4xl leading-none font-semibold text-white outline-none placeholder:text-zinc-600"
            value={props.amount}
            onChange={(e) => props.onAmountChange?.(e.target.value)}
            placeholder={props.amountPlaceholder ?? '0.0'}
          />
        )}
        <select
          value={props.token}
          onChange={(e) => props.onTokenChange(e.target.value)}
          className="min-h-11 rounded-full border border-white/20 bg-black/30 px-3 py-2 text-sm font-medium text-white"
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
      <div className="text-xs text-zinc-500">{props.fiatValueLabel ?? '≈ -- USD'}</div>
      <TokenIdentityDisplay address={props.token} display={props.display} isLoading={props.isLoading} />
    </div>
  )
}
