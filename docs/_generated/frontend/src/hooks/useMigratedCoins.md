[**creatorvault-miniapp**](../../index.md)

***

[creatorvault-miniapp](../../index.md) / src/hooks/useMigratedCoins

# src/hooks/useMigratedCoins

## Functions

### useBatchMigrationCheck()

> **useBatchMigrationCheck**(`coinAddresses`): `Map`\<`string`, `boolean`\>

Defined in: [hooks/useMigratedCoins.ts:87](https://github.com/wenakita/4626/blob/2cd71abc97601febe38089cb23bfd133739e818d/frontend/src/hooks/useMigratedCoins.ts#L87)

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

Defined in: [hooks/useMigratedCoins.ts:48](https://github.com/wenakita/4626/blob/2cd71abc97601febe38089cb23bfd133739e818d/frontend/src/hooks/useMigratedCoins.ts#L48)

Hook to check if a specific coin has migrated

#### Parameters

##### coinAddress

`string` | `undefined`

#### Returns

`boolean` \| `undefined`

***

### useMigratedCoins()

> **useMigratedCoins**(): `object`

Defined in: [hooks/useMigratedCoins.ts:15](https://github.com/wenakita/4626/blob/2cd71abc97601febe38089cb23bfd133739e818d/frontend/src/hooks/useMigratedCoins.ts#L15)

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
