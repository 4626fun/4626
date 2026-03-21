[**4626-app**](../../../../index.md)

***

[4626-app](../../../../index.md) / api/\_handlers/telegram/webhook/miniApp

# api/\_handlers/telegram/webhook/miniApp

## Variables

### TELEGRAM\_MINI\_APP\_LINK\_PATH

> `const` **TELEGRAM\_MINI\_APP\_LINK\_PATH**: `"/telegram/link"` = `'/telegram/link'`

Defined in: [api/\_handlers/telegram/webhook/miniApp.ts:4](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/api/_handlers/telegram/webhook/miniApp.ts#L4)

## Functions

### buildMiniAppLaunchButton()

> **buildMiniAppLaunchButton**(`params`): `Record`\<`string`, `unknown`\>

Defined in: [api/\_handlers/telegram/webhook/miniApp.ts:37](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/api/_handlers/telegram/webhook/miniApp.ts#L37)

#### Parameters

##### params

###### chatId

`string`

###### text

`string`

###### url

`string`

#### Returns

`Record`\<`string`, `unknown`\>

***

### buildTelegramMiniAppUrl()

> **buildTelegramMiniAppUrl**(`params`): `string`

Defined in: [api/\_handlers/telegram/webhook/miniApp.ts:16](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/api/_handlers/telegram/webhook/miniApp.ts#L16)

#### Parameters

##### params

###### baseUrl

`string`

###### pathname?

`string`

###### query?

`Record`\<`string`, `string`\>

#### Returns

`string`

***

### resolveTelegramMiniAppUrl()

> **resolveTelegramMiniAppUrl**(): `string`

Defined in: [api/\_handlers/telegram/webhook/miniApp.ts:10](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/api/_handlers/telegram/webhook/miniApp.ts#L10)

#### Returns

`string`
