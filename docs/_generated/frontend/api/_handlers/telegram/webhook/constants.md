[**4626-app**](../../../../index.md)

***

[4626-app](../../../../index.md) / api/\_handlers/telegram/webhook/constants

# api/\_handlers/telegram/webhook/constants

## Type Aliases

### TelegramBotMenuCommand

> **TelegramBotMenuCommand** = `object`

Defined in: [api/\_handlers/telegram/webhook/constants.ts:104](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/constants.ts#L104)

#### Properties

##### command

> **command**: `string`

Defined in: [api/\_handlers/telegram/webhook/constants.ts:105](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/constants.ts#L105)

##### description

> **description**: `string`

Defined in: [api/\_handlers/telegram/webhook/constants.ts:106](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/constants.ts#L106)

## Variables

### CCA\_AUCTION\_ABI

> `const` **CCA\_AUCTION\_ABI**: readonly \[\{ `inputs`: readonly \[\{ `name`: `"maxPrice"`; `type`: `"uint256"`; \}, \{ `name`: `"amount"`; `type`: `"uint128"`; \}, \{ `name`: `"owner"`; `type`: `"address"`; \}, \{ `name`: `"hookData"`; `type`: `"bytes"`; \}\]; `name`: `"submitBid"`; `outputs`: readonly \[\{ `name`: `"bidId"`; `type`: `"uint256"`; \}\]; `stateMutability`: `"payable"`; `type`: `"function"`; \}\]

Defined in: [api/\_handlers/telegram/webhook/constants.ts:192](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/constants.ts#L192)

***

### CCA\_LAUNCH\_STRATEGY\_ABI

> `const` **CCA\_LAUNCH\_STRATEGY\_ABI**: readonly \[\{ `inputs`: readonly \[\]; `name`: `"getAuctionStatus"`; `outputs`: readonly \[\{ `name`: `"auction"`; `type`: `"address"`; \}, \{ `name`: `"isActive"`; `type`: `"bool"`; \}, \{ `name`: `"isGraduated"`; `type`: `"bool"`; \}, \{ `name`: `"clearingPrice"`; `type`: `"uint256"`; \}, \{ `name`: `"currencyRaised"`; `type`: `"uint256"`; \}\]; `stateMutability`: `"view"`; `type`: `"function"`; \}, \{ `inputs`: readonly \[\]; `name`: `"auctionToken"`; `outputs`: readonly \[\{ `type`: `"address"`; \}\]; `stateMutability`: `"view"`; `type`: `"function"`; \}\]

Defined in: [api/\_handlers/telegram/webhook/constants.ts:152](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/constants.ts#L152)

***

### DEPLOY\_CURRENCY\_VALUES

> `const` **DEPLOY\_CURRENCY\_VALUES**: [`DeployCurrencyInput`](types.md#deploycurrencyinput)[]

Defined in: [api/\_handlers/telegram/webhook/constants.ts:148](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/constants.ts#L148)

***

### ERC20\_VIEW\_ABI

> `const` **ERC20\_VIEW\_ABI**: readonly \[\{ `inputs`: readonly \[\]; `name`: `"decimals"`; `outputs`: readonly \[\{ `type`: `"uint8"`; \}\]; `stateMutability`: `"view"`; `type`: `"function"`; \}, \{ `inputs`: readonly \[\]; `name`: `"symbol"`; `outputs`: readonly \[\{ `type`: `"string"`; \}\]; `stateMutability`: `"view"`; `type`: `"function"`; \}\]

Defined in: [api/\_handlers/telegram/webhook/constants.ts:175](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/constants.ts#L175)

***

### Q96

> `const` **Q96**: `bigint`

Defined in: [api/\_handlers/telegram/webhook/constants.ts:208](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/constants.ts#L208)

***

### SUPPORTED\_METADATA\_URI\_PREFIXES

> `const` **SUPPORTED\_METADATA\_URI\_PREFIXES**: readonly \[`"https://"`, `"http://"`, `"ipfs://"`, `"ar://"`, `"data:"`\]

Defined in: [api/\_handlers/telegram/webhook/constants.ts:150](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/constants.ts#L150)

***

### TELEGRAM\_ADMIN\_BOT\_COMMANDS

> `const` **TELEGRAM\_ADMIN\_BOT\_COMMANDS**: [`TelegramBotMenuCommand`](#telegrambotmenucommand)[]

Defined in: [api/\_handlers/telegram/webhook/constants.ts:134](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/constants.ts#L134)

***

### TELEGRAM\_COMMAND\_HEADS

> `const` **TELEGRAM\_COMMAND\_HEADS**: readonly \[`"start"`, `"id"`, `"getid"`, `"get_id"`, `"help"`, `"keepr"`, `"link"`, `"linked"`, `"unlink"`, `"zora"`, `"vaultdeploy"`, `"deploy"`, `"join"`, `"rooms"`, `"eligibility"`, `"wallet"`, `"vaults"`, `"list"`, `"auctions"`, `"mybids"`, `"signals"`, `"buy"`, `"sell"`, `"bid"`, `"tip"`, `"inline"`, `"shortcuts"`, `"x"`, `"tweet"`, `"ai"`, `"mkt"`, `"coin"`, `"arena"`\]

Defined in: [api/\_handlers/telegram/webhook/constants.ts:31](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/constants.ts#L31)

***

### TELEGRAM\_COMMAND\_HEADS\_PATTERN

> `const` **TELEGRAM\_COMMAND\_HEADS\_PATTERN**: `string`

Defined in: [api/\_handlers/telegram/webhook/constants.ts:67](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/constants.ts#L67)

***

### TELEGRAM\_COMMAND\_MICRO\_HINTS

> `const` **TELEGRAM\_COMMAND\_MICRO\_HINTS**: `object`[]

Defined in: [api/\_handlers/telegram/webhook/constants.ts:69](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/constants.ts#L69)

#### Type Declaration

##### hint

> **hint**: `string`

##### pattern

> **pattern**: `RegExp`

***

### TELEGRAM\_GROUP\_BOT\_COMMANDS

> `const` **TELEGRAM\_GROUP\_BOT\_COMMANDS**: [`TelegramBotMenuCommand`](#telegrambotmenucommand)[]

Defined in: [api/\_handlers/telegram/webhook/constants.ts:123](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/constants.ts#L123)

***

### TELEGRAM\_NATIVE\_COMMANDS

> `const` **TELEGRAM\_NATIVE\_COMMANDS**: `Set`\<`string`\>

Defined in: [api/\_handlers/telegram/webhook/constants.ts:5](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/constants.ts#L5)

***

### TELEGRAM\_PRIVATE\_BOT\_COMMANDS

> `const` **TELEGRAM\_PRIVATE\_BOT\_COMMANDS**: [`TelegramBotMenuCommand`](#telegrambotmenucommand)[]

Defined in: [api/\_handlers/telegram/webhook/constants.ts:109](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/constants.ts#L109)

***

### TRADE\_ACTION\_PRESET\_BPS

> `const` **TRADE\_ACTION\_PRESET\_BPS**: readonly \[`2500`, `5000`, `7500`, `9900`\]

Defined in: [api/\_handlers/telegram/webhook/constants.ts:210](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/constants.ts#L210)

***

### UINT128\_MAX

> `const` **UINT128\_MAX**: `bigint`

Defined in: [api/\_handlers/telegram/webhook/constants.ts:207](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/constants.ts#L207)

***

### ZERO\_ADDRESS

> `const` **ZERO\_ADDRESS**: `"0x0000000000000000000000000000000000000000"`

Defined in: [api/\_handlers/telegram/webhook/constants.ts:3](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/constants.ts#L3)
