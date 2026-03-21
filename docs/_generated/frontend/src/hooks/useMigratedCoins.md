[**4626-app**](../../index.md)

***

[4626-app](../../index.md) / src/hooks/useMigratedCoins

# src/hooks/useMigratedCoins

## Functions

### useBatchMigrationCheck()

> **useBatchMigrationCheck**(`coinAddresses`): `Map`\<`string`, `boolean`\>

Defined in: [src/hooks/useMigratedCoins.ts:79](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/hooks/useMigratedCoins.ts#L79)

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

Defined in: [src/hooks/useMigratedCoins.ts:49](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/hooks/useMigratedCoins.ts#L49)

Hook to check if a specific coin has migrated

#### Parameters

##### coinAddress

`string` | `undefined`

#### Returns

`boolean` \| `undefined`

***

### useMigratedCoins()

> **useMigratedCoins**(): `object`

Defined in: [src/hooks/useMigratedCoins.ts:16](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/hooks/useMigratedCoins.ts#L16)

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
