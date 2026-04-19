[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / server/\_lib/agent/agentAccessResolver

# server/\_lib/agent/agentAccessResolver

## Functions

### resolveAgentCapabilityResponse()

> **resolveAgentCapabilityResponse**(`params`): `Promise`\<\{ `chainId`: `number`; `issuedAt`: `string`; `memberships`: `object`[]; `resolverVersion`: `number`; `schema`: `"4626-agent-capability-response-v1"`; `wallet`: `string`; \}\>

Defined in: [server/\_lib/agent/agentAccessResolver.ts:178](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/agent/agentAccessResolver.ts#L178)

#### Parameters

##### params

###### chainId

`number`

###### issuedAt?

`Date`

###### resolverVersion?

`number`

###### shareToken?

`` `0x${string}` ``

###### wallet

`` `0x${string}` ``

#### Returns

`Promise`\<\{ `chainId`: `number`; `issuedAt`: `string`; `memberships`: `object`[]; `resolverVersion`: `number`; `schema`: `"4626-agent-capability-response-v1"`; `wallet`: `string`; \}\>

***

### resolveMembershipForRoom()

> **resolveMembershipForRoom**(`params`): `Promise`\<\{ `accessTokenRequired?`: `boolean`; `actualBalance`: `string`; `gracePeriodSeconds?`: `number`; `minBalance`: `string`; `minHoldSeconds?`: `number`; `qualified`: `boolean`; `qualifiedSince?`: `number`; `roomKey`: `string`; `shareToken`: `string`; `statusReason?`: `"revoked"` \| `"not_found"` \| `"qualified"` \| `"insufficient_balance"` \| `"insufficient_hold_time"` \| `"unsupported_chain"`; `type`: `"telegram"` \| `"xmtp"` \| `"vault-ui"` \| `"governance"`; `vault?`: `string`; \} \| `null`\>

Defined in: [server/\_lib/agent/agentAccessResolver.ts:308](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/agent/agentAccessResolver.ts#L308)

#### Parameters

##### params

###### chainId

`number`

###### roomKey

`string`

###### shareToken

`` `0x${string}` ``

###### wallet

`` `0x${string}` ``

#### Returns

`Promise`\<\{ `accessTokenRequired?`: `boolean`; `actualBalance`: `string`; `gracePeriodSeconds?`: `number`; `minBalance`: `string`; `minHoldSeconds?`: `number`; `qualified`: `boolean`; `qualifiedSince?`: `number`; `roomKey`: `string`; `shareToken`: `string`; `statusReason?`: `"revoked"` \| `"not_found"` \| `"qualified"` \| `"insufficient_balance"` \| `"insufficient_hold_time"` \| `"unsupported_chain"`; `type`: `"telegram"` \| `"xmtp"` \| `"vault-ui"` \| `"governance"`; `vault?`: `string`; \} \| `null`\>
