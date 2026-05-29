[**4626-web**](../../../../../index.md)

***

[4626-web](../../../../../index.md) / src/features/home/vault-flow/model/storyContent

# src/features/home/vault-flow/model/storyContent

## Type Aliases

### DistributionDestination

> **DistributionDestination** = `object`

Defined in: [src/features/home/vault-flow/model/storyContent.ts:6](https://github.com/wenakita/4626/blob/main/frontend/src/features/home/vault-flow/model/storyContent.ts#L6)

#### Properties

##### amount

> **amount**: `string`

Defined in: [src/features/home/vault-flow/model/storyContent.ts:10](https://github.com/wenakita/4626/blob/main/frontend/src/features/home/vault-flow/model/storyContent.ts#L10)

##### icon

> **icon**: `string` \| `null`

Defined in: [src/features/home/vault-flow/model/storyContent.ts:13](https://github.com/wenakita/4626/blob/main/frontend/src/features/home/vault-flow/model/storyContent.ts#L13)

##### numericPercent

> **numericPercent**: `number`

Defined in: [src/features/home/vault-flow/model/storyContent.ts:9](https://github.com/wenakita/4626/blob/main/frontend/src/features/home/vault-flow/model/storyContent.ts#L9)

##### percent

> **percent**: `string`

Defined in: [src/features/home/vault-flow/model/storyContent.ts:8](https://github.com/wenakita/4626/blob/main/frontend/src/features/home/vault-flow/model/storyContent.ts#L8)

##### purposeCopy

> **purposeCopy**: `string`

Defined in: [src/features/home/vault-flow/model/storyContent.ts:12](https://github.com/wenakita/4626/blob/main/frontend/src/features/home/vault-flow/model/storyContent.ts#L12)

##### route

> **route**: `string`

Defined in: [src/features/home/vault-flow/model/storyContent.ts:11](https://github.com/wenakita/4626/blob/main/frontend/src/features/home/vault-flow/model/storyContent.ts#L11)

##### title

> **title**: `string`

Defined in: [src/features/home/vault-flow/model/storyContent.ts:7](https://github.com/wenakita/4626/blob/main/frontend/src/features/home/vault-flow/model/storyContent.ts#L7)

***

### EarningTogetherCopy

> **EarningTogetherCopy** = `object`

Defined in: [src/features/home/vault-flow/model/storyContent.ts:29](https://github.com/wenakita/4626/blob/main/frontend/src/features/home/vault-flow/model/storyContent.ts#L29)

#### Properties

##### subtitle

> **subtitle**: `string`

Defined in: [src/features/home/vault-flow/model/storyContent.ts:31](https://github.com/wenakita/4626/blob/main/frontend/src/features/home/vault-flow/model/storyContent.ts#L31)

##### summary

> **summary**: `string`

Defined in: [src/features/home/vault-flow/model/storyContent.ts:32](https://github.com/wenakita/4626/blob/main/frontend/src/features/home/vault-flow/model/storyContent.ts#L32)

##### title

> **title**: `string`

Defined in: [src/features/home/vault-flow/model/storyContent.ts:30](https://github.com/wenakita/4626/blob/main/frontend/src/features/home/vault-flow/model/storyContent.ts#L30)

***

### StoryContent

> **StoryContent** = `object`

Defined in: [src/features/home/vault-flow/model/storyContent.ts:35](https://github.com/wenakita/4626/blob/main/frontend/src/features/home/vault-flow/model/storyContent.ts#L35)

#### Properties

##### blendedApy

> **blendedApy**: `string`

Defined in: [src/features/home/vault-flow/model/storyContent.ts:45](https://github.com/wenakita/4626/blob/main/frontend/src/features/home/vault-flow/model/storyContent.ts#L45)

##### copy?

> `optional` **copy**: `object`

Defined in: [src/features/home/vault-flow/model/storyContent.ts:46](https://github.com/wenakita/4626/blob/main/frontend/src/features/home/vault-flow/model/storyContent.ts#L46)

###### earningTogether?

> `optional` **earningTogether**: [`EarningTogetherCopy`](#earningtogethercopy)

##### creatorName

> **creatorName**: `string`

Defined in: [src/features/home/vault-flow/model/storyContent.ts:36](https://github.com/wenakita/4626/blob/main/frontend/src/features/home/vault-flow/model/storyContent.ts#L36)

##### creatorTokenSymbol

> **creatorTokenSymbol**: `string`

Defined in: [src/features/home/vault-flow/model/storyContent.ts:37](https://github.com/wenakita/4626/blob/main/frontend/src/features/home/vault-flow/model/storyContent.ts#L37)

##### defaultAuctionEpoch

> **defaultAuctionEpoch**: `string`

Defined in: [src/features/home/vault-flow/model/storyContent.ts:42](https://github.com/wenakita/4626/blob/main/frontend/src/features/home/vault-flow/model/storyContent.ts#L42)

##### defaultAuctionWindow

> **defaultAuctionWindow**: `string`

Defined in: [src/features/home/vault-flow/model/storyContent.ts:41](https://github.com/wenakita/4626/blob/main/frontend/src/features/home/vault-flow/model/storyContent.ts#L41)

##### defaultDepositTokens

> **defaultDepositTokens**: `string`

Defined in: [src/features/home/vault-flow/model/storyContent.ts:40](https://github.com/wenakita/4626/blob/main/frontend/src/features/home/vault-flow/model/storyContent.ts#L40)

##### distribution

> **distribution**: readonly [`DistributionDestination`](#distributiondestination)[]

Defined in: [src/features/home/vault-flow/model/storyContent.ts:43](https://github.com/wenakita/4626/blob/main/frontend/src/features/home/vault-flow/model/storyContent.ts#L43)

##### shareTokenBadgeSrc

> **shareTokenBadgeSrc**: `string`

Defined in: [src/features/home/vault-flow/model/storyContent.ts:39](https://github.com/wenakita/4626/blob/main/frontend/src/features/home/vault-flow/model/storyContent.ts#L39)

##### shareTokenSymbol

> **shareTokenSymbol**: `string`

Defined in: [src/features/home/vault-flow/model/storyContent.ts:38](https://github.com/wenakita/4626/blob/main/frontend/src/features/home/vault-flow/model/storyContent.ts#L38)

##### strategies

> **strategies**: readonly [`StrategyCard`](#strategycard)[]

Defined in: [src/features/home/vault-flow/model/storyContent.ts:44](https://github.com/wenakita/4626/blob/main/frontend/src/features/home/vault-flow/model/storyContent.ts#L44)

***

### StrategyCard

> **StrategyCard** = `object`

Defined in: [src/features/home/vault-flow/model/storyContent.ts:16](https://github.com/wenakita/4626/blob/main/frontend/src/features/home/vault-flow/model/storyContent.ts#L16)

#### Properties

##### amount

> **amount**: `string`

Defined in: [src/features/home/vault-flow/model/storyContent.ts:20](https://github.com/wenakita/4626/blob/main/frontend/src/features/home/vault-flow/model/storyContent.ts#L20)

##### apy

> **apy**: `string`

Defined in: [src/features/home/vault-flow/model/storyContent.ts:21](https://github.com/wenakita/4626/blob/main/frontend/src/features/home/vault-flow/model/storyContent.ts#L21)

##### icon

> **icon**: `string` \| `null`

Defined in: [src/features/home/vault-flow/model/storyContent.ts:24](https://github.com/wenakita/4626/blob/main/frontend/src/features/home/vault-flow/model/storyContent.ts#L24)

##### iconAlt

> **iconAlt**: `string`

Defined in: [src/features/home/vault-flow/model/storyContent.ts:25](https://github.com/wenakita/4626/blob/main/frontend/src/features/home/vault-flow/model/storyContent.ts#L25)

##### iconClassName

> **iconClassName**: `string`

Defined in: [src/features/home/vault-flow/model/storyContent.ts:26](https://github.com/wenakita/4626/blob/main/frontend/src/features/home/vault-flow/model/storyContent.ts#L26)

##### label

> **label**: `string`

Defined in: [src/features/home/vault-flow/model/storyContent.ts:17](https://github.com/wenakita/4626/blob/main/frontend/src/features/home/vault-flow/model/storyContent.ts#L17)

##### numericPercent

> **numericPercent**: `number`

Defined in: [src/features/home/vault-flow/model/storyContent.ts:19](https://github.com/wenakita/4626/blob/main/frontend/src/features/home/vault-flow/model/storyContent.ts#L19)

##### percent

> **percent**: `string`

Defined in: [src/features/home/vault-flow/model/storyContent.ts:18](https://github.com/wenakita/4626/blob/main/frontend/src/features/home/vault-flow/model/storyContent.ts#L18)

##### purposeCopy

> **purposeCopy**: `string`

Defined in: [src/features/home/vault-flow/model/storyContent.ts:23](https://github.com/wenakita/4626/blob/main/frontend/src/features/home/vault-flow/model/storyContent.ts#L23)

##### route

> **route**: `string`

Defined in: [src/features/home/vault-flow/model/storyContent.ts:22](https://github.com/wenakita/4626/blob/main/frontend/src/features/home/vault-flow/model/storyContent.ts#L22)

## Variables

### STORY\_CONTENT

> `const` **STORY\_CONTENT**: [`StoryContent`](#storycontent)

Defined in: [src/features/home/vault-flow/model/storyContent.ts:51](https://github.com/wenakita/4626/blob/main/frontend/src/features/home/vault-flow/model/storyContent.ts#L51)
