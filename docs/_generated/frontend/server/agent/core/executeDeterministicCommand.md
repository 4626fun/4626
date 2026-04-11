[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / server/agent/core/executeDeterministicCommand

# server/agent/core/executeDeterministicCommand

## Type Aliases

### DeterministicCommandResult

> **DeterministicCommandResult** = `object`

Defined in: [server/agent/core/executeDeterministicCommand.ts:4](https://github.com/wenakita/4626/blob/main/frontend/server/agent/core/executeDeterministicCommand.ts#L4)

#### Properties

##### action?

> `optional` **action**: `unknown`

Defined in: [server/agent/core/executeDeterministicCommand.ts:8](https://github.com/wenakita/4626/blob/main/frontend/server/agent/core/executeDeterministicCommand.ts#L8)

##### ok

> **ok**: `boolean`

Defined in: [server/agent/core/executeDeterministicCommand.ts:5](https://github.com/wenakita/4626/blob/main/frontend/server/agent/core/executeDeterministicCommand.ts#L5)

##### rawResponseText

> **rawResponseText**: `string`

Defined in: [server/agent/core/executeDeterministicCommand.ts:7](https://github.com/wenakita/4626/blob/main/frontend/server/agent/core/executeDeterministicCommand.ts#L7)

##### responseText

> **responseText**: `string`

Defined in: [server/agent/core/executeDeterministicCommand.ts:6](https://github.com/wenakita/4626/blob/main/frontend/server/agent/core/executeDeterministicCommand.ts#L6)

## Functions

### executeDeterministicCommand()

> **executeDeterministicCommand**(`params`): `Promise`\<[`DeterministicCommandResult`](#deterministiccommandresult)\>

Defined in: [server/agent/core/executeDeterministicCommand.ts:35](https://github.com/wenakita/4626/blob/main/frontend/server/agent/core/executeDeterministicCommand.ts#L35)

#### Parameters

##### params

`ExecuteDeterministicCommandParams`

#### Returns

`Promise`\<[`DeterministicCommandResult`](#deterministiccommandresult)\>

***

### normalizeKeeprCommandResult()

> **normalizeKeeprCommandResult**(`params`): [`DeterministicCommandResult`](#deterministiccommandresult)

Defined in: [server/agent/core/executeDeterministicCommand.ts:21](https://github.com/wenakita/4626/blob/main/frontend/server/agent/core/executeDeterministicCommand.ts#L21)

#### Parameters

##### params

###### emptyResponseFallback?

`string`

###### result

[`KeeprCommandResult`](../../commands/types.md#keeprcommandresult) \| `null` \| `undefined`

#### Returns

[`DeterministicCommandResult`](#deterministiccommandresult)
