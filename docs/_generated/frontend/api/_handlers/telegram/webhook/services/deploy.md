[**4626-web**](../../../../../index.md)

***

[4626-web](../../../../../index.md) / api/\_handlers/telegram/webhook/services/deploy

# api/\_handlers/telegram/webhook/services/deploy

## Functions

### buildDeployCommandFromIntent()

> **buildDeployCommandFromIntent**(`intent`): \{ `commandText`: `string`; `deployLabel`: `string`; `detailLines`: `string`[]; \} \| `null`

Defined in: [api/\_handlers/telegram/webhook/services/deploy.ts:4](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/telegram/webhook/services/deploy.ts#L4)

#### Parameters

##### intent

`Record`\<`string`, `unknown`\>

#### Returns

\{ `commandText`: `string`; `deployLabel`: `string`; `detailLines`: `string`[]; \} \| `null`

***

### formatDeployTokenFailure()

> **formatDeployTokenFailure**(`reason`): `string`

Defined in: [api/\_handlers/telegram/webhook/services/deploy.ts:44](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/telegram/webhook/services/deploy.ts#L44)

#### Parameters

##### reason

`"expired"` | `"not_found"` | `"consumed"` | `"scope_mismatch"`

#### Returns

`string`
