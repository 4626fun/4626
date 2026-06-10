[**4626-web**](../../../../index.md)

***

[4626-web](../../../../index.md) / api/\_handlers/telegram/webhook/inlineTokenFormatting

# api/\_handlers/telegram/webhook/inlineTokenFormatting

## Type Aliases

### TokenAnalysisResultType

> **TokenAnalysisResultType** = *typeof* [`TOKEN_ANALYSIS_RESULT_ORDER`](#token_analysis_result_order)\[`number`\] \| `"unresolved"`

Defined in: [api/\_handlers/telegram/webhook/inlineTokenFormatting.ts:21](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/inlineTokenFormatting.ts#L21)

## Variables

### TOKEN\_ANALYSIS\_RESULT\_ORDER

> `const` **TOKEN\_ANALYSIS\_RESULT\_ORDER**: readonly \[`"snapshot"`, `"catchup"`, `"risk"`, `"holders"`, `"flow"`, `"conviction"`, `"vault"`\]

Defined in: [api/\_handlers/telegram/webhook/inlineTokenFormatting.ts:11](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/inlineTokenFormatting.ts#L11)

## Functions

### buildInlineTokenAnalysisAnswer()

> **buildInlineTokenAnalysisAnswer**(`params`): [`InlineQueryAnswer`](parsers/inline.md#inlinequeryanswer)

Defined in: [api/\_handlers/telegram/webhook/inlineTokenFormatting.ts:605](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/inlineTokenFormatting.ts#L605)

#### Parameters

##### params

###### nowMs?

`number`

###### resolution

[`InlineTokenAnalysisResolution`](services/inlineTokenAnalysis.md#inlinetokenanalysisresolution)

#### Returns

[`InlineQueryAnswer`](parsers/inline.md#inlinequeryanswer)

***

### parseTokenAnalysisResultId()

> **parseTokenAnalysisResultId**(`resultId`): \{ `address`: `` `0x${string}` ``; `rankPosition`: `number` \| `null`; `resultType`: [`TokenAnalysisResultType`](#tokenanalysisresulttype); \} \| `null`

Defined in: [api/\_handlers/telegram/webhook/inlineTokenFormatting.ts:174](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/inlineTokenFormatting.ts#L174)

#### Parameters

##### resultId

`string`

#### Returns

\{ `address`: `` `0x${string}` ``; `rankPosition`: `number` \| `null`; `resultType`: [`TokenAnalysisResultType`](#tokenanalysisresulttype); \} \| `null`

***

### renderCatchUpMessage()

> **renderCatchUpMessage**(`token`): `string`

Defined in: [api/\_handlers/telegram/webhook/inlineTokenFormatting.ts:454](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/inlineTokenFormatting.ts#L454)

#### Parameters

##### token

[`ResolvedInlineTokenAnalysis`](services/inlineTokenAnalysis.md#resolvedinlinetokenanalysis)

#### Returns

`string`

***

### renderRiskMessage()

> **renderRiskMessage**(`token`): `string`

Defined in: [api/\_handlers/telegram/webhook/inlineTokenFormatting.ts:467](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/inlineTokenFormatting.ts#L467)

#### Parameters

##### token

[`ResolvedInlineTokenAnalysis`](services/inlineTokenAnalysis.md#resolvedinlinetokenanalysis)

#### Returns

`string`

***

### renderTokenSnapshotMessage()

> **renderTokenSnapshotMessage**(`token`, `nowMs`): `string`

Defined in: [api/\_handlers/telegram/webhook/inlineTokenFormatting.ts:424](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/inlineTokenFormatting.ts#L424)

#### Parameters

##### token

[`ResolvedInlineTokenAnalysis`](services/inlineTokenAnalysis.md#resolvedinlinetokenanalysis)

##### nowMs

`number` = `...`

#### Returns

`string`
