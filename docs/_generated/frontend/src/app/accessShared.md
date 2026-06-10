[**4626-web**](../../index.md)

***

[4626-web](../../index.md) / src/app/accessShared

# src/app/accessShared

## Type Aliases

### AccessDecision

> **AccessDecision** = \{ `allow`: `true`; `reason`: `"ok"`; \} \| \{ `allow`: `false`; `reason`: `Exclude`\<[`AccessReason`](#accessreason), `"ok"`\>; `redirectTo?`: `string`; \}

Defined in: [src/app/accessShared.tsx:14](https://github.com/wenakita/4626/blob/main/frontend/src/app/accessShared.tsx#L14)

***

### AccessReason

> **AccessReason** = `"ok"` \| `"loading"` \| `"needs-session"` \| `"needs-acceptance"` \| `"needs-admin"` \| `"needs-creator"` \| `"not-found"`

Defined in: [src/app/accessShared.tsx:13](https://github.com/wenakita/4626/blob/main/frontend/src/app/accessShared.tsx#L13)

***

### AccessState

> **AccessState** = `object`

Defined in: [src/app/accessShared.tsx:16](https://github.com/wenakita/4626/blob/main/frontend/src/app/accessShared.tsx#L16)

#### Properties

##### accepted

> **accepted**: `boolean`

Defined in: [src/app/accessShared.tsx:20](https://github.com/wenakita/4626/blob/main/frontend/src/app/accessShared.tsx#L20)

##### admin

> **admin**: `boolean`

Defined in: [src/app/accessShared.tsx:22](https://github.com/wenakita/4626/blob/main/frontend/src/app/accessShared.tsx#L22)

##### allowlistEnforced

> **allowlistEnforced**: `boolean`

Defined in: [src/app/accessShared.tsx:23](https://github.com/wenakita/4626/blob/main/frontend/src/app/accessShared.tsx#L23)

##### creator

> **creator**: `boolean`

Defined in: [src/app/accessShared.tsx:21](https://github.com/wenakita/4626/blob/main/frontend/src/app/accessShared.tsx#L21)

##### effectiveAddress

> **effectiveAddress**: `string` \| `null`

Defined in: [src/app/accessShared.tsx:24](https://github.com/wenakita/4626/blob/main/frontend/src/app/accessShared.tsx#L24)

##### hostMode

> **hostMode**: [`HostMode`](../lib/env/host.md#hostmode)

Defined in: [src/app/accessShared.tsx:26](https://github.com/wenakita/4626/blob/main/frontend/src/app/accessShared.tsx#L26)

##### loading

> **loading**: `boolean`

Defined in: [src/app/accessShared.tsx:17](https://github.com/wenakita/4626/blob/main/frontend/src/app/accessShared.tsx#L17)

##### marketingUrl

> **marketingUrl**: `string`

Defined in: [src/app/accessShared.tsx:25](https://github.com/wenakita/4626/blob/main/frontend/src/app/accessShared.tsx#L25)

##### sessionValid

> **sessionValid**: `boolean`

Defined in: [src/app/accessShared.tsx:19](https://github.com/wenakita/4626/blob/main/frontend/src/app/accessShared.tsx#L19)

##### walletConnected

> **walletConnected**: `boolean`

Defined in: [src/app/accessShared.tsx:18](https://github.com/wenakita/4626/blob/main/frontend/src/app/accessShared.tsx#L18)

***

### RouteId

> **RouteId** = `"public"` \| `"session"` \| `"accepted"` \| `"creator"` \| `"admin"`

Defined in: [src/app/accessShared.tsx:12](https://github.com/wenakita/4626/blob/main/frontend/src/app/accessShared.tsx#L12)

## Variables

### AccessContext

> `const` **AccessContext**: `Context`\<[`AccessState`](#accessstate) \| `null`\>

Defined in: [src/app/accessShared.tsx:68](https://github.com/wenakita/4626/blob/main/frontend/src/app/accessShared.tsx#L68)

## Functions

### computeAcceptedFromAppAccessStatus()

> **computeAcceptedFromAppAccessStatus**(`appAccessStatus`): `boolean`

Defined in: [src/app/accessShared.tsx:37](https://github.com/wenakita/4626/blob/main/frontend/src/app/accessShared.tsx#L37)

#### Parameters

##### appAccessStatus

`string` | `null`

#### Returns

`boolean`

***

### resolveAccess()

> **resolveAccess**(`routeId`, `state`): [`AccessDecision`](#accessdecision)

Defined in: [src/app/accessShared.tsx:45](https://github.com/wenakita/4626/blob/main/frontend/src/app/accessShared.tsx#L45)

#### Parameters

##### routeId

[`RouteId`](#routeid)

##### state

[`AccessState`](#accessstate)

#### Returns

[`AccessDecision`](#accessdecision)

***

### useAccessContext()

> **useAccessContext**(): [`AccessState`](#accessstate)

Defined in: [src/app/accessShared.tsx:70](https://github.com/wenakita/4626/blob/main/frontend/src/app/accessShared.tsx#L70)

#### Returns

[`AccessState`](#accessstate)

***

### useOptionalAccessContext()

> **useOptionalAccessContext**(): [`AccessState`](#accessstate) \| `null`

Defined in: [src/app/accessShared.tsx:78](https://github.com/wenakita/4626/blob/main/frontend/src/app/accessShared.tsx#L78)

#### Returns

[`AccessState`](#accessstate) \| `null`

***

### waitlistEntryHref()

> **waitlistEntryHref**(`marketingUrl`): `string`

Defined in: [src/app/accessShared.tsx:41](https://github.com/wenakita/4626/blob/main/frontend/src/app/accessShared.tsx#L41)

#### Parameters

##### marketingUrl

`string`

#### Returns

`string`

## References

### getInitialTelegramMiniAppEntryResolution

Re-exports [getInitialTelegramMiniAppEntryResolution](../lib/telegram/telegramMiniAppRouteGuard.md#getinitialtelegramminiappentryresolution)

***

### hasTelegramLinkEntryContext

Re-exports [hasTelegramLinkEntryContext](../lib/telegram/telegramMiniAppRouteGuard.md#hastelegramlinkentrycontext)

***

### hasTelegramLinkQueryContext

Re-exports [hasTelegramLinkQueryContext](../lib/telegram/telegramMiniAppRouteGuard.md#hastelegramlinkquerycontext)

***

### resolveTelegramMiniAppEntryBootstrap

Re-exports [resolveTelegramMiniAppEntryBootstrap](../lib/telegram/telegramMiniAppRouteGuard.md#resolvetelegramminiappentrybootstrap)
