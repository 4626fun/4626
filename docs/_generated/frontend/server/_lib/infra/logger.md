[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / server/\_lib/infra/logger

# server/\_lib/infra/logger

## Variables

### logger

> `const` **logger**: `Logger`

Defined in: [server/\_lib/infra/logger.ts:96](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/infra/logger.ts#L96)

## Functions

### createCorrelationId()

> **createCorrelationId**(`prefix`): `string`

Defined in: [server/\_lib/infra/logger.ts:98](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/infra/logger.ts#L98)

#### Parameters

##### prefix

`string` = `'corr'`

#### Returns

`string`

***

### createCorrelationLogger()

> **createCorrelationLogger**(`prefix`, `baseContext`): `object`

Defined in: [server/\_lib/infra/logger.ts:102](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/infra/logger.ts#L102)

#### Parameters

##### prefix

`string` = `'corr'`

##### baseContext

`LogContext` = `{}`

#### Returns

`object`

##### correlationId

> **correlationId**: `string`

##### logger

> **logger**: `Logger`
