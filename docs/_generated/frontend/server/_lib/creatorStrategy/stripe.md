[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/creatorStrategy/stripe

# server/\_lib/creatorStrategy/stripe

## Type Aliases

### CreateCheckoutSessionInput

> **CreateCheckoutSessionInput** = `object`

Defined in: [server/\_lib/creatorStrategy/stripe.ts:87](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/stripe.ts#L87)

#### Properties

##### cancelUrl

> **cancelUrl**: `string`

Defined in: [server/\_lib/creatorStrategy/stripe.ts:95](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/stripe.ts#L95)

##### clientReferenceId?

> `optional` **clientReferenceId**: `string`

Defined in: [server/\_lib/creatorStrategy/stripe.ts:96](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/stripe.ts#L96)

##### creatorToken

> **creatorToken**: `` `0x${string}` ``

Defined in: [server/\_lib/creatorStrategy/stripe.ts:88](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/stripe.ts#L88)

##### featureDescription

> **featureDescription**: `string`

Defined in: [server/\_lib/creatorStrategy/stripe.ts:92](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/stripe.ts#L92)

##### featureDisplayName

> **featureDisplayName**: `string`

Defined in: [server/\_lib/creatorStrategy/stripe.ts:91](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/stripe.ts#L91)

##### featureKey

> **featureKey**: `string`

Defined in: [server/\_lib/creatorStrategy/stripe.ts:90](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/stripe.ts#L90)

##### priceUsdc

> **priceUsdc**: `bigint`

Defined in: [server/\_lib/creatorStrategy/stripe.ts:93](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/stripe.ts#L93)

##### successUrl

> **successUrl**: `string`

Defined in: [server/\_lib/creatorStrategy/stripe.ts:94](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/stripe.ts#L94)

##### walletAddress

> **walletAddress**: `` `0x${string}` ``

Defined in: [server/\_lib/creatorStrategy/stripe.ts:89](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/stripe.ts#L89)

***

### CreateCheckoutSessionResult

> **CreateCheckoutSessionResult** = `object`

Defined in: [server/\_lib/creatorStrategy/stripe.ts:99](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/stripe.ts#L99)

#### Properties

##### sessionId

> **sessionId**: `string`

Defined in: [server/\_lib/creatorStrategy/stripe.ts:100](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/stripe.ts#L100)

##### sessionUrl

> **sessionUrl**: `string`

Defined in: [server/\_lib/creatorStrategy/stripe.ts:101](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/stripe.ts#L101)

##### unitAmountCents

> **unitAmountCents**: `number`

Defined in: [server/\_lib/creatorStrategy/stripe.ts:102](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/stripe.ts#L102)

***

### VerifyWebhookResult

> **VerifyWebhookResult** = \{ `event`: `Stripe.Event`; `ok`: `true`; \} \| \{ `message`: `string`; `ok`: `false`; `reason`: `"missing_signature"` \| `"webhook_not_configured"` \| `"signature_invalid"`; \}

Defined in: [server/\_lib/creatorStrategy/stripe.ts:161](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/stripe.ts#L161)

Verify + parse a Stripe webhook request. Returns the typed event or
a structured failure so the handler can reply with the right status
code.

## Functions

### createCheckoutSession()

> **createCheckoutSession**(`input`): `Promise`\<[`CreateCheckoutSessionResult`](#createcheckoutsessionresult)\>

Defined in: [server/\_lib/creatorStrategy/stripe.ts:110](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/stripe.ts#L110)

Wraps Stripe SDK's `checkout.sessions.create`. Keeps all
4626-specific metadata on the session so the webhook can resolve it
back to the right activation row without a second DB call.

#### Parameters

##### input

[`CreateCheckoutSessionInput`](#createcheckoutsessioninput)

#### Returns

`Promise`\<[`CreateCheckoutSessionResult`](#createcheckoutsessionresult)\>

***

### getStripeClient()

> **getStripeClient**(): `Promise`\<`Stripe`\>

Defined in: [server/\_lib/creatorStrategy/stripe.ts:53](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/stripe.ts#L53)

Lazily instantiate the Stripe client so the module is safe to import
in contexts where Stripe env isn't set (local dev, tests). Throws
with a clear message when the caller actually uses it without
configuration.

#### Returns

`Promise`\<`Stripe`\>

***

### isStripeConfigured()

> **isStripeConfigured**(): `boolean`

Defined in: [server/\_lib/creatorStrategy/stripe.ts:36](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/stripe.ts#L36)

#### Returns

`boolean`

***

### isStripeWebhookConfigured()

> **isStripeWebhookConfigured**(): `boolean`

Defined in: [server/\_lib/creatorStrategy/stripe.ts:40](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/stripe.ts#L40)

#### Returns

`boolean`

***

### usdcToStripeUnitAmount()

> **usdcToStripeUnitAmount**(`priceUsdc`): `number`

Defined in: [server/\_lib/creatorStrategy/stripe.ts:77](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/stripe.ts#L77)

Convert a USDC-denominated price (6 decimals) into Stripe's expected
unit-amount (USD cents, integer). We assume USDC ≈ USD for pricing
purposes — the $0.001–0.01 depeg risk is acceptable for a $100 item.

#### Parameters

##### priceUsdc

`bigint`

#### Returns

`number`

***

### verifyStripeWebhook()

> **verifyStripeWebhook**(`rawBody`, `signatureHeader`): `Promise`\<[`VerifyWebhookResult`](#verifywebhookresult)\>

Defined in: [server/\_lib/creatorStrategy/stripe.ts:165](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/stripe.ts#L165)

#### Parameters

##### rawBody

`string` | `Buffer`\<`ArrayBufferLike`\>

##### signatureHeader

`string` | `undefined`

#### Returns

`Promise`\<[`VerifyWebhookResult`](#verifywebhookresult)\>
