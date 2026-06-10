[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/lib/swap/swapDisplayAmount

# src/lib/swap/swapDisplayAmount

## Type Aliases

### SwapBalanceUnits

> **SwapBalanceUnits** = `object`

Defined in: [src/lib/swap/swapDisplayAmount.ts:5](https://github.com/wenakita/4626/blob/main/frontend/src/lib/swap/swapDisplayAmount.ts#L5)

#### Properties

##### decimals

> **decimals**: `number`

Defined in: [src/lib/swap/swapDisplayAmount.ts:7](https://github.com/wenakita/4626/blob/main/frontend/src/lib/swap/swapDisplayAmount.ts#L7)

##### raw

> **raw**: `bigint`

Defined in: [src/lib/swap/swapDisplayAmount.ts:6](https://github.com/wenakita/4626/blob/main/frontend/src/lib/swap/swapDisplayAmount.ts#L6)

## Functions

### amountUnitsFromBalancePercent()

> **amountUnitsFromBalancePercent**(`balance`, `percent`): `string`

Defined in: [src/lib/swap/swapDisplayAmount.ts:11](https://github.com/wenakita/4626/blob/main/frontend/src/lib/swap/swapDisplayAmount.ts#L11)

Sell amount from on-chain balance — never round up past `raw`.

#### Parameters

##### balance

[`SwapBalanceUnits`](#swapbalanceunits)

##### percent

`number`

#### Returns

`string`

***

### formatSwapDisplayAmount()

> **formatSwapDisplayAmount**(`raw`, `symbol?`): `string`

Defined in: [src/lib/swap/swapDisplayAmount.ts:90](https://github.com/wenakita/4626/blob/main/frontend/src/lib/swap/swapDisplayAmount.ts#L90)

Uniswap-like quoted output formatting — not for in-progress sell-side typing.

#### Parameters

##### raw

`string`

##### symbol?

`string`

#### Returns

`string`

***

### formatSwapTokenBalanceLabel()

> **formatSwapTokenBalanceLabel**(`raw`, `symbol?`): `string`

Defined in: [src/lib/swap/swapDisplayAmount.ts:40](https://github.com/wenakita/4626/blob/main/frontend/src/lib/swap/swapDisplayAmount.ts#L40)

Uniswap token-selector style balances: ~2 decimals for large holdings, up to 4–5 for
fractional amounts, stables pinned to cents when >= 1.

#### Parameters

##### raw

`string` | `number`

##### symbol?

`string`

#### Returns

`string`

***

### formatSwapTokenUsdLabel()

> **formatSwapTokenUsdLabel**(`value`): `string` \| `null`

Defined in: [src/lib/swap/swapDisplayAmount.ts:76](https://github.com/wenakita/4626/blob/main/frontend/src/lib/swap/swapDisplayAmount.ts#L76)

Uniswap token-selector USD line — always cents precision, comma grouped below $1M.

#### Parameters

##### value

`number` | `null` | `undefined`

#### Returns

`string` \| `null`

***

### parseSwapDisplayNumber()

> **parseSwapDisplayNumber**(`raw`): `number` \| `null`

Defined in: [src/lib/swap/swapDisplayAmount.ts:27](https://github.com/wenakita/4626/blob/main/frontend/src/lib/swap/swapDisplayAmount.ts#L27)

#### Parameters

##### raw

`string` | `number`

#### Returns

`number` \| `null`

***

### trimSwapAmountTrailingZeros()

> **trimSwapAmountTrailingZeros**(`value`): `string`

Defined in: [src/lib/swap/swapDisplayAmount.ts:22](https://github.com/wenakita/4626/blob/main/frontend/src/lib/swap/swapDisplayAmount.ts#L22)

#### Parameters

##### value

`string`

#### Returns

`string`
