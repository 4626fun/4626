[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/onboarding/waitlistLeaderboard

# server/\_lib/onboarding/waitlistLeaderboard

## Type Aliases

### WaitlistLeaderboardPointsType

> **WaitlistLeaderboardPointsType** = `"total"` \| `"invite"` \| `"agent"`

Defined in: [server/\_lib/onboarding/waitlistLeaderboard.ts:5](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/waitlistLeaderboard.ts#L5)

***

### WaitlistLeaderboardResponse

> **WaitlistLeaderboardResponse** = `object`

Defined in: [server/\_lib/onboarding/waitlistLeaderboard.ts:27](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/waitlistLeaderboard.ts#L27)

#### Properties

##### hasMore

> **hasMore**: `boolean`

Defined in: [server/\_lib/onboarding/waitlistLeaderboard.ts:33](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/waitlistLeaderboard.ts#L33)

##### leaderboard

> **leaderboard**: [`WaitlistLeaderboardRow`](#waitlistleaderboardrow)[]

Defined in: [server/\_lib/onboarding/waitlistLeaderboard.ts:34](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/waitlistLeaderboard.ts#L34)

##### limit

> **limit**: `number`

Defined in: [server/\_lib/onboarding/waitlistLeaderboard.ts:29](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/waitlistLeaderboard.ts#L29)

##### me

> **me**: [`WaitlistLeaderboardRow`](#waitlistleaderboardrow) \| `null`

Defined in: [server/\_lib/onboarding/waitlistLeaderboard.ts:35](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/waitlistLeaderboard.ts#L35)

##### page

> **page**: `number`

Defined in: [server/\_lib/onboarding/waitlistLeaderboard.ts:28](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/waitlistLeaderboard.ts#L28)

##### pointsType

> **pointsType**: [`WaitlistLeaderboardPointsType`](#waitlistleaderboardpointstype)

Defined in: [server/\_lib/onboarding/waitlistLeaderboard.ts:30](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/waitlistLeaderboard.ts#L30)

##### totalCount

> **totalCount**: `number`

Defined in: [server/\_lib/onboarding/waitlistLeaderboard.ts:31](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/waitlistLeaderboard.ts#L31)

##### totalPages

> **totalPages**: `number`

Defined in: [server/\_lib/onboarding/waitlistLeaderboard.ts:32](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/waitlistLeaderboard.ts#L32)

***

### WaitlistLeaderboardRow

> **WaitlistLeaderboardRow** = `object`

Defined in: [server/\_lib/onboarding/waitlistLeaderboard.ts:9](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/waitlistLeaderboard.ts#L9)

#### Properties

##### avatarUrl

> **avatarUrl**: `string` \| `null`

Defined in: [server/\_lib/onboarding/waitlistLeaderboard.ts:15](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/waitlistLeaderboard.ts#L15)

##### borderTier

> **borderTier**: `number`

Defined in: [server/\_lib/onboarding/waitlistLeaderboard.ts:24](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/waitlistLeaderboard.ts#L24)

##### cswAddress

> **cswAddress**: `string` \| `null`

Defined in: [server/\_lib/onboarding/waitlistLeaderboard.ts:13](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/waitlistLeaderboard.ts#L13)

##### display

> **display**: `string`

Defined in: [server/\_lib/onboarding/waitlistLeaderboard.ts:12](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/waitlistLeaderboard.ts#L12)

##### labelHint

> **labelHint**: `string` \| `null`

Defined in: [server/\_lib/onboarding/waitlistLeaderboard.ts:14](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/waitlistLeaderboard.ts#L14)

##### pointsAgent

> **pointsAgent**: `number`

Defined in: [server/\_lib/onboarding/waitlistLeaderboard.ts:23](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/waitlistLeaderboard.ts#L23)

##### pointsInvite

> **pointsInvite**: `number`

Defined in: [server/\_lib/onboarding/waitlistLeaderboard.ts:22](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/waitlistLeaderboard.ts#L22)

##### pointsTotal

> **pointsTotal**: `number`

Defined in: [server/\_lib/onboarding/waitlistLeaderboard.ts:21](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/waitlistLeaderboard.ts#L21)

##### rank

> **rank**: `number`

Defined in: [server/\_lib/onboarding/waitlistLeaderboard.ts:10](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/waitlistLeaderboard.ts#L10)

##### referralCode

> **referralCode**: `string` \| `null`

Defined in: [server/\_lib/onboarding/waitlistLeaderboard.ts:20](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/waitlistLeaderboard.ts#L20)

##### showBaseAppBadge

> **showBaseAppBadge**: `boolean`

Defined in: [server/\_lib/onboarding/waitlistLeaderboard.ts:17](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/waitlistLeaderboard.ts#L17)

##### showZoraBadge

> **showZoraBadge**: `boolean`

Defined in: [server/\_lib/onboarding/waitlistLeaderboard.ts:16](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/waitlistLeaderboard.ts#L16)

##### signupId

> **signupId**: `number`

Defined in: [server/\_lib/onboarding/waitlistLeaderboard.ts:11](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/waitlistLeaderboard.ts#L11)

##### walletProvider

> **walletProvider**: `string` \| `null`

Defined in: [server/\_lib/onboarding/waitlistLeaderboard.ts:19](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/waitlistLeaderboard.ts#L19)

Primary external wallet provider when no canonical CSW (rabby, metamask, …).

## Functions

### getWaitlistLeaderboardData()

> **getWaitlistLeaderboardData**(`params`): `Promise`\<[`WaitlistLeaderboardResponse`](#waitlistleaderboardresponse)\>

Defined in: [server/\_lib/onboarding/waitlistLeaderboard.ts:97](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/waitlistLeaderboard.ts#L97)

#### Parameters

##### params

###### authorizedProfileId

`number` \| `null`

###### db

`Db`

###### limit

`number`

###### page

`number`

###### pointsType

[`WaitlistLeaderboardPointsType`](#waitlistleaderboardpointstype)

#### Returns

`Promise`\<[`WaitlistLeaderboardResponse`](#waitlistleaderboardresponse)\>
