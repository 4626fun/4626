[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / server/\_lib/agentControl/replay

# server/\_lib/agentControl/replay

## Type Aliases

### ReplayGuard

> **ReplayGuard** = `object`

Defined in: [server/\_lib/agentControl/replay.ts:3](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/agentControl/replay.ts#L3)

#### Properties

##### isReplay()

> **isReplay**: (`replayKey`) => `boolean`

Defined in: [server/\_lib/agentControl/replay.ts:4](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/agentControl/replay.ts#L4)

###### Parameters

###### replayKey

`string`

###### Returns

`boolean`

## Functions

### createStaticReplayGuard()

> **createStaticReplayGuard**(`values`): [`ReplayGuard`](#replayguard)

Defined in: [server/\_lib/agentControl/replay.ts:17](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/agentControl/replay.ts#L17)

#### Parameters

##### values

`Iterable`\<`string`\>

#### Returns

[`ReplayGuard`](#replayguard)

***

### normalizeReplayKeys()

> **normalizeReplayKeys**(`values`): `string`[]

Defined in: [server/\_lib/agentControl/replay.ts:7](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/agentControl/replay.ts#L7)

#### Parameters

##### values

(`string` \| `null` \| `undefined`)[]

#### Returns

`string`[]
