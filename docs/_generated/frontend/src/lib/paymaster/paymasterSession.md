[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/lib/paymaster/paymasterSession

# src/lib/paymaster/paymasterSession

## Type Aliases

### PaymasterSessionResult

> **PaymasterSessionResult** = `object`

Defined in: [src/lib/paymaster/paymasterSession.ts:10](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/paymaster/paymasterSession.ts#L10)

#### Properties

##### ok

> **ok**: `boolean`

Defined in: [src/lib/paymaster/paymasterSession.ts:11](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/paymaster/paymasterSession.ts#L11)

##### reason

> **reason**: `string` \| `null`

Defined in: [src/lib/paymaster/paymasterSession.ts:12](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/paymaster/paymasterSession.ts#L12)

***

### PaymasterSessionStrategyParams

> **PaymasterSessionStrategyParams** = `object`

Defined in: [src/lib/paymaster/paymasterSession.ts:1](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/paymaster/paymasterSession.ts#L1)

#### Properties

##### allowPrivyBridgeFallback?

> `optional` **allowPrivyBridgeFallback**: `boolean`

Defined in: [src/lib/paymaster/paymasterSession.ts:4](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/paymaster/paymasterSession.ts#L4)

##### getPrivyAccessToken?

> `optional` **getPrivyAccessToken**: () => `Promise`\<`string` \| `null`\> \| `null`

Defined in: [src/lib/paymaster/paymasterSession.ts:7](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/paymaster/paymasterSession.ts#L7)

##### hasMatchingSiweSession

> **hasMatchingSiweSession**: `boolean`

Defined in: [src/lib/paymaster/paymasterSession.ts:2](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/paymaster/paymasterSession.ts#L2)

##### preferWalletSession

> **preferWalletSession**: `boolean`

Defined in: [src/lib/paymaster/paymasterSession.ts:3](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/paymaster/paymasterSession.ts#L3)

##### signIn?

> `optional` **signIn**: () => `Promise`\<`string` \| `null`\> \| `null`

Defined in: [src/lib/paymaster/paymasterSession.ts:5](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/paymaster/paymasterSession.ts#L5)

##### signInWithPrivyToken?

> `optional` **signInWithPrivyToken**: (`token`) => `Promise`\<`string` \| `null`\> \| `null`

Defined in: [src/lib/paymaster/paymasterSession.ts:6](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/paymaster/paymasterSession.ts#L6)

## Functions

### ensureWalletAlignedPaymasterSession()

> **ensureWalletAlignedPaymasterSession**(`params`): `Promise`\<`boolean`\>

Defined in: [src/lib/paymaster/paymasterSession.ts:75](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/paymaster/paymasterSession.ts#L75)

#### Parameters

##### params

[`PaymasterSessionStrategyParams`](#paymastersessionstrategyparams)

#### Returns

`Promise`\<`boolean`\>

***

### ensureWalletAlignedPaymasterSessionDetailed()

> **ensureWalletAlignedPaymasterSessionDetailed**(`params`): `Promise`\<[`PaymasterSessionResult`](#paymastersessionresult)\>

Defined in: [src/lib/paymaster/paymasterSession.ts:15](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/paymaster/paymasterSession.ts#L15)

#### Parameters

##### params

[`PaymasterSessionStrategyParams`](#paymastersessionstrategyparams)

#### Returns

`Promise`\<[`PaymasterSessionResult`](#paymastersessionresult)\>
