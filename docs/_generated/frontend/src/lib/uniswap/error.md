[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/lib/uniswap/error

# src/lib/uniswap/error

## Type Aliases

### NormalizedUniswapError

> **NormalizedUniswapError** = `object`

Defined in: [src/lib/uniswap/error.ts:17](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/uniswap/error.ts#L17)

#### Properties

##### code

> **code**: [`UniswapErrorCode`](#uniswaperrorcode)

Defined in: [src/lib/uniswap/error.ts:18](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/uniswap/error.ts#L18)

##### message

> **message**: `string`

Defined in: [src/lib/uniswap/error.ts:19](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/uniswap/error.ts#L19)

##### retryable

> **retryable**: `boolean`

Defined in: [src/lib/uniswap/error.ts:20](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/uniswap/error.ts#L20)

***

### UniswapErrorCode

> **UniswapErrorCode** = `"INSUFFICIENT_FUNDS"` \| `"INSUFFICIENT_GAS"` \| `"AUTH_REQUIRED"` \| `"FORBIDDEN_ORIGIN"` \| `"APPROVAL_REQUIRED"` \| `"QUOTE_EXPIRED"` \| `"CHAIN_MISMATCH"` \| `"SLIPPAGE_EXCEEDED"` \| `"RATE_LIMITED"` \| `"RPC_UNAVAILABLE"` \| `"WALLET_REJECTED"` \| `"NONCE_CONFLICT"` \| `"NETWORK_TIMEOUT"` \| `"UNKNOWN"`

Defined in: [src/lib/uniswap/error.ts:1](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/uniswap/error.ts#L1)

## Functions

### normalizeUniswapError()

> **normalizeUniswapError**(`input`): [`NormalizedUniswapError`](#normalizeduniswaperror)

Defined in: [src/lib/uniswap/error.ts:29](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/uniswap/error.ts#L29)

#### Parameters

##### input

`unknown`

#### Returns

[`NormalizedUniswapError`](#normalizeduniswaperror)
