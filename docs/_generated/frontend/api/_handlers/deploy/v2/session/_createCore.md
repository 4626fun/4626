[**4626-web**](../../../../../index.md)

***

[4626-web](../../../../../index.md) / api/\_handlers/deploy/v2/session/\_createCore

# api/\_handlers/deploy/v2/session/\_createCore

## Classes

### DeploySessionRequestError

Defined in: [api/\_handlers/deploy/v2/session/\_createCore.ts:133](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/v2/session/_createCore.ts#L133)

#### Extends

- `Error`

#### Constructors

##### Constructor

> **new DeploySessionRequestError**(`status`, `message`): [`DeploySessionRequestError`](#deploysessionrequesterror)

Defined in: [api/\_handlers/deploy/v2/session/\_createCore.ts:136](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/v2/session/_createCore.ts#L136)

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

Defined in: [api/\_handlers/deploy/v2/session/\_createCore.ts:134](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/v2/session/_createCore.ts#L134)

## Type Aliases

### ApiEnvelope

> **ApiEnvelope**\<`T`\> = `object`

Defined in: [api/\_handlers/deploy/v2/session/\_createCore.ts:73](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/v2/session/_createCore.ts#L73)

#### Type Parameters

##### T

`T`

#### Properties

##### data?

> `optional` **data**: `T`

Defined in: [api/\_handlers/deploy/v2/session/\_createCore.ts:73](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/v2/session/_createCore.ts#L73)

##### error?

> `optional` **error**: `string`

Defined in: [api/\_handlers/deploy/v2/session/\_createCore.ts:73](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/v2/session/_createCore.ts#L73)

##### success

> **success**: `boolean`

Defined in: [api/\_handlers/deploy/v2/session/\_createCore.ts:73](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/v2/session/_createCore.ts#L73)

***

### Call

> **Call** = `object`

Defined in: [api/\_handlers/deploy/v2/session/\_createCore.ts:76](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/v2/session/_createCore.ts#L76)

#### Properties

##### data

> **data**: `Hex`

Defined in: [api/\_handlers/deploy/v2/session/\_createCore.ts:76](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/v2/session/_createCore.ts#L76)

##### to

> **to**: `Address`

Defined in: [api/\_handlers/deploy/v2/session/\_createCore.ts:76](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/v2/session/_createCore.ts#L76)

##### value?

> `optional` **value**: `bigint` \| `number` \| `string`

Defined in: [api/\_handlers/deploy/v2/session/\_createCore.ts:76](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/v2/session/_createCore.ts#L76)

***

### CreateDeploySessionRequest

> **CreateDeploySessionRequest** = `object`

Defined in: [api/\_handlers/deploy/v2/session/\_createCore.ts:92](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/v2/session/_createCore.ts#L92)

#### Properties

##### creatorToken

> **creatorToken**: `Address`

Defined in: [api/\_handlers/deploy/v2/session/\_createCore.ts:94](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/v2/session/_createCore.ts#L94)

##### expectedPayoutRecipient?

> `optional` **expectedPayoutRecipient**: `Address`

Defined in: [api/\_handlers/deploy/v2/session/\_createCore.ts:116](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/v2/session/_createCore.ts#L116)

##### expectedPayoutRecipientMode?

> `optional` **expectedPayoutRecipientMode**: `"gauge"` \| `"payout_router"`

Defined in: [api/\_handlers/deploy/v2/session/\_createCore.ts:115](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/v2/session/_createCore.ts#L115)

##### expectedTradeFeeCollector?

> `optional` **expectedTradeFeeCollector**: `Address`

Defined in: [api/\_handlers/deploy/v2/session/\_createCore.ts:114](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/v2/session/_createCore.ts#L114)

##### ownerAddress

> **ownerAddress**: `Address`

Defined in: [api/\_handlers/deploy/v2/session/\_createCore.ts:95](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/v2/session/_createCore.ts#L95)

##### phase1Calls?

> `optional` **phase1Calls**: [`Call`](#call)[]

Defined in: [api/\_handlers/deploy/v2/session/\_createCore.ts:103](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/v2/session/_createCore.ts#L103)

##### phase2CoreCalls?

> `optional` **phase2CoreCalls**: [`Call`](#call)[]

Defined in: [api/\_handlers/deploy/v2/session/\_createCore.ts:104](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/v2/session/_createCore.ts#L104)

##### phase2FinalizeCalls?

> `optional` **phase2FinalizeCalls**: [`Call`](#call)[]

Defined in: [api/\_handlers/deploy/v2/session/\_createCore.ts:105](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/v2/session/_createCore.ts#L105)

##### phase3Calls?

> `optional` **phase3Calls**: [`Call`](#call)[]

Defined in: [api/\_handlers/deploy/v2/session/\_createCore.ts:107](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/v2/session/_createCore.ts#L107)

##### phase4Calls?

> `optional` **phase4Calls**: [`Call`](#call)[]

Defined in: [api/\_handlers/deploy/v2/session/\_createCore.ts:108](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/v2/session/_createCore.ts#L108)

##### preflightOnly?

> `optional` **preflightOnly**: `boolean`

Defined in: [api/\_handlers/deploy/v2/session/\_createCore.ts:98](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/v2/session/_createCore.ts#L98)

##### rolePolicyId?

> `optional` **rolePolicyId**: `number` \| `string`

Defined in: [api/\_handlers/deploy/v2/session/\_createCore.ts:117](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/v2/session/_createCore.ts#L117)

##### smartWallet

> **smartWallet**: `Address`

Defined in: [api/\_handlers/deploy/v2/session/\_createCore.ts:93](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/v2/session/_createCore.ts#L93)

##### solanaOvault?

> `optional` **solanaOvault**: `SolanaOvaultRequest`

Defined in: [api/\_handlers/deploy/v2/session/\_createCore.ts:109](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/v2/session/_createCore.ts#L109)

##### vanity?

> `optional` **vanity**: `DeployVanityRequest`

Defined in: [api/\_handlers/deploy/v2/session/\_createCore.ts:110](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/v2/session/_createCore.ts#L110)

##### version?

> `optional` **version**: `string`

Defined in: [api/\_handlers/deploy/v2/session/\_createCore.ts:112](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/v2/session/_createCore.ts#L112)

***

### ValidatedDeploySessionRequest

> **ValidatedDeploySessionRequest** = `object`

Defined in: [api/\_handlers/deploy/v2/session/\_createCore.ts:143](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/v2/session/_createCore.ts#L143)

#### Properties

##### authType

> **authType**: `"session"` \| `"siwa"`

Defined in: [api/\_handlers/deploy/v2/session/\_createCore.ts:148](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/v2/session/_createCore.ts#L148)

##### creatorToken

> **creatorToken**: `Address`

Defined in: [api/\_handlers/deploy/v2/session/\_createCore.ts:146](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/v2/session/_createCore.ts#L146)

##### hasPhase2Finalize

> **hasPhase2Finalize**: `boolean`

Defined in: [api/\_handlers/deploy/v2/session/\_createCore.ts:156](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/v2/session/_createCore.ts#L156)

##### ownerAddress

> **ownerAddress**: `Address`

Defined in: [api/\_handlers/deploy/v2/session/\_createCore.ts:147](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/v2/session/_createCore.ts#L147)

##### phase1Calls

> **phase1Calls**: [`Call`](#call)[]

Defined in: [api/\_handlers/deploy/v2/session/\_createCore.ts:149](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/v2/session/_createCore.ts#L149)

##### phase2CoreCalls

> **phase2CoreCalls**: [`Call`](#call)[]

Defined in: [api/\_handlers/deploy/v2/session/\_createCore.ts:150](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/v2/session/_createCore.ts#L150)

##### phase2FinalizeCalls

> **phase2FinalizeCalls**: [`Call`](#call)[]

Defined in: [api/\_handlers/deploy/v2/session/\_createCore.ts:151](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/v2/session/_createCore.ts#L151)

##### phase2InvariantExpectations

> **phase2InvariantExpectations**: `DeployPhase2InvariantExpectations` \| `null`

Defined in: [api/\_handlers/deploy/v2/session/\_createCore.ts:158](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/v2/session/_createCore.ts#L158)

##### phase3Calls

> **phase3Calls**: [`Call`](#call)[]

Defined in: [api/\_handlers/deploy/v2/session/\_createCore.ts:152](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/v2/session/_createCore.ts#L152)

##### phase4Calls

> **phase4Calls**: [`Call`](#call)[]

Defined in: [api/\_handlers/deploy/v2/session/\_createCore.ts:153](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/v2/session/_createCore.ts#L153)

##### rolePolicyId

> **rolePolicyId**: `number` \| `null`

Defined in: [api/\_handlers/deploy/v2/session/\_createCore.ts:159](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/v2/session/_createCore.ts#L159)

##### rolePolicySource

> **rolePolicySource**: `"request"` \| `"creator_default"` \| `"global_default"` \| `"none"`

Defined in: [api/\_handlers/deploy/v2/session/\_createCore.ts:160](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/v2/session/_createCore.ts#L160)

##### sessionAddress

> **sessionAddress**: `Address`

Defined in: [api/\_handlers/deploy/v2/session/\_createCore.ts:144](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/v2/session/_createCore.ts#L144)

##### smartWallet

> **smartWallet**: `Address`

Defined in: [api/\_handlers/deploy/v2/session/\_createCore.ts:145](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/v2/session/_createCore.ts#L145)

##### solanaOvault

> **solanaOvault**: `Record`\<`string`, `unknown`\> \| `null`

Defined in: [api/\_handlers/deploy/v2/session/\_createCore.ts:154](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/v2/session/_createCore.ts#L154)

##### vanity

> **vanity**: `object`

Defined in: [api/\_handlers/deploy/v2/session/\_createCore.ts:155](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/v2/session/_createCore.ts#L155)

###### shareSuffix

> **shareSuffix**: `string` \| `null`

###### vaultPrefix

> **vaultPrefix**: `string` \| `null`

##### version

> **version**: `string`

Defined in: [api/\_handlers/deploy/v2/session/\_createCore.ts:157](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/v2/session/_createCore.ts#L157)

## Functions

### default()

> **default**(`req`, `res`): `Promise`\<`VercelResponse` \| `undefined`\>

Defined in: [api/\_handlers/deploy/v2/session/\_createCore.ts:3006](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/v2/session/_createCore.ts#L3006)

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

Defined in: [api/\_handlers/deploy/v2/session/\_createCore.ts:1710](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/v2/session/_createCore.ts#L1710)

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

Defined in: [api/\_handlers/deploy/v2/session/\_createCore.ts:1676](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/v2/session/_createCore.ts#L1676)

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

Defined in: [api/\_handlers/deploy/v2/session/\_createCore.ts:2542](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/v2/session/_createCore.ts#L2542)

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

Defined in: [api/\_handlers/deploy/v2/session/\_createCore.ts:1764](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/deploy/v2/session/_createCore.ts#L1764)

#### Parameters

##### params

###### phase2CoreCalls

[`Call`](#call)[]

###### requestedRolePolicyId

`bigint` \| `null`

#### Returns

`void`
