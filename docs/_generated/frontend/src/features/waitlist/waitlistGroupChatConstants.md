[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/features/waitlist/waitlistGroupChatConstants

# src/features/waitlist/waitlistGroupChatConstants

## Variables

### WAITLIST\_GROUP\_SYNC\_BACKOFF\_MS

> `const` **WAITLIST\_GROUP\_SYNC\_BACKOFF\_MS**: readonly \[`0`, `4000`, `10000`, `20000`, `30000`\]

Defined in: [src/features/waitlist/waitlistGroupChatConstants.ts:2](https://github.com/wenakita/4626/blob/main/frontend/src/features/waitlist/waitlistGroupChatConstants.ts#L2)

Backoff schedule (ms) for resolving the waitlist group after server join completes.

***

### ~~WAITLIST\_GROUP\_SYNC\_DELAY\_MS~~

> `const` **WAITLIST\_GROUP\_SYNC\_DELAY\_MS**: `0`

Defined in: [src/features/waitlist/waitlistGroupChatConstants.ts:5](https://github.com/wenakita/4626/blob/main/frontend/src/features/waitlist/waitlistGroupChatConstants.ts#L5)

#### Deprecated

Use WAITLIST_GROUP_SYNC_BACKOFF_MS

***

### WAITLIST\_JOIN\_REQUEST\_TIMEOUT\_MS

> `const` **WAITLIST\_JOIN\_REQUEST\_TIMEOUT\_MS**: `30000` = `30_000`

Defined in: [src/features/waitlist/waitlistGroupChatConstants.ts:8](https://github.com/wenakita/4626/blob/main/frontend/src/features/waitlist/waitlistGroupChatConstants.ts#L8)

Timeout for POST /api/waitlist/xmtp-join.
