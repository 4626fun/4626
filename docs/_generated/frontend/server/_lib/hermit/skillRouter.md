[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/hermit/skillRouter

# server/\_lib/hermit/skillRouter

## Type Aliases

### HermitTone

> **HermitTone** = *typeof* [`HERMIT_TONES`](#hermit_tones)\[`number`\]

Defined in: [server/\_lib/hermit/skillRouter.ts:1142](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/hermit/skillRouter.ts#L1142)

***

### SpanishDialect

> **SpanishDialect** = `"neutral_latam"` \| `"mexico"` \| `"argentina"` \| `"colombia"` \| `"chile"` \| `"peru"` \| `"venezuela"` \| `"caribbean"` \| `"spain"`

Defined in: [server/\_lib/hermit/skillRouter.ts:690](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/hermit/skillRouter.ts#L690)

## Variables

### \_hermitPromptBuildersForTests

> `const` **\_hermitPromptBuildersForTests**: `object`

Defined in: [server/\_lib/hermit/skillRouter.ts:1075](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/hermit/skillRouter.ts#L1075)

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

##### formatHermitImageResult()

> **formatHermitImageResult**: (`rawText`) => `object`

###### Parameters

###### rawText

`string`

###### Returns

`object`

###### imagePrompt

> **imagePrompt**: `string`

###### mediaAttachments

> **mediaAttachments**: [`HermitMediaAttachment`](types.md#hermitmediaattachment)[]

###### reply

> **reply**: `string`

##### inferPublicMediaAttachment()

> **inferPublicMediaAttachment**: (`url`) => [`HermitMediaAttachment`](types.md#hermitmediaattachment) \| `null`

###### Parameters

###### url

`string`

###### Returns

[`HermitMediaAttachment`](types.md#hermitmediaattachment) \| `null`

##### language

> **language**: `string` = `HERMIT_LANGUAGE_DIRECTIVE`

##### pickCandidateImageUrl()

> **pickCandidateImageUrl**: (`parsed`) => `string` \| `null`

Walks a parsed Pinata image-mode response and returns the first
URL-shaped value worth attempting to attach. Looked-at fields, in
order:
  - top-level: `imageUrl`, `image_url`, `url`
  - first entry of any of: `attachments`, `media`, `images`
    (each entry may itself be a string URL or an object with one of
    the URL fields above).
Non-string and empty values are skipped silently. The caller is
responsible for validating the URL through `inferPublicMediaAttachment`
— this function never trusts the value beyond extracting it.

###### Parameters

###### parsed

`Record`\<`string`, `unknown`\>

###### Returns

`string` \| `null`

***

### HERMIT\_TONES

> `const` **HERMIT\_TONES**: readonly \[`"clean"`, `"degen"`, `"pro"`, `"poetic"`, `"spanglish"`, `"chaotic"`, `"concise"`\]

Defined in: [server/\_lib/hermit/skillRouter.ts:1133](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/hermit/skillRouter.ts#L1133)

## Functions

### asHermitTone()

> **asHermitTone**(`value`): `"clean"` \| `"degen"` \| `"pro"` \| `"poetic"` \| `"spanglish"` \| `"chaotic"` \| `"concise"` \| `null`

Defined in: [server/\_lib/hermit/skillRouter.ts:1145](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/hermit/skillRouter.ts#L1145)

#### Parameters

##### value

`unknown`

#### Returns

`"clean"` \| `"degen"` \| `"pro"` \| `"poetic"` \| `"spanglish"` \| `"chaotic"` \| `"concise"` \| `null`

***

### asSpanishDialect()

> **asSpanishDialect**(`value`): [`SpanishDialect`](#spanishdialect) \| `null`

Defined in: [server/\_lib/hermit/skillRouter.ts:718](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/hermit/skillRouter.ts#L718)

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

Defined in: [server/\_lib/hermit/skillRouter.ts:1408](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/hermit/skillRouter.ts#L1408)

#### Parameters

##### params

[`HermitExecutionParams`](types.md#hermitexecutionparams)

#### Returns

`Promise`\<[`HermitExecutionResult`](types.md#hermitexecutionresult)\>

***

### shouldPreferPinataHttpDraft()

> **shouldPreferPinataHttpDraft**(`params`): `boolean`

Defined in: [server/\_lib/hermit/skillRouter.ts:417](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/hermit/skillRouter.ts#L417)

AlfaClub bridge calls Pinata for generation only — Vercel posts the
formatted reply. OpenClaw gateway `chat.send` on a Pinata agent that
also has an AlfaClub channel/skill mirrors the full worker prompt and
raw JSON assistant output into the live room as duplicate "4626" /
"Agent Hermit" messages. Prefer the stateless HTTP draft path for
bridge-initiated strict-JSON creative calls so nothing hits the
session-bound channel plugin.

#### Parameters

##### params

###### prompt

`string`

###### sourceIdentity?

`string` \| `null`

#### Returns

`boolean`
