[**4626-app**](../../../../index.md)

***

[4626-app](../../../../index.md) / api/\_handlers/keepr/actions/\_updateStatus

# api/\_handlers/keepr/actions/\_updateStatus

## Functions

### default()

> **default**(`req`, `res`): `Promise`\<`VercelResponse` \| `undefined`\>

Defined in: [api/\_handlers/keepr/actions/\_updateStatus.ts:99](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/keepr/actions/_updateStatus.ts#L99)

POST /api/keepr/actions/updateStatus

Updates the status of a keepr_actions row.
Protected by a shared secret (KEEPR_API_KEY).

Body:
  - id: action ID
  - status: new status ('executing' | 'executed' | 'failed' | 'retry')
  - error: optional error message (for 'failed' or 'retry')
  - retryDelaySeconds: optional delay before next retry (default 60)

#### Parameters

##### req

`VercelRequest`

##### res

`VercelResponse`

#### Returns

`Promise`\<`VercelResponse` \| `undefined`\>
