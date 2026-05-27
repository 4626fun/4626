[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/wallet/spendPermissionPeriodRead

# server/\_lib/wallet/spendPermissionPeriodRead

## Type Aliases

### SpendPermissionCurrentPeriod

> **SpendPermissionCurrentPeriod** = `object`

Defined in: [server/\_lib/wallet/spendPermissionPeriodRead.ts:29](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/spendPermissionPeriodRead.ts#L29)

#### Properties

##### end

> **end**: `number`

Defined in: [server/\_lib/wallet/spendPermissionPeriodRead.ts:33](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/spendPermissionPeriodRead.ts#L33)

Unix seconds (uint48 from chain).

##### remainingWei

> **remainingWei**: `string`

Defined in: [server/\_lib/wallet/spendPermissionPeriodRead.ts:37](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/spendPermissionPeriodRead.ts#L37)

Wei remaining in the current period (allowance − spend), stringified.

##### spendWei

> **spendWei**: `string`

Defined in: [server/\_lib/wallet/spendPermissionPeriodRead.ts:35](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/spendPermissionPeriodRead.ts#L35)

Wei spent in the current period so far, stringified bigint.

##### start

> **start**: `number`

Defined in: [server/\_lib/wallet/spendPermissionPeriodRead.ts:31](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/spendPermissionPeriodRead.ts#L31)

Unix seconds (uint48 from chain).

## Functions

### readSpendPermissionCurrentPeriod()

> **readSpendPermissionCurrentPeriod**(`client`, `payload`): `Promise`\<[`SpendPermissionCurrentPeriod`](#spendpermissioncurrentperiod) \| `null`\>

Defined in: [server/\_lib/wallet/spendPermissionPeriodRead.ts:78](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/spendPermissionPeriodRead.ts#L78)

Read `SpendPermissionManager.getCurrentPeriodSpend(permission)` on
Base and return the normalized shape the UI needs.

Returns `null` when the underlying RPC fails — the status endpoint
treats that as "usage unavailable" rather than surfacing a 5xx to
users just because an RPC blipped.

#### Parameters

##### client

`ViemReadClient`

##### payload

[`SpendPermissionPayload`](commandIssuerContext.md#spendpermissionpayload)

#### Returns

`Promise`\<[`SpendPermissionCurrentPeriod`](#spendpermissioncurrentperiod) \| `null`\>
