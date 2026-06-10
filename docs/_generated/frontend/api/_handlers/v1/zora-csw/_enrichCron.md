[**4626-web**](../../../../index.md)

***

[4626-web](../../../../index.md) / api/\_handlers/v1/zora-csw/\_enrichCron

# api/\_handlers/v1/zora-csw/\_enrichCron

## Interfaces

### ZoraCswEnrichCronHandlerHooks

Defined in: [api/\_handlers/v1/zora-csw/\_enrichCron.ts:64](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/v1/zora-csw/_enrichCron.ts#L64)

Test seam — inject collaborators so handler tests can drive the cron
without RPC or Supabase.

#### Properties

##### budget?

> `optional` **budget**: `number`

Defined in: [api/\_handlers/v1/zora-csw/\_enrichCron.ts:85](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/v1/zora-csw/_enrichCron.ts#L85)

##### concurrency?

> `optional` **concurrency**: `number`

Defined in: [api/\_handlers/v1/zora-csw/\_enrichCron.ts:86](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/v1/zora-csw/_enrichCron.ts#L86)

##### db?

> `optional` **db**: `SupabaseClient`\<`any`, `"public"`, `"public"`, `any`, `any`\>

Defined in: [api/\_handlers/v1/zora-csw/\_enrichCron.ts:65](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/v1/zora-csw/_enrichCron.ts#L65)

##### enrichOne()?

> `optional` **enrichOne**: (`csw`) => `Promise`\<\{ `addressOwners`: `string`[]; `nextOwnerIndex`: `bigint` \| `null`; `passkeyOwnerCount`: `number`; `removedOwnersCount`: `bigint` \| `null`; \}\>

Defined in: [api/\_handlers/v1/zora-csw/\_enrichCron.ts:69](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/v1/zora-csw/_enrichCron.ts#L69)

Override the per-row enricher (lets tests inject success/failure mix).

###### Parameters

###### csw

`string`

###### Returns

`Promise`\<\{ `addressOwners`: `string`[]; `nextOwnerIndex`: `bigint` \| `null`; `passkeyOwnerCount`: `number`; `removedOwnersCount`: `bigint` \| `null`; \}\>

##### ethosBudget?

> `optional` **ethosBudget**: `number`

Defined in: [api/\_handlers/v1/zora-csw/\_enrichCron.ts:87](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/v1/zora-csw/_enrichCron.ts#L87)

##### getClient()?

> `optional` **getClient**: () => `Promise`\<\{ \}\>

Defined in: [api/\_handlers/v1/zora-csw/\_enrichCron.ts:67](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/v1/zora-csw/_enrichCron.ts#L67)

Returns a viem-compatible public client for the multicall.

###### Returns

`Promise`\<\{ \}\>

##### refreshOwnerEthosScores()?

> `optional` **refreshOwnerEthosScores**: (`db`, `ownerAddresses`, `maxAddresses`) => `Promise`\<[`OwnerEthosRefreshResult`](../../../../server/_lib/zora-csw/ownerEthosScores.md#ownerethosrefreshresult)\>

Defined in: [api/\_handlers/v1/zora-csw/\_enrichCron.ts:80](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/v1/zora-csw/_enrichCron.ts#L80)

###### Parameters

###### db

`SupabaseClient`

###### ownerAddresses

`string`[]

###### maxAddresses

`number`

###### Returns

`Promise`\<[`OwnerEthosRefreshResult`](../../../../server/_lib/zora-csw/ownerEthosScores.md#ownerethosrefreshresult)\>

##### selectCandidates()?

> `optional` **selectCandidates**: (`db`, `budget`) => `Promise`\<[`EnrichCandidate`](#enrichcandidate)[]\>

Defined in: [api/\_handlers/v1/zora-csw/\_enrichCron.ts:76](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/v1/zora-csw/_enrichCron.ts#L76)

Override the candidate selector (lets tests force a specific batch).

###### Parameters

###### db

`SupabaseClient`

###### budget

`number`

###### Returns

`Promise`\<[`EnrichCandidate`](#enrichcandidate)[]\>

## Type Aliases

### EnrichCandidate

> **EnrichCandidate** = `object`

Defined in: [api/\_handlers/v1/zora-csw/\_enrichCron.ts:45](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/v1/zora-csw/_enrichCron.ts#L45)

#### Properties

##### creation\_block

> **creation\_block**: `number` \| `null`

Defined in: [api/\_handlers/v1/zora-csw/\_enrichCron.ts:47](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/v1/zora-csw/_enrichCron.ts#L47)

##### csw\_address

> **csw\_address**: `string`

Defined in: [api/\_handlers/v1/zora-csw/\_enrichCron.ts:46](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/v1/zora-csw/_enrichCron.ts#L46)

***

### EnrichOutcome

> **EnrichOutcome** = `object`

Defined in: [api/\_handlers/v1/zora-csw/\_enrichCron.ts:50](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/v1/zora-csw/_enrichCron.ts#L50)

#### Properties

##### csw

> **csw**: `string`

Defined in: [api/\_handlers/v1/zora-csw/\_enrichCron.ts:51](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/v1/zora-csw/_enrichCron.ts#L51)

##### current\_owners?

> `optional` **current\_owners**: `string`[]

Defined in: [api/\_handlers/v1/zora-csw/\_enrichCron.ts:53](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/v1/zora-csw/_enrichCron.ts#L53)

##### error?

> `optional` **error**: `string`

Defined in: [api/\_handlers/v1/zora-csw/\_enrichCron.ts:57](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/v1/zora-csw/_enrichCron.ts#L57)

##### next\_owner\_index?

> `optional` **next\_owner\_index**: `string` \| `null`

Defined in: [api/\_handlers/v1/zora-csw/\_enrichCron.ts:55](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/v1/zora-csw/_enrichCron.ts#L55)

##### ok

> **ok**: `boolean`

Defined in: [api/\_handlers/v1/zora-csw/\_enrichCron.ts:52](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/v1/zora-csw/_enrichCron.ts#L52)

##### passkey\_owner\_count?

> `optional` **passkey\_owner\_count**: `number`

Defined in: [api/\_handlers/v1/zora-csw/\_enrichCron.ts:54](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/v1/zora-csw/_enrichCron.ts#L54)

##### removed\_owners\_count?

> `optional` **removed\_owners\_count**: `string` \| `null`

Defined in: [api/\_handlers/v1/zora-csw/\_enrichCron.ts:56](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/v1/zora-csw/_enrichCron.ts#L56)

## Functions

### \_\_resetZoraCswEnrichCronHandlerHooksForTest()

> **\_\_resetZoraCswEnrichCronHandlerHooksForTest**(): `void`

Defined in: [api/\_handlers/v1/zora-csw/\_enrichCron.ts:98](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/v1/zora-csw/_enrichCron.ts#L98)

#### Returns

`void`

***

### \_\_setZoraCswEnrichCronHandlerHooksForTest()

> **\_\_setZoraCswEnrichCronHandlerHooksForTest**(`hooks`): `void`

Defined in: [api/\_handlers/v1/zora-csw/\_enrichCron.ts:92](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/v1/zora-csw/_enrichCron.ts#L92)

#### Parameters

##### hooks

[`ZoraCswEnrichCronHandlerHooks`](#zoracswenrichcronhandlerhooks)

#### Returns

`void`

***

### default()

> **default**(`req`, `res`): `Promise`\<`void`\>

Defined in: [api/\_handlers/v1/zora-csw/\_enrichCron.ts:173](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/v1/zora-csw/_enrichCron.ts#L173)

#### Parameters

##### req

`VercelRequest`

##### res

`VercelResponse`

#### Returns

`Promise`\<`void`\>
