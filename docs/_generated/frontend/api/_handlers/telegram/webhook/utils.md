[**4626-app**](../../../../index.md)

***

[4626-app](../../../../index.md) / api/\_handlers/telegram/webhook/utils

# api/\_handlers/telegram/webhook/utils

## Functions

### appendCommandMicroHints()

> **appendCommandMicroHints**(`text`): `string`

Defined in: [api/\_handlers/telegram/webhook/utils.ts:210](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/api/_handlers/telegram/webhook/utils.ts#L210)

#### Parameters

##### text

`string`

#### Returns

`string`

***

### applyBps()

> **applyBps**(`value`, `bps`): `bigint`

Defined in: [api/\_handlers/telegram/webhook/utils.ts:278](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/api/_handlers/telegram/webhook/utils.ts#L278)

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

Defined in: [api/\_handlers/telegram/webhook/utils.ts:11](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/api/_handlers/telegram/webhook/utils.ts#L11)

#### Parameters

##### value

`unknown`

#### Returns

`string`

***

### buildDefaultCoinMetadataUri()

> **buildDefaultCoinMetadataUri**(`params`): `string`

Defined in: [api/\_handlers/telegram/webhook/utils.ts:251](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/api/_handlers/telegram/webhook/utils.ts#L251)

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

Defined in: [api/\_handlers/telegram/webhook/utils.ts:273](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/api/_handlers/telegram/webhook/utils.ts#L273)

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

Defined in: [api/\_handlers/telegram/webhook/utils.ts:299](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/api/_handlers/telegram/webhook/utils.ts#L299)

#### Parameters

##### percentBps

`number`

#### Returns

`string`

***

### formatEthPerToken()

> **formatEthPerToken**(`weiPerToken`, `tokenSymbol`): `string`

Defined in: [api/\_handlers/telegram/webhook/utils.ts:287](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/api/_handlers/telegram/webhook/utils.ts#L287)

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

Defined in: [api/\_handlers/telegram/webhook/utils.ts:303](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/api/_handlers/telegram/webhook/utils.ts#L303)

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

Defined in: [api/\_handlers/telegram/webhook/utils.ts:261](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/api/_handlers/telegram/webhook/utils.ts#L261)

#### Parameters

##### rawText

`string`

#### Returns

`string`

***

### isAddressLike()

> **isAddressLike**(`value`): `` value is `0x${string}` ``

Defined in: [api/\_handlers/telegram/webhook/utils.ts:34](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/api/_handlers/telegram/webhook/utils.ts#L34)

#### Parameters

##### value

`unknown`

#### Returns

`` value is `0x${string}` ``

***

### isHelpCategoryCommand()

> **isHelpCategoryCommand**(`rawText`): `boolean`

Defined in: [api/\_handlers/telegram/webhook/utils.ts:131](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/api/_handlers/telegram/webhook/utils.ts#L131)

#### Parameters

##### rawText

`string`

#### Returns

`boolean`

***

### isHelpCommand()

> **isHelpCommand**(`rawText`): `boolean`

Defined in: [api/\_handlers/telegram/webhook/utils.ts:126](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/api/_handlers/telegram/webhook/utils.ts#L126)

#### Parameters

##### rawText

`string`

#### Returns

`boolean`

***

### isLikelyCommandText()

> **isLikelyCommandText**(`rawText`): `boolean`

Defined in: [api/\_handlers/telegram/webhook/utils.ts:265](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/api/_handlers/telegram/webhook/utils.ts#L265)

#### Parameters

##### rawText

`string`

#### Returns

`boolean`

***

### isSupportedMetadataUri()

> **isSupportedMetadataUri**(`raw`): `boolean`

Defined in: [api/\_handlers/telegram/webhook/utils.ts:245](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/api/_handlers/telegram/webhook/utils.ts#L245)

#### Parameters

##### raw

`string`

#### Returns

`boolean`

***

### isTwitterCommand()

> **isTwitterCommand**(`rawText`): `boolean`

Defined in: [api/\_handlers/telegram/webhook/utils.ts:122](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/api/_handlers/telegram/webhook/utils.ts#L122)

#### Parameters

##### rawText

`string`

#### Returns

`boolean`

***

### normalizeDeploySymbol()

> **normalizeDeploySymbol**(`raw`): `string`

Defined in: [api/\_handlers/telegram/webhook/utils.ts:241](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/api/_handlers/telegram/webhook/utils.ts#L241)

#### Parameters

##### raw

`string`

#### Returns

`string`

***

### normalizeTelegramCommand()

> **normalizeTelegramCommand**(`rawText`): `string`

Defined in: [api/\_handlers/telegram/webhook/utils.ts:269](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/api/_handlers/telegram/webhook/utils.ts#L269)

#### Parameters

##### rawText

`string`

#### Returns

`string`

***

### normalizeTelegramMenuButtonText()

> **normalizeTelegramMenuButtonText**(`value`, `fallbackValue`): `string`

Defined in: [api/\_handlers/telegram/webhook/utils.ts:15](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/api/_handlers/telegram/webhook/utils.ts#L15)

#### Parameters

##### value

`unknown`

##### fallbackValue

`string` = `''`

#### Returns

`string`

***

### parseBoolean()

> **parseBoolean**(`value`, `defaultValue`): `boolean`

Defined in: [api/\_handlers/telegram/webhook/utils.ts:26](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/api/_handlers/telegram/webhook/utils.ts#L26)

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

Defined in: [api/\_handlers/telegram/webhook/utils.ts:98](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/api/_handlers/telegram/webhook/utils.ts#L98)

#### Parameters

##### value

`string`

#### Returns

`Set`\<`string`\>

***

### parseJsonObject()

> **parseJsonObject**(`raw`): `Record`\<`string`, `unknown`\>

Defined in: [api/\_handlers/telegram/webhook/utils.ts:38](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/api/_handlers/telegram/webhook/utils.ts#L38)

#### Parameters

##### raw

`string` | `undefined`

#### Returns

`Record`\<`string`, `unknown`\>

***

### parseOptionalPositiveInteger()

> **parseOptionalPositiveInteger**(`value`): `number` \| `null`

Defined in: [api/\_handlers/telegram/webhook/utils.ts:49](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/api/_handlers/telegram/webhook/utils.ts#L49)

#### Parameters

##### value

`unknown`

#### Returns

`number` \| `null`

***

### parsePercentInputToBps()

> **parsePercentInputToBps**(`rawText`): `number` \| `null`

Defined in: [api/\_handlers/telegram/webhook/utils.ts:311](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/api/_handlers/telegram/webhook/utils.ts#L311)

#### Parameters

##### rawText

`string`

#### Returns

`number` \| `null`

***

### parseWindowHours()

> **parseWindowHours**(`raw`, `fallback`): `number`

Defined in: [api/\_handlers/telegram/webhook/utils.ts:92](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/api/_handlers/telegram/webhook/utils.ts#L92)

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

Defined in: [api/\_handlers/telegram/webhook/utils.ts:282](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/api/_handlers/telegram/webhook/utils.ts#L282)

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

Defined in: [api/\_handlers/telegram/webhook/utils.ts:85](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/api/_handlers/telegram/webhook/utils.ts#L85)

#### Parameters

##### req

`Pick`\<`VercelRequest`, `"query"`\>

##### key

`string`

#### Returns

`string` \| `null`

***

### readTelegramChatId()

> **readTelegramChatId**(`value`): `string` \| `null`

Defined in: [api/\_handlers/telegram/webhook/utils.ts:63](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/api/_handlers/telegram/webhook/utils.ts#L63)

#### Parameters

##### value

`unknown`

#### Returns

`string` \| `null`

***

### readTelegramUserId()

> **readTelegramUserId**(`value`): `string` \| `null`

Defined in: [api/\_handlers/telegram/webhook/utils.ts:57](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/api/_handlers/telegram/webhook/utils.ts#L57)

#### Parameters

##### value

`unknown`

#### Returns

`string` \| `null`

***

### resolveTelegramLinkErrorStatusCode()

> **resolveTelegramLinkErrorStatusCode**(`error`): `number`

Defined in: [api/\_handlers/telegram/webhook/utils.ts:69](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/api/_handlers/telegram/webhook/utils.ts#L69)

#### Parameters

##### error

`unknown`

#### Returns

`number`

***

### splitTelegramMessage()

> **splitTelegramMessage**(`text`, `maxLen`): `string`[]

Defined in: [api/\_handlers/telegram/webhook/utils.ts:107](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/api/_handlers/telegram/webhook/utils.ts#L107)

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

Defined in: [api/\_handlers/telegram/webhook/utils.ts:292](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/api/_handlers/telegram/webhook/utils.ts#L292)

#### Parameters

##### value

`unknown`

#### Returns

`bigint`

***

### tokenizeTelegramCommand()

> **tokenizeTelegramCommand**(`rawText`): `string`[]

Defined in: [api/\_handlers/telegram/webhook/utils.ts:230](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/api/_handlers/telegram/webhook/utils.ts#L230)

#### Parameters

##### rawText

`string`

#### Returns

`string`[]

***

### truncateAddress()

> **truncateAddress**(`value`): `string`

Defined in: [api/\_handlers/telegram/webhook/utils.ts:320](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/api/_handlers/telegram/webhook/utils.ts#L320)

#### Parameters

##### value

`string`

#### Returns

`string`

***

### wrapCommandListingsWithBackticks()

> **wrapCommandListingsWithBackticks**(`text`): `string`

Defined in: [api/\_handlers/telegram/webhook/utils.ts:136](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/api/_handlers/telegram/webhook/utils.ts#L136)

#### Parameters

##### text

`string`

#### Returns

`string`
