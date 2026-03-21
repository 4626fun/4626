[**4626-app**](../../../../index.md)

***

[4626-app](../../../../index.md) / api/\_handlers/telegram/webhook/constants

# api/\_handlers/telegram/webhook/constants

## Type Aliases

### TelegramBotMenuCommand

> **TelegramBotMenuCommand** = `object`

Defined in: [api/\_handlers/telegram/webhook/constants.ts:96](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/api/_handlers/telegram/webhook/constants.ts#L96)

#### Properties

##### command

> **command**: `string`

Defined in: [api/\_handlers/telegram/webhook/constants.ts:97](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/api/_handlers/telegram/webhook/constants.ts#L97)

##### description

> **description**: `string`

Defined in: [api/\_handlers/telegram/webhook/constants.ts:98](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/api/_handlers/telegram/webhook/constants.ts#L98)

## Variables

### CCA\_AUCTION\_ABI

> `const` **CCA\_AUCTION\_ABI**: readonly \[\{ `inputs`: readonly \[\{ `name`: `"maxPrice"`; `type`: `"uint256"`; \}, \{ `name`: `"amount"`; `type`: `"uint128"`; \}, \{ `name`: `"owner"`; `type`: `"address"`; \}, \{ `name`: `"hookData"`; `type`: `"bytes"`; \}\]; `name`: `"submitBid"`; `outputs`: readonly \[\{ `name`: `"bidId"`; `type`: `"uint256"`; \}\]; `stateMutability`: `"payable"`; `type`: `"function"`; \}\]

Defined in: [api/\_handlers/telegram/webhook/constants.ts:182](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/api/_handlers/telegram/webhook/constants.ts#L182)

***

### CCA\_LAUNCH\_STRATEGY\_ABI

> `const` **CCA\_LAUNCH\_STRATEGY\_ABI**: readonly \[\{ `inputs`: readonly \[\]; `name`: `"getAuctionStatus"`; `outputs`: readonly \[\{ `name`: `"auction"`; `type`: `"address"`; \}, \{ `name`: `"isActive"`; `type`: `"bool"`; \}, \{ `name`: `"isGraduated"`; `type`: `"bool"`; \}, \{ `name`: `"clearingPrice"`; `type`: `"uint256"`; \}, \{ `name`: `"currencyRaised"`; `type`: `"uint256"`; \}\]; `stateMutability`: `"view"`; `type`: `"function"`; \}, \{ `inputs`: readonly \[\]; `name`: `"auctionToken"`; `outputs`: readonly \[\{ `type`: `"address"`; \}\]; `stateMutability`: `"view"`; `type`: `"function"`; \}\]

Defined in: [api/\_handlers/telegram/webhook/constants.ts:142](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/api/_handlers/telegram/webhook/constants.ts#L142)

***

### DEPLOY\_CURRENCY\_VALUES

> `const` **DEPLOY\_CURRENCY\_VALUES**: [`DeployCurrencyInput`](types.md#deploycurrencyinput)[]

Defined in: [api/\_handlers/telegram/webhook/constants.ts:138](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/api/_handlers/telegram/webhook/constants.ts#L138)

***

### ERC20\_VIEW\_ABI

> `const` **ERC20\_VIEW\_ABI**: readonly \[\{ `inputs`: readonly \[\]; `name`: `"decimals"`; `outputs`: readonly \[\{ `type`: `"uint8"`; \}\]; `stateMutability`: `"view"`; `type`: `"function"`; \}, \{ `inputs`: readonly \[\]; `name`: `"symbol"`; `outputs`: readonly \[\{ `type`: `"string"`; \}\]; `stateMutability`: `"view"`; `type`: `"function"`; \}\]

Defined in: [api/\_handlers/telegram/webhook/constants.ts:165](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/api/_handlers/telegram/webhook/constants.ts#L165)

***

### Q96

> `const` **Q96**: `bigint`

Defined in: [api/\_handlers/telegram/webhook/constants.ts:198](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/api/_handlers/telegram/webhook/constants.ts#L198)

***

### SUPPORTED\_METADATA\_URI\_PREFIXES

> `const` **SUPPORTED\_METADATA\_URI\_PREFIXES**: readonly \[`"https://"`, `"http://"`, `"ipfs://"`, `"ar://"`, `"data:"`\]

Defined in: [api/\_handlers/telegram/webhook/constants.ts:140](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/api/_handlers/telegram/webhook/constants.ts#L140)

***

### TELEGRAM\_ADMIN\_BOT\_COMMANDS

> `const` **TELEGRAM\_ADMIN\_BOT\_COMMANDS**: [`TelegramBotMenuCommand`](#telegrambotmenucommand)[]

Defined in: [api/\_handlers/telegram/webhook/constants.ts:125](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/api/_handlers/telegram/webhook/constants.ts#L125)

***

### TELEGRAM\_COMMAND\_HEADS

> `const` **TELEGRAM\_COMMAND\_HEADS**: readonly \[`"start"`, `"help"`, `"keepr"`, `"link"`, `"linked"`, `"unlink"`, `"zora"`, `"deploy"`, `"join"`, `"rooms"`, `"eligibility"`, `"wallet"`, `"vaults"`, `"list"`, `"auctions"`, `"mybids"`, `"signals"`, `"buy"`, `"sell"`, `"bid"`, `"tip"`, `"inline"`, `"shortcuts"`, `"x"`, `"tweet"`, `"ai"`, `"mkt"`, `"coin"`, `"arena"`\]

Defined in: [api/\_handlers/telegram/webhook/constants.ts:27](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/api/_handlers/telegram/webhook/constants.ts#L27)

***

### TELEGRAM\_COMMAND\_HEADS\_PATTERN

> `const` **TELEGRAM\_COMMAND\_HEADS\_PATTERN**: `string`

Defined in: [api/\_handlers/telegram/webhook/constants.ts:59](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/api/_handlers/telegram/webhook/constants.ts#L59)

***

### TELEGRAM\_COMMAND\_MICRO\_HINTS

> `const` **TELEGRAM\_COMMAND\_MICRO\_HINTS**: `object`[]

Defined in: [api/\_handlers/telegram/webhook/constants.ts:61](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/api/_handlers/telegram/webhook/constants.ts#L61)

#### Type Declaration

##### hint

> **hint**: `string`

##### pattern

> **pattern**: `RegExp`

***

### TELEGRAM\_GROUP\_BOT\_COMMANDS

> `const` **TELEGRAM\_GROUP\_BOT\_COMMANDS**: [`TelegramBotMenuCommand`](#telegrambotmenucommand)[]

Defined in: [api/\_handlers/telegram/webhook/constants.ts:114](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/api/_handlers/telegram/webhook/constants.ts#L114)

***

### TELEGRAM\_NATIVE\_COMMANDS

> `const` **TELEGRAM\_NATIVE\_COMMANDS**: `Set`\<`string`\>

Defined in: [api/\_handlers/telegram/webhook/constants.ts:5](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/api/_handlers/telegram/webhook/constants.ts#L5)

***

### TELEGRAM\_PRIVATE\_BOT\_COMMANDS

> `const` **TELEGRAM\_PRIVATE\_BOT\_COMMANDS**: [`TelegramBotMenuCommand`](#telegrambotmenucommand)[]

Defined in: [api/\_handlers/telegram/webhook/constants.ts:101](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/api/_handlers/telegram/webhook/constants.ts#L101)

***

### TRADE\_ACTION\_PRESET\_BPS

> `const` **TRADE\_ACTION\_PRESET\_BPS**: readonly \[`2500`, `5000`, `7500`, `9900`\]

Defined in: [api/\_handlers/telegram/webhook/constants.ts:200](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/api/_handlers/telegram/webhook/constants.ts#L200)

***

### UINT128\_MAX

> `const` **UINT128\_MAX**: `bigint`

Defined in: [api/\_handlers/telegram/webhook/constants.ts:197](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/api/_handlers/telegram/webhook/constants.ts#L197)

***

### ZERO\_ADDRESS

> `const` **ZERO\_ADDRESS**: `"0x0000000000000000000000000000000000000000"`

Defined in: [api/\_handlers/telegram/webhook/constants.ts:3](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/api/_handlers/telegram/webhook/constants.ts#L3)
