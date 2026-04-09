---
name: lottery-vrf-ops
description: Operate the 4626 lottery randomness system (Chainlink VRF 2.5 hub on Base + LayerZero cross-chain integrator). Use when the user mentions VRF, subscriptionId, keyHash, VRF coordinator, callback gas limit, pending responses, cross-chain randomness, or lottery randomness/payout failures.
---

## Quick Start (most common)

- Collect inputs: chain (Base or remote), contract addresses, RPC URL, and the signer/admin address.
- Confirm current mode on the lottery manager:
  - Local VRF: `useLocalVRF = true` and `localVRFConsumer != 0x0`
  - Cross-chain VRF: `useLocalVRF = false` and `vrfIntegrator != 0x0` and `targetEid != 0`
- Confirm the VRF hub is configured (Base):
  - `vrfCoordinator != 0x0`
  - `subscriptionId > 0` and `keyHash != 0x0`
  - `callbackGasLimit` and `requestConfirmations` are sane
- If cross-chain, confirm the hub can respond:
  - fulfilled responses are queued (`pendingResponses`) and require a funded relayer call
  - relayer is authorized on hub (`authorizedRelayers`) and can send `relayPendingResponse(srcEid, sequence)`
- Run a small verification (read-only) using `cast call` before making any state changes.

## System Model (how randomness flows here)

- Hub (Base): `contracts/utilities/lottery/vrf/CreatorVRFConsumerV2_5.sol`
  - Receives remote requests via LayerZero (`_lzReceive`)
  - Requests randomness from Chainlink VRF Coordinator 2.5
  - Queues fulfilled remote responses and waits for relayer-funded send
  - Can also serve local requests (`requestRandomWordsLocal`) and call back local receivers
- Spoke (remote chains): `contracts/utilities/lottery/vrf/ChainlinkVRFIntegratorV2_5.sol`
  - Forwards "request randomness" to the hub
  - Receives randomness from hub and calls back the local requester
- Lottery manager (per chain): `contracts/utilities/lottery/CreatorLotteryManager.sol`
  - Triggered by swap activity (continuous, not scheduled draws)
  - Requests local VRF (if enabled) or cross-chain VRF via the integrator
  - Processes win/loss immediately when randomness arrives

## Required Inputs

- Chain/network: Base (hub) or which remote chain you are operating on
- RPC URL for that chain
- Contract addresses:
  - VRF hub (Base): `CreatorVRFConsumerV2_5`
  - Lottery manager on the chain: `CreatorLotteryManager`
  - VRF integrator on the chain (for cross-chain mode): `ChainlinkVRFIntegratorV2_5`
- VRF configuration (Base):
  - `subscriptionId` and `keyHash`
  - `callbackGasLimit` and `requestConfirmations`
- Admin identity:
  - EOA or multisig that is `owner()` on the contracts being changed

Never include private keys or full `.env` contents in output.

## Repo Map (what to read / where truth lives)

- Deployment script (Base infra): `script/DeployInfrastructure.s.sol` (sets VRF coordinator on the hub)
- Hub contract: `contracts/utilities/lottery/vrf/CreatorVRFConsumerV2_5.sol`
- Spoke contract: `contracts/utilities/lottery/vrf/ChainlinkVRFIntegratorV2_5.sol`
- Lottery manager: `contracts/utilities/lottery/CreatorLotteryManager.sol`
- Example deployed hub metadata/ABI: `deployments/base/contracts/services/lottery/vrf/CreatorVRFConsumerV2_5.json`
- Historical run artifacts: `broadcast/**` (local JSON logs may also be generated ad hoc)
- Notes: `docs/primitives/game-loop/lottery.md`

## Read-only Health Checks (preferred first)

Use these as templates (fill in `$RPC_URL`, `$VRF_CONSUMER`, `$LOTTERY_MANAGER`, `$INTEGRATOR`):

