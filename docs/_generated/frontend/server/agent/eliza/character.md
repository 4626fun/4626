[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / server/agent/eliza/character

# server/agent/eliza/character

## Type Aliases

### CharacterRuntimeConfig

> **CharacterRuntimeConfig** = `object`

Defined in: [server/agent/eliza/character.ts:157](https://github.com/wenakita/4626/blob/main/frontend/server/agent/eliza/character.ts#L157)

#### Properties

##### preferredModel?

> `optional` **preferredModel**: `string`

Defined in: [server/agent/eliza/character.ts:159](https://github.com/wenakita/4626/blob/main/frontend/server/agent/eliza/character.ts#L159)

##### settings

> **settings**: `Record`\<`string`, `string`\>

Defined in: [server/agent/eliza/character.ts:160](https://github.com/wenakita/4626/blob/main/frontend/server/agent/eliza/character.ts#L160)

##### systemPrompt

> **systemPrompt**: `string`

Defined in: [server/agent/eliza/character.ts:158](https://github.com/wenakita/4626/blob/main/frontend/server/agent/eliza/character.ts#L158)

## Variables

### creatorVaultCharacter

> `const` **creatorVaultCharacter**: `object`

Defined in: [server/agent/eliza/character.ts:9](https://github.com/wenakita/4626/blob/main/frontend/server/agent/eliza/character.ts#L9)

4626 Agent Character

Defines the agent's personality, knowledge, and behavior.
Creators can override this with their own character config
via the admin UI (future: LLM personality config).

#### Type Declaration

##### adjectives

> **adjectives**: `string`[]

##### bio

> **bio**: `string`[]

##### description

> **description**: `string` = `'Autonomous 4626 assistant for secure Base DeFi actions, wallet intelligence, and ERC-8004 reputation.'`

##### id

> **id**: `string` = `'0xab6d5c10b03300326cd7fab7267ae192842967b5'`

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

Defined in: [server/agent/eliza/character.ts:188](https://github.com/wenakita/4626/blob/main/frontend/server/agent/eliza/character.ts#L188)

Runtime-facing character projection used by the Eliza runtime bridge.
This keeps prompt/model policy as first-class runtime input and allows
env-level overrides without mutating the static character definition.

#### Returns

[`CharacterRuntimeConfig`](#characterruntimeconfig)

## References

### default

Renames and re-exports [creatorVaultCharacter](#creatorvaultcharacter)
