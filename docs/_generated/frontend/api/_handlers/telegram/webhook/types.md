[**4626-app**](../../../../index.md)

***

[4626-app](../../../../index.md) / api/\_handlers/telegram/webhook/types

# api/\_handlers/telegram/webhook/types

## Type Aliases

### CcaAuctionQuote

> **CcaAuctionQuote** = `object`

Defined in: [api/\_handlers/telegram/webhook/types.ts:136](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/api/_handlers/telegram/webhook/types.ts#L136)

#### Properties

##### amountEth

> **amountEth**: `number`

Defined in: [api/\_handlers/telegram/webhook/types.ts:146](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/api/_handlers/telegram/webhook/types.ts#L146)

##### amountWei

> **amountWei**: `bigint`

Defined in: [api/\_handlers/telegram/webhook/types.ts:145](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/api/_handlers/telegram/webhook/types.ts#L145)

##### auctionAddress

> **auctionAddress**: `` `0x${string}` ``

Defined in: [api/\_handlers/telegram/webhook/types.ts:137](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/api/_handlers/telegram/webhook/types.ts#L137)

##### ccaStrategyAddress

> **ccaStrategyAddress**: `` `0x${string}` ``

Defined in: [api/\_handlers/telegram/webhook/types.ts:138](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/api/_handlers/telegram/webhook/types.ts#L138)

##### clearingPriceQ96

> **clearingPriceQ96**: `bigint`

Defined in: [api/\_handlers/telegram/webhook/types.ts:139](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/api/_handlers/telegram/webhook/types.ts#L139)

##### clearingPriceWeiPerToken

> **clearingPriceWeiPerToken**: `bigint`

Defined in: [api/\_handlers/telegram/webhook/types.ts:143](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/api/_handlers/telegram/webhook/types.ts#L143)

##### maxPriceQ96

> **maxPriceQ96**: `bigint`

Defined in: [api/\_handlers/telegram/webhook/types.ts:140](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/api/_handlers/telegram/webhook/types.ts#L140)

##### maxPriceWeiPerToken

> **maxPriceWeiPerToken**: `bigint`

Defined in: [api/\_handlers/telegram/webhook/types.ts:144](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/api/_handlers/telegram/webhook/types.ts#L144)

##### tokenDecimals

> **tokenDecimals**: `number`

Defined in: [api/\_handlers/telegram/webhook/types.ts:141](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/api/_handlers/telegram/webhook/types.ts#L141)

##### tokenSymbol

> **tokenSymbol**: `string`

Defined in: [api/\_handlers/telegram/webhook/types.ts:142](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/api/_handlers/telegram/webhook/types.ts#L142)

##### usdIntent

> **usdIntent**: `number`

Defined in: [api/\_handlers/telegram/webhook/types.ts:147](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/api/_handlers/telegram/webhook/types.ts#L147)

***

### CommandCoinCurrency

> **CommandCoinCurrency** = `"ETH"` \| `"ZORA"` \| `"CREATOR_COIN"`

Defined in: [api/\_handlers/telegram/webhook/types.ts:119](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/api/_handlers/telegram/webhook/types.ts#L119)

***

### DeployCurrencyInput

> **DeployCurrencyInput** = `"ETH"` \| `"ZORA"` \| `"CREATOR_COIN"` \| `"CONTENT_COIN"`

Defined in: [api/\_handlers/telegram/webhook/types.ts:117](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/api/_handlers/telegram/webhook/types.ts#L117)

***

### DeployWizardType

> **DeployWizardType** = `"trend"` \| `"content"` \| `"creator"`

Defined in: [api/\_handlers/telegram/webhook/types.ts:115](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/api/_handlers/telegram/webhook/types.ts#L115)

***

### InteractiveTradeAction

> **InteractiveTradeAction** = `"buy"` \| `"sell"` \| `"bid"`

Defined in: [api/\_handlers/telegram/webhook/types.ts:113](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/api/_handlers/telegram/webhook/types.ts#L113)

***

### ParsedTelegramDeployIntent

> **ParsedTelegramDeployIntent** = \{ `kind`: `"menu"`; \} \| \{ `kind`: `"zora"`; \} \| \{ `kind`: `"usage"`; `text`: `string`; \} \| \{ `kind`: `"trend"`; `ticker`: `string`; \} \| \{ `coinType`: `Exclude`\<[`DeployWizardType`](#deploywizardtype), `"trend"`\>; `commandCurrency`: [`CommandCoinCurrency`](#commandcoincurrency); `currencyInput`: [`DeployCurrencyInput`](#deploycurrencyinput); `kind`: `"coin"`; `metadataUri`: `string`; `name`: `string`; `symbol`: `string`; \}

Defined in: [api/\_handlers/telegram/webhook/types.ts:121](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/api/_handlers/telegram/webhook/types.ts#L121)

***

### ParsedTelegramTradeIntent

> **ParsedTelegramTradeIntent** = \{ `actionType`: `"buy"` \| `"sell"`; `amount`: `number`; `amountInput`: `string`; `amountUnit`: `"ETH"` \| `"SHARE"`; `identifier`: `string`; \} \| \{ `actionType`: `"bid"`; `amount`: `number`; `amountInput`: `string`; `amountUnit`: `"USD"`; `identifier`: `string`; \}

Defined in: [api/\_handlers/telegram/webhook/types.ts:97](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/api/_handlers/telegram/webhook/types.ts#L97)

***

### PrivyWalletOwnerContext

> **PrivyWalletOwnerContext** = `object`

Defined in: [api/\_handlers/telegram/webhook/types.ts:150](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/api/_handlers/telegram/webhook/types.ts#L150)

#### Properties

##### ownerAddress

> **ownerAddress**: `` `0x${string}` ``

Defined in: [api/\_handlers/telegram/webhook/types.ts:152](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/api/_handlers/telegram/webhook/types.ts#L152)

##### walletId

> **walletId**: `string`

Defined in: [api/\_handlers/telegram/webhook/types.ts:151](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/api/_handlers/telegram/webhook/types.ts#L151)

***

### ScopedVaultRow

> **ScopedVaultRow** = `object`

Defined in: [api/\_handlers/telegram/webhook/types.ts:155](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/api/_handlers/telegram/webhook/types.ts#L155)

#### Properties

##### ccaStrategyAddress

> **ccaStrategyAddress**: `` `0x${string}` ``

Defined in: [api/\_handlers/telegram/webhook/types.ts:161](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/api/_handlers/telegram/webhook/types.ts#L161)

##### chainId

> **chainId**: `number`

Defined in: [api/\_handlers/telegram/webhook/types.ts:158](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/api/_handlers/telegram/webhook/types.ts#L158)

##### creatorCoinAddress

> **creatorCoinAddress**: `` `0x${string}` ``

Defined in: [api/\_handlers/telegram/webhook/types.ts:157](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/api/_handlers/telegram/webhook/types.ts#L157)

##### groupId

> **groupId**: `string`

Defined in: [api/\_handlers/telegram/webhook/types.ts:159](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/api/_handlers/telegram/webhook/types.ts#L159)

##### isSettled

> **isSettled**: `boolean`

Defined in: [api/\_handlers/telegram/webhook/types.ts:160](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/api/_handlers/telegram/webhook/types.ts#L160)

##### vaultAddress

> **vaultAddress**: `` `0x${string}` ``

Defined in: [api/\_handlers/telegram/webhook/types.ts:156](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/api/_handlers/telegram/webhook/types.ts#L156)

***

### TelegramCallbackQuery

> **TelegramCallbackQuery** = `object`

Defined in: [api/\_handlers/telegram/webhook/types.ts:57](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/api/_handlers/telegram/webhook/types.ts#L57)

#### Properties

##### data?

> `optional` **data**: `string`

Defined in: [api/\_handlers/telegram/webhook/types.ts:59](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/api/_handlers/telegram/webhook/types.ts#L59)

##### from?

> `optional` **from**: [`TelegramFrom`](#telegramfrom)

Defined in: [api/\_handlers/telegram/webhook/types.ts:60](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/api/_handlers/telegram/webhook/types.ts#L60)

##### id?

> `optional` **id**: `string` \| `number`

Defined in: [api/\_handlers/telegram/webhook/types.ts:58](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/api/_handlers/telegram/webhook/types.ts#L58)

##### message?

> `optional` **message**: [`TelegramMessage`](#telegrammessage)

Defined in: [api/\_handlers/telegram/webhook/types.ts:61](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/api/_handlers/telegram/webhook/types.ts#L61)

***

### TelegramChat

> **TelegramChat** = `object`

Defined in: [api/\_handlers/telegram/webhook/types.ts:7](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/api/_handlers/telegram/webhook/types.ts#L7)

#### Properties

##### id?

> `optional` **id**: `number` \| `string`

Defined in: [api/\_handlers/telegram/webhook/types.ts:8](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/api/_handlers/telegram/webhook/types.ts#L8)

***

### TelegramChosenInlineResult

> **TelegramChosenInlineResult** = `object`

Defined in: [api/\_handlers/telegram/webhook/types.ts:49](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/api/_handlers/telegram/webhook/types.ts#L49)

#### Properties

##### from?

> `optional` **from**: [`TelegramFrom`](#telegramfrom)

Defined in: [api/\_handlers/telegram/webhook/types.ts:51](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/api/_handlers/telegram/webhook/types.ts#L51)

##### inline\_message\_id?

> `optional` **inline\_message\_id**: `string`

Defined in: [api/\_handlers/telegram/webhook/types.ts:53](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/api/_handlers/telegram/webhook/types.ts#L53)

##### location?

> `optional` **location**: [`TelegramLocation`](#telegramlocation)

Defined in: [api/\_handlers/telegram/webhook/types.ts:52](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/api/_handlers/telegram/webhook/types.ts#L52)

##### query?

> `optional` **query**: `string`

Defined in: [api/\_handlers/telegram/webhook/types.ts:54](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/api/_handlers/telegram/webhook/types.ts#L54)

##### result\_id?

> `optional` **result\_id**: `string`

Defined in: [api/\_handlers/telegram/webhook/types.ts:50](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/api/_handlers/telegram/webhook/types.ts#L50)

***

### TelegramCommandResponse

> **TelegramCommandResponse** = `object`

Defined in: [api/\_handlers/telegram/webhook/types.ts:89](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/api/_handlers/telegram/webhook/types.ts#L89)

#### Properties

##### callbackToast?

> `optional` **callbackToast**: `string`

Defined in: [api/\_handlers/telegram/webhook/types.ts:94](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/api/_handlers/telegram/webhook/types.ts#L94)

##### replyMarkup?

> `optional` **replyMarkup**: `Record`\<`string`, `unknown`\>

Defined in: [api/\_handlers/telegram/webhook/types.ts:91](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/api/_handlers/telegram/webhook/types.ts#L91)

##### signalReplyMarkup?

> `optional` **signalReplyMarkup**: `Record`\<`string`, `unknown`\>

Defined in: [api/\_handlers/telegram/webhook/types.ts:93](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/api/_handlers/telegram/webhook/types.ts#L93)

##### signalText?

> `optional` **signalText**: `string`

Defined in: [api/\_handlers/telegram/webhook/types.ts:92](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/api/_handlers/telegram/webhook/types.ts#L92)

##### text

> **text**: `string`

Defined in: [api/\_handlers/telegram/webhook/types.ts:90](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/api/_handlers/telegram/webhook/types.ts#L90)

***

### TelegramFrom

> **TelegramFrom** = `object`

Defined in: [api/\_handlers/telegram/webhook/types.ts:1](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/api/_handlers/telegram/webhook/types.ts#L1)

#### Properties

##### id?

> `optional` **id**: `number` \| `string`

Defined in: [api/\_handlers/telegram/webhook/types.ts:2](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/api/_handlers/telegram/webhook/types.ts#L2)

##### is\_bot?

> `optional` **is\_bot**: `boolean`

Defined in: [api/\_handlers/telegram/webhook/types.ts:3](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/api/_handlers/telegram/webhook/types.ts#L3)

##### username?

> `optional` **username**: `string`

Defined in: [api/\_handlers/telegram/webhook/types.ts:4](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/api/_handlers/telegram/webhook/types.ts#L4)

***

### TelegramInlineQuery

> **TelegramInlineQuery** = `object`

Defined in: [api/\_handlers/telegram/webhook/types.ts:29](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/api/_handlers/telegram/webhook/types.ts#L29)

#### Properties

##### chat\_type?

> `optional` **chat\_type**: [`TelegramInlineQueryChatType`](#telegraminlinequerychattype)

Defined in: [api/\_handlers/telegram/webhook/types.ts:33](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/api/_handlers/telegram/webhook/types.ts#L33)

##### from?

> `optional` **from**: [`TelegramFrom`](#telegramfrom)

Defined in: [api/\_handlers/telegram/webhook/types.ts:34](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/api/_handlers/telegram/webhook/types.ts#L34)

##### id?

> `optional` **id**: `string` \| `number`

Defined in: [api/\_handlers/telegram/webhook/types.ts:30](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/api/_handlers/telegram/webhook/types.ts#L30)

##### location?

> `optional` **location**: [`TelegramLocation`](#telegramlocation)

Defined in: [api/\_handlers/telegram/webhook/types.ts:35](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/api/_handlers/telegram/webhook/types.ts#L35)

##### offset?

> `optional` **offset**: `string`

Defined in: [api/\_handlers/telegram/webhook/types.ts:32](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/api/_handlers/telegram/webhook/types.ts#L32)

##### query?

> `optional` **query**: `string`

Defined in: [api/\_handlers/telegram/webhook/types.ts:31](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/api/_handlers/telegram/webhook/types.ts#L31)

***

### TelegramInlineQueryChatType

> **TelegramInlineQueryChatType** = `"sender"` \| `"private"` \| `"group"` \| `"supergroup"` \| `"channel"`

Defined in: [api/\_handlers/telegram/webhook/types.ts:38](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/api/_handlers/telegram/webhook/types.ts#L38)

***

### TelegramLocation

> **TelegramLocation** = `object`

Defined in: [api/\_handlers/telegram/webhook/types.ts:40](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/api/_handlers/telegram/webhook/types.ts#L40)

#### Properties

##### heading?

> `optional` **heading**: `number`

Defined in: [api/\_handlers/telegram/webhook/types.ts:45](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/api/_handlers/telegram/webhook/types.ts#L45)

##### horizontal\_accuracy?

> `optional` **horizontal\_accuracy**: `number`

Defined in: [api/\_handlers/telegram/webhook/types.ts:43](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/api/_handlers/telegram/webhook/types.ts#L43)

##### latitude?

> `optional` **latitude**: `number`

Defined in: [api/\_handlers/telegram/webhook/types.ts:41](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/api/_handlers/telegram/webhook/types.ts#L41)

##### live\_period?

> `optional` **live\_period**: `number`

Defined in: [api/\_handlers/telegram/webhook/types.ts:44](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/api/_handlers/telegram/webhook/types.ts#L44)

##### longitude?

> `optional` **longitude**: `number`

Defined in: [api/\_handlers/telegram/webhook/types.ts:42](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/api/_handlers/telegram/webhook/types.ts#L42)

##### proximity\_alert\_radius?

> `optional` **proximity\_alert\_radius**: `number`

Defined in: [api/\_handlers/telegram/webhook/types.ts:46](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/api/_handlers/telegram/webhook/types.ts#L46)

***

### TelegramMessage

> **TelegramMessage** = `object`

Defined in: [api/\_handlers/telegram/webhook/types.ts:19](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/api/_handlers/telegram/webhook/types.ts#L19)

#### Properties

##### caption?

> `optional` **caption**: `string`

Defined in: [api/\_handlers/telegram/webhook/types.ts:22](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/api/_handlers/telegram/webhook/types.ts#L22)

##### chat?

> `optional` **chat**: [`TelegramChat`](#telegramchat)

Defined in: [api/\_handlers/telegram/webhook/types.ts:24](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/api/_handlers/telegram/webhook/types.ts#L24)

##### from?

> `optional` **from**: [`TelegramFrom`](#telegramfrom)

Defined in: [api/\_handlers/telegram/webhook/types.ts:23](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/api/_handlers/telegram/webhook/types.ts#L23)

##### message\_id?

> `optional` **message\_id**: `number`

Defined in: [api/\_handlers/telegram/webhook/types.ts:20](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/api/_handlers/telegram/webhook/types.ts#L20)

##### reply\_to\_message?

> `optional` **reply\_to\_message**: [`TelegramMessage`](#telegrammessage)

Defined in: [api/\_handlers/telegram/webhook/types.ts:25](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/api/_handlers/telegram/webhook/types.ts#L25)

##### successful\_payment?

> `optional` **successful\_payment**: [`TelegramSuccessfulPayment`](#telegramsuccessfulpayment)

Defined in: [api/\_handlers/telegram/webhook/types.ts:26](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/api/_handlers/telegram/webhook/types.ts#L26)

##### text?

> `optional` **text**: `string`

Defined in: [api/\_handlers/telegram/webhook/types.ts:21](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/api/_handlers/telegram/webhook/types.ts#L21)

***

### TelegramPreCheckoutQuery

> **TelegramPreCheckoutQuery** = `object`

Defined in: [api/\_handlers/telegram/webhook/types.ts:64](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/api/_handlers/telegram/webhook/types.ts#L64)

#### Properties

##### currency?

> `optional` **currency**: `string`

Defined in: [api/\_handlers/telegram/webhook/types.ts:67](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/api/_handlers/telegram/webhook/types.ts#L67)

##### from?

> `optional` **from**: [`TelegramFrom`](#telegramfrom)

Defined in: [api/\_handlers/telegram/webhook/types.ts:66](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/api/_handlers/telegram/webhook/types.ts#L66)

##### id?

> `optional` **id**: `string` \| `number`

Defined in: [api/\_handlers/telegram/webhook/types.ts:65](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/api/_handlers/telegram/webhook/types.ts#L65)

##### invoice\_payload?

> `optional` **invoice\_payload**: `string`

Defined in: [api/\_handlers/telegram/webhook/types.ts:69](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/api/_handlers/telegram/webhook/types.ts#L69)

##### total\_amount?

> `optional` **total\_amount**: `number`

Defined in: [api/\_handlers/telegram/webhook/types.ts:68](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/api/_handlers/telegram/webhook/types.ts#L68)

***

### TelegramSuccessfulPayment

> **TelegramSuccessfulPayment** = `object`

Defined in: [api/\_handlers/telegram/webhook/types.ts:11](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/api/_handlers/telegram/webhook/types.ts#L11)

#### Properties

##### currency?

> `optional` **currency**: `string`

Defined in: [api/\_handlers/telegram/webhook/types.ts:12](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/api/_handlers/telegram/webhook/types.ts#L12)

##### invoice\_payload?

> `optional` **invoice\_payload**: `string`

Defined in: [api/\_handlers/telegram/webhook/types.ts:14](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/api/_handlers/telegram/webhook/types.ts#L14)

##### provider\_payment\_charge\_id?

> `optional` **provider\_payment\_charge\_id**: `string`

Defined in: [api/\_handlers/telegram/webhook/types.ts:16](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/api/_handlers/telegram/webhook/types.ts#L16)

##### telegram\_payment\_charge\_id?

> `optional` **telegram\_payment\_charge\_id**: `string`

Defined in: [api/\_handlers/telegram/webhook/types.ts:15](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/api/_handlers/telegram/webhook/types.ts#L15)

##### total\_amount?

> `optional` **total\_amount**: `number`

Defined in: [api/\_handlers/telegram/webhook/types.ts:13](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/api/_handlers/telegram/webhook/types.ts#L13)

***

### TelegramUpdate

> **TelegramUpdate** = `object`

Defined in: [api/\_handlers/telegram/webhook/types.ts:72](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/api/_handlers/telegram/webhook/types.ts#L72)

#### Properties

##### callback\_query?

> `optional` **callback\_query**: [`TelegramCallbackQuery`](#telegramcallbackquery)

Defined in: [api/\_handlers/telegram/webhook/types.ts:79](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/api/_handlers/telegram/webhook/types.ts#L79)

##### channel\_post?

> `optional` **channel\_post**: [`TelegramMessage`](#telegrammessage)

Defined in: [api/\_handlers/telegram/webhook/types.ts:76](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/api/_handlers/telegram/webhook/types.ts#L76)

##### chosen\_inline\_result?

> `optional` **chosen\_inline\_result**: [`TelegramChosenInlineResult`](#telegramchoseninlineresult)

Defined in: [api/\_handlers/telegram/webhook/types.ts:78](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/api/_handlers/telegram/webhook/types.ts#L78)

##### edited\_message?

> `optional` **edited\_message**: [`TelegramMessage`](#telegrammessage)

Defined in: [api/\_handlers/telegram/webhook/types.ts:75](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/api/_handlers/telegram/webhook/types.ts#L75)

##### inline\_query?

> `optional` **inline\_query**: [`TelegramInlineQuery`](#telegraminlinequery)

Defined in: [api/\_handlers/telegram/webhook/types.ts:77](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/api/_handlers/telegram/webhook/types.ts#L77)

##### message?

> `optional` **message**: [`TelegramMessage`](#telegrammessage)

Defined in: [api/\_handlers/telegram/webhook/types.ts:74](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/api/_handlers/telegram/webhook/types.ts#L74)

##### pre\_checkout\_query?

> `optional` **pre\_checkout\_query**: [`TelegramPreCheckoutQuery`](#telegramprecheckoutquery)

Defined in: [api/\_handlers/telegram/webhook/types.ts:80](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/api/_handlers/telegram/webhook/types.ts#L80)

##### update\_id?

> `optional` **update\_id**: `number`

Defined in: [api/\_handlers/telegram/webhook/types.ts:73](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/api/_handlers/telegram/webhook/types.ts#L73)

***

### TelegramWebhookOk

> **TelegramWebhookOk** = `object`

Defined in: [api/\_handlers/telegram/webhook/types.ts:83](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/api/_handlers/telegram/webhook/types.ts#L83)

#### Properties

##### ignored?

> `optional` **ignored**: `boolean`

Defined in: [api/\_handlers/telegram/webhook/types.ts:85](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/api/_handlers/telegram/webhook/types.ts#L85)

##### ok

> **ok**: `true`

Defined in: [api/\_handlers/telegram/webhook/types.ts:84](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/api/_handlers/telegram/webhook/types.ts#L84)

##### updateId?

> `optional` **updateId**: `number` \| `null`

Defined in: [api/\_handlers/telegram/webhook/types.ts:86](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/api/_handlers/telegram/webhook/types.ts#L86)
