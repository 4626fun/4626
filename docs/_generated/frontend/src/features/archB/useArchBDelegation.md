[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/features/archB/useArchBDelegation

# src/features/archB/useArchBDelegation

## Type Aliases

### ArchBActionResult

> **ArchBActionResult** = \{ `ok`: `true`; \} \| \{ `error`: [`ArchBDelegationError`](#archbdelegationerror); `ok`: `false`; \}

Defined in: [src/features/archB/useArchBDelegation.ts:94](https://github.com/wenakita/4626/blob/main/frontend/src/features/archB/useArchBDelegation.ts#L94)

Result shape returned by enable()/disable(). Callers should inspect
`ok` before claiming success to the user — the hook never throws for
backend/network failures; it surfaces them via state and this result.

***

### ArchBDelegationCaps

> **ArchBDelegationCaps** = `object`

Defined in: [src/features/archB/useArchBDelegation.ts:49](https://github.com/wenakita/4626/blob/main/frontend/src/features/archB/useArchBDelegation.ts#L49)

#### Properties

##### dailyCapWei

> **dailyCapWei**: `string`

Defined in: [src/features/archB/useArchBDelegation.ts:52](https://github.com/wenakita/4626/blob/main/frontend/src/features/archB/useArchBDelegation.ts#L52)

##### perTxCapWei

> **perTxCapWei**: `string`

Defined in: [src/features/archB/useArchBDelegation.ts:51](https://github.com/wenakita/4626/blob/main/frontend/src/features/archB/useArchBDelegation.ts#L51)

Wei, as string to preserve precision.

***

### ArchBDelegationError

> **ArchBDelegationError** = `object`

Defined in: [src/features/archB/useArchBDelegation.ts:83](https://github.com/wenakita/4626/blob/main/frontend/src/features/archB/useArchBDelegation.ts#L83)

#### Properties

##### code

> **code**: `string`

Defined in: [src/features/archB/useArchBDelegation.ts:85](https://github.com/wenakita/4626/blob/main/frontend/src/features/archB/useArchBDelegation.ts#L85)

Machine-readable code from backend or Privy.

##### message

> **message**: `string`

Defined in: [src/features/archB/useArchBDelegation.ts:86](https://github.com/wenakita/4626/blob/main/frontend/src/features/archB/useArchBDelegation.ts#L86)

***

### ArchBDelegationStatus

> **ArchBDelegationStatus** = `"loading"` \| `"unlinked"` \| `"not_delegated"` \| `"delegating"` \| `"delegated"` \| `"provisioned"` \| `"revoked"` \| `"error"`

Defined in: [src/features/archB/useArchBDelegation.ts:39](https://github.com/wenakita/4626/blob/main/frontend/src/features/archB/useArchBDelegation.ts#L39)

Maps one-to-one with backend `GET /api/arch-b/status` outcomes plus
client-side transient states.

- `loading`        initial fetch or refetch in progress
- `unlinked`       no authenticated session / no profile
- `not_delegated`  authenticated but not yet provisioned (includes post-revoke)
- `delegating`     `delegateWallet()` call in flight (waiting for Privy modal)
- `delegated`      delegation confirmed on Privy, `enroll` POST in flight
- `provisioned`    execution context row written; backend can sign UserOps
- `revoked`        previously provisioned; user or admin revoked
- `error`          non-retryable error surfaced from Privy or backend

***

### UseArchBDelegationReturn

> **UseArchBDelegationReturn** = `object`

Defined in: [src/features/archB/useArchBDelegation.ts:98](https://github.com/wenakita/4626/blob/main/frontend/src/features/archB/useArchBDelegation.ts#L98)

#### Properties

##### caps

> **caps**: [`ArchBDelegationCaps`](#archbdelegationcaps) \| `null`

Defined in: [src/features/archB/useArchBDelegation.ts:100](https://github.com/wenakita/4626/blob/main/frontend/src/features/archB/useArchBDelegation.ts#L100)

##### disable()

> **disable**: () => `Promise`\<[`ArchBActionResult`](#archbactionresult)\>

Defined in: [src/features/archB/useArchBDelegation.ts:112](https://github.com/wenakita/4626/blob/main/frontend/src/features/archB/useArchBDelegation.ts#L112)

Backend revoke + Privy wallet revoke. No-op if not provisioned.

###### Returns

`Promise`\<[`ArchBActionResult`](#archbactionresult)\>

##### enable()

> **enable**: () => `Promise`\<[`ArchBActionResult`](#archbactionresult)\>

Defined in: [src/features/archB/useArchBDelegation.ts:103](https://github.com/wenakita/4626/blob/main/frontend/src/features/archB/useArchBDelegation.ts#L103)

Trigger delegation consent + backend enroll. No-op if not ready.

###### Returns

`Promise`\<[`ArchBActionResult`](#archbactionresult)\>

##### ensureDelegation()

> **ensureDelegation**: () => `Promise`\<[`ArchBActionResult`](#archbactionresult)\>

Defined in: [src/features/archB/useArchBDelegation.ts:110](https://github.com/wenakita/4626/blob/main/frontend/src/features/archB/useArchBDelegation.ts#L110)

Ensure the Privy embedded EOA has delegated to the Arch B quorum.
Skips the Privy modal when `/api/arch-b/status` already reports
`delegated: true`. Does not call `/api/arch-b/enroll` — sub-account
provisioning writes its own execution-context row.

###### Returns

`Promise`\<[`ArchBActionResult`](#archbactionresult)\>

##### error

> **error**: [`ArchBDelegationError`](#archbdelegationerror) \| `null`

Defined in: [src/features/archB/useArchBDelegation.ts:101](https://github.com/wenakita/4626/blob/main/frontend/src/features/archB/useArchBDelegation.ts#L101)

##### refresh()

> **refresh**: () => `void`

Defined in: [src/features/archB/useArchBDelegation.ts:114](https://github.com/wenakita/4626/blob/main/frontend/src/features/archB/useArchBDelegation.ts#L114)

Manually refresh status (e.g. after returning from external browser).

###### Returns

`void`

##### status

> **status**: [`ArchBDelegationStatus`](#archbdelegationstatus)

Defined in: [src/features/archB/useArchBDelegation.ts:99](https://github.com/wenakita/4626/blob/main/frontend/src/features/archB/useArchBDelegation.ts#L99)

## Variables

### ARCH\_B\_EXPECTED\_CAPS

> `const` **ARCH\_B\_EXPECTED\_CAPS**: [`ArchBDelegationCaps`](#archbdelegationcaps)

Defined in: [src/features/archB/useArchBDelegation.ts:67](https://github.com/wenakita/4626/blob/main/frontend/src/features/archB/useArchBDelegation.ts#L67)

Canonical client-side expected caps for the Arch-B delegation.

These values mirror the on-chain policy that the delegation contract
enforces. They are the source of truth shown to the user BEFORE any
backend round-trip, so a backend compromise or API MITM cannot present
artificially low caps to lull the user into consent (L-18).

Keep in sync with the on-chain policy in the Arch-B session key
contract. The backend `GET /api/arch-b/status` response is compared
against these values and flagged as a mismatch if it deviates.

## Functions

### archBCapsMatchExpected()

> **archBCapsMatchExpected**(`caps`): `boolean`

Defined in: [src/features/archB/useArchBDelegation.ts:75](https://github.com/wenakita/4626/blob/main/frontend/src/features/archB/useArchBDelegation.ts#L75)

True when the backend-returned caps match the expected on-chain policy.

#### Parameters

##### caps

[`ArchBDelegationCaps`](#archbdelegationcaps) | `null`

#### Returns

`boolean`

***

### useArchBDelegation()

> **useArchBDelegation**(): [`UseArchBDelegationReturn`](#usearchbdelegationreturn)

Defined in: [src/features/archB/useArchBDelegation.ts:186](https://github.com/wenakita/4626/blob/main/frontend/src/features/archB/useArchBDelegation.ts#L186)

#### Returns

[`UseArchBDelegationReturn`](#usearchbdelegationreturn)
