[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/onchain/payoutRouterRuntime

# server/\_lib/onchain/payoutRouterRuntime

## Type Aliases

### PayoutRouterExternalSwapApprovals

> **PayoutRouterExternalSwapApprovals** = `object`

Defined in: [server/\_lib/onchain/payoutRouterRuntime.ts:67](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/onchain/payoutRouterRuntime.ts#L67)

#### Properties

##### spenders

> **spenders**: `Address`[]

Defined in: [server/\_lib/onchain/payoutRouterRuntime.ts:69](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/onchain/payoutRouterRuntime.ts#L69)

##### targets

> **targets**: `Address`[]

Defined in: [server/\_lib/onchain/payoutRouterRuntime.ts:68](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/onchain/payoutRouterRuntime.ts#L68)

***

### PayoutRouterFeeConfig

> **PayoutRouterFeeConfig** = `object`

Defined in: [server/\_lib/onchain/payoutRouterRuntime.ts:62](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/onchain/payoutRouterRuntime.ts#L62)

#### Properties

##### wethCreatorFee

> **wethCreatorFee**: `number`

Defined in: [server/\_lib/onchain/payoutRouterRuntime.ts:64](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/onchain/payoutRouterRuntime.ts#L64)

##### zoraWethFee

> **zoraWethFee**: `number`

Defined in: [server/\_lib/onchain/payoutRouterRuntime.ts:63](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/onchain/payoutRouterRuntime.ts#L63)

## Functions

### resolvePayoutRouterExternalSwapApprovals()

> **resolvePayoutRouterExternalSwapApprovals**(): [`PayoutRouterExternalSwapApprovals`](#payoutrouterexternalswapapprovals)

Defined in: [server/\_lib/onchain/payoutRouterRuntime.ts:112](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/onchain/payoutRouterRuntime.ts#L112)

#### Returns

[`PayoutRouterExternalSwapApprovals`](#payoutrouterexternalswapapprovals)

***

### resolvePayoutRouterFeeConfig()

> **resolvePayoutRouterFeeConfig**(): [`PayoutRouterFeeConfig`](#payoutrouterfeeconfig)

Defined in: [server/\_lib/onchain/payoutRouterRuntime.ts:72](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/onchain/payoutRouterRuntime.ts#L72)

#### Returns

[`PayoutRouterFeeConfig`](#payoutrouterfeeconfig)

***

### resolvePayoutRouterKeeperAddress()

> **resolvePayoutRouterKeeperAddress**(): `string` \| `null`

Defined in: [server/\_lib/onchain/payoutRouterRuntime.ts:92](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/onchain/payoutRouterRuntime.ts#L92)

#### Returns

`string` \| `null`

***

### resolvePayoutRouterZoraToken()

> **resolvePayoutRouterZoraToken**(`fallback?`): `string` \| `null`

Defined in: [server/\_lib/onchain/payoutRouterRuntime.ts:79](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/onchain/payoutRouterRuntime.ts#L79)

#### Parameters

##### fallback?

`string` | `null`

#### Returns

`string` \| `null`
