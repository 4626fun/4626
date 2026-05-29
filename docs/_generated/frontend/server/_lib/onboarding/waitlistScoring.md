[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/onboarding/waitlistScoring

# server/\_lib/onboarding/waitlistScoring

## Type Aliases

### PointsActivityRow

> **PointsActivityRow** = `object`

Defined in: [server/\_lib/onboarding/waitlistScoring.ts:291](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/waitlistScoring.ts#L291)

#### Properties

##### amount

> **amount**: `number`

Defined in: [server/\_lib/onboarding/waitlistScoring.ts:295](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/waitlistScoring.ts#L295)

##### createdAt

> **createdAt**: `string`

Defined in: [server/\_lib/onboarding/waitlistScoring.ts:297](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/waitlistScoring.ts#L297)

##### id

> **id**: `string`

Defined in: [server/\_lib/onboarding/waitlistScoring.ts:292](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/waitlistScoring.ts#L292)

##### label

> **label**: `string`

Defined in: [server/\_lib/onboarding/waitlistScoring.ts:294](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/waitlistScoring.ts#L294)

##### source

> **source**: `string`

Defined in: [server/\_lib/onboarding/waitlistScoring.ts:293](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/waitlistScoring.ts#L293)

##### waitlistPoints

> **waitlistPoints**: `number`

Defined in: [server/\_lib/onboarding/waitlistScoring.ts:296](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/waitlistScoring.ts#L296)

***

### WaitlistPointsBreakdown

> **WaitlistPointsBreakdown** = `object`

Defined in: [server/\_lib/onboarding/waitlistScoring.ts:140](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/waitlistScoring.ts#L140)

#### Properties

##### agent

> **agent**: `number`

Defined in: [server/\_lib/onboarding/waitlistScoring.ts:150](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/waitlistScoring.ts#L150)

##### bonus

> **bonus**: `number`

Defined in: [server/\_lib/onboarding/waitlistScoring.ts:149](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/waitlistScoring.ts#L149)

##### checkins

> **checkins**: `number`

Defined in: [server/\_lib/onboarding/waitlistScoring.ts:148](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/waitlistScoring.ts#L148)

##### csw

> **csw**: `number`

Defined in: [server/\_lib/onboarding/waitlistScoring.ts:146](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/waitlistScoring.ts#L146)

##### invite

> **invite**: `number`

Defined in: [server/\_lib/onboarding/waitlistScoring.ts:142](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/waitlistScoring.ts#L142)

##### links

> **links**: `number`

Defined in: [server/\_lib/onboarding/waitlistScoring.ts:144](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/waitlistScoring.ts#L144)

##### signup

> **signup**: `number`

Defined in: [server/\_lib/onboarding/waitlistScoring.ts:143](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/waitlistScoring.ts#L143)

##### social

> **social**: `number`

Defined in: [server/\_lib/onboarding/waitlistScoring.ts:147](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/waitlistScoring.ts#L147)

##### tasks

> **tasks**: `number`

Defined in: [server/\_lib/onboarding/waitlistScoring.ts:145](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/waitlistScoring.ts#L145)

##### total

> **total**: `number`

Defined in: [server/\_lib/onboarding/waitlistScoring.ts:141](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/waitlistScoring.ts#L141)

## Variables

### WAITLIST\_POINTS\_WEIGHT\_CASE\_SQL

> `const` **WAITLIST\_POINTS\_WEIGHT\_CASE\_SQL**: `string`

Defined in: [server/\_lib/onboarding/waitlistScoring.ts:120](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/waitlistScoring.ts#L120)

SQL `CASE` for `SUM(...)` over `points.source` / `points.amount`. Mirrors `weightedWaitlistPoints`.

## Functions

### labelForPointsSource()

> **labelForPointsSource**(`source`): `string`

Defined in: [server/\_lib/onboarding/waitlistScoring.ts:258](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/waitlistScoring.ts#L258)

#### Parameters

##### source

`string`

#### Returns

`string`

***

### listPointsActivityForSignupId()

> **listPointsActivityForSignupId**(`db`, `signupId`, `limit`): `Promise`\<[`PointsActivityRow`](#pointsactivityrow)[]\>

Defined in: [server/\_lib/onboarding/waitlistScoring.ts:300](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/waitlistScoring.ts#L300)

#### Parameters

##### db

`ScoringDb`

##### signupId

`number`

##### limit

`number` = `30`

#### Returns

`Promise`\<[`PointsActivityRow`](#pointsactivityrow)[]\>

***

### readAmoeEligibleCreditsForSignupId()

> **readAmoeEligibleCreditsForSignupId**(`db`, `signupId`): `Promise`\<`number`\>

Defined in: [server/\_lib/onboarding/waitlistScoring.ts:250](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/waitlistScoring.ts#L250)

Public points balance for lottery spend and `/api/v1/lottery/amoe/credits`.
Same weighted total as waitlist tiers, leaderboard, and tray (`points.total`).

#### Parameters

##### db

`ScoringDb`

##### signupId

`number`

#### Returns

`Promise`\<`number`\>

***

### readWaitlistPointsBreakdown()

> **readWaitlistPointsBreakdown**(`db`, `signupId`): `Promise`\<[`WaitlistPointsBreakdown`](#waitlistpointsbreakdown)\>

Defined in: [server/\_lib/onboarding/waitlistScoring.ts:169](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/waitlistScoring.ts#L169)

Canonical waitlist total + category buckets for one profile.

#### Parameters

##### db

`ScoringDb`

##### signupId

`number`

#### Returns

`Promise`\<[`WaitlistPointsBreakdown`](#waitlistpointsbreakdown)\>

***

### safeInt()

> **safeInt**(`v`): `number`

Defined in: [server/\_lib/onboarding/waitlistScoring.ts:13](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/waitlistScoring.ts#L13)

Canonical waitlist score from Supabase `public.points` (see `waitlistPoints.ts`).
Used by leaderboard, `/api/waitlist/position`, and referrer lookups.

Not tied to Airtable — that sync is an optional ops mirror when configured.
AMOE lottery bookkeeping (`amoe_entry_spend`, `amoe_twitter_daily`, …) is
excluded from waitlist surfaces per `amoeWaitlistPoints.ts`; only `amoe_checkin`
counts toward waitlist rank when written on a canonical profile.

#### Parameters

##### v

`unknown`

#### Returns

`number`

***

### sumWaitlistPointsBreakdown()

> **sumWaitlistPointsBreakdown**(`breakdown`): `number`

Defined in: [server/\_lib/onboarding/waitlistScoring.ts:154](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/waitlistScoring.ts#L154)

Sum of overview buckets — must match `total` when breakdown SQL stays in sync with total weighting.

#### Parameters

##### breakdown

[`WaitlistPointsBreakdown`](#waitlistpointsbreakdown)

#### Returns

`number`

***

### weightedAmoeEligiblePoints()

> **weightedAmoeEligiblePoints**(`source`, `amount`): `number`

Defined in: [server/\_lib/onboarding/waitlistScoring.ts:75](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/waitlistScoring.ts#L75)

Legacy per-row AMOE allowlist weights (view still exists in DB). Runtime balance/spend uses `readWaitlistPointsBreakdown`.

#### Parameters

##### source

`unknown`

##### amount

`unknown`

#### Returns

`number`

***

### weightedWaitlistPoints()

> **weightedWaitlistPoints**(`source`, `amount`): `number`

Defined in: [server/\_lib/onboarding/waitlistScoring.ts:19](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/waitlistScoring.ts#L19)

Weighted credits for one `points` row on waitlist surfaces.

#### Parameters

##### source

`unknown`

##### amount

`unknown`

#### Returns

`number`
