[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/components/explore/ExploreSubnav

# src/components/explore/ExploreSubnav

## Functions

### applyExploreParamChange()

> **applyExploreParamChange**(`__namedParameters`): `void`

Defined in: [src/components/explore/ExploreSubnav.tsx:48](https://github.com/wenakita/4626/blob/main/frontend/src/components/explore/ExploreSubnav.tsx#L48)

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

Defined in: [src/components/explore/ExploreSubnav.tsx:62](https://github.com/wenakita/4626/blob/main/frontend/src/components/explore/ExploreSubnav.tsx#L62)

#### Parameters

##### \_\_namedParameters

###### currentSort?

`string` = `'volume'`

###### currentTimeFilter?

`string` = `'1d'`

###### disableUniswapTimeGating?

`boolean` = `false`

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

###### sortOptions?

readonly `ExploreSortOption`[] = `DEFAULT_SORT_OPTIONS`

###### timeFilters?

readonly `ExploreTimeFilterOption`[] = `DEFAULT_TIME_FILTERS`

###### volumeColumnNote?

`string` \| `null` = `null`

Explains how Zora explore volume relates to the selected time pill (API has no 1H–1M windows; 1Y uses all-time).

#### Returns

`Element`
