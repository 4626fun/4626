[**4626-app**](../../../../index.md)

***

[4626-app](../../../../index.md) / api/\_handlers/telegram/webhook/miniAppAuth

# api/\_handlers/telegram/webhook/miniAppAuth

## Type Aliases

### TelegramMiniAppIdentity

> **TelegramMiniAppIdentity** = `object`

Defined in: [api/\_handlers/telegram/webhook/miniAppAuth.ts:7](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/api/_handlers/telegram/webhook/miniAppAuth.ts#L7)

#### Properties

##### authDate

> **authDate**: `number`

Defined in: [api/\_handlers/telegram/webhook/miniAppAuth.ts:13](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/api/_handlers/telegram/webhook/miniAppAuth.ts#L13)

##### chatId

> **chatId**: `string` \| `null`

Defined in: [api/\_handlers/telegram/webhook/miniAppAuth.ts:10](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/api/_handlers/telegram/webhook/miniAppAuth.ts#L10)

##### chatInstance

> **chatInstance**: `string` \| `null`

Defined in: [api/\_handlers/telegram/webhook/miniAppAuth.ts:12](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/api/_handlers/telegram/webhook/miniAppAuth.ts#L12)

##### chatType

> **chatType**: `string` \| `null`

Defined in: [api/\_handlers/telegram/webhook/miniAppAuth.ts:11](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/api/_handlers/telegram/webhook/miniAppAuth.ts#L11)

##### initDataHash

> **initDataHash**: `string`

Defined in: [api/\_handlers/telegram/webhook/miniAppAuth.ts:14](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/api/_handlers/telegram/webhook/miniAppAuth.ts#L14)

##### telegramUserId

> **telegramUserId**: `string`

Defined in: [api/\_handlers/telegram/webhook/miniAppAuth.ts:8](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/api/_handlers/telegram/webhook/miniAppAuth.ts#L8)

##### telegramUsername

> **telegramUsername**: `string` \| `null`

Defined in: [api/\_handlers/telegram/webhook/miniAppAuth.ts:9](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/api/_handlers/telegram/webhook/miniAppAuth.ts#L9)

***

### TelegramMiniAppInitDataVerificationResult

> **TelegramMiniAppInitDataVerificationResult** = \{ `identity`: [`TelegramMiniAppIdentity`](#telegramminiappidentity); `ok`: `true`; \} \| \{ `ok`: `false`; `reason`: `"missing_init_data"` \| `"invalid_init_data"` \| `"missing_hash"` \| `"invalid_hash_format"` \| `"invalid_hash"` \| `"missing_auth_date"` \| `"invalid_auth_date"` \| `"expired_auth_date"` \| `"future_auth_date"` \| `"missing_user"` \| `"invalid_user"`; \}

Defined in: [api/\_handlers/telegram/webhook/miniAppAuth.ts:17](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/api/_handlers/telegram/webhook/miniAppAuth.ts#L17)

***

### TelegramMiniAppVerificationFailureReason

> **TelegramMiniAppVerificationFailureReason** = `Extract`\<[`TelegramMiniAppInitDataVerificationResult`](#telegramminiappinitdataverificationresult), \{ `ok`: `false`; \}\>\[`"reason"`\]

Defined in: [api/\_handlers/telegram/webhook/miniAppAuth.ts:38](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/api/_handlers/telegram/webhook/miniAppAuth.ts#L38)

## Functions

### readTelegramMiniAppSessionToken()

> **readTelegramMiniAppSessionToken**(`params`): `string`

Defined in: [api/\_handlers/telegram/webhook/miniAppAuth.ts:207](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/api/_handlers/telegram/webhook/miniAppAuth.ts#L207)

#### Parameters

##### params

###### bodyToken?

`string` \| `null`

###### req

`Pick`\<[`VercelRequest`](../../../../src/types/vercel-node.md#vercelrequest), `"headers"`\>

#### Returns

`string`

***

### resolveTelegramMiniAppVerificationStatusCode()

> **resolveTelegramMiniAppVerificationStatusCode**(`reason`): `number`

Defined in: [api/\_handlers/telegram/webhook/miniAppAuth.ts:125](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/api/_handlers/telegram/webhook/miniAppAuth.ts#L125)

#### Parameters

##### reason

`"missing_init_data"` | `"invalid_init_data"` | `"missing_hash"` | `"invalid_hash_format"` | `"invalid_hash"` | `"missing_auth_date"` | `"invalid_auth_date"` | `"expired_auth_date"` | `"future_auth_date"` | `"missing_user"` | `"invalid_user"`

#### Returns

`number`

***

### verifyTelegramMiniAppInitData()

> **verifyTelegramMiniAppInitData**(`params`): [`TelegramMiniAppInitDataVerificationResult`](#telegramminiappinitdataverificationresult)

Defined in: [api/\_handlers/telegram/webhook/miniAppAuth.ts:145](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/api/_handlers/telegram/webhook/miniAppAuth.ts#L145)

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
