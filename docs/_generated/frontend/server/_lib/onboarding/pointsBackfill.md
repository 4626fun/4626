[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / server/\_lib/onboarding/pointsBackfill

# server/\_lib/onboarding/pointsBackfill

## Type Aliases

### BackfillPlan

> **BackfillPlan** = `object`

Defined in: server/\_lib/onboarding/pointsBackfill.ts:116

#### Properties

##### passthroughs

> **passthroughs**: [`PassthroughCandidate`](#passthroughcandidate)[]

Defined in: server/\_lib/onboarding/pointsBackfill.ts:118

##### topups

> **topups**: [`TopupCandidate`](#topupcandidate)[]

Defined in: server/\_lib/onboarding/pointsBackfill.ts:117

##### topupsBySource

> **topupsBySource**: `Record`\<`string`, \{ `count`: `number`; `totalDelta`: `number`; \}\>

Defined in: server/\_lib/onboarding/pointsBackfill.ts:123

Per-source top-up summary for quick review.

##### unknownSourcesObserved

> **unknownSourcesObserved**: `string`[]

Defined in: server/\_lib/onboarding/pointsBackfill.ts:121

Sources observed in the `points` table that are NOT in the canonical
 map (and not explicitly excluded). Operators should review this list.

***

### BackfillResult

> **BackfillResult** = `object`

Defined in: server/\_lib/onboarding/pointsBackfill.ts:126

#### Properties

##### passthroughsInserted

> **passthroughsInserted**: `number`

Defined in: server/\_lib/onboarding/pointsBackfill.ts:128

##### passthroughsSkipped

> **passthroughsSkipped**: `number`

Defined in: server/\_lib/onboarding/pointsBackfill.ts:131

Rows the helper chose not to write (no referrer, self-ref, exempt, or
 already exists — all safe no-ops).

##### topupsInserted

> **topupsInserted**: `number`

Defined in: server/\_lib/onboarding/pointsBackfill.ts:127

***

### PassthroughCandidate

> **PassthroughCandidate** = `object`

Defined in: server/\_lib/onboarding/pointsBackfill.ts:107

#### Properties

##### amount

> **amount**: `number`

Defined in: server/\_lib/onboarding/pointsBackfill.ts:113

##### refereeRowId

> **refereeRowId**: `number`

Defined in: server/\_lib/onboarding/pointsBackfill.ts:108

##### refereeSignupId

> **refereeSignupId**: `number`

Defined in: server/\_lib/onboarding/pointsBackfill.ts:109

##### referrerSignupId

> **referrerSignupId**: `number`

Defined in: server/\_lib/onboarding/pointsBackfill.ts:110

##### source

> **source**: `string`

Defined in: server/\_lib/onboarding/pointsBackfill.ts:111

##### sourceId

> **sourceId**: `string` \| `null`

Defined in: server/\_lib/onboarding/pointsBackfill.ts:112

***

### TopupCandidate

> **TopupCandidate** = `object`

Defined in: server/\_lib/onboarding/pointsBackfill.ts:98

#### Properties

##### currentAmount

> **currentAmount**: `number`

Defined in: server/\_lib/onboarding/pointsBackfill.ts:102

##### delta

> **delta**: `number`

Defined in: server/\_lib/onboarding/pointsBackfill.ts:104

##### originalRowId

> **originalRowId**: `number`

Defined in: server/\_lib/onboarding/pointsBackfill.ts:99

##### signupId

> **signupId**: `number`

Defined in: server/\_lib/onboarding/pointsBackfill.ts:100

##### source

> **source**: `string`

Defined in: server/\_lib/onboarding/pointsBackfill.ts:101

##### targetAmount

> **targetAmount**: `number`

Defined in: server/\_lib/onboarding/pointsBackfill.ts:103

## Variables

### CANONICAL\_POINT\_VALUES

> `const` **CANONICAL\_POINT\_VALUES**: `Readonly`\<`Record`\<`string`, `number`\>\>

Defined in: server/\_lib/onboarding/pointsBackfill.ts:38

Authoritative "what each source SHOULD award today" map. Sources not listed
here are explicitly excluded from top-up (see `EXCLUDED_FROM_TOPUP` below).

All values are even integers by convention — keeps referral passthrough
(`floor(amount × 0.5)`) exact. If you bump a value here, update the
corresponding registry (`WAITLIST_POINTS` / `LINK_POINTS` / AMOE) to match.

***

### EXCLUDED\_FROM\_TOPUP

> `const` **EXCLUDED\_FROM\_TOPUP**: `Readonly`\<`Record`\<`string`, `string`\>\>

Defined in: server/\_lib/onboarding/pointsBackfill.ts:73

Documentation-only: sources intentionally NOT in the top-up map, with
 rationale. Keep in sync with the set above.

***

### PASSTHROUGH\_EXEMPT\_SOURCES

> `const` **PASSTHROUGH\_EXEMPT\_SOURCES**: readonly `string`[]

Defined in: server/\_lib/onboarding/pointsBackfill.ts:88

Exempt set for passthrough backfill. Mirrors `REFERRAL_FAMILY_EXEMPT` in
 waitlistPoints.ts — keep in sync.

## Functions

### applyPassthroughs()

> **applyPassthroughs**(`db`, `plan`): `Promise`\<\{ `inserted`: `number`; `skipped`: `number`; \}\>

Defined in: server/\_lib/onboarding/pointsBackfill.ts:276

Mirror missing passthrough rows via the canonical helper.

#### Parameters

##### db

`Db`

##### plan

[`PassthroughCandidate`](#passthroughcandidate)[]

#### Returns

`Promise`\<\{ `inserted`: `number`; `skipped`: `number`; \}\>

***

### applyTopups()

> **applyTopups**(`db`, `plan`): `Promise`\<`number`\>

Defined in: server/\_lib/onboarding/pointsBackfill.ts:260

Insert Phase A top-up rows. Double-idempotent: the `NOT EXISTS` in the
 plan skips already-topped rows, and `ON CONFLICT DO NOTHING` catches races.

#### Parameters

##### db

`Db`

##### plan

[`TopupCandidate`](#topupcandidate)[]

#### Returns

`Promise`\<`number`\>

***

### executePointsBackfill()

> **executePointsBackfill**(`db`, `plan`): `Promise`\<[`BackfillResult`](#backfillresult)\>

Defined in: server/\_lib/onboarding/pointsBackfill.ts:298

Run both phases. Also mirrors passthroughs for the newly-written top-up
 rows so the referrer gets the delta's 50% share in the same pass.

#### Parameters

##### db

`Db`

##### plan

[`BackfillPlan`](#backfillplan)

#### Returns

`Promise`\<[`BackfillResult`](#backfillresult)\>

***

### planPointsBackfill()

> **planPointsBackfill**(`db`, `options`): `Promise`\<[`BackfillPlan`](#backfillplan)\>

Defined in: server/\_lib/onboarding/pointsBackfill.ts:144

Pre-flight: compute what the endpoint *would* do without writing anything.
Safe to call at any time; reads only.

#### Parameters

##### db

`Db`

##### options

###### limit?

`number`

#### Returns

`Promise`\<[`BackfillPlan`](#backfillplan)\>
