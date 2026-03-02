# AMOE Test Matrix

This matrix tracks required AMOE coverage across contract and API layers.

## Contract (`CreatorLotteryManager`)

| Scenario | Expected result | Coverage |
|---|---|---|
| Valid AMOE entry | Creates VRF request, tags source as `AMOE`, uses min-entry equivalent amount | `test/CreatorLotteryManager.AMOE.t.sol::test_submitAmoeEntry_createsEntryAtMinimumPaidOdds` |
| Replay nonce | Reverts with `AmoeNonceUsed` | `test/CreatorLotteryManager.AMOE.t.sol::test_submitAmoeEntry_rejectsReplayNonce` |
| Expired attestation | Reverts with `AmoeExpired` | `test/CreatorLotteryManager.AMOE.t.sol::test_submitAmoeEntry_rejectsExpiredAttestation` |
| Invalid signer | Reverts with `AmoeInvalidSignature` | `test/CreatorLotteryManager.AMOE.t.sol::test_submitAmoeEntry_rejectsInvalidSignature` |
| Per-wallet epoch cap | Reverts in-epoch, succeeds next epoch | `test/CreatorLotteryManager.AMOE.t.sol::test_submitAmoeEntry_enforcesPerWalletEpochCap` |
| Paused behavior regression | Defers/settles VRF callbacks unchanged | `test/CreatorLotteryManager.PauseGuards.t.sol` |

## API (`/v1/lottery/amoe/*`)

| Scenario | Expected result | Coverage |
|---|---|---|
| Route registration | Catch-all route resolves nonce/submit handlers | `frontend/api/__tests__/lotteryAmoeHandlers.test.ts::registers AMOE nonce and submit routes` |
| Nonce request validation | Missing wallet or creator coin rejected | `frontend/api/__tests__/lotteryAmoeHandlers.test.ts::rejects missing wallet/creatorCoin query params` |
| Nonce happy path | Returns nonce + challenge message | `frontend/api/__tests__/lotteryAmoeHandlers.test.ts::returns nonce payload for valid query params` |
| Submit method guard | Non-POST rejected | `frontend/api/__tests__/lotteryAmoeHandlers.test.ts::rejects unsupported methods` |
| Submit happy path | Returns signed attestation payload + calldata | `frontend/api/__tests__/lotteryAmoeHandlers.test.ts::returns attested AMOE submit payload` |

## Invariants to Keep

- AMOE odds remain equivalent to minimum paid-entry base odds.
- AMOE uses replay-safe nonces and short-lived deadlines.
- AMOE keeps no-purchase flow available while preserving anti-abuse controls.
