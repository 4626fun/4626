[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/components/waitlist/waitlistFlowUi

# src/components/waitlist/waitlistFlowUi

## Type Aliases

### WaitlistDoneUi

> **WaitlistDoneUi** = `object`

Defined in: [src/components/waitlist/waitlistFlowUi.ts:37](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/waitlist/waitlistFlowUi.ts#L37)

#### Properties

##### primaryLabel

> **primaryLabel**: `string`

Defined in: [src/components/waitlist/waitlistFlowUi.ts:40](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/waitlist/waitlistFlowUi.ts#L40)

##### secondaryLabel

> **secondaryLabel**: `string` \| `null`

Defined in: [src/components/waitlist/waitlistFlowUi.ts:41](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/waitlist/waitlistFlowUi.ts#L41)

##### subtitle

> **subtitle**: `string`

Defined in: [src/components/waitlist/waitlistFlowUi.ts:39](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/waitlist/waitlistFlowUi.ts#L39)

##### title

> **title**: `string`

Defined in: [src/components/waitlist/waitlistFlowUi.ts:38](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/waitlist/waitlistFlowUi.ts#L38)

***

### WaitlistEmailUi

> **WaitlistEmailUi** = `object`

Defined in: [src/components/waitlist/waitlistFlowUi.ts:3](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/waitlist/waitlistFlowUi.ts#L3)

#### Properties

##### busyLabel

> **busyLabel**: `string`

Defined in: [src/components/waitlist/waitlistFlowUi.ts:7](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/waitlist/waitlistFlowUi.ts#L7)

##### ctaLabel

> **ctaLabel**: `string`

Defined in: [src/components/waitlist/waitlistFlowUi.ts:6](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/waitlist/waitlistFlowUi.ts#L6)

##### subtitle

> **subtitle**: `string`

Defined in: [src/components/waitlist/waitlistFlowUi.ts:5](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/waitlist/waitlistFlowUi.ts#L5)

##### title

> **title**: `string`

Defined in: [src/components/waitlist/waitlistFlowUi.ts:4](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/waitlist/waitlistFlowUi.ts#L4)

***

### WaitlistZoraUi

> **WaitlistZoraUi** = `object`

Defined in: [src/components/waitlist/waitlistFlowUi.ts:10](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/waitlist/waitlistFlowUi.ts#L10)

#### Properties

##### connectedLabel

> **connectedLabel**: `string`

Defined in: [src/components/waitlist/waitlistFlowUi.ts:16](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/waitlist/waitlistFlowUi.ts#L16)

##### primaryAction

> **primaryAction**: `"connect"` \| `"finish"`

Defined in: [src/components/waitlist/waitlistFlowUi.ts:12](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/waitlist/waitlistFlowUi.ts#L12)

##### primaryLabel

> **primaryLabel**: `string`

Defined in: [src/components/waitlist/waitlistFlowUi.ts:13](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/waitlist/waitlistFlowUi.ts#L13)

##### resolvingLabel

> **resolvingLabel**: `string`

Defined in: [src/components/waitlist/waitlistFlowUi.ts:17](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/waitlist/waitlistFlowUi.ts#L17)

##### secondaryAction

> **secondaryAction**: `"skip"` \| `"reconnect"`

Defined in: [src/components/waitlist/waitlistFlowUi.ts:14](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/waitlist/waitlistFlowUi.ts#L14)

##### secondaryLabel

> **secondaryLabel**: `string`

Defined in: [src/components/waitlist/waitlistFlowUi.ts:15](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/waitlist/waitlistFlowUi.ts#L15)

##### subtitle

> **subtitle**: `string`

Defined in: [src/components/waitlist/waitlistFlowUi.ts:11](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/waitlist/waitlistFlowUi.ts#L11)

## Functions

### canEnterAppFromAccountState()

> **canEnterAppFromAccountState**(`params`): `boolean`

Defined in: [src/components/waitlist/waitlistFlowUi.ts:44](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/waitlist/waitlistFlowUi.ts#L44)

#### Parameters

##### params

###### appAccessStatus

`string` \| `null`

###### tier

`number`

#### Returns

`boolean`

***

### deriveWaitlistDoneUi()

> **deriveWaitlistDoneUi**(`canEnterApp`): [`WaitlistDoneUi`](#waitlistdoneui)

Defined in: [src/components/waitlist/waitlistFlowUi.ts:92](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/waitlist/waitlistFlowUi.ts#L92)

#### Parameters

##### canEnterApp

`boolean`

#### Returns

[`WaitlistDoneUi`](#waitlistdoneui)

***

### deriveWaitlistEmailUi()

> **deriveWaitlistEmailUi**(`step`): [`WaitlistEmailUi`](#waitlistemailui)

Defined in: [src/components/waitlist/waitlistFlowUi.ts:50](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/waitlist/waitlistFlowUi.ts#L50)

#### Parameters

##### step

`"email"` | `"auth"`

#### Returns

[`WaitlistEmailUi`](#waitlistemailui)

***

### deriveWaitlistZoraUi()

> **deriveWaitlistZoraUi**(`hasLinkedZora`): [`WaitlistZoraUi`](#waitlistzoraui)

Defined in: [src/components/waitlist/waitlistFlowUi.ts:68](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/waitlist/waitlistFlowUi.ts#L68)

#### Parameters

##### hasLinkedZora

`boolean`

#### Returns

[`WaitlistZoraUi`](#waitlistzoraui)

***

### hasZoraProfileSignals()

> **hasZoraProfileSignals**(`summary`): `boolean`

Defined in: [src/components/waitlist/waitlistFlowUi.ts:21](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/waitlist/waitlistFlowUi.ts#L21)

True when resolve/bootstrap returned at least one displayable Zora signal (not merely a non-null placeholder object).

#### Parameters

##### summary

\{ `canonicalCswAddress?`: `string` \| `null`; `creatorCoin?`: \{ `address?`: `string` \| `null`; \} \| `null`; `zoraHandle?`: `string` \| `null`; \} | `null`

#### Returns

`boolean`
