[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / server/\_lib/onboarding/waitlistLeaderboard

# server/\_lib/onboarding/waitlistLeaderboard

## Type Aliases

### WaitlistLeaderboardPointsType

> **WaitlistLeaderboardPointsType** = `"total"` \| `"invite"` \| `"agent"`

Defined in: [server/\_lib/onboarding/waitlistLeaderboard.ts:3](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/waitlistLeaderboard.ts#L3)

***

### WaitlistLeaderboardResponse

> **WaitlistLeaderboardResponse** = `object`

Defined in: [server/\_lib/onboarding/waitlistLeaderboard.ts:33](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/waitlistLeaderboard.ts#L33)

#### Properties

##### hasMore

> **hasMore**: `boolean`

Defined in: [server/\_lib/onboarding/waitlistLeaderboard.ts:39](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/waitlistLeaderboard.ts#L39)

##### leaderboard

> **leaderboard**: [`WaitlistLeaderboardRow`](#waitlistleaderboardrow)[]

Defined in: [server/\_lib/onboarding/waitlistLeaderboard.ts:40](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/waitlistLeaderboard.ts#L40)

##### limit

> **limit**: `number`

Defined in: [server/\_lib/onboarding/waitlistLeaderboard.ts:35](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/waitlistLeaderboard.ts#L35)

##### me

> **me**: [`WaitlistLeaderboardRow`](#waitlistleaderboardrow) \| `null`

Defined in: [server/\_lib/onboarding/waitlistLeaderboard.ts:41](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/waitlistLeaderboard.ts#L41)

##### page

> **page**: `number`

Defined in: [server/\_lib/onboarding/waitlistLeaderboard.ts:34](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/waitlistLeaderboard.ts#L34)

##### pointsType

> **pointsType**: [`WaitlistLeaderboardPointsType`](#waitlistleaderboardpointstype)

Defined in: [server/\_lib/onboarding/waitlistLeaderboard.ts:36](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/waitlistLeaderboard.ts#L36)

##### totalCount

> **totalCount**: `number`

Defined in: [server/\_lib/onboarding/waitlistLeaderboard.ts:37](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/waitlistLeaderboard.ts#L37)

##### totalPages

> **totalPages**: `number`

Defined in: [server/\_lib/onboarding/waitlistLeaderboard.ts:38](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/waitlistLeaderboard.ts#L38)

***

### WaitlistLeaderboardRow

> **WaitlistLeaderboardRow** = `object`

Defined in: [server/\_lib/onboarding/waitlistLeaderboard.ts:7](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/waitlistLeaderboard.ts#L7)

#### Properties

##### borderTier

> **borderTier**: `number`

Defined in: [server/\_lib/onboarding/waitlistLeaderboard.ts:30](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/waitlistLeaderboard.ts#L30)

##### cswAddress

> **cswAddress**: `string` \| `null`

Defined in: [server/\_lib/onboarding/waitlistLeaderboard.ts:25](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/waitlistLeaderboard.ts#L25)

The profile's canonical Coinbase Smart Wallet address when one is
registered (column `profiles.primary_smart_wallet`). Always full
(non-shortened) so the UI can format it for display, link to Basescan,
etc. `null` when the user hasn't completed CSW onboarding.

##### display

> **display**: `string`

Defined in: [server/\_lib/onboarding/waitlistLeaderboard.ts:18](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/waitlistLeaderboard.ts#L18)

Short, human-readable identity label. Today this resolves to the same
shortened address as `cswAddress` when a canonical smart wallet is
recorded for the profile, falling back to the rolled-up primary wallet
(CSW or embedded EOA) and finally to `user#<signupId>`. Kept distinct
from `cswAddress` so the UI can render a chip / badge only when it
truly knows it has a Coinbase Smart Wallet to point at.

##### pointsAgent

> **pointsAgent**: `number`

Defined in: [server/\_lib/onboarding/waitlistLeaderboard.ts:29](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/waitlistLeaderboard.ts#L29)

##### pointsInvite

> **pointsInvite**: `number`

Defined in: [server/\_lib/onboarding/waitlistLeaderboard.ts:28](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/waitlistLeaderboard.ts#L28)

##### pointsTotal

> **pointsTotal**: `number`

Defined in: [server/\_lib/onboarding/waitlistLeaderboard.ts:27](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/waitlistLeaderboard.ts#L27)

##### rank

> **rank**: `number`

Defined in: [server/\_lib/onboarding/waitlistLeaderboard.ts:8](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/waitlistLeaderboard.ts#L8)

##### referralCode

> **referralCode**: `string` \| `null`

Defined in: [server/\_lib/onboarding/waitlistLeaderboard.ts:26](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/waitlistLeaderboard.ts#L26)

##### signupId

> **signupId**: `number`

Defined in: [server/\_lib/onboarding/waitlistLeaderboard.ts:9](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/waitlistLeaderboard.ts#L9)

## Functions

### getWaitlistLeaderboardData()

> **getWaitlistLeaderboardData**(`params`): `Promise`\<[`WaitlistLeaderboardResponse`](#waitlistleaderboardresponse)\>

Defined in: [server/\_lib/onboarding/waitlistLeaderboard.ts:83](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/waitlistLeaderboard.ts#L83)

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
