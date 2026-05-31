import { useCallback, useMemo, useState } from 'react'

import { sanitizeDecimalInput, sanitizeIntegerInput } from '@/lib/uniswap/swapUtils'

/** UI slippage input may go higher on thin creator pools; policy may still cap via env. */
export const SWAP_SLIPPAGE_UI_MAX_PCT = 50

export function parseSwapSlippagePct(slippagePct: string): number {
  const n = Number(slippagePct)
  if (!Number.isFinite(n) || n <= 0) return 0.5
  return Math.min(SWAP_SLIPPAGE_UI_MAX_PCT, n)
}

export function useSwapState(params: {
  initialTokenIn: string
  initialTokenOut: string
}) {
  const [tokenIn, setTokenIn] = useState<string>(params.initialTokenIn)
  const [tokenOut, setTokenOut] = useState<string>(params.initialTokenOut)
  const [amountInUnits, setAmountInUnitsState] = useState<string>('1')
  const [slippagePct, setSlippagePctState] = useState<string>('0.5')
  const [activePanel, setActivePanel] = useState<'swap' | 'liquidity'>('swap')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [deadlineMinutes, setDeadlineMinutesState] = useState<string>('15')

  const setAmountInUnits = useCallback((value: string) => {
    setAmountInUnitsState(sanitizeDecimalInput(value, 18))
  }, [])

  const setSlippagePct = useCallback((value: string) => {
    setSlippagePctState(sanitizeDecimalInput(value, 2))
  }, [])

  const setDeadlineMinutes = useCallback((value: string) => {
    setDeadlineMinutesState(sanitizeIntegerInput(value, 3))
  }, [])

  const parsedSlippage = useMemo(() => parseSwapSlippagePct(slippagePct), [slippagePct])

  const parsedDeadlineMinutes = useMemo(() => {
    const n = Number(deadlineMinutes)
    if (!Number.isFinite(n) || n <= 0) return 15
    return Math.min(30, n)
  }, [deadlineMinutes])

  function switchTokens() {
    setTokenIn(tokenOut)
    setTokenOut(tokenIn)
  }

  return {
    tokenIn,
    setTokenIn,
    tokenOut,
    setTokenOut,
    amountInUnits,
    setAmountInUnits,
    slippagePct,
    setSlippagePct,
    activePanel,
    setActivePanel,
    showAdvanced,
    setShowAdvanced,
    deadlineMinutes,
    setDeadlineMinutes,
    parsedSlippage,
    parsedDeadlineMinutes,
    switchTokens,
  }
}

