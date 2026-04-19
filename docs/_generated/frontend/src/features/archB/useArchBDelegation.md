[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/features/archB/useArchBDelegation

# src/features/archB/useArchBDelegation

## Type Aliases

### ArchBActionResult

> **ArchBActionResult** = \{ `ok`: `true`; \} \| \{ `error`: [`ArchBDelegationError`](#archbdelegationerror); `ok`: `false`; \}

Defined in: [src/features/archB/useArchBDelegation.ts:66](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/features/archB/useArchBDelegation.ts#L66)

Result shape returned by enable()/disable(). Callers should inspect
`ok` before claiming success to the user — the hook never throws for
backend/network failures; it surfaces them via state and this result.

***

### ArchBDelegationCaps

> **ArchBDelegationCaps** = `object`

Defined in: [src/features/archB/useArchBDelegation.ts:49](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/features/archB/useArchBDelegation.ts#L49)

#### Properties

##### dailyCapWei

> **dailyCapWei**: `string`

Defined in: [src/features/archB/useArchBDelegation.ts:52](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/features/archB/useArchBDelegation.ts#L52)

##### perTxCapWei

> **perTxCapWei**: `string`

Defined in: [src/features/archB/useArchBDelegation.ts:51](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/features/archB/useArchBDelegation.ts#L51)

Wei, as string to preserve precision.

***

### ArchBDelegationError

> **ArchBDelegationError** = `object`

Defined in: [src/features/archB/useArchBDelegation.ts:55](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/features/archB/useArchBDelegation.ts#L55)

#### Properties

##### code

> **code**: `string`

Defined in: [src/features/archB/useArchBDelegation.ts:57](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/features/archB/useArchBDelegation.ts#L57)

Machine-readable code from backend or Privy.

##### message

> **message**: `string`

Defined in: [src/features/archB/useArchBDelegation.ts:58](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/features/archB/useArchBDelegation.ts#L58)

***

### ArchBDelegationStatus

> **ArchBDelegationStatus** = `"loading"` \| `"unlinked"` \| `"not_delegated"` \| `"delegating"` \| `"delegated"` \| `"provisioned"` \| `"revoked"` \| `"error"`

Defined in: [src/features/archB/useArchBDelegation.ts:39](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/features/archB/useArchBDelegation.ts#L39)

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

Defined in: [src/features/archB/useArchBDelegation.ts:70](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/features/archB/useArchBDelegation.ts#L70)

#### Properties

##### caps

> **caps**: [`ArchBDelegationCaps`](#archbdelegationcaps) \| `null`

Defined in: [src/features/archB/useArchBDelegation.ts:72](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/features/archB/useArchBDelegation.ts#L72)

##### disable()

> **disable**: () => `Promise`\<[`ArchBActionResult`](#archbactionresult)\>

Defined in: [src/features/archB/useArchBDelegation.ts:77](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/features/archB/useArchBDelegation.ts#L77)

Backend revoke + Privy wallet revoke. No-op if not provisioned.

###### Returns

`Promise`\<[`ArchBActionResult`](#archbactionresult)\>

##### enable()

> **enable**: () => `Promise`\<[`ArchBActionResult`](#archbactionresult)\>

Defined in: [src/features/archB/useArchBDelegation.ts:75](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/features/archB/useArchBDelegation.ts#L75)

Trigger delegation consent + backend enroll. No-op if not ready.

###### Returns

`Promise`\<[`ArchBActionResult`](#archbactionresult)\>

##### error

> **error**: [`ArchBDelegationError`](#archbdelegationerror) \| `null`

Defined in: [src/features/archB/useArchBDelegation.ts:73](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/features/archB/useArchBDelegation.ts#L73)

##### refresh()

> **refresh**: () => `void`

Defined in: [src/features/archB/useArchBDelegation.ts:79](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/features/archB/useArchBDelegation.ts#L79)

Manually refresh status (e.g. after returning from external browser).

###### Returns

`void`

##### status

> **status**: [`ArchBDelegationStatus`](#archbdelegationstatus)

Defined in: [src/features/archB/useArchBDelegation.ts:71](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/features/archB/useArchBDelegation.ts#L71)

## Functions

### useArchBDelegation()

> **useArchBDelegation**(): [`UseArchBDelegationReturn`](#usearchbdelegationreturn)

Defined in: [src/features/archB/useArchBDelegation.ts:151](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/features/archB/useArchBDelegation.ts#L151)

#### Returns

[`UseArchBDelegationReturn`](#usearchbdelegationreturn)
