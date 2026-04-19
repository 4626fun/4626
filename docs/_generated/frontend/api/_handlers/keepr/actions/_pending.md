[**4626-app**](../../../../index.md)

***

[4626-app](../../../../index.md) / api/\_handlers/keepr/actions/\_pending

# api/\_handlers/keepr/actions/\_pending

## Functions

### default()

> **default**(`req`, `res`): `Promise`\<`VercelResponse` \| `undefined`\>

Defined in: [api/\_handlers/keepr/actions/\_pending.ts:53](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/api/_handlers/keepr/actions/_pending.ts#L53)

GET /api/keepr/actions/pending

Returns pending/retry actions from the keepr_actions queue.
Protected by a shared secret (KEEPR_API_KEY).

Query params:
  - limit: max actions to return (default 10, max 50)

#### Parameters

##### req

`VercelRequest`

##### res

`VercelResponse`

#### Returns

`Promise`\<`VercelResponse` \| `undefined`\>
