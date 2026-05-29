[**4626-web**](../../../../../index.md)

***

[4626-web](../../../../../index.md) / api/\_handlers/creator/strategy/stripe/\_webhook

# api/\_handlers/creator/strategy/stripe/\_webhook

## Variables

### config

> `const` **config**: `object`

Defined in: [api/\_handlers/creator/strategy/stripe/\_webhook.ts:53](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/creator/strategy/stripe/_webhook.ts#L53)

Stripe webhook handler.

Reads the raw request body, verifies the `stripe-signature` header
against `STRIPE_WEBHOOK_SECRET`, then processes
`checkout.session.completed` events by finalizing the matching
`creator_strategy_features` row. The row moves from its
"`pending` (payment source=stripe, `payment_verified_at = NULL`)"
creation state to "`pending` (payment_verified_at set,
stripe_payment_intent_id populated)" — operator provisioning then
moves it to `active`.

We DO NOT use the redirect return URL for activation — Stripe's
standard guidance is that webhooks are the source of truth (redirects
can be missed if the user closes the tab).

Idempotency: Stripe may redeliver the same event. Our handler reads
by session id and issues an UPDATE, so replays are no-ops.

Note on body parsing: Stripe webhook verification needs the raw
bytes. Vercel Node handlers by default give us a parsed JSON object
in `req.body`. We re-serialize to a string for verification. This
works in most cases but is technically fragile. A cleaner future
refactor would disable body parsing for this route specifically via
`config.api.bodyParser = false` in a Next.js API route, or by reading
the raw stream. For now this is adequate.

#### Type Declaration

##### api

> `readonly` **api**: `object`

###### api.bodyParser

> `readonly` **bodyParser**: `false` = `false`

## Functions

### default()

> **default**(`req`, `res`): `Promise`\<`VercelResponse`\>

Defined in: [api/\_handlers/creator/strategy/stripe/\_webhook.ts:85](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/creator/strategy/stripe/_webhook.ts#L85)

#### Parameters

##### req

`VercelRequest`

##### res

`VercelResponse`

#### Returns

`Promise`\<`VercelResponse`\>
