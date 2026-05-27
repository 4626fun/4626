[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/controlPlane/metrics

# server/\_lib/controlPlane/metrics

## Type Aliases

### ControlPlaneMetricEvent

> **ControlPlaneMetricEvent** = `object`

Defined in: [server/\_lib/controlPlane/metrics.ts:1](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/controlPlane/metrics.ts#L1)

#### Properties

##### chainId?

> `optional` **chainId**: `number` \| `null`

Defined in: [server/\_lib/controlPlane/metrics.ts:6](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/controlPlane/metrics.ts#L6)

##### durationMs?

> `optional` **durationMs**: `number` \| `null`

Defined in: [server/\_lib/controlPlane/metrics.ts:8](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/controlPlane/metrics.ts#L8)

##### idempotencyKey?

> `optional` **idempotencyKey**: `string` \| `null`

Defined in: [server/\_lib/controlPlane/metrics.ts:12](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/controlPlane/metrics.ts#L12)

##### jobId?

> `optional` **jobId**: `number` \| `null`

Defined in: [server/\_lib/controlPlane/metrics.ts:11](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/controlPlane/metrics.ts#L11)

##### metric

> **metric**: `"control_plane.operation.status"` \| `"control_plane.stage.status"` \| `"control_plane.job.status"`

Defined in: [server/\_lib/controlPlane/metrics.ts:2](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/controlPlane/metrics.ts#L2)

##### operationId?

> `optional` **operationId**: `string` \| `null`

Defined in: [server/\_lib/controlPlane/metrics.ts:9](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/controlPlane/metrics.ts#L9)

##### operationKind?

> `optional` **operationKind**: `string` \| `null`

Defined in: [server/\_lib/controlPlane/metrics.ts:3](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/controlPlane/metrics.ts#L3)

##### scopeId?

> `optional` **scopeId**: `string` \| `null`

Defined in: [server/\_lib/controlPlane/metrics.ts:13](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/controlPlane/metrics.ts#L13)

##### stageId?

> `optional` **stageId**: `string` \| `null`

Defined in: [server/\_lib/controlPlane/metrics.ts:10](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/controlPlane/metrics.ts#L10)

##### stageKind?

> `optional` **stageKind**: `string` \| `null`

Defined in: [server/\_lib/controlPlane/metrics.ts:4](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/controlPlane/metrics.ts#L4)

##### status

> **status**: `string`

Defined in: [server/\_lib/controlPlane/metrics.ts:5](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/controlPlane/metrics.ts#L5)

##### workerKind?

> `optional` **workerKind**: `string` \| `null`

Defined in: [server/\_lib/controlPlane/metrics.ts:7](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/controlPlane/metrics.ts#L7)

## Functions

### emitControlPlaneMetric()

> **emitControlPlaneMetric**(`event`): `void`

Defined in: [server/\_lib/controlPlane/metrics.ts:16](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/controlPlane/metrics.ts#L16)

#### Parameters

##### event

[`ControlPlaneMetricEvent`](#controlplanemetricevent)

#### Returns

`void`
