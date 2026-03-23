[**4626-app**](../../../../index.md)

***

[4626-app](../../../../index.md) / api/\_handlers/telegram/webhook/env

# api/\_handlers/telegram/webhook/env

## Type Aliases

### SenderWalletResolution

> **SenderWalletResolution** = `object`

Defined in: [api/\_handlers/telegram/webhook/env.ts:80](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/env.ts#L80)

#### Properties

##### source

> **source**: [`SenderWalletResolutionSource`](#senderwalletresolutionsource-1)

Defined in: [api/\_handlers/telegram/webhook/env.ts:82](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/env.ts#L82)

##### wallet

> **wallet**: `` `0x${string}` ``

Defined in: [api/\_handlers/telegram/webhook/env.ts:81](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/env.ts#L81)

***

### SenderWalletResolutionSource

> **SenderWalletResolutionSource** = `"user_map"` \| `"default"` \| `"zero"`

Defined in: [api/\_handlers/telegram/webhook/env.ts:78](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/env.ts#L78)

***

### TelegramInlineMediaAsset

> **TelegramInlineMediaAsset** = `object`

Defined in: [api/\_handlers/telegram/webhook/env.ts:5](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/env.ts#L5)

#### Properties

##### documentMimeType?

> `optional` **documentMimeType**: `string`

Defined in: [api/\_handlers/telegram/webhook/env.ts:11](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/env.ts#L11)

##### documentUrl?

> `optional` **documentUrl**: `string`

Defined in: [api/\_handlers/telegram/webhook/env.ts:10](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/env.ts#L10)

##### mpeg4GifUrl?

> `optional` **mpeg4GifUrl**: `string`

Defined in: [api/\_handlers/telegram/webhook/env.ts:9](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/env.ts#L9)

##### photoUrl?

> `optional` **photoUrl**: `string`

Defined in: [api/\_handlers/telegram/webhook/env.ts:6](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/env.ts#L6)

##### thumbnailUrl?

> `optional` **thumbnailUrl**: `string`

Defined in: [api/\_handlers/telegram/webhook/env.ts:7](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/env.ts#L7)

##### videoMimeType?

> `optional` **videoMimeType**: `string`

Defined in: [api/\_handlers/telegram/webhook/env.ts:12](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/env.ts#L12)

##### videoUrl?

> `optional` **videoUrl**: `string`

Defined in: [api/\_handlers/telegram/webhook/env.ts:8](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/env.ts#L8)

## Functions

### areHolderRoomsEnabled()

> **areHolderRoomsEnabled**(): `boolean`

Defined in: [api/\_handlers/telegram/webhook/env.ts:208](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/env.ts#L208)

#### Returns

`boolean`

***

### areStarsTipsEnabled()

> **areStarsTipsEnabled**(): `boolean`

Defined in: [api/\_handlers/telegram/webhook/env.ts:45](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/env.ts#L45)

#### Returns

`boolean`

***

### getBaseRpcUrl()

> **getBaseRpcUrl**(): `string`

Defined in: [api/\_handlers/telegram/webhook/env.ts:145](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/env.ts#L145)

#### Returns

`string`

***

### getBundlerAndPaymasterUrl()

> **getBundlerAndPaymasterUrl**(): `string`

Defined in: [api/\_handlers/telegram/webhook/env.ts:150](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/env.ts#L150)

#### Returns

`string`

***

### isPrivateChatId()

> **isPrivateChatId**(`chatId`): `boolean`

Defined in: [api/\_handlers/telegram/webhook/env.ts:74](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/env.ts#L74)

#### Parameters

##### chatId

`string`

#### Returns

`boolean`

***

### isStarsTipsEnabledForChat()

> **isStarsTipsEnabledForChat**(`chatId`): `boolean`

Defined in: [api/\_handlers/telegram/webhook/env.ts:49](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/env.ts#L49)

#### Parameters

##### chatId

`string`

#### Returns

`boolean`

***

### isTelegramAiFollowupEnabled()

> **isTelegramAiFollowupEnabled**(): `boolean`

Defined in: [api/\_handlers/telegram/webhook/env.ts:126](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/env.ts#L126)

#### Returns

`boolean`

***

### isTelegramInlineGrowthModeEnabled()

> **isTelegramInlineGrowthModeEnabled**(): `boolean`

Defined in: [api/\_handlers/telegram/webhook/env.ts:158](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/env.ts#L158)

#### Returns

`boolean`

***

### isTelegramInlinePmHandoffEnabled()

> **isTelegramInlinePmHandoffEnabled**(): `boolean`

Defined in: [api/\_handlers/telegram/webhook/env.ts:162](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/env.ts#L162)

#### Returns

`boolean`

***

### isTelegramInlinePreparedEnabled()

> **isTelegramInlinePreparedEnabled**(): `boolean`

Defined in: [api/\_handlers/telegram/webhook/env.ts:166](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/env.ts#L166)

#### Returns

`boolean`

***

### isTelegramPrivateDmEnabled()

> **isTelegramPrivateDmEnabled**(): `boolean`

Defined in: [api/\_handlers/telegram/webhook/env.ts:41](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/env.ts#L41)

#### Returns

`boolean`

***

### isTradeMembershipCheckEnabled()

> **isTradeMembershipCheckEnabled**(): `boolean`

Defined in: [api/\_handlers/telegram/webhook/env.ts:225](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/env.ts#L225)

#### Returns

`boolean`

***

### parseAdminUserIds()

> **parseAdminUserIds**(): `Set`\<`string`\>

Defined in: [api/\_handlers/telegram/webhook/env.ts:15](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/env.ts#L15)

#### Returns

`Set`\<`string`\>

***

### parseAllowedChatIds()

> **parseAllowedChatIds**(): `Set`\<`string`\>

Defined in: [api/\_handlers/telegram/webhook/env.ts:26](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/env.ts#L26)

#### Returns

`Set`\<`string`\>

***

### readEthUsdPrice()

> **readEthUsdPrice**(): `number`

Defined in: [api/\_handlers/telegram/webhook/env.ts:130](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/env.ts#L130)

#### Returns

`number`

***

### readInlineMediaAssetMap()

> **readInlineMediaAssetMap**(): `Record`\<`string`, [`TelegramInlineMediaAsset`](#telegraminlinemediaasset)\>

Defined in: [api/\_handlers/telegram/webhook/env.ts:176](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/env.ts#L176)

#### Returns

`Record`\<`string`, [`TelegramInlineMediaAsset`](#telegraminlinemediaasset)\>

***

### readInlineQueryResultCap()

> **readInlineQueryResultCap**(): `number`

Defined in: [api/\_handlers/telegram/webhook/env.ts:154](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/env.ts#L154)

#### Returns

`number`

***

### readShareUsdFallback()

> **readShareUsdFallback**(): `number`

Defined in: [api/\_handlers/telegram/webhook/env.ts:139](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/env.ts#L139)

#### Returns

`number`

***

### readTradeLimitFromEnv()

> **readTradeLimitFromEnv**(`key`, `fallback`): `number`

Defined in: [api/\_handlers/telegram/webhook/env.ts:212](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/env.ts#L212)

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

Defined in: [api/\_handlers/telegram/webhook/env.ts:114](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/env.ts#L114)

#### Parameters

##### chatId

`string`

#### Returns

`string`

***

### resolveSenderWallet()

> **resolveSenderWallet**(`userId`): `` `0x${string}` ``

Defined in: [api/\_handlers/telegram/webhook/env.ts:110](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/env.ts#L110)

#### Parameters

##### userId

`string`

#### Returns

`` `0x${string}` ``

***

### resolveSenderWalletWithSource()

> **resolveSenderWalletWithSource**(`userId`): [`SenderWalletResolution`](#senderwalletresolution)

Defined in: [api/\_handlers/telegram/webhook/env.ts:85](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/env.ts#L85)

#### Parameters

##### userId

`string`

#### Returns

[`SenderWalletResolution`](#senderwalletresolution)

***

### resolveSignalsDestination()

> **resolveSignalsDestination**(`sourceChatId`): `object`

Defined in: [api/\_handlers/telegram/webhook/env.ts:57](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/env.ts#L57)

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

Defined in: [api/\_handlers/telegram/webhook/env.ts:202](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/env.ts#L202)

#### Returns

`string`

***

### tradeRateLimitForAction()

> **tradeRateLimitForAction**(`actionType`): `object`

Defined in: [api/\_handlers/telegram/webhook/env.ts:218](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/env.ts#L218)

#### Parameters

##### actionType

`"buy"` | `"sell"` | `"bid"`

#### Returns

`object`

##### chatLimit

> **chatLimit**: `number`

##### userLimit

> **userLimit**: `number`
