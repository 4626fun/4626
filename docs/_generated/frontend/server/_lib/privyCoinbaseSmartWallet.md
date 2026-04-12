[**4626-app**](../../index.md)

***

[4626-app](../../index.md) / server/\_lib/privyCoinbaseSmartWallet

# server/\_lib/privyCoinbaseSmartWallet

## Classes

### CoinbaseSmartWalletHelperError

Defined in: [server/\_lib/privyCoinbaseSmartWallet.ts:31](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/privyCoinbaseSmartWallet.ts#L31)

#### Extends

- `Error`

#### Constructors

##### Constructor

> **new CoinbaseSmartWalletHelperError**(`code`, `retryable`, `message?`): [`CoinbaseSmartWalletHelperError`](#coinbasesmartwallethelpererror)

Defined in: [server/\_lib/privyCoinbaseSmartWallet.ts:35](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/privyCoinbaseSmartWallet.ts#L35)

###### Parameters

###### code

`string`

###### retryable

`boolean`

###### message?

`string`

###### Returns

[`CoinbaseSmartWalletHelperError`](#coinbasesmartwallethelpererror)

###### Overrides

`Error.constructor`

#### Properties

##### code

> **code**: `string`

Defined in: [server/\_lib/privyCoinbaseSmartWallet.ts:32](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/privyCoinbaseSmartWallet.ts#L32)

##### retryable

> **retryable**: `boolean`

Defined in: [server/\_lib/privyCoinbaseSmartWallet.ts:33](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/privyCoinbaseSmartWallet.ts#L33)

## Type Aliases

### CoinbaseSmartWalletCall

> **CoinbaseSmartWalletCall** = `object`

Defined in: [server/\_lib/privyCoinbaseSmartWallet.ts:25](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/privyCoinbaseSmartWallet.ts#L25)

#### Properties

##### data?

> `optional` **data**: `Hex`

Defined in: [server/\_lib/privyCoinbaseSmartWallet.ts:28](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/privyCoinbaseSmartWallet.ts#L28)

##### to

> **to**: `Address`

Defined in: [server/\_lib/privyCoinbaseSmartWallet.ts:26](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/privyCoinbaseSmartWallet.ts#L26)

##### value?

> `optional` **value**: `bigint`

Defined in: [server/\_lib/privyCoinbaseSmartWallet.ts:27](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/privyCoinbaseSmartWallet.ts#L27)

## Functions

### asCoinbaseSmartWalletOwnerBytes()

> **asCoinbaseSmartWalletOwnerBytes**(`ownerAddress`): `` `0x${string}` ``

Defined in: [server/\_lib/privyCoinbaseSmartWallet.ts:144](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/privyCoinbaseSmartWallet.ts#L144)

#### Parameters

##### ownerAddress

`` `0x${string}` ``

#### Returns

`` `0x${string}` ``

***

### createPrivyWalletBackedAccount()

> **createPrivyWalletBackedAccount**(`params`): `any`

Defined in: [server/\_lib/privyCoinbaseSmartWallet.ts:313](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/privyCoinbaseSmartWallet.ts#L313)

#### Parameters

##### params

###### address

`` `0x${string}` ``

###### walletId

`string`

#### Returns

`any`

***

### findCoinbaseSmartWalletOwnerIndex()

> **findCoinbaseSmartWalletOwnerIndex**(`params`): `Promise`\<`number` \| `null`\>

Defined in: [server/\_lib/privyCoinbaseSmartWallet.ts:148](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/privyCoinbaseSmartWallet.ts#L148)

#### Parameters

##### params

###### maxScan?

`number`

###### ownerAddress

`` `0x${string}` ``

###### publicClient

`any`

###### smartWallet

`` `0x${string}` ``

#### Returns

`Promise`\<`number` \| `null`\>

***

### isCoinbaseSmartWalletHelperError()

> **isCoinbaseSmartWalletHelperError**(`error`): `error is CoinbaseSmartWalletHelperError`

Defined in: [server/\_lib/privyCoinbaseSmartWallet.ts:43](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/privyCoinbaseSmartWallet.ts#L43)

#### Parameters

##### error

`unknown`

#### Returns

`error is CoinbaseSmartWalletHelperError`

***

### resolvePrivyCoinbaseSmartWalletOwnerContext()

> **resolvePrivyCoinbaseSmartWalletOwnerContext**(`params`): `Promise`\<\{ `ownerAddress`: `` `0x${string}` ``; `ownerIndex`: `number`; \}\>

Defined in: [server/\_lib/privyCoinbaseSmartWallet.ts:211](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/privyCoinbaseSmartWallet.ts#L211)

#### Parameters

##### params

###### allowConfiguredOwnerIndexFallback?

`boolean`

###### configuredOwnerIndex?

`number` \| `null`

###### expectedOwnerAddress?

`` `0x${string}` `` \| `null`

###### maxScan?

`number`

###### publicClient

`any`

###### smartWallet

`` `0x${string}` ``

###### walletId

`string`

#### Returns

`Promise`\<\{ `ownerAddress`: `` `0x${string}` ``; `ownerIndex`: `number`; \}\>

***

### sendCoinbaseSmartWalletUserOperation()

> **sendCoinbaseSmartWalletUserOperation**(`params`): `Promise`\<\{ `ownerIndex`: `number`; `smartWallet`: `` `0x${string}` ``; `txHash`: `` `0x${string}` ``; `userOpHash`: `` `0x${string}` ``; \}\>

Defined in: [server/\_lib/privyCoinbaseSmartWallet.ts:345](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/privyCoinbaseSmartWallet.ts#L345)

#### Parameters

##### params

###### bundlerUrl

`string`

###### calls

[`CoinbaseSmartWalletCall`](#coinbasesmartwalletcall)[]

###### ownerAccount

`any`

###### ownerIndex

`number`

###### publicClient

`any`

###### simulate?

`boolean`

###### smartWallet

`` `0x${string}` ``

#### Returns

`Promise`\<\{ `ownerIndex`: `number`; `smartWallet`: `` `0x${string}` ``; `txHash`: `` `0x${string}` ``; `userOpHash`: `` `0x${string}` ``; \}\>

***

### sendPrivyCoinbaseSmartWalletUserOperation()

> **sendPrivyCoinbaseSmartWalletUserOperation**(`params`): `Promise`\<\{ `ownerAddress`: `` `0x${string}` ``; `ownerIndex`: `number`; `smartWallet`: `` `0x${string}` ``; `txHash`: `` `0x${string}` ``; `userOpHash`: `` `0x${string}` ``; \}\>

Defined in: [server/\_lib/privyCoinbaseSmartWallet.ts:446](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/privyCoinbaseSmartWallet.ts#L446)

#### Parameters

##### params

###### bundlerUrl

`string`

###### calls

[`CoinbaseSmartWalletCall`](#coinbasesmartwalletcall)[]

###### ownerAddress

`` `0x${string}` ``

###### ownerIndex

`number`

###### publicClient

`any`

###### simulate?

`boolean`

###### smartWallet

`` `0x${string}` ``

###### walletId

`string`

#### Returns

`Promise`\<\{ `ownerAddress`: `` `0x${string}` ``; `ownerIndex`: `number`; `smartWallet`: `` `0x${string}` ``; `txHash`: `` `0x${string}` ``; `userOpHash`: `` `0x${string}` ``; \}\>

***

### waitForUserOperationReceipt()

> **waitForUserOperationReceipt**(`params`): `Promise`\<`any`\>

Defined in: [server/\_lib/privyCoinbaseSmartWallet.ts:293](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/privyCoinbaseSmartWallet.ts#L293)

#### Parameters

##### params

###### bundlerClient

`any`

###### hash

`` `0x${string}` ``

###### intervalMs?

`number`

###### timeoutMs?

`number`

#### Returns

`Promise`\<`any`\>
