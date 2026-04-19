[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / api/\_handlers/waitlist/\_referrer

# api/\_handlers/waitlist/\_referrer

## Type Aliases

### WaitlistReferrerResponse

> **WaitlistReferrerResponse** = \{ `display`: `string`; `pointsTotal`: `number`; `rank`: `number` \| `null`; \} \| `null`

Defined in: [api/\_handlers/waitlist/\_referrer.ts:30](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/waitlist/_referrer.ts#L30)

Public lookup: referral code → referrer's public display name + signal.

Used by the waitlist landing page to personalize /r/<CODE> entries with
"Invited by {display}" copy so the referral link doesn't feel anonymous.

Privacy:
- Only returns fields that are already publicly visible via the
  leaderboard (display, rank, pointsTotal). Never email/wallet/PII.
- Display follows the same `shortAddr(primary_wallet) ?? user#<id>` rule
  as `toLeaderboardRow`.
- Rate-limited per client IP to raise the cost of code enumeration.
- Returns `null` for misses with 200 OK to avoid leaking code existence
  through the HTTP status code.

## Functions

### default()

> **default**(`req`, `res`): `Promise`\<`any`\>

Defined in: [api/\_handlers/waitlist/\_referrer.ts:58](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/waitlist/_referrer.ts#L58)

#### Parameters

##### req

`any`

##### res

`any`

#### Returns

`Promise`\<`any`\>
