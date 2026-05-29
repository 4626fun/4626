[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/zora-profiles/reconcileCswIndexFlag

# server/\_lib/zora-profiles/reconcileCswIndexFlag

## Type Aliases

### ReconcileCswIndexResult

> **ReconcileCswIndexResult** = `object`

Defined in: [server/\_lib/zora-profiles/reconcileCswIndexFlag.ts:7](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora-profiles/reconcileCswIndexFlag.ts#L7)

#### Properties

##### rowsUpdated

> **rowsUpdated**: `number`

Defined in: [server/\_lib/zora-profiles/reconcileCswIndexFlag.ts:8](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora-profiles/reconcileCswIndexFlag.ts#L8)

## Functions

### reconcileZoraProfilesCswIndexFlag()

> **reconcileZoraProfilesCswIndexFlag**(): `Promise`\<[`ReconcileCswIndexResult`](#reconcilecswindexresult)\>

Defined in: [server/\_lib/zora-profiles/reconcileCswIndexFlag.ts:14](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora-profiles/reconcileCswIndexFlag.ts#L14)

Best-effort reconciliation. Requires postgres `getDb()` (not Supabase REST).

#### Returns

`Promise`\<[`ReconcileCswIndexResult`](#reconcilecswindexresult)\>
