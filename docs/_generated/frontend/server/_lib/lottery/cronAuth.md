[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/lottery/cronAuth

# server/\_lib/lottery/cronAuth

## Functions

### isAuthorizedCron()

> **isAuthorizedCron**(`req`): `boolean`

Defined in: [server/\_lib/lottery/cronAuth.ts:49](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/cronAuth.ts#L49)

Validate the `Authorization` header on a Vercel cron request against
the configured shared secret.

Accepts both `Bearer <secret>` (Vercel's format) and the bare secret
(manual `curl` from ops drills). Compares in constant time over the
common prefix to avoid leaking the secret length via timing.

Returns `false` (NOT throws) on every failure path so callers can
uniformly translate to 401 without leaking which check failed.

#### Parameters

##### req

`VercelRequest`

#### Returns

`boolean`

***

### readCronSecret()

> **readCronSecret**(): `string` \| `null`

Defined in: [server/\_lib/lottery/cronAuth.ts:29](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/cronAuth.ts#L29)

Read the Vercel cron-shared secret. Returns `null` if unset — cron
authorization fails closed in that case (`isAuthorizedCron` returns
false for any header).

Accepts either `CRON_SECRET` (Vercel's default name) or
`AMOE_CRON_SECRET` (legacy override) for backwards-compat with the
pre-PR-5b deployment. The secret must be at least 16 chars to defeat
trivial brute-force.

#### Returns

`string` \| `null`
