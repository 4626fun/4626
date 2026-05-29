[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/features/explore/exploreListNavigation

# src/features/explore/exploreListNavigation

## Type Aliases

### ExploreListTabPath

> **ExploreListTabPath** = *typeof* [`EXPLORE_LIST_TAB_PATHS`](#explore_list_tab_paths)\[`number`\]

Defined in: [src/features/explore/exploreListNavigation.ts:12](https://github.com/wenakita/4626/blob/main/frontend/src/features/explore/exploreListNavigation.ts#L12)

## Variables

### EXPLORE\_LIST\_TAB\_PATHS

> `const` **EXPLORE\_LIST\_TAB\_PATHS**: readonly \[`"/explore/creators"`, `"/explore/content"`, `"/explore/vaults"`, `"/explore/trends"`, `"/explore/transactions"`\]

Defined in: [src/features/explore/exploreListNavigation.ts:4](https://github.com/wenakita/4626/blob/main/frontend/src/features/explore/exploreListNavigation.ts#L4)

## Functions

### buildExploreTabSearchParams()

> **buildExploreTabSearchParams**(`currentSearch`): `string`

Defined in: [src/features/explore/exploreListNavigation.ts:23](https://github.com/wenakita/4626/blob/main/frontend/src/features/explore/exploreListNavigation.ts#L23)

Preserve search (`q`) only when switching list tabs — drop sort/time that may be tab-specific.

#### Parameters

##### currentSearch

`string` | `null` | `undefined`

#### Returns

`string`

***

### getExploreListTabKey()

> **getExploreListTabKey**(`pathname`): `"/explore/creators"` \| `"/explore/content"` \| `"/explore/vaults"` \| `"/explore/trends"` \| `"/explore/transactions"` \| `null`

Defined in: [src/features/explore/exploreListNavigation.ts:18](https://github.com/wenakita/4626/blob/main/frontend/src/features/explore/exploreListNavigation.ts#L18)

#### Parameters

##### pathname

`string`

#### Returns

`"/explore/creators"` \| `"/explore/content"` \| `"/explore/vaults"` \| `"/explore/trends"` \| `"/explore/transactions"` \| `null`

***

### isExploreListTabPath()

> **isExploreListTabPath**(`pathname`): pathname is "/explore/creators" \| "/explore/content" \| "/explore/vaults" \| "/explore/trends" \| "/explore/transactions"

Defined in: [src/features/explore/exploreListNavigation.ts:14](https://github.com/wenakita/4626/blob/main/frontend/src/features/explore/exploreListNavigation.ts#L14)

#### Parameters

##### pathname

`string`

#### Returns

pathname is "/explore/creators" \| "/explore/content" \| "/explore/vaults" \| "/explore/trends" \| "/explore/transactions"

***

### shouldShowExploreTableLoading()

> **shouldShowExploreTableLoading**(`__namedParameters`): `boolean`

Defined in: [src/features/explore/exploreListNavigation.ts:31](https://github.com/wenakita/4626/blob/main/frontend/src/features/explore/exploreListNavigation.ts#L31)

#### Parameters

##### \_\_namedParameters

###### hasActiveSearch?

`boolean` = `false`

When the user is searching, inline table messages own empty/loading UX.

###### hasRows

`boolean`

###### isFetching

`boolean`

###### isLoading

`boolean`

#### Returns

`boolean`

***

### useExploreListTabScrollReset()

> **useExploreListTabScrollReset**(): `void`

Defined in: [src/features/explore/exploreListNavigation.ts:48](https://github.com/wenakita/4626/blob/main/frontend/src/features/explore/exploreListNavigation.ts#L48)

#### Returns

`void`
