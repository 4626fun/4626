[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/lib/account/appActivityJournal

# src/lib/account/appActivityJournal

## Type Aliases

### AppActivityEntry

> **AppActivityEntry** = `object`

Defined in: [src/lib/account/appActivityJournal.ts:8](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/account/appActivityJournal.ts#L8)

#### Properties

##### amountInUnits

> **amountInUnits**: `string`

Defined in: [src/lib/account/appActivityJournal.ts:14](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/account/appActivityJournal.ts#L14)

##### completedAtMs

> **completedAtMs**: `number`

Defined in: [src/lib/account/appActivityJournal.ts:18](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/account/appActivityJournal.ts#L18)

##### estimatedOut

> **estimatedOut**: `string`

Defined in: [src/lib/account/appActivityJournal.ts:15](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/account/appActivityJournal.ts#L15)

##### id

> **id**: `string`

Defined in: [src/lib/account/appActivityJournal.ts:9](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/account/appActivityJournal.ts#L9)

##### kind

> **kind**: `"swap"`

Defined in: [src/lib/account/appActivityJournal.ts:10](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/account/appActivityJournal.ts#L10)

##### tokenIn

> **tokenIn**: `string`

Defined in: [src/lib/account/appActivityJournal.ts:16](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/account/appActivityJournal.ts#L16)

##### tokenOut

> **tokenOut**: `string`

Defined in: [src/lib/account/appActivityJournal.ts:17](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/account/appActivityJournal.ts#L17)

##### txHash

> **txHash**: `string` \| `null`

Defined in: [src/lib/account/appActivityJournal.ts:12](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/account/appActivityJournal.ts#L12)

##### userOpHash

> **userOpHash**: `string` \| `null`

Defined in: [src/lib/account/appActivityJournal.ts:13](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/account/appActivityJournal.ts#L13)

##### walletAddress

> **walletAddress**: `string`

Defined in: [src/lib/account/appActivityJournal.ts:11](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/account/appActivityJournal.ts#L11)

## Variables

### APP\_ACTIVITY\_UPDATED\_EVENT

> `const` **APP\_ACTIVITY\_UPDATED\_EVENT**: `"cv:app-activity-updated"` = `'cv:app-activity-updated'`

Defined in: [src/lib/account/appActivityJournal.ts:6](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/account/appActivityJournal.ts#L6)

## Functions

### appendAppSwapActivity()

> **appendAppSwapActivity**(`entry`): [`AppActivityEntry`](#appactivityentry) \| `null`

Defined in: [src/lib/account/appActivityJournal.ts:59](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/account/appActivityJournal.ts#L59)

#### Parameters

##### entry

###### amountInUnits

`string`

###### completedAtMs?

`number`

###### estimatedOut

`string`

###### tokenIn

`string`

###### tokenOut

`string`

###### txHash?

`string` \| `null`

###### userOpHash?

`string` \| `null`

###### walletAddress

`string`

#### Returns

[`AppActivityEntry`](#appactivityentry) \| `null`

***

### clearAppActivityJournalForTests()

> **clearAppActivityJournalForTests**(): `void`

Defined in: [src/lib/account/appActivityJournal.ts:98](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/account/appActivityJournal.ts#L98)

#### Returns

`void`

***

### readAppActivityJournal()

> **readAppActivityJournal**(`walletAddress`): [`AppActivityEntry`](#appactivityentry)[]

Defined in: [src/lib/account/appActivityJournal.ts:54](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/account/appActivityJournal.ts#L54)

#### Parameters

##### walletAddress

`string` | `null` | `undefined`

#### Returns

[`AppActivityEntry`](#appactivityentry)[]
