[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/lib/xmtp/xmtpUserPersonaMatrix

# src/lib/xmtp/xmtpUserPersonaMatrix

## Type Aliases

### UserPersonaKind

> **UserPersonaKind** = `"fresh_eoa_explicit_connect"` \| `"fresh_csw_explicit_connect"` \| `"returning_healthy_auto_restore"` \| `"returning_healthy_user_restore"` \| `"returning_uninitialized_in_place_register"` \| `"returning_registration_rejected"` \| `"returning_invalid_local_state"` \| `"passive_auto_first_visit"` \| `"restore_failed_with_install_evidence"` \| `"install_cap_hit"` \| `"opfs_lock_blocked"` \| `"preview_origin_blocked"` \| `"duplicate_connect_in_flight"` \| `"already_connected_noop"`

Defined in: [src/lib/xmtp/xmtpUserPersonaMatrix.ts:6](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/xmtpUserPersonaMatrix.ts#L6)

***

### UserPersonaScenario

> **UserPersonaScenario** = `object`

Defined in: [src/lib/xmtp/xmtpUserPersonaMatrix.ts:22](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/xmtpUserPersonaMatrix.ts#L22)

#### Properties

##### description

> **description**: `string`

Defined in: [src/lib/xmtp/xmtpUserPersonaMatrix.ts:25](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/xmtpUserPersonaMatrix.ts#L25)

##### expectFlowConnected?

> `optional` **expectFlowConnected**: `boolean`

Defined in: [src/lib/xmtp/xmtpUserPersonaMatrix.ts:30](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/xmtpUserPersonaMatrix.ts#L30)

Set only on fixed templates — variants rely on anti-churn invariants alone.

##### expectNoInstallChurn

> **expectNoInstallChurn**: `boolean`

Defined in: [src/lib/xmtp/xmtpUserPersonaMatrix.ts:31](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/xmtpUserPersonaMatrix.ts#L31)

##### expectPrecheckDenied

> **expectPrecheckDenied**: [`XmtpConnectPrecheckDenyReason`](xmtpConnectGuard.md#xmtpconnectprecheckdenyreason) \| `null`

Defined in: [src/lib/xmtp/xmtpUserPersonaMatrix.ts:28](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/xmtpUserPersonaMatrix.ts#L28)

##### flow

> **flow**: [`ConnectFlowInput`](xmtpConnectFlow.md#connectflowinput) \| `null`

Defined in: [src/lib/xmtp/xmtpUserPersonaMatrix.ts:27](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/xmtpUserPersonaMatrix.ts#L27)

##### id

> **id**: `number`

Defined in: [src/lib/xmtp/xmtpUserPersonaMatrix.ts:23](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/xmtpUserPersonaMatrix.ts#L23)

##### persona

> **persona**: [`UserPersonaKind`](#userpersonakind)

Defined in: [src/lib/xmtp/xmtpUserPersonaMatrix.ts:24](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/xmtpUserPersonaMatrix.ts#L24)

##### precheck

> **precheck**: [`XmtpConnectPrecheckInput`](xmtpConnectGuard.md#xmtpconnectprecheckinput)

Defined in: [src/lib/xmtp/xmtpUserPersonaMatrix.ts:26](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/xmtpUserPersonaMatrix.ts#L26)

## Variables

### PERSONA\_TEMPLATES

> `const` **PERSONA\_TEMPLATES**: `Omit`\<[`UserPersonaScenario`](#userpersonascenario), `"id"`\>[]

Defined in: [src/lib/xmtp/xmtpUserPersonaMatrix.ts:58](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/xmtpUserPersonaMatrix.ts#L58)

## Functions

### buildUserPersonaScenarioMatrix()

> **buildUserPersonaScenarioMatrix**(`count`): [`UserPersonaScenario`](#userpersonascenario)[]

Defined in: [src/lib/xmtp/xmtpUserPersonaMatrix.ts:287](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/xmtpUserPersonaMatrix.ts#L287)

Deterministic multi-user scenarios for high-volume regression (default 1000).

#### Parameters

##### count

`number` = `1000`

#### Returns

[`UserPersonaScenario`](#userpersonascenario)[]
