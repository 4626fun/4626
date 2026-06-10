[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/zora/creatorEthosProjection

# server/\_lib/zora/creatorEthosProjection

## Type Aliases

### CreatorEthosMerged

> **CreatorEthosMerged** = `object`

Defined in: [server/\_lib/zora/creatorEthosProjection.ts:110](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora/creatorEthosProjection.ts#L110)

#### Properties

##### level

> **level**: `string` \| `null`

Defined in: [server/\_lib/zora/creatorEthosProjection.ts:112](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora/creatorEthosProjection.ts#L112)

##### score

> **score**: `number` \| `null`

Defined in: [server/\_lib/zora/creatorEthosProjection.ts:111](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora/creatorEthosProjection.ts#L111)

##### source

> **source**: `string` \| `null`

Defined in: [server/\_lib/zora/creatorEthosProjection.ts:113](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora/creatorEthosProjection.ts#L113)

***

### CreatorEthosProjectionByAddress

> **CreatorEthosProjectionByAddress** = `object`

Defined in: [server/\_lib/zora/creatorEthosProjection.ts:37](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora/creatorEthosProjection.ts#L37)

#### Properties

##### creatorAddress

> **creatorAddress**: `string`

Defined in: [server/\_lib/zora/creatorEthosProjection.ts:38](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora/creatorEthosProjection.ts#L38)

##### level

> **level**: `string` \| `null`

Defined in: [server/\_lib/zora/creatorEthosProjection.ts:40](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora/creatorEthosProjection.ts#L40)

##### score

> **score**: `number` \| `null`

Defined in: [server/\_lib/zora/creatorEthosProjection.ts:39](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora/creatorEthosProjection.ts#L39)

##### source

> **source**: `string` \| `null`

Defined in: [server/\_lib/zora/creatorEthosProjection.ts:41](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora/creatorEthosProjection.ts#L41)

## Functions

### ensureCreatorEthosProjectionSchema()

> **ensureCreatorEthosProjectionSchema**(`db`): `Promise`\<`boolean`\>

Defined in: [server/\_lib/zora/creatorEthosProjection.ts:17](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora/creatorEthosProjection.ts#L17)

#### Parameters

##### db

`Db`

#### Returns

`Promise`\<`boolean`\>

***

### loadCreatorEthosProjectionByAddresses()

> **loadCreatorEthosProjectionByAddresses**(`db`, `creatorAddresses`): `Promise`\<`Map`\<`string`, [`CreatorEthosProjectionByAddress`](#creatorethosprojectionbyaddress)\>\>

Defined in: [server/\_lib/zora/creatorEthosProjection.ts:58](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora/creatorEthosProjection.ts#L58)

#### Parameters

##### db

`Db`

##### creatorAddresses

`string`[]

#### Returns

`Promise`\<`Map`\<`string`, [`CreatorEthosProjectionByAddress`](#creatorethosprojectionbyaddress)\>\>

***

### loadMergedCreatorEthosByAddresses()

> **loadMergedCreatorEthosByAddresses**(`creatorAddresses`): `Promise`\<`Map`\<`string`, [`CreatorEthosMerged`](#creatorethosmerged) & `object`\>\>

Defined in: [server/\_lib/zora/creatorEthosProjection.ts:172](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora/creatorEthosProjection.ts#L172)

Projection-first Ethos merge used by explore and coin handlers.

#### Parameters

##### creatorAddresses

`string`[]

#### Returns

`Promise`\<`Map`\<`string`, [`CreatorEthosMerged`](#creatorethosmerged) & `object`\>\>

***

### mergeCreatorEthosScores()

> **mergeCreatorEthosScores**(`projection`, `live`, `liveSource?`): [`CreatorEthosMerged`](#creatorethosmerged)

Defined in: [server/\_lib/zora/creatorEthosProjection.ts:116](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora/creatorEthosProjection.ts#L116)

#### Parameters

##### projection

[`CreatorEthosProjectionByAddress`](#creatorethosprojectionbyaddress) | `null` | `undefined`

##### live

\{ `level`: `string` \| `null`; `score`: `number` \| `null`; \} | `null` | `undefined`

##### liveSource?

`string` | `null`

#### Returns

[`CreatorEthosMerged`](#creatorethosmerged)

***

### pickCreatorEthosProjectionRefreshMode()

> **pickCreatorEthosProjectionRefreshMode**(`lane`): `"fast"` \| `"full"`

Defined in: [server/\_lib/zora/creatorEthosProjection.ts:45](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora/creatorEthosProjection.ts#L45)

15-minute cron slots for ethos-sync; used to alternate full projection refreshes.

#### Parameters

##### lane

`"main"` | `"hot"`

#### Returns

`"fast"` \| `"full"`

***

### refreshCreatorEthosProjection()

> **refreshCreatorEthosProjection**(`params`): `Promise`\<\{ `appliedLimit`: `number`; `available`: `boolean`; `refreshedRows`: `number`; \}\>

Defined in: [server/\_lib/zora/creatorEthosProjection.ts:205](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora/creatorEthosProjection.ts#L205)

#### Parameters

##### params

###### db

`Db`

###### limit?

`number`

###### mode?

`"fast"` \| `"full"`

**Deprecated**

Ignored; all refreshes use the full projection/scoring path.

#### Returns

`Promise`\<\{ `appliedLimit`: `number`; `available`: `boolean`; `refreshedRows`: `number`; \}\>
