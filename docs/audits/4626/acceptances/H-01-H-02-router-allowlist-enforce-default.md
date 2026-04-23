# Acceptance: H-01 & H-02 — Router allowlist now fails closed

- **Finding IDs:** H-01, H-02
- **Linear:** [4626-411](https://linear.app/4626fun/issue/4626-411), [4626-413](https://linear.app/4626fun/issue/4626-413)
- **Severity (reported):** High
- **Confidence (reported):** Confirmed
- **Status:** Fixed
- **Source:** Codex intake 2026-04-23 (`codex-security-findings-2026-04-23T18-31-56.185Z.csv`)

## Reported issue

The Arch B `/coin buy` and `/coin sell` command paths build a UserOp against
whatever `{ target, data, value }` the Zora Quote API returns. A compromised
or malicious quote response could therefore redirect the user's Coinbase
Smart Wallet (CSW) call to an arbitrary contract (`H-02` for buy, `H-01` for
sell's delegated variant).

`frontend/server/zora/routerAllowlist.ts` already implemented an allowlist
guard (`checkRouterTarget`) but its `resolveMode()` helper defaulted to
`'observe'` when the `ARCH_B_ROUTER_ALLOWLIST_MODE` env var was unset,
meaning **production silently logged** unknown router targets without
blocking them. Verified against prod Vercel project `akita-llc/4626`:
`ARCH_B_ROUTER_ALLOWLIST_MODE` had not been provisioned, so H-01/H-02 were
exploitable in prod at the time of the audit.

## Fix

Two coordinated changes:

1. **Env flip (operational):** `ARCH_B_ROUTER_ALLOWLIST_MODE=enforce` was
   added to the Vercel `Production` environment of `akita-llc/4626` on
   2026-04-23.
2. **Code default (this PR):** `resolveMode()` in
   `frontend/server/zora/routerAllowlist.ts` now defaults to `'enforce'`.
   Only an explicit `ARCH_B_ROUTER_ALLOWLIST_MODE=observe` opts into the
   permissive behaviour (intended for preview/dev pilots discovering new
   router addresses).

This makes the guard **fail closed**: any future deploy, regardless of env
provisioning, will reject unknown router targets by default.

## Verification

- `resolveMode()` now returns `'enforce'` when the env var is unset, empty,
  or an unrecognised value. Only `'observe'` (case-insensitive) opts into
  observe mode.
- Unknown targets hit `logger.warn('[arch-b/router-allowlist] Rejected …')`
  *and* return `{ allowed: false, reason }`, which short-circuits UserOp
  construction in both `/coin buy` and `/coin sell` handlers.
- Allowlist contents unchanged: Permit2
  (`0x000000000022d473030f116ddee9f6b43ac78ba3`) and Uniswap Universal
  Router on Base (`0x6ff5693b99212da76ad316178a184ab56d299b43`).

## Controls that prevent regression

- Default-closed `resolveMode()` means a future unset env var cannot
  reintroduce the permissive path.
- Enforce-mode rejections are logged at WARN with `{ target, mode }` so
  any legitimate router added to Zora's quote response will surface in
  logs before being added to the allowlist.
- Rollback: an operator can temporarily set
  `ARCH_B_ROUTER_ALLOWLIST_MODE=observe` in a specific environment while
  a new router is being evaluated; or disable the Arch B UserOp path
  entirely with `ARCH_B_COIN_{BUY,SELL}_VIA_USEROP=0`.

## References

- Codex finding H-01: <https://chatgpt.com/codex/cloud/security/findings/>
- Codex finding H-02: <https://chatgpt.com/codex/cloud/security/findings/>
- Intake parent issue: [4626-406 — Codex intake 2026-04-23](https://linear.app/4626fun/issue/4626-406)
- `frontend/server/zora/routerAllowlist.ts` (this PR)