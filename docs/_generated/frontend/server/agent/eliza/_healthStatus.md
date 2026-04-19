[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / server/agent/eliza/\_healthStatus

# server/agent/eliza/\_healthStatus

## Type Aliases

### HealthProbePath

> **HealthProbePath** = `"/healthz"` \| `"/readyz"`

Defined in: [server/agent/eliza/\_healthStatus.ts:1](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/agent/eliza/_healthStatus.ts#L1)

## Functions

### getHealthProbeStatusCode()

> **getHealthProbeStatusCode**(`args`): `number`

Defined in: [server/agent/eliza/\_healthStatus.ts:15](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/agent/eliza/_healthStatus.ts#L15)

/healthz is liveness for container orchestrators.
/readyz is strict readiness for traffic routing and monitoring.

#### Parameters

##### args

`HealthStatusArgs`

#### Returns

`number`
