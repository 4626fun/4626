[**4626-web**](../../../../index.md)

***

[4626-web](../../../../index.md) / api/\_handlers/telegram/webhook/ingress

# api/\_handlers/telegram/webhook/ingress

## Type Aliases

### TelegramWebhookIngressLane

> **TelegramWebhookIngressLane** = `"canonical"` \| `"hermit"`

Defined in: [api/\_handlers/telegram/webhook/ingress.ts:5](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/ingress.ts#L5)

## Functions

### readHermitTelegramBotToken()

> **readHermitTelegramBotToken**(`env`): `string`

Defined in: [api/\_handlers/telegram/webhook/ingress.ts:50](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/ingress.ts#L50)

#### Parameters

##### env

`Record`\<`string`, `string` \| `undefined`\> = `process.env`

#### Returns

`string`

***

### readHermitTelegramWebhookSecret()

> **readHermitTelegramWebhookSecret**(`env`): `string`

Defined in: [api/\_handlers/telegram/webhook/ingress.ts:44](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/ingress.ts#L44)

#### Parameters

##### env

`Record`\<`string`, `string` \| `undefined`\> = `process.env`

#### Returns

`string`

***

### readTelegramToAlfaclubIngressHost()

> **readTelegramToAlfaclubIngressHost**(`env`): `string` \| `null`

Defined in: [api/\_handlers/telegram/webhook/ingress.ts:22](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/ingress.ts#L22)

When set, Telegram → AlfaClub relay runs only on this host (e.g. hermit.4626.fun).

#### Parameters

##### env

`Record`\<`string`, `string` \| `undefined`\> = `process.env`

#### Returns

`string` \| `null`

***

### readTelegramWebhookHost()

> **readTelegramWebhookHost**(`req`): `string`

Defined in: [api/\_handlers/telegram/webhook/ingress.ts:14](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/ingress.ts#L14)

#### Parameters

##### req

`Pick`\<`VercelRequest`, `"headers"`\>

#### Returns

`string`

***

### resolveTelegramWebhookIngressLane()

> **resolveTelegramWebhookIngressLane**(`req`, `env`): [`TelegramWebhookIngressLane`](#telegramwebhookingresslane)

Defined in: [api/\_handlers/telegram/webhook/ingress.ts:29](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/ingress.ts#L29)

#### Parameters

##### req

`Pick`\<`VercelRequest`, `"headers"`\>

##### env

`Record`\<`string`, `string` \| `undefined`\> = `process.env`

#### Returns

[`TelegramWebhookIngressLane`](#telegramwebhookingresslane)

***

### shouldRelayTelegramToAlfaclubOnCanonicalWebhook()

> **shouldRelayTelegramToAlfaclubOnCanonicalWebhook**(`env`): `boolean`

Defined in: [api/\_handlers/telegram/webhook/ingress.ts:38](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/ingress.ts#L38)

#### Parameters

##### env

`Record`\<`string`, `string` \| `undefined`\> = `process.env`

#### Returns

`boolean`
