[**4626-app**](../../../../../index.md)

***

[4626-app](../../../../../index.md) / api/\_handlers/telegram/webhook/services/inlineTokenAnalysis

# api/\_handlers/telegram/webhook/services/inlineTokenAnalysis

## Type Aliases

### InlineTokenAnalysisResolution

> **InlineTokenAnalysisResolution** = [`ResolvedInlineTokenAnalysis`](#resolvedinlinetokenanalysis) \| [`UnresolvedInlineTokenAnalysis`](#unresolvedinlinetokenanalysis)

Defined in: [api/\_handlers/telegram/webhook/services/inlineTokenAnalysis.ts:99](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/services/inlineTokenAnalysis.ts#L99)

***

### ResolvedInlineTokenAnalysis

> **ResolvedInlineTokenAnalysis** = `object`

Defined in: [api/\_handlers/telegram/webhook/services/inlineTokenAnalysis.ts:58](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/services/inlineTokenAnalysis.ts#L58)

#### Properties

##### ageSource

> **ageSource**: `"pair_created"` \| `"token_created"` \| `null`

Defined in: [api/\_handlers/telegram/webhook/services/inlineTokenAnalysis.ts:73](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/services/inlineTokenAnalysis.ts#L73)

##### buys1h

> **buys1h**: `number` \| `null`

Defined in: [api/\_handlers/telegram/webhook/services/inlineTokenAnalysis.ts:86](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/services/inlineTokenAnalysis.ts#L86)

##### buys24h

> **buys24h**: `number` \| `null`

Defined in: [api/\_handlers/telegram/webhook/services/inlineTokenAnalysis.ts:84](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/services/inlineTokenAnalysis.ts#L84)

##### chain

> **chain**: [`SupportedDexChain`](#supporteddexchain)

Defined in: [api/\_handlers/telegram/webhook/services/inlineTokenAnalysis.ts:62](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/services/inlineTokenAnalysis.ts#L62)

##### chainLabel

> **chainLabel**: `string`

Defined in: [api/\_handlers/telegram/webhook/services/inlineTokenAnalysis.ts:63](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/services/inlineTokenAnalysis.ts#L63)

##### checksumAddress

> **checksumAddress**: `Address`

Defined in: [api/\_handlers/telegram/webhook/services/inlineTokenAnalysis.ts:61](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/services/inlineTokenAnalysis.ts#L61)

##### createdAt

> **createdAt**: `string` \| `null`

Defined in: [api/\_handlers/telegram/webhook/services/inlineTokenAnalysis.ts:74](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/services/inlineTokenAnalysis.ts#L74)

##### decimals

> **decimals**: `number` \| `null`

Defined in: [api/\_handlers/telegram/webhook/services/inlineTokenAnalysis.ts:69](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/services/inlineTokenAnalysis.ts#L69)

##### dexId

> **dexId**: `string` \| `null`

Defined in: [api/\_handlers/telegram/webhook/services/inlineTokenAnalysis.ts:64](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/services/inlineTokenAnalysis.ts#L64)

##### dexUrl

> **dexUrl**: `string` \| `null`

Defined in: [api/\_handlers/telegram/webhook/services/inlineTokenAnalysis.ts:65](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/services/inlineTokenAnalysis.ts#L65)

##### fdvUsd

> **fdvUsd**: `number` \| `null`

Defined in: [api/\_handlers/telegram/webhook/services/inlineTokenAnalysis.ts:76](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/services/inlineTokenAnalysis.ts#L76)

##### holders

> **holders**: `number` \| `null`

Defined in: [api/\_handlers/telegram/webhook/services/inlineTokenAnalysis.ts:82](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/services/inlineTokenAnalysis.ts#L82)

##### kind

> **kind**: `"resolved"`

Defined in: [api/\_handlers/telegram/webhook/services/inlineTokenAnalysis.ts:59](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/services/inlineTokenAnalysis.ts#L59)

##### liquidityUsd

> **liquidityUsd**: `number` \| `null`

Defined in: [api/\_handlers/telegram/webhook/services/inlineTokenAnalysis.ts:77](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/services/inlineTokenAnalysis.ts#L77)

##### logoUrl

> **logoUrl**: `string` \| `null`

Defined in: [api/\_handlers/telegram/webhook/services/inlineTokenAnalysis.ts:70](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/services/inlineTokenAnalysis.ts#L70)

##### marketCapUsd

> **marketCapUsd**: `number` \| `null`

Defined in: [api/\_handlers/telegram/webhook/services/inlineTokenAnalysis.ts:75](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/services/inlineTokenAnalysis.ts#L75)

##### metadataQualityScore

> **metadataQualityScore**: `number`

Defined in: [api/\_handlers/telegram/webhook/services/inlineTokenAnalysis.ts:71](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/services/inlineTokenAnalysis.ts#L71)

##### name

> **name**: `string` \| `null`

Defined in: [api/\_handlers/telegram/webhook/services/inlineTokenAnalysis.ts:67](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/services/inlineTokenAnalysis.ts#L67)

##### normalizedAddress

> **normalizedAddress**: `` `0x${string}` ``

Defined in: [api/\_handlers/telegram/webhook/services/inlineTokenAnalysis.ts:60](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/services/inlineTokenAnalysis.ts#L60)

##### pairAddress

> **pairAddress**: `` `0x${string}` `` \| `null`

Defined in: [api/\_handlers/telegram/webhook/services/inlineTokenAnalysis.ts:66](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/services/inlineTokenAnalysis.ts#L66)

##### priceChange24h

> **priceChange24h**: `number` \| `null`

Defined in: [api/\_handlers/telegram/webhook/services/inlineTokenAnalysis.ts:83](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/services/inlineTokenAnalysis.ts#L83)

##### secondary

> **secondary**: [`TokenAnalysisSecondarySignals`](#tokenanalysissecondarysignals)

Defined in: [api/\_handlers/telegram/webhook/services/inlineTokenAnalysis.ts:89](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/services/inlineTokenAnalysis.ts#L89)

##### sells1h

> **sells1h**: `number` \| `null`

Defined in: [api/\_handlers/telegram/webhook/services/inlineTokenAnalysis.ts:87](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/services/inlineTokenAnalysis.ts#L87)

##### sells24h

> **sells24h**: `number` \| `null`

Defined in: [api/\_handlers/telegram/webhook/services/inlineTokenAnalysis.ts:85](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/services/inlineTokenAnalysis.ts#L85)

##### symbol

> **symbol**: `string` \| `null`

Defined in: [api/\_handlers/telegram/webhook/services/inlineTokenAnalysis.ts:68](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/services/inlineTokenAnalysis.ts#L68)

##### vaultLink

> **vaultLink**: [`TokenAnalysisVaultLink`](#tokenanalysisvaultlink)

Defined in: [api/\_handlers/telegram/webhook/services/inlineTokenAnalysis.ts:88](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/services/inlineTokenAnalysis.ts#L88)

##### verifiedTokenMetadataPresent

> **verifiedTokenMetadataPresent**: `boolean`

Defined in: [api/\_handlers/telegram/webhook/services/inlineTokenAnalysis.ts:72](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/services/inlineTokenAnalysis.ts#L72)

##### volume1hUsd

> **volume1hUsd**: `number` \| `null`

Defined in: [api/\_handlers/telegram/webhook/services/inlineTokenAnalysis.ts:80](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/services/inlineTokenAnalysis.ts#L80)

##### volume24hUsd

> **volume24hUsd**: `number` \| `null`

Defined in: [api/\_handlers/telegram/webhook/services/inlineTokenAnalysis.ts:78](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/services/inlineTokenAnalysis.ts#L78)

##### volume5mUsd

> **volume5mUsd**: `number` \| `null`

Defined in: [api/\_handlers/telegram/webhook/services/inlineTokenAnalysis.ts:81](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/services/inlineTokenAnalysis.ts#L81)

##### volume6hUsd

> **volume6hUsd**: `number` \| `null`

Defined in: [api/\_handlers/telegram/webhook/services/inlineTokenAnalysis.ts:79](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/services/inlineTokenAnalysis.ts#L79)

***

### SupportedDexChain

> **SupportedDexChain** = `"base"` \| `"ethereum"` \| `"arbitrum"` \| `"optimism"` \| `"polygon"` \| `"bsc"` \| `"avalanche"` \| `"zora"`

Defined in: [api/\_handlers/telegram/webhook/services/inlineTokenAnalysis.ts:11](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/services/inlineTokenAnalysis.ts#L11)

***

### TokenAnalysisCardConfidence

> **TokenAnalysisCardConfidence** = `"low"` \| `"medium"` \| `"high"`

Defined in: [api/\_handlers/telegram/webhook/services/inlineTokenAnalysis.ts:21](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/services/inlineTokenAnalysis.ts#L21)

***

### TokenAnalysisMetadataQuality

> **TokenAnalysisMetadataQuality** = `object`

Defined in: [api/\_handlers/telegram/webhook/services/inlineTokenAnalysis.ts:23](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/services/inlineTokenAnalysis.ts#L23)

#### Properties

##### decimals

> **decimals**: `number` \| `null`

Defined in: [api/\_handlers/telegram/webhook/services/inlineTokenAnalysis.ts:27](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/services/inlineTokenAnalysis.ts#L27)

##### logoUrl

> **logoUrl**: `string` \| `null`

Defined in: [api/\_handlers/telegram/webhook/services/inlineTokenAnalysis.ts:28](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/services/inlineTokenAnalysis.ts#L28)

##### name

> **name**: `string` \| `null`

Defined in: [api/\_handlers/telegram/webhook/services/inlineTokenAnalysis.ts:25](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/services/inlineTokenAnalysis.ts#L25)

##### supportsLogo

> **supportsLogo**: `boolean`

Defined in: [api/\_handlers/telegram/webhook/services/inlineTokenAnalysis.ts:29](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/services/inlineTokenAnalysis.ts#L29)

##### symbol

> **symbol**: `string` \| `null`

Defined in: [api/\_handlers/telegram/webhook/services/inlineTokenAnalysis.ts:26](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/services/inlineTokenAnalysis.ts#L26)

##### verifiedTokenMetadataPresent

> **verifiedTokenMetadataPresent**: `boolean`

Defined in: [api/\_handlers/telegram/webhook/services/inlineTokenAnalysis.ts:24](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/services/inlineTokenAnalysis.ts#L24)

***

### TokenAnalysisRiskSignals

> **TokenAnalysisRiskSignals** = `object`

Defined in: [api/\_handlers/telegram/webhook/services/inlineTokenAnalysis.ts:32](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/services/inlineTokenAnalysis.ts#L32)

#### Properties

##### blacklist

> **blacklist**: `"yes"` \| `"no"` \| `"unknown"` \| `null`

Defined in: [api/\_handlers/telegram/webhook/services/inlineTokenAnalysis.ts:35](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/services/inlineTokenAnalysis.ts#L35)

##### liquidityStatus

> **liquidityStatus**: `"locked"` \| `"burned"` \| `"unknown"` \| `null`

Defined in: [api/\_handlers/telegram/webhook/services/inlineTokenAnalysis.ts:38](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/services/inlineTokenAnalysis.ts#L38)

##### mint

> **mint**: `"yes"` \| `"no"` \| `"unknown"` \| `null`

Defined in: [api/\_handlers/telegram/webhook/services/inlineTokenAnalysis.ts:34](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/services/inlineTokenAnalysis.ts#L34)

##### ownership

> **ownership**: `"renounced"` \| `"owned"` \| `"unknown"` \| `null`

Defined in: [api/\_handlers/telegram/webhook/services/inlineTokenAnalysis.ts:33](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/services/inlineTokenAnalysis.ts#L33)

##### proxy

> **proxy**: `"yes"` \| `"no"` \| `"unknown"` \| `null`

Defined in: [api/\_handlers/telegram/webhook/services/inlineTokenAnalysis.ts:36](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/services/inlineTokenAnalysis.ts#L36)

##### taxBps

> **taxBps**: `number` \| `null`

Defined in: [api/\_handlers/telegram/webhook/services/inlineTokenAnalysis.ts:37](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/services/inlineTokenAnalysis.ts#L37)

***

### TokenAnalysisSecondarySignals

> **TokenAnalysisSecondarySignals** = `object`

Defined in: [api/\_handlers/telegram/webhook/services/inlineTokenAnalysis.ts:41](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/services/inlineTokenAnalysis.ts#L41)

#### Properties

##### createdAt

> **createdAt**: `string` \| `null`

Defined in: [api/\_handlers/telegram/webhook/services/inlineTokenAnalysis.ts:44](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/services/inlineTokenAnalysis.ts#L44)

##### creatorLabel

> **creatorLabel**: `string` \| `null`

Defined in: [api/\_handlers/telegram/webhook/services/inlineTokenAnalysis.ts:46](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/services/inlineTokenAnalysis.ts#L46)

##### holders

> **holders**: `number` \| `null`

Defined in: [api/\_handlers/telegram/webhook/services/inlineTokenAnalysis.ts:45](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/services/inlineTokenAnalysis.ts#L45)

##### metadataQuality

> **metadataQuality**: `Partial`\<[`TokenAnalysisMetadataQuality`](#tokenanalysismetadataquality)\>

Defined in: [api/\_handlers/telegram/webhook/services/inlineTokenAnalysis.ts:43](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/services/inlineTokenAnalysis.ts#L43)

##### risk

> **risk**: [`TokenAnalysisRiskSignals`](#tokenanalysisrisksignals)

Defined in: [api/\_handlers/telegram/webhook/services/inlineTokenAnalysis.ts:42](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/services/inlineTokenAnalysis.ts#L42)

***

### TokenAnalysisVaultLink

> **TokenAnalysisVaultLink** = `object`

Defined in: [api/\_handlers/telegram/webhook/services/inlineTokenAnalysis.ts:49](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/services/inlineTokenAnalysis.ts#L49)

#### Properties

##### creatorCoinAddress

> **creatorCoinAddress**: `` `0x${string}` `` \| `null`

Defined in: [api/\_handlers/telegram/webhook/services/inlineTokenAnalysis.ts:53](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/services/inlineTokenAnalysis.ts#L53)

##### creatorLabel

> **creatorLabel**: `string` \| `null`

Defined in: [api/\_handlers/telegram/webhook/services/inlineTokenAnalysis.ts:55](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/services/inlineTokenAnalysis.ts#L55)

##### linked

> **linked**: `boolean`

Defined in: [api/\_handlers/telegram/webhook/services/inlineTokenAnalysis.ts:50](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/services/inlineTokenAnalysis.ts#L50)

##### relation

> **relation**: `"creator_coin"` \| `"share_token"` \| `"vault"` \| `null`

Defined in: [api/\_handlers/telegram/webhook/services/inlineTokenAnalysis.ts:51](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/services/inlineTokenAnalysis.ts#L51)

##### shareTokenAddress

> **shareTokenAddress**: `` `0x${string}` `` \| `null`

Defined in: [api/\_handlers/telegram/webhook/services/inlineTokenAnalysis.ts:54](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/services/inlineTokenAnalysis.ts#L54)

##### vaultAddress

> **vaultAddress**: `` `0x${string}` `` \| `null`

Defined in: [api/\_handlers/telegram/webhook/services/inlineTokenAnalysis.ts:52](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/services/inlineTokenAnalysis.ts#L52)

***

### UnresolvedInlineTokenAnalysis

> **UnresolvedInlineTokenAnalysis** = `object`

Defined in: [api/\_handlers/telegram/webhook/services/inlineTokenAnalysis.ts:92](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/services/inlineTokenAnalysis.ts#L92)

#### Properties

##### checksumAddress

> **checksumAddress**: `Address`

Defined in: [api/\_handlers/telegram/webhook/services/inlineTokenAnalysis.ts:95](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/services/inlineTokenAnalysis.ts#L95)

##### kind

> **kind**: `"unresolved"`

Defined in: [api/\_handlers/telegram/webhook/services/inlineTokenAnalysis.ts:93](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/services/inlineTokenAnalysis.ts#L93)

##### normalizedAddress

> **normalizedAddress**: `` `0x${string}` ``

Defined in: [api/\_handlers/telegram/webhook/services/inlineTokenAnalysis.ts:94](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/services/inlineTokenAnalysis.ts#L94)

##### reason

> **reason**: `"no_supported_token_pair"` \| `"no_supported_active_market"`

Defined in: [api/\_handlers/telegram/webhook/services/inlineTokenAnalysis.ts:96](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/services/inlineTokenAnalysis.ts#L96)

## Functions

### resolveInlineTokenAnalysis()

> **resolveInlineTokenAnalysis**(`params`): `Promise`\<[`InlineTokenAnalysisResolution`](#inlinetokenanalysisresolution)\>

Defined in: [api/\_handlers/telegram/webhook/services/inlineTokenAnalysis.ts:528](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/services/inlineTokenAnalysis.ts#L528)

#### Parameters

##### params

###### db?

`Db` \| `null`

###### normalizedAddress

`` `0x${string}` ``

###### secondaryBudgetMs?

`number`

#### Returns

`Promise`\<[`InlineTokenAnalysisResolution`](#inlinetokenanalysisresolution)\>

***

### scoreTokenMetadataQuality()

> **scoreTokenMetadataQuality**(`input`): `number`

Defined in: [api/\_handlers/telegram/webhook/services/inlineTokenAnalysis.ts:219](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/services/inlineTokenAnalysis.ts#L219)

#### Parameters

##### input

[`TokenAnalysisMetadataQuality`](#tokenanalysismetadataquality)

#### Returns

`number`

***

### selectStrongestSupportedMarket()

> **selectStrongestSupportedMarket**(`params`): `object`

Defined in: [api/\_handlers/telegram/webhook/services/inlineTokenAnalysis.ts:251](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/telegram/webhook/services/inlineTokenAnalysis.ts#L251)

#### Parameters

##### params

###### normalizedAddress

`` `0x${string}` ``

###### pairs

`DexPairResponse`[]

#### Returns

`object`

##### candidate

> **candidate**: `CandidateMarket` \| `null`

##### reason

> **reason**: `"no_supported_token_pair"` \| `"no_supported_active_market"` \| `null`
