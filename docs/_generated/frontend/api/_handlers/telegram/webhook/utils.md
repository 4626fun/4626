[**4626-app**](../../../../index.md)

***

[4626-app](../../../../index.md) / api/\_handlers/telegram/webhook/utils

# api/\_handlers/telegram/webhook/utils

## Functions

### appendCommandMicroHints()

> **appendCommandMicroHints**(`text`): `string`

Defined in: [api/\_handlers/telegram/webhook/utils.ts:226](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/api/_handlers/telegram/webhook/utils.ts#L226)

#### Parameters

##### text

`string`

#### Returns

`string`

***

### applyBps()

> **applyBps**(`value`, `bps`): `bigint`

Defined in: [api/\_handlers/telegram/webhook/utils.ts:295](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/api/_handlers/telegram/webhook/utils.ts#L295)

#### Parameters

##### value

`bigint`

##### bps

`bigint`

#### Returns

`bigint`

***

### asTrimmed()

> **asTrimmed**(`value`): `string`

Defined in: [api/\_handlers/telegram/webhook/utils.ts:6](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/api/_handlers/telegram/webhook/utils.ts#L6)

#### Parameters

##### value

`unknown`

#### Returns

`string`

***

### buildDefaultCoinMetadataUri()

> **buildDefaultCoinMetadataUri**(`params`): `string`

Defined in: [api/\_handlers/telegram/webhook/utils.ts:267](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/api/_handlers/telegram/webhook/utils.ts#L267)

#### Parameters

##### params

###### coinType

`"creator"` \| `"content"`

###### name

`string`

###### symbol

`string`

#### Returns

`string`

***

### formatAmount()

> **formatAmount**(`value`, `digits`): `string`

Defined in: [api/\_handlers/telegram/webhook/utils.ts:290](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/api/_handlers/telegram/webhook/utils.ts#L290)

#### Parameters

##### value

`number`

##### digits

`number` = `4`

#### Returns

`string`

***

### formatBpsPercentLabel()

> **formatBpsPercentLabel**(`percentBps`): `string`

Defined in: [api/\_handlers/telegram/webhook/utils.ts:316](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/api/_handlers/telegram/webhook/utils.ts#L316)

#### Parameters

##### percentBps

`number`

#### Returns

`string`

***

### formatEthPerToken()

> **formatEthPerToken**(`weiPerToken`, `tokenSymbol`): `string`

Defined in: [api/\_handlers/telegram/webhook/utils.ts:304](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/api/_handlers/telegram/webhook/utils.ts#L304)

#### Parameters

##### weiPerToken

`bigint`

##### tokenSymbol

`string`

#### Returns

`string`

***

### formatUnitsCompact()

> **formatUnitsCompact**(`value`, `decimals`, `maxFractionDigits`): `string`

Defined in: [api/\_handlers/telegram/webhook/utils.ts:320](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/api/_handlers/telegram/webhook/utils.ts#L320)

#### Parameters

##### value

`bigint`

##### decimals

`number`

##### maxFractionDigits

`number` = `8`

#### Returns

`string`

***

### getCommandHead()

> **getCommandHead**(`rawText`): `string`

Defined in: [api/\_handlers/telegram/webhook/utils.ts:277](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/api/_handlers/telegram/webhook/utils.ts#L277)

#### Parameters

##### rawText

`string`

#### Returns

`string`

***

### isAddressLike()

> **isAddressLike**(`value`): `` value is `0x${string}` ``

Defined in: [api/\_handlers/telegram/webhook/utils.ts:18](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/api/_handlers/telegram/webhook/utils.ts#L18)

#### Parameters

##### value

`unknown`

#### Returns

`` value is `0x${string}` ``

***

### isHelpCategoryCommand()

> **isHelpCategoryCommand**(`rawText`): `boolean`

Defined in: [api/\_handlers/telegram/webhook/utils.ts:147](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/api/_handlers/telegram/webhook/utils.ts#L147)

#### Parameters

##### rawText

`string`

#### Returns

`boolean`

***

### isHelpCommand()

> **isHelpCommand**(`rawText`): `boolean`

Defined in: [api/\_handlers/telegram/webhook/utils.ts:142](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/api/_handlers/telegram/webhook/utils.ts#L142)

#### Parameters

##### rawText

`string`

#### Returns

`boolean`

***

### isInlineLauncherCommand()

> **isInlineLauncherCommand**(`rawText`): `boolean`

Defined in: [api/\_handlers/telegram/webhook/utils.ts:137](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/api/_handlers/telegram/webhook/utils.ts#L137)

#### Parameters

##### rawText

`string`

#### Returns

`boolean`

***

### isLikelyCommandText()

> **isLikelyCommandText**(`rawText`): `boolean`

Defined in: [api/\_handlers/telegram/webhook/utils.ts:282](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/api/_handlers/telegram/webhook/utils.ts#L282)

#### Parameters

##### rawText

`string`

#### Returns

`boolean`

***

### isSupportedMetadataUri()

> **isSupportedMetadataUri**(`raw`): `boolean`

Defined in: [api/\_handlers/telegram/webhook/utils.ts:261](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/api/_handlers/telegram/webhook/utils.ts#L261)

#### Parameters

##### raw

`string`

#### Returns

`boolean`

***

### isTwitterCommand()

> **isTwitterCommand**(`rawText`): `boolean`

Defined in: [api/\_handlers/telegram/webhook/utils.ts:132](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/api/_handlers/telegram/webhook/utils.ts#L132)

#### Parameters

##### rawText

`string`

#### Returns

`boolean`

***

### normalizeDeploySymbol()

> **normalizeDeploySymbol**(`raw`): `string`

Defined in: [api/\_handlers/telegram/webhook/utils.ts:257](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/api/_handlers/telegram/webhook/utils.ts#L257)

#### Parameters

##### raw

`string`

#### Returns

`string`

***

### normalizeTelegramCommand()

> **normalizeTelegramCommand**(`rawText`): `string`

Defined in: [api/\_handlers/telegram/webhook/utils.ts:286](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/api/_handlers/telegram/webhook/utils.ts#L286)

#### Parameters

##### rawText

`string`

#### Returns

`string`

***

### parseBoolean()

> **parseBoolean**(`value`, `defaultValue`): `boolean`

Defined in: [api/\_handlers/telegram/webhook/utils.ts:10](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/api/_handlers/telegram/webhook/utils.ts#L10)

#### Parameters

##### value

`unknown`

##### defaultValue

`boolean`

#### Returns

`boolean`

***

### parseDelimitedSet()

> **parseDelimitedSet**(`value`): `Set`\<`string`\>

Defined in: [api/\_handlers/telegram/webhook/utils.ts:82](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/api/_handlers/telegram/webhook/utils.ts#L82)

#### Parameters

##### value

`string`

#### Returns

`Set`\<`string`\>

***

### parseJsonObject()

> **parseJsonObject**(`raw`): `Record`\<`string`, `unknown`\>

Defined in: [api/\_handlers/telegram/webhook/utils.ts:22](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/api/_handlers/telegram/webhook/utils.ts#L22)

#### Parameters

##### raw

`string` | `undefined`

#### Returns

`Record`\<`string`, `unknown`\>

***

### parseOptionalPositiveInteger()

> **parseOptionalPositiveInteger**(`value`): `number` \| `null`

Defined in: [api/\_handlers/telegram/webhook/utils.ts:33](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/api/_handlers/telegram/webhook/utils.ts#L33)

#### Parameters

##### value

`unknown`

#### Returns

`number` \| `null`

***

### parsePercentInputToBps()

> **parsePercentInputToBps**(`rawText`): `number` \| `null`

Defined in: [api/\_handlers/telegram/webhook/utils.ts:328](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/api/_handlers/telegram/webhook/utils.ts#L328)

#### Parameters

##### rawText

`string`

#### Returns

`number` \| `null`

***

### parseTipCallbackData()

> **parseTipCallbackData**(`rawData`): \{ `context`: `string`; `stars`: `number`; \} \| `null`

Defined in: [api/\_handlers/telegram/webhook/utils.ts:97](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/api/_handlers/telegram/webhook/utils.ts#L97)

#### Parameters

##### rawData

`string`

#### Returns

\{ `context`: `string`; `stars`: `number`; \} \| `null`

***

### parseTipInvoicePayload()

> **parseTipInvoicePayload**(`rawPayload`): \{ `context`: `string`; `stars`: `number`; \} \| `null`

Defined in: [api/\_handlers/telegram/webhook/utils.ts:107](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/api/_handlers/telegram/webhook/utils.ts#L107)

#### Parameters

##### rawPayload

`unknown`

#### Returns

\{ `context`: `string`; `stars`: `number`; \} \| `null`

***

### parseTipStars()

> **parseTipStars**(`raw`): `number` \| `null`

Defined in: [api/\_handlers/telegram/webhook/utils.ts:91](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/api/_handlers/telegram/webhook/utils.ts#L91)

#### Parameters

##### raw

`unknown`

#### Returns

`number` \| `null`

***

### parseWindowHours()

> **parseWindowHours**(`raw`, `fallback`): `number`

Defined in: [api/\_handlers/telegram/webhook/utils.ts:76](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/api/_handlers/telegram/webhook/utils.ts#L76)

#### Parameters

##### raw

`string` | `null`

##### fallback

`number` = `24`

#### Returns

`number`

***

### q96ToCurrencyPerTokenBaseUnits()

> **q96ToCurrencyPerTokenBaseUnits**(`priceQ96`, `tokenDecimals`): `bigint`

Defined in: [api/\_handlers/telegram/webhook/utils.ts:299](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/api/_handlers/telegram/webhook/utils.ts#L299)

#### Parameters

##### priceQ96

`bigint`

##### tokenDecimals

`number`

#### Returns

`bigint`

***

### readQueryString()

> **readQueryString**(`req`, `key`): `string` \| `null`

Defined in: [api/\_handlers/telegram/webhook/utils.ts:69](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/api/_handlers/telegram/webhook/utils.ts#L69)

#### Parameters

##### req

`Pick`\<[`VercelRequest`](../../../../src/types/vercel-node.md#vercelrequest), `"query"`\>

##### key

`string`

#### Returns

`string` \| `null`

***

### readTelegramChatId()

> **readTelegramChatId**(`value`): `string` \| `null`

Defined in: [api/\_handlers/telegram/webhook/utils.ts:47](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/api/_handlers/telegram/webhook/utils.ts#L47)

#### Parameters

##### value

`unknown`

#### Returns

`string` \| `null`

***

### readTelegramUserId()

> **readTelegramUserId**(`value`): `string` \| `null`

Defined in: [api/\_handlers/telegram/webhook/utils.ts:41](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/api/_handlers/telegram/webhook/utils.ts#L41)

#### Parameters

##### value

`unknown`

#### Returns

`string` \| `null`

***

### resolveTelegramLinkErrorStatusCode()

> **resolveTelegramLinkErrorStatusCode**(`error`): `number`

Defined in: [api/\_handlers/telegram/webhook/utils.ts:53](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/api/_handlers/telegram/webhook/utils.ts#L53)

#### Parameters

##### error

`unknown`

#### Returns

`number`

***

### splitTelegramMessage()

> **splitTelegramMessage**(`text`, `maxLen`): `string`[]

Defined in: [api/\_handlers/telegram/webhook/utils.ts:117](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/api/_handlers/telegram/webhook/utils.ts#L117)

#### Parameters

##### text

`string`

##### maxLen

`number` = `3500`

#### Returns

`string`[]

***

### toBigIntStrict()

> **toBigIntStrict**(`value`): `bigint`

Defined in: [api/\_handlers/telegram/webhook/utils.ts:309](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/api/_handlers/telegram/webhook/utils.ts#L309)

#### Parameters

##### value

`unknown`

#### Returns

`bigint`

***

### tokenizeTelegramCommand()

> **tokenizeTelegramCommand**(`rawText`): `string`[]

Defined in: [api/\_handlers/telegram/webhook/utils.ts:246](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/api/_handlers/telegram/webhook/utils.ts#L246)

#### Parameters

##### rawText

`string`

#### Returns

`string`[]

***

### truncateAddress()

> **truncateAddress**(`value`): `string`

Defined in: [api/\_handlers/telegram/webhook/utils.ts:337](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/api/_handlers/telegram/webhook/utils.ts#L337)

#### Parameters

##### value

`string`

#### Returns

`string`

***

### wrapCommandListingsWithBackticks()

> **wrapCommandListingsWithBackticks**(`text`): `string`

Defined in: [api/\_handlers/telegram/webhook/utils.ts:152](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/api/_handlers/telegram/webhook/utils.ts#L152)

#### Parameters

##### text

`string`

#### Returns

`string`
