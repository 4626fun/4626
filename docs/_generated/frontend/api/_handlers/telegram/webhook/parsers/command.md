[**4626-app**](../../../../../index.md)

***

[4626-app](../../../../../index.md) / api/\_handlers/telegram/webhook/parsers/command

# api/\_handlers/telegram/webhook/parsers/command

## Functions

### isTelegramNativeCommand()

> **isTelegramNativeCommand**(`rawText`): `boolean`

Defined in: [api/\_handlers/telegram/webhook/parsers/command.ts:7](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/api/_handlers/telegram/webhook/parsers/command.ts#L7)

#### Parameters

##### rawText

`string`

#### Returns

`boolean`

***

### shouldAutoRouteToAi()

> **shouldAutoRouteToAi**(`params`): `boolean`

Defined in: [api/\_handlers/telegram/webhook/parsers/command.ts:11](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/api/_handlers/telegram/webhook/parsers/command.ts#L11)

#### Parameters

##### params

###### aiFollowupEnabled

`boolean`

###### chatId

`string`

###### isPrivateChatId

(`chatId`) => `boolean`

###### message

[`TelegramMessage`](../types.md#telegrammessage)

###### text

`string`

#### Returns

`boolean`

## References

### getCommandHead

Re-exports [getCommandHead](../utils.md#getcommandhead)

***

### isHelpCategoryCommand

Re-exports [isHelpCategoryCommand](../utils.md#ishelpcategorycommand)

***

### isHelpCommand

Re-exports [isHelpCommand](../utils.md#ishelpcommand)

***

### isInlineLauncherCommand

Re-exports [isInlineLauncherCommand](../utils.md#isinlinelaunchercommand)

***

### isLikelyCommandText

Re-exports [isLikelyCommandText](../utils.md#islikelycommandtext)

***

### isTwitterCommand

Re-exports [isTwitterCommand](../utils.md#istwittercommand)

***

### normalizeTelegramCommand

Re-exports [normalizeTelegramCommand](../utils.md#normalizetelegramcommand)
