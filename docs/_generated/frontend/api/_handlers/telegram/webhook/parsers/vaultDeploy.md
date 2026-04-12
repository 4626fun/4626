[**4626-app**](../../../../../index.md)

***

[4626-app](../../../../../index.md) / api/\_handlers/telegram/webhook/parsers/vaultDeploy

# api/\_handlers/telegram/webhook/parsers/vaultDeploy

## Type Aliases

### ParsedTelegramVaultDeployIntent

> **ParsedTelegramVaultDeployIntent** = \{ `kind`: `"menu"`; \} \| \{ `kind`: `"usage"`; `text`: `string`; \} \| \{ `kind`: `"request"`; `token`: `"akita"`; `version`: `string`; \}

Defined in: [api/\_handlers/telegram/webhook/parsers/vaultDeploy.ts:3](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/api/_handlers/telegram/webhook/parsers/vaultDeploy.ts#L3)

## Functions

### formatVaultDeployUsageText()

> **formatVaultDeployUsageText**(`reason?`): `string`

Defined in: [api/\_handlers/telegram/webhook/parsers/vaultDeploy.ts:11](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/api/_handlers/telegram/webhook/parsers/vaultDeploy.ts#L11)

#### Parameters

##### reason?

`string`

#### Returns

`string`

***

### parseTelegramVaultDeployIntent()

> **parseTelegramVaultDeployIntent**(`rawText`): [`ParsedTelegramVaultDeployIntent`](#parsedtelegramvaultdeployintent) \| `null`

Defined in: [api/\_handlers/telegram/webhook/parsers/vaultDeploy.ts:27](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/api/_handlers/telegram/webhook/parsers/vaultDeploy.ts#L27)

#### Parameters

##### rawText

`string`

#### Returns

[`ParsedTelegramVaultDeployIntent`](#parsedtelegramvaultdeployintent) \| `null`

***

### parseVaultDeployCallbackData()

> **parseVaultDeployCallbackData**(`rawData`): \{ `kind`: `"confirm"` \| `"decline"`; `token`: `string`; \} \| \{ `kind`: `"status"`; `token`: `string`; \} \| `null`

Defined in: [api/\_handlers/telegram/webhook/parsers/vaultDeploy.ts:57](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/api/_handlers/telegram/webhook/parsers/vaultDeploy.ts#L57)

#### Parameters

##### rawData

`string`

#### Returns

\{ `kind`: `"confirm"` \| `"decline"`; `token`: `string`; \} \| \{ `kind`: `"status"`; `token`: `string`; \} \| `null`
