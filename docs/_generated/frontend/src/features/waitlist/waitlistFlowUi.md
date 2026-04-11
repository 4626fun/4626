[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/features/waitlist/waitlistFlowUi

# src/features/waitlist/waitlistFlowUi

## Type Aliases

### WaitlistDoneUi

> **WaitlistDoneUi** = `object`

Defined in: [src/features/waitlist/waitlistFlowUi.ts:10](https://github.com/wenakita/4626/blob/main/frontend/src/features/waitlist/waitlistFlowUi.ts#L10)

#### Properties

##### primaryLabel

> **primaryLabel**: `string`

Defined in: [src/features/waitlist/waitlistFlowUi.ts:13](https://github.com/wenakita/4626/blob/main/frontend/src/features/waitlist/waitlistFlowUi.ts#L13)

##### secondaryLabel

> **secondaryLabel**: `string` \| `null`

Defined in: [src/features/waitlist/waitlistFlowUi.ts:14](https://github.com/wenakita/4626/blob/main/frontend/src/features/waitlist/waitlistFlowUi.ts#L14)

##### subtitle

> **subtitle**: `string`

Defined in: [src/features/waitlist/waitlistFlowUi.ts:12](https://github.com/wenakita/4626/blob/main/frontend/src/features/waitlist/waitlistFlowUi.ts#L12)

##### title

> **title**: `string`

Defined in: [src/features/waitlist/waitlistFlowUi.ts:11](https://github.com/wenakita/4626/blob/main/frontend/src/features/waitlist/waitlistFlowUi.ts#L11)

***

### WaitlistEmailUi

> **WaitlistEmailUi** = `object`

Defined in: [src/features/waitlist/waitlistFlowUi.ts:3](https://github.com/wenakita/4626/blob/main/frontend/src/features/waitlist/waitlistFlowUi.ts#L3)

#### Properties

##### busyLabel

> **busyLabel**: `string`

Defined in: [src/features/waitlist/waitlistFlowUi.ts:7](https://github.com/wenakita/4626/blob/main/frontend/src/features/waitlist/waitlistFlowUi.ts#L7)

##### ctaLabel

> **ctaLabel**: `string`

Defined in: [src/features/waitlist/waitlistFlowUi.ts:6](https://github.com/wenakita/4626/blob/main/frontend/src/features/waitlist/waitlistFlowUi.ts#L6)

##### subtitle

> **subtitle**: `string`

Defined in: [src/features/waitlist/waitlistFlowUi.ts:5](https://github.com/wenakita/4626/blob/main/frontend/src/features/waitlist/waitlistFlowUi.ts#L5)

##### title

> **title**: `string`

Defined in: [src/features/waitlist/waitlistFlowUi.ts:4](https://github.com/wenakita/4626/blob/main/frontend/src/features/waitlist/waitlistFlowUi.ts#L4)

## Functions

### canEnterAppFromAccountState()

> **canEnterAppFromAccountState**(`params`): `boolean`

Defined in: [src/features/waitlist/waitlistFlowUi.ts:17](https://github.com/wenakita/4626/blob/main/frontend/src/features/waitlist/waitlistFlowUi.ts#L17)

#### Parameters

##### params

###### appAccessStatus

`string` \| `null`

#### Returns

`boolean`

***

### deriveWaitlistAuthUi()

> **deriveWaitlistAuthUi**(): [`WaitlistEmailUi`](#waitlistemailui)

Defined in: [src/features/waitlist/waitlistFlowUi.ts:22](https://github.com/wenakita/4626/blob/main/frontend/src/features/waitlist/waitlistFlowUi.ts#L22)

#### Returns

[`WaitlistEmailUi`](#waitlistemailui)

***

### deriveWaitlistDoneUi()

> **deriveWaitlistDoneUi**(`canEnterApp`): [`WaitlistDoneUi`](#waitlistdoneui)

Defined in: [src/features/waitlist/waitlistFlowUi.ts:31](https://github.com/wenakita/4626/blob/main/frontend/src/features/waitlist/waitlistFlowUi.ts#L31)

#### Parameters

##### canEnterApp

`boolean`

#### Returns

[`WaitlistDoneUi`](#waitlistdoneui)
