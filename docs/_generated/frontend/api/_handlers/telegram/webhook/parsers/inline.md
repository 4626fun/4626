[**4626-app**](../../../../../index.md)

***

[4626-app](../../../../../index.md) / api/\_handlers/telegram/webhook/parsers/inline

# api/\_handlers/telegram/webhook/parsers/inline

## Type Aliases

### BuildInlineQueryAnswerParams

> **BuildInlineQueryAnswerParams** = `object`

Defined in: [api/\_handlers/telegram/webhook/parsers/inline.ts:46](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/parsers/inline.ts#L46)

#### Properties

##### chatId

> **chatId**: `string`

Defined in: [api/\_handlers/telegram/webhook/parsers/inline.ts:50](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/parsers/inline.ts#L50)

##### enablePmHandoff

> **enablePmHandoff**: `boolean`

Defined in: [api/\_handlers/telegram/webhook/parsers/inline.ts:55](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/parsers/inline.ts#L55)

##### growthMode

> **growthMode**: `boolean`

Defined in: [api/\_handlers/telegram/webhook/parsers/inline.ts:54](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/parsers/inline.ts#L54)

##### inlineResultCap

> **inlineResultCap**: `number`

Defined in: [api/\_handlers/telegram/webhook/parsers/inline.ts:53](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/parsers/inline.ts#L53)

##### isLinked

> **isLinked**: `boolean`

Defined in: [api/\_handlers/telegram/webhook/parsers/inline.ts:51](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/parsers/inline.ts#L51)

##### mediaByKey?

> `optional` **mediaByKey**: `Record`\<`string`, [`InlineMediaAsset`](#inlinemediaasset)\>

Defined in: [api/\_handlers/telegram/webhook/parsers/inline.ts:56](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/parsers/inline.ts#L56)

##### queryOffset

> **queryOffset**: `string`

Defined in: [api/\_handlers/telegram/webhook/parsers/inline.ts:48](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/parsers/inline.ts#L48)

##### rawQuery

> **rawQuery**: `string`

Defined in: [api/\_handlers/telegram/webhook/parsers/inline.ts:47](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/parsers/inline.ts#L47)

##### scopedVaults

> **scopedVaults**: [`InlineScopedVaultRow`](#inlinescopedvaultrow)[]

Defined in: [api/\_handlers/telegram/webhook/parsers/inline.ts:52](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/parsers/inline.ts#L52)

##### userId

> **userId**: `string`

Defined in: [api/\_handlers/telegram/webhook/parsers/inline.ts:49](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/parsers/inline.ts#L49)

***

### InlineMediaAsset

> **InlineMediaAsset** = `object`

Defined in: [api/\_handlers/telegram/webhook/parsers/inline.ts:6](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/parsers/inline.ts#L6)

#### Properties

##### documentMimeType?

> `optional` **documentMimeType**: `string`

Defined in: [api/\_handlers/telegram/webhook/parsers/inline.ts:12](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/parsers/inline.ts#L12)

##### documentUrl?

> `optional` **documentUrl**: `string`

Defined in: [api/\_handlers/telegram/webhook/parsers/inline.ts:11](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/parsers/inline.ts#L11)

##### mpeg4GifUrl?

> `optional` **mpeg4GifUrl**: `string`

Defined in: [api/\_handlers/telegram/webhook/parsers/inline.ts:10](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/parsers/inline.ts#L10)

##### photoUrl?

> `optional` **photoUrl**: `string`

Defined in: [api/\_handlers/telegram/webhook/parsers/inline.ts:7](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/parsers/inline.ts#L7)

##### thumbnailUrl?

> `optional` **thumbnailUrl**: `string`

Defined in: [api/\_handlers/telegram/webhook/parsers/inline.ts:8](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/parsers/inline.ts#L8)

##### videoMimeType?

> `optional` **videoMimeType**: `string`

Defined in: [api/\_handlers/telegram/webhook/parsers/inline.ts:13](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/parsers/inline.ts#L13)

##### videoUrl?

> `optional` **videoUrl**: `string`

Defined in: [api/\_handlers/telegram/webhook/parsers/inline.ts:9](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/parsers/inline.ts#L9)

***

### InlineQueryAnswer

> **InlineQueryAnswer** = `object`

Defined in: [api/\_handlers/telegram/webhook/parsers/inline.ts:35](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/parsers/inline.ts#L35)

#### Properties

##### button?

> `optional` **button**: `Record`\<`string`, `unknown`\>

Defined in: [api/\_handlers/telegram/webhook/parsers/inline.ts:41](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/parsers/inline.ts#L41)

##### nextOffset

> **nextOffset**: `string`

Defined in: [api/\_handlers/telegram/webhook/parsers/inline.ts:37](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/parsers/inline.ts#L37)

##### offset

> **offset**: `number`

Defined in: [api/\_handlers/telegram/webhook/parsers/inline.ts:39](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/parsers/inline.ts#L39)

##### queryClass

> **queryClass**: [`InlineQueryClass`](#inlinequeryclass)

Defined in: [api/\_handlers/telegram/webhook/parsers/inline.ts:38](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/parsers/inline.ts#L38)

##### results

> **results**: `Record`\<`string`, `unknown`\>[]

Defined in: [api/\_handlers/telegram/webhook/parsers/inline.ts:36](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/parsers/inline.ts#L36)

##### switchPmParameter?

> `optional` **switchPmParameter**: `string`

Defined in: [api/\_handlers/telegram/webhook/parsers/inline.ts:43](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/parsers/inline.ts#L43)

##### switchPmText?

> `optional` **switchPmText**: `string`

Defined in: [api/\_handlers/telegram/webhook/parsers/inline.ts:42](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/parsers/inline.ts#L42)

##### totalResults

> **totalResults**: `number`

Defined in: [api/\_handlers/telegram/webhook/parsers/inline.ts:40](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/parsers/inline.ts#L40)

***

### InlineQueryClass

> **InlineQueryClass** = `"trade"` \| `"arena"` \| `"market"` \| `"ai"` \| `"link"` \| `"deploy"` \| `"discovery"` \| `"general"`

Defined in: [api/\_handlers/telegram/webhook/parsers/inline.ts:4](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/parsers/inline.ts#L4)

***

### InlineScopedVaultRow

> **InlineScopedVaultRow** = `object`

Defined in: [api/\_handlers/telegram/webhook/parsers/inline.ts:16](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/parsers/inline.ts#L16)

#### Properties

##### ccaStrategyAddress

> **ccaStrategyAddress**: `string` \| `null`

Defined in: [api/\_handlers/telegram/webhook/parsers/inline.ts:22](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/parsers/inline.ts#L22)

##### chainId

> **chainId**: `number`

Defined in: [api/\_handlers/telegram/webhook/parsers/inline.ts:19](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/parsers/inline.ts#L19)

##### creatorCoinAddress

> **creatorCoinAddress**: `string`

Defined in: [api/\_handlers/telegram/webhook/parsers/inline.ts:18](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/parsers/inline.ts#L18)

##### groupId

> **groupId**: `string`

Defined in: [api/\_handlers/telegram/webhook/parsers/inline.ts:20](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/parsers/inline.ts#L20)

##### isSettled

> **isSettled**: `boolean`

Defined in: [api/\_handlers/telegram/webhook/parsers/inline.ts:21](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/parsers/inline.ts#L21)

##### vaultAddress

> **vaultAddress**: `string`

Defined in: [api/\_handlers/telegram/webhook/parsers/inline.ts:17](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/parsers/inline.ts#L17)

## Functions

### buildInlineQueryAnswer()

> **buildInlineQueryAnswer**(`params`): [`InlineQueryAnswer`](#inlinequeryanswer)

Defined in: [api/\_handlers/telegram/webhook/parsers/inline.ts:252](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/parsers/inline.ts#L252)

#### Parameters

##### params

[`BuildInlineQueryAnswerParams`](#buildinlinequeryanswerparams)

#### Returns

[`InlineQueryAnswer`](#inlinequeryanswer)

***

### classifyInlineQuery()

> **classifyInlineQuery**(`rawQuery`): [`InlineQueryClass`](#inlinequeryclass)

Defined in: [api/\_handlers/telegram/webhook/parsers/inline.ts:86](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/parsers/inline.ts#L86)

#### Parameters

##### rawQuery

`string`

#### Returns

[`InlineQueryClass`](#inlinequeryclass)
