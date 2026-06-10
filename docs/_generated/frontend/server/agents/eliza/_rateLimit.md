[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/agents/eliza/\_rateLimit

# server/agents/eliza/\_rateLimit

## Classes

### DailyBudgetGuard

Defined in: [server/agents/eliza/\_rateLimit.ts:96](https://github.com/wenakita/4626/blob/main/frontend/server/agents/eliza/_rateLimit.ts#L96)

#### Constructors

##### Constructor

> **new DailyBudgetGuard**(`tokenBudget`, `usdBudget`): [`DailyBudgetGuard`](#dailybudgetguard)

Defined in: [server/agents/eliza/\_rateLimit.ts:101](https://github.com/wenakita/4626/blob/main/frontend/server/agents/eliza/_rateLimit.ts#L101)

###### Parameters

###### tokenBudget

`number` | `null`

###### usdBudget

`number` | `null`

###### Returns

[`DailyBudgetGuard`](#dailybudgetguard)

#### Methods

##### canConsume()

> **canConsume**(`key`, `usage`, `now`): `object`

Defined in: [server/agents/eliza/\_rateLimit.ts:106](https://github.com/wenakita/4626/blob/main/frontend/server/agents/eliza/_rateLimit.ts#L106)

###### Parameters

###### key

`string`

###### usage

###### estimatedUsd?

`number`

###### inputTokens?

`number`

###### outputTokens?

`number`

###### now

`number` = `...`

###### Returns

`object`

###### allowed

> **allowed**: `boolean`

###### reason?

> `optional` **reason**: `"token_budget"` \| `"usd_budget"`

##### getSnapshot()

> **getSnapshot**(`key`, `now`): `DailyUsage`

Defined in: [server/agents/eliza/\_rateLimit.ts:143](https://github.com/wenakita/4626/blob/main/frontend/server/agents/eliza/_rateLimit.ts#L143)

###### Parameters

###### key

`string`

###### now

`number` = `...`

###### Returns

`DailyUsage`

##### record()

> **record**(`key`, `usage`, `now`): `DailyUsage`

Defined in: [server/agents/eliza/\_rateLimit.ts:127](https://github.com/wenakita/4626/blob/main/frontend/server/agents/eliza/_rateLimit.ts#L127)

###### Parameters

###### key

`string`

###### usage

###### estimatedUsd?

`number`

###### inputTokens?

`number`

###### outputTokens?

`number`

###### now

`number` = `...`

###### Returns

`DailyUsage`

***

### SlidingWindowRateLimiter

Defined in: [server/agents/eliza/\_rateLimit.ts:12](https://github.com/wenakita/4626/blob/main/frontend/server/agents/eliza/_rateLimit.ts#L12)

#### Constructors

##### Constructor

> **new SlidingWindowRateLimiter**(`windowMs`, `maxEvents`, `options`): [`SlidingWindowRateLimiter`](#slidingwindowratelimiter)

Defined in: [server/agents/eliza/\_rateLimit.ts:19](https://github.com/wenakita/4626/blob/main/frontend/server/agents/eliza/_rateLimit.ts#L19)

###### Parameters

###### windowMs

`number`

###### maxEvents

`number`

###### options

`SlidingWindowRateLimiterOptions` = `{}`

###### Returns

[`SlidingWindowRateLimiter`](#slidingwindowratelimiter)

#### Methods

##### allow()

> **allow**(`key`, `now`): `AllowResult`

Defined in: [server/agents/eliza/\_rateLimit.ts:55](https://github.com/wenakita/4626/blob/main/frontend/server/agents/eliza/_rateLimit.ts#L55)

###### Parameters

###### key

`string`

###### now

`number` = `...`

###### Returns

`AllowResult`

##### getDebugState()

> **getDebugState**(): `object`

Defined in: [server/agents/eliza/\_rateLimit.ts:81](https://github.com/wenakita/4626/blob/main/frontend/server/agents/eliza/_rateLimit.ts#L81)

###### Returns

`object`

###### keys

> **keys**: `string`[]

###### trackedKeys

> **trackedKeys**: `number`

## Functions

### parsePositiveNumber()

> **parsePositiveNumber**(`raw`, `fallback`): `number`

Defined in: [server/agents/eliza/\_rateLimit.ts:160](https://github.com/wenakita/4626/blob/main/frontend/server/agents/eliza/_rateLimit.ts#L160)

#### Parameters

##### raw

`string` | `undefined`

##### fallback

`number`

#### Returns

`number`
