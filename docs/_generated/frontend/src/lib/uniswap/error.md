[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/lib/uniswap/error

# src/lib/uniswap/error

## Type Aliases

### NormalizedUniswapError

> **NormalizedUniswapError** = `object`

Defined in: [src/lib/uniswap/error.ts:15](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/error.ts#L15)

#### Properties

##### code

> **code**: [`UniswapErrorCode`](#uniswaperrorcode)

Defined in: [src/lib/uniswap/error.ts:16](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/error.ts#L16)

##### message

> **message**: `string`

Defined in: [src/lib/uniswap/error.ts:17](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/error.ts#L17)

##### retryable

> **retryable**: `boolean`

Defined in: [src/lib/uniswap/error.ts:18](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/error.ts#L18)

***

### UniswapErrorCode

> **UniswapErrorCode** = `"INSUFFICIENT_FUNDS"` \| `"INSUFFICIENT_GAS"` \| `"AUTH_REQUIRED"` \| `"APPROVAL_REQUIRED"` \| `"QUOTE_EXPIRED"` \| `"CHAIN_MISMATCH"` \| `"SLIPPAGE_EXCEEDED"` \| `"RATE_LIMITED"` \| `"WALLET_REJECTED"` \| `"NONCE_CONFLICT"` \| `"NETWORK_TIMEOUT"` \| `"UNKNOWN"`

Defined in: [src/lib/uniswap/error.ts:1](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/error.ts#L1)

## Functions

### normalizeUniswapError()

> **normalizeUniswapError**(`input`): [`NormalizedUniswapError`](#normalizeduniswaperror)

Defined in: [src/lib/uniswap/error.ts:27](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/error.ts#L27)

#### Parameters

##### input

`unknown`

#### Returns

[`NormalizedUniswapError`](#normalizeduniswaperror)
