[**4626-app**](../../../../../index.md)

***

[4626-app](../../../../../index.md) / api/\_handlers/telegram/webhook/services/vaultDeploy

# api/\_handlers/telegram/webhook/services/vaultDeploy

## Type Aliases

### VaultDeployContracts

> **VaultDeployContracts** = `object`

Defined in: [api/\_handlers/telegram/webhook/services/vaultDeploy.ts:265](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/services/vaultDeploy.ts#L265)

#### Properties

##### ccaStrategy

> **ccaStrategy**: `Address` \| `null`

Defined in: [api/\_handlers/telegram/webhook/services/vaultDeploy.ts:271](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/services/vaultDeploy.ts#L271)

##### creatorToken

> **creatorToken**: `Address`

Defined in: [api/\_handlers/telegram/webhook/services/vaultDeploy.ts:266](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/services/vaultDeploy.ts#L266)

##### gaugeController

> **gaugeController**: `Address` \| `null`

Defined in: [api/\_handlers/telegram/webhook/services/vaultDeploy.ts:270](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/services/vaultDeploy.ts#L270)

##### oracle

> **oracle**: `Address` \| `null`

Defined in: [api/\_handlers/telegram/webhook/services/vaultDeploy.ts:272](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/services/vaultDeploy.ts#L272)

##### shareOFT

> **shareOFT**: `Address` \| `null`

Defined in: [api/\_handlers/telegram/webhook/services/vaultDeploy.ts:269](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/services/vaultDeploy.ts#L269)

##### vault

> **vault**: `Address` \| `null`

Defined in: [api/\_handlers/telegram/webhook/services/vaultDeploy.ts:267](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/services/vaultDeploy.ts#L267)

##### wrapper

> **wrapper**: `Address` \| `null`

Defined in: [api/\_handlers/telegram/webhook/services/vaultDeploy.ts:268](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/services/vaultDeploy.ts#L268)

***

### VaultDeployStartRequest

> **VaultDeployStartRequest** = `object`

Defined in: [api/\_handlers/telegram/webhook/services/vaultDeploy.ts:275](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/services/vaultDeploy.ts#L275)

#### Properties

##### autoContinue

> **autoContinue**: `boolean`

Defined in: [api/\_handlers/telegram/webhook/services/vaultDeploy.ts:285](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/services/vaultDeploy.ts#L285)

##### creatorToken

> **creatorToken**: `Address`

Defined in: [api/\_handlers/telegram/webhook/services/vaultDeploy.ts:277](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/services/vaultDeploy.ts#L277)

##### ownerAddress

> **ownerAddress**: `Address`

Defined in: [api/\_handlers/telegram/webhook/services/vaultDeploy.ts:278](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/services/vaultDeploy.ts#L278)

##### phase1Calls

> **phase1Calls**: `SessionCall`[]

Defined in: [api/\_handlers/telegram/webhook/services/vaultDeploy.ts:279](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/services/vaultDeploy.ts#L279)

##### phase2CoreCalls

> **phase2CoreCalls**: `SessionCall`[]

Defined in: [api/\_handlers/telegram/webhook/services/vaultDeploy.ts:280](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/services/vaultDeploy.ts#L280)

##### phase2FinalizeCalls

> **phase2FinalizeCalls**: `SessionCall`[]

Defined in: [api/\_handlers/telegram/webhook/services/vaultDeploy.ts:281](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/services/vaultDeploy.ts#L281)

##### phase3Calls

> **phase3Calls**: `SessionCall`[]

Defined in: [api/\_handlers/telegram/webhook/services/vaultDeploy.ts:282](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/services/vaultDeploy.ts#L282)

##### phase4Calls

> **phase4Calls**: `SessionCall`[]

Defined in: [api/\_handlers/telegram/webhook/services/vaultDeploy.ts:283](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/services/vaultDeploy.ts#L283)

##### smartWallet

> **smartWallet**: `Address`

Defined in: [api/\_handlers/telegram/webhook/services/vaultDeploy.ts:276](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/services/vaultDeploy.ts#L276)

##### version

> **version**: `string`

Defined in: [api/\_handlers/telegram/webhook/services/vaultDeploy.ts:284](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/services/vaultDeploy.ts#L284)

***

### VaultDeployStartResult

> **VaultDeployStartResult** = \{ `data`: `StartPayload`; `ok`: `true`; `status`: `number`; \} \| \{ `error`: `string`; `ok`: `false`; `status`: `number`; \}

Defined in: [api/\_handlers/telegram/webhook/services/vaultDeploy.ts:299](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/services/vaultDeploy.ts#L299)

***

### VaultDeployStatusResult

> **VaultDeployStatusResult** = \{ `data`: `StatusPayload`; `ok`: `true`; `status`: `number`; \} \| \{ `error`: `string`; `ok`: `false`; `status`: `number`; \}

Defined in: [api/\_handlers/telegram/webhook/services/vaultDeploy.ts:322](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/services/vaultDeploy.ts#L322)

## Functions

### buildAkitaVaultDeployStartRequest()

> **buildAkitaVaultDeployStartRequest**(`params`): `Promise`\<[`VaultDeployStartRequest`](#vaultdeploystartrequest)\>

Defined in: [api/\_handlers/telegram/webhook/services/vaultDeploy.ts:720](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/services/vaultDeploy.ts#L720)

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

Defined in: [api/\_handlers/telegram/webhook/services/vaultDeploy.ts:702](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/services/vaultDeploy.ts#L702)

#### Parameters

##### token

`string`

#### Returns

`Record`\<`string`, `unknown`\>

***

### fetchVaultDeployStatusFromTelegram()

> **fetchVaultDeployStatusFromTelegram**(`params`): `Promise`\<[`VaultDeployStatusResult`](#vaultdeploystatusresult)\>

Defined in: [api/\_handlers/telegram/webhook/services/vaultDeploy.ts:946](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/services/vaultDeploy.ts#L946)

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

Defined in: [api/\_handlers/telegram/webhook/services/vaultDeploy.ts:684](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/services/vaultDeploy.ts#L684)

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

Defined in: [api/\_handlers/telegram/webhook/services/vaultDeploy.ts:713](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/services/vaultDeploy.ts#L713)

#### Parameters

##### reason

`"expired"` | `"not_found"` | `"consumed"` | `"scope_mismatch"`

#### Returns

`string`

***

### startAkitaVaultDeployFromTelegram()

> **startAkitaVaultDeployFromTelegram**(`params`): `Promise`\<[`VaultDeployStartResult`](#vaultdeploystartresult)\>

Defined in: [api/\_handlers/telegram/webhook/services/vaultDeploy.ts:893](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/services/vaultDeploy.ts#L893)

#### Parameters

##### params

###### canonicalSmartWallet

`` `0x${string}` ``

###### version

`string`

#### Returns

`Promise`\<[`VaultDeployStartResult`](#vaultdeploystartresult)\>
