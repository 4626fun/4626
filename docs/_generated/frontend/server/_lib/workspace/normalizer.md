[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / server/\_lib/workspace/normalizer

# server/\_lib/workspace/normalizer

## Functions

### normalizeKeeprActionStatusForWorkspace()

> **normalizeKeeprActionStatusForWorkspace**(`params`): `Promise`\<\{ `created`: `boolean`; `vaultAddress?`: `` `0x${string}` ``; \}\>

Defined in: [server/\_lib/workspace/normalizer.ts:221](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/workspace/normalizer.ts#L221)

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

***

### normalizeRuntimeDecisionForWorkspace()

> **normalizeRuntimeDecisionForWorkspace**(`params`): `Promise`\<\{ `approvalId?`: `number`; `created`: `boolean`; `taskId?`: `number`; `vaultAddress?`: `` `0x${string}` ``; \}\>

Defined in: [server/\_lib/workspace/normalizer.ts:124](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/workspace/normalizer.ts#L124)

#### Parameters

##### params

###### actionId?

`number`

###### decision

[`RuntimeDecision`](../cre/runtimeBridge.md#runtimedecision)

###### enqueueAction?

\{ `action?`: `Record`\<`string`, `unknown`\>; `actionType?`: `string`; `groupId?`: `string`; `vaultAddress?`: `string`; \} \| `null`

#### Returns

`Promise`\<\{ `approvalId?`: `number`; `created`: `boolean`; `taskId?`: `number`; `vaultAddress?`: `` `0x${string}` ``; \}\>

***

### normalizeRuntimeRecordForWorkspace()

> **normalizeRuntimeRecordForWorkspace**(`params`): `Promise`\<\{ `alertId?`: `number`; `created`: `boolean`; `taskId?`: `number`; `vaultAddress?`: `` `0x${string}` ``; \}\>

Defined in: [server/\_lib/workspace/normalizer.ts:48](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/workspace/normalizer.ts#L48)

#### Parameters

##### params

###### record

[`RuntimeRecord`](../cre/runtimeBridge.md#runtimerecord)

#### Returns

`Promise`\<\{ `alertId?`: `number`; `created`: `boolean`; `taskId?`: `number`; `vaultAddress?`: `` `0x${string}` ``; \}\>
