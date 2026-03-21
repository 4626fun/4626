[**4626-app**](../../../../index.md)

***

[4626-app](../../../../index.md) / api/\_handlers/deploy/session/\_sessionAccess

# api/\_handlers/deploy/session/\_sessionAccess

## Classes

### DeploySessionAccessError

Defined in: [api/\_handlers/deploy/session/\_sessionAccess.ts:8](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/session/_sessionAccess.ts#L8)

#### Extends

- `Error`

#### Constructors

##### Constructor

> **new DeploySessionAccessError**(`status`, `message`): [`DeploySessionAccessError`](#deploysessionaccesserror)

Defined in: [api/\_handlers/deploy/session/\_sessionAccess.ts:11](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/session/_sessionAccess.ts#L11)

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

Defined in: [api/\_handlers/deploy/session/\_sessionAccess.ts:9](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/session/_sessionAccess.ts#L9)

## Functions

### loadAuthorizedDeploySession()

> **loadAuthorizedDeploySession**(`params`): `Promise`\<\{ `auth`: \{ `address`: `` `0x${string}` ``; `type`: `"session"`; \} \| \{ `address`: `` `0x${string}` ``; `agentId`: `number`; `agentRegistry`: `string`; `chainId`: `number`; `type`: `"siwa"`; \}; `rec`: `DeploySessionRecord`; `sessionAddress`: `` `0x${string}` ``; \}\>

Defined in: [api/\_handlers/deploy/session/\_sessionAccess.ts:18](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/session/_sessionAccess.ts#L18)

#### Parameters

##### params

###### getDeploySessionById

(`id`) => `Promise`\<`DeploySessionRecord` \| `null`\>

###### req

`any`

###### sessionId

`string`

#### Returns

`Promise`\<\{ `auth`: \{ `address`: `` `0x${string}` ``; `type`: `"session"`; \} \| \{ `address`: `` `0x${string}` ``; `agentId`: `number`; `agentRegistry`: `string`; `chainId`: `number`; `type`: `"siwa"`; \}; `rec`: `DeploySessionRecord`; `sessionAddress`: `` `0x${string}` ``; \}\>
