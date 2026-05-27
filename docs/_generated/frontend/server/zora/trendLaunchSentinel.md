[**4626-web**](../../index.md)

***

[4626-web](../../index.md) / server/zora/trendLaunchSentinel

# server/zora/trendLaunchSentinel

## Type Aliases

### TrendLaunchSentinelResult

> **TrendLaunchSentinelResult** = `object`

Defined in: [server/zora/trendLaunchSentinel.ts:18](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/zora/trendLaunchSentinel.ts#L18)

#### Properties

##### attempts

> **attempts**: `number`

Defined in: [server/zora/trendLaunchSentinel.ts:24](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/zora/trendLaunchSentinel.ts#L24)

##### deployedTickers

> **deployedTickers**: `string`[]

Defined in: [server/zora/trendLaunchSentinel.ts:25](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/zora/trendLaunchSentinel.ts#L25)

##### errors

> **errors**: `string`[]

Defined in: [server/zora/trendLaunchSentinel.ts:26](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/zora/trendLaunchSentinel.ts#L26)

##### fallbackUsed

> **fallbackUsed**: `boolean`

Defined in: [server/zora/trendLaunchSentinel.ts:21](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/zora/trendLaunchSentinel.ts#L21)

##### finishedAt

> **finishedAt**: `string`

Defined in: [server/zora/trendLaunchSentinel.ts:28](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/zora/trendLaunchSentinel.ts#L28)

##### iterations

> **iterations**: `number`

Defined in: [server/zora/trendLaunchSentinel.ts:23](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/zora/trendLaunchSentinel.ts#L23)

##### securedTicker

> **securedTicker**: `string` \| `null`

Defined in: [server/zora/trendLaunchSentinel.ts:20](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/zora/trendLaunchSentinel.ts#L20)

##### startedAt

> **startedAt**: `string`

Defined in: [server/zora/trendLaunchSentinel.ts:27](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/zora/trendLaunchSentinel.ts#L27)

##### status

> **status**: [`TrendLaunchSentinelStatus`](#trendlaunchsentinelstatus)

Defined in: [server/zora/trendLaunchSentinel.ts:19](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/zora/trendLaunchSentinel.ts#L19)

##### txHash

> **txHash**: `string` \| `null`

Defined in: [server/zora/trendLaunchSentinel.ts:22](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/zora/trendLaunchSentinel.ts#L22)

***

### TrendLaunchSentinelStatus

> **TrendLaunchSentinelStatus** = `"disabled"` \| `"misconfigured"` \| `"deadline_elapsed"` \| `"secured"` \| `"lost_all"` \| `"timed_out"` \| `"max_errors"`

Defined in: [server/zora/trendLaunchSentinel.ts:9](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/zora/trendLaunchSentinel.ts#L9)

## Functions

### runTrendLaunchSentinelProcess()

> **runTrendLaunchSentinelProcess**(`params?`): `Promise`\<[`TrendLaunchSentinelResult`](#trendlaunchsentinelresult)\>

Defined in: [server/zora/trendLaunchSentinel.ts:169](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/zora/trendLaunchSentinel.ts#L169)

#### Parameters

##### params?

###### deps?

`TrendLaunchSentinelDeps`

###### overrides?

`TrendLaunchSentinelOverrides`

#### Returns

`Promise`\<[`TrendLaunchSentinelResult`](#trendlaunchsentinelresult)\>
