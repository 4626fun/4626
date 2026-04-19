[**4626-app**](../../../../../index.md)

***

[4626-app](../../../../../index.md) / src/features/home/vault-flow/model/storyClock

# src/features/home/vault-flow/model/storyClock

## Type Aliases

### StoryState

> **StoryState** = `object`

Defined in: [src/features/home/vault-flow/model/storyClock.ts:25](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/features/home/vault-flow/model/storyClock.ts#L25)

#### Properties

##### allocationRepresentation

> **allocationRepresentation**: [`AllocationRepresentation`](storySemantics.md#allocationrepresentation)

Defined in: [src/features/home/vault-flow/model/storyClock.ts:44](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/features/home/vault-flow/model/storyClock.ts#L44)

##### beat

> **beat**: [`StoryBeatId`](storySemantics.md#storybeatid)

Defined in: [src/features/home/vault-flow/model/storyClock.ts:27](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/features/home/vault-flow/model/storyClock.ts#L27)

##### beatProgress

> **beatProgress**: `number`

Defined in: [src/features/home/vault-flow/model/storyClock.ts:29](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/features/home/vault-flow/model/storyClock.ts#L29)

##### enteringBeat

> **enteringBeat**: `boolean`

Defined in: [src/features/home/vault-flow/model/storyClock.ts:38](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/features/home/vault-flow/model/storyClock.ts#L38)

##### exitingBeat

> **exitingBeat**: `boolean`

Defined in: [src/features/home/vault-flow/model/storyClock.ts:39](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/features/home/vault-flow/model/storyClock.ts#L39)

##### focus

> **focus**: [`StoryFocus`](storySemantics.md#storyfocus)

Defined in: [src/features/home/vault-flow/model/storyClock.ts:46](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/features/home/vault-flow/model/storyClock.ts#L46)

##### globalProgress

> **globalProgress**: `number`

Defined in: [src/features/home/vault-flow/model/storyClock.ts:31](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/features/home/vault-flow/model/storyClock.ts#L31)

##### milestonesHard

> **milestonesHard**: `Record`\<[`StoryMilestoneHard`](storySemantics.md#storymilestonehard), `boolean`\>

Defined in: [src/features/home/vault-flow/model/storyClock.ts:41](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/features/home/vault-flow/model/storyClock.ts#L41)

##### milestonesSoft

> **milestonesSoft**: `Record`\<[`StoryMilestoneSoft`](storySemantics.md#storymilestonesoft), `boolean`\>

Defined in: [src/features/home/vault-flow/model/storyClock.ts:42](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/features/home/vault-flow/model/storyClock.ts#L42)

##### nextBeat

> **nextBeat**: [`StoryBeatId`](storySemantics.md#storybeatid) \| `null`

Defined in: [src/features/home/vault-flow/model/storyClock.ts:34](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/features/home/vault-flow/model/storyClock.ts#L34)

##### phase

> **phase**: `"enter"` \| `"hold"` \| `"exit"`

Defined in: [src/features/home/vault-flow/model/storyClock.ts:36](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/features/home/vault-flow/model/storyClock.ts#L36)

##### previousBeat

> **previousBeat**: [`StoryBeatId`](storySemantics.md#storybeatid) \| `null`

Defined in: [src/features/home/vault-flow/model/storyClock.ts:33](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/features/home/vault-flow/model/storyClock.ts#L33)

## Functions

### deriveStoryState()

> **deriveStoryState**(`globalProgress`, `profile`): [`StoryState`](#storystate)

Defined in: [src/features/home/vault-flow/model/storyClock.ts:152](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/features/home/vault-flow/model/storyClock.ts#L152)

Derives a fully typed StoryState from raw global progress and profile.
Pure function — no side effects, no React.

#### Parameters

##### globalProgress

`number`

##### profile

[`FlowProfile`](flowProfile.md#flowprofile)

#### Returns

[`StoryState`](#storystate)
