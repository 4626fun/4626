[**4626-web**](../../../../index.md)

***

[4626-web](../../../../index.md) / api/\_handlers/telegram/webhook/markdown

# api/\_handlers/telegram/webhook/markdown

## Type Aliases

### TelegramParseMode

> **TelegramParseMode** = `"Markdown"` \| `"HTML"` \| `null`

Defined in: [api/\_handlers/telegram/webhook/markdown.ts:3](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/telegram/webhook/markdown.ts#L3)

## Functions

### formatTelegramOutboundText()

> **formatTelegramOutboundText**(`text`): `object`

Defined in: [api/\_handlers/telegram/webhook/markdown.ts:15](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/telegram/webhook/markdown.ts#L15)

#### Parameters

##### text

`string`

#### Returns

`object`

##### parseMode

> **parseMode**: [`TelegramParseMode`](#telegramparsemode)

##### text

> **text**: `string`

***

### shouldUseTelegramHtml()

> **shouldUseTelegramHtml**(`text`): `boolean`

Defined in: [api/\_handlers/telegram/webhook/markdown.ts:11](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/telegram/webhook/markdown.ts#L11)

#### Parameters

##### text

`string`

#### Returns

`boolean`

***

### shouldUseTelegramMarkdown()

> **shouldUseTelegramMarkdown**(`text`): `boolean`

Defined in: [api/\_handlers/telegram/webhook/markdown.ts:5](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/telegram/webhook/markdown.ts#L5)

#### Parameters

##### text

`string`

#### Returns

`boolean`
