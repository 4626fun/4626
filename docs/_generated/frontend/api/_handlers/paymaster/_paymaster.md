[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / api/\_handlers/paymaster/\_paymaster

# api/\_handlers/paymaster/\_paymaster

## Variables

### DEFAULT\_PROTOCOL\_REWARDS

> `const` **DEFAULT\_PROTOCOL\_REWARDS**: `` `0x${string}` ``

Defined in: [api/\_handlers/paymaster/\_paymaster.ts:1005](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/paymaster/_paymaster.ts#L1005)

## Functions

### default()

> **default**(`req`, `res`): `Promise`\<`VercelResponse` \| `undefined`\>

Defined in: [api/\_handlers/paymaster/\_paymaster.ts:3306](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/paymaster/_paymaster.ts#L3306)

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

Defined in: [api/\_handlers/paymaster/\_paymaster.ts:1016](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/paymaster/_paymaster.ts#L1016)

4626-audit-2026-04-25 review: validates the 7th constructor arg of a
sponsored PayoutRouter deploy. Returns null if accepted, otherwise an
error code matching the existing throw semantics.

Extracted as an exported pure helper so the security-critical accept/reject
decision can be exercised directly in unit tests without mounting the full
paymaster mock stack.

#### Parameters

##### protocolRewardsArg

`` `0x${string}` `` | `null`

#### Returns

`"payout_router_protocol_rewards_mismatch"` \| `null`

***

### validateSponsoredSmartWalletCalls()

> **validateSponsoredSmartWalletCalls**(`params`): `Promise`\<\{ `expectedCreatorToken`: `` `0x${string}` `` \| `null`; `mode`: `string`; \}\>

Defined in: [api/\_handlers/paymaster/\_paymaster.ts:1329](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/paymaster/_paymaster.ts#L1329)

#### Parameters

##### params

###### allowCleanupOnlyForInactiveDeploySession?

`boolean`

###### calls

`object`[]

###### canonicalEmbeddedOwner?

`` `0x${string}` `` \| `null`

###### customOwnerPolicyToken?

`string` \| `null`

###### debug?

(`info`) => `void`

###### deploySessionOwner?

`` `0x${string}` `` \| `null`

###### factory?

`` `0x${string}` `` \| `null`

###### factoryData?

`` `0x${string}` `` \| `null`

###### initCode?

`` `0x${string}` `` \| `null`

###### sender

`` `0x${string}` ``

###### sessionAddress

`` `0x${string}` ``

#### Returns

`Promise`\<\{ `expectedCreatorToken`: `` `0x${string}` `` \| `null`; `mode`: `string`; \}\>