```bash
# Hub health (Base)
cast call --rpc-url $RPC_URL $VRF_CONSUMER "owner()(address)"
cast call --rpc-url $RPC_URL $VRF_CONSUMER "vrfCoordinator()(address)"
cast call --rpc-url $RPC_URL $VRF_CONSUMER "subscriptionId()(uint256)"
cast call --rpc-url $RPC_URL $VRF_CONSUMER "keyHash()(bytes32)"
cast call --rpc-url $RPC_URL $VRF_CONSUMER "callbackGasLimit()(uint32)"
cast call --rpc-url $RPC_URL $VRF_CONSUMER "requestConfirmations()(uint16)"
cast call --rpc-url $RPC_URL $VRF_CONSUMER "getContractStatus()(uint256,uint256,bool,uint32,uint256)"
cast call --rpc-url $RPC_URL $VRF_CONSUMER "quotePendingResponseFee(uint32,uint64)(uint256,bool)" $SRC_EID $SEQUENCE
cast call --rpc-url $RPC_URL $VRF_CONSUMER "getPendingResponseStatus(uint32,uint64)(uint256,bool,bool,bool,uint32,uint256)" $SRC_EID $SEQUENCE

# Lottery manager VRF mode
cast call --rpc-url $RPC_URL $LOTTERY_MANAGER "useLocalVRF()(bool)"
cast call --rpc-url $RPC_URL $LOTTERY_MANAGER "localVRFConsumer()(address)"
cast call --rpc-url $RPC_URL $LOTTERY_MANAGER "vrfIntegrator()(address)"
cast call --rpc-url $RPC_URL $LOTTERY_MANAGER "targetEid()(uint32)"
```

## Configuration Workflows

### A) Configure the VRF hub on Base (after deployment)

The deployment script sets the coordinator, but VRF still needs subscription/keyHash config.

Steps:

1. Confirm `vrfCoordinator()` is correct for Base and `owner()` is the expected admin.
2. Call `setVRFConfig(subscriptionId, keyHash, callbackGasLimit, requestConfirmations)` on the hub.
3. Ensure the Chainlink subscription has:
   - enough LINK/balance
   - the hub consumer address added as an authorized consumer (Chainlink UI/off-chain step)

### B) Enable cross-chain VRF on a chain (lottery manager)

Cross-chain mode means the chain’s `CreatorLotteryManager` requests randomness via a local `ChainlinkVRFIntegratorV2_5`, which forwards to the Base hub.

Checklist:

- Integrator has the correct `hubEid`
- LayerZero peers are configured between spoke integrator and hub VRF consumer (both directions)
- Hub relayer path is configured:
  - `authorizedRelayers(relayer) == true` (or relayer is owner)
  - relayer funds `relayPendingResponse(srcEid, sequence)` with `quotePendingResponseFee(srcEid, sequence).nativeFee`
- Verify receive-side protection is configured:
  - `rateLimitingEnabled` and per-chain/default limits are sane for traffic
- Lottery manager is configured:
  - `setVRFIntegrator(integrator)` (also marks it trusted)
  - `setTargetEid(<hubEid>)`
  - `setUseLocalVRF(false)`

### C) Enable local VRF mode on Base (lottery manager)

Local mode means the lottery manager calls `CreatorVRFConsumerV2_5.requestRandomWords()` directly, and receives the callback via `receiveRandomWords(requestId, randomWords)`.

Checklist:

- Hub is configured with VRF coordinator + subscription + keyHash
- Hub authorizes the lottery manager as a local caller (`authorizedLocalCallers`)
- Lottery manager is configured:
  - `setLocalVRFConsumer(<hub address>)`
  - `setUseLocalVRF(true)`

## Troubleshooting (common failures)

- Remote requests stuck / no callback:
  - Check hub emitted `ResponsePending(sequence, requestId, targetChain, reason)` and `ResponseQueuedForRelay(...)`.
  - Query `quotePendingResponseFee(srcEid, sequence)` and relay with exact value via `relayPendingResponse(srcEid, sequence)`.
  - Ensure caller is authorized (`authorizedRelayers`) or owner.
  - Verify LayerZero peers: `peers(eid)` must match the expected remote sender (both hub and spoke).
  - Check `supportedChains(srcEid)` on the hub for that remote chain.
- Remote requests missing after bursts:
  - Check for `CrossChainRequestRateLimited(...)` events on hub.
  - Tune `setRateLimitDefaults(...)` / `setChainRateLimit(...)` to match expected throughput.
- Local requests revert `Unauthorized`:
  - The hub requires `authorizedLocalCallers[msg.sender] = true` for `requestRandomWordsLocal()`.
  - Ensure the lottery manager (or your test caller) is authorized.
- Lottery entries return 0 / no entry created:
  - `CreatorLotteryManager` can return 0 if VRF is misconfigured (no integrator, not trusted, no `targetEid`, or local consumer unset).
  - Also check creator coin registration/active status and per-creator oracle freshness.

## Output Format (when using this skill)

Return a structured result:

- Summary: what was wrong and what was changed (or confirmed healthy)
- Inputs: chain, RPC, contract addresses, key config values (no secrets)
- Checks performed: which read-only calls and what they returned
- Actions taken (if any): tx hashes and which functions were called
- Verification: events observed or post-state reads confirming the fix
- Follow-ups: anything still risky or needing off-chain action (e.g., Chainlink subscription consumer add)
