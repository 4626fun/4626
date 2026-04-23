[**4626-app**](../../../../index.md)

***

[4626-app](../../../../index.md) / api/\_handlers/deploy/session/\_create

# api/\_handlers/deploy/session/\_create

## Classes

### DeploySessionRequestError

Defined in: [api/\_handlers/deploy/session/\_create.ts:113](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/session/_create.ts#L113)

#### Extends

- `Error`

#### Constructors

##### Constructor

> **new DeploySessionRequestError**(`status`, `message`): [`DeploySessionRequestError`](#deploysessionrequesterror)

Defined in: [api/\_handlers/deploy/session/\_create.ts:116](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/session/_create.ts#L116)

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

Defined in: [api/\_handlers/deploy/session/\_create.ts:114](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/session/_create.ts#L114)

## Type Aliases

### ApiEnvelope

> **ApiEnvelope**\<`T`\> = `object`

Defined in: [api/\_handlers/deploy/session/\_create.ts:54](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/session/_create.ts#L54)

#### Type Parameters

##### T

`T`

#### Properties

##### data?

> `optional` **data**: `T`

Defined in: [api/\_handlers/deploy/session/\_create.ts:54](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/session/_create.ts#L54)

##### error?

> `optional` **error**: `string`

Defined in: [api/\_handlers/deploy/session/\_create.ts:54](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/session/_create.ts#L54)

##### success

> **success**: `boolean`

Defined in: [api/\_handlers/deploy/session/\_create.ts:54](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/session/_create.ts#L54)

***

### Call

> **Call** = `object`

Defined in: [api/\_handlers/deploy/session/\_create.ts:57](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/session/_create.ts#L57)

#### Properties

##### data

> **data**: `Hex`

Defined in: [api/\_handlers/deploy/session/\_create.ts:57](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/session/_create.ts#L57)

##### to

> **to**: `Address`

Defined in: [api/\_handlers/deploy/session/\_create.ts:57](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/session/_create.ts#L57)

##### value?

> `optional` **value**: `bigint` \| `number` \| `string`

Defined in: [api/\_handlers/deploy/session/\_create.ts:57](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/session/_create.ts#L57)

***

### CreateDeploySessionRequest

> **CreateDeploySessionRequest** = `object`

Defined in: [api/\_handlers/deploy/session/\_create.ts:73](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/session/_create.ts#L73)

#### Properties

##### creatorToken

> **creatorToken**: `Address`

Defined in: [api/\_handlers/deploy/session/\_create.ts:75](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/session/_create.ts#L75)

##### expectedPayoutRecipient?

> `optional` **expectedPayoutRecipient**: `Address`

Defined in: [api/\_handlers/deploy/session/\_create.ts:97](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/session/_create.ts#L97)

##### expectedPayoutRecipientMode?

> `optional` **expectedPayoutRecipientMode**: `"gauge"` \| `"payout_router"`

Defined in: [api/\_handlers/deploy/session/\_create.ts:96](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/session/_create.ts#L96)

##### expectedTradeFeeCollector?

> `optional` **expectedTradeFeeCollector**: `Address`

Defined in: [api/\_handlers/deploy/session/\_create.ts:95](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/session/_create.ts#L95)

##### ownerAddress

> **ownerAddress**: `Address`

Defined in: [api/\_handlers/deploy/session/\_create.ts:76](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/session/_create.ts#L76)

##### phase1Calls?

> `optional` **phase1Calls**: [`Call`](#call)[]

Defined in: [api/\_handlers/deploy/session/\_create.ts:84](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/session/_create.ts#L84)

##### phase2CoreCalls?

> `optional` **phase2CoreCalls**: [`Call`](#call)[]

Defined in: [api/\_handlers/deploy/session/\_create.ts:85](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/session/_create.ts#L85)

##### phase2FinalizeCalls?

> `optional` **phase2FinalizeCalls**: [`Call`](#call)[]

Defined in: [api/\_handlers/deploy/session/\_create.ts:86](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/session/_create.ts#L86)

##### phase3Calls?

> `optional` **phase3Calls**: [`Call`](#call)[]

Defined in: [api/\_handlers/deploy/session/\_create.ts:88](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/session/_create.ts#L88)

##### phase4Calls?

> `optional` **phase4Calls**: [`Call`](#call)[]

Defined in: [api/\_handlers/deploy/session/\_create.ts:89](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/session/_create.ts#L89)

##### preflightOnly?

> `optional` **preflightOnly**: `boolean`

Defined in: [api/\_handlers/deploy/session/\_create.ts:79](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/session/_create.ts#L79)

##### smartWallet

> **smartWallet**: `Address`

Defined in: [api/\_handlers/deploy/session/\_create.ts:74](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/session/_create.ts#L74)

##### solanaOvault?

> `optional` **solanaOvault**: `SolanaOvaultRequest`

Defined in: [api/\_handlers/deploy/session/\_create.ts:90](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/session/_create.ts#L90)

##### vanity?

> `optional` **vanity**: `DeployVanityRequest`

Defined in: [api/\_handlers/deploy/session/\_create.ts:91](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/session/_create.ts#L91)

##### version?

> `optional` **version**: `string`

Defined in: [api/\_handlers/deploy/session/\_create.ts:93](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/session/_create.ts#L93)

***

### ValidatedDeploySessionRequest

> **ValidatedDeploySessionRequest** = `object`

Defined in: [api/\_handlers/deploy/session/\_create.ts:123](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/session/_create.ts#L123)

#### Properties

##### authType

> **authType**: `"session"` \| `"siwa"`

Defined in: [api/\_handlers/deploy/session/\_create.ts:128](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/session/_create.ts#L128)

##### creatorToken

> **creatorToken**: `Address`

Defined in: [api/\_handlers/deploy/session/\_create.ts:126](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/session/_create.ts#L126)

##### hasPhase2Finalize

> **hasPhase2Finalize**: `boolean`

Defined in: [api/\_handlers/deploy/session/\_create.ts:136](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/session/_create.ts#L136)

##### ownerAddress

> **ownerAddress**: `Address`

Defined in: [api/\_handlers/deploy/session/\_create.ts:127](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/session/_create.ts#L127)

##### phase1Calls

> **phase1Calls**: [`Call`](#call)[]

Defined in: [api/\_handlers/deploy/session/\_create.ts:129](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/session/_create.ts#L129)

##### phase2CoreCalls

> **phase2CoreCalls**: [`Call`](#call)[]

Defined in: [api/\_handlers/deploy/session/\_create.ts:130](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/session/_create.ts#L130)

##### phase2FinalizeCalls

> **phase2FinalizeCalls**: [`Call`](#call)[]

Defined in: [api/\_handlers/deploy/session/\_create.ts:131](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/session/_create.ts#L131)

##### phase2InvariantExpectations

> **phase2InvariantExpectations**: `DeployPhase2InvariantExpectations` \| `null`

Defined in: [api/\_handlers/deploy/session/\_create.ts:138](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/session/_create.ts#L138)

##### phase3Calls

> **phase3Calls**: [`Call`](#call)[]

Defined in: [api/\_handlers/deploy/session/\_create.ts:132](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/session/_create.ts#L132)

##### phase4Calls

> **phase4Calls**: [`Call`](#call)[]

Defined in: [api/\_handlers/deploy/session/\_create.ts:133](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/session/_create.ts#L133)

##### sessionAddress

> **sessionAddress**: `Address`

Defined in: [api/\_handlers/deploy/session/\_create.ts:124](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/session/_create.ts#L124)

##### smartWallet

> **smartWallet**: `Address`

Defined in: [api/\_handlers/deploy/session/\_create.ts:125](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/session/_create.ts#L125)

##### solanaOvault

> **solanaOvault**: `Record`\<`string`, `unknown`\> \| `null`

Defined in: [api/\_handlers/deploy/session/\_create.ts:134](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/session/_create.ts#L134)

##### vanity

> **vanity**: `object`

Defined in: [api/\_handlers/deploy/session/\_create.ts:135](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/session/_create.ts#L135)

###### shareSuffix

> **shareSuffix**: `string` \| `null`

###### vaultPrefix

> **vaultPrefix**: `string` \| `null`

##### version

> **version**: `string`

Defined in: [api/\_handlers/deploy/session/\_create.ts:137](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/session/_create.ts#L137)

## Functions

### default()

> **default**(`req`, `res`): `Promise`\<`VercelResponse` \| `undefined`\>

Defined in: [api/\_handlers/deploy/session/\_create.ts:1436](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/session/_create.ts#L1436)

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

Defined in: [api/\_handlers/deploy/session/\_create.ts:1133](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/session/_create.ts#L1133)

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
