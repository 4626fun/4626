[**4626-app**](../../index.md)

***

[4626-app](../../index.md) / src/lib/telegramWebApp

# src/lib/telegramWebApp

## Type Aliases

### PrivyTelegramLaunchParams

> **PrivyTelegramLaunchParams** = `object`

Defined in: [src/lib/telegramWebApp.ts:311](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/lib/telegramWebApp.ts#L311)

#### Properties

##### initDataRaw?

> `optional` **initDataRaw**: `string`

Defined in: [src/lib/telegramWebApp.ts:312](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/lib/telegramWebApp.ts#L312)

***

### TelegramInlineQueryChatType

> **TelegramInlineQueryChatType** = `"users"` \| `"bots"` \| `"groups"` \| `"channels"`

Defined in: [src/lib/telegramWebApp.ts:33](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/lib/telegramWebApp.ts#L33)

***

### TelegramMiniAppSession

> **TelegramMiniAppSession** = `object`

Defined in: [src/lib/telegramWebApp.ts:83](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/lib/telegramWebApp.ts#L83)

#### Properties

##### chatId

> **chatId**: `string` \| `null`

Defined in: [src/lib/telegramWebApp.ts:89](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/lib/telegramWebApp.ts#L89)

##### chatInstance

> **chatInstance**: `string` \| `null`

Defined in: [src/lib/telegramWebApp.ts:91](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/lib/telegramWebApp.ts#L91)

##### chatType

> **chatType**: `string` \| `null`

Defined in: [src/lib/telegramWebApp.ts:90](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/lib/telegramWebApp.ts#L90)

##### expiresAt

> **expiresAt**: `string`

Defined in: [src/lib/telegramWebApp.ts:86](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/lib/telegramWebApp.ts#L86)

##### initData

> **initData**: `string`

Defined in: [src/lib/telegramWebApp.ts:84](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/lib/telegramWebApp.ts#L84)

##### sessionToken

> **sessionToken**: `string`

Defined in: [src/lib/telegramWebApp.ts:85](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/lib/telegramWebApp.ts#L85)

##### telegramUserId

> **telegramUserId**: `string`

Defined in: [src/lib/telegramWebApp.ts:87](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/lib/telegramWebApp.ts#L87)

##### telegramUsername

> **telegramUsername**: `string` \| `null`

Defined in: [src/lib/telegramWebApp.ts:88](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/lib/telegramWebApp.ts#L88)

## Functions

### clearTelegramMiniAppSession()

> **clearTelegramMiniAppSession**(): `void`

Defined in: [src/lib/telegramWebApp.ts:175](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/lib/telegramWebApp.ts#L175)

#### Returns

`void`

***

### ensureTelegramMiniAppSession()

> **ensureTelegramMiniAppSession**(`params?`): `Promise`\<`EnsureTelegramMiniAppSessionResult`\>

Defined in: [src/lib/telegramWebApp.ts:432](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/lib/telegramWebApp.ts#L432)

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

Defined in: [src/lib/telegramWebApp.ts:285](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/lib/telegramWebApp.ts#L285)

#### Returns

`boolean`

***

### isTelegramMiniAppContext()

> **isTelegramMiniAppContext**(): `boolean`

Defined in: [src/lib/telegramWebApp.ts:251](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/lib/telegramWebApp.ts#L251)

#### Returns

`boolean`

***

### loadTelegramWebApp()

> **loadTelegramWebApp**(): `Promise`\<`TelegramWebAppLike` \| `null`\>

Defined in: [src/lib/telegramWebApp.ts:321](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/lib/telegramWebApp.ts#L321)

#### Returns

`Promise`\<`TelegramWebAppLike` \| `null`\>

***

### openTelegramExternalLink()

> **openTelegramExternalLink**(`url`): `boolean`

Defined in: [src/lib/telegramWebApp.ts:255](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/lib/telegramWebApp.ts#L255)

#### Parameters

##### url

`string`

#### Returns

`boolean`

***

### readPrivyTelegramLaunchParams()

> **readPrivyTelegramLaunchParams**(): [`PrivyTelegramLaunchParams`](#privytelegramlaunchparams) \| `null`

Defined in: [src/lib/telegramWebApp.ts:315](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/lib/telegramWebApp.ts#L315)

#### Returns

[`PrivyTelegramLaunchParams`](#privytelegramlaunchparams) \| `null`

***

### readTelegramMiniAppIdentityKey()

> **readTelegramMiniAppIdentityKey**(): `string`

Defined in: [src/lib/telegramWebApp.ts:305](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/lib/telegramWebApp.ts#L305)

#### Returns

`string`

***

### readTelegramMiniAppInitData()

> **readTelegramMiniAppInitData**(): `string`

Defined in: [src/lib/telegramWebApp.ts:247](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/lib/telegramWebApp.ts#L247)

#### Returns

`string`

***

### readTelegramWebApp()

> **readTelegramWebApp**(): `TelegramWebAppLike` \| `null`

Defined in: [src/lib/telegramWebApp.ts:229](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/lib/telegramWebApp.ts#L229)

#### Returns

`TelegramWebAppLike` \| `null`

***

### setupTelegramMiniAppUi()

> **setupTelegramMiniAppUi**(`params?`): () => `void`

Defined in: [src/lib/telegramWebApp.ts:389](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/lib/telegramWebApp.ts#L389)

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

Defined in: [src/lib/telegramWebApp.ts:233](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/lib/telegramWebApp.ts#L233)

#### Parameters

##### params?

###### chatTypes?

[`TelegramInlineQueryChatType`](#telegraminlinequerychattype)[]

###### query?

`string`

#### Returns

`boolean`
