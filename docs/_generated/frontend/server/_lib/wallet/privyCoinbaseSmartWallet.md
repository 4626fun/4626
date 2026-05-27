[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/wallet/privyCoinbaseSmartWallet

# server/\_lib/wallet/privyCoinbaseSmartWallet

## Classes

### CoinbaseSmartWalletHelperError

Defined in: [server/\_lib/wallet/privyCoinbaseSmartWallet.ts:31](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/privyCoinbaseSmartWallet.ts#L31)

#### Extends

- `Error`

#### Constructors

##### Constructor

> **new CoinbaseSmartWalletHelperError**(`code`, `retryable`, `messageOrOptions?`): [`CoinbaseSmartWalletHelperError`](#coinbasesmartwallethelpererror)

Defined in: [server/\_lib/wallet/privyCoinbaseSmartWallet.ts:42](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/privyCoinbaseSmartWallet.ts#L42)

###### Parameters

###### code

`string`

###### retryable

`boolean`

###### messageOrOptions?

`string` | \{ `cause?`: `unknown`; `causeMessage?`: `string`; `message?`: `string`; \}

###### Returns

[`CoinbaseSmartWalletHelperError`](#coinbasesmartwallethelpererror)

###### Overrides

`Error.constructor`

#### Properties

##### causeMessage?

> `optional` **causeMessage**: `string`

Defined in: [server/\_lib/wallet/privyCoinbaseSmartWallet.ts:40](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/privyCoinbaseSmartWallet.ts#L40)

Optional original message from the underlying error that caused this
helper error. Kept separate from `message` so `message` remains the
stable short code callers match against, while operators still see the
raw bundler/paymaster/RPC text in logs.

##### code

> **code**: `string`

Defined in: [server/\_lib/wallet/privyCoinbaseSmartWallet.ts:32](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/privyCoinbaseSmartWallet.ts#L32)

##### retryable

> **retryable**: `boolean`

Defined in: [server/\_lib/wallet/privyCoinbaseSmartWallet.ts:33](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/privyCoinbaseSmartWallet.ts#L33)

## Type Aliases

### CoinbaseSmartWalletCall

> **CoinbaseSmartWalletCall** = `object`

Defined in: [server/\_lib/wallet/privyCoinbaseSmartWallet.ts:25](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/privyCoinbaseSmartWallet.ts#L25)

#### Properties

##### data?

> `optional` **data**: `Hex`

Defined in: [server/\_lib/wallet/privyCoinbaseSmartWallet.ts:28](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/privyCoinbaseSmartWallet.ts#L28)

##### to

> **to**: `Address`

Defined in: [server/\_lib/wallet/privyCoinbaseSmartWallet.ts:26](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/privyCoinbaseSmartWallet.ts#L26)

##### value?

> `optional` **value**: `bigint`

Defined in: [server/\_lib/wallet/privyCoinbaseSmartWallet.ts:27](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/privyCoinbaseSmartWallet.ts#L27)

## Functions

### asCoinbaseSmartWalletOwnerBytes()

> **asCoinbaseSmartWalletOwnerBytes**(`ownerAddress`): `` `0x${string}` ``

Defined in: [server/\_lib/wallet/privyCoinbaseSmartWallet.ts:249](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/privyCoinbaseSmartWallet.ts#L249)

#### Parameters

##### ownerAddress

`string`

#### Returns

`` `0x${string}` ``

***

### createPrivyWalletBackedAccount()

> **createPrivyWalletBackedAccount**(`params`): `any`

Defined in: [server/\_lib/wallet/privyCoinbaseSmartWallet.ts:418](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/privyCoinbaseSmartWallet.ts#L418)

#### Parameters

##### params

###### address

`string`

###### walletId

`string`

#### Returns

`any`

***

### findCoinbaseSmartWalletOwnerIndex()

> **findCoinbaseSmartWalletOwnerIndex**(`params`): `Promise`\<`number` \| `null`\>

Defined in: [server/\_lib/wallet/privyCoinbaseSmartWallet.ts:253](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/privyCoinbaseSmartWallet.ts#L253)

#### Parameters

##### params

###### maxScan?

`number`

###### ownerAddress

`string`

###### publicClient

`any`

###### smartWallet

`string`

#### Returns

`Promise`\<`number` \| `null`\>

***

### isCoinbaseSmartWalletHelperError()

> **isCoinbaseSmartWalletHelperError**(`error`): `error is CoinbaseSmartWalletHelperError`

Defined in: [server/\_lib/wallet/privyCoinbaseSmartWallet.ts:69](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/privyCoinbaseSmartWallet.ts#L69)

#### Parameters

##### error

`unknown`

#### Returns

`error is CoinbaseSmartWalletHelperError`

***

### isRetryableInfraError()

> **isRetryableInfraError**(`error`): `boolean`

Defined in: [server/\_lib/wallet/privyCoinbaseSmartWallet.ts:83](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/privyCoinbaseSmartWallet.ts#L83)

#### Parameters

##### error

`unknown`

#### Returns

`boolean`

***

### resolvePrivyCoinbaseSmartWalletOwnerContext()

> **resolvePrivyCoinbaseSmartWalletOwnerContext**(`params`): `Promise`\<\{ `ownerAddress`: `string`; `ownerIndex`: `number`; \}\>

Defined in: [server/\_lib/wallet/privyCoinbaseSmartWallet.ts:316](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/privyCoinbaseSmartWallet.ts#L316)

#### Parameters

##### params

###### allowConfiguredOwnerIndexFallback?

`boolean`

###### configuredOwnerIndex?

`number` \| `null`

###### expectedOwnerAddress?

`string` \| `null`

###### maxScan?

`number`

###### publicClient

`any`

###### smartWallet

`string`

###### walletId

`string`

#### Returns

`Promise`\<\{ `ownerAddress`: `string`; `ownerIndex`: `number`; \}\>

***

### sendCoinbaseSmartWalletUserOperation()

> **sendCoinbaseSmartWalletUserOperation**(`params`): `Promise`\<\{ `ownerIndex`: `number`; `smartWallet`: `` `0x${string}` ``; `txHash`: `` `0x${string}` ``; `userOpHash`: `` `0x${string}` ``; \}\>

Defined in: [server/\_lib/wallet/privyCoinbaseSmartWallet.ts:450](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/privyCoinbaseSmartWallet.ts#L450)

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

`string`

#### Returns

`Promise`\<\{ `ownerIndex`: `number`; `smartWallet`: `` `0x${string}` ``; `txHash`: `` `0x${string}` ``; `userOpHash`: `` `0x${string}` ``; \}\>

***

### sendPrivyCoinbaseSmartWalletUserOperation()

> **sendPrivyCoinbaseSmartWalletUserOperation**(`params`): `Promise`\<\{ `ownerAddress`: `` `0x${string}` ``; `ownerIndex`: `number`; `smartWallet`: `` `0x${string}` ``; `txHash`: `` `0x${string}` ``; `userOpHash`: `` `0x${string}` ``; \}\>

Defined in: [server/\_lib/wallet/privyCoinbaseSmartWallet.ts:551](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/privyCoinbaseSmartWallet.ts#L551)

#### Parameters

##### params

###### bundlerUrl

`string`

###### calls

[`CoinbaseSmartWalletCall`](#coinbasesmartwalletcall)[]

###### ownerAddress

`string`

###### ownerIndex

`number`

###### publicClient

`any`

###### simulate?

`boolean`

###### smartWallet

`string`

###### walletId

`string`

#### Returns

`Promise`\<\{ `ownerAddress`: `` `0x${string}` ``; `ownerIndex`: `number`; `smartWallet`: `` `0x${string}` ``; `txHash`: `` `0x${string}` ``; `userOpHash`: `` `0x${string}` ``; \}\>

***

### waitForUserOperationReceipt()

> **waitForUserOperationReceipt**(`params`): `Promise`\<`any`\>

Defined in: [server/\_lib/wallet/privyCoinbaseSmartWallet.ts:398](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/privyCoinbaseSmartWallet.ts#L398)

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

***

### wrapUnknownHelperError()

> **wrapUnknownHelperError**(`code`, `error`): [`CoinbaseSmartWalletHelperError`](#coinbasesmartwallethelpererror)

Defined in: [server/\_lib/wallet/privyCoinbaseSmartWallet.ts:193](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/privyCoinbaseSmartWallet.ts#L193)

#### Parameters

##### code

`string`

##### error

`unknown`

#### Returns

[`CoinbaseSmartWalletHelperError`](#coinbasesmartwallethelpererror)
