# Acceptance: C-02 — ChainlinkVRFAdapter.request gated to router

- **Finding IDs:** Codex 2026-07-22 VRF subscription drain (duplicate titles)
- **Severity (reported):** High
- **Status:** Fixed
- **Source:** Codex intake 2026-07-22

## Reported issue

`RandomnessRouter.acquireRequest` was already requester-gated, but
`ChainlinkVRFAdapter.request()` remained public. Once the adapter is an
authorized local caller on `VRFConsumer4626`, anyone could spam paid VRF.

## Fix

- Adapter stores `owner` + `requester`; `request()` requires `msg.sender == requester`.
- Deploy script sets requester to the deployed `RandomnessRouter`.
- Foundry tests cover non-router revert and router success.

## Verification

`forge test --match-path test/ChainlinkVRFAdapter.RequesterAuth.t.sol`
