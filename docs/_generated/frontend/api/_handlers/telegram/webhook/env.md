[**4626-app**](../../../../index.md)

***

[4626-app](../../../../index.md) / api/\_handlers/telegram/webhook/env

# api/\_handlers/telegram/webhook/env

## Type Aliases

### TelegramInlineMediaAsset

> **TelegramInlineMediaAsset** = `object`

Defined in: [api/\_handlers/telegram/webhook/env.ts:5](https://github.com/wenakita/4626/blob/c2a42e6230549df4595e4edc67f4bf4d17f49898/frontend/api/_handlers/telegram/webhook/env.ts#L5)

#### Properties

##### documentMimeType?

> `optional` **documentMimeType**: `string`

Defined in: [api/\_handlers/telegram/webhook/env.ts:11](https://github.com/wenakita/4626/blob/c2a42e6230549df4595e4edc67f4bf4d17f49898/frontend/api/_handlers/telegram/webhook/env.ts#L11)

##### documentUrl?

> `optional` **documentUrl**: `string`

Defined in: [api/\_handlers/telegram/webhook/env.ts:10](https://github.com/wenakita/4626/blob/c2a42e6230549df4595e4edc67f4bf4d17f49898/frontend/api/_handlers/telegram/webhook/env.ts#L10)

##### mpeg4GifUrl?

> `optional` **mpeg4GifUrl**: `string`

Defined in: [api/\_handlers/telegram/webhook/env.ts:9](https://github.com/wenakita/4626/blob/c2a42e6230549df4595e4edc67f4bf4d17f49898/frontend/api/_handlers/telegram/webhook/env.ts#L9)

##### photoUrl?

> `optional` **photoUrl**: `string`

Defined in: [api/\_handlers/telegram/webhook/env.ts:6](https://github.com/wenakita/4626/blob/c2a42e6230549df4595e4edc67f4bf4d17f49898/frontend/api/_handlers/telegram/webhook/env.ts#L6)

##### thumbnailUrl?

> `optional` **thumbnailUrl**: `string`

Defined in: [api/\_handlers/telegram/webhook/env.ts:7](https://github.com/wenakita/4626/blob/c2a42e6230549df4595e4edc67f4bf4d17f49898/frontend/api/_handlers/telegram/webhook/env.ts#L7)

##### videoMimeType?

> `optional` **videoMimeType**: `string`

Defined in: [api/\_handlers/telegram/webhook/env.ts:12](https://github.com/wenakita/4626/blob/c2a42e6230549df4595e4edc67f4bf4d17f49898/frontend/api/_handlers/telegram/webhook/env.ts#L12)

##### videoUrl?

> `optional` **videoUrl**: `string`

Defined in: [api/\_handlers/telegram/webhook/env.ts:8](https://github.com/wenakita/4626/blob/c2a42e6230549df4595e4edc67f4bf4d17f49898/frontend/api/_handlers/telegram/webhook/env.ts#L8)

## Functions

### areHolderRoomsEnabled()

> **areHolderRoomsEnabled**(): `boolean`

Defined in: [api/\_handlers/telegram/webhook/env.ts:184](https://github.com/wenakita/4626/blob/c2a42e6230549df4595e4edc67f4bf4d17f49898/frontend/api/_handlers/telegram/webhook/env.ts#L184)

#### Returns

`boolean`

***

### areStarsTipsEnabled()

> **areStarsTipsEnabled**(): `boolean`

Defined in: [api/\_handlers/telegram/webhook/env.ts:45](https://github.com/wenakita/4626/blob/c2a42e6230549df4595e4edc67f4bf4d17f49898/frontend/api/_handlers/telegram/webhook/env.ts#L45)

#### Returns

`boolean`

***

### getBaseRpcUrl()

> **getBaseRpcUrl**(): `string`

Defined in: [api/\_handlers/telegram/webhook/env.ts:121](https://github.com/wenakita/4626/blob/c2a42e6230549df4595e4edc67f4bf4d17f49898/frontend/api/_handlers/telegram/webhook/env.ts#L121)

#### Returns

`string`

***

### getBundlerAndPaymasterUrl()

> **getBundlerAndPaymasterUrl**(): `string`

Defined in: [api/\_handlers/telegram/webhook/env.ts:126](https://github.com/wenakita/4626/blob/c2a42e6230549df4595e4edc67f4bf4d17f49898/frontend/api/_handlers/telegram/webhook/env.ts#L126)

#### Returns

`string`

***

### isPrivateChatId()

> **isPrivateChatId**(`chatId`): `boolean`

Defined in: [api/\_handlers/telegram/webhook/env.ts:74](https://github.com/wenakita/4626/blob/c2a42e6230549df4595e4edc67f4bf4d17f49898/frontend/api/_handlers/telegram/webhook/env.ts#L74)

#### Parameters

##### chatId

`string`

#### Returns

`boolean`

***

### isStarsTipsEnabledForChat()

> **isStarsTipsEnabledForChat**(`chatId`): `boolean`

Defined in: [api/\_handlers/telegram/webhook/env.ts:49](https://github.com/wenakita/4626/blob/c2a42e6230549df4595e4edc67f4bf4d17f49898/frontend/api/_handlers/telegram/webhook/env.ts#L49)

#### Parameters

##### chatId

`string`

#### Returns

`boolean`

***

### isTelegramAiFollowupEnabled()

> **isTelegramAiFollowupEnabled**(): `boolean`

Defined in: [api/\_handlers/telegram/webhook/env.ts:102](https://github.com/wenakita/4626/blob/c2a42e6230549df4595e4edc67f4bf4d17f49898/frontend/api/_handlers/telegram/webhook/env.ts#L102)

#### Returns

`boolean`

***

### isTelegramInlineGrowthModeEnabled()

> **isTelegramInlineGrowthModeEnabled**(): `boolean`

Defined in: [api/\_handlers/telegram/webhook/env.ts:134](https://github.com/wenakita/4626/blob/c2a42e6230549df4595e4edc67f4bf4d17f49898/frontend/api/_handlers/telegram/webhook/env.ts#L134)

#### Returns

`boolean`

***

### isTelegramInlinePmHandoffEnabled()

> **isTelegramInlinePmHandoffEnabled**(): `boolean`

Defined in: [api/\_handlers/telegram/webhook/env.ts:138](https://github.com/wenakita/4626/blob/c2a42e6230549df4595e4edc67f4bf4d17f49898/frontend/api/_handlers/telegram/webhook/env.ts#L138)

#### Returns

`boolean`

***

### isTelegramInlinePreparedEnabled()

> **isTelegramInlinePreparedEnabled**(): `boolean`

Defined in: [api/\_handlers/telegram/webhook/env.ts:142](https://github.com/wenakita/4626/blob/c2a42e6230549df4595e4edc67f4bf4d17f49898/frontend/api/_handlers/telegram/webhook/env.ts#L142)

#### Returns

`boolean`

***

### isTelegramPrivateDmEnabled()

> **isTelegramPrivateDmEnabled**(): `boolean`

Defined in: [api/\_handlers/telegram/webhook/env.ts:41](https://github.com/wenakita/4626/blob/c2a42e6230549df4595e4edc67f4bf4d17f49898/frontend/api/_handlers/telegram/webhook/env.ts#L41)

#### Returns

`boolean`

***

### isTradeMembershipCheckEnabled()

> **isTradeMembershipCheckEnabled**(): `boolean`

Defined in: [api/\_handlers/telegram/webhook/env.ts:201](https://github.com/wenakita/4626/blob/c2a42e6230549df4595e4edc67f4bf4d17f49898/frontend/api/_handlers/telegram/webhook/env.ts#L201)

#### Returns

`boolean`

***

### parseAdminUserIds()

> **parseAdminUserIds**(): `Set`\<`string`\>

Defined in: [api/\_handlers/telegram/webhook/env.ts:15](https://github.com/wenakita/4626/blob/c2a42e6230549df4595e4edc67f4bf4d17f49898/frontend/api/_handlers/telegram/webhook/env.ts#L15)

#### Returns

`Set`\<`string`\>

***

### parseAllowedChatIds()

> **parseAllowedChatIds**(): `Set`\<`string`\>

Defined in: [api/\_handlers/telegram/webhook/env.ts:26](https://github.com/wenakita/4626/blob/c2a42e6230549df4595e4edc67f4bf4d17f49898/frontend/api/_handlers/telegram/webhook/env.ts#L26)

#### Returns

`Set`\<`string`\>

***

### readEthUsdPrice()

> **readEthUsdPrice**(): `number`

Defined in: [api/\_handlers/telegram/webhook/env.ts:106](https://github.com/wenakita/4626/blob/c2a42e6230549df4595e4edc67f4bf4d17f49898/frontend/api/_handlers/telegram/webhook/env.ts#L106)

#### Returns

`number`

***

### readInlineMediaAssetMap()

> **readInlineMediaAssetMap**(): `Record`\<`string`, [`TelegramInlineMediaAsset`](#telegraminlinemediaasset)\>

Defined in: [api/\_handlers/telegram/webhook/env.ts:152](https://github.com/wenakita/4626/blob/c2a42e6230549df4595e4edc67f4bf4d17f49898/frontend/api/_handlers/telegram/webhook/env.ts#L152)

#### Returns

`Record`\<`string`, [`TelegramInlineMediaAsset`](#telegraminlinemediaasset)\>

***

### readInlineQueryResultCap()

> **readInlineQueryResultCap**(): `number`

Defined in: [api/\_handlers/telegram/webhook/env.ts:130](https://github.com/wenakita/4626/blob/c2a42e6230549df4595e4edc67f4bf4d17f49898/frontend/api/_handlers/telegram/webhook/env.ts#L130)

#### Returns

`number`

***

### readShareUsdFallback()

> **readShareUsdFallback**(): `number`

Defined in: [api/\_handlers/telegram/webhook/env.ts:115](https://github.com/wenakita/4626/blob/c2a42e6230549df4595e4edc67f4bf4d17f49898/frontend/api/_handlers/telegram/webhook/env.ts#L115)

#### Returns

`number`

***

### readTradeLimitFromEnv()

> **readTradeLimitFromEnv**(`key`, `fallback`): `number`

Defined in: [api/\_handlers/telegram/webhook/env.ts:188](https://github.com/wenakita/4626/blob/c2a42e6230549df4595e4edc67f4bf4d17f49898/frontend/api/_handlers/telegram/webhook/env.ts#L188)

#### Parameters

##### key

`string`

##### fallback

`number`

#### Returns

`number`

***

### resolveGroupId()

> **resolveGroupId**(`chatId`): `string`

Defined in: [api/\_handlers/telegram/webhook/env.ts:90](https://github.com/wenakita/4626/blob/c2a42e6230549df4595e4edc67f4bf4d17f49898/frontend/api/_handlers/telegram/webhook/env.ts#L90)

#### Parameters

##### chatId

`string`

#### Returns

`string`

***

### resolveSenderWallet()

> **resolveSenderWallet**(`userId`): `` `0x${string}` ``

Defined in: [api/\_handlers/telegram/webhook/env.ts:78](https://github.com/wenakita/4626/blob/c2a42e6230549df4595e4edc67f4bf4d17f49898/frontend/api/_handlers/telegram/webhook/env.ts#L78)

#### Parameters

##### userId

`string`

#### Returns

`` `0x${string}` ``

***

### resolveSignalsDestination()

> **resolveSignalsDestination**(`sourceChatId`): `object`

Defined in: [api/\_handlers/telegram/webhook/env.ts:57](https://github.com/wenakita/4626/blob/c2a42e6230549df4595e4edc67f4bf4d17f49898/frontend/api/_handlers/telegram/webhook/env.ts#L57)

#### Parameters

##### sourceChatId

`string`

#### Returns

`object`

##### chatId

> **chatId**: `string`

##### messageThreadId?

> `optional` **messageThreadId**: `number`

***

### resolveTelegramMiniAppUrl()

> **resolveTelegramMiniAppUrl**(): `string`

Defined in: [api/\_handlers/telegram/webhook/env.ts:178](https://github.com/wenakita/4626/blob/c2a42e6230549df4595e4edc67f4bf4d17f49898/frontend/api/_handlers/telegram/webhook/env.ts#L178)

#### Returns

`string`

***

### tradeRateLimitForAction()

> **tradeRateLimitForAction**(`actionType`): `object`

Defined in: [api/\_handlers/telegram/webhook/env.ts:194](https://github.com/wenakita/4626/blob/c2a42e6230549df4595e4edc67f4bf4d17f49898/frontend/api/_handlers/telegram/webhook/env.ts#L194)

#### Parameters

##### actionType

`"buy"` | `"sell"` | `"bid"`

#### Returns

`object`

##### chatLimit

> **chatLimit**: `number`

##### userLimit

> **userLimit**: `number`
