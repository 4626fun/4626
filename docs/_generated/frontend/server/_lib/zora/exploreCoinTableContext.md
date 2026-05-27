[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/zora/exploreCoinTableContext

# server/\_lib/zora/exploreCoinTableContext

## Type Aliases

### ExploreCoinTableContext

> **ExploreCoinTableContext** = `object`

Defined in: [server/\_lib/zora/exploreCoinTableContext.ts:7](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/zora/exploreCoinTableContext.ts#L7)

#### Properties

##### avatarImageUrl

> **avatarImageUrl**: `string` \| `null`

Defined in: [server/\_lib/zora/exploreCoinTableContext.ts:14](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/zora/exploreCoinTableContext.ts#L14)

##### coinAddress

> **coinAddress**: `string`

Defined in: [server/\_lib/zora/exploreCoinTableContext.ts:8](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/zora/exploreCoinTableContext.ts#L8)

##### fees24hUsd

> **fees24hUsd**: `string` \| `null`

Defined in: [server/\_lib/zora/exploreCoinTableContext.ts:9](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/zora/exploreCoinTableContext.ts#L9)

##### marketCapDelta24h

> **marketCapDelta24h**: `string` \| `null`

Defined in: [server/\_lib/zora/exploreCoinTableContext.ts:11](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/zora/exploreCoinTableContext.ts#L11)

##### name

> **name**: `string` \| `null`

Defined in: [server/\_lib/zora/exploreCoinTableContext.ts:12](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/zora/exploreCoinTableContext.ts#L12)

##### sparkline30dChangePct

> **sparkline30dChangePct**: `number` \| `null`

Defined in: [server/\_lib/zora/exploreCoinTableContext.ts:17](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/zora/exploreCoinTableContext.ts#L17)

##### sparkline30dValues

> **sparkline30dValues**: `number`[]

Defined in: [server/\_lib/zora/exploreCoinTableContext.ts:16](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/zora/exploreCoinTableContext.ts#L16)

##### symbol

> **symbol**: `string` \| `null`

Defined in: [server/\_lib/zora/exploreCoinTableContext.ts:13](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/zora/exploreCoinTableContext.ts#L13)

##### uniqueHolders

> **uniqueHolders**: `number` \| `null`

Defined in: [server/\_lib/zora/exploreCoinTableContext.ts:10](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/zora/exploreCoinTableContext.ts#L10)

##### zoraHandle

> **zoraHandle**: `string` \| `null`

Defined in: [server/\_lib/zora/exploreCoinTableContext.ts:15](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/zora/exploreCoinTableContext.ts#L15)

## Functions

### buildCreatorProfileFromTableContext()

> **buildCreatorProfileFromTableContext**(`row`, `ctx`): `Record`\<`string`, `unknown`\> \| `undefined`

Defined in: [server/\_lib/zora/exploreCoinTableContext.ts:144](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/zora/exploreCoinTableContext.ts#L144)

#### Parameters

##### row

###### twitter_username?

`string` \| `null`

###### zora_handle?

`string` \| `null`

##### ctx

[`ExploreCoinTableContext`](#explorecointablecontext) | `null` | `undefined`

#### Returns

`Record`\<`string`, `unknown`\> \| `undefined`

***

### buildMediaContentFromAvatarUrl()

> **buildMediaContentFromAvatarUrl**(`url`): \{ `previewImage`: \{ `medium`: `string`; `small`: `string`; \}; \} \| `undefined`

Defined in: [server/\_lib/zora/exploreCoinTableContext.ts:124](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/zora/exploreCoinTableContext.ts#L124)

#### Parameters

##### url

`string` | `null` | `undefined`

#### Returns

\{ `previewImage`: \{ `medium`: `string`; `small`: `string`; \}; \} \| `undefined`

***

### buildTrend30dFromTableContext()

> **buildTrend30dFromTableContext**(`ctx`): \{ `changePercent`: `number` \| `null`; `values`: `number`[]; \} \| `undefined`

Defined in: [server/\_lib/zora/exploreCoinTableContext.ts:134](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/zora/exploreCoinTableContext.ts#L134)

#### Parameters

##### ctx

[`ExploreCoinTableContext`](#explorecointablecontext) | `null` | `undefined`

#### Returns

\{ `changePercent`: `number` \| `null`; `values`: `number`[]; \} \| `undefined`

***

### loadExploreCoinTableContextByAddresses()

> **loadExploreCoinTableContextByAddresses**(`db`, `coinAddresses`): `Promise`\<`Map`\<`string`, [`ExploreCoinTableContext`](#explorecointablecontext)\>\>

Defined in: [server/\_lib/zora/exploreCoinTableContext.ts:53](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/zora/exploreCoinTableContext.ts#L53)

#### Parameters

##### db

[`DbPool`](../db/postgres.md#dbpool)

##### coinAddresses

`string`[]

#### Returns

`Promise`\<`Map`\<`string`, [`ExploreCoinTableContext`](#explorecointablecontext)\>\>
