[**4626-app**](../../../../../index.md)

***

[4626-app](../../../../../index.md) / api/\_handlers/deploy/v2/session/\_createCore

# api/\_handlers/deploy/v2/session/\_createCore

## Classes

### DeploySessionRequestError

Defined in: [api/\_handlers/deploy/v2/session/\_createCore.ts:124](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/v2/session/_createCore.ts#L124)

#### Extends

- `Error`

#### Constructors

##### Constructor

> **new DeploySessionRequestError**(`status`, `message`): [`DeploySessionRequestError`](#deploysessionrequesterror)

Defined in: [api/\_handlers/deploy/v2/session/\_createCore.ts:127](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/v2/session/_createCore.ts#L127)

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

Defined in: [api/\_handlers/deploy/v2/session/\_createCore.ts:125](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/v2/session/_createCore.ts#L125)

## Type Aliases

### ApiEnvelope

> **ApiEnvelope**\<`T`\> = `object`

Defined in: [api/\_handlers/deploy/v2/session/\_createCore.ts:65](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/v2/session/_createCore.ts#L65)

#### Type Parameters

##### T

`T`

#### Properties

##### data?

> `optional` **data**: `T`

Defined in: [api/\_handlers/deploy/v2/session/\_createCore.ts:65](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/v2/session/_createCore.ts#L65)

##### error?

> `optional` **error**: `string`

Defined in: [api/\_handlers/deploy/v2/session/\_createCore.ts:65](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/v2/session/_createCore.ts#L65)

##### success

> **success**: `boolean`

Defined in: [api/\_handlers/deploy/v2/session/\_createCore.ts:65](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/v2/session/_createCore.ts#L65)

***

### Call

> **Call** = `object`

Defined in: [api/\_handlers/deploy/v2/session/\_createCore.ts:68](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/v2/session/_createCore.ts#L68)

#### Properties

##### data

> **data**: `Hex`

Defined in: [api/\_handlers/deploy/v2/session/\_createCore.ts:68](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/v2/session/_createCore.ts#L68)

##### to

> **to**: `Address`

Defined in: [api/\_handlers/deploy/v2/session/\_createCore.ts:68](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/v2/session/_createCore.ts#L68)

##### value?

> `optional` **value**: `bigint` \| `number` \| `string`

Defined in: [api/\_handlers/deploy/v2/session/\_createCore.ts:68](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/v2/session/_createCore.ts#L68)

***

### CreateDeploySessionRequest

> **CreateDeploySessionRequest** = `object`

Defined in: [api/\_handlers/deploy/v2/session/\_createCore.ts:84](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/v2/session/_createCore.ts#L84)

#### Properties

##### creatorToken

> **creatorToken**: `Address`

Defined in: [api/\_handlers/deploy/v2/session/\_createCore.ts:86](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/v2/session/_createCore.ts#L86)

##### expectedPayoutRecipient?

> `optional` **expectedPayoutRecipient**: `Address`

Defined in: [api/\_handlers/deploy/v2/session/\_createCore.ts:108](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/v2/session/_createCore.ts#L108)

##### expectedPayoutRecipientMode?

> `optional` **expectedPayoutRecipientMode**: `"gauge"` \| `"payout_router"`

Defined in: [api/\_handlers/deploy/v2/session/\_createCore.ts:107](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/v2/session/_createCore.ts#L107)

##### expectedTradeFeeCollector?

> `optional` **expectedTradeFeeCollector**: `Address`

Defined in: [api/\_handlers/deploy/v2/session/\_createCore.ts:106](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/v2/session/_createCore.ts#L106)

##### ownerAddress

> **ownerAddress**: `Address`

Defined in: [api/\_handlers/deploy/v2/session/\_createCore.ts:87](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/v2/session/_createCore.ts#L87)

##### phase1Calls?

> `optional` **phase1Calls**: [`Call`](#call)[]

Defined in: [api/\_handlers/deploy/v2/session/\_createCore.ts:95](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/v2/session/_createCore.ts#L95)

##### phase2CoreCalls?

> `optional` **phase2CoreCalls**: [`Call`](#call)[]

Defined in: [api/\_handlers/deploy/v2/session/\_createCore.ts:96](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/v2/session/_createCore.ts#L96)

##### phase2FinalizeCalls?

> `optional` **phase2FinalizeCalls**: [`Call`](#call)[]

Defined in: [api/\_handlers/deploy/v2/session/\_createCore.ts:97](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/v2/session/_createCore.ts#L97)

##### phase3Calls?

> `optional` **phase3Calls**: [`Call`](#call)[]

Defined in: [api/\_handlers/deploy/v2/session/\_createCore.ts:99](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/v2/session/_createCore.ts#L99)

##### phase4Calls?

> `optional` **phase4Calls**: [`Call`](#call)[]

Defined in: [api/\_handlers/deploy/v2/session/\_createCore.ts:100](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/v2/session/_createCore.ts#L100)

##### preflightOnly?

> `optional` **preflightOnly**: `boolean`

Defined in: [api/\_handlers/deploy/v2/session/\_createCore.ts:90](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/v2/session/_createCore.ts#L90)

##### smartWallet

> **smartWallet**: `Address`

Defined in: [api/\_handlers/deploy/v2/session/\_createCore.ts:85](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/v2/session/_createCore.ts#L85)

##### solanaOvault?

> `optional` **solanaOvault**: `SolanaOvaultRequest`

Defined in: [api/\_handlers/deploy/v2/session/\_createCore.ts:101](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/v2/session/_createCore.ts#L101)

##### vanity?

> `optional` **vanity**: `DeployVanityRequest`

Defined in: [api/\_handlers/deploy/v2/session/\_createCore.ts:102](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/v2/session/_createCore.ts#L102)

##### version?

> `optional` **version**: `string`

Defined in: [api/\_handlers/deploy/v2/session/\_createCore.ts:104](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/v2/session/_createCore.ts#L104)

***

### ValidatedDeploySessionRequest

> **ValidatedDeploySessionRequest** = `object`

Defined in: [api/\_handlers/deploy/v2/session/\_createCore.ts:134](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/v2/session/_createCore.ts#L134)

#### Properties

##### authType

> **authType**: `"session"` \| `"siwa"`

Defined in: [api/\_handlers/deploy/v2/session/\_createCore.ts:139](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/v2/session/_createCore.ts#L139)

##### creatorToken

> **creatorToken**: `Address`

Defined in: [api/\_handlers/deploy/v2/session/\_createCore.ts:137](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/v2/session/_createCore.ts#L137)

##### hasPhase2Finalize

> **hasPhase2Finalize**: `boolean`

Defined in: [api/\_handlers/deploy/v2/session/\_createCore.ts:147](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/v2/session/_createCore.ts#L147)

##### ownerAddress

> **ownerAddress**: `Address`

Defined in: [api/\_handlers/deploy/v2/session/\_createCore.ts:138](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/v2/session/_createCore.ts#L138)

##### phase1Calls

> **phase1Calls**: [`Call`](#call)[]

Defined in: [api/\_handlers/deploy/v2/session/\_createCore.ts:140](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/v2/session/_createCore.ts#L140)

##### phase2CoreCalls

> **phase2CoreCalls**: [`Call`](#call)[]

Defined in: [api/\_handlers/deploy/v2/session/\_createCore.ts:141](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/v2/session/_createCore.ts#L141)

##### phase2FinalizeCalls

> **phase2FinalizeCalls**: [`Call`](#call)[]

Defined in: [api/\_handlers/deploy/v2/session/\_createCore.ts:142](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/v2/session/_createCore.ts#L142)

##### phase2InvariantExpectations

> **phase2InvariantExpectations**: `DeployPhase2InvariantExpectations` \| `null`

Defined in: [api/\_handlers/deploy/v2/session/\_createCore.ts:149](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/v2/session/_createCore.ts#L149)

##### phase3Calls

> **phase3Calls**: [`Call`](#call)[]

Defined in: [api/\_handlers/deploy/v2/session/\_createCore.ts:143](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/v2/session/_createCore.ts#L143)

##### phase4Calls

> **phase4Calls**: [`Call`](#call)[]

Defined in: [api/\_handlers/deploy/v2/session/\_createCore.ts:144](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/v2/session/_createCore.ts#L144)

##### sessionAddress

> **sessionAddress**: `Address`

Defined in: [api/\_handlers/deploy/v2/session/\_createCore.ts:135](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/v2/session/_createCore.ts#L135)

##### smartWallet

> **smartWallet**: `Address`

Defined in: [api/\_handlers/deploy/v2/session/\_createCore.ts:136](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/v2/session/_createCore.ts#L136)

##### solanaOvault

> **solanaOvault**: `Record`\<`string`, `unknown`\> \| `null`

Defined in: [api/\_handlers/deploy/v2/session/\_createCore.ts:145](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/v2/session/_createCore.ts#L145)

##### vanity

> **vanity**: `object`

Defined in: [api/\_handlers/deploy/v2/session/\_createCore.ts:146](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/v2/session/_createCore.ts#L146)

###### shareSuffix

> **shareSuffix**: `string` \| `null`

###### vaultPrefix

> **vaultPrefix**: `string` \| `null`

##### version

> **version**: `string`

Defined in: [api/\_handlers/deploy/v2/session/\_createCore.ts:148](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/v2/session/_createCore.ts#L148)

## Functions

### default()

> **default**(`req`, `res`): `Promise`\<`VercelResponse` \| `undefined`\>

Defined in: [api/\_handlers/deploy/v2/session/\_createCore.ts:2590](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/v2/session/_createCore.ts#L2590)

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

Defined in: [api/\_handlers/deploy/v2/session/\_createCore.ts:2210](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/v2/session/_createCore.ts#L2210)

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
