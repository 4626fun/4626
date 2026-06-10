[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/features/executionScope/AutoProvisionMount

# src/features/executionScope/AutoProvisionMount

## Functions

### AutoProvisionMount()

> **AutoProvisionMount**(): `null`

Defined in: [src/features/executionScope/AutoProvisionMount.tsx:15](https://github.com/wenakita/4626/blob/main/frontend/src/features/executionScope/AutoProvisionMount.tsx#L15)

Side-effect-only mount for the `useAutoProvisionSubAccount` hook.

Exists because the hook does all its work via `useEffect` and has no
direct render; wrapping it in a component with `null` render is the
cleanest way to drop it into `AccountsPage.tsx` without threading
the hook's return value anywhere.

The hook is intentionally scoped to `/accounts` (not the root app
shell) — see the module-level docstring in
`useAutoProvisionSubAccount.ts` for rationale.

#### Returns

`null`
