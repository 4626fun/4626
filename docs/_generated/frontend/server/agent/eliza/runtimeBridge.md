[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / server/agent/eliza/runtimeBridge

# server/agent/eliza/runtimeBridge

## Functions

### createRuntimeBridge()

> **createRuntimeBridge**(`params`): `RuntimeBridge`

Defined in: [server/agent/eliza/runtimeBridge.ts:1697](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/agent/eliza/runtimeBridge.ts#L1697)

#### Parameters

##### params

###### agentKey

`string`

###### character?

\{ `preferredModel?`: `string`; `systemPrompt`: `string`; \}

###### character.preferredModel?

`string`

###### character.systemPrompt

`string`

###### history?

\{ `maxConversations?`: `number`; `maxMessagesPerConversation?`: `number`; \}

###### history.maxConversations?

`number`

###### history.maxMessagesPerConversation?

`number`

###### plugins

`Plugin`[]

###### settings?

`Record`\<`string`, `string`\>

###### swarm?

\{ `capabilities?`: `string`[]; `role?`: `SwarmRole`; \}

###### swarm.capabilities?

`string`[]

###### swarm.role?

`SwarmRole`

#### Returns

`RuntimeBridge`
