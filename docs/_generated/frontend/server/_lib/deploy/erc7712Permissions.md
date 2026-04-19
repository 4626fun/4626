[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / server/\_lib/deploy/erc7712Permissions

# server/\_lib/deploy/erc7712Permissions

## Type Aliases

### DeployCall

> **DeployCall** = `object`

Defined in: [server/\_lib/deploy/erc7712Permissions.ts:3](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/deploy/erc7712Permissions.ts#L3)

#### Properties

##### data

> **data**: `Hex`

Defined in: [server/\_lib/deploy/erc7712Permissions.ts:3](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/deploy/erc7712Permissions.ts#L3)

##### to

> **to**: `Address`

Defined in: [server/\_lib/deploy/erc7712Permissions.ts:3](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/deploy/erc7712Permissions.ts#L3)

##### value

> **value**: `bigint`

Defined in: [server/\_lib/deploy/erc7712Permissions.ts:3](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/deploy/erc7712Permissions.ts#L3)

***

### Erc7712PermissionGrant

> **Erc7712PermissionGrant** = `object`

Defined in: [server/\_lib/deploy/erc7712Permissions.ts:5](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/deploy/erc7712Permissions.ts#L5)

#### Properties

##### allowedSelectors

> **allowedSelectors**: `Hex`[]

Defined in: [server/\_lib/deploy/erc7712Permissions.ts:12](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/deploy/erc7712Permissions.ts#L12)

##### allowedTargets

> **allowedTargets**: `Address`[]

Defined in: [server/\_lib/deploy/erc7712Permissions.ts:11](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/deploy/erc7712Permissions.ts#L11)

##### chainId

> **chainId**: `number`

Defined in: [server/\_lib/deploy/erc7712Permissions.ts:7](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/deploy/erc7712Permissions.ts#L7)

##### sessionId

> **sessionId**: `string`

Defined in: [server/\_lib/deploy/erc7712Permissions.ts:10](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/deploy/erc7712Permissions.ts#L10)

##### validAfter

> **validAfter**: `string`

Defined in: [server/\_lib/deploy/erc7712Permissions.ts:8](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/deploy/erc7712Permissions.ts#L8)

##### validUntil

> **validUntil**: `string`

Defined in: [server/\_lib/deploy/erc7712Permissions.ts:9](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/deploy/erc7712Permissions.ts#L9)

##### version

> **version**: `"erc7712-v1"`

Defined in: [server/\_lib/deploy/erc7712Permissions.ts:6](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/deploy/erc7712Permissions.ts#L6)

## Functions

### buildDeployPermissionGrant()

> **buildDeployPermissionGrant**(`params`): [`Erc7712PermissionGrant`](#erc7712permissiongrant)

Defined in: [server/\_lib/deploy/erc7712Permissions.ts:28](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/deploy/erc7712Permissions.ts#L28)

#### Parameters

##### params

###### calls

[`DeployCall`](#deploycall)[]

###### chainId?

`number`

###### sessionId

`string`

###### validAfter

`Date`

###### validUntil

`Date`

#### Returns

[`Erc7712PermissionGrant`](#erc7712permissiongrant)

***

### parseGrant()

> **parseGrant**(`raw`): [`Erc7712PermissionGrant`](#erc7712permissiongrant) \| `null`

Defined in: [server/\_lib/deploy/erc7712Permissions.ts:99](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/deploy/erc7712Permissions.ts#L99)

#### Parameters

##### raw

`unknown`

#### Returns

[`Erc7712PermissionGrant`](#erc7712permissiongrant) \| `null`

***

### validateCallsAgainstGrant()

> **validateCallsAgainstGrant**(`params`): `object`

Defined in: [server/\_lib/deploy/erc7712Permissions.ts:59](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/deploy/erc7712Permissions.ts#L59)

#### Parameters

##### params

###### calls

[`DeployCall`](#deploycall)[]

###### expectedChainId?

`number`

###### expectedSessionId?

`string`

###### grant

[`Erc7712PermissionGrant`](#erc7712permissiongrant) \| `null` \| `undefined`

###### now?

`Date`

#### Returns

`object`

##### ok

> **ok**: `boolean`

##### reason?

> `optional` **reason**: `string`
