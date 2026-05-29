[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/onboarding/pointsBackfill

# server/\_lib/onboarding/pointsBackfill

## Type Aliases

### BackfillPlan

> **BackfillPlan** = `object`

Defined in: [server/\_lib/onboarding/pointsBackfill.ts:127](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/pointsBackfill.ts#L127)

#### Properties

##### missingBaselines

> **missingBaselines**: [`MissingBaselineCandidate`](#missingbaselinecandidate)[]

Defined in: [server/\_lib/onboarding/pointsBackfill.ts:132](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/pointsBackfill.ts#L132)

Profiles missing a `waitlist_signup` row entirely. Synthesized via the
 same `awardWaitlistPoints` helper the live bootstrap uses.

##### missingLinkEmails

> **missingLinkEmails**: [`MissingLinkEmailCandidate`](#missinglinkemailcandidate)[]

Defined in: [server/\_lib/onboarding/pointsBackfill.ts:137](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/pointsBackfill.ts#L137)

Profiles with a verified email (email + privy_user_id populated) that
 are missing their `link_email` award. Synthesized via the same
 `applyPointEvent` helper the live email-link writer uses, so passthrough
 and eligibility gates stay identical.

##### passthroughs

> **passthroughs**: [`PassthroughCandidate`](#passthroughcandidate)[]

Defined in: [server/\_lib/onboarding/pointsBackfill.ts:129](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/pointsBackfill.ts#L129)

##### topups

> **topups**: [`TopupCandidate`](#topupcandidate)[]

Defined in: [server/\_lib/onboarding/pointsBackfill.ts:128](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/pointsBackfill.ts#L128)

##### topupsBySource

> **topupsBySource**: `Record`\<`string`, \{ `count`: `number`; `totalDelta`: `number`; \}\>

Defined in: [server/\_lib/onboarding/pointsBackfill.ts:142](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/pointsBackfill.ts#L142)

Per-source top-up summary for quick review.

##### unknownSourcesObserved

> **unknownSourcesObserved**: `string`[]

Defined in: [server/\_lib/onboarding/pointsBackfill.ts:140](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/pointsBackfill.ts#L140)

Sources observed in the `points` table that are NOT in the canonical
 map (and not explicitly excluded). Operators should review this list.

***

### BackfillResult

> **BackfillResult** = `object`

Defined in: [server/\_lib/onboarding/pointsBackfill.ts:145](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/pointsBackfill.ts#L145)

#### Properties

##### baselinesInserted

> **baselinesInserted**: `number`

Defined in: [server/\_lib/onboarding/pointsBackfill.ts:148](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/pointsBackfill.ts#L148)

##### linkEmailsInserted

> **linkEmailsInserted**: `number`

Defined in: [server/\_lib/onboarding/pointsBackfill.ts:149](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/pointsBackfill.ts#L149)

##### passthroughsInserted

> **passthroughsInserted**: `number`

Defined in: [server/\_lib/onboarding/pointsBackfill.ts:147](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/pointsBackfill.ts#L147)

##### passthroughsSkipped

> **passthroughsSkipped**: `number`

Defined in: [server/\_lib/onboarding/pointsBackfill.ts:152](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/pointsBackfill.ts#L152)

Rows the helper chose not to write (no referrer, self-ref, exempt, or
 already exists — all safe no-ops).

##### topupsInserted

> **topupsInserted**: `number`

Defined in: [server/\_lib/onboarding/pointsBackfill.ts:146](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/pointsBackfill.ts#L146)

***

### MissingBaselineCandidate

> **MissingBaselineCandidate** = `object`

Defined in: [server/\_lib/onboarding/pointsBackfill.ts:117](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/pointsBackfill.ts#L117)

#### Properties

##### signupId

> **signupId**: `number`

Defined in: [server/\_lib/onboarding/pointsBackfill.ts:118](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/pointsBackfill.ts#L118)

***

### MissingLinkEmailCandidate

> **MissingLinkEmailCandidate** = `object`

Defined in: [server/\_lib/onboarding/pointsBackfill.ts:121](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/pointsBackfill.ts#L121)

#### Properties

##### email

> **email**: `string`

Defined in: [server/\_lib/onboarding/pointsBackfill.ts:124](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/pointsBackfill.ts#L124)

##### privyUserId

> **privyUserId**: `string`

Defined in: [server/\_lib/onboarding/pointsBackfill.ts:123](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/pointsBackfill.ts#L123)

##### signupId

> **signupId**: `number`

Defined in: [server/\_lib/onboarding/pointsBackfill.ts:122](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/pointsBackfill.ts#L122)

***

### PassthroughCandidate

> **PassthroughCandidate** = `object`

Defined in: [server/\_lib/onboarding/pointsBackfill.ts:108](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/pointsBackfill.ts#L108)

#### Properties

##### amount

> **amount**: `number`

Defined in: [server/\_lib/onboarding/pointsBackfill.ts:114](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/pointsBackfill.ts#L114)

##### refereeRowId

> **refereeRowId**: `number`

Defined in: [server/\_lib/onboarding/pointsBackfill.ts:109](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/pointsBackfill.ts#L109)

##### refereeSignupId

> **refereeSignupId**: `number`

Defined in: [server/\_lib/onboarding/pointsBackfill.ts:110](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/pointsBackfill.ts#L110)

##### referrerSignupId

> **referrerSignupId**: `number`

Defined in: [server/\_lib/onboarding/pointsBackfill.ts:111](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/pointsBackfill.ts#L111)

##### source

> **source**: `string`

Defined in: [server/\_lib/onboarding/pointsBackfill.ts:112](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/pointsBackfill.ts#L112)

##### sourceId

> **sourceId**: `string` \| `null`

Defined in: [server/\_lib/onboarding/pointsBackfill.ts:113](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/pointsBackfill.ts#L113)

***

### TopupCandidate

> **TopupCandidate** = `object`

Defined in: [server/\_lib/onboarding/pointsBackfill.ts:99](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/pointsBackfill.ts#L99)

#### Properties

##### currentAmount

> **currentAmount**: `number`

Defined in: [server/\_lib/onboarding/pointsBackfill.ts:103](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/pointsBackfill.ts#L103)

##### delta

> **delta**: `number`

Defined in: [server/\_lib/onboarding/pointsBackfill.ts:105](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/pointsBackfill.ts#L105)

##### originalRowId

> **originalRowId**: `number`

Defined in: [server/\_lib/onboarding/pointsBackfill.ts:100](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/pointsBackfill.ts#L100)

##### signupId

> **signupId**: `number`

Defined in: [server/\_lib/onboarding/pointsBackfill.ts:101](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/pointsBackfill.ts#L101)

##### source

> **source**: `string`

Defined in: [server/\_lib/onboarding/pointsBackfill.ts:102](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/pointsBackfill.ts#L102)

##### targetAmount

> **targetAmount**: `number`

Defined in: [server/\_lib/onboarding/pointsBackfill.ts:104](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/pointsBackfill.ts#L104)

## Variables

### CANONICAL\_POINT\_VALUES

> `const` **CANONICAL\_POINT\_VALUES**: `Readonly`\<`Record`\<`string`, `number`\>\>

Defined in: [server/\_lib/onboarding/pointsBackfill.ts:39](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/pointsBackfill.ts#L39)

Authoritative "what each source SHOULD award today" map. Sources not listed
here are explicitly excluded from top-up (see `EXCLUDED_FROM_TOPUP` below).

All values are even integers by convention — keeps referral passthrough
(`floor(amount × 0.5)`) exact. If you bump a value here, update the
corresponding registry (`WAITLIST_POINTS` / `LINK_POINTS` / AMOE) to match.

***

### EXCLUDED\_FROM\_TOPUP

> `const` **EXCLUDED\_FROM\_TOPUP**: `Readonly`\<`Record`\<`string`, `string`\>\>

Defined in: [server/\_lib/onboarding/pointsBackfill.ts:74](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/pointsBackfill.ts#L74)

Documentation-only: sources intentionally NOT in the top-up map, with
 rationale. Keep in sync with the set above.

***

### PASSTHROUGH\_EXEMPT\_SOURCES

> `const` **PASSTHROUGH\_EXEMPT\_SOURCES**: readonly `string`[]

Defined in: [server/\_lib/onboarding/pointsBackfill.ts:89](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/pointsBackfill.ts#L89)

Exempt set for passthrough backfill. Mirrors `REFERRAL_FAMILY_EXEMPT` in
 waitlistPoints.ts — keep in sync.

## Functions

### applyMissingBaselines()

> **applyMissingBaselines**(`db`, `plan`): `Promise`\<`number`\>

Defined in: [server/\_lib/onboarding/pointsBackfill.ts:386](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/pointsBackfill.ts#L386)

Synthesize missing `waitlist_signup` rows via the canonical award helper.
 Each call flows through `awardWaitlistPoints`, which is idempotent and
 fires its own passthrough mirror, so running this multiple times is safe.

#### Parameters

##### db

`Db`

##### plan

[`MissingBaselineCandidate`](#missingbaselinecandidate)[]

#### Returns

`Promise`\<`number`\>

***

### applyMissingLinkEmails()

> **applyMissingLinkEmails**(`db`, `plan`): `Promise`\<`number`\>

Defined in: [server/\_lib/onboarding/pointsBackfill.ts:414](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/pointsBackfill.ts#L414)

Synthesize missing `link_email` awards for Privy-verified profiles.
 Uses the same `applyPointEvent` helper the live writer uses — same
 canonical profile resolution, same passthrough mirror, same idempotency
 via `ON CONFLICT DO NOTHING` on (signup_id, source, source_id).

#### Parameters

##### db

`Db`

##### plan

[`MissingLinkEmailCandidate`](#missinglinkemailcandidate)[]

#### Returns

`Promise`\<`number`\>

***

### applyPassthroughs()

> **applyPassthroughs**(`db`, `plan`): `Promise`\<\{ `inserted`: `number`; `skipped`: `number`; \}\>

Defined in: [server/\_lib/onboarding/pointsBackfill.ts:363](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/pointsBackfill.ts#L363)

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

Defined in: [server/\_lib/onboarding/pointsBackfill.ts:347](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/pointsBackfill.ts#L347)

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

Defined in: [server/\_lib/onboarding/pointsBackfill.ts:435](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/pointsBackfill.ts#L435)

Run all three phases. Phase A writes top-ups, Phase B mirrors passthroughs
 (both for original rows and for the newly-written top-up deltas), Phase C
 synthesizes missing baseline `waitlist_signup` rows.

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

Defined in: [server/\_lib/onboarding/pointsBackfill.ts:165](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/pointsBackfill.ts#L165)

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
