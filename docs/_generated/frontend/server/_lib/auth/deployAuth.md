[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / server/\_lib/auth/deployAuth

# server/\_lib/auth/deployAuth

## Type Aliases

### DeployAuthContext

> **DeployAuthContext** = \{ `address`: `Address`; `type`: `"session"`; \} \| \{ `address`: `Address`; `agentId`: `number`; `agentRegistry`: `string`; `chainId`: `number`; `type`: `"siwa"`; \}

Defined in: [server/\_lib/auth/deployAuth.ts:8](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/auth/deployAuth.ts#L8)

## Functions

### readDeployAuthFromRequest()

> **readDeployAuthFromRequest**(`req`): [`DeployAuthContext`](#deployauthcontext) \| `null`

Defined in: [server/\_lib/auth/deployAuth.ts:25](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/auth/deployAuth.ts#L25)

#### Parameters

##### req

`VercelRequest`

#### Returns

[`DeployAuthContext`](#deployauthcontext) \| `null`
