[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/features/executionScope/useAutoProvisionSubAccount

# src/features/executionScope/useAutoProvisionSubAccount

## Type Aliases

### AutoProvisionStatus

> **AutoProvisionStatus** = `"inert"` \| `"ineligible"` \| `"already_provisioned"` \| `"triggering"` \| `"succeeded"` \| `"failed"`

Defined in: [src/features/executionScope/useAutoProvisionSubAccount.ts:63](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/executionScope/useAutoProvisionSubAccount.ts#L63)

Public status surface. UI can inspect this to show "auto-provisioning…"
copy while the signature modal is being assembled, but the primary
side effect is the automatic call into `reprovision()`.

## Functions

### useAutoProvisionSubAccount()

> **useAutoProvisionSubAccount**(): `object`

Defined in: [src/features/executionScope/useAutoProvisionSubAccount.ts:71](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/executionScope/useAutoProvisionSubAccount.ts#L71)

#### Returns

`object`

##### reason

> **reason**: `string` \| `null`

##### status

> **status**: [`AutoProvisionStatus`](#autoprovisionstatus)
