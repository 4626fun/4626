[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / api/\_handlers/paymaster/\_paymaster

# api/\_handlers/paymaster/\_paymaster

## Variables

### DEFAULT\_PROTOCOL\_REWARDS

> `const` **DEFAULT\_PROTOCOL\_REWARDS**: `string`

Defined in: [api/\_handlers/paymaster/\_paymaster.ts:1039](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/paymaster/_paymaster.ts#L1039)

## Functions

### default()

> **default**(`req`, `res`): `Promise`\<`VercelResponse` \| `undefined`\>

Defined in: [api/\_handlers/paymaster/\_paymaster.ts:3342](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/paymaster/_paymaster.ts#L3342)

#### Parameters

##### req

`VercelRequest`

##### res

`VercelResponse`

#### Returns

`Promise`\<`VercelResponse` \| `undefined`\>

***

### validatePayoutRouterProtocolRewardsArg()

> **validatePayoutRouterProtocolRewardsArg**(`protocolRewardsArg`): `"payout_router_protocol_rewards_mismatch"` \| `null`

Defined in: [api/\_handlers/paymaster/\_paymaster.ts:1050](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/paymaster/_paymaster.ts#L1050)

4626-audit-2026-04-25 review: validates the 7th constructor arg of a
sponsored PayoutRouter deploy. Returns null if accepted, otherwise an
error code matching the existing throw semantics.

Extracted as an exported pure helper so the security-critical accept/reject
decision can be exercised directly in unit tests without mounting the full
paymaster mock stack.

#### Parameters

##### protocolRewardsArg

`string` | `null`

#### Returns

`"payout_router_protocol_rewards_mismatch"` \| `null`

***

### validateSponsoredSmartWalletCalls()

> **validateSponsoredSmartWalletCalls**(`params`): `Promise`\<\{ `expectedCreatorToken`: `string` \| `null`; `mode`: `string`; \}\>

Defined in: [api/\_handlers/paymaster/\_paymaster.ts:1388](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/paymaster/_paymaster.ts#L1388)

#### Parameters

##### params

###### allowCleanupOnlyForInactiveDeploySession?

`boolean`

###### calls

`object`[]

###### canonicalEmbeddedOwner?

`string` \| `null`

###### customOwnerPolicyToken?

`string` \| `null`

###### debug?

(`info`) => `void`

###### deploySessionOwner?

`string` \| `null`

###### factory?

`string` \| `null`

###### factoryData?

`` `0x${string}` `` \| `null`

###### initCode?

`` `0x${string}` `` \| `null`

###### sender

`string`

###### sessionAddress

`string`

#### Returns

`Promise`\<\{ `expectedCreatorToken`: `string` \| `null`; `mode`: `string`; \}\>
