[**4626-app**](../../../../../index.md)

***

[4626-app](../../../../../index.md) / api/\_handlers/telegram/webhook/parsers/inline

# api/\_handlers/telegram/webhook/parsers/inline

## Type Aliases

### BuildInlineQueryAnswerParams

> **BuildInlineQueryAnswerParams** = `object`

Defined in: [api/\_handlers/telegram/webhook/parsers/inline.ts:56](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/api/_handlers/telegram/webhook/parsers/inline.ts#L56)

#### Properties

##### chatId

> **chatId**: `string`

Defined in: [api/\_handlers/telegram/webhook/parsers/inline.ts:60](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/api/_handlers/telegram/webhook/parsers/inline.ts#L60)

##### enablePmHandoff

> **enablePmHandoff**: `boolean`

Defined in: [api/\_handlers/telegram/webhook/parsers/inline.ts:65](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/api/_handlers/telegram/webhook/parsers/inline.ts#L65)

##### growthMode

> **growthMode**: `boolean`

Defined in: [api/\_handlers/telegram/webhook/parsers/inline.ts:64](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/api/_handlers/telegram/webhook/parsers/inline.ts#L64)

##### inlineResultCap

> **inlineResultCap**: `number`

Defined in: [api/\_handlers/telegram/webhook/parsers/inline.ts:63](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/api/_handlers/telegram/webhook/parsers/inline.ts#L63)

##### isLinked

> **isLinked**: `boolean`

Defined in: [api/\_handlers/telegram/webhook/parsers/inline.ts:61](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/api/_handlers/telegram/webhook/parsers/inline.ts#L61)

##### linkButtonUrl?

> `optional` **linkButtonUrl**: `string`

Defined in: [api/\_handlers/telegram/webhook/parsers/inline.ts:67](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/api/_handlers/telegram/webhook/parsers/inline.ts#L67)

##### mediaByKey?

> `optional` **mediaByKey**: `Record`\<`string`, [`InlineMediaAsset`](#inlinemediaasset)\>

Defined in: [api/\_handlers/telegram/webhook/parsers/inline.ts:66](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/api/_handlers/telegram/webhook/parsers/inline.ts#L66)

##### queryOffset

> **queryOffset**: `string`

Defined in: [api/\_handlers/telegram/webhook/parsers/inline.ts:58](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/api/_handlers/telegram/webhook/parsers/inline.ts#L58)

##### rawQuery

> **rawQuery**: `string`

Defined in: [api/\_handlers/telegram/webhook/parsers/inline.ts:57](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/api/_handlers/telegram/webhook/parsers/inline.ts#L57)

##### scopedVaults

> **scopedVaults**: [`InlineScopedVaultRow`](#inlinescopedvaultrow)[]

Defined in: [api/\_handlers/telegram/webhook/parsers/inline.ts:62](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/api/_handlers/telegram/webhook/parsers/inline.ts#L62)

##### userId

> **userId**: `string`

Defined in: [api/\_handlers/telegram/webhook/parsers/inline.ts:59](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/api/_handlers/telegram/webhook/parsers/inline.ts#L59)

***

### InlineMediaAsset

> **InlineMediaAsset** = `object`

Defined in: [api/\_handlers/telegram/webhook/parsers/inline.ts:14](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/api/_handlers/telegram/webhook/parsers/inline.ts#L14)

#### Properties

##### documentMimeType?

> `optional` **documentMimeType**: `string`

Defined in: [api/\_handlers/telegram/webhook/parsers/inline.ts:20](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/api/_handlers/telegram/webhook/parsers/inline.ts#L20)

##### documentUrl?

> `optional` **documentUrl**: `string`

Defined in: [api/\_handlers/telegram/webhook/parsers/inline.ts:19](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/api/_handlers/telegram/webhook/parsers/inline.ts#L19)

##### mpeg4GifUrl?

> `optional` **mpeg4GifUrl**: `string`

Defined in: [api/\_handlers/telegram/webhook/parsers/inline.ts:18](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/api/_handlers/telegram/webhook/parsers/inline.ts#L18)

##### photoUrl?

> `optional` **photoUrl**: `string`

Defined in: [api/\_handlers/telegram/webhook/parsers/inline.ts:15](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/api/_handlers/telegram/webhook/parsers/inline.ts#L15)

##### thumbnailUrl?

> `optional` **thumbnailUrl**: `string`

Defined in: [api/\_handlers/telegram/webhook/parsers/inline.ts:16](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/api/_handlers/telegram/webhook/parsers/inline.ts#L16)

##### videoMimeType?

> `optional` **videoMimeType**: `string`

Defined in: [api/\_handlers/telegram/webhook/parsers/inline.ts:21](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/api/_handlers/telegram/webhook/parsers/inline.ts#L21)

##### videoUrl?

> `optional` **videoUrl**: `string`

Defined in: [api/\_handlers/telegram/webhook/parsers/inline.ts:17](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/api/_handlers/telegram/webhook/parsers/inline.ts#L17)

***

### InlineQueryAnswer

> **InlineQueryAnswer** = `object`

Defined in: [api/\_handlers/telegram/webhook/parsers/inline.ts:45](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/api/_handlers/telegram/webhook/parsers/inline.ts#L45)

#### Properties

##### button?

> `optional` **button**: `Record`\<`string`, `unknown`\>

Defined in: [api/\_handlers/telegram/webhook/parsers/inline.ts:51](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/api/_handlers/telegram/webhook/parsers/inline.ts#L51)

##### nextOffset

> **nextOffset**: `string`

Defined in: [api/\_handlers/telegram/webhook/parsers/inline.ts:47](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/api/_handlers/telegram/webhook/parsers/inline.ts#L47)

##### offset

> **offset**: `number`

Defined in: [api/\_handlers/telegram/webhook/parsers/inline.ts:49](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/api/_handlers/telegram/webhook/parsers/inline.ts#L49)

##### queryClass

> **queryClass**: [`InlineQueryClass`](#inlinequeryclass)

Defined in: [api/\_handlers/telegram/webhook/parsers/inline.ts:48](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/api/_handlers/telegram/webhook/parsers/inline.ts#L48)

##### results

> **results**: `Record`\<`string`, `unknown`\>[]

Defined in: [api/\_handlers/telegram/webhook/parsers/inline.ts:46](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/api/_handlers/telegram/webhook/parsers/inline.ts#L46)

##### switchPmParameter?

> `optional` **switchPmParameter**: `string`

Defined in: [api/\_handlers/telegram/webhook/parsers/inline.ts:53](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/api/_handlers/telegram/webhook/parsers/inline.ts#L53)

##### switchPmText?

> `optional` **switchPmText**: `string`

Defined in: [api/\_handlers/telegram/webhook/parsers/inline.ts:52](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/api/_handlers/telegram/webhook/parsers/inline.ts#L52)

##### totalResults

> **totalResults**: `number`

Defined in: [api/\_handlers/telegram/webhook/parsers/inline.ts:50](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/api/_handlers/telegram/webhook/parsers/inline.ts#L50)

***

### InlineQueryClass

> **InlineQueryClass** = `"trade"` \| `"ai"` \| `"link"` \| `"deploy"` \| `"discovery"` \| `"general"` \| `"token_analysis"`

Defined in: [api/\_handlers/telegram/webhook/parsers/inline.ts:12](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/api/_handlers/telegram/webhook/parsers/inline.ts#L12)

***

### InlineScopedVaultRow

> **InlineScopedVaultRow** = `object`

Defined in: [api/\_handlers/telegram/webhook/parsers/inline.ts:24](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/api/_handlers/telegram/webhook/parsers/inline.ts#L24)

#### Properties

##### ccaStrategyAddress

> **ccaStrategyAddress**: `string` \| `null`

Defined in: [api/\_handlers/telegram/webhook/parsers/inline.ts:30](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/api/_handlers/telegram/webhook/parsers/inline.ts#L30)

##### chainId

> **chainId**: `number`

Defined in: [api/\_handlers/telegram/webhook/parsers/inline.ts:27](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/api/_handlers/telegram/webhook/parsers/inline.ts#L27)

##### creatorCoinAddress

> **creatorCoinAddress**: `string`

Defined in: [api/\_handlers/telegram/webhook/parsers/inline.ts:26](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/api/_handlers/telegram/webhook/parsers/inline.ts#L26)

##### groupId

> **groupId**: `string`

Defined in: [api/\_handlers/telegram/webhook/parsers/inline.ts:28](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/api/_handlers/telegram/webhook/parsers/inline.ts#L28)

##### isSettled

> **isSettled**: `boolean`

Defined in: [api/\_handlers/telegram/webhook/parsers/inline.ts:29](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/api/_handlers/telegram/webhook/parsers/inline.ts#L29)

##### vaultAddress

> **vaultAddress**: `string`

Defined in: [api/\_handlers/telegram/webhook/parsers/inline.ts:25](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/api/_handlers/telegram/webhook/parsers/inline.ts#L25)

## Functions

### buildInlineQueryAnswer()

> **buildInlineQueryAnswer**(`params`): [`InlineQueryAnswer`](#inlinequeryanswer)

Defined in: [api/\_handlers/telegram/webhook/parsers/inline.ts:249](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/api/_handlers/telegram/webhook/parsers/inline.ts#L249)

#### Parameters

##### params

[`BuildInlineQueryAnswerParams`](#buildinlinequeryanswerparams)

#### Returns

[`InlineQueryAnswer`](#inlinequeryanswer)

***

### classifyInlineQuery()

> **classifyInlineQuery**(`rawQuery`): [`InlineQueryClass`](#inlinequeryclass)

Defined in: [api/\_handlers/telegram/webhook/parsers/inline.ts:90](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/api/_handlers/telegram/webhook/parsers/inline.ts#L90)

#### Parameters

##### rawQuery

`string`

#### Returns

[`InlineQueryClass`](#inlinequeryclass)

***

### normalizeInlineTokenAddress()

> **normalizeInlineTokenAddress**(`rawQuery`): `` `0x${string}` `` \| `null`

Defined in: [api/\_handlers/telegram/webhook/parsers/inline.ts:81](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/api/_handlers/telegram/webhook/parsers/inline.ts#L81)

#### Parameters

##### rawQuery

`string`

#### Returns

`` `0x${string}` `` \| `null`
