[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/features/status/statusShared

# src/features/status/statusShared

## Type Aliases

### Check

> **Check** = `object`

Defined in: [src/features/status/statusShared.ts:3](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/status/statusShared.ts#L3)

#### Properties

##### details?

> `optional` **details**: `string`

Defined in: [src/features/status/statusShared.ts:7](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/status/statusShared.ts#L7)

##### href?

> `optional` **href**: `string`

Defined in: [src/features/status/statusShared.ts:8](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/status/statusShared.ts#L8)

##### id

> **id**: `string`

Defined in: [src/features/status/statusShared.ts:4](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/status/statusShared.ts#L4)

##### label

> **label**: `string`

Defined in: [src/features/status/statusShared.ts:5](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/status/statusShared.ts#L5)

##### status

> **status**: [`CheckStatus`](#checkstatus-1)

Defined in: [src/features/status/statusShared.ts:6](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/status/statusShared.ts#L6)

***

### CheckSection

> **CheckSection** = `object`

Defined in: [src/features/status/statusShared.ts:11](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/status/statusShared.ts#L11)

#### Properties

##### checks

> **checks**: [`Check`](#check)[]

Defined in: [src/features/status/statusShared.ts:15](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/status/statusShared.ts#L15)

##### description?

> `optional` **description**: `string`

Defined in: [src/features/status/statusShared.ts:14](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/status/statusShared.ts#L14)

##### id

> **id**: `string`

Defined in: [src/features/status/statusShared.ts:12](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/status/statusShared.ts#L12)

##### title

> **title**: `string`

Defined in: [src/features/status/statusShared.ts:13](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/status/statusShared.ts#L13)

***

### CheckStatus

> **CheckStatus** = `"pass"` \| `"fail"` \| `"warn"` \| `"info"`

Defined in: [src/features/status/statusShared.ts:1](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/status/statusShared.ts#L1)

***

### ProtocolReportResponse

> **ProtocolReportResponse** = `object`

Defined in: [src/features/status/statusShared.ts:18](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/status/statusShared.ts#L18)

#### Properties

##### chainId

> **chainId**: `number`

Defined in: [src/features/status/statusShared.ts:19](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/status/statusShared.ts#L19)

##### generatedAt

> **generatedAt**: `string`

Defined in: [src/features/status/statusShared.ts:20](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/status/statusShared.ts#L20)

##### sections

> **sections**: [`CheckSection`](#checksection)[]

Defined in: [src/features/status/statusShared.ts:21](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/status/statusShared.ts#L21)

***

### ResolvedStatusFixContext

> **ResolvedStatusFixContext** = `object`

Defined in: [src/features/status/statusShared.ts:62](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/status/statusShared.ts#L62)

#### Properties

##### ajnaAuth

> **ajnaAuth**: `string` \| `null`

Defined in: [src/features/status/statusShared.ts:81](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/status/statusShared.ts#L81)

##### ajnaAuthAdmin

> **ajnaAuthAdmin**: `string` \| `null`

Defined in: [src/features/status/statusShared.ts:82](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/status/statusShared.ts#L82)

##### ajnaBufferRatioBps

> **ajnaBufferRatioBps**: `bigint` \| `null`

Defined in: [src/features/status/statusShared.ts:83](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/status/statusShared.ts#L83)

##### ajnaInnerVault

> **ajnaInnerVault**: `string` \| `null`

Defined in: [src/features/status/statusShared.ts:80](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/status/statusShared.ts#L80)

##### ajnaMinBucket

> **ajnaMinBucket**: `bigint` \| `null`

Defined in: [src/features/status/statusShared.ts:84](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/status/statusShared.ts#L84)

##### ajnaPaused

> **ajnaPaused**: `boolean` \| `null`

Defined in: [src/features/status/statusShared.ts:85](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/status/statusShared.ts#L85)

##### ajnaSuggestedBucket

> **ajnaSuggestedBucket**: `bigint` \| `null`

Defined in: [src/features/status/statusShared.ts:86](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/status/statusShared.ts#L86)

##### creatorToken

> **creatorToken**: `string` \| `null`

Defined in: [src/features/status/statusShared.ts:65](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/status/statusShared.ts#L65)

##### gauge

> **gauge**: `string` \| `null`

Defined in: [src/features/status/statusShared.ts:73](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/status/statusShared.ts#L73)

##### oracle

> **oracle**: `string` \| `null`

Defined in: [src/features/status/statusShared.ts:74](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/status/statusShared.ts#L74)

##### oracleOwner

> **oracleOwner**: `string` \| `null`

Defined in: [src/features/status/statusShared.ts:75](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/status/statusShared.ts#L75)

##### oracleV3Pool

> **oracleV3Pool**: `string` \| `null`

Defined in: [src/features/status/statusShared.ts:77](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/status/statusShared.ts#L77)

##### oracleV3PoolConfigured

> **oracleV3PoolConfigured**: `boolean` \| `null`

Defined in: [src/features/status/statusShared.ts:76](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/status/statusShared.ts#L76)

##### shareGauge

> **shareGauge**: `string` \| `null`

Defined in: [src/features/status/statusShared.ts:69](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/status/statusShared.ts#L69)

##### shareMinterOk

> **shareMinterOk**: `boolean` \| `null`

Defined in: [src/features/status/statusShared.ts:70](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/status/statusShared.ts#L70)

##### shareOFT

> **shareOFT**: `string` \| `null`

Defined in: [src/features/status/statusShared.ts:66](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/status/statusShared.ts#L66)

##### shareOwner

> **shareOwner**: `string` \| `null`

Defined in: [src/features/status/statusShared.ts:67](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/status/statusShared.ts#L67)

##### shareVault

> **shareVault**: `string` \| `null`

Defined in: [src/features/status/statusShared.ts:68](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/status/statusShared.ts#L68)

##### v3ObsNext

> **v3ObsNext**: `number` \| `null`

Defined in: [src/features/status/statusShared.ts:79](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/status/statusShared.ts#L79)

##### v3Pool

> **v3Pool**: `string` \| `null`

Defined in: [src/features/status/statusShared.ts:78](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/status/statusShared.ts#L78)

##### vaultAddress

> **vaultAddress**: `string` \| `null`

Defined in: [src/features/status/statusShared.ts:63](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/status/statusShared.ts#L63)

##### vaultOwner

> **vaultOwner**: `string` \| `null`

Defined in: [src/features/status/statusShared.ts:64](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/status/statusShared.ts#L64)

##### wrapper

> **wrapper**: `string` \| `null`

Defined in: [src/features/status/statusShared.ts:71](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/status/statusShared.ts#L71)

##### wrapperWhitelisted

> **wrapperWhitelisted**: `boolean` \| `null`

Defined in: [src/features/status/statusShared.ts:72](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/status/statusShared.ts#L72)

***

### VaultFixContext

> **VaultFixContext** = `object`

Defined in: [src/features/status/statusShared.ts:31](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/status/statusShared.ts#L31)

#### Properties

##### ajnaAdapterAddress?

> `optional` **ajnaAdapterAddress**: `string` \| `null`

Defined in: [src/features/status/statusShared.ts:51](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/status/statusShared.ts#L51)

##### ajnaAdapterOwner?

> `optional` **ajnaAdapterOwner**: `string` \| `null`

Defined in: [src/features/status/statusShared.ts:52](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/status/statusShared.ts#L52)

##### ajnaAuthAddress?

> `optional` **ajnaAuthAddress**: `string` \| `null`

Defined in: [src/features/status/statusShared.ts:54](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/status/statusShared.ts#L54)

##### ajnaAuthAdmin?

> `optional` **ajnaAuthAdmin**: `string` \| `null`

Defined in: [src/features/status/statusShared.ts:55](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/status/statusShared.ts#L55)

##### ajnaBufferRatioBps?

> `optional` **ajnaBufferRatioBps**: `string` \| `null`

Defined in: [src/features/status/statusShared.ts:56](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/status/statusShared.ts#L56)

##### ajnaInnerVaultAddress?

> `optional` **ajnaInnerVaultAddress**: `string` \| `null`

Defined in: [src/features/status/statusShared.ts:53](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/status/statusShared.ts#L53)

##### ajnaMinBucketIndex?

> `optional` **ajnaMinBucketIndex**: `string` \| `null`

Defined in: [src/features/status/statusShared.ts:57](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/status/statusShared.ts#L57)

##### ajnaPaused?

> `optional` **ajnaPaused**: `boolean` \| `null`

Defined in: [src/features/status/statusShared.ts:58](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/status/statusShared.ts#L58)

##### ajnaSuggestedBucketIndex?

> `optional` **ajnaSuggestedBucketIndex**: `string` \| `null`

Defined in: [src/features/status/statusShared.ts:59](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/status/statusShared.ts#L59)

##### creatorToken?

> `optional` **creatorToken**: `string`

Defined in: [src/features/status/statusShared.ts:35](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/status/statusShared.ts#L35)

##### gaugeAddress?

> `optional` **gaugeAddress**: `string`

Defined in: [src/features/status/statusShared.ts:44](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/status/statusShared.ts#L44)

##### oracleAddress?

> `optional` **oracleAddress**: `string` \| `null`

Defined in: [src/features/status/statusShared.ts:45](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/status/statusShared.ts#L45)

##### oracleOwner?

> `optional` **oracleOwner**: `string` \| `null`

Defined in: [src/features/status/statusShared.ts:46](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/status/statusShared.ts#L46)

##### oracleV3Pool?

> `optional` **oracleV3Pool**: `string` \| `null`

Defined in: [src/features/status/statusShared.ts:48](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/status/statusShared.ts#L48)

##### oracleV3PoolConfigured?

> `optional` **oracleV3PoolConfigured**: `boolean` \| `null`

Defined in: [src/features/status/statusShared.ts:47](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/status/statusShared.ts#L47)

##### owner?

> `optional` **owner**: `string`

Defined in: [src/features/status/statusShared.ts:34](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/status/statusShared.ts#L34)

##### shareGaugeController?

> `optional` **shareGaugeController**: `string` \| `null`

Defined in: [src/features/status/statusShared.ts:39](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/status/statusShared.ts#L39)

##### shareMinterOk?

> `optional` **shareMinterOk**: `boolean` \| `null`

Defined in: [src/features/status/statusShared.ts:40](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/status/statusShared.ts#L40)

##### shareOFTAddress?

> `optional` **shareOFTAddress**: `string`

Defined in: [src/features/status/statusShared.ts:36](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/status/statusShared.ts#L36)

##### shareOftOwner?

> `optional` **shareOftOwner**: `string` \| `null`

Defined in: [src/features/status/statusShared.ts:37](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/status/statusShared.ts#L37)

##### shareVault?

> `optional` **shareVault**: `string` \| `null`

Defined in: [src/features/status/statusShared.ts:38](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/status/statusShared.ts#L38)

##### v3ObservationCardinalityNext?

> `optional` **v3ObservationCardinalityNext**: `string` \| `null`

Defined in: [src/features/status/statusShared.ts:50](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/status/statusShared.ts#L50)

##### v3PoolAddress?

> `optional` **v3PoolAddress**: `string` \| `null`

Defined in: [src/features/status/statusShared.ts:49](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/status/statusShared.ts#L49)

##### vault?

> `optional` **vault**: `string`

Defined in: [src/features/status/statusShared.ts:32](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/status/statusShared.ts#L32)

##### vaultOwner?

> `optional` **vaultOwner**: `string`

Defined in: [src/features/status/statusShared.ts:33](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/status/statusShared.ts#L33)

##### wrapperAddress?

> `optional` **wrapperAddress**: `string`

Defined in: [src/features/status/statusShared.ts:41](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/status/statusShared.ts#L41)

##### wrapperOwner?

> `optional` **wrapperOwner**: `string` \| `null`

Defined in: [src/features/status/statusShared.ts:42](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/status/statusShared.ts#L42)

##### wrapperWhitelisted?

> `optional` **wrapperWhitelisted**: `boolean` \| `null`

Defined in: [src/features/status/statusShared.ts:43](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/status/statusShared.ts#L43)

***

### VaultReportResponse

> **VaultReportResponse** = `object`

Defined in: [src/features/status/statusShared.ts:24](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/status/statusShared.ts#L24)

#### Properties

##### chainId

> **chainId**: `number`

Defined in: [src/features/status/statusShared.ts:25](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/status/statusShared.ts#L25)

##### context?

> `optional` **context**: `Record`\<`string`, `unknown`\>

Defined in: [src/features/status/statusShared.ts:28](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/status/statusShared.ts#L28)

##### generatedAt

> **generatedAt**: `string`

Defined in: [src/features/status/statusShared.ts:26](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/status/statusShared.ts#L26)

##### sections

> **sections**: [`CheckSection`](#checksection)[]

Defined in: [src/features/status/statusShared.ts:27](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/status/statusShared.ts#L27)

## Functions

### basescanAddressHref()

> **basescanAddressHref**(`addr`): `string`

Defined in: [src/features/status/statusShared.ts:109](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/status/statusShared.ts#L109)

#### Parameters

##### addr

`string`

#### Returns

`string`

***

### countPotentialVaultFixes()

> **countPotentialVaultFixes**(`context`): `number`

Defined in: [src/features/status/statusShared.ts:166](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/status/statusShared.ts#L166)

#### Parameters

##### context

[`ResolvedStatusFixContext`](#resolvedstatusfixcontext)

#### Returns

`number`

***

### isAddressLike()

> **isAddressLike**(`value`): `boolean`

Defined in: [src/features/status/statusShared.ts:89](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/status/statusShared.ts#L89)

#### Parameters

##### value

`string`

#### Returns

`boolean`

***

### resolveStatusFixContext()

> **resolveStatusFixContext**(`rawContext`, `vaultParamAddress`): [`ResolvedStatusFixContext`](#resolvedstatusfixcontext)

Defined in: [src/features/status/statusShared.ts:121](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/status/statusShared.ts#L121)

#### Parameters

##### rawContext

`Record`\<`string`, `unknown`\> | `null` | `undefined`

##### vaultParamAddress

`string` | `null`

#### Returns

[`ResolvedStatusFixContext`](#resolvedstatusfixcontext)

***

### summarize()

> **summarize**(`sections`): `object`

Defined in: [src/features/status/statusShared.ts:93](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/status/statusShared.ts#L93)

#### Parameters

##### sections

[`CheckSection`](#checksection)[]

#### Returns

`object`

##### fail

> **fail**: `number`

##### info

> **info**: `number`

##### pass

> **pass**: `number`

##### warn

> **warn**: `number`
