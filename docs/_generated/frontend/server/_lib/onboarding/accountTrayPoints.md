[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/onboarding/accountTrayPoints

# server/\_lib/onboarding/accountTrayPoints

## Type Aliases

### AccountTrayPointsPayload

> **AccountTrayPointsPayload** = `object`

Defined in: [server/\_lib/onboarding/accountTrayPoints.ts:20](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/onboarding/accountTrayPoints.ts#L20)

#### Properties

##### activity

> **activity**: [`PointsActivityRow`](waitlistScoring.md#pointsactivityrow)[]

Defined in: [server/\_lib/onboarding/accountTrayPoints.ts:39](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/onboarding/accountTrayPoints.ts#L39)

##### leaderboardEligible

> **leaderboardEligible**: `boolean`

Defined in: [server/\_lib/onboarding/accountTrayPoints.ts:24](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/onboarding/accountTrayPoints.ts#L24)

True when profile has a real verified email and is not tombstoned (leaderboard pool).

##### points

> **points**: `object`

Defined in: [server/\_lib/onboarding/accountTrayPoints.ts:25](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/onboarding/accountTrayPoints.ts#L25)

###### bonus

> **bonus**: `number`

###### csw

> **csw**: `number`

###### invite

> **invite**: `number`

###### signup

> **signup**: `number`

###### social

> **social**: `number`

###### tasks

> **tasks**: `number`

###### total

> **total**: `number`

##### rank

> **rank**: `object`

Defined in: [server/\_lib/onboarding/accountTrayPoints.ts:34](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/onboarding/accountTrayPoints.ts#L34)

###### invite

> **invite**: `number` \| `null`

###### total

> **total**: `number` \| `null`

##### signupId

> **signupId**: `number`

Defined in: [server/\_lib/onboarding/accountTrayPoints.ts:21](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/onboarding/accountTrayPoints.ts#L21)

##### tier

> **tier**: `number`

Defined in: [server/\_lib/onboarding/accountTrayPoints.ts:22](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/onboarding/accountTrayPoints.ts#L22)

##### totalCount

> **totalCount**: `number`

Defined in: [server/\_lib/onboarding/accountTrayPoints.ts:38](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/onboarding/accountTrayPoints.ts#L38)

## Variables

### ACCOUNT\_TRAY\_POINTS\_ACTIVITY\_LIMIT\_DEFAULT

> `const` **ACCOUNT\_TRAY\_POINTS\_ACTIVITY\_LIMIT\_DEFAULT**: `40` = `40`

Defined in: [server/\_lib/onboarding/accountTrayPoints.ts:17](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/onboarding/accountTrayPoints.ts#L17)

***

### ACCOUNT\_TRAY\_POINTS\_ACTIVITY\_LIMIT\_MAX

> `const` **ACCOUNT\_TRAY\_POINTS\_ACTIVITY\_LIMIT\_MAX**: `100` = `100`

Defined in: [server/\_lib/onboarding/accountTrayPoints.ts:18](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/onboarding/accountTrayPoints.ts#L18)

***

### EMPTY\_ACCOUNT\_TRAY\_POINTS

> `const` **EMPTY\_ACCOUNT\_TRAY\_POINTS**: [`AccountTrayPointsPayload`](#accounttraypointspayload)

Defined in: [server/\_lib/onboarding/accountTrayPoints.ts:42](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/onboarding/accountTrayPoints.ts#L42)

## Functions

### buildAccountTrayPointsForPrivyUser()

> **buildAccountTrayPointsForPrivyUser**(`db`, `privyUserId`, `limit`): `Promise`\<[`AccountTrayPointsPayload`](#accounttraypointspayload)\>

Defined in: [server/\_lib/onboarding/accountTrayPoints.ts:129](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/onboarding/accountTrayPoints.ts#L129)

Privy-only entry: resolves canonical profile id (alias-aware), then builds tray payload.

#### Parameters

##### db

`ScoringDb`

##### privyUserId

`string`

##### limit

`unknown`

#### Returns

`Promise`\<[`AccountTrayPointsPayload`](#accounttraypointspayload)\>

***

### buildAccountTrayPointsPayload()

> **buildAccountTrayPointsPayload**(`db`, `signupId`, `limit`): `Promise`\<[`AccountTrayPointsPayload`](#accounttraypointspayload)\>

Defined in: [server/\_lib/onboarding/accountTrayPoints.ts:90](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/onboarding/accountTrayPoints.ts#L90)

Canonical tray payload: one Privy-resolved profile, one weighted breakdown, optional rank.
Rank/totalCount are withheld unless the profile is leaderboard-eligible (verified email, live row).

#### Parameters

##### db

`ScoringDb`

##### signupId

`number`

##### limit

`unknown`

#### Returns

`Promise`\<[`AccountTrayPointsPayload`](#accounttraypointspayload)\>

***

### clampAccountTrayPointsActivityLimit()

> **clampAccountTrayPointsActivityLimit**(`limit`): `number`

Defined in: [server/\_lib/onboarding/accountTrayPoints.ts:52](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/onboarding/accountTrayPoints.ts#L52)

#### Parameters

##### limit

`unknown`

#### Returns

`number`

***

### readProfileLeaderboardEligibility()

> **readProfileLeaderboardEligibility**(`db`, `signupId`): `Promise`\<\{ `leaderboardEligible`: `boolean`; \}\>

Defined in: [server/\_lib/onboarding/accountTrayPoints.ts:67](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/onboarding/accountTrayPoints.ts#L67)

#### Parameters

##### db

`ScoringDb`

##### signupId

`number`

#### Returns

`Promise`\<\{ `leaderboardEligible`: `boolean`; \}\>

## References

### assertValidSignupId

Re-exports [assertValidSignupId](profileSignupId.md#assertvalidsignupid)
