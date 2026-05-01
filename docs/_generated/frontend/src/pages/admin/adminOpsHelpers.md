[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/pages/admin/adminOpsHelpers

# src/pages/admin/adminOpsHelpers

## Type Aliases

### LegacyVaultHint

> **LegacyVaultHint** = `object`

Defined in: [src/pages/admin/adminOpsHelpers.ts:99](https://github.com/wenakita/4626/blob/main/frontend/src/pages/admin/adminOpsHelpers.ts#L99)

#### Properties

##### id

> **id**: `string`

Defined in: [src/pages/admin/adminOpsHelpers.ts:100](https://github.com/wenakita/4626/blob/main/frontend/src/pages/admin/adminOpsHelpers.ts#L100)

##### label

> **label**: `string`

Defined in: [src/pages/admin/adminOpsHelpers.ts:101](https://github.com/wenakita/4626/blob/main/frontend/src/pages/admin/adminOpsHelpers.ts#L101)

##### shareOft?

> `optional` **shareOft**: `string`

Defined in: [src/pages/admin/adminOpsHelpers.ts:104](https://github.com/wenakita/4626/blob/main/frontend/src/pages/admin/adminOpsHelpers.ts#L104)

##### vault?

> `optional` **vault**: `string`

Defined in: [src/pages/admin/adminOpsHelpers.ts:102](https://github.com/wenakita/4626/blob/main/frontend/src/pages/admin/adminOpsHelpers.ts#L102)

##### vaultHint?

> `optional` **vaultHint**: `string`

Defined in: [src/pages/admin/adminOpsHelpers.ts:106](https://github.com/wenakita/4626/blob/main/frontend/src/pages/admin/adminOpsHelpers.ts#L106)

##### vesting?

> `optional` **vesting**: `string`

Defined in: [src/pages/admin/adminOpsHelpers.ts:105](https://github.com/wenakita/4626/blob/main/frontend/src/pages/admin/adminOpsHelpers.ts#L105)

##### wrapper?

> `optional` **wrapper**: `string`

Defined in: [src/pages/admin/adminOpsHelpers.ts:103](https://github.com/wenakita/4626/blob/main/frontend/src/pages/admin/adminOpsHelpers.ts#L103)

***

### LegacyVaultResolved

> **LegacyVaultResolved** = `object`

Defined in: [src/pages/admin/adminOpsHelpers.ts:109](https://github.com/wenakita/4626/blob/main/frontend/src/pages/admin/adminOpsHelpers.ts#L109)

#### Properties

##### id

> **id**: `string`

Defined in: [src/pages/admin/adminOpsHelpers.ts:110](https://github.com/wenakita/4626/blob/main/frontend/src/pages/admin/adminOpsHelpers.ts#L110)

##### label

> **label**: `string`

Defined in: [src/pages/admin/adminOpsHelpers.ts:111](https://github.com/wenakita/4626/blob/main/frontend/src/pages/admin/adminOpsHelpers.ts#L111)

##### resolvedFrom

> **resolvedFrom**: `"static"` \| `"registry"` \| `"unknown"`

Defined in: [src/pages/admin/adminOpsHelpers.ts:117](https://github.com/wenakita/4626/blob/main/frontend/src/pages/admin/adminOpsHelpers.ts#L117)

##### shareOft

> **shareOft**: `string`

Defined in: [src/pages/admin/adminOpsHelpers.ts:114](https://github.com/wenakita/4626/blob/main/frontend/src/pages/admin/adminOpsHelpers.ts#L114)

##### vault

> **vault**: `string`

Defined in: [src/pages/admin/adminOpsHelpers.ts:112](https://github.com/wenakita/4626/blob/main/frontend/src/pages/admin/adminOpsHelpers.ts#L112)

##### vaultHint?

> `optional` **vaultHint**: `string`

Defined in: [src/pages/admin/adminOpsHelpers.ts:116](https://github.com/wenakita/4626/blob/main/frontend/src/pages/admin/adminOpsHelpers.ts#L116)

##### vesting

> **vesting**: `string`

Defined in: [src/pages/admin/adminOpsHelpers.ts:115](https://github.com/wenakita/4626/blob/main/frontend/src/pages/admin/adminOpsHelpers.ts#L115)

##### wrapper

> **wrapper**: `string`

Defined in: [src/pages/admin/adminOpsHelpers.ts:113](https://github.com/wenakita/4626/blob/main/frontend/src/pages/admin/adminOpsHelpers.ts#L113)

***

### TxState

> **TxState** = `object`

Defined in: [src/pages/admin/adminOpsHelpers.ts:377](https://github.com/wenakita/4626/blob/main/frontend/src/pages/admin/adminOpsHelpers.ts#L377)

#### Properties

##### error?

> `optional` **error**: `string`

Defined in: [src/pages/admin/adminOpsHelpers.ts:380](https://github.com/wenakita/4626/blob/main/frontend/src/pages/admin/adminOpsHelpers.ts#L380)

##### hash?

> `optional` **hash**: `` `0x${string}` ``

Defined in: [src/pages/admin/adminOpsHelpers.ts:379](https://github.com/wenakita/4626/blob/main/frontend/src/pages/admin/adminOpsHelpers.ts#L379)

##### status

> **status**: `"idle"` \| `"pending"` \| `"success"` \| `"error"`

Defined in: [src/pages/admin/adminOpsHelpers.ts:378](https://github.com/wenakita/4626/blob/main/frontend/src/pages/admin/adminOpsHelpers.ts#L378)

## Variables

### AGENT\_URI\_HTTPS\_ALLOWLIST

> `const` **AGENT\_URI\_HTTPS\_ALLOWLIST**: `Set`\<`string`\>

Defined in: [src/pages/admin/adminOpsHelpers.ts:55](https://github.com/wenakita/4626/blob/main/frontend/src/pages/admin/adminOpsHelpers.ts#L55)

***

### CANONICAL\_SMART\_WALLET

> `const` **CANONICAL\_SMART\_WALLET**: `"0xab6d5c10b03300326cd7fab7267ae192842967b5"` = `'0xab6d5c10b03300326cd7fab7267ae192842967b5'`

Defined in: [src/pages/admin/adminOpsHelpers.ts:29](https://github.com/wenakita/4626/blob/main/frontend/src/pages/admin/adminOpsHelpers.ts#L29)

***

### COINBASE\_SMART\_WALLET\_EXECUTE\_BATCH\_ABI

> `const` **COINBASE\_SMART\_WALLET\_EXECUTE\_BATCH\_ABI**: readonly \[\{ `inputs`: readonly \[\{ `components`: readonly \[\{ `name`: `"target"`; `type`: `"address"`; \}, \{ `name`: `"value"`; `type`: `"uint256"`; \}, \{ `name`: `"data"`; `type`: `"bytes"`; \}\]; `name`: `"calls"`; `type`: `"tuple[]"`; \}\]; `name`: `"executeBatch"`; `outputs`: readonly \[\]; `stateMutability`: `"payable"`; `type`: `"function"`; \}\]

Defined in: [src/pages/admin/adminOpsHelpers.ts:353](https://github.com/wenakita/4626/blob/main/frontend/src/pages/admin/adminOpsHelpers.ts#L353)

***

### COINBASE\_SMART\_WALLET\_OWNER\_LINK\_ABI

> `const` **COINBASE\_SMART\_WALLET\_OWNER\_LINK\_ABI**: readonly \[\{ `inputs`: readonly \[\{ `name`: `"account"`; `type`: `"address"`; \}\]; `name`: `"isOwnerAddress"`; `outputs`: readonly \[\{ `name`: `""`; `type`: `"bool"`; \}\]; `stateMutability`: `"view"`; `type`: `"function"`; \}\]

Defined in: [src/pages/admin/adminOpsHelpers.ts:260](https://github.com/wenakita/4626/blob/main/frontend/src/pages/admin/adminOpsHelpers.ts#L260)

***

### CREATOR\_REGISTRY\_ABI

> `const` **CREATOR\_REGISTRY\_ABI**: readonly \[\{ `inputs`: readonly \[\]; `name`: `"getAllCreatorCoins"`; `outputs`: readonly \[\{ `type`: `"address[]"`; \}\]; `stateMutability`: `"view"`; `type`: `"function"`; \}, \{ `inputs`: readonly \[\{ `name`: `"_token"`; `type`: `"address"`; \}\]; `name`: `"getCreatorCoin"`; `outputs`: readonly \[\{ `name`: `"token"`; `type`: `"address"`; \}, \{ `name`: `"name"`; `type`: `"string"`; \}, \{ `name`: `"symbol"`; `type`: `"string"`; \}, \{ `name`: `"vault"`; `type`: `"address"`; \}, \{ `name`: `"shareOFT"`; `type`: `"address"`; \}, \{ `name`: `"wrapper"`; `type`: `"address"`; \}, \{ `name`: `"oracle"`; `type`: `"address"`; \}, \{ `name`: `"gaugeController"`; `type`: `"address"`; \}, \{ `name`: `"creator"`; `type`: `"address"`; \}, \{ `name`: `"pool"`; `type`: `"address"`; \}, \{ `name`: `"poolFee"`; `type`: `"uint24"`; \}, \{ `name`: `"primaryChainId"`; `type`: `"uint256"`; \}, \{ `name`: `"isActive"`; `type`: `"bool"`; \}, \{ `name`: `"registeredAt"`; `type`: `"uint256"`; \}\]; `stateMutability`: `"view"`; `type`: `"function"`; \}\]

Defined in: [src/pages/admin/adminOpsHelpers.ts:215](https://github.com/wenakita/4626/blob/main/frontend/src/pages/admin/adminOpsHelpers.ts#L215)

***

### CREATOR\_SHARE\_VESTING\_EVENT

> `const` **CREATOR\_SHARE\_VESTING\_EVENT**: `object`

Defined in: [src/pages/admin/adminOpsHelpers.ts:247](https://github.com/wenakita/4626/blob/main/frontend/src/pages/admin/adminOpsHelpers.ts#L247)

***

### ERC8004\_AGENT\_URI\_DEFAULT

> `const` **ERC8004\_AGENT\_URI\_DEFAULT**: `""` = `''`

Defined in: [src/pages/admin/adminOpsHelpers.ts:35](https://github.com/wenakita/4626/blob/main/frontend/src/pages/admin/adminOpsHelpers.ts#L35)

***

### ERC8004\_AGENT\_URI\_PLACEHOLDER

> `const` **ERC8004\_AGENT\_URI\_PLACEHOLDER**: `"https://... (gateway), ipfs://..., ar://..., or data:application/json;base64,..."` = `'https://... (gateway), ipfs://..., ar://..., or data:application/json;base64,...'`

Defined in: [src/pages/admin/adminOpsHelpers.ts:36](https://github.com/wenakita/4626/blob/main/frontend/src/pages/admin/adminOpsHelpers.ts#L36)

***

### ERC8004\_IDENTITY\_REGISTRY

> `const` **ERC8004\_IDENTITY\_REGISTRY**: `"0x8004A169FB4a3325136EB29fA0ceB6D2e539a432"` = `'0x8004A169FB4a3325136EB29fA0ceB6D2e539a432'`

Defined in: [src/pages/admin/adminOpsHelpers.ts:31](https://github.com/wenakita/4626/blob/main/frontend/src/pages/admin/adminOpsHelpers.ts#L31)

***

### ERC8004\_IDENTITY\_REGISTRY\_ABI

> `const` **ERC8004\_IDENTITY\_REGISTRY\_ABI**: readonly \[\{ `inputs`: readonly \[\{ `name`: `"agentURI"`; `type`: `"string"`; \}\]; `name`: `"register"`; `outputs`: readonly \[\{ `type`: `"uint256"`; \}\]; `stateMutability`: `"nonpayable"`; `type`: `"function"`; \}, \{ `inputs`: readonly \[\{ `name`: `"agentId"`; `type`: `"uint256"`; \}, \{ `name`: `"newURI"`; `type`: `"string"`; \}\]; `name`: `"setAgentURI"`; `outputs`: readonly \[\]; `stateMutability`: `"nonpayable"`; `type`: `"function"`; \}, \{ `inputs`: readonly \[\{ `name`: `"agentId"`; `type`: `"uint256"`; \}, \{ `name`: `"newWallet"`; `type`: `"address"`; \}, \{ `name`: `"deadline"`; `type`: `"uint256"`; \}, \{ `name`: `"signature"`; `type`: `"bytes"`; \}\]; `name`: `"setAgentWallet"`; `outputs`: readonly \[\]; `stateMutability`: `"nonpayable"`; `type`: `"function"`; \}, \{ `inputs`: readonly \[\{ `name`: `"agentId"`; `type`: `"uint256"`; \}\]; `name`: `"unsetAgentWallet"`; `outputs`: readonly \[\]; `stateMutability`: `"nonpayable"`; `type`: `"function"`; \}, \{ `inputs`: readonly \[\{ `name`: `"agentId"`; `type`: `"uint256"`; \}, \{ `name`: `"metadataKey"`; `type`: `"string"`; \}, \{ `name`: `"metadataValue"`; `type`: `"bytes"`; \}\]; `name`: `"setMetadata"`; `outputs`: readonly \[\]; `stateMutability`: `"nonpayable"`; `type`: `"function"`; \}, \{ `inputs`: readonly \[\{ `name`: `"owner"`; `type`: `"address"`; \}\]; `name`: `"balanceOf"`; `outputs`: readonly \[\{ `type`: `"uint256"`; \}\]; `stateMutability`: `"view"`; `type`: `"function"`; \}, \{ `inputs`: readonly \[\{ `name`: `"tokenId"`; `type`: `"uint256"`; \}\]; `name`: `"ownerOf"`; `outputs`: readonly \[\{ `type`: `"address"`; \}\]; `stateMutability`: `"view"`; `type`: `"function"`; \}, \{ `inputs`: readonly \[\{ `name`: `"agentId"`; `type`: `"uint256"`; \}\]; `name`: `"getAgentWallet"`; `outputs`: readonly \[\{ `type`: `"address"`; \}\]; `stateMutability`: `"view"`; `type`: `"function"`; \}, \{ `inputs`: readonly \[\{ `name`: `"agentId"`; `type`: `"uint256"`; \}, \{ `name`: `"metadataKey"`; `type`: `"string"`; \}\]; `name`: `"getMetadata"`; `outputs`: readonly \[\{ `type`: `"bytes"`; \}\]; `stateMutability`: `"view"`; `type`: `"function"`; \}\]

Defined in: [src/pages/admin/adminOpsHelpers.ts:270](https://github.com/wenakita/4626/blob/main/frontend/src/pages/admin/adminOpsHelpers.ts#L270)

***

### ERC8004\_REGISTERED\_EVENT

> `const` **ERC8004\_REGISTERED\_EVENT**: `object`

Defined in: [src/pages/admin/adminOpsHelpers.ts:282](https://github.com/wenakita/4626/blob/main/frontend/src/pages/admin/adminOpsHelpers.ts#L282)

***

### LEGACY\_DYNAMIC\_HINT\_IDS

> `const` **LEGACY\_DYNAMIC\_HINT\_IDS**: `string`[]

Defined in: [src/pages/admin/adminOpsHelpers.ts:175](https://github.com/wenakita/4626/blob/main/frontend/src/pages/admin/adminOpsHelpers.ts#L175)

***

### LEGACY\_DYNAMIC\_SLOT\_COUNT

> `const` **LEGACY\_DYNAMIC\_SLOT\_COUNT**: `8` = `8`

Defined in: [src/pages/admin/adminOpsHelpers.ts:165](https://github.com/wenakita/4626/blob/main/frontend/src/pages/admin/adminOpsHelpers.ts#L165)

***

### LEGACY\_DYNAMIC\_VAULT\_HINTS

> `const` **LEGACY\_DYNAMIC\_VAULT\_HINTS**: [`LegacyVaultHint`](#legacyvaulthint)[]

Defined in: [src/pages/admin/adminOpsHelpers.ts:167](https://github.com/wenakita/4626/blob/main/frontend/src/pages/admin/adminOpsHelpers.ts#L167)

***

### LEGACY\_STATIC\_VAULT\_HINTS

> `const` **LEGACY\_STATIC\_VAULT\_HINTS**: [`LegacyVaultHint`](#legacyvaulthint)[]

Defined in: [src/pages/admin/adminOpsHelpers.ts:120](https://github.com/wenakita/4626/blob/main/frontend/src/pages/admin/adminOpsHelpers.ts#L120)

***

### LEGACY\_VAULT\_HINTS

> `const` **LEGACY\_VAULT\_HINTS**: [`LegacyVaultHint`](#legacyvaulthint)[]

Defined in: [src/pages/admin/adminOpsHelpers.ts:177](https://github.com/wenakita/4626/blob/main/frontend/src/pages/admin/adminOpsHelpers.ts#L177)

***

### PHASE1\_DEPLOYED\_EVENT

> `const` **PHASE1\_DEPLOYED\_EVENT**: `object`

Defined in: [src/pages/admin/adminOpsHelpers.ts:250](https://github.com/wenakita/4626/blob/main/frontend/src/pages/admin/adminOpsHelpers.ts#L250)

***

### QUEUED\_WITHDRAWAL\_ABI

> `const` **QUEUED\_WITHDRAWAL\_ABI**: readonly \[\{ `inputs`: readonly \[\{ `name`: `"account"`; `type`: `"address"`; \}\]; `name`: `"queuedWithdrawals"`; `outputs`: readonly \[\{ `name`: `"shares"`; `type`: `"uint256"`; \}, \{ `name`: `"unlockBlock"`; `type`: `"uint256"`; \}, \{ `name`: `"receiver"`; `type`: `"address"`; \}\]; `stateMutability`: `"view"`; `type`: `"function"`; \}\]

Defined in: [src/pages/admin/adminOpsHelpers.ts:339](https://github.com/wenakita/4626/blob/main/frontend/src/pages/admin/adminOpsHelpers.ts#L339)

***

### SHARE\_OFT\_METADATA\_ABI

> `const` **SHARE\_OFT\_METADATA\_ABI**: readonly \[\{ `inputs`: readonly \[\]; `name`: `"contractURI"`; `outputs`: readonly \[\{ `type`: `"string"`; \}\]; `stateMutability`: `"view"`; `type`: `"function"`; \}, \{ `inputs`: readonly \[\{ `name`: `"uri"`; `type`: `"string"`; \}\]; `name`: `"setContractURI"`; `outputs`: readonly \[\]; `stateMutability`: `"nonpayable"`; `type`: `"function"`; \}\]

Defined in: [src/pages/admin/adminOpsHelpers.ts:286](https://github.com/wenakita/4626/blob/main/frontend/src/pages/admin/adminOpsHelpers.ts#L286)

***

### VAULT\_ABI

> `const` **VAULT\_ABI**: readonly \[\{ `inputs`: readonly \[\{ `name`: `"shares"`; `type`: `"uint256"`; \}, \{ `name`: `"receiver"`; `type`: `"address"`; \}\]; `name`: `"queueWithdrawal"`; `outputs`: readonly \[\]; `stateMutability`: `"nonpayable"`; `type`: `"function"`; \}, \{ `inputs`: readonly \[\]; `name`: `"claimQueuedWithdrawal"`; `outputs`: readonly \[\{ `type`: `"uint256"`; \}\]; `stateMutability`: `"nonpayable"`; `type`: `"function"`; \}, \{ `inputs`: readonly \[\{ `name`: `"shares"`; `type`: `"uint256"`; \}, \{ `name`: `"receiver"`; `type`: `"address"`; \}, \{ `name`: `"owner"`; `type`: `"address"`; \}\]; `name`: `"redeem"`; `outputs`: readonly \[\{ `type`: `"uint256"`; \}\]; `stateMutability`: `"nonpayable"`; `type`: `"function"`; \}, \{ `inputs`: readonly \[\{ `name`: `"shares"`; `type`: `"uint256"`; \}\]; `name`: `"previewRedeem"`; `outputs`: readonly \[\{ `type`: `"uint256"`; \}\]; `stateMutability`: `"view"`; `type`: `"function"`; \}, \{ `inputs`: readonly \[\]; `name`: `"largeWithdrawalThreshold"`; `outputs`: readonly \[\{ `type`: `"uint256"`; \}\]; `stateMutability`: `"view"`; `type`: `"function"`; \}\]

Defined in: [src/pages/admin/adminOpsHelpers.ts:295](https://github.com/wenakita/4626/blob/main/frontend/src/pages/admin/adminOpsHelpers.ts#L295)

***

### VAULT\_EMERGENCY\_ABI

> `const` **VAULT\_EMERGENCY\_ABI**: readonly \[\{ `inputs`: readonly \[\]; `name`: `"asset"`; `outputs`: readonly \[\{ `type`: `"address"`; \}\]; `stateMutability`: `"view"`; `type`: `"function"`; \}, \{ `inputs`: readonly \[\]; `name`: `"isShutdown"`; `outputs`: readonly \[\{ `type`: `"bool"`; \}\]; `stateMutability`: `"view"`; `type`: `"function"`; \}, \{ `inputs`: readonly \[\]; `name`: `"shutdownVault"`; `outputs`: readonly \[\]; `stateMutability`: `"nonpayable"`; `type`: `"function"`; \}, \{ `inputs`: readonly \[\]; `name`: `"emergencyWithdrawFromStrategies"`; `outputs`: readonly \[\]; `stateMutability`: `"nonpayable"`; `type`: `"function"`; \}, \{ `inputs`: readonly \[\{ `name`: `"amount"`; `type`: `"uint256"`; \}, \{ `name`: `"to"`; `type`: `"address"`; \}\]; `name`: `"emergencyWithdraw"`; `outputs`: readonly \[\]; `stateMutability`: `"nonpayable"`; `type`: `"function"`; \}\]

Defined in: [src/pages/admin/adminOpsHelpers.ts:322](https://github.com/wenakita/4626/blob/main/frontend/src/pages/admin/adminOpsHelpers.ts#L322)

***

### VESTING\_ABI

> `const` **VESTING\_ABI**: readonly \[\{ `inputs`: readonly \[\]; `name`: `"releasable"`; `outputs`: readonly \[\{ `type`: `"uint256"`; \}\]; `stateMutability`: `"view"`; `type`: `"function"`; \}, \{ `inputs`: readonly \[\]; `name`: `"release"`; `outputs`: readonly \[\{ `type`: `"uint256"`; \}\]; `stateMutability`: `"nonpayable"`; `type`: `"function"`; \}, \{ `inputs`: readonly \[\]; `name`: `"beneficiary"`; `outputs`: readonly \[\{ `type`: `"address"`; \}\]; `stateMutability`: `"view"`; `type`: `"function"`; \}\]

Defined in: [src/pages/admin/adminOpsHelpers.ts:254](https://github.com/wenakita/4626/blob/main/frontend/src/pages/admin/adminOpsHelpers.ts#L254)

***

### WRAPPER\_ABI

> `const` **WRAPPER\_ABI**: readonly \[\{ `inputs`: readonly \[\{ `name`: `"amount"`; `type`: `"uint256"`; \}\]; `name`: `"unwrap"`; `outputs`: readonly \[\{ `type`: `"uint256"`; \}\]; `stateMutability`: `"nonpayable"`; `type`: `"function"`; \}\]

Defined in: [src/pages/admin/adminOpsHelpers.ts:291](https://github.com/wenakita/4626/blob/main/frontend/src/pages/admin/adminOpsHelpers.ts#L291)

***

### ZERO\_ADDRESS

> `const` **ZERO\_ADDRESS**: `"0x0000000000000000000000000000000000000000"` = `'0x0000000000000000000000000000000000000000'`

Defined in: [src/pages/admin/adminOpsHelpers.ts:30](https://github.com/wenakita/4626/blob/main/frontend/src/pages/admin/adminOpsHelpers.ts#L30)

## Functions

### agentUriValidationMessage()

> **agentUriValidationMessage**(): `string`

Defined in: [src/pages/admin/adminOpsHelpers.ts:88](https://github.com/wenakita/4626/blob/main/frontend/src/pages/admin/adminOpsHelpers.ts#L88)

#### Returns

`string`

***

### buildTxHref()

> **buildTxHref**(`hash?`): `string` \| `null`

Defined in: [src/pages/admin/adminOpsHelpers.ts:405](https://github.com/wenakita/4626/blob/main/frontend/src/pages/admin/adminOpsHelpers.ts#L405)

#### Parameters

##### hash?

`string`

#### Returns

`string` \| `null`

***

### extractMetaMessages()

> **extractMetaMessages**(`error`): `string` \| `null`

Defined in: [src/pages/admin/adminOpsHelpers.ts:434](https://github.com/wenakita/4626/blob/main/frontend/src/pages/admin/adminOpsHelpers.ts#L434)

#### Parameters

##### error

`unknown`

#### Returns

`string` \| `null`

***

### fetchLegacyPhase1Map()

> **fetchLegacyPhase1Map**(`publicClient`, `owner?`): `Promise`\<`Map`\<`string`, \{ `shareOft`: `` `0x${string}` ``; `vault`: `` `0x${string}` ``; `wrapper`: `` `0x${string}` ``; \}\>\>

Defined in: [src/pages/admin/adminOpsHelpers.ts:546](https://github.com/wenakita/4626/blob/main/frontend/src/pages/admin/adminOpsHelpers.ts#L546)

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

Defined in: [src/pages/admin/adminOpsHelpers.ts:523](https://github.com/wenakita/4626/blob/main/frontend/src/pages/admin/adminOpsHelpers.ts#L523)

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

Defined in: [src/pages/admin/adminOpsHelpers.ts:388](https://github.com/wenakita/4626/blob/main/frontend/src/pages/admin/adminOpsHelpers.ts#L388)

#### Parameters

##### value

`bigint` | `undefined`

#### Returns

`string`

***

### getLegacyVestingStartBlock()

> **getLegacyVestingStartBlock**(): `bigint`

Defined in: [src/pages/admin/adminOpsHelpers.ts:203](https://github.com/wenakita/4626/blob/main/frontend/src/pages/admin/adminOpsHelpers.ts#L203)

#### Returns

`bigint`

***

### isAllowlistedHttpsAgentUri()

> **isAllowlistedHttpsAgentUri**(`uri`): `boolean`

Defined in: [src/pages/admin/adminOpsHelpers.ts:62](https://github.com/wenakita/4626/blob/main/frontend/src/pages/admin/adminOpsHelpers.ts#L62)

#### Parameters

##### uri

`string`

#### Returns

`boolean`

***

### isContentAddressedAgentUri()

> **isContentAddressedAgentUri**(`uri`): `boolean`

Defined in: [src/pages/admin/adminOpsHelpers.ts:84](https://github.com/wenakita/4626/blob/main/frontend/src/pages/admin/adminOpsHelpers.ts#L84)

#### Parameters

##### uri

`string`

#### Returns

`boolean`

***

### isStrictContentAddressedAgentUri()

> **isStrictContentAddressedAgentUri**(`uri`): `boolean`

Defined in: [src/pages/admin/adminOpsHelpers.ts:43](https://github.com/wenakita/4626/blob/main/frontend/src/pages/admin/adminOpsHelpers.ts#L43)

#### Parameters

##### uri

`string`

#### Returns

`boolean`

***

### matchVaultHint()

> **matchVaultHint**(`hint`, `vaults`): `string` \| `null`

Defined in: [src/pages/admin/adminOpsHelpers.ts:195](https://github.com/wenakita/4626/blob/main/frontend/src/pages/admin/adminOpsHelpers.ts#L195)

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

Defined in: [src/pages/admin/adminOpsHelpers.ts:48](https://github.com/wenakita/4626/blob/main/frontend/src/pages/admin/adminOpsHelpers.ts#L48)

#### Parameters

##### raw

`string`

#### Returns

`string`

***

### parseAmount()

> **parseAmount**(`input`): `bigint` \| `null`

Defined in: [src/pages/admin/adminOpsHelpers.ts:394](https://github.com/wenakita/4626/blob/main/frontend/src/pages/admin/adminOpsHelpers.ts#L394)

#### Parameters

##### input

`string`

#### Returns

`bigint` \| `null`

***

### parseVaultHint()

> **parseVaultHint**(`hint?`): \{ `prefix`: `string`; `suffix`: `string`; \} \| `null`

Defined in: [src/pages/admin/adminOpsHelpers.ts:182](https://github.com/wenakita/4626/blob/main/frontend/src/pages/admin/adminOpsHelpers.ts#L182)

#### Parameters

##### hint?

`string`

#### Returns

\{ `prefix`: `string`; `suffix`: `string`; \} \| `null`

***

### resolveShareOftFromVault()

> **resolveShareOftFromVault**(`publicClient`, `vaultAddress`): `Promise`\<`` `0x${string}` `` \| `null`\>

Defined in: [src/pages/admin/adminOpsHelpers.ts:581](https://github.com/wenakita/4626/blob/main/frontend/src/pages/admin/adminOpsHelpers.ts#L581)

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

Defined in: [src/pages/admin/adminOpsHelpers.ts:626](https://github.com/wenakita/4626/blob/main/frontend/src/pages/admin/adminOpsHelpers.ts#L626)

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

Defined in: [src/pages/admin/adminOpsHelpers.ts:383](https://github.com/wenakita/4626/blob/main/frontend/src/pages/admin/adminOpsHelpers.ts#L383)

#### Parameters

##### addr

`string`

#### Returns

`string`

***

### shouldFallbackToOwnerDirectExecute()

> **shouldFallbackToOwnerDirectExecute**(`error`): `boolean`

Defined in: [src/pages/admin/adminOpsHelpers.ts:410](https://github.com/wenakita/4626/blob/main/frontend/src/pages/admin/adminOpsHelpers.ts#L410)

#### Parameters

##### error

`unknown`

#### Returns

`boolean`

***

### summarizeErrorReason()

> **summarizeErrorReason**(`error`): `string`

Defined in: [src/pages/admin/adminOpsHelpers.ts:463](https://github.com/wenakita/4626/blob/main/frontend/src/pages/admin/adminOpsHelpers.ts#L463)

#### Parameters

##### error

`unknown`

#### Returns

`string`

***

### toFriendlyTxError()

> **toFriendlyTxError**(`error`): `string`

Defined in: [src/pages/admin/adminOpsHelpers.ts:483](https://github.com/wenakita/4626/blob/main/frontend/src/pages/admin/adminOpsHelpers.ts#L483)

#### Parameters

##### error

`unknown`

#### Returns

`string`
