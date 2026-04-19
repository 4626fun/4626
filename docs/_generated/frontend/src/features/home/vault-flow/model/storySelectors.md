[**4626-app**](../../../../../index.md)

***

[4626-app](../../../../../index.md) / src/features/home/vault-flow/model/storySelectors

# src/features/home/vault-flow/model/storySelectors

## Type Aliases

### AnimatedSystem

> **AnimatedSystem** = `"vault"` \| `"valueFlows"` \| `"depositCard"` \| `"distributionFan"` \| `"allocationHandoff"` \| `"strategyFan"` \| `"earningLoop"`

Defined in: [src/features/home/vault-flow/model/storySelectors.ts:140](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/features/home/vault-flow/model/storySelectors.ts#L140)

## Functions

### getAllocationRepresentation()

> **getAllocationRepresentation**(`s`): [`AllocationRepresentation`](storySemantics.md#allocationrepresentation)

Defined in: [src/features/home/vault-flow/model/storySelectors.ts:135](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/features/home/vault-flow/model/storySelectors.ts#L135)

Returns the current allocation representation step.
Renderers use this to decide which visual representation to show.

#### Parameters

##### s

[`StoryState`](storyClock.md#storystate)

#### Returns

[`AllocationRepresentation`](storySemantics.md#allocationrepresentation)

***

### getPhaseLabel()

> **getPhaseLabel**(`s`): `"active"` \| `"entering"` \| `"transitioning"`

Defined in: [src/features/home/vault-flow/model/storySelectors.ts:35](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/features/home/vault-flow/model/storySelectors.ts#L35)

#### Parameters

##### s

[`StoryState`](storyClock.md#storystate)

#### Returns

`"active"` \| `"entering"` \| `"transitioning"`

***

### getPrimaryFocus()

> **getPrimaryFocus**(`s`): [`StoryFocus`](storySemantics.md#storyfocus)

Defined in: [src/features/home/vault-flow/model/storySelectors.ts:128](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/features/home/vault-flow/model/storySelectors.ts#L128)

Returns the primary focal object for the current beat.
Derived from the beat definition — never inferred ad-hoc.

#### Parameters

##### s

[`StoryState`](storyClock.md#storystate)

#### Returns

[`StoryFocus`](storySemantics.md#storyfocus)

***

### getVisibleSystems()

> **getVisibleSystems**(`s`, `profile`): [`AnimatedSystem`](#animatedsystem)[]

Defined in: [src/features/home/vault-flow/model/storySelectors.ts:154](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/features/home/vault-flow/model/storySelectors.ts#L154)

Returns the set of animated systems allowed to run simultaneously for the
given profile. Mobile enforces max 1 animated system + 1 supporting UI block.
This is a selector-enforced API contract, not a convention.

#### Parameters

##### s

[`StoryState`](storyClock.md#storystate)

##### profile

[`FlowProfile`](flowProfile.md#flowprofile)

#### Returns

[`AnimatedSystem`](#animatedsystem)[]

***

### isAllocationEncoded()

> **isAllocationEncoded**(`s`): `boolean`

Defined in: [src/features/home/vault-flow/model/storySelectors.ts:59](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/features/home/vault-flow/model/storySelectors.ts#L59)

#### Parameters

##### s

[`StoryState`](storyClock.md#storystate)

#### Returns

`boolean`

***

### isBeat()

> **isBeat**(`s`, `beat`): `boolean`

Defined in: [src/features/home/vault-flow/model/storySelectors.ts:18](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/features/home/vault-flow/model/storySelectors.ts#L18)

#### Parameters

##### s

[`StoryState`](storyClock.md#storystate)

##### beat

`"creatorEstablishes"` | `"valueFlowsIn"` | `"participantDeposits"` | `"distributionMeaningful"` | `"deployStrategies"` | `"earningTogether"`

#### Returns

`boolean`

***

### isDeployComplete()

> **isDeployComplete**(`s`): `boolean`

Defined in: [src/features/home/vault-flow/model/storySelectors.ts:62](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/features/home/vault-flow/model/storySelectors.ts#L62)

#### Parameters

##### s

[`StoryState`](storyClock.md#storystate)

#### Returns

`boolean`

***

### isDeployStrategiesVisible()

> **isDeployStrategiesVisible**(`s`): `boolean`

Defined in: [src/features/home/vault-flow/model/storySelectors.ts:81](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/features/home/vault-flow/model/storySelectors.ts#L81)

#### Parameters

##### s

[`StoryState`](storyClock.md#storystate)

#### Returns

`boolean`

***

### isDistributionComplete()

> **isDistributionComplete**(`s`): `boolean`

Defined in: [src/features/home/vault-flow/model/storySelectors.ts:92](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/features/home/vault-flow/model/storySelectors.ts#L92)

#### Parameters

##### s

[`StoryState`](storyClock.md#storystate)

#### Returns

`boolean`

***

### isDistributionFullyVisible()

> **isDistributionFullyVisible**(`s`): `boolean`

Defined in: [src/features/home/vault-flow/model/storySelectors.ts:107](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/features/home/vault-flow/model/storySelectors.ts#L107)

#### Parameters

##### s

[`StoryState`](storyClock.md#storystate)

#### Returns

`boolean`

***

### isDistributionVisible()

> **isDistributionVisible**(`s`): `boolean`

Defined in: [src/features/home/vault-flow/model/storySelectors.ts:78](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/features/home/vault-flow/model/storySelectors.ts#L78)

#### Parameters

##### s

[`StoryState`](storyClock.md#storystate)

#### Returns

`boolean`

***

### isEarningTogetherVisible()

> **isEarningTogetherVisible**(`s`): `boolean`

Defined in: [src/features/home/vault-flow/model/storySelectors.ts:84](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/features/home/vault-flow/model/storySelectors.ts#L84)

#### Parameters

##### s

[`StoryState`](storyClock.md#storystate)

#### Returns

`boolean`

***

### isEnterPhase()

> **isEnterPhase**(`s`): `boolean`

Defined in: [src/features/home/vault-flow/model/storySelectors.ts:26](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/features/home/vault-flow/model/storySelectors.ts#L26)

#### Parameters

##### s

[`StoryState`](storyClock.md#storystate)

#### Returns

`boolean`

***

### isExitPhase()

> **isExitPhase**(`s`): `boolean`

Defined in: [src/features/home/vault-flow/model/storySelectors.ts:32](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/features/home/vault-flow/model/storySelectors.ts#L32)

#### Parameters

##### s

[`StoryState`](storyClock.md#storystate)

#### Returns

`boolean`

***

### isHandoffActive()

> **isHandoffActive**(`s`): `boolean`

Defined in: [src/features/home/vault-flow/model/storySelectors.ts:95](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/features/home/vault-flow/model/storySelectors.ts#L95)

#### Parameters

##### s

[`StoryState`](storyClock.md#storystate)

#### Returns

`boolean`

***

### isHoldPhase()

> **isHoldPhase**(`s`): `boolean`

Defined in: [src/features/home/vault-flow/model/storySelectors.ts:29](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/features/home/vault-flow/model/storySelectors.ts#L29)

#### Parameters

##### s

[`StoryState`](storyClock.md#storystate)

#### Returns

`boolean`

***

### isLoopActive()

> **isLoopActive**(`s`): `boolean`

Defined in: [src/features/home/vault-flow/model/storySelectors.ts:70](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/features/home/vault-flow/model/storySelectors.ts#L70)

True when loopActive milestone is set.
Fires at earningTogether holdStart and stays true.
Replaces any isEarningLoopVisible pattern.

#### Parameters

##### s

[`StoryState`](storyClock.md#storystate)

#### Returns

`boolean`

***

### isMintConfirmed()

> **isMintConfirmed**(`s`): `boolean`

Defined in: [src/features/home/vault-flow/model/storySelectors.ts:56](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/features/home/vault-flow/model/storySelectors.ts#L56)

#### Parameters

##### s

[`StoryState`](storyClock.md#storystate)

#### Returns

`boolean`

***

### isPhase()

> **isPhase**(`s`, `phase`): `boolean`

Defined in: [src/features/home/vault-flow/model/storySelectors.ts:21](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/features/home/vault-flow/model/storySelectors.ts#L21)

#### Parameters

##### s

[`StoryState`](storyClock.md#storystate)

##### phase

`"enter"` | `"hold"` | `"exit"`

#### Returns

`boolean`

***

### isReceivingFaceVisible()

> **isReceivingFaceVisible**(`s`): `boolean`

Defined in: [src/features/home/vault-flow/model/storySelectors.ts:110](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/features/home/vault-flow/model/storySelectors.ts#L110)

#### Parameters

##### s

[`StoryState`](storyClock.md#storystate)

#### Returns

`boolean`

***

### isReEntryHintVisible()

> **isReEntryHintVisible**(`s`): `boolean`

Defined in: [src/features/home/vault-flow/model/storySelectors.ts:119](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/features/home/vault-flow/model/storySelectors.ts#L119)

True when the re-entry hint affordance is visible in earningTogether.
The renderer is responsible for setting reEntryHintVisible in milestonesSoft
when the affordance becomes visible on screen.
Used by tests and renderers to verify the affordance is shown.

#### Parameters

##### s

[`StoryState`](storyClock.md#storystate)

#### Returns

`boolean`

***

### isSealReady()

> **isSealReady**(`s`): `boolean`

Defined in: [src/features/home/vault-flow/model/storySelectors.ts:99](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/features/home/vault-flow/model/storySelectors.ts#L99)

#### Parameters

##### s

[`StoryState`](storyClock.md#storystate)

#### Returns

`boolean`

***

### isValueFlowsVisible()

> **isValueFlowsVisible**(`s`): `boolean`

Defined in: [src/features/home/vault-flow/model/storySelectors.ts:104](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/features/home/vault-flow/model/storySelectors.ts#L104)

#### Parameters

##### s

[`StoryState`](storyClock.md#storystate)

#### Returns

`boolean`

***

### isValueSourceActive()

> **isValueSourceActive**(`s`): `boolean`

Defined in: [src/features/home/vault-flow/model/storySelectors.ts:53](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/features/home/vault-flow/model/storySelectors.ts#L53)

#### Parameters

##### s

[`StoryState`](storyClock.md#storystate)

#### Returns

`boolean`

***

### isValueSourceVisible()

> **isValueSourceVisible**(`s`): `boolean`

Defined in: [src/features/home/vault-flow/model/storySelectors.ts:75](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/features/home/vault-flow/model/storySelectors.ts#L75)

#### Parameters

##### s

[`StoryState`](storyClock.md#storystate)

#### Returns

`boolean`

***

### isVaultReady()

> **isVaultReady**(`s`): `boolean`

Defined in: [src/features/home/vault-flow/model/storySelectors.ts:50](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/features/home/vault-flow/model/storySelectors.ts#L50)

#### Parameters

##### s

[`StoryState`](storyClock.md#storystate)

#### Returns

`boolean`
