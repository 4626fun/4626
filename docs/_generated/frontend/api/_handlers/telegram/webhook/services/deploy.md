[**4626-app**](../../../../../index.md)

***

[4626-app](../../../../../index.md) / api/\_handlers/telegram/webhook/services/deploy

# api/\_handlers/telegram/webhook/services/deploy

## Functions

### buildDeployCommandFromIntent()

> **buildDeployCommandFromIntent**(`intent`): \{ `commandText`: `string`; `deployLabel`: `string`; `detailLines`: `string`[]; \} \| `null`

Defined in: [api/\_handlers/telegram/webhook/services/deploy.ts:4](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/api/_handlers/telegram/webhook/services/deploy.ts#L4)

#### Parameters

##### intent

`Record`\<`string`, `unknown`\>

#### Returns

\{ `commandText`: `string`; `deployLabel`: `string`; `detailLines`: `string`[]; \} \| `null`

***

### formatDeployTokenFailure()

> **formatDeployTokenFailure**(`reason`): `string`

Defined in: [api/\_handlers/telegram/webhook/services/deploy.ts:44](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/api/_handlers/telegram/webhook/services/deploy.ts#L44)

#### Parameters

##### reason

`"expired"` | `"not_found"` | `"consumed"` | `"scope_mismatch"`

#### Returns

`string`
