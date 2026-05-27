[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/chat/vaultChatPolicy

# server/\_lib/chat/vaultChatPolicy

## Type Aliases

### VaultChatMembership

> **VaultChatMembership** = `object`

Defined in: [server/\_lib/chat/vaultChatPolicy.ts:19](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/chat/vaultChatPolicy.ts#L19)

#### Properties

##### balanceRaw

> **balanceRaw**: `string` \| `null`

Defined in: [server/\_lib/chat/vaultChatPolicy.ts:23](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/chat/vaultChatPolicy.ts#L23)

##### failureReason

> **failureReason**: `string` \| `null`

Defined in: [server/\_lib/chat/vaultChatPolicy.ts:27](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/chat/vaultChatPolicy.ts#L27)

##### graceStartedAt

> **graceStartedAt**: `string` \| `null`

Defined in: [server/\_lib/chat/vaultChatPolicy.ts:26](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/chat/vaultChatPolicy.ts#L26)

##### lastCheckedAt

> **lastCheckedAt**: `string` \| `null`

Defined in: [server/\_lib/chat/vaultChatPolicy.ts:24](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/chat/vaultChatPolicy.ts#L24)

##### lastEligibleAt

> **lastEligibleAt**: `string` \| `null`

Defined in: [server/\_lib/chat/vaultChatPolicy.ts:25](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/chat/vaultChatPolicy.ts#L25)

##### status

> **status**: `string`

Defined in: [server/\_lib/chat/vaultChatPolicy.ts:22](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/chat/vaultChatPolicy.ts#L22)

##### vaultAddress

> **vaultAddress**: `` `0x${string}` ``

Defined in: [server/\_lib/chat/vaultChatPolicy.ts:20](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/chat/vaultChatPolicy.ts#L20)

##### walletAddress

> **walletAddress**: `` `0x${string}` ``

Defined in: [server/\_lib/chat/vaultChatPolicy.ts:21](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/chat/vaultChatPolicy.ts#L21)

***

### VaultChatPolicy

> **VaultChatPolicy** = `object`

Defined in: [server/\_lib/chat/vaultChatPolicy.ts:9](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/chat/vaultChatPolicy.ts#L9)

#### Properties

##### creatorAddress

> **creatorAddress**: `` `0x${string}` `` \| `null`

Defined in: [server/\_lib/chat/vaultChatPolicy.ts:12](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/chat/vaultChatPolicy.ts#L12)

##### enabled

> **enabled**: `boolean`

Defined in: [server/\_lib/chat/vaultChatPolicy.ts:16](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/chat/vaultChatPolicy.ts#L16)

##### graceHours

> **graceHours**: `number`

Defined in: [server/\_lib/chat/vaultChatPolicy.ts:15](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/chat/vaultChatPolicy.ts#L15)

##### groupId

> **groupId**: `string` \| `null`

Defined in: [server/\_lib/chat/vaultChatPolicy.ts:11](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/chat/vaultChatPolicy.ts#L11)

##### minHoldingRaw

> **minHoldingRaw**: `string`

Defined in: [server/\_lib/chat/vaultChatPolicy.ts:14](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/chat/vaultChatPolicy.ts#L14)

##### shareTokenAddress

> **shareTokenAddress**: `` `0x${string}` `` \| `null`

Defined in: [server/\_lib/chat/vaultChatPolicy.ts:13](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/chat/vaultChatPolicy.ts#L13)

##### vaultAddress

> **vaultAddress**: `` `0x${string}` ``

Defined in: [server/\_lib/chat/vaultChatPolicy.ts:10](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/chat/vaultChatPolicy.ts#L10)

## Functions

### joinVaultChat()

> **joinVaultChat**(`params`): `Promise`\<\{ `actionId`: `number` \| `null`; `eligible`: `boolean`; `membership`: [`VaultChatMembership`](#vaultchatmembership); `policy`: [`VaultChatPolicy`](#vaultchatpolicy); \}\>

Defined in: [server/\_lib/chat/vaultChatPolicy.ts:220](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/chat/vaultChatPolicy.ts#L220)

#### Parameters

##### params

###### vaultAddress

`` `0x${string}` ``

###### walletAddress

`` `0x${string}` ``

#### Returns

`Promise`\<\{ `actionId`: `number` \| `null`; `eligible`: `boolean`; `membership`: [`VaultChatMembership`](#vaultchatmembership); `policy`: [`VaultChatPolicy`](#vaultchatpolicy); \}\>

***

### readVaultChatMembership()

> **readVaultChatMembership**(`params`): `Promise`\<[`VaultChatMembership`](#vaultchatmembership) \| `null`\>

Defined in: [server/\_lib/chat/vaultChatPolicy.ts:145](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/chat/vaultChatPolicy.ts#L145)

#### Parameters

##### params

###### vaultAddress

`` `0x${string}` ``

###### walletAddress

`` `0x${string}` ``

#### Returns

`Promise`\<[`VaultChatMembership`](#vaultchatmembership) \| `null`\>

***

### readVaultChatPolicy()

> **readVaultChatPolicy**(`vaultAddress`): `Promise`\<[`VaultChatPolicy`](#vaultchatpolicy) \| `null`\>

Defined in: [server/\_lib/chat/vaultChatPolicy.ts:64](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/chat/vaultChatPolicy.ts#L64)

#### Parameters

##### vaultAddress

`` `0x${string}` ``

#### Returns

`Promise`\<[`VaultChatPolicy`](#vaultchatpolicy) \| `null`\>

***

### recheckVaultChatMemberships()

> **recheckVaultChatMemberships**(`params`): `Promise`\<\{ `checked`: `number`; `removed`: `number`; `stale`: `number`; \}\>

Defined in: [server/\_lib/chat/vaultChatPolicy.ts:268](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/chat/vaultChatPolicy.ts#L268)

#### Parameters

##### params

###### limit?

`number`

###### vaultAddress

`` `0x${string}` ``

#### Returns

`Promise`\<\{ `checked`: `number`; `removed`: `number`; `stale`: `number`; \}\>

***

### upsertVaultChatPolicy()

> **upsertVaultChatPolicy**(`params`): `Promise`\<[`VaultChatPolicy`](#vaultchatpolicy)\>

Defined in: [server/\_lib/chat/vaultChatPolicy.ts:86](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/chat/vaultChatPolicy.ts#L86)

#### Parameters

##### params

###### actorAddress?

`` `0x${string}` `` \| `null`

###### creatorAddress?

`` `0x${string}` `` \| `null`

###### enabled?

`boolean`

###### graceHours?

`number` \| `null`

###### groupId?

`string` \| `null`

###### minHoldingRaw?

`string` \| `null`

###### shareTokenAddress?

`` `0x${string}` `` \| `null`

###### vaultAddress

`` `0x${string}` ``

#### Returns

`Promise`\<[`VaultChatPolicy`](#vaultchatpolicy)\>
