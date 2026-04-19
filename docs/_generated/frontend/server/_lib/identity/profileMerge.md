[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / server/\_lib/identity/profileMerge

# server/\_lib/identity/profileMerge

## Classes

### ProfileMergeValidationError

Defined in: [server/\_lib/identity/profileMerge.ts:159](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/identity/profileMerge.ts#L159)

#### Extends

- `Error`

#### Constructors

##### Constructor

> **new ProfileMergeValidationError**(`code`, `detail`): [`ProfileMergeValidationError`](#profilemergevalidationerror)

Defined in: [server/\_lib/identity/profileMerge.ts:160](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/identity/profileMerge.ts#L160)

###### Parameters

###### code

`string`

###### detail

`string`

###### Returns

[`ProfileMergeValidationError`](#profilemergevalidationerror)

###### Overrides

`Error.constructor`

#### Properties

##### code

> `readonly` **code**: `string`

Defined in: [server/\_lib/identity/profileMerge.ts:160](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/identity/profileMerge.ts#L160)

## Type Aliases

### ProfileMergePlan

> **ProfileMergePlan** = `object`

Defined in: [server/\_lib/identity/profileMerge.ts:99](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/identity/profileMerge.ts#L99)

#### Properties

##### from

> **from**: [`ProfileRow`](#profilerow)

Defined in: [server/\_lib/identity/profileMerge.ts:100](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/identity/profileMerge.ts#L100)

##### pointsRowsSkippedAsDuplicate

> **pointsRowsSkippedAsDuplicate**: `number`

Defined in: [server/\_lib/identity/profileMerge.ts:106](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/identity/profileMerge.ts#L106)

Matching rows that already exist on `to` and would be dropped from
 `from` (no-op writes, safe to delete).

##### pointsRowsToMove

> **pointsRowsToMove**: `number`

Defined in: [server/\_lib/identity/profileMerge.ts:103](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/identity/profileMerge.ts#L103)

Rows in `points` that would be re-keyed from `from` → `to`.

##### refereesToRepoint

> **refereesToRepoint**: `number`

Defined in: [server/\_lib/identity/profileMerge.ts:110](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/identity/profileMerge.ts#L110)

Other profiles whose `referred_by_signup_id` points at `from`.

##### referralConversionsToRepoint

> **referralConversionsToRepoint**: `number`

Defined in: [server/\_lib/identity/profileMerge.ts:108](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/identity/profileMerge.ts#L108)

`referral_conversions` rows that reference `from` in either position.

##### to

> **to**: [`ProfileRow`](#profilerow)

Defined in: [server/\_lib/identity/profileMerge.ts:101](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/identity/profileMerge.ts#L101)

***

### ProfileMergeResult

> **ProfileMergeResult** = `object`

Defined in: [server/\_lib/identity/profileMerge.ts:113](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/identity/profileMerge.ts#L113)

#### Properties

##### aliasInserted

> **aliasInserted**: `boolean`

Defined in: [server/\_lib/identity/profileMerge.ts:114](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/identity/profileMerge.ts#L114)

##### cswPropagated

> **cswPropagated**: `boolean`

Defined in: [server/\_lib/identity/profileMerge.ts:121](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/identity/profileMerge.ts#L121)

##### fromTombstoned

> **fromTombstoned**: `boolean`

Defined in: [server/\_lib/identity/profileMerge.ts:122](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/identity/profileMerge.ts#L122)

##### pointsDroppedAsDuplicate

> **pointsDroppedAsDuplicate**: `number`

Defined in: [server/\_lib/identity/profileMerge.ts:117](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/identity/profileMerge.ts#L117)

##### pointsMoved

> **pointsMoved**: `number`

Defined in: [server/\_lib/identity/profileMerge.ts:116](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/identity/profileMerge.ts#L116)

##### refereesRepointed

> **refereesRepointed**: `number`

Defined in: [server/\_lib/identity/profileMerge.ts:119](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/identity/profileMerge.ts#L119)

##### referralCodeCopied

> **referralCodeCopied**: `boolean`

Defined in: [server/\_lib/identity/profileMerge.ts:120](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/identity/profileMerge.ts#L120)

##### referralConversionsRepointed

> **referralConversionsRepointed**: `number`

Defined in: [server/\_lib/identity/profileMerge.ts:118](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/identity/profileMerge.ts#L118)

##### walletsLinked

> **walletsLinked**: `number`

Defined in: [server/\_lib/identity/profileMerge.ts:115](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/identity/profileMerge.ts#L115)

***

### ProfileRow

> **ProfileRow** = `object`

Defined in: [server/\_lib/identity/profileMerge.ts:88](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/identity/profileMerge.ts#L88)

#### Properties

##### cswAddress

> **cswAddress**: `string` \| `null`

Defined in: [server/\_lib/identity/profileMerge.ts:94](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/identity/profileMerge.ts#L94)

##### email

> **email**: `string` \| `null`

Defined in: [server/\_lib/identity/profileMerge.ts:90](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/identity/profileMerge.ts#L90)

##### embeddedWallet

> **embeddedWallet**: `string` \| `null`

Defined in: [server/\_lib/identity/profileMerge.ts:93](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/identity/profileMerge.ts#L93)

##### id

> **id**: `number`

Defined in: [server/\_lib/identity/profileMerge.ts:89](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/identity/profileMerge.ts#L89)

##### mergedIntoProfileId

> **mergedIntoProfileId**: `number` \| `null`

Defined in: [server/\_lib/identity/profileMerge.ts:96](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/identity/profileMerge.ts#L96)

##### primaryWallet

> **primaryWallet**: `string` \| `null`

Defined in: [server/\_lib/identity/profileMerge.ts:92](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/identity/profileMerge.ts#L92)

##### privyUserId

> **privyUserId**: `string` \| `null`

Defined in: [server/\_lib/identity/profileMerge.ts:91](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/identity/profileMerge.ts#L91)

##### referralCode

> **referralCode**: `string` \| `null`

Defined in: [server/\_lib/identity/profileMerge.ts:95](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/identity/profileMerge.ts#L95)

## Functions

### ensureProfileMergeSchema()

> **ensureProfileMergeSchema**(`db`): `Promise`\<`void`\>

Defined in: [server/\_lib/identity/profileMerge.ts:45](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/identity/profileMerge.ts#L45)

Idempotent schema bootstrap. Matches the pattern used by
 `ensureWaitlistSchema` / `ensureAccountsIdentitySchema` elsewhere in this
 module family — the migration file at
 `supabase/migrations/20260419200000_profile_merge_infra.sql` is the
 source of truth; this helper exists so cold starts (and the CLI) can
 run without a separate migration step.

#### Parameters

##### db

`Db`

#### Returns

`Promise`\<`void`\>

***

### executeProfileMerge()

> **executeProfileMerge**(`db`, `plan`): `Promise`\<[`ProfileMergeResult`](#profilemergeresult)\>

Defined in: [server/\_lib/identity/profileMerge.ts:243](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/identity/profileMerge.ts#L243)

#### Parameters

##### db

`Db`

##### plan

[`ProfileMergePlan`](#profilemergeplan)

#### Returns

`Promise`\<[`ProfileMergeResult`](#profilemergeresult)\>

***

### planProfileMerge()

> **planProfileMerge**(`db`, `fromProfileId`, `toProfileId`): `Promise`\<[`ProfileMergePlan`](#profilemergeplan)\>

Defined in: [server/\_lib/identity/profileMerge.ts:187](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/identity/profileMerge.ts#L187)

#### Parameters

##### db

`Db`

##### fromProfileId

`number`

##### toProfileId

`number`

#### Returns

`Promise`\<[`ProfileMergePlan`](#profilemergeplan)\>
