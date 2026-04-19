[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / api/\_handlers/flags/\_evaluate

# api/\_handlers/flags/\_evaluate

## Functions

### default()

> **default**(`req`, `res`): `Promise`\<`VercelResponse` \| `undefined`\>

Defined in: [api/\_handlers/flags/\_evaluate.ts:30](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/api/_handlers/flags/_evaluate.ts#L30)

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
