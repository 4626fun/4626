[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / server/agent/eliza/\_taskQueue

# server/agent/eliza/\_taskQueue

## Type Aliases

### AgentBackgroundQueueStats

> **AgentBackgroundQueueStats** = `object`

Defined in: [server/agent/eliza/\_taskQueue.ts:194](https://github.com/wenakita/4626/blob/main/frontend/server/agent/eliza/_taskQueue.ts#L194)

#### Properties

##### done

> **done**: `number`

Defined in: [server/agent/eliza/\_taskQueue.ts:197](https://github.com/wenakita/4626/blob/main/frontend/server/agent/eliza/_taskQueue.ts#L197)

##### failed

> **failed**: `number`

Defined in: [server/agent/eliza/\_taskQueue.ts:198](https://github.com/wenakita/4626/blob/main/frontend/server/agent/eliza/_taskQueue.ts#L198)

##### pending

> **pending**: `number`

Defined in: [server/agent/eliza/\_taskQueue.ts:195](https://github.com/wenakita/4626/blob/main/frontend/server/agent/eliza/_taskQueue.ts#L195)

##### processing

> **processing**: `number`

Defined in: [server/agent/eliza/\_taskQueue.ts:196](https://github.com/wenakita/4626/blob/main/frontend/server/agent/eliza/_taskQueue.ts#L196)

##### staleProcessing

> **staleProcessing**: `number`

Defined in: [server/agent/eliza/\_taskQueue.ts:199](https://github.com/wenakita/4626/blob/main/frontend/server/agent/eliza/_taskQueue.ts#L199)

## Functions

### enqueueAgentBackgroundTask()

> **enqueueAgentBackgroundTask**(`input`): `Promise`\<`void`\>

Defined in: [server/agent/eliza/\_taskQueue.ts:65](https://github.com/wenakita/4626/blob/main/frontend/server/agent/eliza/_taskQueue.ts#L65)

#### Parameters

##### input

###### maxAttempts?

`number`

###### payload

`Record`\<`string`, `unknown`\>

###### priority?

`number`

###### runAfterMs?

`number`

###### taskType

`string`

#### Returns

`Promise`\<`void`\>

***

### getAgentBackgroundQueueStats()

> **getAgentBackgroundQueueStats**(`params?`): `Promise`\<[`AgentBackgroundQueueStats`](#agentbackgroundqueuestats)\>

Defined in: [server/agent/eliza/\_taskQueue.ts:212](https://github.com/wenakita/4626/blob/main/frontend/server/agent/eliza/_taskQueue.ts#L212)

#### Parameters

##### params?

###### staleLeaseMs?

`number`

#### Returns

`Promise`\<[`AgentBackgroundQueueStats`](#agentbackgroundqueuestats)\>

***

### startAgentBackgroundTaskWorker()

> **startAgentBackgroundTaskWorker**(`params`): `TaskWorker`

Defined in: [server/agent/eliza/\_taskQueue.ts:257](https://github.com/wenakita/4626/blob/main/frontend/server/agent/eliza/_taskQueue.ts#L257)

#### Parameters

##### params

###### handleTask

(`task`) => `Promise`\<`void`\>

###### maxTasksPerTick?

`number`

###### pollMs?

`number`

###### workerName

`string`

#### Returns

`TaskWorker`
