[**4626-web**](../../../../index.md)

***

[4626-web](../../../../index.md) / api/\_handlers/telegram/webhook/types

# api/\_handlers/telegram/webhook/types

## Type Aliases

### CcaAuctionQuote

> **CcaAuctionQuote** = `object`

Defined in: [api/\_handlers/telegram/webhook/types.ts:159](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/telegram/webhook/types.ts#L159)

#### Properties

##### amountEth

> **amountEth**: `number`

Defined in: [api/\_handlers/telegram/webhook/types.ts:169](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/telegram/webhook/types.ts#L169)

##### amountWei

> **amountWei**: `bigint`

Defined in: [api/\_handlers/telegram/webhook/types.ts:168](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/telegram/webhook/types.ts#L168)

##### auctionAddress

> **auctionAddress**: `` `0x${string}` ``

Defined in: [api/\_handlers/telegram/webhook/types.ts:160](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/telegram/webhook/types.ts#L160)

##### ccaStrategyAddress

> **ccaStrategyAddress**: `` `0x${string}` ``

Defined in: [api/\_handlers/telegram/webhook/types.ts:161](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/telegram/webhook/types.ts#L161)

##### clearingPriceQ96

> **clearingPriceQ96**: `bigint`

Defined in: [api/\_handlers/telegram/webhook/types.ts:162](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/telegram/webhook/types.ts#L162)

##### clearingPriceWeiPerToken

> **clearingPriceWeiPerToken**: `bigint`

Defined in: [api/\_handlers/telegram/webhook/types.ts:166](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/telegram/webhook/types.ts#L166)

##### maxPriceQ96

> **maxPriceQ96**: `bigint`

Defined in: [api/\_handlers/telegram/webhook/types.ts:163](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/telegram/webhook/types.ts#L163)

##### maxPriceWeiPerToken

> **maxPriceWeiPerToken**: `bigint`

Defined in: [api/\_handlers/telegram/webhook/types.ts:167](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/telegram/webhook/types.ts#L167)

##### tokenDecimals

> **tokenDecimals**: `number`

Defined in: [api/\_handlers/telegram/webhook/types.ts:164](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/telegram/webhook/types.ts#L164)

##### tokenSymbol

> **tokenSymbol**: `string`

Defined in: [api/\_handlers/telegram/webhook/types.ts:165](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/telegram/webhook/types.ts#L165)

##### usdIntent

> **usdIntent**: `number`

Defined in: [api/\_handlers/telegram/webhook/types.ts:170](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/telegram/webhook/types.ts#L170)

***

### CommandCoinCurrency

> **CommandCoinCurrency** = `"ETH"` \| `"ZORA"` \| `"CREATOR_COIN"`

Defined in: [api/\_handlers/telegram/webhook/types.ts:142](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/telegram/webhook/types.ts#L142)

***

### DeployCurrencyInput

> **DeployCurrencyInput** = `"ETH"` \| `"ZORA"` \| `"CREATOR_COIN"` \| `"CONTENT_COIN"`

Defined in: [api/\_handlers/telegram/webhook/types.ts:140](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/telegram/webhook/types.ts#L140)

***

### DeployWizardType

> **DeployWizardType** = `"trend"` \| `"content"` \| `"creator"`

Defined in: [api/\_handlers/telegram/webhook/types.ts:138](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/telegram/webhook/types.ts#L138)

***

### InteractiveTradeAction

> **InteractiveTradeAction** = `"buy"` \| `"sell"` \| `"bid"`

Defined in: [api/\_handlers/telegram/webhook/types.ts:136](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/telegram/webhook/types.ts#L136)

***

### ParsedTelegramDeployIntent

> **ParsedTelegramDeployIntent** = \{ `kind`: `"menu"`; \} \| \{ `kind`: `"zora"`; \} \| \{ `kind`: `"usage"`; `text`: `string`; \} \| \{ `kind`: `"trend"`; `ticker`: `string`; \} \| \{ `coinType`: `Exclude`\<[`DeployWizardType`](#deploywizardtype), `"trend"`\>; `commandCurrency`: [`CommandCoinCurrency`](#commandcoincurrency); `currencyInput`: [`DeployCurrencyInput`](#deploycurrencyinput); `kind`: `"coin"`; `metadataUri`: `string`; `name`: `string`; `symbol`: `string`; \}

Defined in: [api/\_handlers/telegram/webhook/types.ts:144](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/telegram/webhook/types.ts#L144)

***

### ParsedTelegramTradeIntent

> **ParsedTelegramTradeIntent** = \{ `actionType`: `"buy"` \| `"sell"`; `amount`: `number`; `amountInput`: `string`; `amountUnit`: `"ETH"` \| `"SHARE"`; `identifier`: `string`; \} \| \{ `actionType`: `"bid"`; `amount`: `number`; `amountInput`: `string`; `amountUnit`: `"USD"`; `identifier`: `string`; \}

Defined in: [api/\_handlers/telegram/webhook/types.ts:120](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/telegram/webhook/types.ts#L120)

***

### PrivyWalletOwnerContext

> **PrivyWalletOwnerContext** = `object`

Defined in: [api/\_handlers/telegram/webhook/types.ts:173](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/telegram/webhook/types.ts#L173)

#### Properties

##### ownerAddress

> **ownerAddress**: `` `0x${string}` ``

Defined in: [api/\_handlers/telegram/webhook/types.ts:175](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/telegram/webhook/types.ts#L175)

##### walletId

> **walletId**: `string`

Defined in: [api/\_handlers/telegram/webhook/types.ts:174](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/telegram/webhook/types.ts#L174)

***

### ScopedVaultRow

> **ScopedVaultRow** = `object`

Defined in: [api/\_handlers/telegram/webhook/types.ts:178](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/telegram/webhook/types.ts#L178)

#### Properties

##### ccaStrategyAddress

> **ccaStrategyAddress**: `` `0x${string}` ``

Defined in: [api/\_handlers/telegram/webhook/types.ts:184](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/telegram/webhook/types.ts#L184)

##### chainId

> **chainId**: `number`

Defined in: [api/\_handlers/telegram/webhook/types.ts:181](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/telegram/webhook/types.ts#L181)

##### creatorCoinAddress

> **creatorCoinAddress**: `` `0x${string}` ``

Defined in: [api/\_handlers/telegram/webhook/types.ts:180](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/telegram/webhook/types.ts#L180)

##### groupId

> **groupId**: `string`

Defined in: [api/\_handlers/telegram/webhook/types.ts:182](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/telegram/webhook/types.ts#L182)

##### isSettled

> **isSettled**: `boolean`

Defined in: [api/\_handlers/telegram/webhook/types.ts:183](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/telegram/webhook/types.ts#L183)

##### vaultAddress

> **vaultAddress**: `` `0x${string}` ``

Defined in: [api/\_handlers/telegram/webhook/types.ts:179](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/telegram/webhook/types.ts#L179)

***

### TelegramCallbackQuery

> **TelegramCallbackQuery** = `object`

Defined in: [api/\_handlers/telegram/webhook/types.ts:79](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/telegram/webhook/types.ts#L79)

#### Properties

##### data?

> `optional` **data**: `string`

Defined in: [api/\_handlers/telegram/webhook/types.ts:81](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/telegram/webhook/types.ts#L81)

##### from?

> `optional` **from**: [`TelegramFrom`](#telegramfrom)

Defined in: [api/\_handlers/telegram/webhook/types.ts:82](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/telegram/webhook/types.ts#L82)

##### id?

> `optional` **id**: `string` \| `number`

Defined in: [api/\_handlers/telegram/webhook/types.ts:80](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/telegram/webhook/types.ts#L80)

##### inline\_message\_id?

> `optional` **inline\_message\_id**: `string`

Defined in: [api/\_handlers/telegram/webhook/types.ts:84](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/telegram/webhook/types.ts#L84)

##### message?

> `optional` **message**: [`TelegramMessage`](#telegrammessage)

Defined in: [api/\_handlers/telegram/webhook/types.ts:83](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/telegram/webhook/types.ts#L83)

***

### TelegramChat

> **TelegramChat** = `object`

Defined in: [api/\_handlers/telegram/webhook/types.ts:7](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/telegram/webhook/types.ts#L7)

#### Properties

##### id?

> `optional` **id**: `number` \| `string`

Defined in: [api/\_handlers/telegram/webhook/types.ts:8](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/telegram/webhook/types.ts#L8)

***

### TelegramChatShared

> **TelegramChatShared** = `object`

Defined in: [api/\_handlers/telegram/webhook/types.ts:31](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/telegram/webhook/types.ts#L31)

#### Properties

##### chat\_id?

> `optional` **chat\_id**: `number` \| `string`

Defined in: [api/\_handlers/telegram/webhook/types.ts:33](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/telegram/webhook/types.ts#L33)

##### request\_id?

> `optional` **request\_id**: `number`

Defined in: [api/\_handlers/telegram/webhook/types.ts:32](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/telegram/webhook/types.ts#L32)

##### title?

> `optional` **title**: `string`

Defined in: [api/\_handlers/telegram/webhook/types.ts:34](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/telegram/webhook/types.ts#L34)

##### username?

> `optional` **username**: `string`

Defined in: [api/\_handlers/telegram/webhook/types.ts:35](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/telegram/webhook/types.ts#L35)

***

### TelegramChosenInlineResult

> **TelegramChosenInlineResult** = `object`

Defined in: [api/\_handlers/telegram/webhook/types.ts:71](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/telegram/webhook/types.ts#L71)

#### Properties

##### from?

> `optional` **from**: [`TelegramFrom`](#telegramfrom)

Defined in: [api/\_handlers/telegram/webhook/types.ts:73](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/telegram/webhook/types.ts#L73)

##### inline\_message\_id?

> `optional` **inline\_message\_id**: `string`

Defined in: [api/\_handlers/telegram/webhook/types.ts:75](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/telegram/webhook/types.ts#L75)

##### location?

> `optional` **location**: [`TelegramLocation`](#telegramlocation)

Defined in: [api/\_handlers/telegram/webhook/types.ts:74](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/telegram/webhook/types.ts#L74)

##### query?

> `optional` **query**: `string`

Defined in: [api/\_handlers/telegram/webhook/types.ts:76](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/telegram/webhook/types.ts#L76)

##### result\_id?

> `optional` **result\_id**: `string`

Defined in: [api/\_handlers/telegram/webhook/types.ts:72](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/telegram/webhook/types.ts#L72)

***

### TelegramCommandResponse

> **TelegramCommandResponse** = `object`

Defined in: [api/\_handlers/telegram/webhook/types.ts:112](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/telegram/webhook/types.ts#L112)

#### Properties

##### callbackToast?

> `optional` **callbackToast**: `string`

Defined in: [api/\_handlers/telegram/webhook/types.ts:117](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/telegram/webhook/types.ts#L117)

##### replyMarkup?

> `optional` **replyMarkup**: `Record`\<`string`, `unknown`\>

Defined in: [api/\_handlers/telegram/webhook/types.ts:114](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/telegram/webhook/types.ts#L114)

##### signalReplyMarkup?

> `optional` **signalReplyMarkup**: `Record`\<`string`, `unknown`\>

Defined in: [api/\_handlers/telegram/webhook/types.ts:116](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/telegram/webhook/types.ts#L116)

##### signalText?

> `optional` **signalText**: `string`

Defined in: [api/\_handlers/telegram/webhook/types.ts:115](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/telegram/webhook/types.ts#L115)

##### text

> **text**: `string`

Defined in: [api/\_handlers/telegram/webhook/types.ts:113](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/telegram/webhook/types.ts#L113)

***

### TelegramFrom

> **TelegramFrom** = `object`

Defined in: [api/\_handlers/telegram/webhook/types.ts:1](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/telegram/webhook/types.ts#L1)

#### Properties

##### id?

> `optional` **id**: `number` \| `string`

Defined in: [api/\_handlers/telegram/webhook/types.ts:2](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/telegram/webhook/types.ts#L2)

##### is\_bot?

> `optional` **is\_bot**: `boolean`

Defined in: [api/\_handlers/telegram/webhook/types.ts:3](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/telegram/webhook/types.ts#L3)

##### username?

> `optional` **username**: `string`

Defined in: [api/\_handlers/telegram/webhook/types.ts:4](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/telegram/webhook/types.ts#L4)

***

### TelegramInlineQuery

> **TelegramInlineQuery** = `object`

Defined in: [api/\_handlers/telegram/webhook/types.ts:51](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/telegram/webhook/types.ts#L51)

#### Properties

##### chat\_type?

> `optional` **chat\_type**: [`TelegramInlineQueryChatType`](#telegraminlinequerychattype)

Defined in: [api/\_handlers/telegram/webhook/types.ts:55](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/telegram/webhook/types.ts#L55)

##### from?

> `optional` **from**: [`TelegramFrom`](#telegramfrom)

Defined in: [api/\_handlers/telegram/webhook/types.ts:56](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/telegram/webhook/types.ts#L56)

##### id?

> `optional` **id**: `string` \| `number`

Defined in: [api/\_handlers/telegram/webhook/types.ts:52](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/telegram/webhook/types.ts#L52)

##### location?

> `optional` **location**: [`TelegramLocation`](#telegramlocation)

Defined in: [api/\_handlers/telegram/webhook/types.ts:57](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/telegram/webhook/types.ts#L57)

##### offset?

> `optional` **offset**: `string`

Defined in: [api/\_handlers/telegram/webhook/types.ts:54](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/telegram/webhook/types.ts#L54)

##### query?

> `optional` **query**: `string`

Defined in: [api/\_handlers/telegram/webhook/types.ts:53](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/telegram/webhook/types.ts#L53)

***

### TelegramInlineQueryChatType

> **TelegramInlineQueryChatType** = `"sender"` \| `"private"` \| `"group"` \| `"supergroup"` \| `"channel"`

Defined in: [api/\_handlers/telegram/webhook/types.ts:60](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/telegram/webhook/types.ts#L60)

***

### TelegramLocation

> **TelegramLocation** = `object`

Defined in: [api/\_handlers/telegram/webhook/types.ts:62](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/telegram/webhook/types.ts#L62)

#### Properties

##### heading?

> `optional` **heading**: `number`

Defined in: [api/\_handlers/telegram/webhook/types.ts:67](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/telegram/webhook/types.ts#L67)

##### horizontal\_accuracy?

> `optional` **horizontal\_accuracy**: `number`

Defined in: [api/\_handlers/telegram/webhook/types.ts:65](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/telegram/webhook/types.ts#L65)

##### latitude?

> `optional` **latitude**: `number`

Defined in: [api/\_handlers/telegram/webhook/types.ts:63](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/telegram/webhook/types.ts#L63)

##### live\_period?

> `optional` **live\_period**: `number`

Defined in: [api/\_handlers/telegram/webhook/types.ts:66](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/telegram/webhook/types.ts#L66)

##### longitude?

> `optional` **longitude**: `number`

Defined in: [api/\_handlers/telegram/webhook/types.ts:64](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/telegram/webhook/types.ts#L64)

##### proximity\_alert\_radius?

> `optional` **proximity\_alert\_radius**: `number`

Defined in: [api/\_handlers/telegram/webhook/types.ts:68](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/telegram/webhook/types.ts#L68)

***

### TelegramMessage

> **TelegramMessage** = `object`

Defined in: [api/\_handlers/telegram/webhook/types.ts:38](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/telegram/webhook/types.ts#L38)

#### Properties

##### caption?

> `optional` **caption**: `string`

Defined in: [api/\_handlers/telegram/webhook/types.ts:41](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/telegram/webhook/types.ts#L41)

##### chat?

> `optional` **chat**: [`TelegramChat`](#telegramchat)

Defined in: [api/\_handlers/telegram/webhook/types.ts:44](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/telegram/webhook/types.ts#L44)

##### chat\_shared?

> `optional` **chat\_shared**: [`TelegramChatShared`](#telegramchatshared)

Defined in: [api/\_handlers/telegram/webhook/types.ts:48](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/telegram/webhook/types.ts#L48)

##### from?

> `optional` **from**: [`TelegramFrom`](#telegramfrom)

Defined in: [api/\_handlers/telegram/webhook/types.ts:43](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/telegram/webhook/types.ts#L43)

##### message\_id?

> `optional` **message\_id**: `number`

Defined in: [api/\_handlers/telegram/webhook/types.ts:39](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/telegram/webhook/types.ts#L39)

##### message\_thread\_id?

> `optional` **message\_thread\_id**: `number`

Defined in: [api/\_handlers/telegram/webhook/types.ts:42](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/telegram/webhook/types.ts#L42)

##### reply\_to\_message?

> `optional` **reply\_to\_message**: [`TelegramMessage`](#telegrammessage)

Defined in: [api/\_handlers/telegram/webhook/types.ts:45](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/telegram/webhook/types.ts#L45)

##### successful\_payment?

> `optional` **successful\_payment**: [`TelegramSuccessfulPayment`](#telegramsuccessfulpayment)

Defined in: [api/\_handlers/telegram/webhook/types.ts:46](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/telegram/webhook/types.ts#L46)

##### text?

> `optional` **text**: `string`

Defined in: [api/\_handlers/telegram/webhook/types.ts:40](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/telegram/webhook/types.ts#L40)

##### users\_shared?

> `optional` **users\_shared**: [`TelegramUsersShared`](#telegramusersshared)

Defined in: [api/\_handlers/telegram/webhook/types.ts:47](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/telegram/webhook/types.ts#L47)

***

### TelegramPreCheckoutQuery

> **TelegramPreCheckoutQuery** = `object`

Defined in: [api/\_handlers/telegram/webhook/types.ts:87](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/telegram/webhook/types.ts#L87)

#### Properties

##### currency?

> `optional` **currency**: `string`

Defined in: [api/\_handlers/telegram/webhook/types.ts:90](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/telegram/webhook/types.ts#L90)

##### from?

> `optional` **from**: [`TelegramFrom`](#telegramfrom)

Defined in: [api/\_handlers/telegram/webhook/types.ts:89](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/telegram/webhook/types.ts#L89)

##### id?

> `optional` **id**: `string` \| `number`

Defined in: [api/\_handlers/telegram/webhook/types.ts:88](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/telegram/webhook/types.ts#L88)

##### invoice\_payload?

> `optional` **invoice\_payload**: `string`

Defined in: [api/\_handlers/telegram/webhook/types.ts:92](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/telegram/webhook/types.ts#L92)

##### total\_amount?

> `optional` **total\_amount**: `number`

Defined in: [api/\_handlers/telegram/webhook/types.ts:91](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/telegram/webhook/types.ts#L91)

***

### TelegramSharedUser

> **TelegramSharedUser** = `object`

Defined in: [api/\_handlers/telegram/webhook/types.ts:19](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/telegram/webhook/types.ts#L19)

#### Properties

##### first\_name?

> `optional` **first\_name**: `string`

Defined in: [api/\_handlers/telegram/webhook/types.ts:21](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/telegram/webhook/types.ts#L21)

##### last\_name?

> `optional` **last\_name**: `string`

Defined in: [api/\_handlers/telegram/webhook/types.ts:22](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/telegram/webhook/types.ts#L22)

##### user\_id?

> `optional` **user\_id**: `number` \| `string`

Defined in: [api/\_handlers/telegram/webhook/types.ts:20](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/telegram/webhook/types.ts#L20)

##### username?

> `optional` **username**: `string`

Defined in: [api/\_handlers/telegram/webhook/types.ts:23](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/telegram/webhook/types.ts#L23)

***

### TelegramSuccessfulPayment

> **TelegramSuccessfulPayment** = `object`

Defined in: [api/\_handlers/telegram/webhook/types.ts:11](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/telegram/webhook/types.ts#L11)

#### Properties

##### currency?

> `optional` **currency**: `string`

Defined in: [api/\_handlers/telegram/webhook/types.ts:12](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/telegram/webhook/types.ts#L12)

##### invoice\_payload?

> `optional` **invoice\_payload**: `string`

Defined in: [api/\_handlers/telegram/webhook/types.ts:14](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/telegram/webhook/types.ts#L14)

##### provider\_payment\_charge\_id?

> `optional` **provider\_payment\_charge\_id**: `string`

Defined in: [api/\_handlers/telegram/webhook/types.ts:16](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/telegram/webhook/types.ts#L16)

##### telegram\_payment\_charge\_id?

> `optional` **telegram\_payment\_charge\_id**: `string`

Defined in: [api/\_handlers/telegram/webhook/types.ts:15](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/telegram/webhook/types.ts#L15)

##### total\_amount?

> `optional` **total\_amount**: `number`

Defined in: [api/\_handlers/telegram/webhook/types.ts:13](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/telegram/webhook/types.ts#L13)

***

### TelegramUpdate

> **TelegramUpdate** = `object`

Defined in: [api/\_handlers/telegram/webhook/types.ts:95](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/telegram/webhook/types.ts#L95)

#### Properties

##### callback\_query?

> `optional` **callback\_query**: [`TelegramCallbackQuery`](#telegramcallbackquery)

Defined in: [api/\_handlers/telegram/webhook/types.ts:102](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/telegram/webhook/types.ts#L102)

##### channel\_post?

> `optional` **channel\_post**: [`TelegramMessage`](#telegrammessage)

Defined in: [api/\_handlers/telegram/webhook/types.ts:99](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/telegram/webhook/types.ts#L99)

##### chosen\_inline\_result?

> `optional` **chosen\_inline\_result**: [`TelegramChosenInlineResult`](#telegramchoseninlineresult)

Defined in: [api/\_handlers/telegram/webhook/types.ts:101](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/telegram/webhook/types.ts#L101)

##### edited\_message?

> `optional` **edited\_message**: [`TelegramMessage`](#telegrammessage)

Defined in: [api/\_handlers/telegram/webhook/types.ts:98](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/telegram/webhook/types.ts#L98)

##### inline\_query?

> `optional` **inline\_query**: [`TelegramInlineQuery`](#telegraminlinequery)

Defined in: [api/\_handlers/telegram/webhook/types.ts:100](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/telegram/webhook/types.ts#L100)

##### message?

> `optional` **message**: [`TelegramMessage`](#telegrammessage)

Defined in: [api/\_handlers/telegram/webhook/types.ts:97](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/telegram/webhook/types.ts#L97)

##### pre\_checkout\_query?

> `optional` **pre\_checkout\_query**: [`TelegramPreCheckoutQuery`](#telegramprecheckoutquery)

Defined in: [api/\_handlers/telegram/webhook/types.ts:103](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/telegram/webhook/types.ts#L103)

##### update\_id?

> `optional` **update\_id**: `number`

Defined in: [api/\_handlers/telegram/webhook/types.ts:96](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/telegram/webhook/types.ts#L96)

***

### TelegramUsersShared

> **TelegramUsersShared** = `object`

Defined in: [api/\_handlers/telegram/webhook/types.ts:26](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/telegram/webhook/types.ts#L26)

#### Properties

##### request\_id?

> `optional` **request\_id**: `number`

Defined in: [api/\_handlers/telegram/webhook/types.ts:27](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/telegram/webhook/types.ts#L27)

##### users?

> `optional` **users**: [`TelegramSharedUser`](#telegramshareduser)[]

Defined in: [api/\_handlers/telegram/webhook/types.ts:28](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/telegram/webhook/types.ts#L28)

***

### TelegramWebhookOk

> **TelegramWebhookOk** = `object`

Defined in: [api/\_handlers/telegram/webhook/types.ts:106](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/telegram/webhook/types.ts#L106)

#### Properties

##### ignored?

> `optional` **ignored**: `boolean`

Defined in: [api/\_handlers/telegram/webhook/types.ts:108](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/telegram/webhook/types.ts#L108)

##### ok

> **ok**: `true`

Defined in: [api/\_handlers/telegram/webhook/types.ts:107](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/telegram/webhook/types.ts#L107)

##### updateId?

> `optional` **updateId**: `number` \| `null`

Defined in: [api/\_handlers/telegram/webhook/types.ts:109](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/telegram/webhook/types.ts#L109)
