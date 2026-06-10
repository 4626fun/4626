[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/lib/swap/swapSubmitTiming

# src/lib/swap/swapSubmitTiming

## Type Aliases

### SwapSubmitTimingCollector

> **SwapSubmitTimingCollector** = `object`

Defined in: [src/lib/swap/swapSubmitTiming.ts:25](https://github.com/wenakita/4626/blob/main/frontend/src/lib/swap/swapSubmitTiming.ts#L25)

#### Properties

##### getReport()

> **getReport**: () => [`SwapSubmitTimingReport`](#swapsubmittimingreport)

Defined in: [src/lib/swap/swapSubmitTiming.ts:27](https://github.com/wenakita/4626/blob/main/frontend/src/lib/swap/swapSubmitTiming.ts#L27)

###### Returns

[`SwapSubmitTimingReport`](#swapsubmittimingreport)

##### mark()

> **mark**: (`phase`) => `void`

Defined in: [src/lib/swap/swapSubmitTiming.ts:26](https://github.com/wenakita/4626/blob/main/frontend/src/lib/swap/swapSubmitTiming.ts#L26)

###### Parameters

###### phase

[`SwapSubmitTimingPhase`](#swapsubmittimingphase)

###### Returns

`void`

***

### SwapSubmitTimingPhase

> **SwapSubmitTimingPhase** = `"submit_start"` \| `"submit_session"` \| `"submit_7702_dry_run"` \| `"submit_balance_preflight"` \| `"submit_zora_pending_wait"` \| `"submit_zora_prepare"` \| `"submit_send"` \| `"aa_entry"` \| `"aa_preflight"` \| `"aa_bundler_probe"` \| `"aa_owner_nonce_balance"` \| `"aa_zora_assert"` \| `"aa_gas_estimate"` \| `"aa_sign"` \| `"aa_bundler_submit"` \| `"aa_send"`

Defined in: [src/lib/swap/swapSubmitTiming.ts:1](https://github.com/wenakita/4626/blob/main/frontend/src/lib/swap/swapSubmitTiming.ts#L1)

***

### SwapSubmitTimingReport

> **SwapSubmitTimingReport** = `object`

Defined in: [src/lib/swap/swapSubmitTiming.ts:19](https://github.com/wenakita/4626/blob/main/frontend/src/lib/swap/swapSubmitTiming.ts#L19)

#### Properties

##### phases

> **phases**: `object`[]

Defined in: [src/lib/swap/swapSubmitTiming.ts:21](https://github.com/wenakita/4626/blob/main/frontend/src/lib/swap/swapSubmitTiming.ts#L21)

###### at

> **at**: `number`

###### deltaMs

> **deltaMs**: `number`

###### phase

> **phase**: [`SwapSubmitTimingPhase`](#swapsubmittimingphase)

##### startedAt

> **startedAt**: `number`

Defined in: [src/lib/swap/swapSubmitTiming.ts:20](https://github.com/wenakita/4626/blob/main/frontend/src/lib/swap/swapSubmitTiming.ts#L20)

##### totalMs

> **totalMs**: `number`

Defined in: [src/lib/swap/swapSubmitTiming.ts:22](https://github.com/wenakita/4626/blob/main/frontend/src/lib/swap/swapSubmitTiming.ts#L22)

## Functions

### createSwapSubmitTiming()

> **createSwapSubmitTiming**(): [`SwapSubmitTimingCollector`](#swapsubmittimingcollector)

Defined in: [src/lib/swap/swapSubmitTiming.ts:30](https://github.com/wenakita/4626/blob/main/frontend/src/lib/swap/swapSubmitTiming.ts#L30)

#### Returns

[`SwapSubmitTimingCollector`](#swapsubmittimingcollector)
