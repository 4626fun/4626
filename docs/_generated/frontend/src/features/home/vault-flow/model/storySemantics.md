[**4626-app**](../../../../../index.md)

***

[4626-app](../../../../../index.md) / src/features/home/vault-flow/model/storySemantics

# src/features/home/vault-flow/model/storySemantics

## Type Aliases

### AllocationRepresentation

> **AllocationRepresentation** = `"cards"` \| `"payloads"` \| `"receivingSegments"` \| `"unifiedFace"`

Defined in: [src/features/home/vault-flow/model/storySemantics.ts:59](https://github.com/wenakita/4626/blob/main/frontend/src/features/home/vault-flow/model/storySemantics.ts#L59)

***

### AudiencePrimary

> **AudiencePrimary** = `"all"` \| `"creator"` \| `"participants"`

Defined in: [src/features/home/vault-flow/model/storySemantics.ts:51](https://github.com/wenakita/4626/blob/main/frontend/src/features/home/vault-flow/model/storySemantics.ts#L51)

***

### BeatDefinition

> **BeatDefinition** = `object`

Defined in: [src/features/home/vault-flow/model/storySemantics.ts:65](https://github.com/wenakita/4626/blob/main/frontend/src/features/home/vault-flow/model/storySemantics.ts#L65)

#### Properties

##### audiencePrimary

> **audiencePrimary**: [`AudiencePrimary`](#audienceprimary)

Defined in: [src/features/home/vault-flow/model/storySemantics.ts:67](https://github.com/wenakita/4626/blob/main/frontend/src/features/home/vault-flow/model/storySemantics.ts#L67)

##### completion

> **completion**: [`StoryMilestoneHard`](#storymilestonehard)

Defined in: [src/features/home/vault-flow/model/storySemantics.ts:68](https://github.com/wenakita/4626/blob/main/frontend/src/features/home/vault-flow/model/storySemantics.ts#L68)

##### completionTrigger

> **completionTrigger**: [`MilestoneActivationTrigger`](#milestoneactivationtrigger)

Defined in: [src/features/home/vault-flow/model/storySemantics.ts:69](https://github.com/wenakita/4626/blob/main/frontend/src/features/home/vault-flow/model/storySemantics.ts#L69)

##### focus

> **focus**: [`StoryFocus`](#storyfocus)

Defined in: [src/features/home/vault-flow/model/storySemantics.ts:66](https://github.com/wenakita/4626/blob/main/frontend/src/features/home/vault-flow/model/storySemantics.ts#L66)

##### requiresReEntryHint?

> `optional` **requiresReEntryHint**: `true`

Defined in: [src/features/home/vault-flow/model/storySemantics.ts:70](https://github.com/wenakita/4626/blob/main/frontend/src/features/home/vault-flow/model/storySemantics.ts#L70)

***

### BeatWindow

> **BeatWindow** = `object`

Defined in: [src/features/home/vault-flow/model/storySemantics.ts:120](https://github.com/wenakita/4626/blob/main/frontend/src/features/home/vault-flow/model/storySemantics.ts#L120)

#### Properties

##### beat

> **beat**: [`StoryBeatId`](#storybeatid)

Defined in: [src/features/home/vault-flow/model/storySemantics.ts:121](https://github.com/wenakita/4626/blob/main/frontend/src/features/home/vault-flow/model/storySemantics.ts#L121)

##### end

> **end**: `number`

Defined in: [src/features/home/vault-flow/model/storySemantics.ts:123](https://github.com/wenakita/4626/blob/main/frontend/src/features/home/vault-flow/model/storySemantics.ts#L123)

##### holdEnd

> **holdEnd**: `number`

Defined in: [src/features/home/vault-flow/model/storySemantics.ts:125](https://github.com/wenakita/4626/blob/main/frontend/src/features/home/vault-flow/model/storySemantics.ts#L125)

##### holdStart

> **holdStart**: `number`

Defined in: [src/features/home/vault-flow/model/storySemantics.ts:124](https://github.com/wenakita/4626/blob/main/frontend/src/features/home/vault-flow/model/storySemantics.ts#L124)

##### start

> **start**: `number`

Defined in: [src/features/home/vault-flow/model/storySemantics.ts:122](https://github.com/wenakita/4626/blob/main/frontend/src/features/home/vault-flow/model/storySemantics.ts#L122)

***

### MilestoneActivationTrigger

> **MilestoneActivationTrigger** = `"holdStart"` \| `"beatExit"`

Defined in: [src/features/home/vault-flow/model/storySemantics.ts:57](https://github.com/wenakita/4626/blob/main/frontend/src/features/home/vault-flow/model/storySemantics.ts#L57)

***

### StoryBeatId

> **StoryBeatId** = *typeof* [`STORY_BEAT_ORDER`](#story_beat_order)\[`number`\]

Defined in: [src/features/home/vault-flow/model/storySemantics.ts:16](https://github.com/wenakita/4626/blob/main/frontend/src/features/home/vault-flow/model/storySemantics.ts#L16)

***

### StoryFocus

> **StoryFocus** = `"vault"` \| `"deposit"` \| `"distribution"` \| `"receivingFace"` \| `"strategies"`

Defined in: [src/features/home/vault-flow/model/storySemantics.ts:44](https://github.com/wenakita/4626/blob/main/frontend/src/features/home/vault-flow/model/storySemantics.ts#L44)

***

### StoryMilestoneHard

> **StoryMilestoneHard** = *typeof* [`STORY_MILESTONES_HARD`](#story_milestones_hard)\[`number`\]

Defined in: [src/features/home/vault-flow/model/storySemantics.ts:38](https://github.com/wenakita/4626/blob/main/frontend/src/features/home/vault-flow/model/storySemantics.ts#L38)

***

### StoryMilestoneId

> **StoryMilestoneId** = [`StoryMilestoneHard`](#storymilestonehard) \| [`StoryMilestoneSoft`](#storymilestonesoft)

Defined in: [src/features/home/vault-flow/model/storySemantics.ts:40](https://github.com/wenakita/4626/blob/main/frontend/src/features/home/vault-flow/model/storySemantics.ts#L40)

***

### StoryMilestoneSoft

> **StoryMilestoneSoft** = *typeof* [`STORY_MILESTONES_SOFT`](#story_milestones_soft)\[`number`\]

Defined in: [src/features/home/vault-flow/model/storySemantics.ts:39](https://github.com/wenakita/4626/blob/main/frontend/src/features/home/vault-flow/model/storySemantics.ts#L39)

## Variables

### BEAT\_DEFINITIONS

> `const` **BEAT\_DEFINITIONS**: `Record`\<[`StoryBeatId`](#storybeatid), [`BeatDefinition`](#beatdefinition)\>

Defined in: [src/features/home/vault-flow/model/storySemantics.ts:75](https://github.com/wenakita/4626/blob/main/frontend/src/features/home/vault-flow/model/storySemantics.ts#L75)

***

### DESKTOP\_BEAT\_WINDOWS

> `const` **DESKTOP\_BEAT\_WINDOWS**: [`BeatWindow`](#beatwindow)[]

Defined in: [src/features/home/vault-flow/model/storySemantics.ts:136](https://github.com/wenakita/4626/blob/main/frontend/src/features/home/vault-flow/model/storySemantics.ts#L136)

***

### MOBILE\_BEAT\_WINDOWS

> `const` **MOBILE\_BEAT\_WINDOWS**: [`BeatWindow`](#beatwindow)[]

Defined in: [src/features/home/vault-flow/model/storySemantics.ts:147](https://github.com/wenakita/4626/blob/main/frontend/src/features/home/vault-flow/model/storySemantics.ts#L147)

***

### REDUCED\_BEAT\_WINDOWS

> `const` **REDUCED\_BEAT\_WINDOWS**: [`BeatWindow`](#beatwindow)[] = `DESKTOP_BEAT_WINDOWS`

Defined in: [src/features/home/vault-flow/model/storySemantics.ts:157](https://github.com/wenakita/4626/blob/main/frontend/src/features/home/vault-flow/model/storySemantics.ts#L157)

***

### STORY\_BEAT\_ORDER

> `const` **STORY\_BEAT\_ORDER**: readonly \[`"creatorEstablishes"`, `"valueFlowsIn"`, `"participantDeposits"`, `"distributionMeaningful"`, `"deployStrategies"`, `"earningTogether"`\]

Defined in: [src/features/home/vault-flow/model/storySemantics.ts:7](https://github.com/wenakita/4626/blob/main/frontend/src/features/home/vault-flow/model/storySemantics.ts#L7)

***

### STORY\_MILESTONES\_HARD

> `const` **STORY\_MILESTONES\_HARD**: readonly \[`"vaultReady"`, `"valueSourceActive"`, `"mintConfirmed"`, `"allocationEncoded"`, `"deployComplete"`, `"loopActive"`\]

Defined in: [src/features/home/vault-flow/model/storySemantics.ts:21](https://github.com/wenakita/4626/blob/main/frontend/src/features/home/vault-flow/model/storySemantics.ts#L21)

***

### STORY\_MILESTONES\_SOFT

> `const` **STORY\_MILESTONES\_SOFT**: readonly \[`"distributionFullyVisible"`, `"receivingFaceVisible"`, `"valueFlowsVisible"`, `"reEntryHintVisible"`\]

Defined in: [src/features/home/vault-flow/model/storySemantics.ts:31](https://github.com/wenakita/4626/blob/main/frontend/src/features/home/vault-flow/model/storySemantics.ts#L31)

## Functions

### resolveBeatWindow()

> **resolveBeatWindow**(`globalProgress`, `windows`): `object`

Defined in: [src/features/home/vault-flow/model/storySemantics.ts:161](https://github.com/wenakita/4626/blob/main/frontend/src/features/home/vault-flow/model/storySemantics.ts#L161)

#### Parameters

##### globalProgress

`number`

##### windows

[`BeatWindow`](#beatwindow)[]

#### Returns

`object`

##### beatProgress

> **beatProgress**: `number`

##### window

> **window**: [`BeatWindow`](#beatwindow)
