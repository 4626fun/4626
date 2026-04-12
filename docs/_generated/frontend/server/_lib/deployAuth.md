[**4626-app**](../../index.md)

***

[4626-app](../../index.md) / server/\_lib/deployAuth

# server/\_lib/deployAuth

## Type Aliases

### DeployAuthContext

> **DeployAuthContext** = \{ `address`: `Address`; `type`: `"session"`; \} \| \{ `address`: `Address`; `agentId`: `number`; `agentRegistry`: `string`; `chainId`: `number`; `type`: `"siwa"`; \}

Defined in: [server/\_lib/deployAuth.ts:8](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/deployAuth.ts#L8)

## Functions

### readDeployAuthFromRequest()

> **readDeployAuthFromRequest**(`req`): [`DeployAuthContext`](#deployauthcontext) \| `null`

Defined in: [server/\_lib/deployAuth.ts:25](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/deployAuth.ts#L25)

#### Parameters

##### req

`VercelRequest`

#### Returns

[`DeployAuthContext`](#deployauthcontext) \| `null`
