[**4626-app**](../../../../index.md)

***

[4626-app](../../../../index.md) / api/\_handlers/telegram/webhook/approvedTokens

# api/\_handlers/telegram/webhook/approvedTokens

## Type Aliases

### TelegramApprovedInlineToken

> **TelegramApprovedInlineToken** = `object`

Defined in: [api/\_handlers/telegram/webhook/approvedTokens.ts:5](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/approvedTokens.ts#L5)

#### Properties

##### address

> **address**: `` `0x${string}` ``

Defined in: [api/\_handlers/telegram/webhook/approvedTokens.ts:6](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/approvedTokens.ts#L6)

##### aliases

> **aliases**: `string`[]

Defined in: [api/\_handlers/telegram/webhook/approvedTokens.ts:10](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/approvedTokens.ts#L10)

##### analyzeLabel

> **analyzeLabel**: `string`

Defined in: [api/\_handlers/telegram/webhook/approvedTokens.ts:9](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/approvedTokens.ts#L9)

##### buyLabel

> **buyLabel**: `string`

Defined in: [api/\_handlers/telegram/webhook/approvedTokens.ts:8](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/approvedTokens.ts#L8)

##### symbol

> **symbol**: `string`

Defined in: [api/\_handlers/telegram/webhook/approvedTokens.ts:7](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/approvedTokens.ts#L7)

## Variables

### TELEGRAM\_APPROVED\_INLINE\_TOKENS

> `const` **TELEGRAM\_APPROVED\_INLINE\_TOKENS**: [`TelegramApprovedInlineToken`](#telegramapprovedinlinetoken)[]

Defined in: [api/\_handlers/telegram/webhook/approvedTokens.ts:21](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/approvedTokens.ts#L21)

## Functions

### buildTelegramAnalyzeInlineDraft()

> **buildTelegramAnalyzeInlineDraft**(`token`): `string`

Defined in: [api/\_handlers/telegram/webhook/approvedTokens.ts:64](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/approvedTokens.ts#L64)

#### Parameters

##### token

[`TelegramApprovedInlineToken`](#telegramapprovedinlinetoken)

#### Returns

`string`

***

### filterTelegramApprovedTradeVaults()

> **filterTelegramApprovedTradeVaults**\<`T`\>(`vaults`): `T` & `object`[]

Defined in: [api/\_handlers/telegram/webhook/approvedTokens.ts:68](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/approvedTokens.ts#L68)

#### Type Parameters

##### T

`T` *extends* `object`

#### Parameters

##### vaults

`T`[]

#### Returns

`T` & `object`[]

***

### getTelegramApprovedInlineTokenByAddress()

> **getTelegramApprovedInlineTokenByAddress**(`value`): [`TelegramApprovedInlineToken`](#telegramapprovedinlinetoken) \| `null`

Defined in: [api/\_handlers/telegram/webhook/approvedTokens.ts:49](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/approvedTokens.ts#L49)

#### Parameters

##### value

`unknown`

#### Returns

[`TelegramApprovedInlineToken`](#telegramapprovedinlinetoken) \| `null`

***

### resolveTelegramApprovedInlineTokenQuery()

> **resolveTelegramApprovedInlineTokenQuery**(`rawQuery`): [`TelegramApprovedInlineToken`](#telegramapprovedinlinetoken) \| `null`

Defined in: [api/\_handlers/telegram/webhook/approvedTokens.ts:55](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/approvedTokens.ts#L55)

#### Parameters

##### rawQuery

`string`

#### Returns

[`TelegramApprovedInlineToken`](#telegramapprovedinlinetoken) \| `null`
