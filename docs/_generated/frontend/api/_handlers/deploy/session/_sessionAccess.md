[**4626-app**](../../../../index.md)

***

[4626-app](../../../../index.md) / api/\_handlers/deploy/session/\_sessionAccess

# api/\_handlers/deploy/session/\_sessionAccess

## Classes

### DeploySessionAccessError

Defined in: [api/\_handlers/deploy/session/\_sessionAccess.ts:10](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/session/_sessionAccess.ts#L10)

#### Extends

- `Error`

#### Constructors

##### Constructor

> **new DeploySessionAccessError**(`status`, `message`): [`DeploySessionAccessError`](#deploysessionaccesserror)

Defined in: [api/\_handlers/deploy/session/\_sessionAccess.ts:13](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/session/_sessionAccess.ts#L13)

###### Parameters

###### status

`number`

###### message

`string`

###### Returns

[`DeploySessionAccessError`](#deploysessionaccesserror)

###### Overrides

`Error.constructor`

#### Properties

##### status

> **status**: `number`

Defined in: [api/\_handlers/deploy/session/\_sessionAccess.ts:11](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/session/_sessionAccess.ts#L11)

## Functions

### loadAuthorizedDeploySession()

> **loadAuthorizedDeploySession**(`params`): `Promise`\<\{ `auth`: \{ `address`: `` `0x${string}` ``; `type`: `"session"`; \} \| \{ `address`: `` `0x${string}` ``; `agentId`: `number`; `agentRegistry`: `string`; `chainId`: `number`; `type`: `"siwa"`; \}; `rec`: [`DeploySessionRecord`](../../../../server/_lib/deploySessions.md#deploysessionrecord); `sessionAddress`: `` `0x${string}` ``; \}\>

Defined in: [api/\_handlers/deploy/session/\_sessionAccess.ts:26](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/session/_sessionAccess.ts#L26)

#### Parameters

##### params

###### getDeploySessionById

(`id`) => `Promise`\<[`DeploySessionRecord`](../../../../server/_lib/deploySessions.md#deploysessionrecord) \| `null`\>

###### req

`VercelRequest`

###### sessionId

`string`

#### Returns

`Promise`\<\{ `auth`: \{ `address`: `` `0x${string}` ``; `type`: `"session"`; \} \| \{ `address`: `` `0x${string}` ``; `agentId`: `number`; `agentRegistry`: `string`; `chainId`: `number`; `type`: `"siwa"`; \}; `rec`: [`DeploySessionRecord`](../../../../server/_lib/deploySessions.md#deploysessionrecord); `sessionAddress`: `` `0x${string}` ``; \}\>

***

### normalizeDeploySessionId()

> **normalizeDeploySessionId**(`value`): `string` \| `null`

Defined in: [api/\_handlers/deploy/session/\_sessionAccess.ts:20](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/session/_sessionAccess.ts#L20)

#### Parameters

##### value

`unknown`

#### Returns

`string` \| `null`
