/**
 * Uniswap interface number rules (TokenTx / SwapTradeAmount).
 * @see https://github.com/Uniswap/interface/blob/main/packages/utilities/src/format/localeBasedFormats.ts
 */

function trimSwapAmountTrailingZeros(value: string): string {
  if (!value.includes('.')) return value
  return value.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '')
}

const LOCALE = 'en-US'
const TOKEN_AMOUNT_DISPLAY_FLOOR = 0.00001

type FormatCreator = {
  createFormat: (locale: string) => Intl.NumberFormat
}

type FormatterRule =
  | {
      exact: number
      formatter: string | FormatCreator
      overrideValue?: number
      postFormatModifier?: (formatted: string) => string
    }
  | {
      upperBound: number
      formatter: string | FormatCreator
      overrideValue?: number
      postFormatModifier?: (formatted: string) => string
    }

type Formatter = {
  rules: FormatterRule[]
  defaultFormat: string | FormatCreator
}

function nDecimals(decimals: number): FormatCreator {
  return {
    createFormat: (locale) =>
      new Intl.NumberFormat(locale, {
        notation: 'standard',
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }),
  }
}

const TwoDecimals = nDecimals(2)
const ThreeDecimals = nDecimals(3)
const FiveDecimals = nDecimals(5)

const FiveDecimalsMaxTwoDecimalsMin: FormatCreator = {
  createFormat: (locale) =>
    new Intl.NumberFormat(locale, {
      notation: 'standard',
      maximumFractionDigits: 5,
      minimumFractionDigits: 2,
    }),
}

const FiveDecimalsMaxTwoDecimalsMinNoCommas: FormatCreator = {
  createFormat: (locale) =>
    new Intl.NumberFormat(locale, {
      notation: 'standard',
      maximumFractionDigits: 5,
      minimumFractionDigits: 2,
      useGrouping: false,
    }),
}

const SixSigFigsTwoDecimals: FormatCreator = {
  createFormat: (locale) =>
    new Intl.NumberFormat(locale, {
      notation: 'standard',
      maximumSignificantDigits: 6,
      minimumSignificantDigits: 3,
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    }),
}

const SixSigFigsNoCommas: FormatCreator = {
  createFormat: (locale) =>
    new Intl.NumberFormat(locale, {
      notation: 'standard',
      maximumSignificantDigits: 6,
      useGrouping: false,
    }),
}

const SixSigFigsTwoDecimalsNoCommas: FormatCreator = {
  createFormat: (locale) =>
    new Intl.NumberFormat(locale, {
      notation: 'standard',
      maximumSignificantDigits: 6,
      minimumSignificantDigits: 3,
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
      useGrouping: false,
    }),
}

const lessThanPostFormatModifier = (formatted: string) => `<${formatted}`

/** Wallet balance chip on the swap card (Uniswap NumberType.TokenTx). */
const tokenTxFormatter: Formatter = {
  rules: [
    { exact: 0, formatter: '0' },
    {
      upperBound: TOKEN_AMOUNT_DISPLAY_FLOOR,
      overrideValue: TOKEN_AMOUNT_DISPLAY_FLOOR,
      formatter: FiveDecimals,
      postFormatModifier: lessThanPostFormatModifier,
    },
    { upperBound: 1, formatter: FiveDecimalsMaxTwoDecimalsMin },
    { upperBound: 10_000, formatter: SixSigFigsTwoDecimals },
    { upperBound: Infinity, formatter: TwoDecimals },
  ],
  defaultFormat: SixSigFigsTwoDecimals,
}

/** Read-only swap input / quote amount (Uniswap NumberType.SwapTradeAmount). */
const swapTradeAmountFormatter: Formatter = {
  rules: [
    { exact: 0, formatter: '0' },
    { upperBound: 0.1, formatter: SixSigFigsNoCommas },
    { upperBound: 1, formatter: FiveDecimalsMaxTwoDecimalsMinNoCommas },
    { upperBound: Infinity, formatter: SixSigFigsTwoDecimalsNoCommas },
  ],
  defaultFormat: SixSigFigsTwoDecimalsNoCommas,
}

function getFormatterRule(input: number, formatter: Formatter): FormatterRule {
  for (const rule of formatter.rules) {
    if ('exact' in rule && rule.exact !== undefined && input === rule.exact) {
      return rule
    }
    if ('upperBound' in rule && rule.upperBound !== undefined && input < rule.upperBound) {
      return rule
    }
  }
  return { formatter: formatter.defaultFormat }
}

function applyFormatterRule(input: number, rule: FormatterRule): string {
  if (typeof rule.formatter === 'string') {
    return rule.formatter
  }
  const value = rule.overrideValue !== undefined ? rule.overrideValue : input
  const formatted = rule.formatter.createFormat(LOCALE).format(value)
  return rule.postFormatModifier ? rule.postFormatModifier(formatted) : formatted
}

function formatWithRules(input: number, formatter: Formatter): string {
  if (!Number.isFinite(input)) return '0'
  const rule = getFormatterRule(input, formatter)
  return applyFormatterRule(input, rule)
}

/** Swap-card wallet balance (e.g. 1,100 USDC, 0.55309 akita, 103,300,000 akita). */
export function formatUniswapTokenBalanceAmount(input: number): string {
  return trimSwapAmountTrailingZeros(formatWithRules(input, tokenTxFormatter))
}

/** Read-only swap quote output field (commas optional per Uniswap trade-amount rules). */
export function formatUniswapSwapTradeAmount(input: number): string {
  return trimSwapAmountTrailingZeros(formatWithRules(input, swapTradeAmountFormatter))
}
