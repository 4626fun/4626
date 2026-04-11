[**4626-app**](../../index.md)

***

[4626-app](../../index.md) / server/\_lib/postgres

# server/\_lib/postgres

## Functions

### ensureCreatorAccessSchema()

> **ensureCreatorAccessSchema**(): `Promise`\<`void`\>

Defined in: [server/\_lib/postgres.ts:496](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/postgres.ts#L496)

#### Returns

`Promise`\<`void`\>

***

### getDb()

> **getDb**(): `Promise`\<`DbPool` \| `null`\>

Defined in: [server/\_lib/postgres.ts:262](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/postgres.ts#L262)

#### Returns

`Promise`\<`DbPool` \| `null`\>

***

### getDbInitError()

> **getDbInitError**(): `string` \| `null`

Defined in: [server/\_lib/postgres.ts:258](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/postgres.ts#L258)

#### Returns

`string` \| `null`

***

### isDbConfigured()

> **isDbConfigured**(): `boolean`

Defined in: [server/\_lib/postgres.ts:254](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/postgres.ts#L254)

Returns true if a Postgres connection string appears to be configured in env.
Note: this doesn't guarantee connectivity.

#### Returns

`boolean`
