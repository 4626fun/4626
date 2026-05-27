[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/components/explore/creatorStatsScrollNav

# src/components/explore/creatorStatsScrollNav

## Variables

### CREATOR\_STATS\_FINALE\_NAV\_LABEL

> `const` **CREATOR\_STATS\_FINALE\_NAV\_LABEL**: `"All metrics"` = `'All metrics'`

Defined in: [src/components/explore/creatorStatsScrollNav.ts:9](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/components/explore/creatorStatsScrollNav.ts#L9)

***

### CREATOR\_STATS\_TIMELINE\_LABELS

> `const` **CREATOR\_STATS\_TIMELINE\_LABELS**: readonly \[`"volume"`, `"marketCap"`, `"holders"`, `"ethos"`, `"coinsCreated"`, `"created"`, `"finale"`\]

Defined in: [src/components/explore/creatorStatsScrollNav.ts:12](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/components/explore/creatorStatsScrollNav.ts#L12)

GSAP timeline / snap nav labels aligned to `CreatorStatItem.id` order + finale.

## Functions

### nearestCreatorStatsSnapProgress()

> **nearestCreatorStatsSnapProgress**(`progress`, `statCount`): `number`

Defined in: [src/components/explore/creatorStatsScrollNav.ts:65](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/components/explore/creatorStatsScrollNav.ts#L65)

#### Parameters

##### progress

`number`

##### statCount

`number`

#### Returns

`number`

***

### resolveCreatorStatsActiveSnapIndex()

> **resolveCreatorStatsActiveSnapIndex**(`progress`, `snapPoints`): `number`

Defined in: [src/components/explore/creatorStatsScrollNav.ts:22](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/components/explore/creatorStatsScrollNav.ts#L22)

#### Parameters

##### progress

`number`

##### snapPoints

`number`[]

#### Returns

`number`

***

### scrollToCreatorStatsSnapIndex()

> **scrollToCreatorStatsSnapIndex**(`scrollTrigger`, `statCount`, `snapIndex`, `options?`): `void`

Defined in: [src/components/explore/creatorStatsScrollNav.ts:53](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/components/explore/creatorStatsScrollNav.ts#L53)

#### Parameters

##### scrollTrigger

`_ScrollTrigger`

##### statCount

`number`

##### snapIndex

`number`

##### options?

###### duration?

`number`

###### immediate?

`boolean`

#### Returns

`void`

***

### scrollToCreatorStatsSnapPoint()

> **scrollToCreatorStatsSnapPoint**(`scrollTrigger`, `progress`, `options?`): `void`

Defined in: [src/components/explore/creatorStatsScrollNav.ts:37](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/components/explore/creatorStatsScrollNav.ts#L37)

#### Parameters

##### scrollTrigger

`_ScrollTrigger`

##### progress

`number`

##### options?

###### duration?

`number`

###### immediate?

`boolean`

#### Returns

`void`
