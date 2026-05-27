[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/agents/eliza/\_healthStatus

# server/agents/eliza/\_healthStatus

## Type Aliases

### HealthProbePath

> **HealthProbePath** = `"/healthz"` \| `"/readyz"`

Defined in: [server/agents/eliza/\_healthStatus.ts:1](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/agents/eliza/_healthStatus.ts#L1)

## Functions

### getHealthProbeStatusCode()

> **getHealthProbeStatusCode**(`args`): `number`

Defined in: [server/agents/eliza/\_healthStatus.ts:16](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/agents/eliza/_healthStatus.ts#L16)

/healthz is liveness for container orchestrators.
/readyz is strict readiness for traffic routing and monitoring.

#### Parameters

##### args

`HealthStatusArgs`

#### Returns

`number`
