[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/workspace/normalizer

# server/\_lib/workspace/normalizer

## Functions

### normalizeKeeprActionStatusForWorkspace()

> **normalizeKeeprActionStatusForWorkspace**(`params`): `Promise`\<\{ `created`: `boolean`; `vaultAddress?`: `` `0x${string}` ``; \}\>

Defined in: [server/\_lib/workspace/normalizer.ts:26](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/normalizer.ts#L26)

#### Parameters

##### params

###### actionId

`number`

###### errorMessage?

`string` \| `null`

###### status

`"retry"` \| `"failed"` \| `"executing"` \| `"executed"`

#### Returns

`Promise`\<\{ `created`: `boolean`; `vaultAddress?`: `` `0x${string}` ``; \}\>
