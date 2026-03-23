[**4626-app**](../../../../index.md)

***

[4626-app](../../../../index.md) / api/\_handlers/deploy/session/\_create

# api/\_handlers/deploy/session/\_create

## Classes

### DeploySessionRequestError

Defined in: [api/\_handlers/deploy/session/\_create.ts:80](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/session/_create.ts#L80)

#### Extends

- `Error`

#### Constructors

##### Constructor

> **new DeploySessionRequestError**(`status`, `message`): [`DeploySessionRequestError`](#deploysessionrequesterror)

Defined in: [api/\_handlers/deploy/session/\_create.ts:83](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/session/_create.ts#L83)

###### Parameters

###### status

`number`

###### message

`string`

###### Returns

[`DeploySessionRequestError`](#deploysessionrequesterror)

###### Overrides

`Error.constructor`

#### Properties

##### status

> **status**: `number`

Defined in: [api/\_handlers/deploy/session/\_create.ts:81](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/session/_create.ts#L81)

## Type Aliases

### ApiEnvelope

> **ApiEnvelope**\<`T`\> = `object`

Defined in: [api/\_handlers/deploy/session/\_create.ts:37](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/session/_create.ts#L37)

#### Type Parameters

##### T

`T`

#### Properties

##### data?

> `optional` **data**: `T`

Defined in: [api/\_handlers/deploy/session/\_create.ts:37](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/session/_create.ts#L37)

##### error?

> `optional` **error**: `string`

Defined in: [api/\_handlers/deploy/session/\_create.ts:37](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/session/_create.ts#L37)

##### success

> **success**: `boolean`

Defined in: [api/\_handlers/deploy/session/\_create.ts:37](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/session/_create.ts#L37)

***

### Call

> **Call** = `object`

Defined in: [api/\_handlers/deploy/session/\_create.ts:40](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/session/_create.ts#L40)

#### Properties

##### data

> **data**: `Hex`

Defined in: [api/\_handlers/deploy/session/\_create.ts:40](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/session/_create.ts#L40)

##### to

> **to**: `Address`

Defined in: [api/\_handlers/deploy/session/\_create.ts:40](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/session/_create.ts#L40)

##### value?

> `optional` **value**: `bigint` \| `number` \| `string`

Defined in: [api/\_handlers/deploy/session/\_create.ts:40](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/session/_create.ts#L40)

***

### CreateDeploySessionRequest

> **CreateDeploySessionRequest** = `object`

Defined in: [api/\_handlers/deploy/session/\_create.ts:51](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/session/_create.ts#L51)

#### Properties

##### creatorToken

> **creatorToken**: `Address`

Defined in: [api/\_handlers/deploy/session/\_create.ts:53](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/session/_create.ts#L53)

##### ownerAddress

> **ownerAddress**: `Address`

Defined in: [api/\_handlers/deploy/session/\_create.ts:54](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/session/_create.ts#L54)

##### phase1Calls?

> `optional` **phase1Calls**: [`Call`](#call)[]

Defined in: [api/\_handlers/deploy/session/\_create.ts:62](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/session/_create.ts#L62)

##### phase2CoreCalls?

> `optional` **phase2CoreCalls**: [`Call`](#call)[]

Defined in: [api/\_handlers/deploy/session/\_create.ts:63](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/session/_create.ts#L63)

##### phase2FinalizeCalls?

> `optional` **phase2FinalizeCalls**: [`Call`](#call)[]

Defined in: [api/\_handlers/deploy/session/\_create.ts:64](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/session/_create.ts#L64)

##### phase3Calls?

> `optional` **phase3Calls**: [`Call`](#call)[]

Defined in: [api/\_handlers/deploy/session/\_create.ts:66](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/session/_create.ts#L66)

##### phase4Calls?

> `optional` **phase4Calls**: [`Call`](#call)[]

Defined in: [api/\_handlers/deploy/session/\_create.ts:67](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/session/_create.ts#L67)

##### preflightOnly?

> `optional` **preflightOnly**: `boolean`

Defined in: [api/\_handlers/deploy/session/\_create.ts:57](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/session/_create.ts#L57)

##### smartWallet

> **smartWallet**: `Address`

Defined in: [api/\_handlers/deploy/session/\_create.ts:52](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/session/_create.ts#L52)

##### solanaOvault?

> `optional` **solanaOvault**: `SolanaOvaultRequest`

Defined in: [api/\_handlers/deploy/session/\_create.ts:68](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/session/_create.ts#L68)

##### version?

> `optional` **version**: `string`

Defined in: [api/\_handlers/deploy/session/\_create.ts:70](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/session/_create.ts#L70)

***

### ValidatedDeploySessionRequest

> **ValidatedDeploySessionRequest** = `object`

Defined in: [api/\_handlers/deploy/session/\_create.ts:90](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/session/_create.ts#L90)

#### Properties

##### authType

> **authType**: `"session"` \| `"siwa"`

Defined in: [api/\_handlers/deploy/session/\_create.ts:95](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/session/_create.ts#L95)

##### creatorToken

> **creatorToken**: `Address`

Defined in: [api/\_handlers/deploy/session/\_create.ts:93](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/session/_create.ts#L93)

##### hasPhase2Finalize

> **hasPhase2Finalize**: `boolean`

Defined in: [api/\_handlers/deploy/session/\_create.ts:102](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/session/_create.ts#L102)

##### ownerAddress

> **ownerAddress**: `Address`

Defined in: [api/\_handlers/deploy/session/\_create.ts:94](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/session/_create.ts#L94)

##### phase1Calls

> **phase1Calls**: [`Call`](#call)[]

Defined in: [api/\_handlers/deploy/session/\_create.ts:96](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/session/_create.ts#L96)

##### phase2CoreCalls

> **phase2CoreCalls**: [`Call`](#call)[]

Defined in: [api/\_handlers/deploy/session/\_create.ts:97](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/session/_create.ts#L97)

##### phase2FinalizeCalls

> **phase2FinalizeCalls**: [`Call`](#call)[]

Defined in: [api/\_handlers/deploy/session/\_create.ts:98](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/session/_create.ts#L98)

##### phase3Calls

> **phase3Calls**: [`Call`](#call)[]

Defined in: [api/\_handlers/deploy/session/\_create.ts:99](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/session/_create.ts#L99)

##### phase4Calls

> **phase4Calls**: [`Call`](#call)[]

Defined in: [api/\_handlers/deploy/session/\_create.ts:100](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/session/_create.ts#L100)

##### sessionAddress

> **sessionAddress**: `Address`

Defined in: [api/\_handlers/deploy/session/\_create.ts:91](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/session/_create.ts#L91)

##### smartWallet

> **smartWallet**: `Address`

Defined in: [api/\_handlers/deploy/session/\_create.ts:92](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/session/_create.ts#L92)

##### solanaOvault

> **solanaOvault**: `Record`\<`string`, `unknown`\> \| `null`

Defined in: [api/\_handlers/deploy/session/\_create.ts:101](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/session/_create.ts#L101)

##### version

> **version**: `string`

Defined in: [api/\_handlers/deploy/session/\_create.ts:103](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/session/_create.ts#L103)

## Functions

### default()

> **default**(`req`, `res`): `Promise`\<`any`\>

Defined in: [api/\_handlers/deploy/session/\_create.ts:1085](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/session/_create.ts#L1085)

#### Parameters

##### req

`any`

##### res

`any`

#### Returns

`Promise`\<`any`\>

***

### validateDeploySessionRequest()

> **validateDeploySessionRequest**(`params`): `Promise`\<[`ValidatedDeploySessionRequest`](#validateddeploysessionrequest)\>

Defined in: [api/\_handlers/deploy/session/\_create.ts:900](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/session/_create.ts#L900)

#### Parameters

##### params

###### authAddress

`` `0x${string}` ``

###### authType

`"session"` \| `"siwa"`

###### body

[`CreateDeploySessionRequest`](#createdeploysessionrequest)

###### req

`any`

###### requireCalls

`boolean`

#### Returns

`Promise`\<[`ValidatedDeploySessionRequest`](#validateddeploysessionrequest)\>
