[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/pages/admin/adminOpsHelpers

# src/pages/admin/adminOpsHelpers

## Type Aliases

### LegacyVaultHint

> **LegacyVaultHint** = `object`

Defined in: [src/pages/admin/adminOpsHelpers.ts:96](https://github.com/wenakita/4626/blob/main/frontend/src/pages/admin/adminOpsHelpers.ts#L96)

#### Properties

##### id

> **id**: `string`

Defined in: [src/pages/admin/adminOpsHelpers.ts:97](https://github.com/wenakita/4626/blob/main/frontend/src/pages/admin/adminOpsHelpers.ts#L97)

##### label

> **label**: `string`

Defined in: [src/pages/admin/adminOpsHelpers.ts:98](https://github.com/wenakita/4626/blob/main/frontend/src/pages/admin/adminOpsHelpers.ts#L98)

##### shareOft?

> `optional` **shareOft**: `string`

Defined in: [src/pages/admin/adminOpsHelpers.ts:101](https://github.com/wenakita/4626/blob/main/frontend/src/pages/admin/adminOpsHelpers.ts#L101)

##### vault?

> `optional` **vault**: `string`

Defined in: [src/pages/admin/adminOpsHelpers.ts:99](https://github.com/wenakita/4626/blob/main/frontend/src/pages/admin/adminOpsHelpers.ts#L99)

##### vaultHint?

> `optional` **vaultHint**: `string`

Defined in: [src/pages/admin/adminOpsHelpers.ts:103](https://github.com/wenakita/4626/blob/main/frontend/src/pages/admin/adminOpsHelpers.ts#L103)

##### vesting?

> `optional` **vesting**: `string`

Defined in: [src/pages/admin/adminOpsHelpers.ts:102](https://github.com/wenakita/4626/blob/main/frontend/src/pages/admin/adminOpsHelpers.ts#L102)

##### wrapper?

> `optional` **wrapper**: `string`

Defined in: [src/pages/admin/adminOpsHelpers.ts:100](https://github.com/wenakita/4626/blob/main/frontend/src/pages/admin/adminOpsHelpers.ts#L100)

***

### LegacyVaultResolved

> **LegacyVaultResolved** = `object`

Defined in: [src/pages/admin/adminOpsHelpers.ts:106](https://github.com/wenakita/4626/blob/main/frontend/src/pages/admin/adminOpsHelpers.ts#L106)

#### Properties

##### id

> **id**: `string`

Defined in: [src/pages/admin/adminOpsHelpers.ts:107](https://github.com/wenakita/4626/blob/main/frontend/src/pages/admin/adminOpsHelpers.ts#L107)

##### label

> **label**: `string`

Defined in: [src/pages/admin/adminOpsHelpers.ts:108](https://github.com/wenakita/4626/blob/main/frontend/src/pages/admin/adminOpsHelpers.ts#L108)

##### resolvedFrom

> **resolvedFrom**: `"static"` \| `"registry"` \| `"unknown"`

Defined in: [src/pages/admin/adminOpsHelpers.ts:114](https://github.com/wenakita/4626/blob/main/frontend/src/pages/admin/adminOpsHelpers.ts#L114)

##### shareOft

> **shareOft**: `string`

Defined in: [src/pages/admin/adminOpsHelpers.ts:111](https://github.com/wenakita/4626/blob/main/frontend/src/pages/admin/adminOpsHelpers.ts#L111)

##### vault

> **vault**: `string`

Defined in: [src/pages/admin/adminOpsHelpers.ts:109](https://github.com/wenakita/4626/blob/main/frontend/src/pages/admin/adminOpsHelpers.ts#L109)

##### vaultHint?

> `optional` **vaultHint**: `string`

Defined in: [src/pages/admin/adminOpsHelpers.ts:113](https://github.com/wenakita/4626/blob/main/frontend/src/pages/admin/adminOpsHelpers.ts#L113)

##### vesting

> **vesting**: `string`

Defined in: [src/pages/admin/adminOpsHelpers.ts:112](https://github.com/wenakita/4626/blob/main/frontend/src/pages/admin/adminOpsHelpers.ts#L112)

##### wrapper

> **wrapper**: `string`

Defined in: [src/pages/admin/adminOpsHelpers.ts:110](https://github.com/wenakita/4626/blob/main/frontend/src/pages/admin/adminOpsHelpers.ts#L110)

***

### TxState

> **TxState** = `object`

Defined in: [src/pages/admin/adminOpsHelpers.ts:374](https://github.com/wenakita/4626/blob/main/frontend/src/pages/admin/adminOpsHelpers.ts#L374)

#### Properties

##### error?

> `optional` **error**: `string`

Defined in: [src/pages/admin/adminOpsHelpers.ts:377](https://github.com/wenakita/4626/blob/main/frontend/src/pages/admin/adminOpsHelpers.ts#L377)

##### hash?

> `optional` **hash**: `` `0x${string}` ``

Defined in: [src/pages/admin/adminOpsHelpers.ts:376](https://github.com/wenakita/4626/blob/main/frontend/src/pages/admin/adminOpsHelpers.ts#L376)

##### status

> **status**: `"idle"` \| `"pending"` \| `"success"` \| `"error"`

Defined in: [src/pages/admin/adminOpsHelpers.ts:375](https://github.com/wenakita/4626/blob/main/frontend/src/pages/admin/adminOpsHelpers.ts#L375)

## Variables

### AGENT\_URI\_HTTPS\_ALLOWLIST

> `const` **AGENT\_URI\_HTTPS\_ALLOWLIST**: `Set`\<`string`\>

Defined in: [src/pages/admin/adminOpsHelpers.ts:52](https://github.com/wenakita/4626/blob/main/frontend/src/pages/admin/adminOpsHelpers.ts#L52)

***

### CANONICAL\_SMART\_WALLET

> `const` **CANONICAL\_SMART\_WALLET**: `"0xAb6d5C10b03300326CD7fAb7267Ae192842967b5"` = `'0xAb6d5C10b03300326CD7fAb7267Ae192842967b5'`

Defined in: [src/pages/admin/adminOpsHelpers.ts:26](https://github.com/wenakita/4626/blob/main/frontend/src/pages/admin/adminOpsHelpers.ts#L26)

***

### COINBASE\_SMART\_WALLET\_EXECUTE\_BATCH\_ABI

> `const` **COINBASE\_SMART\_WALLET\_EXECUTE\_BATCH\_ABI**: readonly \[\{ `inputs`: readonly \[\{ `components`: readonly \[\{ `name`: `"target"`; `type`: `"address"`; \}, \{ `name`: `"value"`; `type`: `"uint256"`; \}, \{ `name`: `"data"`; `type`: `"bytes"`; \}\]; `name`: `"calls"`; `type`: `"tuple[]"`; \}\]; `name`: `"executeBatch"`; `outputs`: readonly \[\]; `stateMutability`: `"payable"`; `type`: `"function"`; \}\]

Defined in: [src/pages/admin/adminOpsHelpers.ts:350](https://github.com/wenakita/4626/blob/main/frontend/src/pages/admin/adminOpsHelpers.ts#L350)

***

### COINBASE\_SMART\_WALLET\_OWNER\_LINK\_ABI

> `const` **COINBASE\_SMART\_WALLET\_OWNER\_LINK\_ABI**: readonly \[\{ `inputs`: readonly \[\{ `name`: `"account"`; `type`: `"address"`; \}\]; `name`: `"isOwnerAddress"`; `outputs`: readonly \[\{ `name`: `""`; `type`: `"bool"`; \}\]; `stateMutability`: `"view"`; `type`: `"function"`; \}\]

Defined in: [src/pages/admin/adminOpsHelpers.ts:257](https://github.com/wenakita/4626/blob/main/frontend/src/pages/admin/adminOpsHelpers.ts#L257)

***

### CREATOR\_REGISTRY\_ABI

> `const` **CREATOR\_REGISTRY\_ABI**: readonly \[\{ `inputs`: readonly \[\]; `name`: `"getAllCreatorCoins"`; `outputs`: readonly \[\{ `type`: `"address[]"`; \}\]; `stateMutability`: `"view"`; `type`: `"function"`; \}, \{ `inputs`: readonly \[\{ `name`: `"_token"`; `type`: `"address"`; \}\]; `name`: `"getCreatorCoin"`; `outputs`: readonly \[\{ `name`: `"token"`; `type`: `"address"`; \}, \{ `name`: `"name"`; `type`: `"string"`; \}, \{ `name`: `"symbol"`; `type`: `"string"`; \}, \{ `name`: `"vault"`; `type`: `"address"`; \}, \{ `name`: `"shareOFT"`; `type`: `"address"`; \}, \{ `name`: `"wrapper"`; `type`: `"address"`; \}, \{ `name`: `"oracle"`; `type`: `"address"`; \}, \{ `name`: `"gaugeController"`; `type`: `"address"`; \}, \{ `name`: `"creator"`; `type`: `"address"`; \}, \{ `name`: `"pool"`; `type`: `"address"`; \}, \{ `name`: `"poolFee"`; `type`: `"uint24"`; \}, \{ `name`: `"primaryChainId"`; `type`: `"uint256"`; \}, \{ `name`: `"isActive"`; `type`: `"bool"`; \}, \{ `name`: `"registeredAt"`; `type`: `"uint256"`; \}\]; `stateMutability`: `"view"`; `type`: `"function"`; \}\]

Defined in: [src/pages/admin/adminOpsHelpers.ts:212](https://github.com/wenakita/4626/blob/main/frontend/src/pages/admin/adminOpsHelpers.ts#L212)

***

### CREATOR\_SHARE\_VESTING\_EVENT

> `const` **CREATOR\_SHARE\_VESTING\_EVENT**: `object`

Defined in: [src/pages/admin/adminOpsHelpers.ts:244](https://github.com/wenakita/4626/blob/main/frontend/src/pages/admin/adminOpsHelpers.ts#L244)

***

### ERC8004\_AGENT\_URI\_DEFAULT

> `const` **ERC8004\_AGENT\_URI\_DEFAULT**: `""` = `''`

Defined in: [src/pages/admin/adminOpsHelpers.ts:32](https://github.com/wenakita/4626/blob/main/frontend/src/pages/admin/adminOpsHelpers.ts#L32)

***

### ERC8004\_AGENT\_URI\_PLACEHOLDER

> `const` **ERC8004\_AGENT\_URI\_PLACEHOLDER**: `"https://... (gateway), ipfs://..., ar://..., or data:application/json;base64,..."` = `'https://... (gateway), ipfs://..., ar://..., or data:application/json;base64,...'`

Defined in: [src/pages/admin/adminOpsHelpers.ts:33](https://github.com/wenakita/4626/blob/main/frontend/src/pages/admin/adminOpsHelpers.ts#L33)

***

### ERC8004\_IDENTITY\_REGISTRY

> `const` **ERC8004\_IDENTITY\_REGISTRY**: `"0x8004A169FB4a3325136EB29fA0ceB6D2e539a432"` = `'0x8004A169FB4a3325136EB29fA0ceB6D2e539a432'`

Defined in: [src/pages/admin/adminOpsHelpers.ts:28](https://github.com/wenakita/4626/blob/main/frontend/src/pages/admin/adminOpsHelpers.ts#L28)

***

### ERC8004\_IDENTITY\_REGISTRY\_ABI

> `const` **ERC8004\_IDENTITY\_REGISTRY\_ABI**: readonly \[\{ `inputs`: readonly \[\{ `name`: `"agentURI"`; `type`: `"string"`; \}\]; `name`: `"register"`; `outputs`: readonly \[\{ `type`: `"uint256"`; \}\]; `stateMutability`: `"nonpayable"`; `type`: `"function"`; \}, \{ `inputs`: readonly \[\{ `name`: `"agentId"`; `type`: `"uint256"`; \}, \{ `name`: `"newURI"`; `type`: `"string"`; \}\]; `name`: `"setAgentURI"`; `outputs`: readonly \[\]; `stateMutability`: `"nonpayable"`; `type`: `"function"`; \}, \{ `inputs`: readonly \[\{ `name`: `"agentId"`; `type`: `"uint256"`; \}, \{ `name`: `"newWallet"`; `type`: `"address"`; \}, \{ `name`: `"deadline"`; `type`: `"uint256"`; \}, \{ `name`: `"signature"`; `type`: `"bytes"`; \}\]; `name`: `"setAgentWallet"`; `outputs`: readonly \[\]; `stateMutability`: `"nonpayable"`; `type`: `"function"`; \}, \{ `inputs`: readonly \[\{ `name`: `"agentId"`; `type`: `"uint256"`; \}\]; `name`: `"unsetAgentWallet"`; `outputs`: readonly \[\]; `stateMutability`: `"nonpayable"`; `type`: `"function"`; \}, \{ `inputs`: readonly \[\{ `name`: `"agentId"`; `type`: `"uint256"`; \}, \{ `name`: `"metadataKey"`; `type`: `"string"`; \}, \{ `name`: `"metadataValue"`; `type`: `"bytes"`; \}\]; `name`: `"setMetadata"`; `outputs`: readonly \[\]; `stateMutability`: `"nonpayable"`; `type`: `"function"`; \}, \{ `inputs`: readonly \[\{ `name`: `"owner"`; `type`: `"address"`; \}\]; `name`: `"balanceOf"`; `outputs`: readonly \[\{ `type`: `"uint256"`; \}\]; `stateMutability`: `"view"`; `type`: `"function"`; \}, \{ `inputs`: readonly \[\{ `name`: `"tokenId"`; `type`: `"uint256"`; \}\]; `name`: `"ownerOf"`; `outputs`: readonly \[\{ `type`: `"address"`; \}\]; `stateMutability`: `"view"`; `type`: `"function"`; \}, \{ `inputs`: readonly \[\{ `name`: `"agentId"`; `type`: `"uint256"`; \}\]; `name`: `"getAgentWallet"`; `outputs`: readonly \[\{ `type`: `"address"`; \}\]; `stateMutability`: `"view"`; `type`: `"function"`; \}, \{ `inputs`: readonly \[\{ `name`: `"agentId"`; `type`: `"uint256"`; \}, \{ `name`: `"metadataKey"`; `type`: `"string"`; \}\]; `name`: `"getMetadata"`; `outputs`: readonly \[\{ `type`: `"bytes"`; \}\]; `stateMutability`: `"view"`; `type`: `"function"`; \}\]

Defined in: [src/pages/admin/adminOpsHelpers.ts:267](https://github.com/wenakita/4626/blob/main/frontend/src/pages/admin/adminOpsHelpers.ts#L267)

***

### ERC8004\_REGISTERED\_EVENT

> `const` **ERC8004\_REGISTERED\_EVENT**: `object`

Defined in: [src/pages/admin/adminOpsHelpers.ts:279](https://github.com/wenakita/4626/blob/main/frontend/src/pages/admin/adminOpsHelpers.ts#L279)

***

### LEGACY\_DYNAMIC\_HINT\_IDS

> `const` **LEGACY\_DYNAMIC\_HINT\_IDS**: `string`[]

Defined in: [src/pages/admin/adminOpsHelpers.ts:172](https://github.com/wenakita/4626/blob/main/frontend/src/pages/admin/adminOpsHelpers.ts#L172)

***

### LEGACY\_DYNAMIC\_SLOT\_COUNT

> `const` **LEGACY\_DYNAMIC\_SLOT\_COUNT**: `8` = `8`

Defined in: [src/pages/admin/adminOpsHelpers.ts:162](https://github.com/wenakita/4626/blob/main/frontend/src/pages/admin/adminOpsHelpers.ts#L162)

***

### LEGACY\_DYNAMIC\_VAULT\_HINTS

> `const` **LEGACY\_DYNAMIC\_VAULT\_HINTS**: [`LegacyVaultHint`](#legacyvaulthint)[]

Defined in: [src/pages/admin/adminOpsHelpers.ts:164](https://github.com/wenakita/4626/blob/main/frontend/src/pages/admin/adminOpsHelpers.ts#L164)

***

### LEGACY\_STATIC\_VAULT\_HINTS

> `const` **LEGACY\_STATIC\_VAULT\_HINTS**: [`LegacyVaultHint`](#legacyvaulthint)[]

Defined in: [src/pages/admin/adminOpsHelpers.ts:117](https://github.com/wenakita/4626/blob/main/frontend/src/pages/admin/adminOpsHelpers.ts#L117)

***

### LEGACY\_VAULT\_HINTS

> `const` **LEGACY\_VAULT\_HINTS**: [`LegacyVaultHint`](#legacyvaulthint)[]

Defined in: [src/pages/admin/adminOpsHelpers.ts:174](https://github.com/wenakita/4626/blob/main/frontend/src/pages/admin/adminOpsHelpers.ts#L174)

***

### PHASE1\_DEPLOYED\_EVENT

> `const` **PHASE1\_DEPLOYED\_EVENT**: `object`

Defined in: [src/pages/admin/adminOpsHelpers.ts:247](https://github.com/wenakita/4626/blob/main/frontend/src/pages/admin/adminOpsHelpers.ts#L247)

***

### QUEUED\_WITHDRAWAL\_ABI

> `const` **QUEUED\_WITHDRAWAL\_ABI**: readonly \[\{ `inputs`: readonly \[\{ `name`: `"account"`; `type`: `"address"`; \}\]; `name`: `"queuedWithdrawals"`; `outputs`: readonly \[\{ `name`: `"shares"`; `type`: `"uint256"`; \}, \{ `name`: `"unlockBlock"`; `type`: `"uint256"`; \}, \{ `name`: `"receiver"`; `type`: `"address"`; \}\]; `stateMutability`: `"view"`; `type`: `"function"`; \}\]

Defined in: [src/pages/admin/adminOpsHelpers.ts:336](https://github.com/wenakita/4626/blob/main/frontend/src/pages/admin/adminOpsHelpers.ts#L336)

***

### SHARE\_OFT\_METADATA\_ABI

> `const` **SHARE\_OFT\_METADATA\_ABI**: readonly \[\{ `inputs`: readonly \[\]; `name`: `"contractURI"`; `outputs`: readonly \[\{ `type`: `"string"`; \}\]; `stateMutability`: `"view"`; `type`: `"function"`; \}, \{ `inputs`: readonly \[\{ `name`: `"uri"`; `type`: `"string"`; \}\]; `name`: `"setContractURI"`; `outputs`: readonly \[\]; `stateMutability`: `"nonpayable"`; `type`: `"function"`; \}\]

Defined in: [src/pages/admin/adminOpsHelpers.ts:283](https://github.com/wenakita/4626/blob/main/frontend/src/pages/admin/adminOpsHelpers.ts#L283)

***

### VAULT\_ABI

> `const` **VAULT\_ABI**: readonly \[\{ `inputs`: readonly \[\{ `name`: `"shares"`; `type`: `"uint256"`; \}, \{ `name`: `"receiver"`; `type`: `"address"`; \}\]; `name`: `"queueWithdrawal"`; `outputs`: readonly \[\]; `stateMutability`: `"nonpayable"`; `type`: `"function"`; \}, \{ `inputs`: readonly \[\]; `name`: `"claimQueuedWithdrawal"`; `outputs`: readonly \[\{ `type`: `"uint256"`; \}\]; `stateMutability`: `"nonpayable"`; `type`: `"function"`; \}, \{ `inputs`: readonly \[\{ `name`: `"shares"`; `type`: `"uint256"`; \}, \{ `name`: `"receiver"`; `type`: `"address"`; \}, \{ `name`: `"owner"`; `type`: `"address"`; \}\]; `name`: `"redeem"`; `outputs`: readonly \[\{ `type`: `"uint256"`; \}\]; `stateMutability`: `"nonpayable"`; `type`: `"function"`; \}, \{ `inputs`: readonly \[\{ `name`: `"shares"`; `type`: `"uint256"`; \}\]; `name`: `"previewRedeem"`; `outputs`: readonly \[\{ `type`: `"uint256"`; \}\]; `stateMutability`: `"view"`; `type`: `"function"`; \}, \{ `inputs`: readonly \[\]; `name`: `"largeWithdrawalThreshold"`; `outputs`: readonly \[\{ `type`: `"uint256"`; \}\]; `stateMutability`: `"view"`; `type`: `"function"`; \}\]

Defined in: [src/pages/admin/adminOpsHelpers.ts:292](https://github.com/wenakita/4626/blob/main/frontend/src/pages/admin/adminOpsHelpers.ts#L292)

***

### VAULT\_EMERGENCY\_ABI

> `const` **VAULT\_EMERGENCY\_ABI**: readonly \[\{ `inputs`: readonly \[\]; `name`: `"asset"`; `outputs`: readonly \[\{ `type`: `"address"`; \}\]; `stateMutability`: `"view"`; `type`: `"function"`; \}, \{ `inputs`: readonly \[\]; `name`: `"isShutdown"`; `outputs`: readonly \[\{ `type`: `"bool"`; \}\]; `stateMutability`: `"view"`; `type`: `"function"`; \}, \{ `inputs`: readonly \[\]; `name`: `"shutdownVault"`; `outputs`: readonly \[\]; `stateMutability`: `"nonpayable"`; `type`: `"function"`; \}, \{ `inputs`: readonly \[\]; `name`: `"emergencyWithdrawFromStrategies"`; `outputs`: readonly \[\]; `stateMutability`: `"nonpayable"`; `type`: `"function"`; \}, \{ `inputs`: readonly \[\{ `name`: `"amount"`; `type`: `"uint256"`; \}, \{ `name`: `"to"`; `type`: `"address"`; \}\]; `name`: `"emergencyWithdraw"`; `outputs`: readonly \[\]; `stateMutability`: `"nonpayable"`; `type`: `"function"`; \}\]

Defined in: [src/pages/admin/adminOpsHelpers.ts:319](https://github.com/wenakita/4626/blob/main/frontend/src/pages/admin/adminOpsHelpers.ts#L319)

***

### VESTING\_ABI

> `const` **VESTING\_ABI**: readonly \[\{ `inputs`: readonly \[\]; `name`: `"releasable"`; `outputs`: readonly \[\{ `type`: `"uint256"`; \}\]; `stateMutability`: `"view"`; `type`: `"function"`; \}, \{ `inputs`: readonly \[\]; `name`: `"release"`; `outputs`: readonly \[\{ `type`: `"uint256"`; \}\]; `stateMutability`: `"nonpayable"`; `type`: `"function"`; \}, \{ `inputs`: readonly \[\]; `name`: `"beneficiary"`; `outputs`: readonly \[\{ `type`: `"address"`; \}\]; `stateMutability`: `"view"`; `type`: `"function"`; \}\]

Defined in: [src/pages/admin/adminOpsHelpers.ts:251](https://github.com/wenakita/4626/blob/main/frontend/src/pages/admin/adminOpsHelpers.ts#L251)

***

### WRAPPER\_ABI

> `const` **WRAPPER\_ABI**: readonly \[\{ `inputs`: readonly \[\{ `name`: `"amount"`; `type`: `"uint256"`; \}\]; `name`: `"unwrap"`; `outputs`: readonly \[\{ `type`: `"uint256"`; \}\]; `stateMutability`: `"nonpayable"`; `type`: `"function"`; \}\]

Defined in: [src/pages/admin/adminOpsHelpers.ts:288](https://github.com/wenakita/4626/blob/main/frontend/src/pages/admin/adminOpsHelpers.ts#L288)

***

### ZERO\_ADDRESS

> `const` **ZERO\_ADDRESS**: `"0x0000000000000000000000000000000000000000"` = `'0x0000000000000000000000000000000000000000'`

Defined in: [src/pages/admin/adminOpsHelpers.ts:27](https://github.com/wenakita/4626/blob/main/frontend/src/pages/admin/adminOpsHelpers.ts#L27)

## Functions

### agentUriValidationMessage()

> **agentUriValidationMessage**(): `string`

Defined in: [src/pages/admin/adminOpsHelpers.ts:85](https://github.com/wenakita/4626/blob/main/frontend/src/pages/admin/adminOpsHelpers.ts#L85)

#### Returns

`string`

***

### buildTxHref()

> **buildTxHref**(`hash?`): `string` \| `null`

Defined in: [src/pages/admin/adminOpsHelpers.ts:402](https://github.com/wenakita/4626/blob/main/frontend/src/pages/admin/adminOpsHelpers.ts#L402)

#### Parameters

##### hash?

`string`

#### Returns

`string` \| `null`

***

### extractMetaMessages()

> **extractMetaMessages**(`error`): `string` \| `null`

Defined in: [src/pages/admin/adminOpsHelpers.ts:429](https://github.com/wenakita/4626/blob/main/frontend/src/pages/admin/adminOpsHelpers.ts#L429)

#### Parameters

##### error

`unknown`

#### Returns

`string` \| `null`

***

### fetchLegacyPhase1Map()

> **fetchLegacyPhase1Map**(`publicClient`, `owner?`): `Promise`\<`Map`\<`string`, \{ `shareOft`: `` `0x${string}` ``; `vault`: `` `0x${string}` ``; `wrapper`: `` `0x${string}` ``; \}\>\>

Defined in: [src/pages/admin/adminOpsHelpers.ts:530](https://github.com/wenakita/4626/blob/main/frontend/src/pages/admin/adminOpsHelpers.ts#L530)

#### Parameters

##### publicClient

`any`

##### owner?

`` `0x${string}` ``

#### Returns

`Promise`\<`Map`\<`string`, \{ `shareOft`: `` `0x${string}` ``; `vault`: `` `0x${string}` ``; `wrapper`: `` `0x${string}` ``; \}\>\>

***

### fetchLegacyVesting()

> **fetchLegacyVesting**(`publicClient`, `shareOft`, `beneficiary`): `Promise`\<`` `0x${string}` `` \| `null`\>

Defined in: [src/pages/admin/adminOpsHelpers.ts:507](https://github.com/wenakita/4626/blob/main/frontend/src/pages/admin/adminOpsHelpers.ts#L507)

#### Parameters

##### publicClient

`any`

##### shareOft

`` `0x${string}` ``

##### beneficiary

`` `0x${string}` ``

#### Returns

`Promise`\<`` `0x${string}` `` \| `null`\>

***

### formatToken()

> **formatToken**(`value`): `string`

Defined in: [src/pages/admin/adminOpsHelpers.ts:385](https://github.com/wenakita/4626/blob/main/frontend/src/pages/admin/adminOpsHelpers.ts#L385)

#### Parameters

##### value

`bigint` | `undefined`

#### Returns

`string`

***

### getLegacyVestingStartBlock()

> **getLegacyVestingStartBlock**(): `bigint`

Defined in: [src/pages/admin/adminOpsHelpers.ts:200](https://github.com/wenakita/4626/blob/main/frontend/src/pages/admin/adminOpsHelpers.ts#L200)

#### Returns

`bigint`

***

### isAllowlistedHttpsAgentUri()

> **isAllowlistedHttpsAgentUri**(`uri`): `boolean`

Defined in: [src/pages/admin/adminOpsHelpers.ts:59](https://github.com/wenakita/4626/blob/main/frontend/src/pages/admin/adminOpsHelpers.ts#L59)

#### Parameters

##### uri

`string`

#### Returns

`boolean`

***

### isContentAddressedAgentUri()

> **isContentAddressedAgentUri**(`uri`): `boolean`

Defined in: [src/pages/admin/adminOpsHelpers.ts:81](https://github.com/wenakita/4626/blob/main/frontend/src/pages/admin/adminOpsHelpers.ts#L81)

#### Parameters

##### uri

`string`

#### Returns

`boolean`

***

### isStrictContentAddressedAgentUri()

> **isStrictContentAddressedAgentUri**(`uri`): `boolean`

Defined in: [src/pages/admin/adminOpsHelpers.ts:40](https://github.com/wenakita/4626/blob/main/frontend/src/pages/admin/adminOpsHelpers.ts#L40)

#### Parameters

##### uri

`string`

#### Returns

`boolean`

***

### matchVaultHint()

> **matchVaultHint**(`hint`, `vaults`): `string` \| `null`

Defined in: [src/pages/admin/adminOpsHelpers.ts:192](https://github.com/wenakita/4626/blob/main/frontend/src/pages/admin/adminOpsHelpers.ts#L192)

#### Parameters

##### hint

`string` | `undefined`

##### vaults

`string`[]

#### Returns

`string` \| `null`

***

### normalizeAllowlistedHost()

> **normalizeAllowlistedHost**(`raw`): `string`

Defined in: [src/pages/admin/adminOpsHelpers.ts:45](https://github.com/wenakita/4626/blob/main/frontend/src/pages/admin/adminOpsHelpers.ts#L45)

#### Parameters

##### raw

`string`

#### Returns

`string`

***

### parseAmount()

> **parseAmount**(`input`): `bigint` \| `null`

Defined in: [src/pages/admin/adminOpsHelpers.ts:391](https://github.com/wenakita/4626/blob/main/frontend/src/pages/admin/adminOpsHelpers.ts#L391)

#### Parameters

##### input

`string`

#### Returns

`bigint` \| `null`

***

### parseVaultHint()

> **parseVaultHint**(`hint?`): \{ `prefix`: `string`; `suffix`: `string`; \} \| `null`

Defined in: [src/pages/admin/adminOpsHelpers.ts:179](https://github.com/wenakita/4626/blob/main/frontend/src/pages/admin/adminOpsHelpers.ts#L179)

#### Parameters

##### hint?

`string`

#### Returns

\{ `prefix`: `string`; `suffix`: `string`; \} \| `null`

***

### resolveShareOftFromVault()

> **resolveShareOftFromVault**(`publicClient`, `vaultAddress`): `Promise`\<`` `0x${string}` `` \| `null`\>

Defined in: [src/pages/admin/adminOpsHelpers.ts:565](https://github.com/wenakita/4626/blob/main/frontend/src/pages/admin/adminOpsHelpers.ts#L565)

#### Parameters

##### publicClient

`any`

##### vaultAddress

`` `0x${string}` ``

#### Returns

`Promise`\<`` `0x${string}` `` \| `null`\>

***

### sendEmbeddedOwnerSmartWalletCall()

> **sendEmbeddedOwnerSmartWalletCall**(`params`): `Promise`\<\{ `transactionHash`: `` `0x${string}` ``; `userOpHash`: `` `0x${string}` ``; \}\>

Defined in: [src/pages/admin/adminOpsHelpers.ts:610](https://github.com/wenakita/4626/blob/main/frontend/src/pages/admin/adminOpsHelpers.ts#L610)

#### Parameters

##### params

###### bundlerUrl

`string`

###### calls

`object`[]

###### embeddedProvider

\{ `request`: (`args`) => `Promise`\<`unknown`\>; \}

###### embeddedProvider.request

(`args`) => `Promise`\<`unknown`\>

###### ownerAddress

`` `0x${string}` ``

###### publicClient

`any`

###### smartWallet

`` `0x${string}` ``

#### Returns

`Promise`\<\{ `transactionHash`: `` `0x${string}` ``; `userOpHash`: `` `0x${string}` ``; \}\>

***

### shortAddress()

> **shortAddress**(`addr`): `string`

Defined in: [src/pages/admin/adminOpsHelpers.ts:380](https://github.com/wenakita/4626/blob/main/frontend/src/pages/admin/adminOpsHelpers.ts#L380)

#### Parameters

##### addr

`string`

#### Returns

`string`

***

### shouldFallbackToOwnerDirectExecute()

> **shouldFallbackToOwnerDirectExecute**(`error`): `boolean`

Defined in: [src/pages/admin/adminOpsHelpers.ts:407](https://github.com/wenakita/4626/blob/main/frontend/src/pages/admin/adminOpsHelpers.ts#L407)

#### Parameters

##### error

`unknown`

#### Returns

`boolean`

***

### summarizeErrorReason()

> **summarizeErrorReason**(`error`): `string`

Defined in: [src/pages/admin/adminOpsHelpers.ts:458](https://github.com/wenakita/4626/blob/main/frontend/src/pages/admin/adminOpsHelpers.ts#L458)

#### Parameters

##### error

`unknown`

#### Returns

`string`

***

### toFriendlyTxError()

> **toFriendlyTxError**(`error`): `string`

Defined in: [src/pages/admin/adminOpsHelpers.ts:478](https://github.com/wenakita/4626/blob/main/frontend/src/pages/admin/adminOpsHelpers.ts#L478)

#### Parameters

##### error

`unknown`

#### Returns

`string`
