[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/features/executionScope/useExecutionScope

# src/features/executionScope/useExecutionScope

## Type Aliases

### ExecutionScopeData

> **ExecutionScopeData** = `object`

Defined in: [src/features/executionScope/useExecutionScope.ts:28](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/executionScope/useExecutionScope.ts#L28)

#### Properties

##### caps

> **caps**: \{ `dailyCapWei`: `string`; `perTxCapWei`: `string`; \} \| `null`

Defined in: [src/features/executionScope/useExecutionScope.ts:32](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/executionScope/useExecutionScope.ts#L32)

##### delegated

> **delegated**: `boolean` \| `null`

Defined in: [src/features/executionScope/useExecutionScope.ts:30](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/executionScope/useExecutionScope.ts#L30)

##### executionReady

> **executionReady**: `"ready"` \| `"revoked"` \| `"not_provisioned"`

Defined in: [src/features/executionScope/useExecutionScope.ts:31](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/executionScope/useExecutionScope.ts#L31)

##### profileId

> **profileId**: `number`

Defined in: [src/features/executionScope/useExecutionScope.ts:29](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/executionScope/useExecutionScope.ts#L29)

##### quorumId

> **quorumId**: `string`

Defined in: [src/features/executionScope/useExecutionScope.ts:34](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/executionScope/useExecutionScope.ts#L34)

##### revokedAt

> **revokedAt**: `string` \| `null`

Defined in: [src/features/executionScope/useExecutionScope.ts:33](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/executionScope/useExecutionScope.ts#L33)

##### subAccount

> **subAccount**: \{ `address`: `` `0x${string}` ``; `parentCsw`: `` `0x${string}` ``; `spendPermission`: [`ExecutionScopeSpendPermission`](#executionscopespendpermission); \} \| `null`

Defined in: [src/features/executionScope/useExecutionScope.ts:35](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/executionScope/useExecutionScope.ts#L35)

***

### ExecutionScopeSpendPermission

> **ExecutionScopeSpendPermission** = `object`

Defined in: [src/features/executionScope/useExecutionScope.ts:15](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/executionScope/useExecutionScope.ts#L15)

Client-side hook over the extended `GET /api/arch-b/status` endpoint.
Powers the `/accounts` "Execution scopes" card (read-only surface for
the Arch B sub-account — address, spend caps, current-period usage,
and revocation state).

Fetches on mount and on window focus. No polling intervals — matches
the 4626 product-frontend invariant.

#### Properties

##### allowanceWei

> **allowanceWei**: `string`

Defined in: [src/features/executionScope/useExecutionScope.ts:16](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/executionScope/useExecutionScope.ts#L16)

##### currentPeriod

> **currentPeriod**: \{ `endUnix`: `number`; `remainingWei`: `string`; `spendWei`: `string`; `startUnix`: `number`; \} \| `null`

Defined in: [src/features/executionScope/useExecutionScope.ts:20](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/executionScope/useExecutionScope.ts#L20)

##### endAt

> **endAt**: `string`

Defined in: [src/features/executionScope/useExecutionScope.ts:18](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/executionScope/useExecutionScope.ts#L18)

##### periodSeconds

> **periodSeconds**: `number`

Defined in: [src/features/executionScope/useExecutionScope.ts:17](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/executionScope/useExecutionScope.ts#L17)

##### revokedAt

> **revokedAt**: `string` \| `null`

Defined in: [src/features/executionScope/useExecutionScope.ts:19](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/executionScope/useExecutionScope.ts#L19)

***

### ExecutionScopeStatus

> **ExecutionScopeStatus** = `"loading"` \| `"unauthenticated"` \| `"not_provisioned"` \| `"active"` \| `"revoked"` \| `"expired"` \| `"error"`

Defined in: [src/features/executionScope/useExecutionScope.ts:42](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/executionScope/useExecutionScope.ts#L42)

***

### UseExecutionScopeReturn

> **UseExecutionScopeReturn** = `object`

Defined in: [src/features/executionScope/useExecutionScope.ts:51](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/executionScope/useExecutionScope.ts#L51)

#### Properties

##### data

> **data**: [`ExecutionScopeData`](#executionscopedata) \| `null`

Defined in: [src/features/executionScope/useExecutionScope.ts:53](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/executionScope/useExecutionScope.ts#L53)

##### error

> **error**: `string` \| `null`

Defined in: [src/features/executionScope/useExecutionScope.ts:54](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/executionScope/useExecutionScope.ts#L54)

##### refresh()

> **refresh**: () => `void`

Defined in: [src/features/executionScope/useExecutionScope.ts:55](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/executionScope/useExecutionScope.ts#L55)

###### Returns

`void`

##### status

> **status**: [`ExecutionScopeStatus`](#executionscopestatus)

Defined in: [src/features/executionScope/useExecutionScope.ts:52](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/executionScope/useExecutionScope.ts#L52)

## Functions

### useExecutionScope()

> **useExecutionScope**(): [`UseExecutionScopeReturn`](#useexecutionscopereturn)

Defined in: [src/features/executionScope/useExecutionScope.ts:70](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/executionScope/useExecutionScope.ts#L70)

#### Returns

[`UseExecutionScopeReturn`](#useexecutionscopereturn)
