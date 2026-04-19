[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / server/agent/core/resolveIdentityContext

# server/agent/core/resolveIdentityContext

## Type Aliases

### AgentSessionContext

> **AgentSessionContext** = `object`

Defined in: [server/agent/core/resolveIdentityContext.ts:5](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/agent/core/resolveIdentityContext.ts#L5)

#### Properties

##### address

> **address**: `` `0x${string}` ``

Defined in: [server/agent/core/resolveIdentityContext.ts:6](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/agent/core/resolveIdentityContext.ts#L6)

##### isAdmin

> **isAdmin**: `boolean`

Defined in: [server/agent/core/resolveIdentityContext.ts:7](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/agent/core/resolveIdentityContext.ts#L7)

##### source

> **source**: [`AgentSessionSource`](#agentsessionsource)

Defined in: [server/agent/core/resolveIdentityContext.ts:8](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/agent/core/resolveIdentityContext.ts#L8)

***

### AgentSessionSource

> **AgentSessionSource** = `"xmtp"` \| `"telegram"`

Defined in: [server/agent/core/resolveIdentityContext.ts:3](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/agent/core/resolveIdentityContext.ts#L3)

***

### TelegramIdentityContext

> **TelegramIdentityContext** = `object`

Defined in: [server/agent/core/resolveIdentityContext.ts:13](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/agent/core/resolveIdentityContext.ts#L13)

#### Properties

##### groupId

> **groupId**: `string`

Defined in: [server/agent/core/resolveIdentityContext.ts:14](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/agent/core/resolveIdentityContext.ts#L14)

##### senderWallet

> **senderWallet**: `` `0x${string}` ``

Defined in: [server/agent/core/resolveIdentityContext.ts:15](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/agent/core/resolveIdentityContext.ts#L15)

##### senderWalletSource

> **senderWalletSource**: [`TelegramSenderWalletSource`](#telegramsenderwalletsource)

Defined in: [server/agent/core/resolveIdentityContext.ts:16](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/agent/core/resolveIdentityContext.ts#L16)

##### session

> **session**: [`AgentSessionContext`](#agentsessioncontext) \| `null`

Defined in: [server/agent/core/resolveIdentityContext.ts:17](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/agent/core/resolveIdentityContext.ts#L17)

***

### TelegramSenderWalletSource

> **TelegramSenderWalletSource** = `"user_map"` \| `"default"` \| `"zero"`

Defined in: [server/agent/core/resolveIdentityContext.ts:11](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/agent/core/resolveIdentityContext.ts#L11)

## Functions

### buildAgentSessionContext()

> **buildAgentSessionContext**(`params`): [`AgentSessionContext`](#agentsessioncontext) \| `null`

Defined in: [server/agent/core/resolveIdentityContext.ts:29](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/agent/core/resolveIdentityContext.ts#L29)

#### Parameters

##### params

###### address

`string` \| `null` \| `undefined`

###### isAdmin?

`boolean`

###### source

[`AgentSessionSource`](#agentsessionsource)

#### Returns

[`AgentSessionContext`](#agentsessioncontext) \| `null`

***

### resolveTelegramIdentityContext()

> **resolveTelegramIdentityContext**(`params`): [`TelegramIdentityContext`](#telegramidentitycontext)

Defined in: [server/agent/core/resolveIdentityContext.ts:43](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/agent/core/resolveIdentityContext.ts#L43)

#### Parameters

##### params

`object` & `TelegramIdentityResolverDeps`

#### Returns

[`TelegramIdentityContext`](#telegramidentitycontext)
