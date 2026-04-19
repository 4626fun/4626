[**4626-app**](../../../../../index.md)

***

[4626-app](../../../../../index.md) / api/\_handlers/telegram/webhook/services/trade

# api/\_handlers/telegram/webhook/services/trade

## Functions

### checkTelegramTradeRateLimit()

> **checkTelegramTradeRateLimit**(`params`): \{ `ok`: `true`; \} \| \{ `ok`: `false`; `reason`: `"rate_limit_user"` \| `"rate_limit_chat"`; `retryAfterSeconds`: `number`; \}

Defined in: [api/\_handlers/telegram/webhook/services/trade.ts:23](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/api/_handlers/telegram/webhook/services/trade.ts#L23)

#### Parameters

##### params

###### actionType

`"buy"` \| `"sell"` \| `"bid"`

###### chatId

`string`

###### userId

`string`

#### Returns

\{ `ok`: `true`; \} \| \{ `ok`: `false`; `reason`: `"rate_limit_user"` \| `"rate_limit_chat"`; `retryAfterSeconds`: `number`; \}

***

### readTradeLimitFromEnv()

> **readTradeLimitFromEnv**(`key`, `fallback`): `number`

Defined in: [api/\_handlers/telegram/webhook/services/trade.ts:4](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/api/_handlers/telegram/webhook/services/trade.ts#L4)

#### Parameters

##### key

`string`

##### fallback

`number`

#### Returns

`number`

***

### tradeRateLimitForAction()

> **tradeRateLimitForAction**(`actionType`): `object`

Defined in: [api/\_handlers/telegram/webhook/services/trade.ts:10](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/api/_handlers/telegram/webhook/services/trade.ts#L10)

#### Parameters

##### actionType

`"buy"` | `"sell"` | `"bid"`

#### Returns

`object`

##### chatLimit

> **chatLimit**: `number`

##### userLimit

> **userLimit**: `number`
