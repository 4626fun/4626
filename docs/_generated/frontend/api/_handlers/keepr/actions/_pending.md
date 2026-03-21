[**4626-app**](../../../../index.md)

***

[4626-app](../../../../index.md) / api/\_handlers/keepr/actions/\_pending

# api/\_handlers/keepr/actions/\_pending

## Functions

### default()

> **default**(`req`, `res`): `Promise`\<`any`\>

Defined in: [api/\_handlers/keepr/actions/\_pending.ts:36](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/keepr/actions/_pending.ts#L36)

GET /api/keepr/actions/pending

Returns pending/retry actions from the keepr_actions queue.
Protected by a shared secret (KEEPR_API_KEY).

Query params:
  - limit: max actions to return (default 10, max 50)

#### Parameters

##### req

`any`

##### res

`any`

#### Returns

`Promise`\<`any`\>
