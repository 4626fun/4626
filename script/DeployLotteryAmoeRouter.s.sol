// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";

import {AmoePlonkVerifier} from "../contracts/utilities/lottery/zk/AmoePlonkVerifier.sol";
import {LotteryAmoeRouter} from "../contracts/utilities/lottery/zk/LotteryAmoeRouter.sol";

/**
 * @title DeployLotteryAmoeRouter
 * @notice Deploy the AMOE PLONK verifier + router that records ZK-attested
 *         AMOE entries against `CreatorLotteryManager`.
 *
 * @dev    What this deploys
 *         - `AmoePlonkVerifier`: emitted by `snarkjs zkey export soliditverifier`
 *           from `circuits/amoe/build/plonk_fresh/amoe_plonk_final.zkey`. The
 *           zkey was produced from a `circom --O1` build of `amoe_eligibility.circom`
 *           combined with the universal Hermez powersOfTau pot17 SRS
 *           (`powersOfTau28_hez_final_17.ptau`). PLONK uses a universal
 *           trusted setup, so there is no per-circuit ceremony to run.
 *         - `LotteryAmoeRouter`: holds the per-epoch allowlist + points-burn
 *           ledger Merkle roots, verifies proofs against the PLONK verifier,
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
 *         1. `circuits/amoe/build/plonk_fresh/AmoePlonkVerifier_raw.sol`
 *            (snarkjs source-of-truth) byte-equals the cleaned
 *            `contracts/utilities/lottery/zk/AmoePlonkVerifier.sol` modulo
 *            our header banner + the renamed contract name.
 *         2. The on-disk zkey verifies a freshly-generated proof off-chain
 *            (`snarkjs plonk verify vk_plonk.json public_plonk.json proof_plonk.json`).
 *         3. `forge test --match-contract AmoePlonkVerifier` passes (real
 *            proof verifies, tampered rejects, gas ≈ 264,897).
 *
 * @dev    Usage:
 *         forge script script/DeployLotteryAmoeRouter.s.sol:DeployLotteryAmoeRouter \
 *             --rpc-url $BASE_RPC_URL \
 *             --broadcast \
 *             -vvvv
 */
contract DeployLotteryAmoeRouter is Script {
    function run() external returns (AmoePlonkVerifier verifier, LotteryAmoeRouter router) {
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

        verifier = new AmoePlonkVerifier();
        console.log("AmoePlonkVerifier:  ", address(verifier));

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
