[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/onchain/payoutRouterRuntime

# server/\_lib/onchain/payoutRouterRuntime

## Type Aliases

### PayoutRouterExternalSwapApprovals

> **PayoutRouterExternalSwapApprovals** = `object`

Defined in: [server/\_lib/onchain/payoutRouterRuntime.ts:90](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onchain/payoutRouterRuntime.ts#L90)

#### Properties

##### spenders

> **spenders**: `Address`[]

Defined in: [server/\_lib/onchain/payoutRouterRuntime.ts:92](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onchain/payoutRouterRuntime.ts#L92)

##### targets

> **targets**: `Address`[]

Defined in: [server/\_lib/onchain/payoutRouterRuntime.ts:91](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onchain/payoutRouterRuntime.ts#L91)

***

### PayoutRouterFeeConfig

> **PayoutRouterFeeConfig** = `object`

Defined in: [server/\_lib/onchain/payoutRouterRuntime.ts:85](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onchain/payoutRouterRuntime.ts#L85)

#### Properties

##### wethCreatorFee

> **wethCreatorFee**: `number`

Defined in: [server/\_lib/onchain/payoutRouterRuntime.ts:87](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onchain/payoutRouterRuntime.ts#L87)

##### zoraWethFee

> **zoraWethFee**: `number`

Defined in: [server/\_lib/onchain/payoutRouterRuntime.ts:86](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onchain/payoutRouterRuntime.ts#L86)

## Functions

### resolvePayoutRouterExternalSwapApprovals()

> **resolvePayoutRouterExternalSwapApprovals**(): [`PayoutRouterExternalSwapApprovals`](#payoutrouterexternalswapapprovals)

Defined in: [server/\_lib/onchain/payoutRouterRuntime.ts:135](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onchain/payoutRouterRuntime.ts#L135)

#### Returns

[`PayoutRouterExternalSwapApprovals`](#payoutrouterexternalswapapprovals)

***

### resolvePayoutRouterFeeConfig()

> **resolvePayoutRouterFeeConfig**(): [`PayoutRouterFeeConfig`](#payoutrouterfeeconfig)

Defined in: [server/\_lib/onchain/payoutRouterRuntime.ts:95](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onchain/payoutRouterRuntime.ts#L95)

#### Returns

[`PayoutRouterFeeConfig`](#payoutrouterfeeconfig)

***

### resolvePayoutRouterKeeperAddress()

> **resolvePayoutRouterKeeperAddress**(): `string` \| `null`

Defined in: [server/\_lib/onchain/payoutRouterRuntime.ts:115](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onchain/payoutRouterRuntime.ts#L115)

#### Returns

`string` \| `null`

***

### resolvePayoutRouterKeeperPrivateKey()

> **resolvePayoutRouterKeeperPrivateKey**(`env`): `` `0x${string}` `` \| `null`

Defined in: [server/\_lib/onchain/payoutRouterRuntime.ts:51](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onchain/payoutRouterRuntime.ts#L51)

#### Parameters

##### env

`Record`\<`string`, `string` \| `undefined`\> = `process.env`

#### Returns

`` `0x${string}` `` \| `null`

***

### resolvePayoutRouterZoraToken()

> **resolvePayoutRouterZoraToken**(`fallback?`): `string` \| `null`

Defined in: [server/\_lib/onchain/payoutRouterRuntime.ts:102](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onchain/payoutRouterRuntime.ts#L102)

#### Parameters

##### fallback?

`string` | `null`

#### Returns

`string` \| `null`
