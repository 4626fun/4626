// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";

import {AmoeGroth16Verifier_v2} from "../contracts/utilities/lottery/zk/AmoeGroth16Verifier_v2.sol";
import {LotteryAmoeRouter} from "../contracts/utilities/lottery/zk/LotteryAmoeRouter.sol";

/**
 * @title DeployLotteryAmoeRouter
 * @notice Deploy the AMOE Groth16 verifier + router that records ZK-attested
 *         AMOE entries against `CreatorLotteryManager`.
 *
 * @dev    What this deploys
 *         - `AmoeGroth16Verifier_v2`: emitted from
 *           `circuits/amoe/build/amoe_v2_final.zkey` after the v2 phase-2
 *           ceremony (see `circuits/amoe/ceremony/v2/CEREMONY.md` and the
 *           run record in `circuits/amoe/ceremony/v2/CEREMONY_RUN_TESTNET.md`).
 *           v2 exposes 8 public inputs and matches `IAmoeGroth16Verifier`.
 *         - `LotteryAmoeRouter`: holds the per-epoch allowlist + points-burn
 *           ledger Merkle roots, verifies proofs against the v2 verifier,
 *           and forwards entries to the lottery manager.
 *
 * @dev    Required env vars:
 *         - PRIVATE_KEY:           deployer
 *         - AMOE_OWNER:            router owner (rotates verifier, sets consumer)
 *         - AMOE_PUBLISHER:        backend signer that publishes daily allowlist roots
 *
 * @dev    Optional env vars:
 *         - AMOE_CONSUMER:         CreatorLotteryManager (or a forwarder). If
 *                                  unset, the router is deployed without a
 *                                  consumer and `setConsumer` must be called.
 *
 * @dev    Pre-deploy checklist:
 *         1. `tools/zk/verify_amoe_ceremony.sh` must pass (asserts the on-disk
 *            zkey verifies cleanly against the Hermez ptau-14).
 *         2. `tools/ci/check_amoe_vk.sh` rejects placeholder verifying keys.
 *         3. The verifier contract bytecode SHA must match the one CI emitted
 *            from the same zkey on this branch's HEAD.
 *         4. For mainnet: a multi-contributor v2 ceremony must replace the
 *            single-contributor testnet record. The current verifier on this
 *            branch is TESTNET ONLY — see CEREMONY_RUN_TESTNET.md.
 *
 * @dev    Usage:
 *         forge script script/DeployLotteryAmoeRouter.s.sol:DeployLotteryAmoeRouter \
 *             --rpc-url $BASE_RPC_URL \
 *             --broadcast \
 *             -vvvv
 */
contract DeployLotteryAmoeRouter is Script {
    function run() external returns (AmoeGroth16Verifier_v2 verifier, LotteryAmoeRouter router) {
        uint256 privateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(privateKey);

        address owner = vm.envAddress("AMOE_OWNER");
        address publisher = vm.envAddress("AMOE_PUBLISHER");
        address consumer = vm.envOr("AMOE_CONSUMER", address(0));

        console.log("Chain ID:    ", block.chainid);
        console.log("Deployer:    ", deployer);
        console.log("Owner:       ", owner);
        console.log("Publisher:   ", publisher);
        console.log("Consumer:    ", consumer);

        vm.startBroadcast(privateKey);

        verifier = new AmoeGroth16Verifier_v2();
        console.log("AmoeGroth16Verifier_v2:", address(verifier));

        router = new LotteryAmoeRouter(owner, publisher, address(verifier));
        console.log("LotteryAmoeRouter:  ", address(router));

        // Wire the consumer if provided. If not, the deployer must call
        // `setConsumer` from the owner address later.
        if (consumer != address(0) && owner == deployer) {
            router.setConsumer(consumer);
            console.log("Consumer wired:     ", consumer);
        }

        vm.stopBroadcast();
    }
}
