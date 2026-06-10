[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/agents/eliza/runtimeBridge

# server/agents/eliza/runtimeBridge

## Functions

### createRuntimeBridge()

> **createRuntimeBridge**(`params`): `RuntimeBridge`

Defined in: [server/agents/eliza/runtimeBridge.ts:1697](https://github.com/wenakita/4626/blob/main/frontend/server/agents/eliza/runtimeBridge.ts#L1697)

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
