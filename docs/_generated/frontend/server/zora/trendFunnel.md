[**4626-app**](../../index.md)

***

[4626-app](../../index.md) / server/zora/trendFunnel

# server/zora/trendFunnel

## Type Aliases

### RouteabilityLeg

> **RouteabilityLeg** = `object`

Defined in: [server/zora/trendFunnel.ts:33](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/zora/trendFunnel.ts#L33)

#### Properties

##### error?

> `optional` **error**: `string`

Defined in: [server/zora/trendFunnel.ts:35](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/zora/trendFunnel.ts#L35)

##### ok

> **ok**: `boolean`

Defined in: [server/zora/trendFunnel.ts:34](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/zora/trendFunnel.ts#L34)

***

### TrendFunnelConfig

> **TrendFunnelConfig** = `object`

Defined in: [server/zora/trendFunnel.ts:23](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/zora/trendFunnel.ts#L23)

#### Properties

##### allowedTickers

> **allowedTickers**: `Set`\<`string`\> \| `null`

Defined in: [server/zora/trendFunnel.ts:30](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/zora/trendFunnel.ts#L30)

##### automationEnabled

> **automationEnabled**: `boolean`

Defined in: [server/zora/trendFunnel.ts:24](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/zora/trendFunnel.ts#L24)

##### flywheelEnabled

> **flywheelEnabled**: `boolean`

Defined in: [server/zora/trendFunnel.ts:25](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/zora/trendFunnel.ts#L25)

##### maxNotionalWei

> **maxNotionalWei**: `bigint`

Defined in: [server/zora/trendFunnel.ts:26](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/zora/trendFunnel.ts#L26)

##### maxSlippageBps

> **maxSlippageBps**: `number`

Defined in: [server/zora/trendFunnel.ts:27](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/zora/trendFunnel.ts#L27)

##### routeabilityRequired

> **routeabilityRequired**: `boolean`

Defined in: [server/zora/trendFunnel.ts:28](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/zora/trendFunnel.ts#L28)

##### targetToken

> **targetToken**: `` `0x${string}` `` \| `null`

Defined in: [server/zora/trendFunnel.ts:29](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/zora/trendFunnel.ts#L29)

***

### TrendFunnelRunResult

> **TrendFunnelRunResult** = `object`

Defined in: [server/zora/trendFunnel.ts:44](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/zora/trendFunnel.ts#L44)

#### Properties

##### action

> **action**: `object`

Defined in: [server/zora/trendFunnel.ts:48](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/zora/trendFunnel.ts#L48)

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

Defined in: [server/zora/trendFunnel.ts:46](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/zora/trendFunnel.ts#L46)

##### routeability

> **routeability**: [`TrendRouteabilityResult`](#trendrouteabilityresult)

Defined in: [server/zora/trendFunnel.ts:47](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/zora/trendFunnel.ts#L47)

##### status

> **status**: `"skipped_disabled"` \| `"skipped_guardrail"` \| `"blocked_routeability"` \| `"failed"` \| `"executed"`

Defined in: [server/zora/trendFunnel.ts:45](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/zora/trendFunnel.ts#L45)

***

### TrendRouteabilityResult

> **TrendRouteabilityResult** = `object`

Defined in: [server/zora/trendFunnel.ts:38](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/zora/trendFunnel.ts#L38)

#### Properties

##### buy

> **buy**: [`RouteabilityLeg`](#routeabilityleg)

Defined in: [server/zora/trendFunnel.ts:40](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/zora/trendFunnel.ts#L40)

##### passed

> **passed**: `boolean`

Defined in: [server/zora/trendFunnel.ts:39](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/zora/trendFunnel.ts#L39)

##### sell

> **sell**: [`RouteabilityLeg`](#routeabilityleg)

Defined in: [server/zora/trendFunnel.ts:41](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/zora/trendFunnel.ts#L41)

## Functions

### readTrendFunnelConfig()

> **readTrendFunnelConfig**(): [`TrendFunnelConfig`](#trendfunnelconfig)

Defined in: [server/zora/trendFunnel.ts:124](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/zora/trendFunnel.ts#L124)

#### Returns

[`TrendFunnelConfig`](#trendfunnelconfig)

***

### runTrendFunnel()

> **runTrendFunnel**(`params`): `Promise`\<[`TrendFunnelRunResult`](#trendfunnelrunresult)\>

Defined in: [server/zora/trendFunnel.ts:226](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/zora/trendFunnel.ts#L226)

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

Defined in: [server/zora/trendFunnel.ts:187](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/zora/trendFunnel.ts#L187)

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
