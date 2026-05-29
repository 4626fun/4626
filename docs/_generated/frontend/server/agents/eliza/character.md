[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/agents/eliza/character

# server/agents/eliza/character

## Type Aliases

### CharacterRuntimeConfig

> **CharacterRuntimeConfig** = `object`

Defined in: [server/agents/eliza/character.ts:160](https://github.com/wenakita/4626/blob/main/frontend/server/agents/eliza/character.ts#L160)

#### Properties

##### preferredModel?

> `optional` **preferredModel**: `string`

Defined in: [server/agents/eliza/character.ts:162](https://github.com/wenakita/4626/blob/main/frontend/server/agents/eliza/character.ts#L162)

##### settings

> **settings**: `Record`\<`string`, `string`\>

Defined in: [server/agents/eliza/character.ts:163](https://github.com/wenakita/4626/blob/main/frontend/server/agents/eliza/character.ts#L163)

##### systemPrompt

> **systemPrompt**: `string`

Defined in: [server/agents/eliza/character.ts:161](https://github.com/wenakita/4626/blob/main/frontend/server/agents/eliza/character.ts#L161)

## Variables

### creatorVaultCharacter

> `const` **creatorVaultCharacter**: `object`

Defined in: [server/agents/eliza/character.ts:11](https://github.com/wenakita/4626/blob/main/frontend/server/agents/eliza/character.ts#L11)

#### Type Declaration

##### adjectives

> **adjectives**: `string`[]

##### bio

> **bio**: `string`[]

##### description

> **description**: `string` = `'Autonomous 4626 assistant for secure Base DeFi actions, wallet intelligence, and ERC-8004 reputation.'`

##### id

> **id**: `"0xab6d5c10b03300326cd7fab7267ae192842967b5"` = `TARGET_CANONICAL_CSW_ADDRESS`

##### knowledge

> **knowledge**: `string`[]

##### messageExamples

> **messageExamples**: `object`[][]

##### name

> **name**: `string` = `'Keepr'`

##### plugins

> **plugins**: `string`[]

##### settings

> **settings**: `object`

###### settings.conversationLength

> **conversationLength**: `number` = `64`

###### settings.fallbackModel

> **fallbackModel**: `string` = `'claude-3-5-sonnet-20241022'`

###### settings.maxTokens

> **maxTokens**: `number` = `2000`

###### settings.model

> **model**: `string` = `'gpt-4o-mini'`

###### settings.policyModel

> **policyModel**: `string` = `'gpt-4o-mini'`

###### settings.primaryModel

> **primaryModel**: `string` = `'llama-3.3-70b-versatile'`

###### settings.temperature

> **temperature**: `number` = `0.6`

##### style

> **style**: `object`

###### style.all

> **all**: `string`[]

###### style.chat

> **chat**: `string`[]

###### style.post

> **post**: `string`[]

##### system

> **system**: `string`

##### topics

> **topics**: `string`[]

##### username

> **username**: `string` = `'keepr_agent_2205'`

## Functions

### resolveCharacterRuntimeConfig()

> **resolveCharacterRuntimeConfig**(): [`CharacterRuntimeConfig`](#characterruntimeconfig)

Defined in: [server/agents/eliza/character.ts:191](https://github.com/wenakita/4626/blob/main/frontend/server/agents/eliza/character.ts#L191)

Runtime-facing character projection used by the Eliza runtime bridge.
This keeps prompt/model policy as first-class runtime input and allows
env-level overrides without mutating the static character definition.

#### Returns

[`CharacterRuntimeConfig`](#characterruntimeconfig)

## References

### default

Renames and re-exports [creatorVaultCharacter](#creatorvaultcharacter)
