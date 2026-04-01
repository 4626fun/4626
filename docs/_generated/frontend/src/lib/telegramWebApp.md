[**4626-app**](../../index.md)

***

[4626-app](../../index.md) / src/lib/telegramWebApp

# src/lib/telegramWebApp

## Type Aliases

### PrivyTelegramLaunchParams

> **PrivyTelegramLaunchParams** = `object`

Defined in: [src/lib/telegramWebApp.ts:274](https://github.com/wenakita/4626/blob/main/frontend/src/lib/telegramWebApp.ts#L274)

#### Properties

##### initDataRaw?

> `optional` **initDataRaw**: `string`

Defined in: [src/lib/telegramWebApp.ts:275](https://github.com/wenakita/4626/blob/main/frontend/src/lib/telegramWebApp.ts#L275)

***

### TelegramInlineQueryChatType

> **TelegramInlineQueryChatType** = `"users"` \| `"bots"` \| `"groups"` \| `"channels"`

Defined in: [src/lib/telegramWebApp.ts:33](https://github.com/wenakita/4626/blob/main/frontend/src/lib/telegramWebApp.ts#L33)

***

### TelegramMiniAppSession

> **TelegramMiniAppSession** = `object`

Defined in: [src/lib/telegramWebApp.ts:76](https://github.com/wenakita/4626/blob/main/frontend/src/lib/telegramWebApp.ts#L76)

#### Properties

##### chatId

> **chatId**: `string` \| `null`

Defined in: [src/lib/telegramWebApp.ts:82](https://github.com/wenakita/4626/blob/main/frontend/src/lib/telegramWebApp.ts#L82)

##### chatInstance

> **chatInstance**: `string` \| `null`

Defined in: [src/lib/telegramWebApp.ts:84](https://github.com/wenakita/4626/blob/main/frontend/src/lib/telegramWebApp.ts#L84)

##### chatType

> **chatType**: `string` \| `null`

Defined in: [src/lib/telegramWebApp.ts:83](https://github.com/wenakita/4626/blob/main/frontend/src/lib/telegramWebApp.ts#L83)

##### expiresAt

> **expiresAt**: `string`

Defined in: [src/lib/telegramWebApp.ts:79](https://github.com/wenakita/4626/blob/main/frontend/src/lib/telegramWebApp.ts#L79)

##### initData

> **initData**: `string`

Defined in: [src/lib/telegramWebApp.ts:77](https://github.com/wenakita/4626/blob/main/frontend/src/lib/telegramWebApp.ts#L77)

##### sessionToken

> **sessionToken**: `string`

Defined in: [src/lib/telegramWebApp.ts:78](https://github.com/wenakita/4626/blob/main/frontend/src/lib/telegramWebApp.ts#L78)

##### telegramUserId

> **telegramUserId**: `string`

Defined in: [src/lib/telegramWebApp.ts:80](https://github.com/wenakita/4626/blob/main/frontend/src/lib/telegramWebApp.ts#L80)

##### telegramUsername

> **telegramUsername**: `string` \| `null`

Defined in: [src/lib/telegramWebApp.ts:81](https://github.com/wenakita/4626/blob/main/frontend/src/lib/telegramWebApp.ts#L81)

## Functions

### clearTelegramMiniAppSession()

> **clearTelegramMiniAppSession**(): `void`

Defined in: [src/lib/telegramWebApp.ts:168](https://github.com/wenakita/4626/blob/main/frontend/src/lib/telegramWebApp.ts#L168)

#### Returns

`void`

***

### ensureTelegramMiniAppSession()

> **ensureTelegramMiniAppSession**(`params?`): `Promise`\<`EnsureTelegramMiniAppSessionResult`\>

Defined in: [src/lib/telegramWebApp.ts:395](https://github.com/wenakita/4626/blob/main/frontend/src/lib/telegramWebApp.ts#L395)

#### Parameters

##### params?

###### fetcher?

(`path`, `init?`) => `Promise`\<`Response`\>

###### flowId?

`string`

###### timeoutMs?

`number`

#### Returns

`Promise`\<`EnsureTelegramMiniAppSessionResult`\>

***

### hasTelegramMiniAppEntrypointContext()

> **hasTelegramMiniAppEntrypointContext**(): `boolean`

Defined in: [src/lib/telegramWebApp.ts:248](https://github.com/wenakita/4626/blob/main/frontend/src/lib/telegramWebApp.ts#L248)

#### Returns

`boolean`

***

### isTelegramMiniAppContext()

> **isTelegramMiniAppContext**(): `boolean`

Defined in: [src/lib/telegramWebApp.ts:244](https://github.com/wenakita/4626/blob/main/frontend/src/lib/telegramWebApp.ts#L244)

#### Returns

`boolean`

***

### loadTelegramWebApp()

> **loadTelegramWebApp**(): `Promise`\<`TelegramWebAppLike` \| `null`\>

Defined in: [src/lib/telegramWebApp.ts:284](https://github.com/wenakita/4626/blob/main/frontend/src/lib/telegramWebApp.ts#L284)

#### Returns

`Promise`\<`TelegramWebAppLike` \| `null`\>

***

### readPrivyTelegramLaunchParams()

> **readPrivyTelegramLaunchParams**(): [`PrivyTelegramLaunchParams`](#privytelegramlaunchparams) \| `null`

Defined in: [src/lib/telegramWebApp.ts:278](https://github.com/wenakita/4626/blob/main/frontend/src/lib/telegramWebApp.ts#L278)

#### Returns

[`PrivyTelegramLaunchParams`](#privytelegramlaunchparams) \| `null`

***

### readTelegramMiniAppIdentityKey()

> **readTelegramMiniAppIdentityKey**(): `string`

Defined in: [src/lib/telegramWebApp.ts:268](https://github.com/wenakita/4626/blob/main/frontend/src/lib/telegramWebApp.ts#L268)

#### Returns

`string`

***

### readTelegramMiniAppInitData()

> **readTelegramMiniAppInitData**(): `string`

Defined in: [src/lib/telegramWebApp.ts:240](https://github.com/wenakita/4626/blob/main/frontend/src/lib/telegramWebApp.ts#L240)

#### Returns

`string`

***

### readTelegramWebApp()

> **readTelegramWebApp**(): `TelegramWebAppLike` \| `null`

Defined in: [src/lib/telegramWebApp.ts:222](https://github.com/wenakita/4626/blob/main/frontend/src/lib/telegramWebApp.ts#L222)

#### Returns

`TelegramWebAppLike` \| `null`

***

### setupTelegramMiniAppUi()

> **setupTelegramMiniAppUi**(`params?`): () => `void`

Defined in: [src/lib/telegramWebApp.ts:352](https://github.com/wenakita/4626/blob/main/frontend/src/lib/telegramWebApp.ts#L352)

#### Parameters

##### params?

###### requestExpand?

`boolean`

#### Returns

> (): `void`

##### Returns

`void`

***

### switchTelegramMiniAppInlineQuery()

> **switchTelegramMiniAppInlineQuery**(`params?`): `boolean`

Defined in: [src/lib/telegramWebApp.ts:226](https://github.com/wenakita/4626/blob/main/frontend/src/lib/telegramWebApp.ts#L226)

#### Parameters

##### params?

###### chatTypes?

[`TelegramInlineQueryChatType`](#telegraminlinequerychattype)[]

###### query?

`string`

#### Returns

`boolean`
