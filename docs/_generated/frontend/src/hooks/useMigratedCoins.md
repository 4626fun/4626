[**4626-app**](../../index.md)

***

[4626-app](../../index.md) / src/hooks/useMigratedCoins

# src/hooks/useMigratedCoins

## Functions

### useBatchMigrationCheck()

> **useBatchMigrationCheck**(`coinAddresses`): `Map`\<`string`, `boolean`\>

Defined in: [src/hooks/useMigratedCoins.ts:76](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/hooks/useMigratedCoins.ts#L76)

Batch check for multiple coins
More efficient than individual checks

#### Parameters

##### coinAddresses

`string`[]

#### Returns

`Map`\<`string`, `boolean`\>

***

### useIsCoinMigrated()

> **useIsCoinMigrated**(`coinAddress`): `boolean` \| `undefined`

Defined in: [src/hooks/useMigratedCoins.ts:46](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/hooks/useMigratedCoins.ts#L46)

Hook to check if a specific coin has migrated

#### Parameters

##### coinAddress

`string` | `undefined`

#### Returns

`boolean` \| `undefined`

***

### useMigratedCoins()

> **useMigratedCoins**(): `object`

Defined in: [src/hooks/useMigratedCoins.ts:13](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/hooks/useMigratedCoins.ts#L13)

Hook to get the set of migrated coins
Triggers a fetch if not cached

#### Returns

`object`

##### error

> **error**: `Error` \| `null`

##### isLoading

> **isLoading**: `boolean`

##### migratedCoins

> **migratedCoins**: `Set`\<`string`\> \| `null`
