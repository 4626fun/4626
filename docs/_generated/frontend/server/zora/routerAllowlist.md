[**4626-app**](../../index.md)

***

[4626-app](../../index.md) / server/zora/routerAllowlist

# server/zora/routerAllowlist

## Type Aliases

### RouterAllowlistResult

> **RouterAllowlistResult** = \{ `allowed`: `true`; `observed?`: `true`; \} \| \{ `allowed`: `false`; `reason`: `string`; \}

Defined in: [server/zora/routerAllowlist.ts:67](https://github.com/wenakita/4626/blob/main/frontend/server/zora/routerAllowlist.ts#L67)

## Functions

### checkRouterTarget()

> **checkRouterTarget**(`target`): [`RouterAllowlistResult`](#routerallowlistresult)

Defined in: [server/zora/routerAllowlist.ts:83](https://github.com/wenakita/4626/blob/main/frontend/server/zora/routerAllowlist.ts#L83)

Check whether a Zora quote router target is in the allowlist.

Call this AFTER receiving the quote and BEFORE building the calls array.

In `observe` mode: always returns `{ allowed: true }`. If the target is
unknown, also sets `observed: true` and emits a logger.warn so we can
track new router addresses in preview.

In `enforce` mode: returns `{ allowed: false, reason }` for any target not
in the allowlist.

#### Parameters

##### target

`` `0x${string}` ``

#### Returns

[`RouterAllowlistResult`](#routerallowlistresult)
