[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/lib/waitlist/waitlistMeQuery

# src/lib/waitlist/waitlistMeQuery

## Variables

### WAITLIST\_ME\_QUERY\_KEY

> `const` **WAITLIST\_ME\_QUERY\_KEY**: readonly \[`"waitlist"`, `"me"`\]

Defined in: [src/lib/waitlist/waitlistMeQuery.ts:6](https://github.com/wenakita/4626/blob/main/frontend/src/lib/waitlist/waitlistMeQuery.ts#L6)

Single react-query key for `/api/waitlist/me` — dedupes access + account context.

## Functions

### fetchWaitlistMe()

> **fetchWaitlistMe**(): `Promise`\<[`WaitlistMeData`](../../hooks/canonicalWalletUtils.md#waitlistmedata) \| `null`\>

Defined in: [src/lib/waitlist/waitlistMeQuery.ts:8](https://github.com/wenakita/4626/blob/main/frontend/src/lib/waitlist/waitlistMeQuery.ts#L8)

#### Returns

`Promise`\<[`WaitlistMeData`](../../hooks/canonicalWalletUtils.md#waitlistmedata) \| `null`\>
