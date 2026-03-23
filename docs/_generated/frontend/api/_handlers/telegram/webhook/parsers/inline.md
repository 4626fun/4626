[**4626-app**](../../../../../index.md)

***

[4626-app](../../../../../index.md) / api/\_handlers/telegram/webhook/parsers/inline

# api/\_handlers/telegram/webhook/parsers/inline

## Type Aliases

### BuildInlineQueryAnswerParams

> **BuildInlineQueryAnswerParams** = `object`

Defined in: [api/\_handlers/telegram/webhook/parsers/inline.ts:48](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/parsers/inline.ts#L48)

#### Properties

##### chatId

> **chatId**: `string`

Defined in: [api/\_handlers/telegram/webhook/parsers/inline.ts:52](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/parsers/inline.ts#L52)

##### enablePmHandoff

> **enablePmHandoff**: `boolean`

Defined in: [api/\_handlers/telegram/webhook/parsers/inline.ts:57](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/parsers/inline.ts#L57)

##### growthMode

> **growthMode**: `boolean`

Defined in: [api/\_handlers/telegram/webhook/parsers/inline.ts:56](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/parsers/inline.ts#L56)

##### inlineResultCap

> **inlineResultCap**: `number`

Defined in: [api/\_handlers/telegram/webhook/parsers/inline.ts:55](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/parsers/inline.ts#L55)

##### isLinked

> **isLinked**: `boolean`

Defined in: [api/\_handlers/telegram/webhook/parsers/inline.ts:53](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/parsers/inline.ts#L53)

##### linkButtonUrl?

> `optional` **linkButtonUrl**: `string`

Defined in: [api/\_handlers/telegram/webhook/parsers/inline.ts:60](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/parsers/inline.ts#L60)

##### mediaByKey?

> `optional` **mediaByKey**: `Record`\<`string`, [`InlineMediaAsset`](#inlinemediaasset)\>

Defined in: [api/\_handlers/telegram/webhook/parsers/inline.ts:58](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/parsers/inline.ts#L58)

##### menuButtonUrl?

> `optional` **menuButtonUrl**: `string`

Defined in: [api/\_handlers/telegram/webhook/parsers/inline.ts:59](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/parsers/inline.ts#L59)

##### queryOffset

> **queryOffset**: `string`

Defined in: [api/\_handlers/telegram/webhook/parsers/inline.ts:50](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/parsers/inline.ts#L50)

##### rawQuery

> **rawQuery**: `string`

Defined in: [api/\_handlers/telegram/webhook/parsers/inline.ts:49](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/parsers/inline.ts#L49)

##### scopedVaults

> **scopedVaults**: [`InlineScopedVaultRow`](#inlinescopedvaultrow)[]

Defined in: [api/\_handlers/telegram/webhook/parsers/inline.ts:54](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/parsers/inline.ts#L54)

##### userId

> **userId**: `string`

Defined in: [api/\_handlers/telegram/webhook/parsers/inline.ts:51](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/parsers/inline.ts#L51)

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

Defined in: [api/\_handlers/telegram/webhook/parsers/inline.ts:37](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/parsers/inline.ts#L37)

#### Properties

##### button?

> `optional` **button**: `Record`\<`string`, `unknown`\>

Defined in: [api/\_handlers/telegram/webhook/parsers/inline.ts:43](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/parsers/inline.ts#L43)

##### nextOffset

> **nextOffset**: `string`

Defined in: [api/\_handlers/telegram/webhook/parsers/inline.ts:39](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/parsers/inline.ts#L39)

##### offset

> **offset**: `number`

Defined in: [api/\_handlers/telegram/webhook/parsers/inline.ts:41](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/parsers/inline.ts#L41)

##### queryClass

> **queryClass**: [`InlineQueryClass`](#inlinequeryclass)

Defined in: [api/\_handlers/telegram/webhook/parsers/inline.ts:40](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/parsers/inline.ts#L40)

##### results

> **results**: `Record`\<`string`, `unknown`\>[]

Defined in: [api/\_handlers/telegram/webhook/parsers/inline.ts:38](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/parsers/inline.ts#L38)

##### switchPmParameter?

> `optional` **switchPmParameter**: `string`

Defined in: [api/\_handlers/telegram/webhook/parsers/inline.ts:45](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/parsers/inline.ts#L45)

##### switchPmText?

> `optional` **switchPmText**: `string`

Defined in: [api/\_handlers/telegram/webhook/parsers/inline.ts:44](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/parsers/inline.ts#L44)

##### totalResults

> **totalResults**: `number`

Defined in: [api/\_handlers/telegram/webhook/parsers/inline.ts:42](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/parsers/inline.ts#L42)

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

Defined in: [api/\_handlers/telegram/webhook/parsers/inline.ts:261](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/parsers/inline.ts#L261)

#### Parameters

##### params

[`BuildInlineQueryAnswerParams`](#buildinlinequeryanswerparams)

#### Returns

[`InlineQueryAnswer`](#inlinequeryanswer)

***

### classifyInlineQuery()

> **classifyInlineQuery**(`rawQuery`): [`InlineQueryClass`](#inlinequeryclass)

Defined in: [api/\_handlers/telegram/webhook/parsers/inline.ts:90](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/parsers/inline.ts#L90)

#### Parameters

##### rawQuery

`string`

#### Returns

[`InlineQueryClass`](#inlinequeryclass)
