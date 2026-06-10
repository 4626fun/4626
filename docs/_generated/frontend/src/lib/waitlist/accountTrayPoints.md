[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/lib/waitlist/accountTrayPoints

# src/lib/waitlist/accountTrayPoints

## Classes

### AccountTrayPointsAuthError

Defined in: [src/lib/waitlist/accountTrayPoints.ts:29](https://github.com/wenakita/4626/blob/main/frontend/src/lib/waitlist/accountTrayPoints.ts#L29)

#### Extends

- `Error`

#### Constructors

##### Constructor

> **new AccountTrayPointsAuthError**(`message`): [`AccountTrayPointsAuthError`](#accounttraypointsautherror)

Defined in: [src/lib/waitlist/accountTrayPoints.ts:32](https://github.com/wenakita/4626/blob/main/frontend/src/lib/waitlist/accountTrayPoints.ts#L32)

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

Defined in: [src/lib/waitlist/accountTrayPoints.ts:30](https://github.com/wenakita/4626/blob/main/frontend/src/lib/waitlist/accountTrayPoints.ts#L30)

## Type Aliases

### AccountTrayPointsSnapshot

> **AccountTrayPointsSnapshot** = `object`

Defined in: [src/lib/waitlist/accountTrayPoints.ts:5](https://github.com/wenakita/4626/blob/main/frontend/src/lib/waitlist/accountTrayPoints.ts#L5)

#### Properties

##### activity

> **activity**: [`PointsActivityRow`](pointsActivity.md#pointsactivityrow)[]

Defined in: [src/lib/waitlist/accountTrayPoints.ts:26](https://github.com/wenakita/4626/blob/main/frontend/src/lib/waitlist/accountTrayPoints.ts#L26)

##### leaderboardEligible

> **leaderboardEligible**: `boolean`

Defined in: [src/lib/waitlist/accountTrayPoints.ts:8](https://github.com/wenakita/4626/blob/main/frontend/src/lib/waitlist/accountTrayPoints.ts#L8)

##### points

> **points**: `object`

Defined in: [src/lib/waitlist/accountTrayPoints.ts:9](https://github.com/wenakita/4626/blob/main/frontend/src/lib/waitlist/accountTrayPoints.ts#L9)

###### agent

> **agent**: `number`

###### bonus

> **bonus**: `number`

###### checkins

> **checkins**: `number`

###### csw

> **csw**: `number`

###### invite

> **invite**: `number`

###### links

> **links**: `number`

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

Defined in: [src/lib/waitlist/accountTrayPoints.ts:21](https://github.com/wenakita/4626/blob/main/frontend/src/lib/waitlist/accountTrayPoints.ts#L21)

###### invite

> **invite**: `number` \| `null`

###### total

> **total**: `number` \| `null`

##### signupId

> **signupId**: `number`

Defined in: [src/lib/waitlist/accountTrayPoints.ts:6](https://github.com/wenakita/4626/blob/main/frontend/src/lib/waitlist/accountTrayPoints.ts#L6)

##### tier

> **tier**: `number`

Defined in: [src/lib/waitlist/accountTrayPoints.ts:7](https://github.com/wenakita/4626/blob/main/frontend/src/lib/waitlist/accountTrayPoints.ts#L7)

##### totalCount

> **totalCount**: `number`

Defined in: [src/lib/waitlist/accountTrayPoints.ts:25](https://github.com/wenakita/4626/blob/main/frontend/src/lib/waitlist/accountTrayPoints.ts#L25)

## Functions

### fetchAccountTrayPoints()

> **fetchAccountTrayPoints**(`limit`, `privyAccessToken?`): `Promise`\<[`AccountTrayPointsSnapshot`](#accounttraypointssnapshot)\>

Defined in: [src/lib/waitlist/accountTrayPoints.ts:42](https://github.com/wenakita/4626/blob/main/frontend/src/lib/waitlist/accountTrayPoints.ts#L42)

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

Defined in: [src/lib/waitlist/accountTrayPoints.ts:38](https://github.com/wenakita/4626/blob/main/frontend/src/lib/waitlist/accountTrayPoints.ts#L38)

#### Parameters

##### error

`unknown`

#### Returns

`error is AccountTrayPointsAuthError`
