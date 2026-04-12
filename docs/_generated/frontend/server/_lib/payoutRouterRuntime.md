[**4626-app**](../../index.md)

***

[4626-app](../../index.md) / server/\_lib/payoutRouterRuntime

# server/\_lib/payoutRouterRuntime

## Type Aliases

### PayoutRouterExternalSwapApprovals

> **PayoutRouterExternalSwapApprovals** = `object`

Defined in: [server/\_lib/payoutRouterRuntime.ts:67](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/payoutRouterRuntime.ts#L67)

#### Properties

##### spenders

> **spenders**: `Address`[]

Defined in: [server/\_lib/payoutRouterRuntime.ts:69](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/payoutRouterRuntime.ts#L69)

##### targets

> **targets**: `Address`[]

Defined in: [server/\_lib/payoutRouterRuntime.ts:68](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/payoutRouterRuntime.ts#L68)

***

### PayoutRouterFeeConfig

> **PayoutRouterFeeConfig** = `object`

Defined in: [server/\_lib/payoutRouterRuntime.ts:62](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/payoutRouterRuntime.ts#L62)

#### Properties

##### wethCreatorFee

> **wethCreatorFee**: `number`

Defined in: [server/\_lib/payoutRouterRuntime.ts:64](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/payoutRouterRuntime.ts#L64)

##### zoraWethFee

> **zoraWethFee**: `number`

Defined in: [server/\_lib/payoutRouterRuntime.ts:63](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/payoutRouterRuntime.ts#L63)

## Functions

### resolvePayoutRouterExternalSwapApprovals()

> **resolvePayoutRouterExternalSwapApprovals**(): [`PayoutRouterExternalSwapApprovals`](#payoutrouterexternalswapapprovals)

Defined in: [server/\_lib/payoutRouterRuntime.ts:108](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/payoutRouterRuntime.ts#L108)

#### Returns

[`PayoutRouterExternalSwapApprovals`](#payoutrouterexternalswapapprovals)

***

### resolvePayoutRouterFeeConfig()

> **resolvePayoutRouterFeeConfig**(): [`PayoutRouterFeeConfig`](#payoutrouterfeeconfig)

Defined in: [server/\_lib/payoutRouterRuntime.ts:72](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/payoutRouterRuntime.ts#L72)

#### Returns

[`PayoutRouterFeeConfig`](#payoutrouterfeeconfig)

***

### resolvePayoutRouterKeeperAddress()

> **resolvePayoutRouterKeeperAddress**(): `` `0x${string}` `` \| `null`

Defined in: [server/\_lib/payoutRouterRuntime.ts:92](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/payoutRouterRuntime.ts#L92)

#### Returns

`` `0x${string}` `` \| `null`

***

### resolvePayoutRouterZoraToken()

> **resolvePayoutRouterZoraToken**(`fallback?`): `` `0x${string}` `` \| `null`

Defined in: [server/\_lib/payoutRouterRuntime.ts:79](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/payoutRouterRuntime.ts#L79)

#### Parameters

##### fallback?

`` `0x${string}` `` | `null`

#### Returns

`` `0x${string}` `` \| `null`
