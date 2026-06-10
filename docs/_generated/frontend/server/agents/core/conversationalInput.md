[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/agents/core/conversationalInput

# server/agents/core/conversationalInput

## Type Aliases

### ResolvedConversationalPrompt

> **ResolvedConversationalPrompt** = \{ `kind`: `"empty"`; \} \| \{ `kind`: `"prompt"`; `prompt`: `string`; \}

Defined in: [server/agents/core/conversationalInput.ts:22](https://github.com/wenakita/4626/blob/main/frontend/server/agents/core/conversationalInput.ts#L22)

## Variables

### EMPTY\_CONVERSATIONAL\_PROMPT\_RESPONSE

> `const` **EMPTY\_CONVERSATIONAL\_PROMPT\_RESPONSE**: `"Ask me anything about this vault or DeFi on Base."` = `'Ask me anything about this vault or DeFi on Base.'`

Defined in: [server/agents/core/conversationalInput.ts:1](https://github.com/wenakita/4626/blob/main/frontend/server/agents/core/conversationalInput.ts#L1)

## Functions

### isConversationalAgentInput()

> **isConversationalAgentInput**(`text`): `boolean`

Defined in: [server/agents/core/conversationalInput.ts:8](https://github.com/wenakita/4626/blob/main/frontend/server/agents/core/conversationalInput.ts#L8)

#### Parameters

##### text

`string`

#### Returns

`boolean`

***

### isHandledConversationalSlashPrefix()

> **isHandledConversationalSlashPrefix**(`text`): `boolean`

Defined in: [server/agents/core/conversationalInput.ts:3](https://github.com/wenakita/4626/blob/main/frontend/server/agents/core/conversationalInput.ts#L3)

#### Parameters

##### text

`string`

#### Returns

`boolean`

***

### normalizeConversationalPrompt()

> **normalizeConversationalPrompt**(`text`): `string`

Defined in: [server/agents/core/conversationalInput.ts:14](https://github.com/wenakita/4626/blob/main/frontend/server/agents/core/conversationalInput.ts#L14)

#### Parameters

##### text

`string`

#### Returns

`string`

***

### resolveConversationalPrompt()

> **resolveConversationalPrompt**(`text`): [`ResolvedConversationalPrompt`](#resolvedconversationalprompt)

Defined in: [server/agents/core/conversationalInput.ts:26](https://github.com/wenakita/4626/blob/main/frontend/server/agents/core/conversationalInput.ts#L26)

#### Parameters

##### text

`string`

#### Returns

[`ResolvedConversationalPrompt`](#resolvedconversationalprompt)
