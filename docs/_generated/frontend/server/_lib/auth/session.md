[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/auth/session

# server/\_lib/auth/session

## Type Aliases

### RuntimeSessionContext

> **RuntimeSessionContext** = [`AgentSessionContext`](../../agents/core/resolveIdentityContext.md#agentsessioncontext)

Defined in: [server/\_lib/auth/session.ts:9](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/auth/session.ts#L9)

## Functions

### buildRuntimeSessionContext()

> **buildRuntimeSessionContext**(`address`): [`AgentSessionContext`](../../agents/core/resolveIdentityContext.md#agentsessioncontext) \| `null`

Defined in: [server/\_lib/auth/session.ts:22](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/auth/session.ts#L22)

#### Parameters

##### address

`string` | `null` | `undefined`

#### Returns

[`AgentSessionContext`](../../agents/core/resolveIdentityContext.md#agentsessioncontext) \| `null`

***

### getSessionAddress()

> **getSessionAddress**(`req`): `` `0x${string}` `` \| `null`

Defined in: [server/\_lib/auth/session.ts:11](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/auth/session.ts#L11)

#### Parameters

##### req

`VercelRequest`

#### Returns

`` `0x${string}` `` \| `null`

***

### isAdminAddress()

> **isAdminAddress**(`address`): `boolean`

Defined in: [server/\_lib/auth/session.ts:18](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/auth/session.ts#L18)

#### Parameters

##### address

`string`

#### Returns

`boolean`

***

### isAdminEmail()

> **isAdminEmail**(`email`): `boolean`

Defined in: [server/\_lib/auth/session.ts:33](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/auth/session.ts#L33)

#### Parameters

##### email

`string` | `null` | `undefined`

#### Returns

`boolean`
