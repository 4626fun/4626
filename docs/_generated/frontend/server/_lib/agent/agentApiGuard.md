[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / server/\_lib/agent/agentApiGuard

# server/\_lib/agent/agentApiGuard

## Type Aliases

### AgentApiAuthContext

> **AgentApiAuthContext** = \{ `address`: `string`; `type`: `"session"`; \} \| \{ `address`: `string`; `agentId`: `number`; `agentRegistry`: `string`; `chainId`: `number`; `type`: `"siwa"`; \}

Defined in: [server/\_lib/agent/agentApiGuard.ts:16](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/agent/agentApiGuard.ts#L16)

## Variables

### AGENT\_RATE\_LIMITS

> `const` **AGENT\_RATE\_LIMITS**: `object`

Defined in: [server/\_lib/agent/agentApiGuard.ts:9](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/agent/agentApiGuard.ts#L9)

#### Type Declaration

##### build

> `readonly` **build**: `object`

###### build.maxRequests

> `readonly` **maxRequests**: `60` = `60`

###### build.windowMs

> `readonly` **windowMs**: `60000` = `60_000`

##### logs

> `readonly` **logs**: `object`

###### logs.maxRequests

> `readonly` **maxRequests**: `30` = `30`

###### logs.windowMs

> `readonly` **windowMs**: `60000` = `60_000`

##### read

> `readonly` **read**: `object`

###### read.maxRequests

> `readonly` **maxRequests**: `120` = `120`

###### read.windowMs

> `readonly` **windowMs**: `60000` = `60_000`

##### write

> `readonly` **write**: `object`

###### write.maxRequests

> `readonly` **maxRequests**: `30` = `30`

###### write.windowMs

> `readonly` **windowMs**: `60000` = `60_000`

## Functions

### guardAgentApiRequest()

> **guardAgentApiRequest**(`params`): `Promise`\<\{ `auth`: [`AgentApiAuthContext`](#agentapiauthcontext) \| `null`; `ip`: `string`; `ok`: `true`; \} \| \{ `ip`: `string`; `ok`: `false`; \}\>

Defined in: [server/\_lib/agent/agentApiGuard.ts:26](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/agent/agentApiGuard.ts#L26)

#### Parameters

##### params

###### endpoint

`string`

###### kind

`"read"` \| `"write"` \| `"logs"` \| `"build"`

###### req

`VercelRequest`

###### res

`VercelResponse`

#### Returns

`Promise`\<\{ `auth`: [`AgentApiAuthContext`](#agentapiauthcontext) \| `null`; `ip`: `string`; `ok`: `true`; \} \| \{ `ip`: `string`; `ok`: `false`; \}\>
