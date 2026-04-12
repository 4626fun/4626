[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/features/waitlist/waitlistHandoff

# src/features/waitlist/waitlistHandoff

## Type Aliases

### HandoffCreateResponse

> **HandoffCreateResponse** = `object`

Defined in: [src/features/waitlist/waitlistHandoff.ts:10](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/features/waitlist/waitlistHandoff.ts#L10)

#### Properties

##### code

> **code**: `string`

Defined in: [src/features/waitlist/waitlistHandoff.ts:11](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/features/waitlist/waitlistHandoff.ts#L11)

##### expiresAt

> **expiresAt**: `string`

Defined in: [src/features/waitlist/waitlistHandoff.ts:12](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/features/waitlist/waitlistHandoff.ts#L12)

***

### PrivyAuthSessionResponse

> **PrivyAuthSessionResponse** = `object`

Defined in: [src/features/waitlist/waitlistHandoff.ts:4](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/features/waitlist/waitlistHandoff.ts#L4)

#### Properties

##### address

> **address**: `string`

Defined in: [src/features/waitlist/waitlistHandoff.ts:5](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/features/waitlist/waitlistHandoff.ts#L5)

##### privyUserId?

> `optional` **privyUserId**: `string`

Defined in: [src/features/waitlist/waitlistHandoff.ts:7](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/features/waitlist/waitlistHandoff.ts#L7)

##### sessionToken

> **sessionToken**: `string`

Defined in: [src/features/waitlist/waitlistHandoff.ts:6](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/features/waitlist/waitlistHandoff.ts#L6)

## Functions

### bridgePrivySession()

> **bridgePrivySession**(`privyToken`): `Promise`\<`string` \| `null`\>

Defined in: [src/features/waitlist/waitlistHandoff.ts:21](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/features/waitlist/waitlistHandoff.ts#L21)

#### Parameters

##### privyToken

`string` | `null`

#### Returns

`Promise`\<`string` \| `null`\>

***

### createAuthHandoffCode()

> **createAuthHandoffCode**(`params`): `Promise`\<`string`\>

Defined in: [src/features/waitlist/waitlistHandoff.ts:41](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/features/waitlist/waitlistHandoff.ts#L41)

#### Parameters

##### params

###### privyToken

`string` \| `null`

###### sessionToken

`string` \| `null`

#### Returns

`Promise`\<`string`\>
