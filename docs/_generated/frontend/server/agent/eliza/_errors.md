[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / server/agent/eliza/\_errors

# server/agent/eliza/\_errors

## Classes

### AgentError

Defined in: [server/agent/eliza/\_errors.ts:16](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/agent/eliza/_errors.ts#L16)

#### Extends

- `Error`

#### Constructors

##### Constructor

> **new AgentError**(`code`, `message`, `options?`): [`AgentError`](#agenterror)

Defined in: [server/agent/eliza/\_errors.ts:21](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/agent/eliza/_errors.ts#L21)

###### Parameters

###### code

[`AgentErrorCode`](#agenterrorcode-1)

###### message

`string`

###### options?

###### cause?

`unknown`

###### details?

`Record`\<`string`, `unknown`\>

###### retryable?

`boolean`

###### Returns

[`AgentError`](#agenterror)

###### Overrides

`Error.constructor`

#### Properties

##### code

> `readonly` **code**: [`AgentErrorCode`](#agenterrorcode-1)

Defined in: [server/agent/eliza/\_errors.ts:17](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/agent/eliza/_errors.ts#L17)

##### details?

> `readonly` `optional` **details**: `Record`\<`string`, `unknown`\>

Defined in: [server/agent/eliza/\_errors.ts:19](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/agent/eliza/_errors.ts#L19)

##### retryable

> `readonly` **retryable**: `boolean`

Defined in: [server/agent/eliza/\_errors.ts:18](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/agent/eliza/_errors.ts#L18)

## Type Aliases

### AgentErrorCode

> **AgentErrorCode** = `"INVALID_ENV"` \| `"STARTUP_FAILED"` \| `"DEPENDENCY_UNAVAILABLE"` \| `"UNAUTHORIZED"` \| `"RATE_LIMITED"` \| `"BUDGET_EXCEEDED"` \| `"UPSTREAM_TIMEOUT"` \| `"UPSTREAM_ERROR"` \| `"ACTION_FAILED"` \| `"QUEUE_ERROR"` \| `"SESSION_ERROR"` \| `"RUNTIME_ERROR"` \| `"UNKNOWN"`

Defined in: [server/agent/eliza/\_errors.ts:1](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/agent/eliza/_errors.ts#L1)

## Functions

### isRetryableAgentError()

> **isRetryableAgentError**(`error`): `boolean`

Defined in: [server/agent/eliza/\_errors.ts:41](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/agent/eliza/_errors.ts#L41)

#### Parameters

##### error

`unknown`

#### Returns

`boolean`

***

### toAgentError()

> **toAgentError**(`error`, `fallbackCode`, `fallbackMessage`): [`AgentError`](#agenterror)

Defined in: [server/agent/eliza/\_errors.ts:64](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/agent/eliza/_errors.ts#L64)

#### Parameters

##### error

`unknown`

##### fallbackCode

[`AgentErrorCode`](#agenterrorcode-1) = `'UNKNOWN'`

##### fallbackMessage

`string` = `'Unexpected agent error'`

#### Returns

[`AgentError`](#agenterror)

***

### toErrorDetails()

> **toErrorDetails**(`error`): `Record`\<`string`, `unknown`\>

Defined in: [server/agent/eliza/\_errors.ts:45](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/agent/eliza/_errors.ts#L45)

#### Parameters

##### error

`unknown`

#### Returns

`Record`\<`string`, `unknown`\>

***

### toUserFacingAgentErrorMessage()

> **toUserFacingAgentErrorMessage**(`error`): `string`

Defined in: [server/agent/eliza/\_errors.ts:96](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/agent/eliza/_errors.ts#L96)

#### Parameters

##### error

[`AgentError`](#agenterror)

#### Returns

`string`
