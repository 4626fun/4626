[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / server/\_lib/auth/deployAuth

# server/\_lib/auth/deployAuth

## Type Aliases

### DeployAuthContext

> **DeployAuthContext** = \{ `address`: `Address`; `type`: `"session"`; \} \| \{ `address`: `Address`; `agentId`: `number`; `agentRegistry`: `string`; `chainId`: `number`; `type`: `"siwa"`; \}

Defined in: [server/\_lib/auth/deployAuth.ts:8](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/auth/deployAuth.ts#L8)

## Functions

### readDeployAuthFromRequest()

> **readDeployAuthFromRequest**(`req`): [`DeployAuthContext`](#deployauthcontext) \| `null`

Defined in: [server/\_lib/auth/deployAuth.ts:25](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/auth/deployAuth.ts#L25)

#### Parameters

##### req

`VercelRequest`

#### Returns

[`DeployAuthContext`](#deployauthcontext) \| `null`
