[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/chat/ethosClient

# server/\_lib/chat/ethosClient

## Type Aliases

### EthosProfileSummary

> **EthosProfileSummary** = [`EthosScore`](#ethosscore) & `object`

Defined in: [server/\_lib/chat/ethosClient.ts:9](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/chat/ethosClient.ts#L9)

#### Type Declaration

##### avatarUrl

> **avatarUrl**: `string` \| `null`

##### description

> **description**: `string` \| `null`

##### displayName

> **displayName**: `string` \| `null`

##### profileUrl

> **profileUrl**: `string` \| `null`

##### stats

> **stats**: `object`

###### stats.reviews

> **reviews**: `object`

###### stats.reviews.negative

> **negative**: `number`

###### stats.reviews.neutral

> **neutral**: `number`

###### stats.reviews.positive

> **positive**: `number`

###### stats.reviews.positivePct

> **positivePct**: `number` \| `null`

###### stats.reviews.total

> **total**: `number`

###### stats.vouches

> **vouches**: `object`

###### stats.vouches.receivedAmountWeiTotal

> **receivedAmountWeiTotal**: `string` \| `null`

###### stats.vouches.receivedCount

> **receivedCount**: `number`

##### userkey

> **userkey**: `string`

##### username

> **username**: `string` \| `null`

***

### EthosScore

> **EthosScore** = `object`

Defined in: [server/\_lib/chat/ethosClient.ts:4](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/chat/ethosClient.ts#L4)

#### Properties

##### level

> **level**: `string` \| `null`

Defined in: [server/\_lib/chat/ethosClient.ts:6](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/chat/ethosClient.ts#L6)

##### score

> **score**: `number` \| `null`

Defined in: [server/\_lib/chat/ethosClient.ts:5](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/chat/ethosClient.ts#L5)

## Functions

### fetchFreshEthosScoresByUserkeys()

> **fetchFreshEthosScoresByUserkeys**(`rawUserkeys`): `Promise`\<`Map`\<`string`, [`EthosScore`](#ethosscore) \| `null`\>\>

Defined in: [server/\_lib/chat/ethosClient.ts:207](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/chat/ethosClient.ts#L207)

#### Parameters

##### rawUserkeys

`string`[]

#### Returns

`Promise`\<`Map`\<`string`, [`EthosScore`](#ethosscore) \| `null`\>\>

***

### getCachedEthosProfileByUserkey()

> **getCachedEthosProfileByUserkey**(`rawUserkey`): `Promise`\<[`EthosProfileSummary`](#ethosprofilesummary) \| `null`\>

Defined in: [server/\_lib/chat/ethosClient.ts:373](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/chat/ethosClient.ts#L373)

#### Parameters

##### rawUserkey

`string`

#### Returns

`Promise`\<[`EthosProfileSummary`](#ethosprofilesummary) \| `null`\>

***

### getCachedEthosScoreByAddress()

> **getCachedEthosScoreByAddress**(`rawAddress`): `Promise`\<[`EthosScore`](#ethosscore) \| `null`\>

Defined in: [server/\_lib/chat/ethosClient.ts:261](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/chat/ethosClient.ts#L261)

#### Parameters

##### rawAddress

`string`

#### Returns

`Promise`\<[`EthosScore`](#ethosscore) \| `null`\>

***

### getCachedEthosScoreByUserkey()

> **getCachedEthosScoreByUserkey**(`rawUserkey`): `Promise`\<[`EthosScore`](#ethosscore) \| `null`\>

Defined in: [server/\_lib/chat/ethosClient.ts:313](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/chat/ethosClient.ts#L313)

#### Parameters

##### rawUserkey

`string`

#### Returns

`Promise`\<[`EthosScore`](#ethosscore) \| `null`\>

***

### getCachedEthosScoresByUserkeys()

> **getCachedEthosScoresByUserkeys**(`rawUserkeys`): `Promise`\<`Map`\<`string`, [`EthosScore`](#ethosscore) \| `null`\>\>

Defined in: [server/\_lib/chat/ethosClient.ts:332](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/chat/ethosClient.ts#L332)

#### Parameters

##### rawUserkeys

`string`[]

#### Returns

`Promise`\<`Map`\<`string`, [`EthosScore`](#ethosscore) \| `null`\>\>

***

### normalizeEthosUserkey()

> **normalizeEthosUserkey**(`value`): `string` \| `null`

Defined in: [server/\_lib/chat/ethosClient.ts:71](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/chat/ethosClient.ts#L71)

#### Parameters

##### value

`string`

#### Returns

`string` \| `null`
