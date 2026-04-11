[**4626-app**](../../index.md)

***

[4626-app](../../index.md) / server/\_lib/zoraTrendOpsStore

# server/\_lib/zoraTrendOpsStore

## Type Aliases

### TrendOpRow

> **TrendOpRow** = `object`

Defined in: [server/\_lib/zoraTrendOpsStore.ts:13](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zoraTrendOpsStore.ts#L13)

#### Properties

##### actorWallet

> **actorWallet**: `string` \| `null`

Defined in: [server/\_lib/zoraTrendOpsStore.ts:20](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zoraTrendOpsStore.ts#L20)

##### createdAt

> **createdAt**: `string`

Defined in: [server/\_lib/zoraTrendOpsStore.ts:28](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zoraTrendOpsStore.ts#L28)

##### deployedCoinAddress

> **deployedCoinAddress**: `string` \| `null`

Defined in: [server/\_lib/zoraTrendOpsStore.ts:18](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zoraTrendOpsStore.ts#L18)

##### funnelMetadata

> **funnelMetadata**: `Record`\<`string`, `unknown`\>

Defined in: [server/\_lib/zoraTrendOpsStore.ts:25](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zoraTrendOpsStore.ts#L25)

##### funnelMetrics

> **funnelMetrics**: `Record`\<`string`, `unknown`\>

Defined in: [server/\_lib/zoraTrendOpsStore.ts:27](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zoraTrendOpsStore.ts#L27)

##### groupId

> **groupId**: `string` \| `null`

Defined in: [server/\_lib/zoraTrendOpsStore.ts:21](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zoraTrendOpsStore.ts#L21)

##### id

> **id**: `number`

Defined in: [server/\_lib/zoraTrendOpsStore.ts:14](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zoraTrendOpsStore.ts#L14)

##### lastError

> **lastError**: `string` \| `null`

Defined in: [server/\_lib/zoraTrendOpsStore.ts:24](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zoraTrendOpsStore.ts#L24)

##### predictedCoinAddress

> **predictedCoinAddress**: `string`

Defined in: [server/\_lib/zoraTrendOpsStore.ts:17](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zoraTrendOpsStore.ts#L17)

##### routeability

> **routeability**: `Record`\<`string`, `unknown`\>

Defined in: [server/\_lib/zoraTrendOpsStore.ts:26](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zoraTrendOpsStore.ts#L26)

##### status

> **status**: [`TrendOpStatus`](#trendopstatus)

Defined in: [server/\_lib/zoraTrendOpsStore.ts:23](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zoraTrendOpsStore.ts#L23)

##### ticker

> **ticker**: `string`

Defined in: [server/\_lib/zoraTrendOpsStore.ts:15](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zoraTrendOpsStore.ts#L15)

##### tickerHash

> **tickerHash**: `string`

Defined in: [server/\_lib/zoraTrendOpsStore.ts:16](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zoraTrendOpsStore.ts#L16)

##### txHash

> **txHash**: `string` \| `null`

Defined in: [server/\_lib/zoraTrendOpsStore.ts:19](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zoraTrendOpsStore.ts#L19)

##### updatedAt

> **updatedAt**: `string`

Defined in: [server/\_lib/zoraTrendOpsStore.ts:29](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zoraTrendOpsStore.ts#L29)

##### vaultAddress

> **vaultAddress**: `string` \| `null`

Defined in: [server/\_lib/zoraTrendOpsStore.ts:22](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zoraTrendOpsStore.ts#L22)

***

### TrendOpStatus

> **TrendOpStatus** = `"predicted"` \| `"deploying"` \| `"deployed"` \| `"funnel_pending"` \| `"funnel_completed"` \| `"failed"`

Defined in: [server/\_lib/zoraTrendOpsStore.ts:5](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zoraTrendOpsStore.ts#L5)

## Functions

### applyTrendStatusTransition()

> **applyTrendStatusTransition**(`current`, `next`): `object`

Defined in: [server/\_lib/zoraTrendOpsStore.ts:95](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zoraTrendOpsStore.ts#L95)

#### Parameters

##### current

[`TrendOpStatus`](#trendopstatus)

##### next

[`TrendOpStatus`](#trendopstatus)

#### Returns

`object`

##### changed

> **changed**: `boolean`

##### status

> **status**: [`TrendOpStatus`](#trendopstatus)

***

### ensureZoraTrendOpsSchema()

> **ensureZoraTrendOpsSchema**(`db`): `Promise`\<`void`\>

Defined in: [server/\_lib/zoraTrendOpsStore.ts:115](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zoraTrendOpsStore.ts#L115)

#### Parameters

##### db

`Db`

#### Returns

`Promise`\<`void`\>

***

### getTrendOpByTicker()

> **getTrendOpByTicker**(`ticker`): `Promise`\<[`TrendOpRow`](#trendoprow) \| `null`\>

Defined in: [server/\_lib/zoraTrendOpsStore.ts:167](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zoraTrendOpsStore.ts#L167)

#### Parameters

##### ticker

`string`

#### Returns

`Promise`\<[`TrendOpRow`](#trendoprow) \| `null`\>

***

### getTrendOpByTickerHash()

> **getTrendOpByTickerHash**(`tickerHash`): `Promise`\<[`TrendOpRow`](#trendoprow) \| `null`\>

Defined in: [server/\_lib/zoraTrendOpsStore.ts:154](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zoraTrendOpsStore.ts#L154)

#### Parameters

##### tickerHash

`string`

#### Returns

`Promise`\<[`TrendOpRow`](#trendoprow) \| `null`\>

***

### getTrendOpsMetrics()

> **getTrendOpsMetrics**(`hours`): `Promise`\<\{ `byStatus`: `Record`\<`string`, `number`\>; `total`: `number`; `updatedSince`: `string`; \}\>

Defined in: [server/\_lib/zoraTrendOpsStore.ts:356](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zoraTrendOpsStore.ts#L356)

#### Parameters

##### hours

`number` = `24`

#### Returns

`Promise`\<\{ `byStatus`: `Record`\<`string`, `number`\>; `total`: `number`; `updatedSince`: `string`; \}\>

***

### listRecentTrendOps()

> **listRecentTrendOps**(`limit`): `Promise`\<[`TrendOpRow`](#trendoprow)[]\>

Defined in: [server/\_lib/zoraTrendOpsStore.ts:343](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zoraTrendOpsStore.ts#L343)

#### Parameters

##### limit

`number` = `50`

#### Returns

`Promise`\<[`TrendOpRow`](#trendoprow)[]\>

***

### markTrendOpDeployed()

> **markTrendOpDeployed**(`params`): `Promise`\<[`TrendOpRow`](#trendoprow) \| `null`\>

Defined in: [server/\_lib/zoraTrendOpsStore.ts:293](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zoraTrendOpsStore.ts#L293)

#### Parameters

##### params

###### actorWallet?

`string` \| `null`

###### deployedCoinAddress?

`string` \| `null`

###### tickerHash

`string`

###### txHash?

`string` \| `null`

#### Returns

`Promise`\<[`TrendOpRow`](#trendoprow) \| `null`\>

***

### markTrendOpDeploying()

> **markTrendOpDeploying**(`params`): `Promise`\<[`TrendOpRow`](#trendoprow) \| `null`\>

Defined in: [server/\_lib/zoraTrendOpsStore.ts:280](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zoraTrendOpsStore.ts#L280)

#### Parameters

##### params

###### actorWallet?

`string` \| `null`

###### tickerHash

`string`

###### txHash?

`string` \| `null`

#### Returns

`Promise`\<[`TrendOpRow`](#trendoprow) \| `null`\>

***

### markTrendOpFailed()

> **markTrendOpFailed**(`params`): `Promise`\<[`TrendOpRow`](#trendoprow) \| `null`\>

Defined in: [server/\_lib/zoraTrendOpsStore.ts:308](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zoraTrendOpsStore.ts#L308)

#### Parameters

##### params

###### lastError

`string`

###### tickerHash

`string`

###### txHash?

`string` \| `null`

#### Returns

`Promise`\<[`TrendOpRow`](#trendoprow) \| `null`\>

***

### markTrendOpFunnelCompleted()

> **markTrendOpFunnelCompleted**(`params`): `Promise`\<[`TrendOpRow`](#trendoprow) \| `null`\>

Defined in: [server/\_lib/zoraTrendOpsStore.ts:332](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zoraTrendOpsStore.ts#L332)

#### Parameters

##### params

###### funnelMetrics?

`Record`\<`string`, `unknown`\>

###### tickerHash

`string`

#### Returns

`Promise`\<[`TrendOpRow`](#trendoprow) \| `null`\>

***

### markTrendOpFunnelPending()

> **markTrendOpFunnelPending**(`params`): `Promise`\<[`TrendOpRow`](#trendoprow) \| `null`\>

Defined in: [server/\_lib/zoraTrendOpsStore.ts:321](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zoraTrendOpsStore.ts#L321)

#### Parameters

##### params

###### routeability?

`Record`\<`string`, `unknown`\>

###### tickerHash

`string`

#### Returns

`Promise`\<[`TrendOpRow`](#trendoprow) \| `null`\>

***

### transitionTrendOp()

> **transitionTrendOp**(`params`): `Promise`\<[`TrendOpRow`](#trendoprow) \| `null`\>

Defined in: [server/\_lib/zoraTrendOpsStore.ts:242](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zoraTrendOpsStore.ts#L242)

#### Parameters

##### params

###### actorWallet?

`string` \| `null`

###### deployedCoinAddress?

`string` \| `null`

###### funnelMetrics?

`Record`\<`string`, `unknown`\>

###### lastError?

`string` \| `null`

###### nextStatus

[`TrendOpStatus`](#trendopstatus)

###### routeability?

`Record`\<`string`, `unknown`\>

###### tickerHash

`string`

###### txHash?

`string` \| `null`

#### Returns

`Promise`\<[`TrendOpRow`](#trendoprow) \| `null`\>

***

### upsertTrendPrediction()

> **upsertTrendPrediction**(`params`): `Promise`\<[`TrendOpRow`](#trendoprow)\>

Defined in: [server/\_lib/zoraTrendOpsStore.ts:183](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zoraTrendOpsStore.ts#L183)

#### Parameters

##### params

###### actorWallet?

`string` \| `null`

###### funnelMetadata?

`Record`\<`string`, `unknown`\>

###### groupId?

`string` \| `null`

###### predictedCoinAddress

`string`

###### ticker

`string`

###### tickerHash

`string`

###### vaultAddress?

`string` \| `null`

#### Returns

`Promise`\<[`TrendOpRow`](#trendoprow)\>
