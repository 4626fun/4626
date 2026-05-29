[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/lib/creatorStrategy/usePayWithX402

# src/lib/creatorStrategy/usePayWithX402

## Type Aliases

### PayWithX402Input

> **PayWithX402Input** = `object`

Defined in: [src/lib/creatorStrategy/usePayWithX402.ts:74](https://github.com/wenakita/4626/blob/main/frontend/src/lib/creatorStrategy/usePayWithX402.ts#L74)

#### Properties

##### creatorToken

> **creatorToken**: `Address`

Defined in: [src/lib/creatorStrategy/usePayWithX402.ts:75](https://github.com/wenakita/4626/blob/main/frontend/src/lib/creatorStrategy/usePayWithX402.ts#L75)

##### endpoint?

> `optional` **endpoint**: `string`

Defined in: [src/lib/creatorStrategy/usePayWithX402.ts:78](https://github.com/wenakita/4626/blob/main/frontend/src/lib/creatorStrategy/usePayWithX402.ts#L78)

Defaults to `/api/creator/strategy/x402-activate` at the current origin.

##### featureKey

> **featureKey**: `string`

Defined in: [src/lib/creatorStrategy/usePayWithX402.ts:76](https://github.com/wenakita/4626/blob/main/frontend/src/lib/creatorStrategy/usePayWithX402.ts#L76)

***

### PayWithX402Status

> **PayWithX402Status** = \{ `phase`: `"idle"`; \} \| \{ `phase`: `"requesting_402"`; \} \| \{ `phase`: `"signing"`; \} \| \{ `phase`: `"settling"`; `txHash?`: `Hex`; \} \| \{ `activationId`: `number` \| `null`; `phase`: `"success"`; `txHash`: `Hex`; \} \| \{ `message`: `string`; `phase`: `"error"`; `reason`: `string`; \}

Defined in: [src/lib/creatorStrategy/usePayWithX402.ts:81](https://github.com/wenakita/4626/blob/main/frontend/src/lib/creatorStrategy/usePayWithX402.ts#L81)

***

### X402PaymentRequirements

> **X402PaymentRequirements** = `object`

Defined in: [src/lib/creatorStrategy/usePayWithX402.ts:58](https://github.com/wenakita/4626/blob/main/frontend/src/lib/creatorStrategy/usePayWithX402.ts#L58)

#### Properties

##### accepts

> **accepts**: `object`[]

Defined in: [src/lib/creatorStrategy/usePayWithX402.ts:60](https://github.com/wenakita/4626/blob/main/frontend/src/lib/creatorStrategy/usePayWithX402.ts#L60)

###### asset

> **asset**: `Address`

###### description?

> `optional` **description**: `string`

###### max\_amount\_required

> **max\_amount\_required**: `string`

###### max\_timeout\_seconds

> **max\_timeout\_seconds**: `number`

###### mime\_type

> **mime\_type**: `"application/json"`

###### network

> **network**: `"base"`

###### pay\_to

> **pay\_to**: `Address`

###### resource?

> `optional` **resource**: `string`

###### scheme

> **scheme**: `"exact"`

##### error?

> `optional` **error**: `string`

Defined in: [src/lib/creatorStrategy/usePayWithX402.ts:71](https://github.com/wenakita/4626/blob/main/frontend/src/lib/creatorStrategy/usePayWithX402.ts#L71)

##### x402\_version

> **x402\_version**: `1`

Defined in: [src/lib/creatorStrategy/usePayWithX402.ts:59](https://github.com/wenakita/4626/blob/main/frontend/src/lib/creatorStrategy/usePayWithX402.ts#L59)

## Functions

### usePayWithX402()

> **usePayWithX402**(): `object`

Defined in: [src/lib/creatorStrategy/usePayWithX402.ts:98](https://github.com/wenakita/4626/blob/main/frontend/src/lib/creatorStrategy/usePayWithX402.ts#L98)

#### Returns

`object`

##### pay()

> **pay**: (`input`) => `Promise`\<[`PayWithX402Status`](#paywithx402status)\>

###### Parameters

###### input

[`PayWithX402Input`](#paywithx402input)

###### Returns

`Promise`\<[`PayWithX402Status`](#paywithx402status)\>

##### reset()

> **reset**: () => `void`

###### Returns

`void`

##### status

> **status**: [`PayWithX402Status`](#paywithx402status)
