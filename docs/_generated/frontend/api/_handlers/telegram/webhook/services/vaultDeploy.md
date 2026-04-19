[**4626-app**](../../../../../index.md)

***

[4626-app](../../../../../index.md) / api/\_handlers/telegram/webhook/services/vaultDeploy

# api/\_handlers/telegram/webhook/services/vaultDeploy

## Type Aliases

### VaultDeployContracts

> **VaultDeployContracts** = `object`

Defined in: [api/\_handlers/telegram/webhook/services/vaultDeploy.ts:269](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/services/vaultDeploy.ts#L269)

#### Properties

##### ccaStrategy

> **ccaStrategy**: `Address` \| `null`

Defined in: [api/\_handlers/telegram/webhook/services/vaultDeploy.ts:275](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/services/vaultDeploy.ts#L275)

##### creatorToken

> **creatorToken**: `Address`

Defined in: [api/\_handlers/telegram/webhook/services/vaultDeploy.ts:270](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/services/vaultDeploy.ts#L270)

##### gaugeController

> **gaugeController**: `Address` \| `null`

Defined in: [api/\_handlers/telegram/webhook/services/vaultDeploy.ts:274](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/services/vaultDeploy.ts#L274)

##### oracle

> **oracle**: `Address` \| `null`

Defined in: [api/\_handlers/telegram/webhook/services/vaultDeploy.ts:276](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/services/vaultDeploy.ts#L276)

##### shareOFT

> **shareOFT**: `Address` \| `null`

Defined in: [api/\_handlers/telegram/webhook/services/vaultDeploy.ts:273](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/services/vaultDeploy.ts#L273)

##### vault

> **vault**: `Address` \| `null`

Defined in: [api/\_handlers/telegram/webhook/services/vaultDeploy.ts:271](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/services/vaultDeploy.ts#L271)

##### wrapper

> **wrapper**: `Address` \| `null`

Defined in: [api/\_handlers/telegram/webhook/services/vaultDeploy.ts:272](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/services/vaultDeploy.ts#L272)

***

### VaultDeployStartRequest

> **VaultDeployStartRequest** = `object`

Defined in: [api/\_handlers/telegram/webhook/services/vaultDeploy.ts:279](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/services/vaultDeploy.ts#L279)

#### Properties

##### autoContinue

> **autoContinue**: `boolean`

Defined in: [api/\_handlers/telegram/webhook/services/vaultDeploy.ts:289](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/services/vaultDeploy.ts#L289)

##### creatorToken

> **creatorToken**: `Address`

Defined in: [api/\_handlers/telegram/webhook/services/vaultDeploy.ts:281](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/services/vaultDeploy.ts#L281)

##### ownerAddress

> **ownerAddress**: `Address`

Defined in: [api/\_handlers/telegram/webhook/services/vaultDeploy.ts:282](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/services/vaultDeploy.ts#L282)

##### phase1Calls

> **phase1Calls**: `SessionCall`[]

Defined in: [api/\_handlers/telegram/webhook/services/vaultDeploy.ts:283](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/services/vaultDeploy.ts#L283)

##### phase2CoreCalls

> **phase2CoreCalls**: `SessionCall`[]

Defined in: [api/\_handlers/telegram/webhook/services/vaultDeploy.ts:284](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/services/vaultDeploy.ts#L284)

##### phase2FinalizeCalls

> **phase2FinalizeCalls**: `SessionCall`[]

Defined in: [api/\_handlers/telegram/webhook/services/vaultDeploy.ts:285](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/services/vaultDeploy.ts#L285)

##### phase3Calls

> **phase3Calls**: `SessionCall`[]

Defined in: [api/\_handlers/telegram/webhook/services/vaultDeploy.ts:286](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/services/vaultDeploy.ts#L286)

##### phase4Calls

> **phase4Calls**: `SessionCall`[]

Defined in: [api/\_handlers/telegram/webhook/services/vaultDeploy.ts:287](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/services/vaultDeploy.ts#L287)

##### smartWallet

> **smartWallet**: `Address`

Defined in: [api/\_handlers/telegram/webhook/services/vaultDeploy.ts:280](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/services/vaultDeploy.ts#L280)

##### version

> **version**: `string`

Defined in: [api/\_handlers/telegram/webhook/services/vaultDeploy.ts:288](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/services/vaultDeploy.ts#L288)

***

### VaultDeployStartResult

> **VaultDeployStartResult** = \{ `data`: `StartPayload`; `ok`: `true`; `status`: `number`; \} \| \{ `error`: `string`; `ok`: `false`; `status`: `number`; \}

Defined in: [api/\_handlers/telegram/webhook/services/vaultDeploy.ts:303](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/services/vaultDeploy.ts#L303)

***

### VaultDeployStatusResult

> **VaultDeployStatusResult** = \{ `data`: `StatusPayload`; `ok`: `true`; `status`: `number`; \} \| \{ `error`: `string`; `ok`: `false`; `status`: `number`; \}

Defined in: [api/\_handlers/telegram/webhook/services/vaultDeploy.ts:326](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/services/vaultDeploy.ts#L326)

## Functions

### buildAkitaVaultDeployStartRequest()

> **buildAkitaVaultDeployStartRequest**(`params`): `Promise`\<[`VaultDeployStartRequest`](#vaultdeploystartrequest)\>

Defined in: [api/\_handlers/telegram/webhook/services/vaultDeploy.ts:724](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/services/vaultDeploy.ts#L724)

#### Parameters

##### params

###### canonicalSmartWallet

`` `0x${string}` ``

###### version

`string`

#### Returns

`Promise`\<[`VaultDeployStartRequest`](#vaultdeploystartrequest)\>

***

### buildVaultDeployPreviewReplyMarkup()

> **buildVaultDeployPreviewReplyMarkup**(`token`): `Record`\<`string`, `unknown`\>

Defined in: [api/\_handlers/telegram/webhook/services/vaultDeploy.ts:706](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/services/vaultDeploy.ts#L706)

#### Parameters

##### token

`string`

#### Returns

`Record`\<`string`, `unknown`\>

***

### fetchVaultDeployStatusFromTelegram()

> **fetchVaultDeployStatusFromTelegram**(`params`): `Promise`\<[`VaultDeployStatusResult`](#vaultdeploystatusresult)\>

Defined in: [api/\_handlers/telegram/webhook/services/vaultDeploy.ts:950](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/services/vaultDeploy.ts#L950)

#### Parameters

##### params

###### canonicalSmartWallet

`` `0x${string}` ``

###### sessionId

`string`

#### Returns

`Promise`\<[`VaultDeployStatusResult`](#vaultdeploystatusresult)\>

***

### formatVaultDeployPreviewText()

> **formatVaultDeployPreviewText**(`params`): `string`

Defined in: [api/\_handlers/telegram/webhook/services/vaultDeploy.ts:688](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/services/vaultDeploy.ts#L688)

#### Parameters

##### params

###### creatorToken

`` `0x${string}` ``

###### expiresAt

`string`

###### smartWallet

`` `0x${string}` ``

###### version

`string`

#### Returns

`string`

***

### formatVaultDeployTokenFailure()

> **formatVaultDeployTokenFailure**(`reason`): `string`

Defined in: [api/\_handlers/telegram/webhook/services/vaultDeploy.ts:717](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/services/vaultDeploy.ts#L717)

#### Parameters

##### reason

`"expired"` | `"not_found"` | `"consumed"` | `"scope_mismatch"`

#### Returns

`string`

***

### startAkitaVaultDeployFromTelegram()

> **startAkitaVaultDeployFromTelegram**(`params`): `Promise`\<[`VaultDeployStartResult`](#vaultdeploystartresult)\>

Defined in: [api/\_handlers/telegram/webhook/services/vaultDeploy.ts:897](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/services/vaultDeploy.ts#L897)

#### Parameters

##### params

###### canonicalSmartWallet

`` `0x${string}` ``

###### version

`string`

#### Returns

`Promise`\<[`VaultDeployStartResult`](#vaultdeploystartresult)\>
