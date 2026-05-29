[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/features/waitlist/ReferrerGreetingBanner

# src/features/waitlist/ReferrerGreetingBanner

## Functions

### ReferrerGreetingBanner()

> **ReferrerGreetingBanner**(`__namedParameters`): `Element` \| `null`

Defined in: [src/features/waitlist/ReferrerGreetingBanner.tsx:22](https://github.com/wenakita/4626/blob/main/frontend/src/features/waitlist/ReferrerGreetingBanner.tsx#L22)

Small banner shown above the waitlist auth step when the user arrived via
a referral link. Looks up the referrer's public display name via the
rate-limited `/api/waitlist/referrer` endpoint and renders a personalized
"Invited by {display}" greeting so the referral link doesn't feel
anonymous.

Intentionally fails soft: if the code is empty, invalid, unknown, or the
lookup errors, the banner simply doesn't render and the page falls back
to its generic copy.

#### Parameters

##### \_\_namedParameters

`ReferrerGreetingBannerProps`

#### Returns

`Element` \| `null`
