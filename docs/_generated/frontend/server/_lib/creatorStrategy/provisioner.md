[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / server/\_lib/creatorStrategy/provisioner

# server/\_lib/creatorStrategy/provisioner

## Type Aliases

### ProvisioningRequest

> **ProvisioningRequest** = `object`

Defined in: [server/\_lib/creatorStrategy/provisioner.ts:41](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/provisioner.ts#L41)

#### Properties

##### activationId

> **activationId**: `number`

Defined in: [server/\_lib/creatorStrategy/provisioner.ts:44](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/provisioner.ts#L44)

##### creatorToken

> **creatorToken**: `Address`

Defined in: [server/\_lib/creatorStrategy/provisioner.ts:42](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/provisioner.ts#L42)

##### featureKey

> **featureKey**: `string`

Defined in: [server/\_lib/creatorStrategy/provisioner.ts:43](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/provisioner.ts#L43)

##### paymentRef

> **paymentRef**: `string` \| `null`

Defined in: [server/\_lib/creatorStrategy/provisioner.ts:48](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/provisioner.ts#L48)

Free-form id to correlate with payment receipt in support triage.

##### paymentSource

> **paymentSource**: `string`

Defined in: [server/\_lib/creatorStrategy/provisioner.ts:46](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/provisioner.ts#L46)

'stripe' | 'x402_base' | 'usdc_base'

***

### ProvisioningResult

> **ProvisioningResult** = \{ `note`: `string`; `ok`: `true`; `outcome`: `"enqueued"` \| `"executed"`; `ref`: `string` \| `null`; \} \| \{ `message`: `string`; `ok`: `false`; `reason`: `"unknown_feature"` \| `"not_yet_automated"` \| `"automation_failed"`; \}

Defined in: [server/\_lib/creatorStrategy/provisioner.ts:51](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/provisioner.ts#L51)

#### Type Declaration

\{ `note`: `string`; `ok`: `true`; `outcome`: `"enqueued"` \| `"executed"`; `ref`: `string` \| `null`; \}

##### note

> **note**: `string`

Free-form human-readable next step for the operator.

##### ok

> **ok**: `true`

##### outcome

> **outcome**: `"enqueued"` \| `"executed"`

##### ref

> **ref**: `string` \| `null`

Job id / tx hash / Solana sig, etc. Stored in `provisioner_ref`.

\{ `message`: `string`; `ok`: `false`; `reason`: `"unknown_feature"` \| `"not_yet_automated"` \| `"automation_failed"`; \}

##### message

> **message**: `string`

##### ok

> **ok**: `false`

##### reason

> **reason**: `"unknown_feature"` \| `"not_yet_automated"` \| `"automation_failed"`

## Functions

### dispatchProvisioning()

> **dispatchProvisioning**(`request`): `Promise`\<[`ProvisioningResult`](#provisioningresult)\>

Defined in: [server/\_lib/creatorStrategy/provisioner.ts:76](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/provisioner.ts#L76)

Entrypoint — called from payment-confirming handlers after the
activation row is inserted / finalized.

Today: logs intent + returns `{ ok: true, outcome: 'enqueued', ref: null }`
so callers can safely proceed. Each feature gets routed below; any new
feature not in the switch falls through to `not_yet_automated` which
is explicitly treated as non-fatal by the webhook (operator picks up
the row manually).

#### Parameters

##### request

[`ProvisioningRequest`](#provisioningrequest)

#### Returns

`Promise`\<[`ProvisioningResult`](#provisioningresult)\>

***

### listManualProvisioningFeatures()

> **listManualProvisioningFeatures**(): `object`[]

Defined in: [server/\_lib/creatorStrategy/provisioner.ts:165](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/provisioner.ts#L165)

Helper exposed for tests + the operator dashboard — returns the list
of features whose provisioning is still entirely manual (so operators
know what to watch for).

#### Returns

`object`[]
