[**4626-web**](../../../../../index.md)

***

[4626-web](../../../../../index.md) / api/\_handlers/deploy/v2/session/\_createCore

# api/\_handlers/deploy/v2/session/\_createCore

## Classes

### DeploySessionRequestError

Defined in: [api/\_handlers/deploy/v2/session/\_createCore.ts:128](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/deploy/v2/session/_createCore.ts#L128)

#### Extends

- `Error`

#### Constructors

##### Constructor

> **new DeploySessionRequestError**(`status`, `message`): [`DeploySessionRequestError`](#deploysessionrequesterror)

Defined in: [api/\_handlers/deploy/v2/session/\_createCore.ts:131](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/deploy/v2/session/_createCore.ts#L131)

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

Defined in: [api/\_handlers/deploy/v2/session/\_createCore.ts:129](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/deploy/v2/session/_createCore.ts#L129)

## Type Aliases

### ApiEnvelope

> **ApiEnvelope**\<`T`\> = `object`

Defined in: [api/\_handlers/deploy/v2/session/\_createCore.ts:68](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/deploy/v2/session/_createCore.ts#L68)

#### Type Parameters

##### T

`T`

#### Properties

##### data?

> `optional` **data**: `T`

Defined in: [api/\_handlers/deploy/v2/session/\_createCore.ts:68](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/deploy/v2/session/_createCore.ts#L68)

##### error?

> `optional` **error**: `string`

Defined in: [api/\_handlers/deploy/v2/session/\_createCore.ts:68](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/deploy/v2/session/_createCore.ts#L68)

##### success

> **success**: `boolean`

Defined in: [api/\_handlers/deploy/v2/session/\_createCore.ts:68](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/deploy/v2/session/_createCore.ts#L68)

***

### Call

> **Call** = `object`

Defined in: [api/\_handlers/deploy/v2/session/\_createCore.ts:71](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/deploy/v2/session/_createCore.ts#L71)

#### Properties

##### data

> **data**: `Hex`

Defined in: [api/\_handlers/deploy/v2/session/\_createCore.ts:71](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/deploy/v2/session/_createCore.ts#L71)

##### to

> **to**: `Address`

Defined in: [api/\_handlers/deploy/v2/session/\_createCore.ts:71](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/deploy/v2/session/_createCore.ts#L71)

##### value?

> `optional` **value**: `bigint` \| `number` \| `string`

Defined in: [api/\_handlers/deploy/v2/session/\_createCore.ts:71](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/deploy/v2/session/_createCore.ts#L71)

***

### CreateDeploySessionRequest

> **CreateDeploySessionRequest** = `object`

Defined in: [api/\_handlers/deploy/v2/session/\_createCore.ts:87](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/deploy/v2/session/_createCore.ts#L87)

#### Properties

##### creatorToken

> **creatorToken**: `Address`

Defined in: [api/\_handlers/deploy/v2/session/\_createCore.ts:89](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/deploy/v2/session/_createCore.ts#L89)

##### expectedPayoutRecipient?

> `optional` **expectedPayoutRecipient**: `Address`

Defined in: [api/\_handlers/deploy/v2/session/\_createCore.ts:111](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/deploy/v2/session/_createCore.ts#L111)

##### expectedPayoutRecipientMode?

> `optional` **expectedPayoutRecipientMode**: `"gauge"` \| `"payout_router"`

Defined in: [api/\_handlers/deploy/v2/session/\_createCore.ts:110](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/deploy/v2/session/_createCore.ts#L110)

##### expectedTradeFeeCollector?

> `optional` **expectedTradeFeeCollector**: `Address`

Defined in: [api/\_handlers/deploy/v2/session/\_createCore.ts:109](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/deploy/v2/session/_createCore.ts#L109)

##### ownerAddress

> **ownerAddress**: `Address`

Defined in: [api/\_handlers/deploy/v2/session/\_createCore.ts:90](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/deploy/v2/session/_createCore.ts#L90)

##### phase1Calls?

> `optional` **phase1Calls**: [`Call`](#call)[]

Defined in: [api/\_handlers/deploy/v2/session/\_createCore.ts:98](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/deploy/v2/session/_createCore.ts#L98)

##### phase2CoreCalls?

> `optional` **phase2CoreCalls**: [`Call`](#call)[]

Defined in: [api/\_handlers/deploy/v2/session/\_createCore.ts:99](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/deploy/v2/session/_createCore.ts#L99)

##### phase2FinalizeCalls?

> `optional` **phase2FinalizeCalls**: [`Call`](#call)[]

Defined in: [api/\_handlers/deploy/v2/session/\_createCore.ts:100](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/deploy/v2/session/_createCore.ts#L100)

##### phase3Calls?

> `optional` **phase3Calls**: [`Call`](#call)[]

Defined in: [api/\_handlers/deploy/v2/session/\_createCore.ts:102](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/deploy/v2/session/_createCore.ts#L102)

##### phase4Calls?

> `optional` **phase4Calls**: [`Call`](#call)[]

Defined in: [api/\_handlers/deploy/v2/session/\_createCore.ts:103](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/deploy/v2/session/_createCore.ts#L103)

##### preflightOnly?

> `optional` **preflightOnly**: `boolean`

Defined in: [api/\_handlers/deploy/v2/session/\_createCore.ts:93](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/deploy/v2/session/_createCore.ts#L93)

##### rolePolicyId?

> `optional` **rolePolicyId**: `number` \| `string`

Defined in: [api/\_handlers/deploy/v2/session/\_createCore.ts:112](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/deploy/v2/session/_createCore.ts#L112)

##### smartWallet

> **smartWallet**: `Address`

Defined in: [api/\_handlers/deploy/v2/session/\_createCore.ts:88](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/deploy/v2/session/_createCore.ts#L88)

##### solanaOvault?

> `optional` **solanaOvault**: `SolanaOvaultRequest`

Defined in: [api/\_handlers/deploy/v2/session/\_createCore.ts:104](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/deploy/v2/session/_createCore.ts#L104)

##### vanity?

> `optional` **vanity**: `DeployVanityRequest`

Defined in: [api/\_handlers/deploy/v2/session/\_createCore.ts:105](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/deploy/v2/session/_createCore.ts#L105)

##### version?

> `optional` **version**: `string`

Defined in: [api/\_handlers/deploy/v2/session/\_createCore.ts:107](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/deploy/v2/session/_createCore.ts#L107)

***

### ValidatedDeploySessionRequest

> **ValidatedDeploySessionRequest** = `object`

Defined in: [api/\_handlers/deploy/v2/session/\_createCore.ts:138](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/deploy/v2/session/_createCore.ts#L138)

#### Properties

##### authType

> **authType**: `"session"` \| `"siwa"`

Defined in: [api/\_handlers/deploy/v2/session/\_createCore.ts:143](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/deploy/v2/session/_createCore.ts#L143)

##### creatorToken

> **creatorToken**: `Address`

Defined in: [api/\_handlers/deploy/v2/session/\_createCore.ts:141](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/deploy/v2/session/_createCore.ts#L141)

##### hasPhase2Finalize

> **hasPhase2Finalize**: `boolean`

Defined in: [api/\_handlers/deploy/v2/session/\_createCore.ts:151](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/deploy/v2/session/_createCore.ts#L151)

##### ownerAddress

> **ownerAddress**: `Address`

Defined in: [api/\_handlers/deploy/v2/session/\_createCore.ts:142](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/deploy/v2/session/_createCore.ts#L142)

##### phase1Calls

> **phase1Calls**: [`Call`](#call)[]

Defined in: [api/\_handlers/deploy/v2/session/\_createCore.ts:144](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/deploy/v2/session/_createCore.ts#L144)

##### phase2CoreCalls

> **phase2CoreCalls**: [`Call`](#call)[]

Defined in: [api/\_handlers/deploy/v2/session/\_createCore.ts:145](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/deploy/v2/session/_createCore.ts#L145)

##### phase2FinalizeCalls

> **phase2FinalizeCalls**: [`Call`](#call)[]

Defined in: [api/\_handlers/deploy/v2/session/\_createCore.ts:146](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/deploy/v2/session/_createCore.ts#L146)

##### phase2InvariantExpectations

> **phase2InvariantExpectations**: `DeployPhase2InvariantExpectations` \| `null`

Defined in: [api/\_handlers/deploy/v2/session/\_createCore.ts:153](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/deploy/v2/session/_createCore.ts#L153)

##### phase3Calls

> **phase3Calls**: [`Call`](#call)[]

Defined in: [api/\_handlers/deploy/v2/session/\_createCore.ts:147](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/deploy/v2/session/_createCore.ts#L147)

##### phase4Calls

> **phase4Calls**: [`Call`](#call)[]

Defined in: [api/\_handlers/deploy/v2/session/\_createCore.ts:148](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/deploy/v2/session/_createCore.ts#L148)

##### rolePolicyId

> **rolePolicyId**: `number` \| `null`

Defined in: [api/\_handlers/deploy/v2/session/\_createCore.ts:154](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/deploy/v2/session/_createCore.ts#L154)

##### rolePolicySource

> **rolePolicySource**: `"request"` \| `"creator_default"` \| `"global_default"` \| `"none"`

Defined in: [api/\_handlers/deploy/v2/session/\_createCore.ts:155](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/deploy/v2/session/_createCore.ts#L155)

##### sessionAddress

> **sessionAddress**: `Address`

Defined in: [api/\_handlers/deploy/v2/session/\_createCore.ts:139](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/deploy/v2/session/_createCore.ts#L139)

##### smartWallet

> **smartWallet**: `Address`

Defined in: [api/\_handlers/deploy/v2/session/\_createCore.ts:140](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/deploy/v2/session/_createCore.ts#L140)

##### solanaOvault

> **solanaOvault**: `Record`\<`string`, `unknown`\> \| `null`

Defined in: [api/\_handlers/deploy/v2/session/\_createCore.ts:149](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/deploy/v2/session/_createCore.ts#L149)

##### vanity

> **vanity**: `object`

Defined in: [api/\_handlers/deploy/v2/session/\_createCore.ts:150](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/deploy/v2/session/_createCore.ts#L150)

###### shareSuffix

> **shareSuffix**: `string` \| `null`

###### vaultPrefix

> **vaultPrefix**: `string` \| `null`

##### version

> **version**: `string`

Defined in: [api/\_handlers/deploy/v2/session/\_createCore.ts:152](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/deploy/v2/session/_createCore.ts#L152)

## Functions

### default()

> **default**(`req`, `res`): `Promise`\<`VercelResponse` \| `undefined`\>

Defined in: [api/\_handlers/deploy/v2/session/\_createCore.ts:3015](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/deploy/v2/session/_createCore.ts#L3015)

#### Parameters

##### req

`VercelRequest`

##### res

`VercelResponse`

#### Returns

`Promise`\<`VercelResponse` \| `undefined`\>

***

### normalizePhase2RolePolicyCalls()

> **normalizePhase2RolePolicyCalls**(`params`): `object`

Defined in: [api/\_handlers/deploy/v2/session/\_createCore.ts:1719](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/deploy/v2/session/_createCore.ts#L1719)

#### Parameters

##### params

###### phase2CoreCalls

[`Call`](#call)[]

###### rolePolicyId

`bigint` \| `null`

#### Returns

`object`

##### phase2CoreCalls

> **phase2CoreCalls**: [`Call`](#call)[]

##### rewrote

> **rewrote**: `boolean`

***

### resolveRolePolicyIdForSession()

> **resolveRolePolicyIdForSession**(`params`): `object`

Defined in: [api/\_handlers/deploy/v2/session/\_createCore.ts:1685](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/deploy/v2/session/_createCore.ts#L1685)

#### Parameters

##### params

###### creatorToken

`string`

###### requestedRolePolicyId

`bigint` \| `null`

#### Returns

`object`

##### rolePolicyId

> **rolePolicyId**: `bigint` \| `null`

##### source

> **source**: `RolePolicySource`

***

### validateDeploySessionRequest()

> **validateDeploySessionRequest**(`params`): `Promise`\<[`ValidatedDeploySessionRequest`](#validateddeploysessionrequest)\>

Defined in: [api/\_handlers/deploy/v2/session/\_createCore.ts:2551](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/deploy/v2/session/_createCore.ts#L2551)

#### Parameters

##### params

###### authAddress

`string`

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

***

### validatePhase2RolePolicyInput()

> **validatePhase2RolePolicyInput**(`params`): `void`

Defined in: [api/\_handlers/deploy/v2/session/\_createCore.ts:1773](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/deploy/v2/session/_createCore.ts#L1773)

#### Parameters

##### params

###### phase2CoreCalls

[`Call`](#call)[]

###### requestedRolePolicyId

`bigint` \| `null`

#### Returns

`void`
