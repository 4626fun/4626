[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / server/\_lib/wallet/coinbaseSmartWalletOwner

# server/\_lib/wallet/coinbaseSmartWalletOwner

## Variables

### COINBASE\_SMART\_WALLET\_ABI

> `const` **COINBASE\_SMART\_WALLET\_ABI**: readonly \[\{ `inputs`: readonly \[\{ `internalType`: `"address"`; `name`: `"owner"`; `type`: `"address"`; \}\]; `name`: `"addOwnerAddress"`; `outputs`: readonly \[\]; `stateMutability`: `"nonpayable"`; `type`: `"function"`; \}, \{ `inputs`: readonly \[\{ `internalType`: `"address"`; `name`: `"account"`; `type`: `"address"`; \}\]; `name`: `"isOwnerAddress"`; `outputs`: readonly \[\{ `internalType`: `"bool"`; `name`: `""`; `type`: `"bool"`; \}\]; `stateMutability`: `"view"`; `type`: `"function"`; \}\]

Defined in: [server/\_lib/wallet/coinbaseSmartWalletOwner.ts:5](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/coinbaseSmartWalletOwner.ts#L5)

## Functions

### isOwner()

> **isOwner**(`publicClient`, `cswAddress`, `ownerAddress`): `Promise`\<`boolean`\>

Defined in: [server/\_lib/wallet/coinbaseSmartWalletOwner.ts:30](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/coinbaseSmartWalletOwner.ts#L30)

#### Parameters

##### publicClient

`Pick`\<`PublicClient`, `"readContract"`\>

##### cswAddress

`string`

##### ownerAddress

`string`

#### Returns

`Promise`\<`boolean`\>

***

### prepareAddOwnerTx()

> **prepareAddOwnerTx**(`cswAddress`, `ownerToAdd`): `object`

Defined in: [server/\_lib/wallet/coinbaseSmartWalletOwner.ts:46](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/coinbaseSmartWalletOwner.ts#L46)

#### Parameters

##### cswAddress

`string`

##### ownerToAdd

`string`

#### Returns

`object`

##### chainId

> **chainId**: `8453`

##### data

> **data**: `` `0x${string}` ``

##### to

> **to**: `` `0x${string}` ``

##### value

> **value**: `"0x0"`
