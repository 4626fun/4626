[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/dune/duneApi

# server/\_lib/dune/duneApi

## Type Aliases

### DuneExecutionResults

> **DuneExecutionResults** = `object`

Defined in: [server/\_lib/dune/duneApi.ts:21](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/dune/duneApi.ts#L21)

#### Properties

##### error?

> `optional` **error**: `object`

Defined in: [server/\_lib/dune/duneApi.ts:28](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/dune/duneApi.ts#L28)

###### message?

> `optional` **message**: `string`

###### type?

> `optional` **type**: `string`

##### execution\_id?

> `optional` **execution\_id**: `string`

Defined in: [server/\_lib/dune/duneApi.ts:22](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/dune/duneApi.ts#L22)

##### result?

> `optional` **result**: `object`

Defined in: [server/\_lib/dune/duneApi.ts:24](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/dune/duneApi.ts#L24)

###### metadata?

> `optional` **metadata**: `object`

###### metadata.column\_names?

> `optional` **column\_names**: `string`[]

###### metadata.row\_count?

> `optional` **row\_count**: `number`

###### rows?

> `optional` **rows**: `Record`\<`string`, `unknown`\>[]

##### state?

> `optional` **state**: [`DuneExecutionState`](#duneexecutionstate)

Defined in: [server/\_lib/dune/duneApi.ts:23](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/dune/duneApi.ts#L23)

***

### DuneExecutionState

> **DuneExecutionState** = `"QUERY_STATE_PENDING"` \| `"QUERY_STATE_EXECUTING"` \| `"QUERY_STATE_COMPLETED"` \| `"QUERY_STATE_FAILED"` \| `"QUERY_STATE_CANCELLED"` \| `string`

Defined in: [server/\_lib/dune/duneApi.ts:8](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/dune/duneApi.ts#L8)

***

### DuneSqlExecuteResponse

> **DuneSqlExecuteResponse** = `object`

Defined in: [server/\_lib/dune/duneApi.ts:16](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/dune/duneApi.ts#L16)

#### Properties

##### execution\_id?

> `optional` **execution\_id**: `string`

Defined in: [server/\_lib/dune/duneApi.ts:17](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/dune/duneApi.ts#L17)

##### state?

> `optional` **state**: [`DuneExecutionState`](#duneexecutionstate)

Defined in: [server/\_lib/dune/duneApi.ts:18](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/dune/duneApi.ts#L18)

## Functions

### executeDuneSql()

> **executeDuneSql**(`sql`, `options?`): `Promise`\<[`DuneSqlExecuteResponse`](#dunesqlexecuteresponse)\>

Defined in: [server/\_lib/dune/duneApi.ts:47](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/dune/duneApi.ts#L47)

#### Parameters

##### sql

`string`

##### options?

###### performance?

`"small"` \| `"medium"` \| `"large"`

#### Returns

`Promise`\<[`DuneSqlExecuteResponse`](#dunesqlexecuteresponse)\>

***

### fetchDuneExecutionResults()

> **fetchDuneExecutionResults**(`executionId`): `Promise`\<[`DuneExecutionResults`](#duneexecutionresults)\>

Defined in: [server/\_lib/dune/duneApi.ts:83](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/dune/duneApi.ts#L83)

#### Parameters

##### executionId

`string`

#### Returns

`Promise`\<[`DuneExecutionResults`](#duneexecutionresults)\>

***

### isDuneConfigured()

> **isDuneConfigured**(): `boolean`

Defined in: [server/\_lib/dune/duneApi.ts:36](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/dune/duneApi.ts#L36)

#### Returns

`boolean`

***

### readDuneApiKey()

> **readDuneApiKey**(): `string` \| `null`

Defined in: [server/\_lib/dune/duneApi.ts:31](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/dune/duneApi.ts#L31)

#### Returns

`string` \| `null`

***

### runDuneSqlRows()

> **runDuneSqlRows**(`sql`, `options?`): `Promise`\<`Record`\<`string`, `unknown`\>[]\>

Defined in: [server/\_lib/dune/duneApi.ts:148](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/dune/duneApi.ts#L148)

#### Parameters

##### sql

`string`

##### options?

###### maxWaitMs?

`number`

###### performance?

`"small"` \| `"medium"` \| `"large"`

#### Returns

`Promise`\<`Record`\<`string`, `unknown`\>[]\>

***

### waitForDuneExecutionResults()

> **waitForDuneExecutionResults**(`executionId`, `options?`): `Promise`\<[`DuneExecutionResults`](#duneexecutionresults)\>

Defined in: [server/\_lib/dune/duneApi.ts:121](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/dune/duneApi.ts#L121)

#### Parameters

##### executionId

`string`

##### options?

###### maxWaitMs?

`number`

###### pollMs?

`number`

#### Returns

`Promise`\<[`DuneExecutionResults`](#duneexecutionresults)\>
