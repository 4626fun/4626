[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/messaging/xmtpDbDirectory

# server/\_lib/messaging/xmtpDbDirectory

## Functions

### findMountedAncestorPath()

> **findMountedAncestorPath**(`targetPath`, `mountInfoText?`): `string` \| `null`

Defined in: [server/\_lib/messaging/xmtpDbDirectory.ts:93](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/messaging/xmtpDbDirectory.ts#L93)

Return the closest mounted ancestor for a target path, or null when mount
info is unavailable.

#### Parameters

##### targetPath

`string`

##### mountInfoText?

`string`

#### Returns

`string` \| `null`

***

### hasDedicatedMount()

> **hasDedicatedMount**(`targetPath`, `mountInfoText?`): `boolean`

Defined in: [server/\_lib/messaging/xmtpDbDirectory.ts:121](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/messaging/xmtpDbDirectory.ts#L121)

True when the target path lives on a dedicated mount, not just the
container root filesystem (`/`).

#### Parameters

##### targetPath

`string`

##### mountInfoText?

`string`

#### Returns

`boolean`

***

### listXmtpDb3FilesUnderRoot()

> **listXmtpDb3FilesUnderRoot**(`rootDir`, `maxDepth`): `string`[]

Defined in: [server/\_lib/messaging/xmtpDbDirectory.ts:48](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/messaging/xmtpDbDirectory.ts#L48)

List all `.db3` files under an XMTP root (e.g. `/data/.xmtp-data`).
The XMTP SDK may nest DBs under subfolders such as `v3/` — a flat directory
scan misses them and incorrectly logs "no .db3 files" on every boot.

#### Parameters

##### rootDir

`string`

##### maxDepth

`number` = `6`

#### Returns

`string`[]

***

### parseMountInfoMountPoints()

> **parseMountInfoMountPoints**(`mountInfoText`): `string`[]

Defined in: [server/\_lib/messaging/xmtpDbDirectory.ts:75](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/messaging/xmtpDbDirectory.ts#L75)

Parse mount points from `/proc/self/mountinfo`.
Paths in mountinfo escape spaces and special bytes using octal escapes.

#### Parameters

##### mountInfoText

`string`

#### Returns

`string`[]

***

### resolveXmtpDbDirectory()

> **resolveXmtpDbDirectory**(): `string`

Defined in: [server/\_lib/messaging/xmtpDbDirectory.ts:146](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/messaging/xmtpDbDirectory.ts#L146)

Resolve a stable XMTP DB directory with persistence-first behavior.

Priority:
1) XMTP_DB_DIRECTORY if explicitly set
2) Existing CWD db with .db3 files (to keep reusing an already active installation)
3) /data/.xmtp-data when writable (persistent volume default on Railway/Docker)
4) /tmp/.xmtp-data for serverless runtimes
5) CWD fallback (only if writable)

#### Returns

`string`
