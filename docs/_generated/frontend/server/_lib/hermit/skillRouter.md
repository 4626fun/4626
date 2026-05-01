[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / server/\_lib/hermit/skillRouter

# server/\_lib/hermit/skillRouter

## Variables

### \_hermitPromptBuildersForTests

> `const` **\_hermitPromptBuildersForTests**: `object`

Defined in: [server/\_lib/hermit/skillRouter.ts:603](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/hermit/skillRouter.ts#L603)

#### Type Declaration

##### buildGmeow()

> **buildGmeow**: (`params`) => `string` = `buildPinataPromptForGmeow`

###### Parameters

###### params

###### memeCaption

`string`

###### memeTags

`string`[]

###### userPrompt

`string`

###### Returns

`string`

##### buildHermit()

> **buildHermit**: (`params`) => `string` = `buildPinataPromptForHermit`

###### Parameters

###### params

###### mode

`HermitDraftMode`

###### userPrompt

`string`

###### Returns

`string`

##### buildImage()

> **buildImage**: (`userPrompt`) => `string` = `buildPinataPromptForHermitImage`

###### Parameters

###### userPrompt

`string`

###### Returns

`string`

##### buildLanguageDirective()

> **buildLanguageDirective**: (`dialect`) => `string` = `buildHermitLanguageDirective`

###### Parameters

###### dialect

`SpanishDialect` | `null`

###### Returns

`string`

##### buildMemoryPersistenceClause()

> **buildMemoryPersistenceClause**: (`dialect`) => `string` = `buildSpanishMemoryPersistenceClause`

###### Parameters

###### dialect

`SpanishDialect` | `null`

###### Returns

`string`

##### detectDialect()

> **detectDialect**: (`userInput`) => `SpanishDialect` \| `null` = `detectSpanishDialect`

###### Parameters

###### userInput

`string`

###### Returns

`SpanishDialect` \| `null`

##### flagMap

> **flagMap**: `Record`\<`string`, `SpanishDialect`\> = `SPANISH_DIALECT_FLAG_MAP`

##### language

> **language**: `string` = `HERMIT_LANGUAGE_DIRECTIVE`

## Functions

### executeHermitCommand()

> **executeHermitCommand**(`params`): `Promise`\<[`HermitExecutionResult`](types.md#hermitexecutionresult)\>

Defined in: [server/\_lib/hermit/skillRouter.ts:614](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/hermit/skillRouter.ts#L614)

#### Parameters

##### params

[`HermitExecutionParams`](types.md#hermitexecutionparams)

#### Returns

`Promise`\<[`HermitExecutionResult`](types.md#hermitexecutionresult)\>
