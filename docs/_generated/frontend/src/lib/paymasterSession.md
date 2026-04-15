[**4626-app**](../../index.md)

***

[4626-app](../../index.md) / src/lib/paymasterSession

# src/lib/paymasterSession

## Type Aliases

### PaymasterSessionResult

> **PaymasterSessionResult** = `object`

Defined in: [src/lib/paymasterSession.ts:10](https://github.com/wenakita/4626/blob/c75a1c24d9b9350ac3d121d5a700640674fe0027/frontend/src/lib/paymasterSession.ts#L10)

#### Properties

##### ok

> **ok**: `boolean`

Defined in: [src/lib/paymasterSession.ts:11](https://github.com/wenakita/4626/blob/c75a1c24d9b9350ac3d121d5a700640674fe0027/frontend/src/lib/paymasterSession.ts#L11)

##### reason

> **reason**: `string` \| `null`

Defined in: [src/lib/paymasterSession.ts:12](https://github.com/wenakita/4626/blob/c75a1c24d9b9350ac3d121d5a700640674fe0027/frontend/src/lib/paymasterSession.ts#L12)

***

### PaymasterSessionStrategyParams

> **PaymasterSessionStrategyParams** = `object`

Defined in: [src/lib/paymasterSession.ts:1](https://github.com/wenakita/4626/blob/c75a1c24d9b9350ac3d121d5a700640674fe0027/frontend/src/lib/paymasterSession.ts#L1)

#### Properties

##### allowPrivyBridgeFallback?

> `optional` **allowPrivyBridgeFallback**: `boolean`

Defined in: [src/lib/paymasterSession.ts:4](https://github.com/wenakita/4626/blob/c75a1c24d9b9350ac3d121d5a700640674fe0027/frontend/src/lib/paymasterSession.ts#L4)

##### getPrivyAccessToken?

> `optional` **getPrivyAccessToken**: () => `Promise`\<`string` \| `null`\> \| `null`

Defined in: [src/lib/paymasterSession.ts:7](https://github.com/wenakita/4626/blob/c75a1c24d9b9350ac3d121d5a700640674fe0027/frontend/src/lib/paymasterSession.ts#L7)

##### hasMatchingSiweSession

> **hasMatchingSiweSession**: `boolean`

Defined in: [src/lib/paymasterSession.ts:2](https://github.com/wenakita/4626/blob/c75a1c24d9b9350ac3d121d5a700640674fe0027/frontend/src/lib/paymasterSession.ts#L2)

##### preferWalletSession

> **preferWalletSession**: `boolean`

Defined in: [src/lib/paymasterSession.ts:3](https://github.com/wenakita/4626/blob/c75a1c24d9b9350ac3d121d5a700640674fe0027/frontend/src/lib/paymasterSession.ts#L3)

##### signIn?

> `optional` **signIn**: () => `Promise`\<`string` \| `null`\> \| `null`

Defined in: [src/lib/paymasterSession.ts:5](https://github.com/wenakita/4626/blob/c75a1c24d9b9350ac3d121d5a700640674fe0027/frontend/src/lib/paymasterSession.ts#L5)

##### signInWithPrivyToken?

> `optional` **signInWithPrivyToken**: (`token`) => `Promise`\<`string` \| `null`\> \| `null`

Defined in: [src/lib/paymasterSession.ts:6](https://github.com/wenakita/4626/blob/c75a1c24d9b9350ac3d121d5a700640674fe0027/frontend/src/lib/paymasterSession.ts#L6)

## Functions

### ensureWalletAlignedPaymasterSession()

> **ensureWalletAlignedPaymasterSession**(`params`): `Promise`\<`boolean`\>

Defined in: [src/lib/paymasterSession.ts:75](https://github.com/wenakita/4626/blob/c75a1c24d9b9350ac3d121d5a700640674fe0027/frontend/src/lib/paymasterSession.ts#L75)

#### Parameters

##### params

[`PaymasterSessionStrategyParams`](#paymastersessionstrategyparams)

#### Returns

`Promise`\<`boolean`\>

***

### ensureWalletAlignedPaymasterSessionDetailed()

> **ensureWalletAlignedPaymasterSessionDetailed**(`params`): `Promise`\<[`PaymasterSessionResult`](#paymastersessionresult)\>

Defined in: [src/lib/paymasterSession.ts:15](https://github.com/wenakita/4626/blob/c75a1c24d9b9350ac3d121d5a700640674fe0027/frontend/src/lib/paymasterSession.ts#L15)

#### Parameters

##### params

[`PaymasterSessionStrategyParams`](#paymastersessionstrategyparams)

#### Returns

`Promise`\<[`PaymasterSessionResult`](#paymastersessionresult)\>
