[**4626-app**](../../../../index.md)

***

[4626-app](../../../../index.md) / api/\_handlers/telegram/webhook/env

# api/\_handlers/telegram/webhook/env

## Type Aliases

### SenderWalletResolution

> **SenderWalletResolution** = `object`

Defined in: [api/\_handlers/telegram/webhook/env.ts:68](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/api/_handlers/telegram/webhook/env.ts#L68)

#### Properties

##### source

> **source**: [`SenderWalletResolutionSource`](#senderwalletresolutionsource-1)

Defined in: [api/\_handlers/telegram/webhook/env.ts:70](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/api/_handlers/telegram/webhook/env.ts#L70)

##### wallet

> **wallet**: `` `0x${string}` ``

Defined in: [api/\_handlers/telegram/webhook/env.ts:69](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/api/_handlers/telegram/webhook/env.ts#L69)

***

### SenderWalletResolutionSource

> **SenderWalletResolutionSource** = `"user_map"` \| `"default"` \| `"zero"`

Defined in: [api/\_handlers/telegram/webhook/env.ts:66](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/api/_handlers/telegram/webhook/env.ts#L66)

***

### TelegramInlineMediaAsset

> **TelegramInlineMediaAsset** = `object`

Defined in: [api/\_handlers/telegram/webhook/env.ts:5](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/api/_handlers/telegram/webhook/env.ts#L5)

#### Properties

##### documentMimeType?

> `optional` **documentMimeType**: `string`

Defined in: [api/\_handlers/telegram/webhook/env.ts:11](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/api/_handlers/telegram/webhook/env.ts#L11)

##### documentUrl?

> `optional` **documentUrl**: `string`

Defined in: [api/\_handlers/telegram/webhook/env.ts:10](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/api/_handlers/telegram/webhook/env.ts#L10)

##### mpeg4GifUrl?

> `optional` **mpeg4GifUrl**: `string`

Defined in: [api/\_handlers/telegram/webhook/env.ts:9](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/api/_handlers/telegram/webhook/env.ts#L9)

##### photoUrl?

> `optional` **photoUrl**: `string`

Defined in: [api/\_handlers/telegram/webhook/env.ts:6](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/api/_handlers/telegram/webhook/env.ts#L6)

##### thumbnailUrl?

> `optional` **thumbnailUrl**: `string`

Defined in: [api/\_handlers/telegram/webhook/env.ts:7](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/api/_handlers/telegram/webhook/env.ts#L7)

##### videoMimeType?

> `optional` **videoMimeType**: `string`

Defined in: [api/\_handlers/telegram/webhook/env.ts:12](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/api/_handlers/telegram/webhook/env.ts#L12)

##### videoUrl?

> `optional` **videoUrl**: `string`

Defined in: [api/\_handlers/telegram/webhook/env.ts:8](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/api/_handlers/telegram/webhook/env.ts#L8)

## Functions

### areHolderRoomsEnabled()

> **areHolderRoomsEnabled**(): `boolean`

Defined in: [api/\_handlers/telegram/webhook/env.ts:214](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/api/_handlers/telegram/webhook/env.ts#L214)

#### Returns

`boolean`

***

### getBaseRpcUrl()

> **getBaseRpcUrl**(): `string`

Defined in: [api/\_handlers/telegram/webhook/env.ts:151](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/api/_handlers/telegram/webhook/env.ts#L151)

#### Returns

`string`

***

### getBundlerAndPaymasterUrl()

> **getBundlerAndPaymasterUrl**(): `string`

Defined in: [api/\_handlers/telegram/webhook/env.ts:156](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/api/_handlers/telegram/webhook/env.ts#L156)

#### Returns

`string`

***

### isPrivateChatId()

> **isPrivateChatId**(`chatId`): `boolean`

Defined in: [api/\_handlers/telegram/webhook/env.ts:62](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/api/_handlers/telegram/webhook/env.ts#L62)

#### Parameters

##### chatId

`string`

#### Returns

`boolean`

***

### isTelegramAiFollowupEnabled()

> **isTelegramAiFollowupEnabled**(): `boolean`

Defined in: [api/\_handlers/telegram/webhook/env.ts:132](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/api/_handlers/telegram/webhook/env.ts#L132)

#### Returns

`boolean`

***

### isTelegramInlineGrowthModeEnabled()

> **isTelegramInlineGrowthModeEnabled**(): `boolean`

Defined in: [api/\_handlers/telegram/webhook/env.ts:164](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/api/_handlers/telegram/webhook/env.ts#L164)

#### Returns

`boolean`

***

### isTelegramInlinePmHandoffEnabled()

> **isTelegramInlinePmHandoffEnabled**(): `boolean`

Defined in: [api/\_handlers/telegram/webhook/env.ts:168](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/api/_handlers/telegram/webhook/env.ts#L168)

#### Returns

`boolean`

***

### isTelegramInlinePreparedEnabled()

> **isTelegramInlinePreparedEnabled**(): `boolean`

Defined in: [api/\_handlers/telegram/webhook/env.ts:172](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/api/_handlers/telegram/webhook/env.ts#L172)

#### Returns

`boolean`

***

### isTelegramPrivateDmEnabled()

> **isTelegramPrivateDmEnabled**(): `boolean`

Defined in: [api/\_handlers/telegram/webhook/env.ts:41](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/api/_handlers/telegram/webhook/env.ts#L41)

#### Returns

`boolean`

***

### isTradeMembershipCheckEnabled()

> **isTradeMembershipCheckEnabled**(): `boolean`

Defined in: [api/\_handlers/telegram/webhook/env.ts:231](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/api/_handlers/telegram/webhook/env.ts#L231)

#### Returns

`boolean`

***

### parseAdminUserIds()

> **parseAdminUserIds**(): `Set`\<`string`\>

Defined in: [api/\_handlers/telegram/webhook/env.ts:15](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/api/_handlers/telegram/webhook/env.ts#L15)

#### Returns

`Set`\<`string`\>

***

### parseAllowedChatIds()

> **parseAllowedChatIds**(): `Set`\<`string`\>

Defined in: [api/\_handlers/telegram/webhook/env.ts:26](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/api/_handlers/telegram/webhook/env.ts#L26)

#### Returns

`Set`\<`string`\>

***

### readEthUsdPrice()

> **readEthUsdPrice**(): `number`

Defined in: [api/\_handlers/telegram/webhook/env.ts:136](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/api/_handlers/telegram/webhook/env.ts#L136)

#### Returns

`number`

***

### readInlineMediaAssetMap()

> **readInlineMediaAssetMap**(): `Record`\<`string`, [`TelegramInlineMediaAsset`](#telegraminlinemediaasset)\>

Defined in: [api/\_handlers/telegram/webhook/env.ts:182](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/api/_handlers/telegram/webhook/env.ts#L182)

#### Returns

`Record`\<`string`, [`TelegramInlineMediaAsset`](#telegraminlinemediaasset)\>

***

### readInlineQueryResultCap()

> **readInlineQueryResultCap**(): `number`

Defined in: [api/\_handlers/telegram/webhook/env.ts:160](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/api/_handlers/telegram/webhook/env.ts#L160)

#### Returns

`number`

***

### readShareUsdFallback()

> **readShareUsdFallback**(): `number`

Defined in: [api/\_handlers/telegram/webhook/env.ts:145](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/api/_handlers/telegram/webhook/env.ts#L145)

#### Returns

`number`

***

### readTradeLimitFromEnv()

> **readTradeLimitFromEnv**(`key`, `fallback`): `number`

Defined in: [api/\_handlers/telegram/webhook/env.ts:218](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/api/_handlers/telegram/webhook/env.ts#L218)

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

Defined in: [api/\_handlers/telegram/webhook/env.ts:120](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/api/_handlers/telegram/webhook/env.ts#L120)

#### Parameters

##### chatId

`string`

#### Returns

`string`

***

### resolveSenderWallet()

> **resolveSenderWallet**(`userId`): `` `0x${string}` ``

Defined in: [api/\_handlers/telegram/webhook/env.ts:116](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/api/_handlers/telegram/webhook/env.ts#L116)

#### Parameters

##### userId

`string`

#### Returns

`` `0x${string}` ``

***

### resolveSenderWalletWithSource()

> **resolveSenderWalletWithSource**(`userId`): [`SenderWalletResolution`](#senderwalletresolution)

Defined in: [api/\_handlers/telegram/webhook/env.ts:79](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/api/_handlers/telegram/webhook/env.ts#L79)

#### Parameters

##### userId

`string`

#### Returns

[`SenderWalletResolution`](#senderwalletresolution)

***

### resolveSignalsDestination()

> **resolveSignalsDestination**(`sourceChatId`): `object`

Defined in: [api/\_handlers/telegram/webhook/env.ts:45](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/api/_handlers/telegram/webhook/env.ts#L45)

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

Defined in: [api/\_handlers/telegram/webhook/env.ts:208](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/api/_handlers/telegram/webhook/env.ts#L208)

#### Returns

`string`

***

### tradeRateLimitForAction()

> **tradeRateLimitForAction**(`actionType`): `object`

Defined in: [api/\_handlers/telegram/webhook/env.ts:224](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/api/_handlers/telegram/webhook/env.ts#L224)

#### Parameters

##### actionType

`"buy"` | `"sell"` | `"bid"`

#### Returns

`object`

##### chatLimit

> **chatLimit**: `number`

##### userLimit

> **userLimit**: `number`
