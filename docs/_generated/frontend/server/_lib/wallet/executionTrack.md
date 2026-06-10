[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/wallet/executionTrack

# server/\_lib/wallet/executionTrack

## Type Aliases

### BaseSubAccountInput

> **BaseSubAccountInput** = `object`

Defined in: [server/\_lib/wallet/executionTrack.ts:54](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/executionTrack.ts#L54)

#### Properties

##### baseSubAccountAddress

> **baseSubAccountAddress**: `string` \| `null` \| `undefined`

Defined in: [server/\_lib/wallet/executionTrack.ts:56](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/executionTrack.ts#L56)

##### canonicalCswAddress

> **canonicalCswAddress**: `string` \| `null` \| `undefined`

Defined in: [server/\_lib/wallet/executionTrack.ts:55](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/executionTrack.ts#L55)

***

### BaseSubAccountSummary

> **BaseSubAccountSummary** = `object`

Defined in: [server/\_lib/wallet/executionTrack.ts:37](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/executionTrack.ts#L37)

#### Properties

##### address

> **address**: `string` \| `null`

Defined in: [server/\_lib/wallet/executionTrack.ts:39](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/executionTrack.ts#L39)

Lowercased 0x address if one is persisted, null otherwise.

##### isDistinctFromCsw

> **isDistinctFromCsw**: `boolean`

Defined in: [server/\_lib/wallet/executionTrack.ts:44](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/executionTrack.ts#L44)

True iff `address` is non-null AND differs from the parent CSW address.
False when the column is unset or mirrors the CSW (legacy backfill).

##### registered

> **registered**: `boolean`

Defined in: [server/\_lib/wallet/executionTrack.ts:51](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/executionTrack.ts#L51)

True iff this looks like an actual sub-account we can route user
transactions through. Currently an alias for `isDistinctFromCsw`, but
kept as a separate field so we can evolve the definition (for example
if we add a `base_sub_account_registered_at` column in the future).

***

### ExecutionTrack

> **ExecutionTrack** = `"sub-account"` \| `"legacy-owner-install"` \| `"none-yet"` \| `"migration-pending"`

Defined in: [server/\_lib/wallet/executionTrack.ts:31](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/executionTrack.ts#L31)

***

### ExecutionTrackInput

> **ExecutionTrackInput** = [`BaseSubAccountInput`](#basesubaccountinput) & `object`

Defined in: [server/\_lib/wallet/executionTrack.ts:59](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/executionTrack.ts#L59)

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

Defined in: [server/\_lib/wallet/executionTrack.ts:89](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/executionTrack.ts#L89)

#### Parameters

##### input

[`ExecutionTrackInput`](#executiontrackinput)

#### Returns

[`ExecutionTrack`](#executiontrack)

***

### summarizeBaseSubAccount()

> **summarizeBaseSubAccount**(`input`): [`BaseSubAccountSummary`](#basesubaccountsummary)

Defined in: [server/\_lib/wallet/executionTrack.ts:75](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/executionTrack.ts#L75)

#### Parameters

##### input

[`BaseSubAccountInput`](#basesubaccountinput)

#### Returns

[`BaseSubAccountSummary`](#basesubaccountsummary)

## References

### isWaitlistSubaccountFlowEnabled

Re-exports [isWaitlistSubaccountFlowEnabled](waitlistSubaccountFlowEnv.md#iswaitlistsubaccountflowenabled)
