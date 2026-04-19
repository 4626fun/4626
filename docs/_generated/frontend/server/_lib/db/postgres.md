[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / server/\_lib/db/postgres

# server/\_lib/db/postgres

## Functions

### ensureCreatorAccessSchema()

> **ensureCreatorAccessSchema**(): `Promise`\<`void`\>

Defined in: [server/\_lib/db/postgres.ts:507](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/db/postgres.ts#L507)

#### Returns

`Promise`\<`void`\>

***

### getDb()

> **getDb**(): `Promise`\<`DbPool` \| `null`\>

Defined in: [server/\_lib/db/postgres.ts:273](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/db/postgres.ts#L273)

#### Returns

`Promise`\<`DbPool` \| `null`\>

***

### getDbInitError()

> **getDbInitError**(): `string` \| `null`

Defined in: [server/\_lib/db/postgres.ts:269](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/db/postgres.ts#L269)

#### Returns

`string` \| `null`

***

### isDbConfigured()

> **isDbConfigured**(): `boolean`

Defined in: [server/\_lib/db/postgres.ts:265](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/db/postgres.ts#L265)

Returns true if a Postgres connection string appears to be configured in env.
Note: this doesn't guarantee connectivity.

#### Returns

`boolean`
