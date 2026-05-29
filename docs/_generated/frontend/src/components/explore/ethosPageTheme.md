[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/components/explore/ethosPageTheme

# src/components/explore/ethosPageTheme

## Type Aliases

### EthosPageTheme

> **EthosPageTheme** = `object`

Defined in: [src/components/explore/ethosPageTheme.ts:13](https://github.com/wenakita/4626/blob/main/frontend/src/components/explore/ethosPageTheme.ts#L13)

#### Properties

##### accentHex

> **accentHex**: `string`

Defined in: [src/components/explore/ethosPageTheme.ts:16](https://github.com/wenakita/4626/blob/main/frontend/src/components/explore/ethosPageTheme.ts#L16)

##### accentStrongTextClass

> **accentStrongTextClass**: `string`

Defined in: [src/components/explore/ethosPageTheme.ts:25](https://github.com/wenakita/4626/blob/main/frontend/src/components/explore/ethosPageTheme.ts#L25)

##### accentTextClass

> **accentTextClass**: `string`

Defined in: [src/components/explore/ethosPageTheme.ts:24](https://github.com/wenakita/4626/blob/main/frontend/src/components/explore/ethosPageTheme.ts#L24)

##### ambientLayerStyle

> **ambientLayerStyle**: `CSSProperties`

Defined in: [src/components/explore/ethosPageTheme.ts:18](https://github.com/wenakita/4626/blob/main/frontend/src/components/explore/ethosPageTheme.ts#L18)

##### cardBorderClass

> **cardBorderClass**: `string`

Defined in: [src/components/explore/ethosPageTheme.ts:22](https://github.com/wenakita/4626/blob/main/frontend/src/components/explore/ethosPageTheme.ts#L22)

##### cardSurfaceClass

> **cardSurfaceClass**: `string`

Defined in: [src/components/explore/ethosPageTheme.ts:23](https://github.com/wenakita/4626/blob/main/frontend/src/components/explore/ethosPageTheme.ts#L23)

##### dividerStyle

> **dividerStyle**: `CSSProperties`

Defined in: [src/components/explore/ethosPageTheme.ts:29](https://github.com/wenakita/4626/blob/main/frontend/src/components/explore/ethosPageTheme.ts#L29)

##### heroWashStyle

> **heroWashStyle**: `CSSProperties`

Defined in: [src/components/explore/ethosPageTheme.ts:19](https://github.com/wenakita/4626/blob/main/frontend/src/components/explore/ethosPageTheme.ts#L19)

##### isActive

> **isActive**: `boolean`

Defined in: [src/components/explore/ethosPageTheme.ts:14](https://github.com/wenakita/4626/blob/main/frontend/src/components/explore/ethosPageTheme.ts#L14)

##### levelLabel

> **levelLabel**: `string`

Defined in: [src/components/explore/ethosPageTheme.ts:17](https://github.com/wenakita/4626/blob/main/frontend/src/components/explore/ethosPageTheme.ts#L17)

##### orbBottomStyle

> **orbBottomStyle**: `CSSProperties`

Defined in: [src/components/explore/ethosPageTheme.ts:21](https://github.com/wenakita/4626/blob/main/frontend/src/components/explore/ethosPageTheme.ts#L21)

##### orbTopStyle

> **orbTopStyle**: `CSSProperties`

Defined in: [src/components/explore/ethosPageTheme.ts:20](https://github.com/wenakita/4626/blob/main/frontend/src/components/explore/ethosPageTheme.ts#L20)

##### outlineCtaClass

> **outlineCtaClass**: `string`

Defined in: [src/components/explore/ethosPageTheme.ts:28](https://github.com/wenakita/4626/blob/main/frontend/src/components/explore/ethosPageTheme.ts#L28)

##### palette

> **palette**: [`EthosScorePalette`](../chat/EthosScorePill.md#ethosscorepalette)

Defined in: [src/components/explore/ethosPageTheme.ts:15](https://github.com/wenakita/4626/blob/main/frontend/src/components/explore/ethosPageTheme.ts#L15)

##### primaryCtaHoverClass

> **primaryCtaHoverClass**: `string`

Defined in: [src/components/explore/ethosPageTheme.ts:27](https://github.com/wenakita/4626/blob/main/frontend/src/components/explore/ethosPageTheme.ts#L27)

##### primaryCtaStyle

> **primaryCtaStyle**: `CSSProperties`

Defined in: [src/components/explore/ethosPageTheme.ts:26](https://github.com/wenakita/4626/blob/main/frontend/src/components/explore/ethosPageTheme.ts#L26)

## Functions

### buildEthosPageTheme()

> **buildEthosPageTheme**(`score`): [`EthosPageTheme`](#ethospagetheme)

Defined in: [src/components/explore/ethosPageTheme.ts:87](https://github.com/wenakita/4626/blob/main/frontend/src/components/explore/ethosPageTheme.ts#L87)

#### Parameters

##### score

[`EthosScoreValue`](../chat/EthosScorePill.md#ethosscorevalue) | `null` | `undefined`

#### Returns

[`EthosPageTheme`](#ethospagetheme)

***

### resolveCreatorEthosUserkey()

> **resolveCreatorEthosUserkey**(`profile`, `creatorAddress`): `string` \| `null`

Defined in: [src/components/explore/ethosPageTheme.ts:127](https://github.com/wenakita/4626/blob/main/frontend/src/components/explore/ethosPageTheme.ts#L127)

#### Parameters

##### profile

[`ZoraProfile`](../../lib/zora/types.md#zoraprofile) | `null` | `undefined`

##### creatorAddress

`string` | `null` | `undefined`

#### Returns

`string` \| `null`

***

### useCreatorEthosPageTheme()

> **useCreatorEthosPageTheme**(`params`): `object`

Defined in: [src/components/explore/ethosPageTheme.ts:142](https://github.com/wenakita/4626/blob/main/frontend/src/components/explore/ethosPageTheme.ts#L142)

#### Parameters

##### params

###### creatorAddress?

`string` \| `null`

###### profile?

[`ZoraProfile`](../../lib/zora/types.md#zoraprofile) \| `null`

###### serverEthosLevel?

`string` \| `null`

###### serverEthosScore?

`number` \| `null`

#### Returns

`object`

##### ethosScore

> **ethosScore**: [`EthosScoreValue`](../chat/EthosScorePill.md#ethosscorevalue) \| `null`

##### ethosUserkey

> **ethosUserkey**: `string` \| `null`

##### hasPositiveScore

> **hasPositiveScore**: `boolean`

##### isLoading

> **isLoading**: `boolean`

##### theme

> **theme**: [`EthosPageTheme`](#ethospagetheme)
