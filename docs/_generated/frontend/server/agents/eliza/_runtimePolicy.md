[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / server/agents/eliza/\_runtimePolicy

# server/agents/eliza/\_runtimePolicy

## Classes

### WelcomeConversationTracker

Defined in: [server/agents/eliza/\_runtimePolicy.ts:40](https://github.com/wenakita/4626/blob/main/frontend/server/agents/eliza/_runtimePolicy.ts#L40)

#### Constructors

##### Constructor

> **new WelcomeConversationTracker**(`input?`): [`WelcomeConversationTracker`](#welcomeconversationtracker)

Defined in: [server/agents/eliza/\_runtimePolicy.ts:45](https://github.com/wenakita/4626/blob/main/frontend/server/agents/eliza/_runtimePolicy.ts#L45)

###### Parameters

###### input?

###### maxTracked?

`number`

###### ttlMs?

`number`

###### Returns

[`WelcomeConversationTracker`](#welcomeconversationtracker)

#### Methods

##### getDebugState()

> **getDebugState**(): `object`

Defined in: [server/agents/eliza/\_runtimePolicy.ts:76](https://github.com/wenakita/4626/blob/main/frontend/server/agents/eliza/_runtimePolicy.ts#L76)

###### Returns

`object`

###### conversationIds

> **conversationIds**: `string`[]

###### tracked

> **tracked**: `number`

##### has()

> **has**(`conversationId`, `now`): `boolean`

Defined in: [server/agents/eliza/\_runtimePolicy.ts:71](https://github.com/wenakita/4626/blob/main/frontend/server/agents/eliza/_runtimePolicy.ts#L71)

###### Parameters

###### conversationId

`string`

###### now

`number` = `...`

###### Returns

`boolean`

##### markAndCheckFirstSeen()

> **markAndCheckFirstSeen**(`conversationId`, `now`): `boolean`

Defined in: [server/agents/eliza/\_runtimePolicy.ts:62](https://github.com/wenakita/4626/blob/main/frontend/server/agents/eliza/_runtimePolicy.ts#L62)

###### Parameters

###### conversationId

`string`

###### now

`number` = `...`

###### Returns

`boolean`

##### prune()

> **prune**(`now`): `void`

Defined in: [server/agents/eliza/\_runtimePolicy.ts:50](https://github.com/wenakita/4626/blob/main/frontend/server/agents/eliza/_runtimePolicy.ts#L50)

###### Parameters

###### now

`number` = `...`

###### Returns

`void`

## Type Aliases

### AgentConfigFingerprintInput

> **AgentConfigFingerprintInput** = `object`

Defined in: [server/agents/eliza/\_runtimePolicy.ts:15](https://github.com/wenakita/4626/blob/main/frontend/server/agents/eliza/_runtimePolicy.ts#L15)

#### Properties

##### agentType

> **agentType**: `"eoa"` \| `"csw"`

Defined in: [server/agents/eliza/\_runtimePolicy.ts:18](https://github.com/wenakita/4626/blob/main/frontend/server/agents/eliza/_runtimePolicy.ts#L18)

##### creatorAddress

> **creatorAddress**: `string`

Defined in: [server/agents/eliza/\_runtimePolicy.ts:16](https://github.com/wenakita/4626/blob/main/frontend/server/agents/eliza/_runtimePolicy.ts#L16)

##### cswAddress

> **cswAddress**: `string` \| `null`

Defined in: [server/agents/eliza/\_runtimePolicy.ts:20](https://github.com/wenakita/4626/blob/main/frontend/server/agents/eliza/_runtimePolicy.ts#L20)

##### encryptedPrivateKeyB64

> **encryptedPrivateKeyB64**: `string`

Defined in: [server/agents/eliza/\_runtimePolicy.ts:21](https://github.com/wenakita/4626/blob/main/frontend/server/agents/eliza/_runtimePolicy.ts#L21)

##### encryptedPrivateKeyIvB64

> **encryptedPrivateKeyIvB64**: `string`

Defined in: [server/agents/eliza/\_runtimePolicy.ts:22](https://github.com/wenakita/4626/blob/main/frontend/server/agents/eliza/_runtimePolicy.ts#L22)

##### encryptedPrivateKeyTagB64

> **encryptedPrivateKeyTagB64**: `string`

Defined in: [server/agents/eliza/\_runtimePolicy.ts:23](https://github.com/wenakita/4626/blob/main/frontend/server/agents/eliza/_runtimePolicy.ts#L23)

##### privyWalletId

> **privyWalletId**: `string` \| `null`

Defined in: [server/agents/eliza/\_runtimePolicy.ts:19](https://github.com/wenakita/4626/blob/main/frontend/server/agents/eliza/_runtimePolicy.ts#L19)

##### xmtpAgentAddress

> **xmtpAgentAddress**: `string`

Defined in: [server/agents/eliza/\_runtimePolicy.ts:17](https://github.com/wenakita/4626/blob/main/frontend/server/agents/eliza/_runtimePolicy.ts#L17)

## Functions

### fingerprintAgentConfig()

> **fingerprintAgentConfig**(`input`): `string`

Defined in: [server/agents/eliza/\_runtimePolicy.ts:26](https://github.com/wenakita/4626/blob/main/frontend/server/agents/eliza/_runtimePolicy.ts#L26)

#### Parameters

##### input

[`AgentConfigFingerprintInput`](#agentconfigfingerprintinput)

#### Returns

`string`

***

### getActionRetryBudget()

> **getActionRetryBudget**(`actionName`, `defaultRetries`): `number`

Defined in: [server/agents/eliza/\_runtimePolicy.ts:10](https://github.com/wenakita/4626/blob/main/frontend/server/agents/eliza/_runtimePolicy.ts#L10)

#### Parameters

##### actionName

`string`

##### defaultRetries

`number`

#### Returns

`number`
