[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/zora/resolveCreatorEthosByAddress

# server/\_lib/zora/resolveCreatorEthosByAddress

## Type Aliases

### CreatorEthosResolved

> **CreatorEthosResolved** = `object`

Defined in: [server/\_lib/zora/resolveCreatorEthosByAddress.ts:4](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora/resolveCreatorEthosByAddress.ts#L4)

#### Properties

##### creatorAddress

> **creatorAddress**: `string`

Defined in: [server/\_lib/zora/resolveCreatorEthosByAddress.ts:5](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora/resolveCreatorEthosByAddress.ts#L5)

##### level

> **level**: `string` \| `null`

Defined in: [server/\_lib/zora/resolveCreatorEthosByAddress.ts:7](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora/resolveCreatorEthosByAddress.ts#L7)

##### score

> **score**: `number` \| `null`

Defined in: [server/\_lib/zora/resolveCreatorEthosByAddress.ts:6](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora/resolveCreatorEthosByAddress.ts#L6)

##### source

> **source**: `string` \| `null`

Defined in: [server/\_lib/zora/resolveCreatorEthosByAddress.ts:8](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora/resolveCreatorEthosByAddress.ts#L8)

## Functions

### resolveCreatorEthosByAddress()

> **resolveCreatorEthosByAddress**(`creatorAddresses`): `Promise`\<`Map`\<`string`, [`CreatorEthosResolved`](#creatorethosresolved)\>\>

Defined in: [server/\_lib/zora/resolveCreatorEthosByAddress.ts:44](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora/resolveCreatorEthosByAddress.ts#L44)

#### Parameters

##### creatorAddresses

`string`[]

#### Returns

`Promise`\<`Map`\<`string`, [`CreatorEthosResolved`](#creatorethosresolved)\>\>

***

### resolveEthosScoreSource()

> **resolveEthosScoreSource**(`candidates`): `string` \| `null`

Defined in: [server/\_lib/zora/resolveCreatorEthosByAddress.ts:20](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora/resolveCreatorEthosByAddress.ts#L20)

#### Parameters

##### candidates

###### canonicalSocial

`number` \| `null`

###### canonicalWallet

`number` \| `null`

###### ownerClassEoa

`number` \| `null`

###### ownerClassFromCsw

`number` \| `null`

###### socialCached

`number` \| `null`

###### walletCached

`number` \| `null`

#### Returns

`string` \| `null`
