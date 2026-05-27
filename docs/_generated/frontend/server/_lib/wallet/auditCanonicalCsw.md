[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/wallet/auditCanonicalCsw

# server/\_lib/wallet/auditCanonicalCsw

## Type Aliases

### CswMixupReason

> **CswMixupReason** = `"csw_is_allowed_owner_eoa"` \| `"csw_has_no_bytecode"` \| `"csw_equals_embedded_eoa"` \| `"csw_mismatch_primary_smart_wallet"` \| `"profile_wallet_canonical_flag_on_eoa"` \| `"zora_signal_canonical_is_eoa"` \| `"policy_resolved_csw_differs"`

Defined in: [server/\_lib/wallet/auditCanonicalCsw.ts:12](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/auditCanonicalCsw.ts#L12)

***

### ProfileCswAuditRow

> **ProfileCswAuditRow** = `object`

Defined in: [server/\_lib/wallet/auditCanonicalCsw.ts:21](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/auditCanonicalCsw.ts#L21)

#### Properties

##### currentCsw

> **currentCsw**: `string` \| `null`

Defined in: [server/\_lib/wallet/auditCanonicalCsw.ts:25](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/auditCanonicalCsw.ts#L25)

##### currentPrimarySmartWallet

> **currentPrimarySmartWallet**: `string` \| `null`

Defined in: [server/\_lib/wallet/auditCanonicalCsw.ts:26](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/auditCanonicalCsw.ts#L26)

##### email

> **email**: `string` \| `null`

Defined in: [server/\_lib/wallet/auditCanonicalCsw.ts:23](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/auditCanonicalCsw.ts#L23)

##### embeddedEoa

> **embeddedEoa**: `string` \| `null`

Defined in: [server/\_lib/wallet/auditCanonicalCsw.ts:27](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/auditCanonicalCsw.ts#L27)

##### expectedCsw

> **expectedCsw**: `string` \| `null`

Defined in: [server/\_lib/wallet/auditCanonicalCsw.ts:29](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/auditCanonicalCsw.ts#L29)

##### primaryWallet

> **primaryWallet**: `string` \| `null`

Defined in: [server/\_lib/wallet/auditCanonicalCsw.ts:28](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/auditCanonicalCsw.ts#L28)

##### privyUserId

> **privyUserId**: `string` \| `null`

Defined in: [server/\_lib/wallet/auditCanonicalCsw.ts:24](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/auditCanonicalCsw.ts#L24)

##### profileId

> **profileId**: `number`

Defined in: [server/\_lib/wallet/auditCanonicalCsw.ts:22](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/auditCanonicalCsw.ts#L22)

##### reasons

> **reasons**: [`CswMixupReason`](#cswmixupreason)[]

Defined in: [server/\_lib/wallet/auditCanonicalCsw.ts:30](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/auditCanonicalCsw.ts#L30)

***

### ProfileCswRepairResult

> **ProfileCswRepairResult** = `object`

Defined in: [server/\_lib/wallet/auditCanonicalCsw.ts:33](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/auditCanonicalCsw.ts#L33)

#### Properties

##### afterCsw

> **afterCsw**: `string` \| `null`

Defined in: [server/\_lib/wallet/auditCanonicalCsw.ts:37](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/auditCanonicalCsw.ts#L37)

##### applied

> **applied**: `boolean`

Defined in: [server/\_lib/wallet/auditCanonicalCsw.ts:35](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/auditCanonicalCsw.ts#L35)

##### beforeCsw

> **beforeCsw**: `string` \| `null`

Defined in: [server/\_lib/wallet/auditCanonicalCsw.ts:36](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/auditCanonicalCsw.ts#L36)

##### profileId

> **profileId**: `number`

Defined in: [server/\_lib/wallet/auditCanonicalCsw.ts:34](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/auditCanonicalCsw.ts#L34)

##### profileWalletFlagsFixed

> **profileWalletFlagsFixed**: `number`

Defined in: [server/\_lib/wallet/auditCanonicalCsw.ts:39](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/auditCanonicalCsw.ts#L39)

##### reasons

> **reasons**: [`CswMixupReason`](#cswmixupreason)[]

Defined in: [server/\_lib/wallet/auditCanonicalCsw.ts:38](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/auditCanonicalCsw.ts#L38)

##### zoraSignalUpdated

> **zoraSignalUpdated**: `boolean`

Defined in: [server/\_lib/wallet/auditCanonicalCsw.ts:40](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/auditCanonicalCsw.ts#L40)

## Functions

### auditAllProfileCswMixups()

> **auditAllProfileCswMixups**(`params`): `Promise`\<[`ProfileCswAuditRow`](#profilecswauditrow)[]\>

Defined in: [server/\_lib/wallet/auditCanonicalCsw.ts:258](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/auditCanonicalCsw.ts#L258)

#### Parameters

##### params

###### db

`Db`

###### limit?

`number`

###### rpcUrl

`string`

#### Returns

`Promise`\<[`ProfileCswAuditRow`](#profilecswauditrow)[]\>

***

### auditProfileCswRow()

> **auditProfileCswRow**(`params`): `Promise`\<[`ProfileCswAuditRow`](#profilecswauditrow) \| `null`\>

Defined in: [server/\_lib/wallet/auditCanonicalCsw.ts:63](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/auditCanonicalCsw.ts#L63)

#### Parameters

##### params

###### canonicalWalletRows?

`object`[]

###### hasDeployedBytecode

(`address`) => `Promise`\<`boolean`\>

###### row

\{ `csw_address?`: `unknown`; `email?`: `unknown`; `embedded_wallet?`: `unknown`; `id`: `unknown`; `primary_embedded_eoa?`: `unknown`; `primary_smart_wallet?`: `unknown`; `primary_wallet?`: `unknown`; `privy_user_id?`: `unknown`; \}

###### row.csw_address?

`unknown`

###### row.email?

`unknown`

###### row.embedded_wallet?

`unknown`

###### row.id

`unknown`

###### row.primary_embedded_eoa?

`unknown`

###### row.primary_smart_wallet?

`unknown`

###### row.primary_wallet?

`unknown`

###### row.privy_user_id?

`unknown`

###### zoraCanonicalCsw?

`string` \| `null`

#### Returns

`Promise`\<[`ProfileCswAuditRow`](#profilecswauditrow) \| `null`\>

***

### repairAllProfileCswMixups()

> **repairAllProfileCswMixups**(`params`): `Promise`\<\{ `audits`: [`ProfileCswAuditRow`](#profilecswauditrow)[]; `repairs`: [`ProfileCswRepairResult`](#profilecswrepairresult)[]; \}\>

Defined in: [server/\_lib/wallet/auditCanonicalCsw.ts:320](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/auditCanonicalCsw.ts#L320)

#### Parameters

##### params

###### apply

`boolean`

###### db

`Db`

###### limit?

`number`

###### rpcUrl

`string`

#### Returns

`Promise`\<\{ `audits`: [`ProfileCswAuditRow`](#profilecswauditrow)[]; `repairs`: [`ProfileCswRepairResult`](#profilecswrepairresult)[]; \}\>

***

### repairProfileCswMixup()

> **repairProfileCswMixup**(`params`): `Promise`\<[`ProfileCswRepairResult`](#profilecswrepairresult)\>

Defined in: [server/\_lib/wallet/auditCanonicalCsw.ts:146](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/auditCanonicalCsw.ts#L146)

#### Parameters

##### params

###### apply

`boolean`

###### audit

[`ProfileCswAuditRow`](#profilecswauditrow)

###### db

`Db`

###### hasDeployedBytecode

(`address`) => `Promise`\<`boolean`\>

#### Returns

`Promise`\<[`ProfileCswRepairResult`](#profilecswrepairresult)\>
