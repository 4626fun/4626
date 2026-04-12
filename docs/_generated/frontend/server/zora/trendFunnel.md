[**4626-app**](../../index.md)

***

[4626-app](../../index.md) / server/zora/trendFunnel

# server/zora/trendFunnel

## Type Aliases

### RouteabilityLeg

> **RouteabilityLeg** = `object`

Defined in: [server/zora/trendFunnel.ts:28](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/zora/trendFunnel.ts#L28)

#### Properties

##### error?

> `optional` **error**: `string`

Defined in: [server/zora/trendFunnel.ts:30](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/zora/trendFunnel.ts#L30)

##### ok

> **ok**: `boolean`

Defined in: [server/zora/trendFunnel.ts:29](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/zora/trendFunnel.ts#L29)

***

### TrendFunnelConfig

> **TrendFunnelConfig** = `object`

Defined in: [server/zora/trendFunnel.ts:18](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/zora/trendFunnel.ts#L18)

#### Properties

##### allowedTickers

> **allowedTickers**: `Set`\<`string`\> \| `null`

Defined in: [server/zora/trendFunnel.ts:25](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/zora/trendFunnel.ts#L25)

##### automationEnabled

> **automationEnabled**: `boolean`

Defined in: [server/zora/trendFunnel.ts:19](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/zora/trendFunnel.ts#L19)

##### flywheelEnabled

> **flywheelEnabled**: `boolean`

Defined in: [server/zora/trendFunnel.ts:20](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/zora/trendFunnel.ts#L20)

##### maxNotionalWei

> **maxNotionalWei**: `bigint`

Defined in: [server/zora/trendFunnel.ts:21](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/zora/trendFunnel.ts#L21)

##### maxSlippageBps

> **maxSlippageBps**: `number`

Defined in: [server/zora/trendFunnel.ts:22](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/zora/trendFunnel.ts#L22)

##### routeabilityRequired

> **routeabilityRequired**: `boolean`

Defined in: [server/zora/trendFunnel.ts:23](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/zora/trendFunnel.ts#L23)

##### targetToken

> **targetToken**: `` `0x${string}` `` \| `null`

Defined in: [server/zora/trendFunnel.ts:24](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/zora/trendFunnel.ts#L24)

***

### TrendFunnelRunResult

> **TrendFunnelRunResult** = `object`

Defined in: [server/zora/trendFunnel.ts:39](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/zora/trendFunnel.ts#L39)

#### Properties

##### action

> **action**: `object`

Defined in: [server/zora/trendFunnel.ts:43](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/zora/trendFunnel.ts#L43)

###### amountInWei

> **amountInWei**: `string` \| `null`

###### executed

> **executed**: `boolean`

###### targetToken

> **targetToken**: `` `0x${string}` `` \| `null`

###### txHash

> **txHash**: `string` \| `null`

##### reason?

> `optional` **reason**: `string`

Defined in: [server/zora/trendFunnel.ts:41](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/zora/trendFunnel.ts#L41)

##### routeability

> **routeability**: [`TrendRouteabilityResult`](#trendrouteabilityresult)

Defined in: [server/zora/trendFunnel.ts:42](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/zora/trendFunnel.ts#L42)

##### status

> **status**: `"skipped_disabled"` \| `"skipped_guardrail"` \| `"blocked_routeability"` \| `"failed"` \| `"executed"`

Defined in: [server/zora/trendFunnel.ts:40](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/zora/trendFunnel.ts#L40)

***

### TrendRouteabilityResult

> **TrendRouteabilityResult** = `object`

Defined in: [server/zora/trendFunnel.ts:33](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/zora/trendFunnel.ts#L33)

#### Properties

##### buy

> **buy**: [`RouteabilityLeg`](#routeabilityleg)

Defined in: [server/zora/trendFunnel.ts:35](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/zora/trendFunnel.ts#L35)

##### passed

> **passed**: `boolean`

Defined in: [server/zora/trendFunnel.ts:34](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/zora/trendFunnel.ts#L34)

##### sell

> **sell**: [`RouteabilityLeg`](#routeabilityleg)

Defined in: [server/zora/trendFunnel.ts:36](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/zora/trendFunnel.ts#L36)

## Functions

### readTrendFunnelConfig()

> **readTrendFunnelConfig**(): [`TrendFunnelConfig`](#trendfunnelconfig)

Defined in: [server/zora/trendFunnel.ts:119](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/zora/trendFunnel.ts#L119)

#### Returns

[`TrendFunnelConfig`](#trendfunnelconfig)

***

### runTrendFunnel()

> **runTrendFunnel**(`params`): `Promise`\<[`TrendFunnelRunResult`](#trendfunnelrunresult)\>

Defined in: [server/zora/trendFunnel.ts:221](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/zora/trendFunnel.ts#L221)

#### Parameters

##### params

###### creatorToken

`` `0x${string}` ``

###### groupId

`string`

###### notionalWei?

`bigint`

###### ticker

`string`

###### tickerHash

`string`

###### trendCoinAddress

`` `0x${string}` ``

#### Returns

`Promise`\<[`TrendFunnelRunResult`](#trendfunnelrunresult)\>

***

### runTrendRouteabilityChecks()

> **runTrendRouteabilityChecks**(`params`): `Promise`\<[`TrendRouteabilityResult`](#trendrouteabilityresult)\>

Defined in: [server/zora/trendFunnel.ts:182](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/zora/trendFunnel.ts#L182)

#### Parameters

##### params

###### notionalWei

`bigint`

###### senderWallet

`` `0x${string}` ``

###### slippageBps

`number`

###### trendCoinAddress

`` `0x${string}` ``

#### Returns

`Promise`\<[`TrendRouteabilityResult`](#trendrouteabilityresult)\>
