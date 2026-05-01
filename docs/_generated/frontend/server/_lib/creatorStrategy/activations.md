[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / server/\_lib/creatorStrategy/activations

# server/\_lib/creatorStrategy/activations

## Type Aliases

### CreatorStrategyFeatureDto

> **CreatorStrategyFeatureDto** = `object`

Defined in: [server/\_lib/creatorStrategy/activations.ts:366](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/activations.ts#L366)

Public-safe DTO for the API `/api/creator/strategy/activations` endpoint.
Hides internal IDs and keeps bigints as strings.

#### Properties

##### createdAt

> **createdAt**: `string`

Defined in: [server/\_lib/creatorStrategy/activations.ts:378](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/activations.ts#L378)

##### creatorToken

> **creatorToken**: `Address`

Defined in: [server/\_lib/creatorStrategy/activations.ts:367](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/activations.ts#L367)

##### failedAt

> **failedAt**: `string` \| `null`

Defined in: [server/\_lib/creatorStrategy/activations.ts:374](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/activations.ts#L374)

##### failureReason

> **failureReason**: `string` \| `null`

Defined in: [server/\_lib/creatorStrategy/activations.ts:376](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/activations.ts#L376)

##### featureKey

> **featureKey**: `string`

Defined in: [server/\_lib/creatorStrategy/activations.ts:368](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/activations.ts#L368)

##### paymentTxHash

> **paymentTxHash**: `Hex` \| `null`

Defined in: [server/\_lib/creatorStrategy/activations.ts:371](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/activations.ts#L371)

##### paymentVerifiedAt

> **paymentVerifiedAt**: `string` \| `null`

Defined in: [server/\_lib/creatorStrategy/activations.ts:372](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/activations.ts#L372)

##### priceUsdcPaid

> **priceUsdcPaid**: `string`

Defined in: [server/\_lib/creatorStrategy/activations.ts:370](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/activations.ts#L370)

##### provisionedAt

> **provisionedAt**: `string` \| `null`

Defined in: [server/\_lib/creatorStrategy/activations.ts:373](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/activations.ts#L373)

##### provisionerRef

> **provisionerRef**: `string` \| `null`

Defined in: [server/\_lib/creatorStrategy/activations.ts:377](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/activations.ts#L377)

##### refundedAt

> **refundedAt**: `string` \| `null`

Defined in: [server/\_lib/creatorStrategy/activations.ts:375](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/activations.ts#L375)

##### status

> **status**: [`CreatorStrategyFeatureStatus`](#creatorstrategyfeaturestatus)

Defined in: [server/\_lib/creatorStrategy/activations.ts:369](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/activations.ts#L369)

##### updatedAt

> **updatedAt**: `string`

Defined in: [server/\_lib/creatorStrategy/activations.ts:379](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/activations.ts#L379)

***

### CreatorStrategyFeatureRow

> **CreatorStrategyFeatureRow** = `object`

Defined in: [server/\_lib/creatorStrategy/activations.ts:18](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/activations.ts#L18)

#### Properties

##### createdAt

> **createdAt**: `string`

Defined in: [server/\_lib/creatorStrategy/activations.ts:34](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/activations.ts#L34)

##### creatorToken

> **creatorToken**: `Address`

Defined in: [server/\_lib/creatorStrategy/activations.ts:20](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/activations.ts#L20)

##### failedAt

> **failedAt**: `string` \| `null`

Defined in: [server/\_lib/creatorStrategy/activations.ts:29](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/activations.ts#L29)

##### failureReason

> **failureReason**: `string` \| `null`

Defined in: [server/\_lib/creatorStrategy/activations.ts:32](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/activations.ts#L32)

##### featureKey

> **featureKey**: `string`

Defined in: [server/\_lib/creatorStrategy/activations.ts:21](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/activations.ts#L21)

##### id

> **id**: `number`

Defined in: [server/\_lib/creatorStrategy/activations.ts:19](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/activations.ts#L19)

##### metadata

> **metadata**: `Record`\<`string`, `unknown`\>

Defined in: [server/\_lib/creatorStrategy/activations.ts:33](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/activations.ts#L33)

##### paymentFrom

> **paymentFrom**: `Address` \| `null`

Defined in: [server/\_lib/creatorStrategy/activations.ts:25](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/activations.ts#L25)

##### paymentTo

> **paymentTo**: `Address` \| `null`

Defined in: [server/\_lib/creatorStrategy/activations.ts:26](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/activations.ts#L26)

##### paymentTxHash

> **paymentTxHash**: `Hex` \| `null`

Defined in: [server/\_lib/creatorStrategy/activations.ts:24](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/activations.ts#L24)

##### paymentVerifiedAt

> **paymentVerifiedAt**: `string` \| `null`

Defined in: [server/\_lib/creatorStrategy/activations.ts:27](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/activations.ts#L27)

##### priceUsdcPaid

> **priceUsdcPaid**: `bigint`

Defined in: [server/\_lib/creatorStrategy/activations.ts:23](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/activations.ts#L23)

##### provisionedAt

> **provisionedAt**: `string` \| `null`

Defined in: [server/\_lib/creatorStrategy/activations.ts:28](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/activations.ts#L28)

##### provisionerRef

> **provisionerRef**: `string` \| `null`

Defined in: [server/\_lib/creatorStrategy/activations.ts:31](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/activations.ts#L31)

##### refundedAt

> **refundedAt**: `string` \| `null`

Defined in: [server/\_lib/creatorStrategy/activations.ts:30](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/activations.ts#L30)

##### status

> **status**: [`CreatorStrategyFeatureStatus`](#creatorstrategyfeaturestatus)

Defined in: [server/\_lib/creatorStrategy/activations.ts:22](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/activations.ts#L22)

##### updatedAt

> **updatedAt**: `string`

Defined in: [server/\_lib/creatorStrategy/activations.ts:35](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/activations.ts#L35)

***

### CreatorStrategyFeatureStatus

> **CreatorStrategyFeatureStatus** = `"pending"` \| `"active"` \| `"failed"` \| `"refunded"`

Defined in: [server/\_lib/creatorStrategy/activations.ts:16](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/activations.ts#L16)

***

### FinalizeStripeCheckoutInput

> **FinalizeStripeCheckoutInput** = `object`

Defined in: [server/\_lib/creatorStrategy/activations.ts:171](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/activations.ts#L171)

#### Properties

##### paymentVerifiedAt

> **paymentVerifiedAt**: `Date`

Defined in: [server/\_lib/creatorStrategy/activations.ts:177](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/activations.ts#L177)

##### priceUsdcPaid

> **priceUsdcPaid**: `bigint`

Defined in: [server/\_lib/creatorStrategy/activations.ts:173](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/activations.ts#L173)

##### stripeChargeId

> **stripeChargeId**: `string` \| `null`

Defined in: [server/\_lib/creatorStrategy/activations.ts:176](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/activations.ts#L176)

##### stripeCheckoutSessionId

> **stripeCheckoutSessionId**: `string`

Defined in: [server/\_lib/creatorStrategy/activations.ts:172](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/activations.ts#L172)

##### stripePaymentIntentId

> **stripePaymentIntentId**: `string` \| `null`

Defined in: [server/\_lib/creatorStrategy/activations.ts:175](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/activations.ts#L175)

##### walletAddress

> **walletAddress**: `Address`

Defined in: [server/\_lib/creatorStrategy/activations.ts:174](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/activations.ts#L174)

***

### FinalizeStripeCheckoutResult

> **FinalizeStripeCheckoutResult** = \{ `ok`: `true`; `row`: [`CreatorStrategyFeatureRow`](#creatorstrategyfeaturerow); \} \| \{ `message`: `string`; `ok`: `false`; `reason`: `"session_not_found"` \| `"db_error"`; \}

Defined in: [server/\_lib/creatorStrategy/activations.ts:180](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/activations.ts#L180)

***

### InsertActivationInput

> **InsertActivationInput** = `object`

Defined in: [server/\_lib/creatorStrategy/activations.ts:131](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/activations.ts#L131)

#### Properties

##### creatorToken

> **creatorToken**: `Address`

Defined in: [server/\_lib/creatorStrategy/activations.ts:132](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/activations.ts#L132)

##### featureKey

> **featureKey**: `string`

Defined in: [server/\_lib/creatorStrategy/activations.ts:133](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/activations.ts#L133)

##### metadata?

> `optional` **metadata**: `Record`\<`string`, `unknown`\>

Defined in: [server/\_lib/creatorStrategy/activations.ts:140](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/activations.ts#L140)

##### paymentFrom

> **paymentFrom**: `Address`

Defined in: [server/\_lib/creatorStrategy/activations.ts:136](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/activations.ts#L136)

##### paymentTo

> **paymentTo**: `Address`

Defined in: [server/\_lib/creatorStrategy/activations.ts:137](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/activations.ts#L137)

##### paymentTxHash

> **paymentTxHash**: `Hex`

Defined in: [server/\_lib/creatorStrategy/activations.ts:135](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/activations.ts#L135)

##### paymentVerifiedAt

> **paymentVerifiedAt**: `Date`

Defined in: [server/\_lib/creatorStrategy/activations.ts:138](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/activations.ts#L138)

##### priceUsdcPaid

> **priceUsdcPaid**: `bigint`

Defined in: [server/\_lib/creatorStrategy/activations.ts:134](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/activations.ts#L134)

##### status

> **status**: `Extract`\<[`CreatorStrategyFeatureStatus`](#creatorstrategyfeaturestatus), `"pending"`\>

Defined in: [server/\_lib/creatorStrategy/activations.ts:139](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/activations.ts#L139)

***

### InsertActivationResult

> **InsertActivationResult** = \{ `ok`: `true`; `row`: [`CreatorStrategyFeatureRow`](#creatorstrategyfeaturerow); \} \| \{ `message`: `string`; `ok`: `false`; `reason`: `"live_activation_exists"` \| `"payment_already_used"` \| `"db_error"`; \}

Defined in: [server/\_lib/creatorStrategy/activations.ts:143](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/activations.ts#L143)

***

### InsertStripeCheckoutRowInput

> **InsertStripeCheckoutRowInput** = `object`

Defined in: [server/\_lib/creatorStrategy/activations.ts:154](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/activations.ts#L154)

#### Properties

##### creatorToken

> **creatorToken**: `Address`

Defined in: [server/\_lib/creatorStrategy/activations.ts:155](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/activations.ts#L155)

##### featureKey

> **featureKey**: `string`

Defined in: [server/\_lib/creatorStrategy/activations.ts:156](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/activations.ts#L156)

##### metadata?

> `optional` **metadata**: `Record`\<`string`, `unknown`\>

Defined in: [server/\_lib/creatorStrategy/activations.ts:160](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/activations.ts#L160)

##### priceUsdcExpected

> **priceUsdcExpected**: `bigint`

Defined in: [server/\_lib/creatorStrategy/activations.ts:157](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/activations.ts#L157)

##### stripeCheckoutSessionId

> **stripeCheckoutSessionId**: `string`

Defined in: [server/\_lib/creatorStrategy/activations.ts:159](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/activations.ts#L159)

##### walletAddress

> **walletAddress**: `Address`

Defined in: [server/\_lib/creatorStrategy/activations.ts:158](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/activations.ts#L158)

***

### InsertStripeCheckoutRowResult

> **InsertStripeCheckoutRowResult** = \{ `ok`: `true`; `row`: [`CreatorStrategyFeatureRow`](#creatorstrategyfeaturerow); \} \| \{ `message`: `string`; `ok`: `false`; `reason`: `"live_activation_exists"` \| `"db_error"`; \}

Defined in: [server/\_lib/creatorStrategy/activations.ts:163](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/activations.ts#L163)

## Functions

### finalizeStripeCheckoutActivation()

> **finalizeStripeCheckoutActivation**(`db`, `input`): `Promise`\<[`FinalizeStripeCheckoutResult`](#finalizestripecheckoutresult)\>

Defined in: [server/\_lib/creatorStrategy/activations.ts:261](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/activations.ts#L261)

Webhook handler — fills in Stripe payment metadata + the actual
amount paid after `checkout.session.completed`. Idempotent: running
it twice for the same session leaves the row in the same state.

#### Parameters

##### db

`Db`

##### input

[`FinalizeStripeCheckoutInput`](#finalizestripecheckoutinput)

#### Returns

`Promise`\<[`FinalizeStripeCheckoutResult`](#finalizestripecheckoutresult)\>

***

### hasLiveActivationForFeature()

> **hasLiveActivationForFeature**(`db`, `params`): `Promise`\<`boolean`\>

Defined in: [server/\_lib/creatorStrategy/activations.ts:112](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/activations.ts#L112)

True when the creator has a live, PAID entitlement row for the feature.

FIX: M-02 / 4626-408 — previously this function treated any row whose status
was `pending` or `active` as entitled. A `pending` row is inserted the moment
a Stripe checkout session (or x402 attempt) is created — BEFORE the payment
has cleared and `payment_verified_at` has been set by the webhook. That
window (typically several seconds, but unbounded if the user abandons the
flow) granted feature access for free.

We now additionally require `payment_verified_at IS NOT NULL` so only rows
whose payment has been verified server-side (stripe webhook or x402 settle)
count as entitled. `active` rows written by the webhook always set
`payment_verified_at` (see upsertActivationFromStripeWebhook below), so this
tightens the gate without changing the happy path.

#### Parameters

##### db

`Db`

##### params

###### creatorToken

`` `0x${string}` ``

###### featureKey

`string`

#### Returns

`Promise`\<`boolean`\>

***

### insertPendingActivation()

> **insertPendingActivation**(`db`, `input`): `Promise`\<[`InsertActivationResult`](#insertactivationresult)\>

Defined in: [server/\_lib/creatorStrategy/activations.ts:307](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/activations.ts#L307)

Insert a new `pending` activation row. Unique constraints on
(creator_token, feature_key) and payment_tx_hash are enforced at the
DB level; this helper translates those into specific error reasons
for the API handler.

#### Parameters

##### db

`Db`

##### input

[`InsertActivationInput`](#insertactivationinput)

#### Returns

`Promise`\<[`InsertActivationResult`](#insertactivationresult)\>

***

### insertStripeCheckoutActivation()

> **insertStripeCheckoutActivation**(`db`, `input`): `Promise`\<[`InsertStripeCheckoutRowResult`](#insertstripecheckoutrowresult)\>

Defined in: [server/\_lib/creatorStrategy/activations.ts:211](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/activations.ts#L211)

Insert a `pending` row for a Stripe Checkout Session BEFORE the user
has paid. The row is created so that when the Stripe webhook fires
after successful payment, we can idempotently find-and-update it by
`stripe_checkout_session_id` instead of racing to insert. Fails
cleanly with `live_activation_exists` if the creator already has a
live row for this feature — we never want to create a second
checkout session for a feature the creator has already activated or
has in-flight.

The row's `price_usdc_paid` stays at the EXPECTED price until the
webhook fires; the webhook then updates it to the actual Stripe
charge amount (converted from USD cents back into USDC base units).

#### Parameters

##### db

`Db`

##### input

[`InsertStripeCheckoutRowInput`](#insertstripecheckoutrowinput)

#### Returns

`Promise`\<[`InsertStripeCheckoutRowResult`](#insertstripecheckoutrowresult)\>

***

### listActivationsForCreator()

> **listActivationsForCreator**(`db`, `creatorToken`): `Promise`\<[`CreatorStrategyFeatureRow`](#creatorstrategyfeaturerow)[]\>

Defined in: [server/\_lib/creatorStrategy/activations.ts:79](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/activations.ts#L79)

#### Parameters

##### db

`Db`

##### creatorToken

`` `0x${string}` ``

#### Returns

`Promise`\<[`CreatorStrategyFeatureRow`](#creatorstrategyfeaturerow)[]\>

***

### toCreatorStrategyFeatureDto()

> **toCreatorStrategyFeatureDto**(`row`): [`CreatorStrategyFeatureDto`](#creatorstrategyfeaturedto)

Defined in: [server/\_lib/creatorStrategy/activations.ts:382](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/activations.ts#L382)

#### Parameters

##### row

[`CreatorStrategyFeatureRow`](#creatorstrategyfeaturerow)

#### Returns

[`CreatorStrategyFeatureDto`](#creatorstrategyfeaturedto)
