[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/onboarding/waitlistPositionForProfile

# server/\_lib/onboarding/waitlistPositionForProfile

## Type Aliases

### WaitlistProfilePointsBreakdown

> **WaitlistProfilePointsBreakdown** = `object`

Defined in: [server/\_lib/onboarding/waitlistPositionForProfile.ts:14](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/waitlistPositionForProfile.ts#L14)

#### Properties

##### agent

> **agent**: `number`

Defined in: [server/\_lib/onboarding/waitlistPositionForProfile.ts:24](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/waitlistPositionForProfile.ts#L24)

##### bonus

> **bonus**: `number`

Defined in: [server/\_lib/onboarding/waitlistPositionForProfile.ts:23](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/waitlistPositionForProfile.ts#L23)

##### checkins

> **checkins**: `number`

Defined in: [server/\_lib/onboarding/waitlistPositionForProfile.ts:22](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/waitlistPositionForProfile.ts#L22)

##### csw

> **csw**: `number`

Defined in: [server/\_lib/onboarding/waitlistPositionForProfile.ts:20](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/waitlistPositionForProfile.ts#L20)

##### invite

> **invite**: `number`

Defined in: [server/\_lib/onboarding/waitlistPositionForProfile.ts:16](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/waitlistPositionForProfile.ts#L16)

##### links

> **links**: `number`

Defined in: [server/\_lib/onboarding/waitlistPositionForProfile.ts:18](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/waitlistPositionForProfile.ts#L18)

##### signup

> **signup**: `number`

Defined in: [server/\_lib/onboarding/waitlistPositionForProfile.ts:17](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/waitlistPositionForProfile.ts#L17)

##### social

> **social**: `number`

Defined in: [server/\_lib/onboarding/waitlistPositionForProfile.ts:21](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/waitlistPositionForProfile.ts#L21)

##### tasks

> **tasks**: `number`

Defined in: [server/\_lib/onboarding/waitlistPositionForProfile.ts:19](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/waitlistPositionForProfile.ts#L19)

##### total

> **total**: `number`

Defined in: [server/\_lib/onboarding/waitlistPositionForProfile.ts:15](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/waitlistPositionForProfile.ts#L15)

***

### WaitlistProfilePositionSnapshot

> **WaitlistProfilePositionSnapshot** = `object`

Defined in: [server/\_lib/onboarding/waitlistPositionForProfile.ts:27](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/waitlistPositionForProfile.ts#L27)

#### Properties

##### borderTier

> **borderTier**: `number`

Defined in: [server/\_lib/onboarding/waitlistPositionForProfile.ts:31](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/waitlistPositionForProfile.ts#L31)

##### percentileInvite

> **percentileInvite**: `number` \| `null`

Defined in: [server/\_lib/onboarding/waitlistPositionForProfile.ts:40](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/waitlistPositionForProfile.ts#L40)

##### points

> **points**: [`WaitlistProfilePointsBreakdown`](#waitlistprofilepointsbreakdown)

Defined in: [server/\_lib/onboarding/waitlistPositionForProfile.ts:32](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/waitlistPositionForProfile.ts#L32)

##### profileCompletedAt

> **profileCompletedAt**: `string` \| `null`

Defined in: [server/\_lib/onboarding/waitlistPositionForProfile.ts:29](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/waitlistPositionForProfile.ts#L29)

##### rank

> **rank**: `object`

Defined in: [server/\_lib/onboarding/waitlistPositionForProfile.ts:34](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/waitlistPositionForProfile.ts#L34)

###### invite

> **invite**: `number` \| `null`

###### total

> **total**: `number` \| `null`

##### referralCode

> **referralCode**: `string` \| `null`

Defined in: [server/\_lib/onboarding/waitlistPositionForProfile.ts:30](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/waitlistPositionForProfile.ts#L30)

##### referrals

> **referrals**: `object`

Defined in: [server/\_lib/onboarding/waitlistPositionForProfile.ts:41](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/waitlistPositionForProfile.ts#L41)

###### pendingCap

> **pendingCap**: `number`

###### pendingCount

> **pendingCount**: `number`

###### pendingCountCapped

> **pendingCountCapped**: `number`

###### qualifiedCount

> **qualifiedCount**: `number`

##### signupId

> **signupId**: `number`

Defined in: [server/\_lib/onboarding/waitlistPositionForProfile.ts:28](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/waitlistPositionForProfile.ts#L28)

##### tier

> **tier**: `number`

Defined in: [server/\_lib/onboarding/waitlistPositionForProfile.ts:33](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/waitlistPositionForProfile.ts#L33)

##### totalAheadInvite

> **totalAheadInvite**: `number` \| `null`

Defined in: [server/\_lib/onboarding/waitlistPositionForProfile.ts:39](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/waitlistPositionForProfile.ts#L39)

##### totalCount

> **totalCount**: `number`

Defined in: [server/\_lib/onboarding/waitlistPositionForProfile.ts:38](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/waitlistPositionForProfile.ts#L38)

## Functions

### readWaitlistPositionForSignupId()

> **readWaitlistPositionForSignupId**(`db`, `signupId`): `Promise`\<[`WaitlistProfilePositionSnapshot`](#waitlistprofilepositionsnapshot)\>

Defined in: [server/\_lib/onboarding/waitlistPositionForProfile.ts:50](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/waitlistPositionForProfile.ts#L50)

Privy-resolved profile waitlist position (rank, breakdown, referrals).

#### Parameters

##### db

`ScoringDb`

##### signupId

`number`

#### Returns

`Promise`\<[`WaitlistProfilePositionSnapshot`](#waitlistprofilepositionsnapshot)\>
