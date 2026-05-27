[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/lib/swap/useSwapSubAccountRuntime

# src/lib/swap/useSwapSubAccountRuntime

## Type Aliases

### SubAccountRuntimeState

> **SubAccountRuntimeState** = `object`

Defined in: [src/lib/swap/useSwapSubAccountRuntime.ts:12](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/swap/useSwapSubAccountRuntime.ts#L12)

#### Properties

##### message

> **message**: `string` \| `null`

Defined in: [src/lib/swap/useSwapSubAccountRuntime.ts:16](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/swap/useSwapSubAccountRuntime.ts#L16)

##### provider

> **provider**: \{ `request`: (`args`) => `Promise`\<`unknown`\>; \} \| `null`

Defined in: [src/lib/swap/useSwapSubAccountRuntime.ts:14](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/swap/useSwapSubAccountRuntime.ts#L14)

##### ready

> **ready**: `boolean`

Defined in: [src/lib/swap/useSwapSubAccountRuntime.ts:13](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/swap/useSwapSubAccountRuntime.ts#L13)

##### status

> **status**: `"idle"` \| `"checking"` \| `"ready"` \| `"missing-wallet"` \| `"mismatch"` \| `"missing-provider"` \| `"error"`

Defined in: [src/lib/swap/useSwapSubAccountRuntime.ts:15](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/swap/useSwapSubAccountRuntime.ts#L15)

## Functions

### isBaseAccountWallet()

> **isBaseAccountWallet**(`wallet`): `boolean`

Defined in: [src/lib/swap/useSwapSubAccountRuntime.ts:206](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/swap/useSwapSubAccountRuntime.ts#L206)

#### Parameters

##### wallet

`unknown`

#### Returns

`boolean`

***

### useSwapSubAccountRuntime()

> **useSwapSubAccountRuntime**(`params`): [`SubAccountRuntimeState`](#subaccountruntimestate)

Defined in: [src/lib/swap/useSwapSubAccountRuntime.ts:35](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/swap/useSwapSubAccountRuntime.ts#L35)

#### Parameters

##### params

###### baseAccountSdk

`any`

###### baseAccountWallet

`any`

###### baseSubAccountAddress

`string` \| `null`

###### canonicalAddress

`string` \| `null`

###### embeddedWallet

`any`

###### enabled

`boolean`

#### Returns

[`SubAccountRuntimeState`](#subaccountruntimestate)
