[**4626-app**](../../index.md)

***

[4626-app](../../index.md) / server/\_lib/waitlistLeaderboard

# server/\_lib/waitlistLeaderboard

## Type Aliases

### WaitlistLeaderboardPointsType

> **WaitlistLeaderboardPointsType** = `"total"` \| `"invite"` \| `"agent"`

Defined in: [server/\_lib/waitlistLeaderboard.ts:3](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/waitlistLeaderboard.ts#L3)

***

### WaitlistLeaderboardResponse

> **WaitlistLeaderboardResponse** = `object`

Defined in: [server/\_lib/waitlistLeaderboard.ts:18](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/waitlistLeaderboard.ts#L18)

#### Properties

##### hasMore

> **hasMore**: `boolean`

Defined in: [server/\_lib/waitlistLeaderboard.ts:24](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/waitlistLeaderboard.ts#L24)

##### leaderboard

> **leaderboard**: [`WaitlistLeaderboardRow`](#waitlistleaderboardrow)[]

Defined in: [server/\_lib/waitlistLeaderboard.ts:25](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/waitlistLeaderboard.ts#L25)

##### limit

> **limit**: `number`

Defined in: [server/\_lib/waitlistLeaderboard.ts:20](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/waitlistLeaderboard.ts#L20)

##### me

> **me**: [`WaitlistLeaderboardRow`](#waitlistleaderboardrow) \| `null`

Defined in: [server/\_lib/waitlistLeaderboard.ts:26](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/waitlistLeaderboard.ts#L26)

##### page

> **page**: `number`

Defined in: [server/\_lib/waitlistLeaderboard.ts:19](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/waitlistLeaderboard.ts#L19)

##### pointsType

> **pointsType**: [`WaitlistLeaderboardPointsType`](#waitlistleaderboardpointstype)

Defined in: [server/\_lib/waitlistLeaderboard.ts:21](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/waitlistLeaderboard.ts#L21)

##### totalCount

> **totalCount**: `number`

Defined in: [server/\_lib/waitlistLeaderboard.ts:22](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/waitlistLeaderboard.ts#L22)

##### totalPages

> **totalPages**: `number`

Defined in: [server/\_lib/waitlistLeaderboard.ts:23](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/waitlistLeaderboard.ts#L23)

***

### WaitlistLeaderboardRow

> **WaitlistLeaderboardRow** = `object`

Defined in: [server/\_lib/waitlistLeaderboard.ts:7](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/waitlistLeaderboard.ts#L7)

#### Properties

##### borderTier

> **borderTier**: `number`

Defined in: [server/\_lib/waitlistLeaderboard.ts:15](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/waitlistLeaderboard.ts#L15)

##### display

> **display**: `string`

Defined in: [server/\_lib/waitlistLeaderboard.ts:10](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/waitlistLeaderboard.ts#L10)

##### pointsAgent

> **pointsAgent**: `number`

Defined in: [server/\_lib/waitlistLeaderboard.ts:14](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/waitlistLeaderboard.ts#L14)

##### pointsInvite

> **pointsInvite**: `number`

Defined in: [server/\_lib/waitlistLeaderboard.ts:13](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/waitlistLeaderboard.ts#L13)

##### pointsTotal

> **pointsTotal**: `number`

Defined in: [server/\_lib/waitlistLeaderboard.ts:12](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/waitlistLeaderboard.ts#L12)

##### rank

> **rank**: `number`

Defined in: [server/\_lib/waitlistLeaderboard.ts:8](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/waitlistLeaderboard.ts#L8)

##### referralCode

> **referralCode**: `string` \| `null`

Defined in: [server/\_lib/waitlistLeaderboard.ts:11](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/waitlistLeaderboard.ts#L11)

##### signupId

> **signupId**: `number`

Defined in: [server/\_lib/waitlistLeaderboard.ts:9](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/waitlistLeaderboard.ts#L9)

## Functions

### getWaitlistLeaderboardData()

> **getWaitlistLeaderboardData**(`params`): `Promise`\<[`WaitlistLeaderboardResponse`](#waitlistleaderboardresponse)\>

Defined in: [server/\_lib/waitlistLeaderboard.ts:59](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/waitlistLeaderboard.ts#L59)

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
