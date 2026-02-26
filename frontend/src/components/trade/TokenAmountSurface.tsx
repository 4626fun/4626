import { useState } from 'react'
import { motion } from 'framer-motion'
import { TokenSelectorPill, TokenSelectorSheet } from '@/components/trade/TokenSelectorSheet'
import { Skeleton } from '@/components/ui/Skeleton'
import { formatDisplayAmount, type TokenDisplay, type TokenOption } from '@/lib/uniswap/swapUtils'

type TokenAmountSurfaceProps = {
  label: 'You pay' | 'You receive'
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
  showMax?: boolean
  onMax?: () => void
  className?: string
}

export function TokenAmountSurface(props: TokenAmountSurfaceProps) {
  const [sheetOpen, setSheetOpen] = useState(false)

  const displayedAmount = props.readOnlyAmount
    ? props.amount
      ? formatDisplayAmount(props.amount)
      : props.amountPlaceholder ?? '0'
    : undefined

  return (
    <>
      <div
        className={`rounded-2xl border border-white/8 bg-vault-card/60 px-3.5 pt-3 pb-3 backdrop-blur-xl ${props.className ?? ''}`}
      >
        {/* Header row */}
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-[10px] font-medium text-zinc-500">
            {props.label}
          </span>
          <div className="flex items-center gap-2">
            {props.showMax && props.onMax && (
              <motion.button
                type="button"
                onClick={props.onMax}
                whileTap={{ scale: 0.94 }}
                className="rounded-full border border-white/8 bg-white/5 px-2 py-0.5 text-[9px] font-medium text-zinc-300 transition hover:bg-white/10 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-primary"
              >
                Max
              </motion.button>
            )}
            <span className="text-[10px] text-zinc-500 tabular-nums">
              {props.balanceLabel ?? 'Balance --'}
            </span>
          </div>
        </div>

        {/* Amount + token selector row */}
        <div className="flex items-center gap-2">
          {props.readOnlyAmount ? (
            <div
              className={`flex min-h-[48px] flex-1 items-center font-semibold tabular-nums leading-none ${
                props.amount
                  ? 'text-[2.15rem] text-white'
                  : 'text-[2.15rem] text-zinc-700'
              }`}
            >
              {props.isLoading ? (
                <Skeleton className="h-8 w-28" />
              ) : (
                displayedAmount
              )}
            </div>
          ) : (
            <input
              inputMode="decimal"
              autoComplete="off"
              className="min-h-[48px] w-full flex-1 bg-transparent text-[2.15rem] font-semibold leading-none text-white outline-none placeholder:text-zinc-700 tabular-nums"
              value={props.amount}
              onChange={(e) => props.onAmountChange?.(e.target.value)}
              placeholder={props.amountPlaceholder ?? '0'}
            />
          )}

          <TokenSelectorPill
            display={props.display}
            onClick={() => setSheetOpen(true)}
          />
        </div>

        {/* Footer row: fiat estimate */}
        <div className="mt-1 text-[10px] text-zinc-500 tabular-nums">
          {props.isLoading ? (
            <Skeleton className="inline-block h-3 w-20" />
          ) : (
            props.fiatValueLabel ?? '≈ -- USD'
          )}
        </div>
      </div>

      <TokenSelectorSheet
        open={sheetOpen}
        tokenOptions={props.tokenOptions}
        selectedToken={props.token}
        onSelect={props.onTokenChange}
        onClose={() => setSheetOpen(false)}
      />
    </>
  )
}
