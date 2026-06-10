[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/dune/duneMetricSql

# server/\_lib/dune/duneMetricSql

## Type Aliases

### DuneMetricKey

> **DuneMetricKey** = keyof *typeof* `METRIC_SQL_FILES`

Defined in: [server/\_lib/dune/duneMetricSql.ts:19](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/dune/duneMetricSql.ts#L19)

## Functions

### isDuneMetricKey()

> **isDuneMetricKey**(`value`): `value is string`

Defined in: [server/\_lib/dune/duneMetricSql.ts:25](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/dune/duneMetricSql.ts#L25)

#### Parameters

##### value

`string`

#### Returns

`value is string`

***

### listDuneMetricKeys()

> **listDuneMetricKeys**(): `string`[]

Defined in: [server/\_lib/dune/duneMetricSql.ts:21](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/dune/duneMetricSql.ts#L21)

#### Returns

`string`[]

***

### loadDuneMetricSql()

> **loadDuneMetricSql**(`metric`): `string`

Defined in: [server/\_lib/dune/duneMetricSql.ts:29](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/dune/duneMetricSql.ts#L29)

#### Parameters

##### metric

`string`

#### Returns

`string`

***

### stripSqlComments()

> **stripSqlComments**(`sql`): `string`

Defined in: [server/\_lib/dune/duneMetricSql.ts:5](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/dune/duneMetricSql.ts#L5)

Strip SQL line comments for Dune execute-sql API payloads.

#### Parameters

##### sql

`string`

#### Returns

`string`
