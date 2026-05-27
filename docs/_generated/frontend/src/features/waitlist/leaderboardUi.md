[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/features/waitlist/leaderboardUi

# src/features/waitlist/leaderboardUi

## Type Aliases

### LeaderboardEntry

> **LeaderboardEntry** = `object`

Defined in: [src/features/waitlist/leaderboardUi.tsx:7](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/waitlist/leaderboardUi.tsx#L7)

#### Properties

##### avatarUrl

> **avatarUrl**: `string` \| `null`

Defined in: [src/features/waitlist/leaderboardUi.tsx:13](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/waitlist/leaderboardUi.tsx#L13)

##### cswAddress

> **cswAddress**: `string` \| `null`

Defined in: [src/features/waitlist/leaderboardUi.tsx:11](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/waitlist/leaderboardUi.tsx#L11)

##### display

> **display**: `string`

Defined in: [src/features/waitlist/leaderboardUi.tsx:10](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/waitlist/leaderboardUi.tsx#L10)

##### labelHint

> **labelHint**: `string` \| `null`

Defined in: [src/features/waitlist/leaderboardUi.tsx:12](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/waitlist/leaderboardUi.tsx#L12)

##### pointsAgent

> **pointsAgent**: `number`

Defined in: [src/features/waitlist/leaderboardUi.tsx:20](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/waitlist/leaderboardUi.tsx#L20)

##### pointsInvite

> **pointsInvite**: `number`

Defined in: [src/features/waitlist/leaderboardUi.tsx:19](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/waitlist/leaderboardUi.tsx#L19)

##### pointsTotal

> **pointsTotal**: `number`

Defined in: [src/features/waitlist/leaderboardUi.tsx:18](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/waitlist/leaderboardUi.tsx#L18)

##### rank

> **rank**: `number`

Defined in: [src/features/waitlist/leaderboardUi.tsx:8](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/waitlist/leaderboardUi.tsx#L8)

##### referralCode

> **referralCode**: `string` \| `null`

Defined in: [src/features/waitlist/leaderboardUi.tsx:17](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/waitlist/leaderboardUi.tsx#L17)

##### showBaseAppBadge

> **showBaseAppBadge**: `boolean`

Defined in: [src/features/waitlist/leaderboardUi.tsx:15](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/waitlist/leaderboardUi.tsx#L15)

##### showZoraBadge

> **showZoraBadge**: `boolean`

Defined in: [src/features/waitlist/leaderboardUi.tsx:14](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/waitlist/leaderboardUi.tsx#L14)

##### signupId

> **signupId**: `number`

Defined in: [src/features/waitlist/leaderboardUi.tsx:9](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/waitlist/leaderboardUi.tsx#L9)

##### walletProvider

> **walletProvider**: `string` \| `null`

Defined in: [src/features/waitlist/leaderboardUi.tsx:16](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/waitlist/leaderboardUi.tsx#L16)

## Functions

### formatLeaderboardDisplayName()

> **formatLeaderboardDisplayName**(`display`): `string`

Defined in: [src/features/waitlist/leaderboardUi.tsx:29](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/waitlist/leaderboardUi.tsx#L29)

Friendlier public label for synthetic waitlist handles.

#### Parameters

##### display

`string`

#### Returns

`string`

***

### formatWholeNumber()

> **formatWholeNumber**(`value`): `string`

Defined in: [src/features/waitlist/leaderboardUi.tsx:23](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/waitlist/leaderboardUi.tsx#L23)

#### Parameters

##### value

`number` | `null` | `undefined`

#### Returns

`string`

***

### LeaderboardEmptyState()

> **LeaderboardEmptyState**(`__namedParameters`): `Element`

Defined in: [src/features/waitlist/leaderboardUi.tsx:241](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/waitlist/leaderboardUi.tsx#L241)

#### Parameters

##### \_\_namedParameters

###### message

`ReactNode`

#### Returns

`Element`

***

### LeaderboardListHeader()

> **LeaderboardListHeader**(): `Element`

Defined in: [src/features/waitlist/leaderboardUi.tsx:159](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/waitlist/leaderboardUi.tsx#L159)

#### Returns

`Element`

***

### LeaderboardListRow()

> **LeaderboardListRow**(`__namedParameters`): `Element`

Defined in: [src/features/waitlist/leaderboardUi.tsx:172](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/waitlist/leaderboardUi.tsx#L172)

#### Parameters

##### \_\_namedParameters

###### isMe

`boolean`

###### row

[`LeaderboardEntry`](#leaderboardentry)

###### showReferralCode?

`boolean` = `false`

#### Returns

`Element`

***

### LeaderboardPodium()

> **LeaderboardPodium**(`__namedParameters`): `Element` \| `null`

Defined in: [src/features/waitlist/leaderboardUi.tsx:136](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/waitlist/leaderboardUi.tsx#L136)

#### Parameters

##### \_\_namedParameters

###### entries

[`LeaderboardEntry`](#leaderboardentry)[]

###### meSignupId

`number` \| `null` \| `undefined`

#### Returns

`Element` \| `null`

***

### LeaderboardPoints()

> **LeaderboardPoints**(`__namedParameters`): `Element`

Defined in: [src/features/waitlist/leaderboardUi.tsx:57](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/waitlist/leaderboardUi.tsx#L57)

#### Parameters

##### \_\_namedParameters

###### row

[`LeaderboardEntry`](#leaderboardentry)

###### size?

`"sm"` \| `"md"` \| `"lg"` = `'md'`

#### Returns

`Element`

***

### LeaderboardSkeleton()

> **LeaderboardSkeleton**(`__namedParameters`): `Element`

Defined in: [src/features/waitlist/leaderboardUi.tsx:221](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/waitlist/leaderboardUi.tsx#L221)

#### Parameters

##### \_\_namedParameters

###### rows?

`number` = `8`

#### Returns

`Element`
