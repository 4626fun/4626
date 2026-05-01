[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / server/\_lib/hermit/skillRouter

# server/\_lib/hermit/skillRouter

## Type Aliases

### SpanishDialect

> **SpanishDialect** = `"neutral_latam"` \| `"mexico"` \| `"argentina"` \| `"colombia"` \| `"chile"` \| `"peru"` \| `"venezuela"` \| `"caribbean"` \| `"spain"`

Defined in: [server/\_lib/hermit/skillRouter.ts:397](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/hermit/skillRouter.ts#L397)

## Variables

### \_hermitPromptBuildersForTests

> `const` **\_hermitPromptBuildersForTests**: `object`

Defined in: [server/\_lib/hermit/skillRouter.ts:706](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/hermit/skillRouter.ts#L706)

#### Type Declaration

##### buildGmeow()

> **buildGmeow**: (`params`) => `string` = `buildPinataPromptForGmeow`

###### Parameters

###### params

###### memeCaption

`string`

###### memeTags

`string`[]

###### userPreferences?

[`HermitUserPreferences`](types.md#hermituserpreferences) \| `null`

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

###### userPreferences?

[`HermitUserPreferences`](types.md#hermituserpreferences) \| `null`

###### userPrompt

`string`

###### Returns

`string`

##### buildImage()

> **buildImage**: (`userPrompt`, `userPreferences?`) => `string` = `buildPinataPromptForHermitImage`

###### Parameters

###### userPrompt

`string`

###### userPreferences?

[`HermitUserPreferences`](types.md#hermituserpreferences) | `null`

###### Returns

`string`

##### buildLanguageDirective()

> **buildLanguageDirective**: (`dialect`, `source`) => `string` = `buildHermitLanguageDirective`

###### Parameters

###### dialect

[`SpanishDialect`](#spanishdialect) | `null`

###### source

`"default"` | `"explicit"` | `"persisted"`

###### Returns

`string`

##### buildMemoryPersistenceClause()

> **buildMemoryPersistenceClause**: (`dialect`, `source`) => `string` = `buildSpanishMemoryPersistenceClause`

Memory persistence clause.

Per-user dialect persistence now lives in the AlfaClub control-plane
preference store keyed by (room_id, sender_address) — not in the
shared workspace MEMORY.md file (which would leak one user's dialect
to every other user in the room).

The clause therefore tells Hermit explicitly NOT to mutate MEMORY.md
this turn (it has nothing to record there); the bridge persists the
explicit signal via `persistPreference` after detecting it.

`source` describes how the active dialect was selected so Hermit can
weight regional flavor accordingly:
  - 'explicit': flag/text hint in this user's message — strong signal.
  - 'persisted': loaded from this user's saved preference.
  - 'default': no signal, use neutral_latam.

###### Parameters

###### dialect

[`SpanishDialect`](#spanishdialect) | `null`

###### source

`"default"` | `"explicit"` | `"persisted"`

###### Returns

`string`

##### detectDialect()

> **detectDialect**: (`userInput`) => [`SpanishDialect`](#spanishdialect) \| `null` = `detectSpanishDialect`

###### Parameters

###### userInput

`string`

###### Returns

[`SpanishDialect`](#spanishdialect) \| `null`

##### flagMap

> **flagMap**: `Record`\<`string`, [`SpanishDialect`](#spanishdialect)\> = `SPANISH_DIALECT_FLAG_MAP`

##### language

> **language**: `string` = `HERMIT_LANGUAGE_DIRECTIVE`

## Functions

### asSpanishDialect()

> **asSpanishDialect**(`value`): [`SpanishDialect`](#spanishdialect) \| `null`

Defined in: [server/\_lib/hermit/skillRouter.ts:425](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/hermit/skillRouter.ts#L425)

Validate and narrow a string into a known SpanishDialect, or return
null. Used to whitelist values coming back from the per-user
preference store before they reach prompt-building.

#### Parameters

##### value

`unknown`

#### Returns

[`SpanishDialect`](#spanishdialect) \| `null`

***

### executeHermitCommand()

> **executeHermitCommand**(`params`): `Promise`\<[`HermitExecutionResult`](types.md#hermitexecutionresult)\>

Defined in: [server/\_lib/hermit/skillRouter.ts:752](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/hermit/skillRouter.ts#L752)

#### Parameters

##### params

[`HermitExecutionParams`](types.md#hermitexecutionparams)

#### Returns

`Promise`\<[`HermitExecutionResult`](types.md#hermitexecutionresult)\>
