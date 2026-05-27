[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/lottery/amoeRelay

# server/\_lib/lottery/amoeRelay

## Type Aliases

### AmoeRelayFn()

> **AmoeRelayFn** = (`params`) => `Promise`\<`` `0x${string}` ``\>

Defined in: [server/\_lib/lottery/amoeRelay.ts:87](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lottery/amoeRelay.ts#L87)

#### Parameters

##### params

[`AmoeRelayRequest`](#amoerelayrequest)

#### Returns

`Promise`\<`` `0x${string}` ``\>

***

### AmoeRelayRequest

> **AmoeRelayRequest** = `object`

Defined in: [server/\_lib/lottery/amoeRelay.ts:82](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lottery/amoeRelay.ts#L82)

#### Properties

##### callData

> **callData**: `` `0x${string}` ``

Defined in: [server/\_lib/lottery/amoeRelay.ts:84](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lottery/amoeRelay.ts#L84)

##### to

> **to**: `` `0x${string}` ``

Defined in: [server/\_lib/lottery/amoeRelay.ts:83](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lottery/amoeRelay.ts#L83)

## Functions

### createAmoeRelay()

> **createAmoeRelay**(): [`AmoeRelayFn`](#amoerelayfn) \| `null`

Defined in: [server/\_lib/lottery/amoeRelay.ts:103](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lottery/amoeRelay.ts#L103)

#### Returns

[`AmoeRelayFn`](#amoerelayfn) \| `null`

***

### hasAmoeRelayConfig()

> **hasAmoeRelayConfig**(): `boolean`

Defined in: [server/\_lib/lottery/amoeRelay.ts:89](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lottery/amoeRelay.ts#L89)

#### Returns

`boolean`
