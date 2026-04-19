[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / server/\_lib/agent/agentRegistrationPublisher

# server/\_lib/agent/agentRegistrationPublisher

## Type Aliases

### PublishAgentRegistrationResult

> **PublishAgentRegistrationResult** = \{ `gatewayUrl`: `string`; `lensUri`: `string`; `mode`: [`RegistrationPublishMode`](#registrationpublishmode); `ok`: `true`; `payloadHash`: `string`; `pipeline`: [`RegistrationPublishPipeline`](#registrationpublishpipeline); `status`: `"reused"` \| `"stored"`; `storageKey`: `string` \| `null`; \} \| \{ `error?`: `string`; `mode`: [`RegistrationPublishMode`](#registrationpublishmode); `ok`: `false`; `payloadHash`: `string`; `pipeline`: [`RegistrationPublishPipeline`](#registrationpublishpipeline); `status`: `"skipped"` \| `"unavailable"`; \}

Defined in: [server/\_lib/agent/agentRegistrationPublisher.ts:19](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/agent/agentRegistrationPublisher.ts#L19)

***

### RegistrationPublishMode

> **RegistrationPublishMode** = `"on-change"` \| `"always"` \| `"off"`

Defined in: [server/\_lib/agent/agentRegistrationPublisher.ts:16](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/agent/agentRegistrationPublisher.ts#L16)

***

### RegistrationPublishPipeline

> **RegistrationPublishPipeline** = `"mutable"` \| `"immutable"`

Defined in: [server/\_lib/agent/agentRegistrationPublisher.ts:17](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/agent/agentRegistrationPublisher.ts#L17)

## Functions

### publishAgentRegistrationToGrove()

> **publishAgentRegistrationToGrove**(`params`): `Promise`\<[`PublishAgentRegistrationResult`](#publishagentregistrationresult)\>

Defined in: [server/\_lib/agent/agentRegistrationPublisher.ts:103](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/agent/agentRegistrationPublisher.ts#L103)

#### Parameters

##### params

###### agentKey

`string`

###### mode?

[`RegistrationPublishMode`](#registrationpublishmode)

###### payload

[`RegistrationFile`](agentRegistration.md#registrationfile)

#### Returns

`Promise`\<[`PublishAgentRegistrationResult`](#publishagentregistrationresult)\>

***

### resolveAgentRegistrationKey()

> **resolveAgentRegistrationKey**(`payload`, `fallback`): `string`

Defined in: [server/\_lib/agent/agentRegistrationPublisher.ts:83](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/agent/agentRegistrationPublisher.ts#L83)

#### Parameters

##### payload

[`RegistrationFile`](agentRegistration.md#registrationfile)

##### fallback

`string` = `'single-agent'`

#### Returns

`string`
