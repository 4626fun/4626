[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/lib/waitlist/accountTrayPoints

# src/lib/waitlist/accountTrayPoints

## Classes

### AccountTrayPointsAuthError

Defined in: [src/lib/waitlist/accountTrayPoints.ts:26](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/waitlist/accountTrayPoints.ts#L26)

#### Extends

- `Error`

#### Constructors

##### Constructor

> **new AccountTrayPointsAuthError**(`message`): [`AccountTrayPointsAuthError`](#accounttraypointsautherror)

Defined in: [src/lib/waitlist/accountTrayPoints.ts:29](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/waitlist/accountTrayPoints.ts#L29)

###### Parameters

###### message

`string` = `'Privy sign-in required for points'`

###### Returns

[`AccountTrayPointsAuthError`](#accounttraypointsautherror)

###### Overrides

`Error.constructor`

#### Properties

##### code

> `readonly` **code**: `"account_tray_points_auth_required"`

Defined in: [src/lib/waitlist/accountTrayPoints.ts:27](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/waitlist/accountTrayPoints.ts#L27)

## Type Aliases

### AccountTrayPointsSnapshot

> **AccountTrayPointsSnapshot** = `object`

Defined in: [src/lib/waitlist/accountTrayPoints.ts:5](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/waitlist/accountTrayPoints.ts#L5)

#### Properties

##### activity

> **activity**: [`PointsActivityRow`](pointsActivity.md#pointsactivityrow)[]

Defined in: [src/lib/waitlist/accountTrayPoints.ts:23](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/waitlist/accountTrayPoints.ts#L23)

##### leaderboardEligible

> **leaderboardEligible**: `boolean`

Defined in: [src/lib/waitlist/accountTrayPoints.ts:8](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/waitlist/accountTrayPoints.ts#L8)

##### points

> **points**: `object`

Defined in: [src/lib/waitlist/accountTrayPoints.ts:9](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/waitlist/accountTrayPoints.ts#L9)

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

Defined in: [src/lib/waitlist/accountTrayPoints.ts:18](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/waitlist/accountTrayPoints.ts#L18)

###### invite

> **invite**: `number` \| `null`

###### total

> **total**: `number` \| `null`

##### signupId

> **signupId**: `number`

Defined in: [src/lib/waitlist/accountTrayPoints.ts:6](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/waitlist/accountTrayPoints.ts#L6)

##### tier

> **tier**: `number`

Defined in: [src/lib/waitlist/accountTrayPoints.ts:7](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/waitlist/accountTrayPoints.ts#L7)

##### totalCount

> **totalCount**: `number`

Defined in: [src/lib/waitlist/accountTrayPoints.ts:22](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/waitlist/accountTrayPoints.ts#L22)

## Functions

### fetchAccountTrayPoints()

> **fetchAccountTrayPoints**(`limit`, `privyAccessToken?`): `Promise`\<[`AccountTrayPointsSnapshot`](#accounttraypointssnapshot)\>

Defined in: [src/lib/waitlist/accountTrayPoints.ts:39](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/waitlist/accountTrayPoints.ts#L39)

#### Parameters

##### limit

`number` = `40`

##### privyAccessToken?

`string` | `null`

#### Returns

`Promise`\<[`AccountTrayPointsSnapshot`](#accounttraypointssnapshot)\>

***

### isAccountTrayPointsAuthError()

> **isAccountTrayPointsAuthError**(`error`): `error is AccountTrayPointsAuthError`

Defined in: [src/lib/waitlist/accountTrayPoints.ts:35](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/waitlist/accountTrayPoints.ts#L35)

#### Parameters

##### error

`unknown`

#### Returns

`error is AccountTrayPointsAuthError`
