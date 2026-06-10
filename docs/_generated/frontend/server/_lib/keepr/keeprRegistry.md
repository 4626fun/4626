[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/keepr/keeprRegistry

# server/\_lib/keepr/keeprRegistry

## Type Aliases

### KeeprConfigV1

> **KeeprConfigV1** = `object`

Defined in: [server/\_lib/keepr/keeprRegistry.ts:6](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/keepr/keeprRegistry.ts#L6)

#### Properties

##### behavior?

> `optional` **behavior**: `object`

Defined in: [server/\_lib/keepr/keeprRegistry.ts:35](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/keepr/keeprRegistry.ts#L35)

###### dmDenials?

> `optional` **dmDenials**: `boolean`

###### dmRemovals?

> `optional` **dmRemovals**: `boolean`

###### emitJoinSignals?

> `optional` **emitJoinSignals**: `boolean`

###### emitMilestones?

> `optional` **emitMilestones**: `boolean`

##### chainId

> **chainId**: `number`

Defined in: [server/\_lib/keepr/keeprRegistry.ts:8](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/keepr/keeprRegistry.ts#L8)

##### contracts?

> `optional` **contracts**: `object`

Defined in: [server/\_lib/keepr/keeprRegistry.ts:47](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/keepr/keeprRegistry.ts#L47)

Optional contract addresses for keeper automation workflows

###### ajnaAdapter?

> `optional` **ajnaAdapter**: `` `0x${string}` ``

###### ajnaAuth?

> `optional` **ajnaAuth**: `` `0x${string}` ``

###### ajnaInnerVault?

> `optional` **ajnaInnerVault**: `` `0x${string}` ``

###### ajnaPool?

> `optional` **ajnaPool**: `` `0x${string}` ``

###### ccaStrategy?

> `optional` **ccaStrategy**: `` `0x${string}` ``

###### oracle?

> `optional` **oracle**: `` `0x${string}` ``

###### vrfHub?

> `optional` **vrfHub**: `` `0x${string}` ``

##### gating

> **gating**: `object`

Defined in: [server/\_lib/keepr/keeprRegistry.ts:23](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/keepr/keeprRegistry.ts#L23)

###### enabled

> **enabled**: `boolean`

###### failClosed

> **failClosed**: `boolean`

###### joinLocked

> **joinLocked**: `boolean`

###### mode

> **mode**: `"shares"` \| `"none"` \| `"deposit"` \| `"allowlist"` \| `string`

###### thresholds?

> `optional` **thresholds**: `object`

###### thresholds.minShares?

> `optional` **minShares**: `string`

##### lens?

> `optional` **lens**: `object`

Defined in: [server/\_lib/keepr/keeprRegistry.ts:19](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/keepr/keeprRegistry.ts#L19)

###### groupAddress?

> `optional` **groupAddress**: `` `0x${string}` ``

###### metadataUri?

> `optional` **metadataUri**: `string`

##### rateLimits?

> `optional` **rateLimits**: `object`

Defined in: [server/\_lib/keepr/keeprRegistry.ts:41](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/keepr/keeprRegistry.ts#L41)

###### commandCooldownMs?

> `optional` **commandCooldownMs**: `number`

###### syncCooldownSeconds?

> `optional` **syncCooldownSeconds**: `number`

###### syncMaxMembersPerBatch?

> `optional` **syncMaxMembersPerBatch**: `number`

##### roles

> **roles**: `object`

Defined in: [server/\_lib/keepr/keeprRegistry.ts:30](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/keepr/keeprRegistry.ts#L30)

###### admins?

> `optional` **admins**: `` `0x${string}` ``[]

###### operators?

> `optional` **operators**: `` `0x${string}` ``[]

###### owner

> **owner**: `` `0x${string}` ``

##### vault

> **vault**: `object`

Defined in: [server/\_lib/keepr/keeprRegistry.ts:9](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/keepr/keeprRegistry.ts#L9)

###### canonicalOwnerAddress

> **canonicalOwnerAddress**: `` `0x${string}` ``

###### creatorCoinAddress

> **creatorCoinAddress**: `` `0x${string}` ``

###### shareTokenAddress?

> `optional` **shareTokenAddress**: `` `0x${string}` ``

###### vaultAddress

> **vaultAddress**: `` `0x${string}` ``

##### version

> **version**: `number`

Defined in: [server/\_lib/keepr/keeprRegistry.ts:7](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/keepr/keeprRegistry.ts#L7)

##### xmtp

> **xmtp**: `object`

Defined in: [server/\_lib/keepr/keeprRegistry.ts:15](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/keepr/keeprRegistry.ts#L15)

###### agentInboxId?

> `optional` **agentInboxId**: `string`

###### groupId

> **groupId**: `string`

***

### KeeprVaultRow

> **KeeprVaultRow** = `object`

Defined in: [server/\_lib/keepr/keeprRegistry.ts:80](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/keepr/keeprRegistry.ts#L80)

#### Properties

##### canonicalOwnerAddress

> **canonicalOwnerAddress**: `` `0x${string}` ``

Defined in: [server/\_lib/keepr/keeprRegistry.ts:86](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/keepr/keeprRegistry.ts#L86)

##### chainId

> **chainId**: `number`

Defined in: [server/\_lib/keepr/keeprRegistry.ts:82](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/keepr/keeprRegistry.ts#L82)

##### config

> **config**: [`KeeprConfigV1`](#keeprconfigv1)

Defined in: [server/\_lib/keepr/keeprRegistry.ts:95](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/keepr/keeprRegistry.ts#L95)

##### configHash

> **configHash**: `string`

Defined in: [server/\_lib/keepr/keeprRegistry.ts:94](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/keepr/keeprRegistry.ts#L94)

##### configVersion

> **configVersion**: `number`

Defined in: [server/\_lib/keepr/keeprRegistry.ts:93](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/keepr/keeprRegistry.ts#L93)

##### creatorCoinAddress

> **creatorCoinAddress**: `` `0x${string}` ``

Defined in: [server/\_lib/keepr/keeprRegistry.ts:85](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/keepr/keeprRegistry.ts#L85)

##### failClosed

> **failClosed**: `boolean`

Defined in: [server/\_lib/keepr/keeprRegistry.ts:92](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/keepr/keeprRegistry.ts#L92)

##### gatingEnabled

> **gatingEnabled**: `boolean`

Defined in: [server/\_lib/keepr/keeprRegistry.ts:88](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/keepr/keeprRegistry.ts#L88)

##### gatingMode

> **gatingMode**: `string`

Defined in: [server/\_lib/keepr/keeprRegistry.ts:90](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/keepr/keeprRegistry.ts#L90)

##### groupId

> **groupId**: `string`

Defined in: [server/\_lib/keepr/keeprRegistry.ts:83](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/keepr/keeprRegistry.ts#L83)

##### joinLocked

> **joinLocked**: `boolean`

Defined in: [server/\_lib/keepr/keeprRegistry.ts:89](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/keepr/keeprRegistry.ts#L89)

##### lensGroupAddress

> **lensGroupAddress**: `` `0x${string}` `` \| `null`

Defined in: [server/\_lib/keepr/keeprRegistry.ts:84](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/keepr/keeprRegistry.ts#L84)

##### minShares

> **minShares**: `string` \| `null`

Defined in: [server/\_lib/keepr/keeprRegistry.ts:91](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/keepr/keeprRegistry.ts#L91)

##### shareTokenAddress

> **shareTokenAddress**: `` `0x${string}` `` \| `null`

Defined in: [server/\_lib/keepr/keeprRegistry.ts:87](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/keepr/keeprRegistry.ts#L87)

##### vaultAddress

> **vaultAddress**: `` `0x${string}` ``

Defined in: [server/\_lib/keepr/keeprRegistry.ts:81](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/keepr/keeprRegistry.ts#L81)

## Functions

### computeConfigHash()

> **computeConfigHash**(`config`): `string`

Defined in: [server/\_lib/keepr/keeprRegistry.ts:75](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/keepr/keeprRegistry.ts#L75)

#### Parameters

##### config

[`KeeprConfigV1`](#keeprconfigv1)

#### Returns

`string`

***

### enqueueKeeprAction()

> **enqueueKeeprAction**(`params`): `Promise`\<\{ `id`: `number`; \}\>

Defined in: [server/\_lib/keepr/keeprRegistry.ts:295](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/keepr/keeprRegistry.ts#L295)

#### Parameters

##### params

###### action

`any`

###### actionType?

`string` \| `null`

###### dedupeKey?

`string` \| `null`

###### groupId

`string`

###### vaultAddress

`` `0x${string}` ``

#### Returns

`Promise`\<\{ `id`: `number`; \}\>

***

### getKeeprVaultByGroupId()

> **getKeeprVaultByGroupId**(`groupId`): `Promise`\<[`KeeprVaultRow`](#keeprvaultrow) \| `null`\>

Defined in: [server/\_lib/keepr/keeprRegistry.ts:265](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/keepr/keeprRegistry.ts#L265)

#### Parameters

##### groupId

`string`

#### Returns

`Promise`\<[`KeeprVaultRow`](#keeprvaultrow) \| `null`\>

***

### getKeeprVaultByVaultAddress()

> **getKeeprVaultByVaultAddress**(`vaultAddress`): `Promise`\<[`KeeprVaultRow`](#keeprvaultrow) \| `null`\>

Defined in: [server/\_lib/keepr/keeprRegistry.ts:256](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/keepr/keeprRegistry.ts#L256)

#### Parameters

##### vaultAddress

`` `0x${string}` ``

#### Returns

`Promise`\<[`KeeprVaultRow`](#keeprvaultrow) \| `null`\>

***

### isKeeprJoinLocked()

> **isKeeprJoinLocked**(`vault`): `boolean`

Defined in: [server/\_lib/keepr/keeprRegistry.ts:98](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/keepr/keeprRegistry.ts#L98)

#### Parameters

##### vault

`Pick`\<[`KeeprVaultRow`](#keeprvaultrow), `"joinLocked"` \| `"config"`\>

#### Returns

`boolean`

***

### setKeeprJoinLocked()

> **setKeeprJoinLocked**(`params`): `Promise`\<`void`\>

Defined in: [server/\_lib/keepr/keeprRegistry.ts:357](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/keepr/keeprRegistry.ts#L357)

#### Parameters

##### params

###### actorWallet?

`string` \| `null`

###### joinLocked

`boolean`

###### vaultAddress

`` `0x${string}` ``

#### Returns

`Promise`\<`void`\>

***

### upsertKeeprVault()

> **upsertKeeprVault**(`params`): `Promise`\<[`KeeprVaultRow`](#keeprvaultrow)\>

Defined in: [server/\_lib/keepr/keeprRegistry.ts:153](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/keepr/keeprRegistry.ts#L153)

#### Parameters

##### params

###### actorWallet?

`string` \| `null`

###### config

[`KeeprConfigV1`](#keeprconfigv1)

#### Returns

`Promise`\<[`KeeprVaultRow`](#keeprvaultrow)\>
