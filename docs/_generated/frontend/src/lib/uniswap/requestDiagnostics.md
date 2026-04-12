[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/lib/uniswap/requestDiagnostics

# src/lib/uniswap/requestDiagnostics

## Type Aliases

### UniswapRequestFailure

> **UniswapRequestFailure** = `object`

Defined in: [src/lib/uniswap/requestDiagnostics.ts:9](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/requestDiagnostics.ts#L9)

#### Properties

##### code

> **code**: [`UniswapRequestFailureCode`](#uniswaprequestfailurecode-1)

Defined in: [src/lib/uniswap/requestDiagnostics.ts:10](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/requestDiagnostics.ts#L10)

##### message

> **message**: `string`

Defined in: [src/lib/uniswap/requestDiagnostics.ts:12](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/requestDiagnostics.ts#L12)

##### status

> **status**: `number` \| `null`

Defined in: [src/lib/uniswap/requestDiagnostics.ts:11](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/requestDiagnostics.ts#L11)

***

### UniswapRequestFailureCode

> **UniswapRequestFailureCode** = `"auth-required"` \| `"forbidden"` \| `"rate-limited"` \| `"not-configured"` \| `"http-error"` \| `"network-error"`

Defined in: [src/lib/uniswap/requestDiagnostics.ts:1](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/requestDiagnostics.ts#L1)

## Functions

### classifyUniswapRequestFailure()

> **classifyUniswapRequestFailure**(`status`): [`UniswapRequestFailure`](#uniswaprequestfailure)

Defined in: [src/lib/uniswap/requestDiagnostics.ts:18](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/requestDiagnostics.ts#L18)

#### Parameters

##### status

`number` | `null`

#### Returns

[`UniswapRequestFailure`](#uniswaprequestfailure)

***

### extractGraphqlOperationName()

> **extractGraphqlOperationName**(`query`): `string` \| `null`

Defined in: [src/lib/uniswap/requestDiagnostics.ts:79](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/requestDiagnostics.ts#L79)

#### Parameters

##### query

`string`

#### Returns

`string` \| `null`

***

### warnUniswapRequestOnce()

> **warnUniswapRequestOnce**(`params`): `void`

Defined in: [src/lib/uniswap/requestDiagnostics.ts:61](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/requestDiagnostics.ts#L61)

#### Parameters

##### params

###### detail?

`string` \| `null`

###### failure

[`UniswapRequestFailure`](#uniswaprequestfailure)

###### scope

`string`

#### Returns

`void`
