[**4626-web**](../../../../../index.md)

***

[4626-web](../../../../../index.md) / api/\_handlers/telegram/webhook/parsers/deploy

# api/\_handlers/telegram/webhook/parsers/deploy

## Functions

### defaultDeployCurrency()

> **defaultDeployCurrency**(`coinType`): [`DeployCurrencyInput`](../types.md#deploycurrencyinput)

Defined in: [api/\_handlers/telegram/webhook/parsers/deploy.ts:16](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/parsers/deploy.ts#L16)

#### Parameters

##### coinType

`"creator"` | `"content"`

#### Returns

[`DeployCurrencyInput`](../types.md#deploycurrencyinput)

***

### formatDeployUsageText()

> **formatDeployUsageText**(`reason?`): `string`

Defined in: [api/\_handlers/telegram/webhook/parsers/deploy.ts:21](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/parsers/deploy.ts#L21)

#### Parameters

##### reason?

`string`

#### Returns

`string`

***

### isDeployCurrencyInput()

> **isDeployCurrencyInput**(`raw`): `raw is DeployCurrencyInput`

Defined in: [api/\_handlers/telegram/webhook/parsers/deploy.ts:5](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/parsers/deploy.ts#L5)

#### Parameters

##### raw

`string`

#### Returns

`raw is DeployCurrencyInput`

***

### mapDeployCurrencyToCommandCurrency()

> **mapDeployCurrencyToCommandCurrency**(`input`): [`CommandCoinCurrency`](../types.md#commandcoincurrency)

Defined in: [api/\_handlers/telegram/webhook/parsers/deploy.ts:10](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/parsers/deploy.ts#L10)

#### Parameters

##### input

[`DeployCurrencyInput`](../types.md#deploycurrencyinput)

#### Returns

[`CommandCoinCurrency`](../types.md#commandcoincurrency)

***

### parseDeployCallbackData()

> **parseDeployCallbackData**(`rawData`): \{ `deployType`: `"zora"` \| [`DeployWizardType`](../types.md#deploywizardtype); `kind`: `"type"`; \} \| \{ `kind`: `"confirm"` \| `"decline"`; `token`: `string`; \} \| `null`

Defined in: [api/\_handlers/telegram/webhook/parsers/deploy.ts:106](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/parsers/deploy.ts#L106)

#### Parameters

##### rawData

`string`

#### Returns

\{ `deployType`: `"zora"` \| [`DeployWizardType`](../types.md#deploywizardtype); `kind`: `"type"`; \} \| \{ `kind`: `"confirm"` \| `"decline"`; `token`: `string`; \} \| `null`

***

### parseTelegramDeployIntent()

> **parseTelegramDeployIntent**(`rawText`): [`ParsedTelegramDeployIntent`](../types.md#parsedtelegramdeployintent) \| `null`

Defined in: [api/\_handlers/telegram/webhook/parsers/deploy.ts:40](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/parsers/deploy.ts#L40)

#### Parameters

##### rawText

`string`

#### Returns

[`ParsedTelegramDeployIntent`](../types.md#parsedtelegramdeployintent) \| `null`
