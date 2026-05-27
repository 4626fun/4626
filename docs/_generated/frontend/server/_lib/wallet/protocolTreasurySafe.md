[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/wallet/protocolTreasurySafe

# server/\_lib/wallet/protocolTreasurySafe

## Type Aliases

### AjnaRebucketAuthorization

> **AjnaRebucketAuthorization** = \{ `authorized`: `true`; `lane`: `"protocol_automation_admin"`; \} \| \{ `authorized`: `true`; `lane`: `"legacy_treasury_admin"`; \} \| \{ `authorized`: `true`; `lane`: `"legacy_csw_admin"`; \} \| \{ `authorized`: `false`; `reason`: `string`; \}

Defined in: [server/\_lib/wallet/protocolTreasurySafe.ts:222](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/protocolTreasurySafe.ts#L222)

***

### CharmAutomationAuthorization

> **CharmAutomationAuthorization** = \{ `authorized`: `true`; `lane`: `"protocol_automation_manager"`; \} \| \{ `authorized`: `true`; `lane`: `"protocol_treasury_manager"`; \} \| \{ `authorized`: `true`; `lane`: `"keeper_direct"`; \} \| \{ `authorized`: `false`; `reason`: `string`; \}

Defined in: [server/\_lib/wallet/protocolTreasurySafe.ts:178](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/protocolTreasurySafe.ts#L178)

***

### CharmVaultAuthSnapshot

> **CharmVaultAuthSnapshot** = `object`

Defined in: [server/\_lib/wallet/protocolTreasurySafe.ts:244](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/protocolTreasurySafe.ts#L244)

#### Properties

##### charmKeeper

> **charmKeeper**: `Address` \| `null`

Defined in: [server/\_lib/wallet/protocolTreasurySafe.ts:247](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/protocolTreasurySafe.ts#L247)

##### charmOwner

> **charmOwner**: `Address` \| `null`

Defined in: [server/\_lib/wallet/protocolTreasurySafe.ts:248](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/protocolTreasurySafe.ts#L248)

##### delegateAddress

> **delegateAddress**: `Address` \| `null`

Defined in: [server/\_lib/wallet/protocolTreasurySafe.ts:246](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/protocolTreasurySafe.ts#L246)

##### managerAddress

> **managerAddress**: `Address` \| `null`

Defined in: [server/\_lib/wallet/protocolTreasurySafe.ts:245](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/protocolTreasurySafe.ts#L245)

## Variables

### KEEPER\_AUTOMATION\_PRIVATE\_KEY\_ENV

> `const` **KEEPER\_AUTOMATION\_PRIVATE\_KEY\_ENV**: `"4626_KEEPER_AUTOMATION_PRIVATE_KEY"` = `'4626_KEEPER_AUTOMATION_PRIVATE_KEY'`

Defined in: [server/\_lib/wallet/protocolTreasurySafe.ts:13](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/protocolTreasurySafe.ts#L13)

Dedicated Charm automation signer (must be owner of protocol automation Safe).

***

### KEEPER\_AUTOMATION\_PUBLIC\_KEY\_ENV

> `const` **KEEPER\_AUTOMATION\_PUBLIC\_KEY\_ENV**: `"4626_KEEPER_AUTOMATION_PUBLIC_KEY"` = `'4626_KEEPER_AUTOMATION_PUBLIC_KEY'`

Defined in: [server/\_lib/wallet/protocolTreasurySafe.ts:14](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/protocolTreasurySafe.ts#L14)

## Functions

### assertKeeperAutomationKeyPair()

> **assertKeeperAutomationKeyPair**(`env`): `void`

Defined in: [server/\_lib/wallet/protocolTreasurySafe.ts:132](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/protocolTreasurySafe.ts#L132)

#### Parameters

##### env

`Record`\<`string`, `string` \| `undefined`\> = `process.env`

#### Returns

`void`

***

### executeViaProtocolAutomationSafe()

> **executeViaProtocolAutomationSafe**(`params`): `Promise`\<\{ `safeAddress`: `string`; `signerAddress`: `string`; `txHash`: `` `0x${string}` ``; \}\>

Defined in: [server/\_lib/wallet/protocolTreasurySafe.ts:400](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/protocolTreasurySafe.ts#L400)

Primary Charm rebalance path for new deploys (manager = protocol automation Safe).

#### Parameters

##### params

###### data

`` `0x${string}` ``

###### env?

`Record`\<`string`, `string` \| `undefined`\>

###### publicClient

\{ `readContract`: (`args`) => `Promise`\<`unknown`\>; `waitForTransactionReceipt`: (`args`) => `Promise`\<\{ `status`: `string`; \}\>; \}

###### publicClient.readContract

(`args`) => `Promise`\<`unknown`\>

###### publicClient.waitForTransactionReceipt

(`args`) => `Promise`\<\{ `status`: `string`; \}\>

###### rpcUrl

`string`

###### to

`string`

###### value?

`bigint`

#### Returns

`Promise`\<\{ `safeAddress`: `string`; `signerAddress`: `string`; `txHash`: `` `0x${string}` ``; \}\>

***

### executeViaProtocolTreasurySafe()

> **executeViaProtocolTreasurySafe**(`params`): `Promise`\<\{ `safeAddress`: `string`; `signerAddress`: `string`; `txHash`: `` `0x${string}` ``; \}\>

Defined in: [server/\_lib/wallet/protocolTreasurySafe.ts:439](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/protocolTreasurySafe.ts#L439)

Legacy path for vaults that still use protocol treasury Safe as Charm manager.

#### Parameters

##### params

###### data

`` `0x${string}` ``

###### env?

`Record`\<`string`, `string` \| `undefined`\>

###### publicClient

\{ `readContract`: (`args`) => `Promise`\<`unknown`\>; `waitForTransactionReceipt`: (`args`) => `Promise`\<\{ `status`: `string`; \}\>; \}

###### publicClient.readContract

(`args`) => `Promise`\<`unknown`\>

###### publicClient.waitForTransactionReceipt

(`args`) => `Promise`\<\{ `status`: `string`; \}\>

###### rpcUrl

`string`

###### to

`string`

###### value?

`bigint`

#### Returns

`Promise`\<\{ `safeAddress`: `string`; `signerAddress`: `string`; `txHash`: `` `0x${string}` ``; \}\>

***

### isProtocolAutomationAjnaAdmin()

> **isProtocolAutomationAjnaAdmin**(`adminAddress`): `boolean`

Defined in: [server/\_lib/wallet/protocolTreasurySafe.ts:168](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/protocolTreasurySafe.ts#L168)

AjnaVaultAuth.admin on new deploys — same hot Safe as Charm manager.

#### Parameters

##### adminAddress

`string` | `null` | `undefined`

#### Returns

`boolean`

***

### isProtocolAutomationManager()

> **isProtocolAutomationManager**(`managerAddress`): `boolean`

Defined in: [server/\_lib/wallet/protocolTreasurySafe.ts:161](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/protocolTreasurySafe.ts#L161)

#### Parameters

##### managerAddress

`string` | `null` | `undefined`

#### Returns

`boolean`

***

### ~~isProtocolTreasuryManager()~~

> **isProtocolTreasuryManager**(`managerAddress`): `boolean`

Defined in: [server/\_lib/wallet/protocolTreasurySafe.ts:173](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/protocolTreasurySafe.ts#L173)

#### Parameters

##### managerAddress

`string` | `null` | `undefined`

#### Returns

`boolean`

#### Deprecated

Pre-split vaults only — new deploys use protocol automation Safe as manager.

***

### isSameAddress()

> **isSameAddress**(`a`, `b`): `boolean`

Defined in: [server/\_lib/wallet/protocolTreasurySafe.ts:152](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/protocolTreasurySafe.ts#L152)

#### Parameters

##### a

`string` | `null` | `undefined`

##### b

`string` | `null` | `undefined`

#### Returns

`boolean`

***

### readCharmVaultAuthSnapshot()

> **readCharmVaultAuthSnapshot**(`params`): `Promise`\<[`CharmVaultAuthSnapshot`](#charmvaultauthsnapshot)\>

Defined in: [server/\_lib/wallet/protocolTreasurySafe.ts:285](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/protocolTreasurySafe.ts#L285)

Reads on-chain Charm auth slots; skips keeper/owner when manager is a protocol Safe.

#### Parameters

##### params

###### charmVaultAddress

`string`

###### publicClient

`CharmAuthReader`

#### Returns

`Promise`\<[`CharmVaultAuthSnapshot`](#charmvaultauthsnapshot)\>

***

### resolveAjnaRebucketAuthorization()

> **resolveAjnaRebucketAuthorization**(`params`): [`AjnaRebucketAuthorization`](#ajnarebucketauthorization)

Defined in: [server/\_lib/wallet/protocolTreasurySafe.ts:228](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/protocolTreasurySafe.ts#L228)

#### Parameters

##### params

###### authAdmin

`string`

###### canonicalCswAddress?

`string` \| `null`

#### Returns

[`AjnaRebucketAuthorization`](#ajnarebucketauthorization)

***

### resolveCharmAutomationAuthorization()

> **resolveCharmAutomationAuthorization**(`params`): [`CharmAutomationAuthorization`](#charmautomationauthorization)

Defined in: [server/\_lib/wallet/protocolTreasurySafe.ts:184](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/protocolTreasurySafe.ts#L184)

#### Parameters

##### params

###### charmKeeper

`string` \| `null` \| `undefined`

###### charmOwner

`string` \| `null` \| `undefined`

###### delegateAddress

`string` \| `null` \| `undefined`

###### keeperAddress

`string`

###### managerAddress

`string` \| `null` \| `undefined`

#### Returns

[`CharmAutomationAuthorization`](#charmautomationauthorization)

***

### resolveCharmKeeperAuthorization()

> **resolveCharmKeeperAuthorization**(`params`): [`CharmAutomationAuthorization`](#charmautomationauthorization)

Defined in: [server/\_lib/wallet/protocolTreasurySafe.ts:313](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/protocolTreasurySafe.ts#L313)

#### Parameters

##### params

###### keeperAddress

`string`

###### snapshot

[`CharmVaultAuthSnapshot`](#charmvaultauthsnapshot)

#### Returns

[`CharmAutomationAuthorization`](#charmautomationauthorization)

***

### resolveKeeperAutomationPrivateKey()

> **resolveKeeperAutomationPrivateKey**(`env`): `` `0x${string}` `` \| `null`

Defined in: [server/\_lib/wallet/protocolTreasurySafe.ts:104](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/protocolTreasurySafe.ts#L104)

Prefer automation signer; fall back to legacy treasury/keeper keys.

#### Parameters

##### env

`Record`\<`string`, `string` \| `undefined`\> = `process.env`

#### Returns

`` `0x${string}` `` \| `null`

***

### resolveKeeperAutomationPublicAddress()

> **resolveKeeperAutomationPublicAddress**(`env`): `string` \| `null`

Defined in: [server/\_lib/wallet/protocolTreasurySafe.ts:110](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/protocolTreasurySafe.ts#L110)

#### Parameters

##### env

`Record`\<`string`, `string` \| `undefined`\> = `process.env`

#### Returns

`string` \| `null`

***

### resolveProtocolAjnaKeeperAddress()

> **resolveProtocolAjnaKeeperAddress**(`env`): `string` \| `null`

Defined in: [server/\_lib/wallet/protocolTreasurySafe.ts:122](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/protocolTreasurySafe.ts#L122)

On-chain Ajna `keeper` slot — automation EOA for `move*` calls (not the Safe).

#### Parameters

##### env

`Record`\<`string`, `string` \| `undefined`\> = `process.env`

#### Returns

`string` \| `null`

***

### resolveProtocolAutomationAddress()

> **resolveProtocolAutomationAddress**(`env`): `string` \| `null`

Defined in: [server/\_lib/wallet/protocolTreasurySafe.ts:68](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/protocolTreasurySafe.ts#L68)

Hot automation Safe — Charm vault manager on new deploys.

#### Parameters

##### env

`Record`\<`string`, `string` \| `undefined`\> = `process.env`

#### Returns

`string` \| `null`

***

### resolveProtocolAutomationSafeOwnerPrivateKey()

> **resolveProtocolAutomationSafeOwnerPrivateKey**(`env`): `` `0x${string}` `` \| `null`

Defined in: [server/\_lib/wallet/protocolTreasurySafe.ts:82](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/protocolTreasurySafe.ts#L82)

#### Parameters

##### env

`Record`\<`string`, `string` \| `undefined`\> = `process.env`

#### Returns

`` `0x${string}` `` \| `null`

***

### resolveProtocolTreasuryAddress()

> **resolveProtocolTreasuryAddress**(): `string`

Defined in: [server/\_lib/wallet/protocolTreasurySafe.ts:63](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/protocolTreasurySafe.ts#L63)

#### Returns

`string`

***

### resolveProtocolTreasurySafeOwnerPrivateKey()

> **resolveProtocolTreasurySafeOwnerPrivateKey**(`env`): `` `0x${string}` `` \| `null`

Defined in: [server/\_lib/wallet/protocolTreasurySafe.ts:93](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/protocolTreasurySafe.ts#L93)

Legacy treasury Safe exec + keeper bootstrap fallback.

#### Parameters

##### env

`Record`\<`string`, `string` \| `undefined`\> = `process.env`

#### Returns

`` `0x${string}` `` \| `null`
