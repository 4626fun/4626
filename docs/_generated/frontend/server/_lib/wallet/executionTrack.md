[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / server/\_lib/wallet/executionTrack

# server/\_lib/wallet/executionTrack

## Type Aliases

### BaseSubAccountInput

> **BaseSubAccountInput** = `object`

Defined in: [server/\_lib/wallet/executionTrack.ts:65](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/wallet/executionTrack.ts#L65)

#### Properties

##### baseSubAccountAddress

> **baseSubAccountAddress**: `string` \| `null` \| `undefined`

Defined in: [server/\_lib/wallet/executionTrack.ts:67](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/wallet/executionTrack.ts#L67)

##### canonicalCswAddress

> **canonicalCswAddress**: `string` \| `null` \| `undefined`

Defined in: [server/\_lib/wallet/executionTrack.ts:66](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/wallet/executionTrack.ts#L66)

***

### BaseSubAccountSummary

> **BaseSubAccountSummary** = `object`

Defined in: [server/\_lib/wallet/executionTrack.ts:48](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/wallet/executionTrack.ts#L48)

#### Properties

##### address

> **address**: `string` \| `null`

Defined in: [server/\_lib/wallet/executionTrack.ts:50](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/wallet/executionTrack.ts#L50)

Lowercased 0x address if one is persisted, null otherwise.

##### isDistinctFromCsw

> **isDistinctFromCsw**: `boolean`

Defined in: [server/\_lib/wallet/executionTrack.ts:55](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/wallet/executionTrack.ts#L55)

True iff `address` is non-null AND differs from the parent CSW address.
False when the column is unset or mirrors the CSW (legacy backfill).

##### registered

> **registered**: `boolean`

Defined in: [server/\_lib/wallet/executionTrack.ts:62](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/wallet/executionTrack.ts#L62)

True iff this looks like an actual sub-account we can route user
transactions through. Currently an alias for `isDistinctFromCsw`, but
kept as a separate field so we can evolve the definition (for example
if we add a `base_sub_account_registered_at` column in the future).

***

### ExecutionTrack

> **ExecutionTrack** = `"sub-account"` \| `"legacy-owner-install"` \| `"none-yet"` \| `"migration-pending"`

Defined in: [server/\_lib/wallet/executionTrack.ts:42](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/wallet/executionTrack.ts#L42)

***

### ExecutionTrackInput

> **ExecutionTrackInput** = [`BaseSubAccountInput`](#basesubaccountinput) & `object`

Defined in: [server/\_lib/wallet/executionTrack.ts:70](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/wallet/executionTrack.ts#L70)

#### Type Declaration

##### privyEmbeddedEoaIsOwnerOfCanonicalCsw

> **privyEmbeddedEoaIsOwnerOfCanonicalCsw**: `boolean` \| `null` \| `undefined`

Whether the Privy embedded EOA is currently installed as a direct owner
of the parent CSW in the MultiOwnable contract. Under the new
architecture this is expected to be `false` for user-initiated frontend
execution; a `true` value signals the legacy owner-install path.

## Functions

### resolveExecutionTrack()

> **resolveExecutionTrack**(`input`): [`ExecutionTrack`](#executiontrack)

Defined in: [server/\_lib/wallet/executionTrack.ts:100](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/wallet/executionTrack.ts#L100)

#### Parameters

##### input

[`ExecutionTrackInput`](#executiontrackinput)

#### Returns

[`ExecutionTrack`](#executiontrack)

***

### summarizeBaseSubAccount()

> **summarizeBaseSubAccount**(`input`): [`BaseSubAccountSummary`](#basesubaccountsummary)

Defined in: [server/\_lib/wallet/executionTrack.ts:86](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/wallet/executionTrack.ts#L86)

#### Parameters

##### input

[`BaseSubAccountInput`](#basesubaccountinput)

#### Returns

[`BaseSubAccountSummary`](#basesubaccountsummary)
