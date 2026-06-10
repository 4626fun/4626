[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/lib/xmtp/xmtpSyncCoordinator

# src/lib/xmtp/xmtpSyncCoordinator

## Type Aliases

### CoordinatedSyncResult

> **CoordinatedSyncResult** = `"synced"` \| `"skipped_cooldown"` \| `"skipped_in_flight"`

Defined in: [src/lib/xmtp/xmtpSyncCoordinator.ts:60](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/xmtpSyncCoordinator.ts#L60)

## Variables

### XMTP\_MIN\_SYNC\_INTERVAL\_MS

> `const` **XMTP\_MIN\_SYNC\_INTERVAL\_MS**: `10000` = `10_000`

Defined in: [src/lib/xmtp/xmtpSyncCoordinator.ts:4](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/xmtpSyncCoordinator.ts#L4)

***

### XMTP\_RATE\_LIMIT\_BACKOFF\_MS

> `const` **XMTP\_RATE\_LIMIT\_BACKOFF\_MS**: `90000` = `90_000`

Defined in: [src/lib/xmtp/xmtpSyncCoordinator.ts:5](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/xmtpSyncCoordinator.ts#L5)

## Functions

### coordinatedConversationSync()

> **coordinatedConversationSync**(`conversationsApi`, `options?`): `Promise`\<[`CoordinatedSyncResult`](#coordinatedsyncresult)\>

Defined in: [src/lib/xmtp/xmtpSyncCoordinator.ts:62](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/xmtpSyncCoordinator.ts#L62)

#### Parameters

##### conversationsApi

[`ConversationsApiLike`](xmtpHelpers.md#conversationsapilike)

##### options?

###### force?

`boolean`

###### lightweight?

`boolean`

#### Returns

`Promise`\<[`CoordinatedSyncResult`](#coordinatedsyncresult)\>

***

### markXmtpRateLimited()

> **markXmtpRateLimited**(`backoffMs`): `void`

Defined in: [src/lib/xmtp/xmtpSyncCoordinator.ts:12](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/xmtpSyncCoordinator.ts#L12)

#### Parameters

##### backoffMs

`number` = `XMTP_RATE_LIMIT_BACKOFF_MS`

#### Returns

`void`

***

### resetXmtpSyncCoordinatorForTests()

> **resetXmtpSyncCoordinatorForTests**(): `void`

Defined in: [src/lib/xmtp/xmtpSyncCoordinator.ts:27](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/xmtpSyncCoordinator.ts#L27)

#### Returns

`void`

***

### xmtpSyncBlockedRemainingMs()

> **xmtpSyncBlockedRemainingMs**(): `number`

Defined in: [src/lib/xmtp/xmtpSyncCoordinator.ts:18](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/xmtpSyncCoordinator.ts#L18)

#### Returns

`number`
