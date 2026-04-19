[**4626-app**](../../../../index.md)

***

[4626-app](../../../../index.md) / api/\_handlers/deploy/session/\_create

# api/\_handlers/deploy/session/\_create

## Classes

### DeploySessionRequestError

Defined in: [api/\_handlers/deploy/session/\_create.ts:100](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/api/_handlers/deploy/session/_create.ts#L100)

#### Extends

- `Error`

#### Constructors

##### Constructor

> **new DeploySessionRequestError**(`status`, `message`): [`DeploySessionRequestError`](#deploysessionrequesterror)

Defined in: [api/\_handlers/deploy/session/\_create.ts:103](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/api/_handlers/deploy/session/_create.ts#L103)

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

Defined in: [api/\_handlers/deploy/session/\_create.ts:101](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/api/_handlers/deploy/session/_create.ts#L101)

## Type Aliases

### ApiEnvelope

> **ApiEnvelope**\<`T`\> = `object`

Defined in: [api/\_handlers/deploy/session/\_create.ts:47](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/api/_handlers/deploy/session/_create.ts#L47)

#### Type Parameters

##### T

`T`

#### Properties

##### data?

> `optional` **data**: `T`

Defined in: [api/\_handlers/deploy/session/\_create.ts:47](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/api/_handlers/deploy/session/_create.ts#L47)

##### error?

> `optional` **error**: `string`

Defined in: [api/\_handlers/deploy/session/\_create.ts:47](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/api/_handlers/deploy/session/_create.ts#L47)

##### success

> **success**: `boolean`

Defined in: [api/\_handlers/deploy/session/\_create.ts:47](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/api/_handlers/deploy/session/_create.ts#L47)

***

### Call

> **Call** = `object`

Defined in: [api/\_handlers/deploy/session/\_create.ts:50](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/api/_handlers/deploy/session/_create.ts#L50)

#### Properties

##### data

> **data**: `Hex`

Defined in: [api/\_handlers/deploy/session/\_create.ts:50](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/api/_handlers/deploy/session/_create.ts#L50)

##### to

> **to**: `Address`

Defined in: [api/\_handlers/deploy/session/\_create.ts:50](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/api/_handlers/deploy/session/_create.ts#L50)

##### value?

> `optional` **value**: `bigint` \| `number` \| `string`

Defined in: [api/\_handlers/deploy/session/\_create.ts:50](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/api/_handlers/deploy/session/_create.ts#L50)

***

### CreateDeploySessionRequest

> **CreateDeploySessionRequest** = `object`

Defined in: [api/\_handlers/deploy/session/\_create.ts:61](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/api/_handlers/deploy/session/_create.ts#L61)

#### Properties

##### creatorToken

> **creatorToken**: `Address`

Defined in: [api/\_handlers/deploy/session/\_create.ts:63](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/api/_handlers/deploy/session/_create.ts#L63)

##### expectedPayoutRecipient?

> `optional` **expectedPayoutRecipient**: `Address`

Defined in: [api/\_handlers/deploy/session/\_create.ts:84](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/api/_handlers/deploy/session/_create.ts#L84)

##### expectedPayoutRecipientMode?

> `optional` **expectedPayoutRecipientMode**: `"gauge"` \| `"payout_router"`

Defined in: [api/\_handlers/deploy/session/\_create.ts:83](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/api/_handlers/deploy/session/_create.ts#L83)

##### expectedTradeFeeCollector?

> `optional` **expectedTradeFeeCollector**: `Address`

Defined in: [api/\_handlers/deploy/session/\_create.ts:82](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/api/_handlers/deploy/session/_create.ts#L82)

##### ownerAddress

> **ownerAddress**: `Address`

Defined in: [api/\_handlers/deploy/session/\_create.ts:64](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/api/_handlers/deploy/session/_create.ts#L64)

##### phase1Calls?

> `optional` **phase1Calls**: [`Call`](#call)[]

Defined in: [api/\_handlers/deploy/session/\_create.ts:72](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/api/_handlers/deploy/session/_create.ts#L72)

##### phase2CoreCalls?

> `optional` **phase2CoreCalls**: [`Call`](#call)[]

Defined in: [api/\_handlers/deploy/session/\_create.ts:73](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/api/_handlers/deploy/session/_create.ts#L73)

##### phase2FinalizeCalls?

> `optional` **phase2FinalizeCalls**: [`Call`](#call)[]

Defined in: [api/\_handlers/deploy/session/\_create.ts:74](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/api/_handlers/deploy/session/_create.ts#L74)

##### phase3Calls?

> `optional` **phase3Calls**: [`Call`](#call)[]

Defined in: [api/\_handlers/deploy/session/\_create.ts:76](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/api/_handlers/deploy/session/_create.ts#L76)

##### phase4Calls?

> `optional` **phase4Calls**: [`Call`](#call)[]

Defined in: [api/\_handlers/deploy/session/\_create.ts:77](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/api/_handlers/deploy/session/_create.ts#L77)

##### preflightOnly?

> `optional` **preflightOnly**: `boolean`

Defined in: [api/\_handlers/deploy/session/\_create.ts:67](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/api/_handlers/deploy/session/_create.ts#L67)

##### smartWallet

> **smartWallet**: `Address`

Defined in: [api/\_handlers/deploy/session/\_create.ts:62](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/api/_handlers/deploy/session/_create.ts#L62)

##### solanaOvault?

> `optional` **solanaOvault**: `SolanaOvaultRequest`

Defined in: [api/\_handlers/deploy/session/\_create.ts:78](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/api/_handlers/deploy/session/_create.ts#L78)

##### version?

> `optional` **version**: `string`

Defined in: [api/\_handlers/deploy/session/\_create.ts:80](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/api/_handlers/deploy/session/_create.ts#L80)

***

### ValidatedDeploySessionRequest

> **ValidatedDeploySessionRequest** = `object`

Defined in: [api/\_handlers/deploy/session/\_create.ts:110](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/api/_handlers/deploy/session/_create.ts#L110)

#### Properties

##### authType

> **authType**: `"session"` \| `"siwa"`

Defined in: [api/\_handlers/deploy/session/\_create.ts:115](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/api/_handlers/deploy/session/_create.ts#L115)

##### creatorToken

> **creatorToken**: `Address`

Defined in: [api/\_handlers/deploy/session/\_create.ts:113](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/api/_handlers/deploy/session/_create.ts#L113)

##### hasPhase2Finalize

> **hasPhase2Finalize**: `boolean`

Defined in: [api/\_handlers/deploy/session/\_create.ts:122](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/api/_handlers/deploy/session/_create.ts#L122)

##### ownerAddress

> **ownerAddress**: `Address`

Defined in: [api/\_handlers/deploy/session/\_create.ts:114](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/api/_handlers/deploy/session/_create.ts#L114)

##### phase1Calls

> **phase1Calls**: [`Call`](#call)[]

Defined in: [api/\_handlers/deploy/session/\_create.ts:116](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/api/_handlers/deploy/session/_create.ts#L116)

##### phase2CoreCalls

> **phase2CoreCalls**: [`Call`](#call)[]

Defined in: [api/\_handlers/deploy/session/\_create.ts:117](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/api/_handlers/deploy/session/_create.ts#L117)

##### phase2FinalizeCalls

> **phase2FinalizeCalls**: [`Call`](#call)[]

Defined in: [api/\_handlers/deploy/session/\_create.ts:118](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/api/_handlers/deploy/session/_create.ts#L118)

##### phase2InvariantExpectations

> **phase2InvariantExpectations**: `DeployPhase2InvariantExpectations` \| `null`

Defined in: [api/\_handlers/deploy/session/\_create.ts:124](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/api/_handlers/deploy/session/_create.ts#L124)

##### phase3Calls

> **phase3Calls**: [`Call`](#call)[]

Defined in: [api/\_handlers/deploy/session/\_create.ts:119](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/api/_handlers/deploy/session/_create.ts#L119)

##### phase4Calls

> **phase4Calls**: [`Call`](#call)[]

Defined in: [api/\_handlers/deploy/session/\_create.ts:120](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/api/_handlers/deploy/session/_create.ts#L120)

##### sessionAddress

> **sessionAddress**: `Address`

Defined in: [api/\_handlers/deploy/session/\_create.ts:111](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/api/_handlers/deploy/session/_create.ts#L111)

##### smartWallet

> **smartWallet**: `Address`

Defined in: [api/\_handlers/deploy/session/\_create.ts:112](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/api/_handlers/deploy/session/_create.ts#L112)

##### solanaOvault

> **solanaOvault**: `Record`\<`string`, `unknown`\> \| `null`

Defined in: [api/\_handlers/deploy/session/\_create.ts:121](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/api/_handlers/deploy/session/_create.ts#L121)

##### version

> **version**: `string`

Defined in: [api/\_handlers/deploy/session/\_create.ts:123](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/api/_handlers/deploy/session/_create.ts#L123)

## Functions

### default()

> **default**(`req`, `res`): `Promise`\<`VercelResponse` \| `undefined`\>

Defined in: [api/\_handlers/deploy/session/\_create.ts:1231](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/api/_handlers/deploy/session/_create.ts#L1231)

#### Parameters

##### req

`VercelRequest`

##### res

`VercelResponse`

#### Returns

`Promise`\<`VercelResponse` \| `undefined`\>

***

### validateDeploySessionRequest()

> **validateDeploySessionRequest**(`params`): `Promise`\<[`ValidatedDeploySessionRequest`](#validateddeploysessionrequest)\>

Defined in: [api/\_handlers/deploy/session/\_create.ts:1009](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/api/_handlers/deploy/session/_create.ts#L1009)

#### Parameters

##### params

###### authAddress

`` `0x${string}` ``

###### authType

`"session"` \| `"siwa"`

###### body

[`CreateDeploySessionRequest`](#createdeploysessionrequest)

###### req

`VercelRequest`

###### requireCalls

`boolean`

#### Returns

`Promise`\<[`ValidatedDeploySessionRequest`](#validateddeploysessionrequest)\>
