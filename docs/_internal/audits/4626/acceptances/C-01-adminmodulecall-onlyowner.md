# Acceptance: C-01 — adminModuleCall gated with onlyOwner

- **Finding IDs:** Codex 2026-07-22 critical/high (adminModuleCall jackpot)
- **Severity (reported):** Critical / High
- **Status:** Fixed
- **Source:** Codex intake 2026-07-22

## Reported issue

`LotteryManager4626.adminModuleCall(bytes)` was an unrestricted external
`delegatecall` wrapper into the admin module. `payoutLocalJackpot` is
`onlyDelegateCall` (not `onlyOwner`) for the internal settlement path.
Without an owner gate on `adminModuleCall`, any caller could trigger jackpot payouts.

## Fix

- `adminModuleCall` is now `onlyOwner`.
- Negative Foundry test: non-owner `adminModuleCall(payoutLocalJackpot…)`
  reverts with `OwnableUnauthorizedAccount`.
- AdminModule scan: only `payoutLocalJackpot` is `onlyDelegateCall` without
  `onlyOwner`; settlement remains via internal `_payoutLocalJackpot`.

## Verification

`forge test --match-path test/LotteryManager4626.AdminModuleCallAuth.t.sol` (exit 0)
