[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / server/\_lib/payments/x402Service

# server/\_lib/payments/x402Service

## Type Aliases

### X402PaymentGateResult

> **X402PaymentGateResult** = \{ `network`: `X402Network`; `paymentRequirements`: `PaymentRequirements`; `priceUsd`: `number`; `status`: `"missing"`; \} \| \{ `invalidReason`: `string`; `network`: `X402Network`; `paymentRequirements`: `PaymentRequirements`; `priceUsd`: `number`; `settlement?`: `SettleResponse`; `status`: `"invalid"`; `verification?`: `VerifyResponse`; \} \| \{ `network`: `X402Network`; `payer`: `string` \| `null`; `paymentRequirements`: `PaymentRequirements`; `priceUsd`: `number`; `settlement`: `SettleResponse`; `status`: `"paid"`; `verification`: `VerifyResponse`; \}

Defined in: [server/\_lib/payments/x402Service.ts:52](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/payments/x402Service.ts#L52)

***

### X402PaymentRequirementConfig

> **X402PaymentRequirementConfig** = `object`

Defined in: [server/\_lib/payments/x402Service.ts:42](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/payments/x402Service.ts#L42)

#### Properties

##### description

> **description**: `string`

Defined in: [server/\_lib/payments/x402Service.ts:45](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/payments/x402Service.ts#L45)

##### extra?

> `optional` **extra**: `Record`\<`string`, `unknown`\>

Defined in: [server/\_lib/payments/x402Service.ts:48](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/payments/x402Service.ts#L48)

##### mimeType?

> `optional` **mimeType**: `string`

Defined in: [server/\_lib/payments/x402Service.ts:46](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/payments/x402Service.ts#L46)

##### outputSchema?

> `optional` **outputSchema**: `Record`\<`string`, `unknown`\>

Defined in: [server/\_lib/payments/x402Service.ts:47](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/payments/x402Service.ts#L47)

##### priceUsd?

> `optional` **priceUsd**: `number` \| `string`

Defined in: [server/\_lib/payments/x402Service.ts:49](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/payments/x402Service.ts#L49)

##### req

> **req**: `VercelRequest`

Defined in: [server/\_lib/payments/x402Service.ts:43](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/payments/x402Service.ts#L43)

##### resourcePath

> **resourcePath**: `string`

Defined in: [server/\_lib/payments/x402Service.ts:44](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/payments/x402Service.ts#L44)

## Functions

### buildX402PaymentRequirements()

> **buildX402PaymentRequirements**(`config`): `object`

Defined in: [server/\_lib/payments/x402Service.ts:199](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/payments/x402Service.ts#L199)

#### Parameters

##### config

[`X402PaymentRequirementConfig`](#x402paymentrequirementconfig)

#### Returns

`object`

##### network

> **network**: `X402Network`

##### paymentRequirements

> **paymentRequirements**: `object`

##### priceUsd

> **priceUsd**: `number`

***

### evaluateX402Payment()

> **evaluateX402Payment**(`req`, `config`): `Promise`\<[`X402PaymentGateResult`](#x402paymentgateresult)\>

Defined in: [server/\_lib/payments/x402Service.ts:228](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/payments/x402Service.ts#L228)

#### Parameters

##### req

`VercelRequest`

##### config

[`X402PaymentRequirementConfig`](#x402paymentrequirementconfig)

#### Returns

`Promise`\<[`X402PaymentGateResult`](#x402paymentgateresult)\>

***

### sendPaymentRequiredResponse()

> **sendPaymentRequiredResponse**(`req`, `res`, `params`): `VercelResponse`

Defined in: [server/\_lib/payments/x402Service.ts:293](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/payments/x402Service.ts#L293)

#### Parameters

##### req

`VercelRequest`

##### res

`VercelResponse`

##### params

###### error?

`string`

###### network

`X402Network`

###### paymentRequirements

\{ \}

###### priceUsd

`number`

#### Returns

`VercelResponse`

***

### setSettlementResponseHeaders()

> **setSettlementResponseHeaders**(`res`, `settlement`): `void`

Defined in: [server/\_lib/payments/x402Service.ts:286](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/payments/x402Service.ts#L286)

#### Parameters

##### res

`VercelResponse`

##### settlement

#### Returns

`void`

***

### setX402CorsHeaders()

> **setX402CorsHeaders**(`res`): `void`

Defined in: [server/\_lib/payments/x402Service.ts:194](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/payments/x402Service.ts#L194)

#### Parameters

##### res

`VercelResponse`

#### Returns

`void`
