[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/lib/waitlist/pointsActivity

# src/lib/waitlist/pointsActivity

## Type Aliases

### PointsActivityRow

> **PointsActivityRow** = `object`

Defined in: [src/lib/waitlist/pointsActivity.ts:4](https://github.com/wenakita/4626/blob/main/frontend/src/lib/waitlist/pointsActivity.ts#L4)

#### Properties

##### amount

> **amount**: `number`

Defined in: [src/lib/waitlist/pointsActivity.ts:8](https://github.com/wenakita/4626/blob/main/frontend/src/lib/waitlist/pointsActivity.ts#L8)

##### createdAt

> **createdAt**: `string`

Defined in: [src/lib/waitlist/pointsActivity.ts:10](https://github.com/wenakita/4626/blob/main/frontend/src/lib/waitlist/pointsActivity.ts#L10)

##### id

> **id**: `string`

Defined in: [src/lib/waitlist/pointsActivity.ts:5](https://github.com/wenakita/4626/blob/main/frontend/src/lib/waitlist/pointsActivity.ts#L5)

##### label

> **label**: `string`

Defined in: [src/lib/waitlist/pointsActivity.ts:7](https://github.com/wenakita/4626/blob/main/frontend/src/lib/waitlist/pointsActivity.ts#L7)

##### source

> **source**: `string`

Defined in: [src/lib/waitlist/pointsActivity.ts:6](https://github.com/wenakita/4626/blob/main/frontend/src/lib/waitlist/pointsActivity.ts#L6)

##### waitlistPoints

> **waitlistPoints**: `number`

Defined in: [src/lib/waitlist/pointsActivity.ts:9](https://github.com/wenakita/4626/blob/main/frontend/src/lib/waitlist/pointsActivity.ts#L9)

***

### WaitlistPointsActivityBatch

> **WaitlistPointsActivityBatch** = `object`

Defined in: [src/lib/waitlist/pointsActivity.ts:13](https://github.com/wenakita/4626/blob/main/frontend/src/lib/waitlist/pointsActivity.ts#L13)

#### Properties

##### activity

> **activity**: [`PointsActivityRow`](#pointsactivityrow)[]

Defined in: [src/lib/waitlist/pointsActivity.ts:15](https://github.com/wenakita/4626/blob/main/frontend/src/lib/waitlist/pointsActivity.ts#L15)

##### signupId

> **signupId**: `number`

Defined in: [src/lib/waitlist/pointsActivity.ts:14](https://github.com/wenakita/4626/blob/main/frontend/src/lib/waitlist/pointsActivity.ts#L14)

## Functions

### fetchWaitlistPointsActivity()

> **fetchWaitlistPointsActivity**(`limit`, `privyAccessToken?`): `Promise`\<[`WaitlistPointsActivityBatch`](#waitlistpointsactivitybatch) \| `null`\>

Defined in: [src/lib/waitlist/pointsActivity.ts:18](https://github.com/wenakita/4626/blob/main/frontend/src/lib/waitlist/pointsActivity.ts#L18)

#### Parameters

##### limit

`number` = `30`

##### privyAccessToken?

`string` | `null`

#### Returns

`Promise`\<[`WaitlistPointsActivityBatch`](#waitlistpointsactivitybatch) \| `null`\>
