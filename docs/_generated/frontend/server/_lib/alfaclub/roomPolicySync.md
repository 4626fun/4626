[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/alfaclub/roomPolicySync

# server/\_lib/alfaclub/roomPolicySync

## Type Aliases

### SyncCreatorRoomPoliciesResult

> **SyncCreatorRoomPoliciesResult** = `object`

Defined in: [server/\_lib/alfaclub/roomPolicySync.ts:11](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/roomPolicySync.ts#L11)

#### Properties

##### candidateCount

> **candidateCount**: `number`

Defined in: [server/\_lib/alfaclub/roomPolicySync.ts:13](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/roomPolicySync.ts#L13)

##### ok

> **ok**: `boolean`

Defined in: [server/\_lib/alfaclub/roomPolicySync.ts:12](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/roomPolicySync.ts#L12)

##### skipped?

> `optional` **skipped**: `string`

Defined in: [server/\_lib/alfaclub/roomPolicySync.ts:15](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/roomPolicySync.ts#L15)

##### upserted

> **upserted**: `number`

Defined in: [server/\_lib/alfaclub/roomPolicySync.ts:14](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/roomPolicySync.ts#L14)

## Functions

### readAutoSyncRoomPoliciesEnabled()

> **readAutoSyncRoomPoliciesEnabled**(): `boolean`

Defined in: [server/\_lib/alfaclub/roomPolicySync.ts:24](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/roomPolicySync.ts#L24)

#### Returns

`boolean`

***

### syncCreatorRoomPoliciesFromSnapshot()

> **syncCreatorRoomPoliciesFromSnapshot**(`params?`): `Promise`\<[`SyncCreatorRoomPoliciesResult`](#synccreatorroompoliciesresult)\>

Defined in: [server/\_lib/alfaclub/roomPolicySync.ts:32](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/roomPolicySync.ts#L32)

Upsert alfaclub.room_access_policies from snapshot + creators (enabled=false).
Prefer room_id when it matches FriendKey token_id, else highest volume row.

#### Parameters

##### params?

###### dryRun?

`boolean`

When true, count candidates only — no DB writes.

###### limit?

`number`

###### poolAddress?

`` `0x${string}` ``

#### Returns

`Promise`\<[`SyncCreatorRoomPoliciesResult`](#synccreatorroompoliciesresult)\>
