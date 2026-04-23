[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / server/agent/eliza/\_healthStatus

# server/agent/eliza/\_healthStatus

## Type Aliases

### HealthProbePath

> **HealthProbePath** = `"/healthz"` \| `"/readyz"`

Defined in: [server/agent/eliza/\_healthStatus.ts:1](https://github.com/wenakita/4626/blob/main/frontend/server/agent/eliza/_healthStatus.ts#L1)

## Functions

### getHealthProbeStatusCode()

> **getHealthProbeStatusCode**(`args`): `number`

Defined in: [server/agent/eliza/\_healthStatus.ts:16](https://github.com/wenakita/4626/blob/main/frontend/server/agent/eliza/_healthStatus.ts#L16)

/healthz is liveness for container orchestrators.
/readyz is strict readiness for traffic routing and monitoring.

#### Parameters

##### args

`HealthStatusArgs`

#### Returns

`number`
