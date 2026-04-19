[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / server/\_lib/agent/erc8004Review

# server/\_lib/agent/erc8004Review

## Type Aliases

### EndpointProbe

> **EndpointProbe** = `object`

Defined in: [server/\_lib/agent/erc8004Review.ts:41](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agent/erc8004Review.ts#L41)

#### Properties

##### checked

> **checked**: `boolean`

Defined in: [server/\_lib/agent/erc8004Review.ts:45](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agent/erc8004Review.ts#L45)

##### contentType

> **contentType**: `string` \| `null`

Defined in: [server/\_lib/agent/erc8004Review.ts:49](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agent/erc8004Review.ts#L49)

##### error

> **error**: `string` \| `null`

Defined in: [server/\_lib/agent/erc8004Review.ts:50](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agent/erc8004Review.ts#L50)

##### finalUrl

> **finalUrl**: `string` \| `null`

Defined in: [server/\_lib/agent/erc8004Review.ts:44](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agent/erc8004Review.ts#L44)

##### ok

> **ok**: `boolean`

Defined in: [server/\_lib/agent/erc8004Review.ts:46](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agent/erc8004Review.ts#L46)

##### responseTimeMs

> **responseTimeMs**: `number` \| `null`

Defined in: [server/\_lib/agent/erc8004Review.ts:48](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agent/erc8004Review.ts#L48)

##### source

> **source**: `"provided"` \| `"registration"` \| `"none"`

Defined in: [server/\_lib/agent/erc8004Review.ts:42](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agent/erc8004Review.ts#L42)

##### status

> **status**: `number` \| `null`

Defined in: [server/\_lib/agent/erc8004Review.ts:47](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agent/erc8004Review.ts#L47)

##### url

> **url**: `string` \| `null`

Defined in: [server/\_lib/agent/erc8004Review.ts:43](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agent/erc8004Review.ts#L43)

***

### Erc8004TechnicalReview

> **Erc8004TechnicalReview** = `object`

Defined in: [server/\_lib/agent/erc8004Review.ts:63](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agent/erc8004Review.ts#L63)

#### Properties

##### agentId

> **agentId**: `number`

Defined in: [server/\_lib/agent/erc8004Review.ts:64](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agent/erc8004Review.ts#L64)

##### checks

> **checks**: `object`[]

Defined in: [server/\_lib/agent/erc8004Review.ts:83](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agent/erc8004Review.ts#L83)

###### detail

> **detail**: `string`

###### id

> **id**: `string`

###### passed

> **passed**: `boolean`

##### endpoint

> **endpoint**: [`EndpointProbe`](#endpointprobe)

Defined in: [server/\_lib/agent/erc8004Review.ts:75](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agent/erc8004Review.ts#L75)

##### generatedAt

> **generatedAt**: `string`

Defined in: [server/\_lib/agent/erc8004Review.ts:95](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agent/erc8004Review.ts#L95)

##### identity

> **identity**: [`IdentitySnapshot`](#identitysnapshot) & `object`

Defined in: [server/\_lib/agent/erc8004Review.ts:66](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agent/erc8004Review.ts#L66)

###### Type Declaration

###### links

> **links**: `object`

###### links.agentWallet

> **agentWallet**: `string` \| `null`

###### links.ownerAddress

> **ownerAddress**: `string` \| `null`

###### links.registry

> **registry**: `string`

###### links.token

> **token**: `string`

##### reasoning

> **reasoning**: `string`

Defined in: [server/\_lib/agent/erc8004Review.ts:94](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agent/erc8004Review.ts#L94)

##### registration

> **registration**: [`RegistrationProbe`](#registrationprobe)

Defined in: [server/\_lib/agent/erc8004Review.ts:74](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agent/erc8004Review.ts#L74)

##### reputation

> **reputation**: `object`

Defined in: [server/\_lib/agent/erc8004Review.ts:76](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agent/erc8004Review.ts#L76)

###### averageValue

> **averageValue**: `string`

###### averageValueDecimals

> **averageValueDecimals**: `number`

###### label

> **label**: `string`

###### totalFeedback

> **totalFeedback**: `number`

###### totalReviewers

> **totalReviewers**: `number`

##### scanUrl

> **scanUrl**: `string`

Defined in: [server/\_lib/agent/erc8004Review.ts:65](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agent/erc8004Review.ts#L65)

##### score

> **score**: `object`

Defined in: [server/\_lib/agent/erc8004Review.ts:88](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agent/erc8004Review.ts#L88)

###### label

> **label**: `string`

###### numericValue

> **numericValue**: `number`

###### value

> **value**: `string`

###### valueDecimals

> **valueDecimals**: `number`

##### source

> **source**: `"erc8004.paid.review.v1"`

Defined in: [server/\_lib/agent/erc8004Review.ts:96](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agent/erc8004Review.ts#L96)

***

### IdentitySnapshot

> **IdentitySnapshot** = `object`

Defined in: [server/\_lib/agent/erc8004Review.ts:53](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agent/erc8004Review.ts#L53)

#### Properties

##### agentRegistered

> **agentRegistered**: `boolean`

Defined in: [server/\_lib/agent/erc8004Review.ts:58](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agent/erc8004Review.ts#L58)

##### agentWallet

> **agentWallet**: `string` \| `null`

Defined in: [server/\_lib/agent/erc8004Review.ts:55](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agent/erc8004Review.ts#L55)

##### chainId

> **chainId**: `number`

Defined in: [server/\_lib/agent/erc8004Review.ts:60](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agent/erc8004Review.ts#L60)

##### ownerAddress

> **ownerAddress**: `string` \| `null`

Defined in: [server/\_lib/agent/erc8004Review.ts:54](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agent/erc8004Review.ts#L54)

##### registryAddress

> **registryAddress**: `Address`

Defined in: [server/\_lib/agent/erc8004Review.ts:59](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agent/erc8004Review.ts#L59)

##### rpcErrorCount

> **rpcErrorCount**: `number`

Defined in: [server/\_lib/agent/erc8004Review.ts:57](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agent/erc8004Review.ts#L57)

##### tokenUri

> **tokenUri**: `string` \| `null`

Defined in: [server/\_lib/agent/erc8004Review.ts:56](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agent/erc8004Review.ts#L56)

***

### RegistrationProbe

> **RegistrationProbe** = `object`

Defined in: [server/\_lib/agent/erc8004Review.ts:27](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agent/erc8004Review.ts#L27)

#### Properties

##### active

> **active**: `boolean` \| `null`

Defined in: [server/\_lib/agent/erc8004Review.ts:35](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agent/erc8004Review.ts#L35)

##### error

> **error**: `string` \| `null`

Defined in: [server/\_lib/agent/erc8004Review.ts:38](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agent/erc8004Review.ts#L38)

##### fetched

> **fetched**: `boolean`

Defined in: [server/\_lib/agent/erc8004Review.ts:31](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agent/erc8004Review.ts#L31)

##### finalUrl

> **finalUrl**: `string` \| `null`

Defined in: [server/\_lib/agent/erc8004Review.ts:30](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agent/erc8004Review.ts#L30)

##### name

> **name**: `string` \| `null`

Defined in: [server/\_lib/agent/erc8004Review.ts:33](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agent/erc8004Review.ts#L33)

##### payload

> **payload**: [`RegistrationFile`](agentRegistration.md#registrationfile) \| `null`

Defined in: [server/\_lib/agent/erc8004Review.ts:37](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agent/erc8004Review.ts#L37)

##### rawUrl

> **rawUrl**: `string` \| `null`

Defined in: [server/\_lib/agent/erc8004Review.ts:29](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agent/erc8004Review.ts#L29)

##### serviceCount

> **serviceCount**: `number`

Defined in: [server/\_lib/agent/erc8004Review.ts:34](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agent/erc8004Review.ts#L34)

##### source

> **source**: `"provided"` \| `"onchain-token-uri"` \| `"none"`

Defined in: [server/\_lib/agent/erc8004Review.ts:28](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agent/erc8004Review.ts#L28)

##### valid

> **valid**: `boolean`

Defined in: [server/\_lib/agent/erc8004Review.ts:32](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agent/erc8004Review.ts#L32)

##### x402Support

> **x402Support**: `boolean` \| `null`

Defined in: [server/\_lib/agent/erc8004Review.ts:36](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agent/erc8004Review.ts#L36)

## Functions

### buildErc8004TechnicalReview()

> **buildErc8004TechnicalReview**(`params`): `Promise`\<[`Erc8004TechnicalReview`](#erc8004technicalreview)\>

Defined in: [server/\_lib/agent/erc8004Review.ts:677](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agent/erc8004Review.ts#L677)

#### Parameters

##### params

###### agentId

`number`

###### endpoint?

`string`

###### registrationUrl?

`string`

#### Returns

`Promise`\<[`Erc8004TechnicalReview`](#erc8004technicalreview)\>

***

### extractCanonicalCsw()

> **extractCanonicalCsw**(`payload`): `string` \| `null`

Defined in: [server/\_lib/agent/erc8004Review.ts:133](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agent/erc8004Review.ts#L133)

#### Parameters

##### payload

[`RegistrationFile`](agentRegistration.md#registrationfile)

#### Returns

`string` \| `null`

***

### fetchRegistrationPayload()

> **fetchRegistrationPayload**(`rawUrl`): `Promise`\<\{ `error`: `string` \| `null`; `fetched`: `boolean`; `finalUrl`: `string` \| `null`; `payload`: [`RegistrationFile`](agentRegistration.md#registrationfile) \| `null`; \}\>

Defined in: [server/\_lib/agent/erc8004Review.ts:320](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agent/erc8004Review.ts#L320)

#### Parameters

##### rawUrl

`string`

#### Returns

`Promise`\<\{ `error`: `string` \| `null`; `fetched`: `boolean`; `finalUrl`: `string` \| `null`; `payload`: [`RegistrationFile`](agentRegistration.md#registrationfile) \| `null`; \}\>

***

### findEndpointFromRegistration()

> **findEndpointFromRegistration**(`payload`): `string` \| `null`

Defined in: [server/\_lib/agent/erc8004Review.ts:489](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agent/erc8004Review.ts#L489)

#### Parameters

##### payload

[`RegistrationFile`](agentRegistration.md#registrationfile) | `null`

#### Returns

`string` \| `null`

***

### probeEndpoint()

> **probeEndpoint**(`rawUrl`): `Promise`\<[`EndpointProbe`](#endpointprobe)\>

Defined in: [server/\_lib/agent/erc8004Review.ts:390](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agent/erc8004Review.ts#L390)

#### Parameters

##### rawUrl

`string`

#### Returns

`Promise`\<[`EndpointProbe`](#endpointprobe)\>

***

### readOnchainSnapshot()

> **readOnchainSnapshot**(`agentId`): `Promise`\<[`IdentitySnapshot`](#identitysnapshot)\>

Defined in: [server/\_lib/agent/erc8004Review.ts:504](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agent/erc8004Review.ts#L504)

#### Parameters

##### agentId

`number`

#### Returns

`Promise`\<[`IdentitySnapshot`](#identitysnapshot)\>
