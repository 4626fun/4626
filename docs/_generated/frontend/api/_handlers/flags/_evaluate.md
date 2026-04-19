[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / api/\_handlers/flags/\_evaluate

# api/\_handlers/flags/\_evaluate

## Functions

### default()

> **default**(`req`, `res`): `Promise`\<`VercelResponse` \| `undefined`\>

Defined in: [api/\_handlers/flags/\_evaluate.ts:30](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/api/_handlers/flags/_evaluate.ts#L30)

GET /api/flags/evaluate

Evaluates Vercel-managed flags server-side using @vercel/flags-core,
returning resolved values for `ui` category flags only.

Requires the FLAGS environment variable (Vercel SDK key) to be set.
When FLAGS is absent, returns an empty object so the client falls
back to local env-based defaults.

#### Parameters

##### req

`VercelRequest`

##### res

`VercelResponse`

#### Returns

`Promise`\<`VercelResponse` \| `undefined`\>
