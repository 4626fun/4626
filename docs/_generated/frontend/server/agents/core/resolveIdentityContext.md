[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/agents/core/resolveIdentityContext

# server/agents/core/resolveIdentityContext

## Type Aliases

### AgentSessionContext

> **AgentSessionContext** = `object`

Defined in: [server/agents/core/resolveIdentityContext.ts:5](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/agents/core/resolveIdentityContext.ts#L5)

#### Properties

##### address

> **address**: `` `0x${string}` ``

Defined in: [server/agents/core/resolveIdentityContext.ts:6](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/agents/core/resolveIdentityContext.ts#L6)

##### isAdmin

> **isAdmin**: `boolean`

Defined in: [server/agents/core/resolveIdentityContext.ts:7](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/agents/core/resolveIdentityContext.ts#L7)

##### source

> **source**: [`AgentSessionSource`](#agentsessionsource)

Defined in: [server/agents/core/resolveIdentityContext.ts:8](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/agents/core/resolveIdentityContext.ts#L8)

***

### AgentSessionSource

> **AgentSessionSource** = `"xmtp"` \| `"telegram"`

Defined in: [server/agents/core/resolveIdentityContext.ts:3](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/agents/core/resolveIdentityContext.ts#L3)

***

### TelegramIdentityContext

> **TelegramIdentityContext** = `object`

Defined in: [server/agents/core/resolveIdentityContext.ts:13](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/agents/core/resolveIdentityContext.ts#L13)

#### Properties

##### groupId

> **groupId**: `string`

Defined in: [server/agents/core/resolveIdentityContext.ts:14](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/agents/core/resolveIdentityContext.ts#L14)

##### senderWallet

> **senderWallet**: `` `0x${string}` ``

Defined in: [server/agents/core/resolveIdentityContext.ts:15](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/agents/core/resolveIdentityContext.ts#L15)

##### senderWalletSource

> **senderWalletSource**: [`TelegramSenderWalletSource`](#telegramsenderwalletsource)

Defined in: [server/agents/core/resolveIdentityContext.ts:16](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/agents/core/resolveIdentityContext.ts#L16)

##### session

> **session**: [`AgentSessionContext`](#agentsessioncontext) \| `null`

Defined in: [server/agents/core/resolveIdentityContext.ts:17](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/agents/core/resolveIdentityContext.ts#L17)

***

### TelegramSenderWalletSource

> **TelegramSenderWalletSource** = `"user_map"` \| `"default"` \| `"zero"`

Defined in: [server/agents/core/resolveIdentityContext.ts:11](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/agents/core/resolveIdentityContext.ts#L11)

## Functions

### buildAgentSessionContext()

> **buildAgentSessionContext**(`params`): [`AgentSessionContext`](#agentsessioncontext) \| `null`

Defined in: [server/agents/core/resolveIdentityContext.ts:29](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/agents/core/resolveIdentityContext.ts#L29)

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

Defined in: [server/agents/core/resolveIdentityContext.ts:43](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/agents/core/resolveIdentityContext.ts#L43)

#### Parameters

##### params

`object` & `TelegramIdentityResolverDeps`

#### Returns

[`TelegramIdentityContext`](#telegramidentitycontext)
