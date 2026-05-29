[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/lib/deploy/ovaultModuleIdentity

# src/lib/deploy/ovaultModuleIdentity

## Type Aliases

### OVaultModuleStoragePreflight

> **OVaultModuleStoragePreflight** = \{ `ok`: `true`; \} \| \{ `message`: `string`; `moduleAddress`: `Address`; `moduleReports`: `Hex`; `ok`: `false`; `vaultExpects`: `Hex`; \}

Defined in: [src/lib/deploy/ovaultModuleIdentity.ts:36](https://github.com/wenakita/4626/blob/main/frontend/src/lib/deploy/ovaultModuleIdentity.ts#L36)

## Variables

### CREATOR\_OVAULT\_MODULE\_STORAGE\_CURRENT

> `const` **CREATOR\_OVAULT\_MODULE\_STORAGE\_CURRENT**: `` `0x${string}` `` = `CREATOR_OVAULT_MODULE_STORAGE_V2`

Defined in: [src/lib/deploy/ovaultModuleIdentity.ts:21](https://github.com/wenakita/4626/blob/main/frontend/src/lib/deploy/ovaultModuleIdentity.ts#L21)

Must match live mainnet CreatorOVault module deployments wired on the split Phase-1 batcher.

***

### CREATOR\_OVAULT\_MODULE\_STORAGE\_LEGACY\_CURRENT

> `const` **CREATOR\_OVAULT\_MODULE\_STORAGE\_LEGACY\_CURRENT**: `` `0x${string}` ``

Defined in: [src/lib/deploy/ovaultModuleIdentity.ts:16](https://github.com/wenakita/4626/blob/main/frontend/src/lib/deploy/ovaultModuleIdentity.ts#L16)

Pre-v1.12.1 modules still on-chain for grandfathered vaults only.

***

### CREATOR\_OVAULT\_MODULE\_STORAGE\_V2

> `const` **CREATOR\_OVAULT\_MODULE\_STORAGE\_V2**: `` `0x${string}` ``

Defined in: [src/lib/deploy/ovaultModuleIdentity.ts:11](https://github.com/wenakita/4626/blob/main/frontend/src/lib/deploy/ovaultModuleIdentity.ts#L11)

Live batcher + store deploy fingerprint (CreatorOVaultModuleStorage.v2).

***

### DEFAULT\_BATCHER\_OVAULT\_MODULES

> `const` **DEFAULT\_BATCHER\_OVAULT\_MODULES**: `object`

Defined in: [src/lib/deploy/ovaultModuleIdentity.ts:124](https://github.com/wenakita/4626/blob/main/frontend/src/lib/deploy/ovaultModuleIdentity.ts#L124)

#### Type Declaration

##### admin

> `readonly` **admin**: `` `0x${string}` `` = `CREATOR_OVAULT_ADMIN_MODULE`

##### core

> `readonly` **core**: `` `0x${string}` `` = `CREATOR_OVAULT_CORE_MODULE`

##### strategies

> `readonly` **strategies**: `` `0x${string}` `` = `CREATOR_OVAULT_STRATEGIES_MODULE`

***

### DEPLOY\_CREATOR\_OVAULT\_MODULE\_STORAGE\_VERSION

> `const` **DEPLOY\_CREATOR\_OVAULT\_MODULE\_STORAGE\_VERSION**: `` `0x${string}` `` = `CREATOR_OVAULT_MODULE_STORAGE_V2`

Defined in: [src/lib/deploy/ovaultModuleIdentity.ts:24](https://github.com/wenakita/4626/blob/main/frontend/src/lib/deploy/ovaultModuleIdentity.ts#L24)

Fingerprint embedded in frontend deploy bytecode (CreatorOVault creation code).

## Functions

### assertCreatorOvaultModuleStorageCompatible()

> **assertCreatorOvaultModuleStorageCompatible**(`params`): `Promise`\<[`OVaultModuleStoragePreflight`](#ovaultmodulestoragepreflight)\>

Defined in: [src/lib/deploy/ovaultModuleIdentity.ts:55](https://github.com/wenakita/4626/blob/main/frontend/src/lib/deploy/ovaultModuleIdentity.ts#L55)

#### Parameters

##### params

###### batcherAddress?

`string`

###### moduleAddress?

`string`

###### publicClient

`ModuleReadClient`

###### vaultExpects?

`` `0x${string}` ``

#### Returns

`Promise`\<[`OVaultModuleStoragePreflight`](#ovaultmodulestoragepreflight)\>
