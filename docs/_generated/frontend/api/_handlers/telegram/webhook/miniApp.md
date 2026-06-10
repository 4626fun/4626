[**4626-web**](../../../../index.md)

***

[4626-web](../../../../index.md) / api/\_handlers/telegram/webhook/miniApp

# api/\_handlers/telegram/webhook/miniApp

## Variables

### TELEGRAM\_MINI\_APP\_LINK\_PATH

> `const` **TELEGRAM\_MINI\_APP\_LINK\_PATH**: `"/telegram/link"` = `'/telegram/link'`

Defined in: [api/\_handlers/telegram/webhook/miniApp.ts:4](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/miniApp.ts#L4)

***

### TELEGRAM\_MINI\_APP\_ORIGIN

> `const` **TELEGRAM\_MINI\_APP\_ORIGIN**: `"https://4626.fun"` = `'https://4626.fun'`

Defined in: [api/\_handlers/telegram/webhook/miniApp.ts:5](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/miniApp.ts#L5)

## Functions

### buildMiniAppLaunchButton()

> **buildMiniAppLaunchButton**(`params`): `Record`\<`string`, `unknown`\>

Defined in: [api/\_handlers/telegram/webhook/miniApp.ts:52](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/miniApp.ts#L52)

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

Defined in: [api/\_handlers/telegram/webhook/miniApp.ts:31](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/miniApp.ts#L31)

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

### normalizeTelegramMiniAppBaseUrl()

> **normalizeTelegramMiniAppBaseUrl**(`value`): `string`

Defined in: [api/\_handlers/telegram/webhook/miniApp.ts:11](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/miniApp.ts#L11)

#### Parameters

##### value

`string`

#### Returns

`string`

***

### resolveTelegramMiniAppUrl()

> **resolveTelegramMiniAppUrl**(): `string`

Defined in: [api/\_handlers/telegram/webhook/miniApp.ts:25](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/miniApp.ts#L25)

#### Returns

`string`
