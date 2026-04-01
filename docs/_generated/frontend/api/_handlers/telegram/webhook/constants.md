[**4626-app**](../../../../index.md)

***

[4626-app](../../../../index.md) / api/\_handlers/telegram/webhook/constants

# api/\_handlers/telegram/webhook/constants

## Type Aliases

### TelegramBotMenuCommand

> **TelegramBotMenuCommand** = `object`

Defined in: [server/commands/registry.ts:3](https://github.com/wenakita/4626/blob/main/frontend/server/commands/registry.ts#L3)

#### Properties

##### command

> **command**: `string`

Defined in: [server/commands/registry.ts:4](https://github.com/wenakita/4626/blob/main/frontend/server/commands/registry.ts#L4)

##### description

> **description**: `string`

Defined in: [server/commands/registry.ts:5](https://github.com/wenakita/4626/blob/main/frontend/server/commands/registry.ts#L5)

## Variables

### CCA\_AUCTION\_ABI

> `const` **CCA\_AUCTION\_ABI**: readonly \[\{ `inputs`: readonly \[\{ `name`: `"maxPrice"`; `type`: `"uint256"`; \}, \{ `name`: `"amount"`; `type`: `"uint128"`; \}, \{ `name`: `"owner"`; `type`: `"address"`; \}, \{ `name`: `"hookData"`; `type`: `"bytes"`; \}\]; `name`: `"submitBid"`; `outputs`: readonly \[\{ `name`: `"bidId"`; `type`: `"uint256"`; \}\]; `stateMutability`: `"payable"`; `type`: `"function"`; \}\]

Defined in: [api/\_handlers/telegram/webhook/constants.ts:98](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/constants.ts#L98)

***

### CCA\_LAUNCH\_STRATEGY\_ABI

> `const` **CCA\_LAUNCH\_STRATEGY\_ABI**: readonly \[\{ `inputs`: readonly \[\]; `name`: `"getAuctionStatus"`; `outputs`: readonly \[\{ `name`: `"auction"`; `type`: `"address"`; \}, \{ `name`: `"isActive"`; `type`: `"bool"`; \}, \{ `name`: `"isGraduated"`; `type`: `"bool"`; \}, \{ `name`: `"clearingPrice"`; `type`: `"uint256"`; \}, \{ `name`: `"currencyRaised"`; `type`: `"uint256"`; \}\]; `stateMutability`: `"view"`; `type`: `"function"`; \}, \{ `inputs`: readonly \[\]; `name`: `"auctionToken"`; `outputs`: readonly \[\{ `type`: `"address"`; \}\]; `stateMutability`: `"view"`; `type`: `"function"`; \}\]

Defined in: [api/\_handlers/telegram/webhook/constants.ts:58](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/constants.ts#L58)

***

### DEPLOY\_CURRENCY\_VALUES

> `const` **DEPLOY\_CURRENCY\_VALUES**: [`DeployCurrencyInput`](types.md#deploycurrencyinput)[]

Defined in: [api/\_handlers/telegram/webhook/constants.ts:54](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/constants.ts#L54)

***

### ERC20\_VIEW\_ABI

> `const` **ERC20\_VIEW\_ABI**: readonly \[\{ `inputs`: readonly \[\]; `name`: `"decimals"`; `outputs`: readonly \[\{ `type`: `"uint8"`; \}\]; `stateMutability`: `"view"`; `type`: `"function"`; \}, \{ `inputs`: readonly \[\]; `name`: `"symbol"`; `outputs`: readonly \[\{ `type`: `"string"`; \}\]; `stateMutability`: `"view"`; `type`: `"function"`; \}\]

Defined in: [api/\_handlers/telegram/webhook/constants.ts:81](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/constants.ts#L81)

***

### Q96

> `const` **Q96**: `bigint`

Defined in: [api/\_handlers/telegram/webhook/constants.ts:114](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/constants.ts#L114)

***

### SUPPORTED\_METADATA\_URI\_PREFIXES

> `const` **SUPPORTED\_METADATA\_URI\_PREFIXES**: readonly \[`"https://"`, `"http://"`, `"ipfs://"`, `"ar://"`, `"data:"`\]

Defined in: [api/\_handlers/telegram/webhook/constants.ts:56](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/constants.ts#L56)

***

### TELEGRAM\_ADMIN\_BOT\_COMMANDS

> `const` **TELEGRAM\_ADMIN\_BOT\_COMMANDS**: [`TelegramBotMenuCommand`](#telegrambotmenucommand)[]

Defined in: [api/\_handlers/telegram/webhook/constants.ts:52](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/constants.ts#L52)

***

### TELEGRAM\_COMMAND\_HEADS

> `const` **TELEGRAM\_COMMAND\_HEADS**: `string`[] = `SHARED_TELEGRAM_COMMAND_HEADS`

Defined in: [api/\_handlers/telegram/webhook/constants.ts:17](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/constants.ts#L17)

***

### TELEGRAM\_COMMAND\_HEADS\_PATTERN

> `const` **TELEGRAM\_COMMAND\_HEADS\_PATTERN**: `string` = `SHARED_TELEGRAM_COMMAND_HEADS_PATTERN`

Defined in: [api/\_handlers/telegram/webhook/constants.ts:19](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/constants.ts#L19)

***

### TELEGRAM\_COMMAND\_MICRO\_HINTS

> `const` **TELEGRAM\_COMMAND\_MICRO\_HINTS**: `object`[]

Defined in: [api/\_handlers/telegram/webhook/constants.ts:21](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/constants.ts#L21)

#### Type Declaration

##### hint

> **hint**: `string`

##### pattern

> **pattern**: `RegExp`

***

### TELEGRAM\_GROUP\_BOT\_COMMANDS

> `const` **TELEGRAM\_GROUP\_BOT\_COMMANDS**: [`TelegramBotMenuCommand`](#telegrambotmenucommand)[]

Defined in: [api/\_handlers/telegram/webhook/constants.ts:50](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/constants.ts#L50)

***

### TELEGRAM\_NATIVE\_COMMANDS

> `const` **TELEGRAM\_NATIVE\_COMMANDS**: `Set`\<`string`\>

Defined in: [api/\_handlers/telegram/webhook/constants.ts:15](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/constants.ts#L15)

***

### TELEGRAM\_PRIVATE\_BOT\_COMMANDS

> `const` **TELEGRAM\_PRIVATE\_BOT\_COMMANDS**: [`TelegramBotMenuCommand`](#telegrambotmenucommand)[]

Defined in: [api/\_handlers/telegram/webhook/constants.ts:48](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/constants.ts#L48)

***

### TRADE\_ACTION\_PRESET\_BPS

> `const` **TRADE\_ACTION\_PRESET\_BPS**: readonly \[`2500`, `5000`, `7500`, `9900`\]

Defined in: [api/\_handlers/telegram/webhook/constants.ts:116](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/constants.ts#L116)

***

### UINT128\_MAX

> `const` **UINT128\_MAX**: `bigint`

Defined in: [api/\_handlers/telegram/webhook/constants.ts:113](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/constants.ts#L113)

***

### ZERO\_ADDRESS

> `const` **ZERO\_ADDRESS**: `"0x0000000000000000000000000000000000000000"`

Defined in: [api/\_handlers/telegram/webhook/constants.ts:11](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/constants.ts#L11)
