[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/wallet/coinbaseSmartWalletOwner

# server/\_lib/wallet/coinbaseSmartWalletOwner

## Variables

### COINBASE\_SMART\_WALLET\_ABI

> `const` **COINBASE\_SMART\_WALLET\_ABI**: readonly \[\{ `inputs`: readonly \[\{ `internalType`: `"address"`; `name`: `"owner"`; `type`: `"address"`; \}\]; `name`: `"addOwnerAddress"`; `outputs`: readonly \[\]; `stateMutability`: `"nonpayable"`; `type`: `"function"`; \}, \{ `inputs`: readonly \[\{ `internalType`: `"address"`; `name`: `"account"`; `type`: `"address"`; \}\]; `name`: `"isOwnerAddress"`; `outputs`: readonly \[\{ `internalType`: `"bool"`; `name`: `""`; `type`: `"bool"`; \}\]; `stateMutability`: `"view"`; `type`: `"function"`; \}\]

Defined in: [server/\_lib/wallet/coinbaseSmartWalletOwner.ts:5](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/coinbaseSmartWalletOwner.ts#L5)

## Functions

### isOwner()

> **isOwner**(`publicClient`, `cswAddress`, `ownerAddress`): `Promise`\<`boolean`\>

Defined in: [server/\_lib/wallet/coinbaseSmartWalletOwner.ts:50](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/coinbaseSmartWalletOwner.ts#L50)

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

### isOwnerIfDeployed()

> **isOwnerIfDeployed**(`publicClient`, `cswAddress`, `ownerAddress`): `Promise`\<`boolean` \| `null`\>

Defined in: [server/\_lib/wallet/coinbaseSmartWalletOwner.ts:34](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/coinbaseSmartWalletOwner.ts#L34)

#### Parameters

##### publicClient

`Pick`\<`PublicClient`, `"readContract"` \| `"getBytecode"`\>

##### cswAddress

`string`

##### ownerAddress

`string`

#### Returns

`Promise`\<`boolean` \| `null`\>

***

### prepareAddOwnerTx()

> **prepareAddOwnerTx**(`cswAddress`, `ownerToAdd`): `object`

Defined in: [server/\_lib/wallet/coinbaseSmartWalletOwner.ts:66](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/coinbaseSmartWalletOwner.ts#L66)

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

> **to**: `string`

##### value

> **value**: `"0x0"`
