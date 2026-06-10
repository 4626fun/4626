[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/components/explore/creatorStatsVisual

# src/components/explore/creatorStatsVisual

## Type Aliases

### CreatorStatVisualState

> **CreatorStatVisualState** = `object`

Defined in: [src/components/explore/creatorStatsVisual.ts:50](https://github.com/wenakita/4626/blob/main/frontend/src/components/explore/creatorStatsVisual.ts#L50)

#### Properties

##### blur

> **blur**: `number`

Defined in: [src/components/explore/creatorStatsVisual.ts:55](https://github.com/wenakita/4626/blob/main/frontend/src/components/explore/creatorStatsVisual.ts#L55)

##### finale

> **finale**: `boolean`

Defined in: [src/components/explore/creatorStatsVisual.ts:57](https://github.com/wenakita/4626/blob/main/frontend/src/components/explore/creatorStatsVisual.ts#L57)

##### focus

> **focus**: `number`

Defined in: [src/components/explore/creatorStatsVisual.ts:52](https://github.com/wenakita/4626/blob/main/frontend/src/components/explore/creatorStatsVisual.ts#L52)

##### opacity

> **opacity**: `number`

Defined in: [src/components/explore/creatorStatsVisual.ts:51](https://github.com/wenakita/4626/blob/main/frontend/src/components/explore/creatorStatsVisual.ts#L51)

##### scale

> **scale**: `number`

Defined in: [src/components/explore/creatorStatsVisual.ts:56](https://github.com/wenakita/4626/blob/main/frontend/src/components/explore/creatorStatsVisual.ts#L56)

##### visible

> **visible**: `boolean`

Defined in: [src/components/explore/creatorStatsVisual.ts:58](https://github.com/wenakita/4626/blob/main/frontend/src/components/explore/creatorStatsVisual.ts#L58)

##### x

> **x**: `number`

Defined in: [src/components/explore/creatorStatsVisual.ts:53](https://github.com/wenakita/4626/blob/main/frontend/src/components/explore/creatorStatsVisual.ts#L53)

##### y

> **y**: `number`

Defined in: [src/components/explore/creatorStatsVisual.ts:54](https://github.com/wenakita/4626/blob/main/frontend/src/components/explore/creatorStatsVisual.ts#L54)

##### zIndex

> **zIndex**: `number`

Defined in: [src/components/explore/creatorStatsVisual.ts:59](https://github.com/wenakita/4626/blob/main/frontend/src/components/explore/creatorStatsVisual.ts#L59)

## Variables

### CREATOR\_STATS\_FINALE\_ENTER\_SHARE

> `const` **CREATOR\_STATS\_FINALE\_ENTER\_SHARE**: `0.22` = `0.22`

Defined in: [src/components/explore/creatorStatsVisual.ts:7](https://github.com/wenakita/4626/blob/main/frontend/src/components/explore/creatorStatsVisual.ts#L7)

Share of the finale segment used to stagger stats in; the rest is a hold plateau.

***

### CREATOR\_STATS\_FINALE\_START

> `const` **CREATOR\_STATS\_FINALE\_START**: `0.68` = `0.68`

Defined in: [src/components/explore/creatorStatsVisual.ts:4](https://github.com/wenakita/4626/blob/main/frontend/src/components/explore/creatorStatsVisual.ts#L4)

Scroll progress where sequential reveal ends and the all-stats finale begins.

***

### CREATOR\_STATS\_REVEALED\_OPACITY

> `const` **CREATOR\_STATS\_REVEALED\_OPACITY**: `0.69` = `0.69`

Defined in: [src/components/explore/creatorStatsVisual.ts:10](https://github.com/wenakita/4626/blob/main/frontend/src/components/explore/creatorStatsVisual.ts#L10)

Opacity for the most recently revealed stat (still visible, no longer in focus).

***

### CREATOR\_STATS\_SCROLL\_SCRUB

> `const` **CREATOR\_STATS\_SCROLL\_SCRUB**: `3.4` = `3.4`

Defined in: [src/components/explore/creatorStatsVisual.ts:330](https://github.com/wenakita/4626/blob/main/frontend/src/components/explore/creatorStatsVisual.ts#L330)

Recommended ScrollTrigger scrub duration (seconds of smoothing).

***

### CREATOR\_STATS\_SCROLL\_SNAP

> `const` **CREATOR\_STATS\_SCROLL\_SNAP**: `object`

Defined in: [src/components/explore/creatorStatsVisual.ts:333](https://github.com/wenakita/4626/blob/main/frontend/src/components/explore/creatorStatsVisual.ts#L333)

ScrollTrigger.snap config — settles on the nearest stat hold after wheel/trackpad input.

#### Type Declaration

##### delay

> `readonly` **delay**: `0.18` = `0.18`

##### duration

> `readonly` **duration**: `object`

###### duration.max

> `readonly` **max**: `1.65` = `1.65`

###### duration.min

> `readonly` **min**: `0.65` = `0.65`

##### ease

> `readonly` **ease**: `"power2.inOut"` = `'power2.inOut'`

***

### CREATOR\_STATS\_SLOT\_ENTER\_RATIO

> `const` **CREATOR\_STATS\_SLOT\_ENTER\_RATIO**: `0.14` = `0.14`

Defined in: [src/components/explore/creatorStatsVisual.ts:13](https://github.com/wenakita/4626/blob/main/frontend/src/components/explore/creatorStatsVisual.ts#L13)

Share of each stat slot spent fading in (dice-roll + count-up).

***

### CREATOR\_STATS\_SLOT\_EXIT\_RATIO

> `const` **CREATOR\_STATS\_SLOT\_EXIT\_RATIO**: `0.18` = `0.18`

Defined in: [src/components/explore/creatorStatsVisual.ts:19](https://github.com/wenakita/4626/blob/main/frontend/src/components/explore/creatorStatsVisual.ts#L19)

Share of each stat slot used for a soft crossfade into the next stat.

***

### CREATOR\_STATS\_SLOT\_HOLD\_RATIO

> `const` **CREATOR\_STATS\_SLOT\_HOLD\_RATIO**: `0.78` = `0.78`

Defined in: [src/components/explore/creatorStatsVisual.ts:16](https://github.com/wenakita/4626/blob/main/frontend/src/components/explore/creatorStatsVisual.ts#L16)

Share of each stat slot held at full focus before handing off to the next stat.

## Functions

### buildCreatorStatsSnapPoints()

> **buildCreatorStatsSnapPoints**(`total`): `number`[]

Defined in: [src/components/explore/creatorStatsVisual.ts:299](https://github.com/wenakita/4626/blob/main/frontend/src/components/explore/creatorStatsVisual.ts#L299)

ScrollTrigger.snap targets — center of each stat hold, plus the all-stats finale.

#### Parameters

##### total

`number`

#### Returns

`number`[]

***

### creatorStatsHoldSampleProgress()

> **creatorStatsHoldSampleProgress**(`statIndex`, `total`): `number`

Defined in: [src/components/explore/creatorStatsVisual.ts:292](https://github.com/wenakita/4626/blob/main/frontend/src/components/explore/creatorStatsVisual.ts#L292)

Progress point in the middle of a stat's hold plateau (for tests / tuning).

#### Parameters

##### statIndex

`number`

##### total

`number`

#### Returns

`number`

***

### creatorStatsStackMinHeightPx()

> **creatorStatsStackMinHeightPx**(`scrollProgress`, `total`): `number`

Defined in: [src/components/explore/creatorStatsVisual.ts:280](https://github.com/wenakita/4626/blob/main/frontend/src/components/explore/creatorStatsVisual.ts#L280)

Minimum stack area height (px) for the pinned stats viewport.

#### Parameters

##### scrollProgress

`number`

##### total

`number`

#### Returns

`number`

***

### getCreatorStatSlotFocus()

> **getCreatorStatSlotFocus**(`scrollProgress`, `index`, `total`): `number`

Defined in: [src/components/explore/creatorStatsVisual.ts:99](https://github.com/wenakita/4626/blob/main/frontend/src/components/explore/creatorStatsVisual.ts#L99)

Focus for the active stat within its scroll slot (enter → hold → soft exit).

#### Parameters

##### scrollProgress

`number`

##### index

`number`

##### total

`number`

#### Returns

`number`

***

### getCreatorStatVisualState()

> **getCreatorStatVisualState**(`scrollProgress`, `index`, `total`): [`CreatorStatVisualState`](#creatorstatvisualstate)

Defined in: [src/components/explore/creatorStatsVisual.ts:178](https://github.com/wenakita/4626/blob/main/frontend/src/components/explore/creatorStatsVisual.ts#L178)

Scroll-scrubbed layout for one stat cell in the immersive beat.

#### Parameters

##### scrollProgress

`number`

##### index

`number`

##### total

`number`

#### Returns

[`CreatorStatVisualState`](#creatorstatvisualstate)

***

### isCreatorStatsFinaleProgress()

> **isCreatorStatsFinaleProgress**(`scrollProgress`): `boolean`

Defined in: [src/components/explore/creatorStatsVisual.ts:127](https://github.com/wenakita/4626/blob/main/frontend/src/components/explore/creatorStatsVisual.ts#L127)

True when scroll progress is in the all-stats finale segment.

#### Parameters

##### scrollProgress

`number`

#### Returns

`boolean`

***

### snapCreatorStatsProgress()

> **snapCreatorStatsProgress**(`progress`, `snapPoints`): `number`

Defined in: [src/components/explore/creatorStatsVisual.ts:314](https://github.com/wenakita/4626/blob/main/frontend/src/components/explore/creatorStatsVisual.ts#L314)

#### Parameters

##### progress

`number`

##### snapPoints

`number`[]

#### Returns

`number`
