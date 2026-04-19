[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / server/agent/eliza/identity

# server/agent/eliza/identity

## Type Aliases

### Erc8004Identity

> **Erc8004Identity** = `object`

Defined in: [server/agent/eliza/identity.ts:14](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/agent/eliza/identity.ts#L14)

#### Properties

##### agentId

> **agentId**: `number`

Defined in: [server/agent/eliza/identity.ts:15](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/agent/eliza/identity.ts#L15)

##### agentRegistry

> **agentRegistry**: `string`

Defined in: [server/agent/eliza/identity.ts:19](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/agent/eliza/identity.ts#L19)

CAIP-10 reference: eip155:<chainId>:<registryAddress>

##### chainId

> **chainId**: `number`

Defined in: [server/agent/eliza/identity.ts:17](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/agent/eliza/identity.ts#L17)

##### registryAddress

> **registryAddress**: `string`

Defined in: [server/agent/eliza/identity.ts:16](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/agent/eliza/identity.ts#L16)

##### reputationRegistry

> **reputationRegistry**: `string`

Defined in: [server/agent/eliza/identity.ts:21](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/agent/eliza/identity.ts#L21)

Reputation registry address on the same chain

## Variables

### erc8004Identity

> `const` **erc8004Identity**: [`Erc8004Identity`](#erc8004identity) \| `null`

Defined in: [server/agent/eliza/identity.ts:48](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/agent/eliza/identity.ts#L48)

The agent's on-chain ERC-8004 identity, or null if not configured.
