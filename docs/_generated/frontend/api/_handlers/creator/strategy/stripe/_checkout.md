[**4626-web**](../../../../../index.md)

***

[4626-web](../../../../../index.md) / api/\_handlers/creator/strategy/stripe/\_checkout

# api/\_handlers/creator/strategy/stripe/\_checkout

## Functions

### default()

> **default**(`req`, `res`): `Promise`\<`VercelResponse` \| `undefined`\>

Defined in: [api/\_handlers/creator/strategy/stripe/\_checkout.ts:74](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/creator/strategy/stripe/_checkout.ts#L74)

Create a Stripe Checkout Session for a creator strategy feature.

Idempotency: if the creator already has a `pending` or `active`
activation for the feature, we return 409 rather than letting Stripe
create a duplicate session. The creator should resume their existing
session or contact support.

#### Parameters

##### req

`VercelRequest`

##### res

`VercelResponse`

#### Returns

`Promise`\<`VercelResponse` \| `undefined`\>
