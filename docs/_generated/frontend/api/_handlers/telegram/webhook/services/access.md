[**4626-app**](../../../../../index.md)

***

[4626-app](../../../../../index.md) / api/\_handlers/telegram/webhook/services/access

# api/\_handlers/telegram/webhook/services/access

## Functions

### isTelegramContextAllowed()

> **isTelegramContextAllowed**(`params`): `boolean`

Defined in: [api/\_handlers/telegram/webhook/services/access.ts:16](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/api/_handlers/telegram/webhook/services/access.ts#L16)

#### Parameters

##### params

###### allowAdminDm

`boolean`

###### allowPrivateDm

`boolean`

###### chatId

`string`

###### signalsChatId?

`string`

###### userId

`string`

#### Returns

`boolean`

***

### isTelegramMiniAppSessionEnabled()

> **isTelegramMiniAppSessionEnabled**(`params`): `boolean`

Defined in: [api/\_handlers/telegram/webhook/services/access.ts:48](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/api/_handlers/telegram/webhook/services/access.ts#L48)

#### Parameters

##### params

###### chatId?

`string` \| `null`

###### userId?

`string` \| `null`

#### Returns

`boolean`

***

### verifyBotConfigSecret()

> **verifyBotConfigSecret**(`req`): `boolean`

Defined in: [api/\_handlers/telegram/webhook/services/access.ts:34](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/api/_handlers/telegram/webhook/services/access.ts#L34)

#### Parameters

##### req

`Pick`\<`VercelRequest`, `"headers"`\>

#### Returns

`boolean`

***

### verifyTelegramLinkApiSecret()

> **verifyTelegramLinkApiSecret**(`req`): `boolean`

Defined in: [api/\_handlers/telegram/webhook/services/access.ts:41](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/api/_handlers/telegram/webhook/services/access.ts#L41)

#### Parameters

##### req

`Pick`\<`VercelRequest`, `"headers"`\>

#### Returns

`boolean`
