# ODA job 426 — Lottery stack triage (correct scope)

**Status:** complete · **Track:** https://onedollaraudit.com/audit/426  
**Source:** litterbox `i28508.md` (CreatorVault explicitly rejected) — **usable**.

| ID | Sev (conf) | One-liner | Notes vs current `main` |
|----|------------|-----------|-------------------------|
| **1** | High-ish (88) | Cross-chain win settlement: unguarded `_quote` in `_sendWinnerCallback` can revert whole `_processWin`; spoke path lacked retry | Spoke half **mitigated by SCAN-M1** (`retryCallback` on `ChainlinkVRFIntegratorV2_5`, merged #718). Hub half **fixed** (`try this.sendWinnerCallbackExternal` + `CallbackDropReason.SEND_FAILED`) on `cursor/oda-v2-followup-26cd` |
| **2** | Medium (78) | `receiveRemoteLotteryEntry` trusts forwarder-supplied origin; no peer re-check; non-Solana no message replay id | **Fixed** — `authorizedRemoteOFTs` re-check + V3 non-zero `sourceEventId` required on forwarder lane |
| **3** | Medium (~70) | Instant `setAuthorizedSwapContract` / `rewardPercentage` / `setVRFIntegrator`; AMOE roots not timelocked | **Fixed** — VRF integrator bootstrap+2d queue; first swap-auth bootstrap then 2d queue (deauth instant); `rewardPercentage` changes queued 2d via `setLotteryConfig`; AMOE roots mature `ROOT_PUBLICATION_TIMELOCK` (1d) before ZK use. Queue/execute/cancel via `adminModuleCall` (EIP-170). Residual: payout % still live-at-settlement (no entry snapshot); optional sub-100% hard cap not taken |
| **4** | Low-Med (~70) | `processSwapLottery` keeps `msg.value` on early-return paths | **Fixed** — `_refundCallerFeeOrRevert` on early returns |
| **5** | Low | `VRFConsumer4626` / manager `_payNative` exact fee only | **Fixed** (LotteryManager) — accept `msg.value >= fee`, return `msg.value` for LZ refund |
| **6** | Low-Med (58) | Deferred VRF settle while paused re-enqueues | **Fixed** — `_settlingDeferredVrf` forces settle without FIFO re-enqueue |
| **7–23** | Low / Info | AMOE chainid binding, Ownable2Step, ECDSA stub, CEI, jackpot window, grace vs timeout, etc. | Backlog |

**Confirmed safe in report (do not re-open):** win-chance not steerable post-request; oracle fail-closed; AMOE nullifier rollback; local `retryLocalCallback` / cleanup not griefable for outcomes.

## Suggested fix order (follow-up PR)

1. ~~Hub `_sendWinnerCallback` try/catch~~ **done**  
2. ~~Forwarder peer + replay~~ **done**  
3. ~~Timelock cluster (Finding 3)~~ **done** (see row above)  
4. ~~`msg.value` refund + `_payNative` parity~~ **done**

## Residual / backlog after F3

- Snapshot `rewardPercentage` / `singleVaultJackpotOnly` at entry time (report recommendation; product tradeoff)  
- Optional on-chain cap on `rewardPercentage` well below 100%  
- Lows 7–23 (Ownable2Step, AMOE chainid binding, etc.)
