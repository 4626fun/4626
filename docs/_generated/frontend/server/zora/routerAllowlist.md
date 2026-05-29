[**4626-web**](../../index.md)

***

[4626-web](../../index.md) / server/zora/routerAllowlist

# server/zora/routerAllowlist

## Type Aliases

### RouterAllowlistResult

> **RouterAllowlistResult** = \{ `allowed`: `true`; `observed?`: `true`; \} \| \{ `allowed`: `false`; `reason`: `string`; \}

Defined in: [server/zora/routerAllowlist.ts:80](https://github.com/wenakita/4626/blob/main/frontend/server/zora/routerAllowlist.ts#L80)

## Functions

### checkRouterTarget()

> **checkRouterTarget**(`target`): [`RouterAllowlistResult`](#routerallowlistresult)

Defined in: [server/zora/routerAllowlist.ts:96](https://github.com/wenakita/4626/blob/main/frontend/server/zora/routerAllowlist.ts#L96)

Check whether a Zora quote router target is in the allowlist.

Call this AFTER receiving the quote and BEFORE building the calls array.

In `enforce` mode (default): returns `{ allowed: false, reason }` for any
target not in the allowlist.

In `observe` mode: always returns `{ allowed: true }`. If the target is
unknown, also sets `observed: true` and emits a `logger.warn` so we can
track new router addresses in preview.

#### Parameters

##### target

`string`

#### Returns

[`RouterAllowlistResult`](#routerallowlistresult)
