[**4626-web**](../../index.md)

***

[4626-web](../../index.md) / src/hooks/useDeferUntilMounted

# src/hooks/useDeferUntilMounted

## Functions

### useDeferUntilAfterCommit()

> **useDeferUntilAfterCommit**(): `boolean`

Defined in: [src/hooks/useDeferUntilMounted.ts:36](https://github.com/wenakita/4626/blob/main/frontend/src/hooks/useDeferUntilMounted.ts#L36)

True after the first client commit — avoids wagmi Hydrate reconnect setState during render.

#### Returns

`boolean`

***

### useDeferUntilMounted()

> **useDeferUntilMounted**(): `boolean`

Defined in: [src/hooks/useDeferUntilMounted.ts:4](https://github.com/wenakita/4626/blob/main/frontend/src/hooks/useDeferUntilMounted.ts#L4)

True after client mount — avoids wagmi Hydrate setState during SSR/first paint.

#### Returns

`boolean`
