[**4626-app**](../../../../../index.md)

***

[4626-app](../../../../../index.md) / src/features/home/vault-flow/model/stage4Timings

# src/features/home/vault-flow/model/stage4Timings

## Type Aliases

### Stage4FanCardTiming

> **Stage4FanCardTiming** = `object`

Defined in: [src/features/home/vault-flow/model/stage4Timings.ts:4](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/features/home/vault-flow/model/stage4Timings.ts#L4)

#### Properties

##### destination

> **destination**: `Stage4Range2`

Defined in: [src/features/home/vault-flow/model/stage4Timings.ts:6](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/features/home/vault-flow/model/stage4Timings.ts#L6)

##### opacity

> **opacity**: `Stage4Range2`

Defined in: [src/features/home/vault-flow/model/stage4Timings.ts:5](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/features/home/vault-flow/model/stage4Timings.ts#L5)

***

### VaultFlowStage4TimingPreset

> **VaultFlowStage4TimingPreset** = `object`

Defined in: [src/features/home/vault-flow/model/stage4Timings.ts:9](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/features/home/vault-flow/model/stage4Timings.ts#L9)

#### Properties

##### deployBlur

> **deployBlur**: `Stage4Range3`

Defined in: [src/features/home/vault-flow/model/stage4Timings.ts:12](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/features/home/vault-flow/model/stage4Timings.ts#L12)

##### deployOpacity

> **deployOpacity**: `Stage4Range2`

Defined in: [src/features/home/vault-flow/model/stage4Timings.ts:11](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/features/home/vault-flow/model/stage4Timings.ts#L11)

##### deployTitle

> **deployTitle**: `Stage4Range2`

Defined in: [src/features/home/vault-flow/model/stage4Timings.ts:13](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/features/home/vault-flow/model/stage4Timings.ts#L13)

##### deployZ

> **deployZ**: `Stage4Range3`

Defined in: [src/features/home/vault-flow/model/stage4Timings.ts:10](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/features/home/vault-flow/model/stage4Timings.ts#L10)

##### fanCards

> **fanCards**: \[[`Stage4FanCardTiming`](#stage4fancardtiming), [`Stage4FanCardTiming`](#stage4fancardtiming), [`Stage4FanCardTiming`](#stage4fancardtiming), [`Stage4FanCardTiming`](#stage4fancardtiming)\]

Defined in: [src/features/home/vault-flow/model/stage4Timings.ts:14](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/features/home/vault-flow/model/stage4Timings.ts#L14)

## Variables

### DESKTOP\_STAGE4\_TIMING

> `const` **DESKTOP\_STAGE4\_TIMING**: [`VaultFlowStage4TimingPreset`](#vaultflowstage4timingpreset)

Defined in: [src/features/home/vault-flow/model/stage4Timings.ts:35](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/features/home/vault-flow/model/stage4Timings.ts#L35)

***

### MOBILE\_STAGE4\_TIMING

> `const` **MOBILE\_STAGE4\_TIMING**: [`VaultFlowStage4TimingPreset`](#vaultflowstage4timingpreset)

Defined in: [src/features/home/vault-flow/model/stage4Timings.ts:22](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/features/home/vault-flow/model/stage4Timings.ts#L22)

## Functions

### getVaultFlowStage4TimingPreset()

> **getVaultFlowStage4TimingPreset**(`isDesktop`): [`VaultFlowStage4TimingPreset`](#vaultflowstage4timingpreset)

Defined in: [src/features/home/vault-flow/model/stage4Timings.ts:48](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/features/home/vault-flow/model/stage4Timings.ts#L48)

#### Parameters

##### isDesktop

`boolean`

#### Returns

[`VaultFlowStage4TimingPreset`](#vaultflowstage4timingpreset)
