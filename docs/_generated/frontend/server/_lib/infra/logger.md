[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/infra/logger

# server/\_lib/infra/logger

## Type Aliases

### Logger

> **Logger** = `object`

Defined in: [server/\_lib/infra/logger.ts:7](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/infra/logger.ts#L7)

#### Properties

##### child()

> **child**: (`context`) => [`Logger`](#logger)

Defined in: [server/\_lib/infra/logger.ts:12](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/infra/logger.ts#L12)

###### Parameters

###### context

`LogContext`

###### Returns

[`Logger`](#logger)

##### debug()

> **debug**: (`msg`, `data?`) => `void`

Defined in: [server/\_lib/infra/logger.ts:8](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/infra/logger.ts#L8)

###### Parameters

###### msg

`string`

###### data?

`unknown`

###### Returns

`void`

##### error()

> **error**: (`msg`, `data?`) => `void`

Defined in: [server/\_lib/infra/logger.ts:11](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/infra/logger.ts#L11)

###### Parameters

###### msg

`string`

###### data?

`unknown`

###### Returns

`void`

##### info()

> **info**: (`msg`, `data?`) => `void`

Defined in: [server/\_lib/infra/logger.ts:9](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/infra/logger.ts#L9)

###### Parameters

###### msg

`string`

###### data?

`unknown`

###### Returns

`void`

##### warn()

> **warn**: (`msg`, `data?`) => `void`

Defined in: [server/\_lib/infra/logger.ts:10](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/infra/logger.ts#L10)

###### Parameters

###### msg

`string`

###### data?

`unknown`

###### Returns

`void`

##### withCorrelationId()

> **withCorrelationId**: (`correlationId`) => [`Logger`](#logger)

Defined in: [server/\_lib/infra/logger.ts:13](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/infra/logger.ts#L13)

###### Parameters

###### correlationId

`string`

###### Returns

[`Logger`](#logger)

## Variables

### logger

> `const` **logger**: [`Logger`](#logger)

Defined in: [server/\_lib/infra/logger.ts:96](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/infra/logger.ts#L96)

## Functions

### createCorrelationId()

> **createCorrelationId**(`prefix`): `string`

Defined in: [server/\_lib/infra/logger.ts:98](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/infra/logger.ts#L98)

#### Parameters

##### prefix

`string` = `'corr'`

#### Returns

`string`

***

### createCorrelationLogger()

> **createCorrelationLogger**(`prefix`, `baseContext`): `object`

Defined in: [server/\_lib/infra/logger.ts:102](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/infra/logger.ts#L102)

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

> **logger**: [`Logger`](#logger)
