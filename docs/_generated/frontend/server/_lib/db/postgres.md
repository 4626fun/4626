[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/db/postgres

# server/\_lib/db/postgres

## Type Aliases

### DbPool

> **DbPool** = `object`

Defined in: [server/\_lib/db/postgres.ts:130](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/db/postgres.ts#L130)

#### Properties

##### query()?

> `optional` **query**: (`text`, `params?`) => `Promise`\<`DbResult`\>

Defined in: [server/\_lib/db/postgres.ts:133](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/db/postgres.ts#L133)

###### Parameters

###### text

`string`

###### params?

`any`[]

###### Returns

`Promise`\<`DbResult`\>

##### sql()

> **sql**: \<`T`\>(`strings`, ...`values`) => `Promise`\<`DbResult`\<`T`\>\>

Defined in: [server/\_lib/db/postgres.ts:131](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/db/postgres.ts#L131)

###### Type Parameters

###### T

`T` = `any`

###### Parameters

###### strings

`TemplateStringsArray`

###### values

...`any`[]

###### Returns

`Promise`\<`DbResult`\<`T`\>\>

## Functions

### ensureCreatorAccessSchema()

> **ensureCreatorAccessSchema**(): `Promise`\<`void`\>

Defined in: [server/\_lib/db/postgres.ts:711](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/db/postgres.ts#L711)

#### Returns

`Promise`\<`void`\>

***

### getDb()

> **getDb**(): `Promise`\<[`DbPool`](#dbpool) \| `null`\>

Defined in: [server/\_lib/db/postgres.ts:412](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/db/postgres.ts#L412)

#### Returns

`Promise`\<[`DbPool`](#dbpool) \| `null`\>

***

### getDbForCron()

> **getDbForCron**(`deadlineMs?`): `Promise`\<[`DbPool`](#dbpool) \| `null`\>

Defined in: [server/\_lib/db/postgres.ts:387](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/db/postgres.ts#L387)

Cron handlers should use this instead of bare `getDb()` so a saturated Supabase pool
does not hold the Vercel function until maxDuration (connection acquire can retry
for tens of seconds per query).

#### Parameters

##### deadlineMs?

`number`

#### Returns

`Promise`\<[`DbPool`](#dbpool) \| `null`\>

***

### getDbInitError()

> **getDbInitError**(): `string` \| `null`

Defined in: [server/\_lib/db/postgres.ts:378](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/db/postgres.ts#L378)

#### Returns

`string` \| `null`

***

### isDbConfigured()

> **isDbConfigured**(): `boolean`

Defined in: [server/\_lib/db/postgres.ts:374](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/db/postgres.ts#L374)

Returns true if a Postgres connection string appears to be configured in env.
Note: this doesn't guarantee connectivity.

#### Returns

`boolean`

***

### isPostgresPoolSaturatedError()

> **isPostgresPoolSaturatedError**(`err`): `boolean`

Defined in: [server/\_lib/db/postgres.ts:224](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/db/postgres.ts#L224)

True when Supabase session pool or a torn-down pg pool rejected the connection.

#### Parameters

##### err

`unknown`

#### Returns

`boolean`

***

### runInTransaction()

> **runInTransaction**\<`T`\>(`fn`): `Promise`\<`T` \| `null`\>

Defined in: [server/\_lib/db/postgres.ts:164](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/db/postgres.ts#L164)

#### Type Parameters

##### T

`T`

#### Parameters

##### fn

(`db`) => `Promise`\<`T`\>

#### Returns

`Promise`\<`T` \| `null`\>
