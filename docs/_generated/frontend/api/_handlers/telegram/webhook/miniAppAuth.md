[**4626-app**](../../../../index.md)

***

[4626-app](../../../../index.md) / api/\_handlers/telegram/webhook/miniAppAuth

# api/\_handlers/telegram/webhook/miniAppAuth

## Type Aliases

### TelegramMiniAppIdentity

> **TelegramMiniAppIdentity** = `object`

Defined in: [api/\_handlers/telegram/webhook/miniAppAuth.ts:7](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/api/_handlers/telegram/webhook/miniAppAuth.ts#L7)

#### Properties

##### authDate

> **authDate**: `number`

Defined in: [api/\_handlers/telegram/webhook/miniAppAuth.ts:13](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/api/_handlers/telegram/webhook/miniAppAuth.ts#L13)

##### chatId

> **chatId**: `string` \| `null`

Defined in: [api/\_handlers/telegram/webhook/miniAppAuth.ts:10](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/api/_handlers/telegram/webhook/miniAppAuth.ts#L10)

##### chatInstance

> **chatInstance**: `string` \| `null`

Defined in: [api/\_handlers/telegram/webhook/miniAppAuth.ts:12](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/api/_handlers/telegram/webhook/miniAppAuth.ts#L12)

##### chatType

> **chatType**: `string` \| `null`

Defined in: [api/\_handlers/telegram/webhook/miniAppAuth.ts:11](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/api/_handlers/telegram/webhook/miniAppAuth.ts#L11)

##### initDataHash

> **initDataHash**: `string`

Defined in: [api/\_handlers/telegram/webhook/miniAppAuth.ts:14](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/api/_handlers/telegram/webhook/miniAppAuth.ts#L14)

##### telegramUserId

> **telegramUserId**: `string`

Defined in: [api/\_handlers/telegram/webhook/miniAppAuth.ts:8](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/api/_handlers/telegram/webhook/miniAppAuth.ts#L8)

##### telegramUsername

> **telegramUsername**: `string` \| `null`

Defined in: [api/\_handlers/telegram/webhook/miniAppAuth.ts:9](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/api/_handlers/telegram/webhook/miniAppAuth.ts#L9)

***

### TelegramMiniAppInitDataVerificationResult

> **TelegramMiniAppInitDataVerificationResult** = \{ `identity`: [`TelegramMiniAppIdentity`](#telegramminiappidentity); `ok`: `true`; \} \| \{ `ok`: `false`; `reason`: `"missing_init_data"` \| `"invalid_init_data"` \| `"missing_hash"` \| `"invalid_hash_format"` \| `"invalid_hash"` \| `"missing_auth_date"` \| `"invalid_auth_date"` \| `"expired_auth_date"` \| `"future_auth_date"` \| `"missing_user"` \| `"invalid_user"`; \}

Defined in: [api/\_handlers/telegram/webhook/miniAppAuth.ts:17](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/api/_handlers/telegram/webhook/miniAppAuth.ts#L17)

***

### TelegramMiniAppVerificationFailureReason

> **TelegramMiniAppVerificationFailureReason** = `Extract`\<[`TelegramMiniAppInitDataVerificationResult`](#telegramminiappinitdataverificationresult), \{ `ok`: `false`; \}\>\[`"reason"`\]

Defined in: [api/\_handlers/telegram/webhook/miniAppAuth.ts:38](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/api/_handlers/telegram/webhook/miniAppAuth.ts#L38)

## Functions

### readTelegramMiniAppSessionToken()

> **readTelegramMiniAppSessionToken**(`params`): `string`

Defined in: [api/\_handlers/telegram/webhook/miniAppAuth.ts:223](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/api/_handlers/telegram/webhook/miniAppAuth.ts#L223)

#### Parameters

##### params

###### bodyToken?

`string` \| `null`

###### req

`Pick`\<`VercelRequest`, `"headers"`\>

#### Returns

`string`

***

### resolveTelegramMiniAppVerificationStatusCode()

> **resolveTelegramMiniAppVerificationStatusCode**(`reason`): `number`

Defined in: [api/\_handlers/telegram/webhook/miniAppAuth.ts:141](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/api/_handlers/telegram/webhook/miniAppAuth.ts#L141)

#### Parameters

##### reason

`"missing_init_data"` | `"invalid_init_data"` | `"missing_hash"` | `"invalid_hash_format"` | `"invalid_hash"` | `"missing_auth_date"` | `"invalid_auth_date"` | `"expired_auth_date"` | `"future_auth_date"` | `"missing_user"` | `"invalid_user"`

#### Returns

`number`

***

### verifyTelegramMiniAppInitData()

> **verifyTelegramMiniAppInitData**(`params`): [`TelegramMiniAppInitDataVerificationResult`](#telegramminiappinitdataverificationresult)

Defined in: [api/\_handlers/telegram/webhook/miniAppAuth.ts:161](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/api/_handlers/telegram/webhook/miniAppAuth.ts#L161)

#### Parameters

##### params

###### botToken

`string`

###### initData

`string`

###### maxAgeSeconds

`number`

###### nowMs?

`number`

#### Returns

[`TelegramMiniAppInitDataVerificationResult`](#telegramminiappinitdataverificationresult)
