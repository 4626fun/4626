[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/lib/aa/coinbaseErc4337Telemetry

# src/lib/aa/coinbaseErc4337Telemetry

## Type Aliases

### UserOpSubmissionPath

> **UserOpSubmissionPath** = `"eth_sendUserOperation"` \| `"wallet_sendCalls"`

Defined in: [src/lib/aa/coinbaseErc4337Telemetry.ts:16](https://github.com/wenakita/4626/blob/main/frontend/src/lib/aa/coinbaseErc4337Telemetry.ts#L16)

***

### UserOpTelemetrySample

> **UserOpTelemetrySample** = `object`

Defined in: [src/lib/aa/coinbaseErc4337Telemetry.ts:18](https://github.com/wenakita/4626/blob/main/frontend/src/lib/aa/coinbaseErc4337Telemetry.ts#L18)

#### Properties

##### approvalAttempt?

> `optional` **approvalAttempt**: `number` \| `null`

Defined in: [src/lib/aa/coinbaseErc4337Telemetry.ts:28](https://github.com/wenakita/4626/blob/main/frontend/src/lib/aa/coinbaseErc4337Telemetry.ts#L28)

##### approvalRunId?

> `optional` **approvalRunId**: `string` \| `null`

Defined in: [src/lib/aa/coinbaseErc4337Telemetry.ts:25](https://github.com/wenakita/4626/blob/main/frontend/src/lib/aa/coinbaseErc4337Telemetry.ts#L25)

##### approvalStage?

> `optional` **approvalStage**: `string` \| `null`

Defined in: [src/lib/aa/coinbaseErc4337Telemetry.ts:26](https://github.com/wenakita/4626/blob/main/frontend/src/lib/aa/coinbaseErc4337Telemetry.ts#L26)

##### durationMs

> **durationMs**: `number`

Defined in: [src/lib/aa/coinbaseErc4337Telemetry.ts:20](https://github.com/wenakita/4626/blob/main/frontend/src/lib/aa/coinbaseErc4337Telemetry.ts#L20)

##### errorCode?

> `optional` **errorCode**: `string` \| `null`

Defined in: [src/lib/aa/coinbaseErc4337Telemetry.ts:29](https://github.com/wenakita/4626/blob/main/frontend/src/lib/aa/coinbaseErc4337Telemetry.ts#L29)

##### executionMode?

> `optional` **executionMode**: `string` \| `null`

Defined in: [src/lib/aa/coinbaseErc4337Telemetry.ts:27](https://github.com/wenakita/4626/blob/main/frontend/src/lib/aa/coinbaseErc4337Telemetry.ts#L27)

##### ownerIsContract

> **ownerIsContract**: `boolean`

Defined in: [src/lib/aa/coinbaseErc4337Telemetry.ts:24](https://github.com/wenakita/4626/blob/main/frontend/src/lib/aa/coinbaseErc4337Telemetry.ts#L24)

##### paymasterMode

> **paymasterMode**: `"sponsored"` \| `"self_funded"` \| `"fallback_to_self_funded"`

Defined in: [src/lib/aa/coinbaseErc4337Telemetry.ts:22](https://github.com/wenakita/4626/blob/main/frontend/src/lib/aa/coinbaseErc4337Telemetry.ts#L22)

##### signatureMode

> **signatureMode**: `"eth_sign"` \| `"signMessage"` \| `"auto"`

Defined in: [src/lib/aa/coinbaseErc4337Telemetry.ts:23](https://github.com/wenakita/4626/blob/main/frontend/src/lib/aa/coinbaseErc4337Telemetry.ts#L23)

##### status

> **status**: `"success"` \| `"error"` \| `"timeout"`

Defined in: [src/lib/aa/coinbaseErc4337Telemetry.ts:19](https://github.com/wenakita/4626/blob/main/frontend/src/lib/aa/coinbaseErc4337Telemetry.ts#L19)

##### submissionPath?

> `optional` **submissionPath**: [`UserOpSubmissionPath`](#useropsubmissionpath)

Defined in: [src/lib/aa/coinbaseErc4337Telemetry.ts:35](https://github.com/wenakita/4626/blob/main/frontend/src/lib/aa/coinbaseErc4337Telemetry.ts#L35)

Which submission path produced this sample. Defaults to
'eth_sendUserOperation' when unset for backward compatibility with legacy
call sites in coinbaseErc4337.ts.

##### verificationGasLimit

> **verificationGasLimit**: `string` \| `null`

Defined in: [src/lib/aa/coinbaseErc4337Telemetry.ts:21](https://github.com/wenakita/4626/blob/main/frontend/src/lib/aa/coinbaseErc4337Telemetry.ts#L21)

## Functions

### recordUserOpTelemetry()

> **recordUserOpTelemetry**(`sample`): `void`

Defined in: [src/lib/aa/coinbaseErc4337Telemetry.ts:166](https://github.com/wenakita/4626/blob/main/frontend/src/lib/aa/coinbaseErc4337Telemetry.ts#L166)

#### Parameters

##### sample

[`UserOpTelemetrySample`](#useroptelemetrysample)

#### Returns

`void`
