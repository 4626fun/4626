## Summary

- 

## Why This Change

- 

## Test Plan

- [ ] `pnpm -C frontend typecheck`
- [ ] `pnpm -C frontend lint`
- [ ] Manual validation completed for affected flows

## Swap Stability Guardrails (frontend `/swap` changes)

Complete this section if the PR touches swap route logic, swap hooks, route access gating, or nav/query behavior under `frontend/`.

- [ ] Idle `/swap` (60s) shows no visible flicker/re-hydration loop
- [ ] No timer-driven rerender loop introduced for idle swap UI
- [ ] Route guards only block on initial load (`isLoading`), not benign refetches (`isFetching`)
- [ ] Non-critical auth/admin checks are route-scoped and do not refetch on focus/reconnect by default
- [ ] Stale quote is rebuilt on action/review path (not by idle polling)
- [ ] React Profiler confirms no fixed-cadence commit loop on idle `/swap`
- [ ] Reviewed `frontend/docs/uniswap-qa.md` and completed relevant checks

## Risks / Rollback

- Risk level: low / medium / high
- Rollback plan:

