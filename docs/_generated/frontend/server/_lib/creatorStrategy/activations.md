[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / server/\_lib/creatorStrategy/activations

# server/\_lib/creatorStrategy/activations

## Type Aliases

### CreatorStrategyFeatureDto

> **CreatorStrategyFeatureDto** = `object`

Defined in: [server/\_lib/creatorStrategy/activations.ts:354](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/activations.ts#L354)

Public-safe DTO for the API `/api/creator/strategy/activations` endpoint.
Hides internal IDs and keeps bigints as strings.

#### Properties

##### createdAt

> **createdAt**: `string`

Defined in: [server/\_lib/creatorStrategy/activations.ts:366](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/activations.ts#L366)

##### creatorToken

> **creatorToken**: `Address`

Defined in: [server/\_lib/creatorStrategy/activations.ts:355](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/activations.ts#L355)

##### failedAt

> **failedAt**: `string` \| `null`

Defined in: [server/\_lib/creatorStrategy/activations.ts:362](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/activations.ts#L362)

##### failureReason

> **failureReason**: `string` \| `null`

Defined in: [server/\_lib/creatorStrategy/activations.ts:364](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/activations.ts#L364)

##### featureKey

> **featureKey**: `string`

Defined in: [server/\_lib/creatorStrategy/activations.ts:356](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/activations.ts#L356)

##### paymentTxHash

> **paymentTxHash**: `Hex` \| `null`

Defined in: [server/\_lib/creatorStrategy/activations.ts:359](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/activations.ts#L359)

##### paymentVerifiedAt

> **paymentVerifiedAt**: `string` \| `null`

Defined in: [server/\_lib/creatorStrategy/activations.ts:360](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/activations.ts#L360)

##### priceUsdcPaid

> **priceUsdcPaid**: `string`

Defined in: [server/\_lib/creatorStrategy/activations.ts:358](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/activations.ts#L358)

##### provisionedAt

> **provisionedAt**: `string` \| `null`

Defined in: [server/\_lib/creatorStrategy/activations.ts:361](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/activations.ts#L361)

##### provisionerRef

> **provisionerRef**: `string` \| `null`

Defined in: [server/\_lib/creatorStrategy/activations.ts:365](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/activations.ts#L365)

##### refundedAt

> **refundedAt**: `string` \| `null`

Defined in: [server/\_lib/creatorStrategy/activations.ts:363](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/activations.ts#L363)

##### status

> **status**: [`CreatorStrategyFeatureStatus`](#creatorstrategyfeaturestatus)

Defined in: [server/\_lib/creatorStrategy/activations.ts:357](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/activations.ts#L357)

##### updatedAt

> **updatedAt**: `string`

Defined in: [server/\_lib/creatorStrategy/activations.ts:367](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/activations.ts#L367)

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

Defined in: [server/\_lib/creatorStrategy/activations.ts:159](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/activations.ts#L159)

#### Properties

##### paymentVerifiedAt

> **paymentVerifiedAt**: `Date`

Defined in: [server/\_lib/creatorStrategy/activations.ts:165](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/activations.ts#L165)

##### priceUsdcPaid

> **priceUsdcPaid**: `bigint`

Defined in: [server/\_lib/creatorStrategy/activations.ts:161](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/activations.ts#L161)

##### stripeChargeId

> **stripeChargeId**: `string` \| `null`

Defined in: [server/\_lib/creatorStrategy/activations.ts:164](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/activations.ts#L164)

##### stripeCheckoutSessionId

> **stripeCheckoutSessionId**: `string`

Defined in: [server/\_lib/creatorStrategy/activations.ts:160](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/activations.ts#L160)

##### stripePaymentIntentId

> **stripePaymentIntentId**: `string` \| `null`

Defined in: [server/\_lib/creatorStrategy/activations.ts:163](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/activations.ts#L163)

##### walletAddress

> **walletAddress**: `Address`

Defined in: [server/\_lib/creatorStrategy/activations.ts:162](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/activations.ts#L162)

***

### FinalizeStripeCheckoutResult

> **FinalizeStripeCheckoutResult** = \{ `ok`: `true`; `row`: [`CreatorStrategyFeatureRow`](#creatorstrategyfeaturerow); \} \| \{ `message`: `string`; `ok`: `false`; `reason`: `"session_not_found"` \| `"db_error"`; \}

Defined in: [server/\_lib/creatorStrategy/activations.ts:168](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/activations.ts#L168)

***

### InsertActivationInput

> **InsertActivationInput** = `object`

Defined in: [server/\_lib/creatorStrategy/activations.ts:119](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/activations.ts#L119)

#### Properties

##### creatorToken

> **creatorToken**: `Address`

Defined in: [server/\_lib/creatorStrategy/activations.ts:120](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/activations.ts#L120)

##### featureKey

> **featureKey**: `string`

Defined in: [server/\_lib/creatorStrategy/activations.ts:121](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/activations.ts#L121)

##### metadata?

> `optional` **metadata**: `Record`\<`string`, `unknown`\>

Defined in: [server/\_lib/creatorStrategy/activations.ts:128](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/activations.ts#L128)

##### paymentFrom

> **paymentFrom**: `Address`

Defined in: [server/\_lib/creatorStrategy/activations.ts:124](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/activations.ts#L124)

##### paymentTo

> **paymentTo**: `Address`

Defined in: [server/\_lib/creatorStrategy/activations.ts:125](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/activations.ts#L125)

##### paymentTxHash

> **paymentTxHash**: `Hex`

Defined in: [server/\_lib/creatorStrategy/activations.ts:123](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/activations.ts#L123)

##### paymentVerifiedAt

> **paymentVerifiedAt**: `Date`

Defined in: [server/\_lib/creatorStrategy/activations.ts:126](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/activations.ts#L126)

##### priceUsdcPaid

> **priceUsdcPaid**: `bigint`

Defined in: [server/\_lib/creatorStrategy/activations.ts:122](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/activations.ts#L122)

##### status

> **status**: `Extract`\<[`CreatorStrategyFeatureStatus`](#creatorstrategyfeaturestatus), `"pending"`\>

Defined in: [server/\_lib/creatorStrategy/activations.ts:127](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/activations.ts#L127)

***

### InsertActivationResult

> **InsertActivationResult** = \{ `ok`: `true`; `row`: [`CreatorStrategyFeatureRow`](#creatorstrategyfeaturerow); \} \| \{ `message`: `string`; `ok`: `false`; `reason`: `"live_activation_exists"` \| `"payment_already_used"` \| `"db_error"`; \}

Defined in: [server/\_lib/creatorStrategy/activations.ts:131](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/activations.ts#L131)

***

### InsertStripeCheckoutRowInput

> **InsertStripeCheckoutRowInput** = `object`

Defined in: [server/\_lib/creatorStrategy/activations.ts:142](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/activations.ts#L142)

#### Properties

##### creatorToken

> **creatorToken**: `Address`

Defined in: [server/\_lib/creatorStrategy/activations.ts:143](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/activations.ts#L143)

##### featureKey

> **featureKey**: `string`

Defined in: [server/\_lib/creatorStrategy/activations.ts:144](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/activations.ts#L144)

##### metadata?

> `optional` **metadata**: `Record`\<`string`, `unknown`\>

Defined in: [server/\_lib/creatorStrategy/activations.ts:148](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/activations.ts#L148)

##### priceUsdcExpected

> **priceUsdcExpected**: `bigint`

Defined in: [server/\_lib/creatorStrategy/activations.ts:145](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/activations.ts#L145)

##### stripeCheckoutSessionId

> **stripeCheckoutSessionId**: `string`

Defined in: [server/\_lib/creatorStrategy/activations.ts:147](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/activations.ts#L147)

##### walletAddress

> **walletAddress**: `Address`

Defined in: [server/\_lib/creatorStrategy/activations.ts:146](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/activations.ts#L146)

***

### InsertStripeCheckoutRowResult

> **InsertStripeCheckoutRowResult** = \{ `ok`: `true`; `row`: [`CreatorStrategyFeatureRow`](#creatorstrategyfeaturerow); \} \| \{ `message`: `string`; `ok`: `false`; `reason`: `"live_activation_exists"` \| `"db_error"`; \}

Defined in: [server/\_lib/creatorStrategy/activations.ts:151](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/activations.ts#L151)

## Functions

### finalizeStripeCheckoutActivation()

> **finalizeStripeCheckoutActivation**(`db`, `input`): `Promise`\<[`FinalizeStripeCheckoutResult`](#finalizestripecheckoutresult)\>

Defined in: [server/\_lib/creatorStrategy/activations.ts:249](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/activations.ts#L249)

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

Defined in: [server/\_lib/creatorStrategy/activations.ts:101](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/activations.ts#L101)

True when the creator has a live entitlement row for the feature.
We treat both `pending` and `active` as entitled because payment
verification is authoritative and provisioning can lag.

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

Defined in: [server/\_lib/creatorStrategy/activations.ts:295](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/activations.ts#L295)

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

Defined in: [server/\_lib/creatorStrategy/activations.ts:199](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/activations.ts#L199)

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

Defined in: [server/\_lib/creatorStrategy/activations.ts:370](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/activations.ts#L370)

#### Parameters

##### row

[`CreatorStrategyFeatureRow`](#creatorstrategyfeaturerow)

#### Returns

[`CreatorStrategyFeatureDto`](#creatorstrategyfeaturedto)
