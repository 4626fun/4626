[**4626-app**](../../../../index.md)

***

[4626-app](../../../../index.md) / api/\_handlers/telegram/webhook/env

# api/\_handlers/telegram/webhook/env

## Type Aliases

### SenderWalletResolution

> **SenderWalletResolution** = `object`

Defined in: [api/\_handlers/telegram/webhook/env.ts:68](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/env.ts#L68)

#### Properties

##### source

> **source**: [`SenderWalletResolutionSource`](#senderwalletresolutionsource-1)

Defined in: [api/\_handlers/telegram/webhook/env.ts:70](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/env.ts#L70)

##### wallet

> **wallet**: `` `0x${string}` ``

Defined in: [api/\_handlers/telegram/webhook/env.ts:69](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/env.ts#L69)

***

### SenderWalletResolutionSource

> **SenderWalletResolutionSource** = `"user_map"` \| `"default"` \| `"zero"`

Defined in: [api/\_handlers/telegram/webhook/env.ts:66](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/env.ts#L66)

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

Defined in: [api/\_handlers/telegram/webhook/env.ts:196](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/env.ts#L196)

#### Returns

`boolean`

***

### getBaseRpcUrl()

> **getBaseRpcUrl**(): `string`

Defined in: [api/\_handlers/telegram/webhook/env.ts:133](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/env.ts#L133)

#### Returns

`string`

***

### getBundlerAndPaymasterUrl()

> **getBundlerAndPaymasterUrl**(): `string`

Defined in: [api/\_handlers/telegram/webhook/env.ts:138](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/env.ts#L138)

#### Returns

`string`

***

### isPrivateChatId()

> **isPrivateChatId**(`chatId`): `boolean`

Defined in: [api/\_handlers/telegram/webhook/env.ts:62](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/env.ts#L62)

#### Parameters

##### chatId

`string`

#### Returns

`boolean`

***

### isTelegramAiFollowupEnabled()

> **isTelegramAiFollowupEnabled**(): `boolean`

Defined in: [api/\_handlers/telegram/webhook/env.ts:114](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/env.ts#L114)

#### Returns

`boolean`

***

### isTelegramInlineGrowthModeEnabled()

> **isTelegramInlineGrowthModeEnabled**(): `boolean`

Defined in: [api/\_handlers/telegram/webhook/env.ts:146](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/env.ts#L146)

#### Returns

`boolean`

***

### isTelegramInlinePmHandoffEnabled()

> **isTelegramInlinePmHandoffEnabled**(): `boolean`

Defined in: [api/\_handlers/telegram/webhook/env.ts:150](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/env.ts#L150)

#### Returns

`boolean`

***

### isTelegramInlinePreparedEnabled()

> **isTelegramInlinePreparedEnabled**(): `boolean`

Defined in: [api/\_handlers/telegram/webhook/env.ts:154](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/env.ts#L154)

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

Defined in: [api/\_handlers/telegram/webhook/env.ts:213](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/env.ts#L213)

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

Defined in: [api/\_handlers/telegram/webhook/env.ts:118](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/env.ts#L118)

#### Returns

`number`

***

### readInlineMediaAssetMap()

> **readInlineMediaAssetMap**(): `Record`\<`string`, [`TelegramInlineMediaAsset`](#telegraminlinemediaasset)\>

Defined in: [api/\_handlers/telegram/webhook/env.ts:164](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/env.ts#L164)

#### Returns

`Record`\<`string`, [`TelegramInlineMediaAsset`](#telegraminlinemediaasset)\>

***

### readInlineQueryResultCap()

> **readInlineQueryResultCap**(): `number`

Defined in: [api/\_handlers/telegram/webhook/env.ts:142](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/env.ts#L142)

#### Returns

`number`

***

### readShareUsdFallback()

> **readShareUsdFallback**(): `number`

Defined in: [api/\_handlers/telegram/webhook/env.ts:127](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/env.ts#L127)

#### Returns

`number`

***

### readTradeLimitFromEnv()

> **readTradeLimitFromEnv**(`key`, `fallback`): `number`

Defined in: [api/\_handlers/telegram/webhook/env.ts:200](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/env.ts#L200)

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

Defined in: [api/\_handlers/telegram/webhook/env.ts:102](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/env.ts#L102)

#### Parameters

##### chatId

`string`

#### Returns

`string`

***

### resolveSenderWallet()

> **resolveSenderWallet**(`userId`): `` `0x${string}` ``

Defined in: [api/\_handlers/telegram/webhook/env.ts:98](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/env.ts#L98)

#### Parameters

##### userId

`string`

#### Returns

`` `0x${string}` ``

***

### resolveSenderWalletWithSource()

> **resolveSenderWalletWithSource**(`userId`): [`SenderWalletResolution`](#senderwalletresolution)

Defined in: [api/\_handlers/telegram/webhook/env.ts:73](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/env.ts#L73)

#### Parameters

##### userId

`string`

#### Returns

[`SenderWalletResolution`](#senderwalletresolution)

***

### resolveSignalsDestination()

> **resolveSignalsDestination**(`sourceChatId`): `object`

Defined in: [api/\_handlers/telegram/webhook/env.ts:45](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/env.ts#L45)

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

Defined in: [api/\_handlers/telegram/webhook/env.ts:190](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/env.ts#L190)

#### Returns

`string`

***

### tradeRateLimitForAction()

> **tradeRateLimitForAction**(`actionType`): `object`

Defined in: [api/\_handlers/telegram/webhook/env.ts:206](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/env.ts#L206)

#### Parameters

##### actionType

`"buy"` | `"sell"` | `"bid"`

#### Returns

`object`

##### chatLimit

> **chatLimit**: `number`

##### userLimit

> **userLimit**: `number`
