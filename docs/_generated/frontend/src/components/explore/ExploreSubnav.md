[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/components/explore/ExploreSubnav

# src/components/explore/ExploreSubnav

## Functions

### applyExploreParamChange()

> **applyExploreParamChange**(`__namedParameters`): `void`

Defined in: [src/components/explore/ExploreSubnav.tsx:31](https://github.com/wenakita/4626/blob/main/frontend/src/components/explore/ExploreSubnav.tsx#L31)

#### Parameters

##### \_\_namedParameters

###### currentValue

`string`

###### onChange?

(`value`) => `void`

###### value

`string`

#### Returns

`void`

***

### ExploreSubnav()

> **ExploreSubnav**(`__namedParameters`): `Element`

Defined in: [src/components/explore/ExploreSubnav.tsx:45](https://github.com/wenakita/4626/blob/main/frontend/src/components/explore/ExploreSubnav.tsx#L45)

#### Parameters

##### \_\_namedParameters

###### currentSort?

`string` = `'volume'`

###### currentTimeFilter?

`string` = `'1d'`

###### disableUniswapTimeGating?

`boolean` = `false`

###### extraFilters?

`ReactNode`

###### onSearch?

(`query`) => `void`

###### onSortChange?

(`sort`) => `void`

###### onTimeFilterChange?

(`filter`) => `void`

###### searchPlaceholder?

`string` = `'Search tokens'`

###### searchValue?

`string`

###### showMobileSortRow?

`boolean` = `true`

###### showSearch?

`boolean` = `true`

###### showTabs?

`boolean` = `true`

When false, tab links render in ExploreListLayout instead (list routes only).

###### sortOptions?

readonly `ExploreSortOption`[] = `DEFAULT_SORT_OPTIONS`

###### timeFilters?

readonly `ExploreTimeFilterOption`[] = `DEFAULT_TIME_FILTERS`

###### volumeColumnNote?

`string` \| `null` = `null`

Explains how Zora explore volume relates to the selected time pill (API has no 1H–1M windows; 1Y uses all-time).

#### Returns

`Element`
