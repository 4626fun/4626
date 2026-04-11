// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {CreatorLotteryManager} from "../contracts/utilities/lottery/CreatorLotteryManager.sol";
import {VaultActivationBatcher} from "../contracts/helpers/batchers/VaultActivationBatcher.sol";

/**
 * @title DeployTier1Upgrade
 * @author 0xakita.eth
 * @notice Deploys Tier 1 upgraded contracts (hub-centric architecture) and configures them
 *         against the EXISTING CreatorRegistry.
 *
 * @dev WHAT THIS DEPLOYS:
 *      1. CreatorLotteryManager  — hub-centric rewrite (receives remote lottery entries,
 *                                  sends targeted winner callbacks, sourceChainEid tracking)
 *      2. VaultActivationBatcher — adds three-way split support
 *                                  (40% CCA / 40% creator vesting / 20% Solana)
 *
 * @dev WHAT THIS DOES NOT DEPLOY:
 *      - CreatorRegistry — the existing registry is fully compatible with
 *        the new LotteryManager. Remote OFT peer features are additive and can be deployed
 *        later when multi-chain OFTs are ready.
 *
 * @dev POST-DEPLOY CONFIGURATION:
 *      1. Point registry to new LotteryManager:
 *         registry.setLotteryManager(8453, newLotteryManager)
 *      2. Configure VRF on new LotteryManager:
 *         lotteryManager.setLocalVRFConsumer(vrfConsumer)
 *         lotteryManager.setUseLocalVRF(true)
 *      3. Authorize VRF consumer to call back:
 *         vrfConsumer.setAuthorizedCaller(newLotteryManager, true)
 *      4. Authorize swap contracts (e.g., SolanaBridgeAdapter):
 *         lotteryManager.setAuthorizedSwapContract(adapter, true)
 *
 * @dev RUN COMMAND:
 *      forge script script/DeployTier1Upgrade.s.sol:DeployTier1Upgrade \
 *          --rpc-url base \
 *          --broadcast \
 *          --verify \
 *          -vvvv
 *
 * @dev DRY RUN (no broadcast):
 *      forge script script/DeployTier1Upgrade.s.sol:DeployTier1Upgrade \
 *          --rpc-url base \
 *          -vvvv
 */
contract DeployTier1Upgrade is Script {
    // ═══════════════════════════════════════════════════════════════════
    //                    EXISTING DEPLOYED CONTRACTS
    // ═══════════════════════════════════════════════════════════════════

    /// @notice Existing CreatorRegistry on Base (current live registry)
    address constant REGISTRY = 0x9D86e8FAfA39527c4FE13AAa8FBD2B424f9f65Fb;

    /// @notice Existing VRF Consumer on Base (unchanged, just needs configuration)
    address constant VRF_CONSUMER = 0xdd25Ed1b3D258Ccc6D306a9a325Af1A7F96C7F47;

    /// @notice Existing SolanaBridgeAdapter on Base
    address constant SOLANA_BRIDGE_ADAPTER = 0x90F578A4e23c1cB8DDFE63fd496ED7F4474f2b00;

    /// @notice Canonical Permit2 on Base
    address constant PERMIT2 = 0x000000000022D473030F116dDEE9F6B43aC78BA3;

    /// @notice Old LotteryManager being replaced
    address constant OLD_LOTTERY_MANAGER = 0xd593A8A58BDf7E7448D2dAbDE0Ae3B2BAFDA1357;

    /// @notice Old VaultActivationBatcher being replaced
    address constant OLD_BATCHER = 0x7Cc0050842433968cc7A0884d192b61FD0b46F63;

    // ═══════════════════════════════════════════════════════════════════
    //                         BASE CONFIG
    // ═══════════════════════════════════════════════════════════════════

    uint256 constant BASE_CHAIN_ID = 8453;

    // Lottery sponsorship guardrails (hybrid model defaults)
    uint256 constant SPONSORED_MIN_SWAP_USD = 10_000_000; // $10 (1e6)
    uint256 constant SPONSOR_EPOCH_DURATION = 1 hours;
    uint256 constant VRF_SPONSOR_MAX_FEE = 0.01 ether;
    uint256 constant VRF_SPONSOR_BUDGET = 0.25 ether;
    uint256 constant CALLBACK_SPONSOR_MAX_FEE = 0.01 ether;
    uint256 constant CALLBACK_SPONSOR_BUDGET = 0.1 ether;

    // ═══════════════════════════════════════════════════════════════════
    //                           OUTPUT
    // ═══════════════════════════════════════════════════════════════════

    CreatorLotteryManager public newLotteryManager;
    VaultActivationBatcher public newBatcher;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console.log("");
        console.log(
            unicode"╔════════════════════════════════════════════════════════════════╗"
        );
        console.log(unicode"║          Tier 1 Upgrade: Hub-Centric Architecture              ║");
        console.log(
            unicode"╚════════════════════════════════════════════════════════════════╝"
        );
        console.log("");
        console.log("Deployer:       ", deployer);
        console.log("Chain ID:       ", block.chainid);
        console.log("Registry:       ", REGISTRY);
        console.log("VRF Consumer:   ", VRF_CONSUMER);
        console.log("Old Lottery:    ", OLD_LOTTERY_MANAGER);
        console.log("Old Batcher:    ", OLD_BATCHER);
        console.log("");

        vm.startBroadcast(deployerPrivateKey);

        // ═══════════════════════════════════════════════════════════════
        //  STEP 1: Deploy new CreatorLotteryManager
        // ═══════════════════════════════════════════════════════════════

        console.log("[1/2] Deploying CreatorLotteryManager (hub-centric)...");

        newLotteryManager = new CreatorLotteryManager(REGISTRY, deployer);

        console.log("       Address:", address(newLotteryManager));
        console.log("");

        // ═══════════════════════════════════════════════════════════════
        //  STEP 2: Deploy new VaultActivationBatcher
        // ═══════════════════════════════════════════════════════════════

        console.log("[2/2] Deploying VaultActivationBatcher (three-way split)...");

        newBatcher = new VaultActivationBatcher(PERMIT2);

        console.log("       Address:", address(newBatcher));
        console.log("");

        // ═══════════════════════════════════════════════════════════════
        //  STEP 3: Configure LotteryManager
        // ═══════════════════════════════════════════════════════════════

        console.log(unicode"── Configuring LotteryManager ──");

        // Set local VRF consumer (existing, unchanged)
        newLotteryManager.setLocalVRFConsumer(VRF_CONSUMER);
        console.log("  setLocalVRFConsumer:", VRF_CONSUMER);

        // Enable local VRF mode (Base is the hub, VRF runs locally)
        newLotteryManager.setUseLocalVRF(true);
        console.log("  setUseLocalVRF: true");

        // Authorize the SolanaBridgeAdapter as a swap contract
        // (so it can call processSwapLottery for Solana-originated entries)
        newLotteryManager.setAuthorizedSwapContract(SOLANA_BRIDGE_ADAPTER, true);
        console.log("  setAuthorizedSwapContract(SolanaBridgeAdapter): true");

        // Configure bounded sponsorship defaults for cross-chain fees
        newLotteryManager.setSponsoredVrfMinSwapAmountUSD(SPONSORED_MIN_SWAP_USD);
        console.log("  setSponsoredVrfMinSwapAmountUSD: $10");

        newLotteryManager.setSponsorshipRateLimits(2, 10, 1, 10);
        console.log("  setSponsorshipRateLimits: vrfBuyer=2, vrfOrigin=10, cbBuyer=1, cbOrigin=10");

        newLotteryManager.setVrfSponsorshipPolicy(true, VRF_SPONSOR_MAX_FEE, VRF_SPONSOR_BUDGET, SPONSOR_EPOCH_DURATION);
        console.log("  setVrfSponsorshipPolicy: enabled, maxFee 0.01 ETH, budget 0.25 ETH/hr");

        newLotteryManager.setCallbackSponsorshipPolicy(
            true, CALLBACK_SPONSOR_MAX_FEE, CALLBACK_SPONSOR_BUDGET, SPONSOR_EPOCH_DURATION
        );
        console.log("  setCallbackSponsorshipPolicy: enabled, maxFee 0.01 ETH, budget 0.10 ETH/hr");

        console.log("");

        // ═══════════════════════════════════════════════════════════════
        //  STEP 4: Update Registry pointer
        // ═══════════════════════════════════════════════════════════════
        //
        //  NOTE: These calls require the deployer to be the registry owner.
        //  If the deployer is not the registry owner, these will revert and
        //  must be executed separately by the registry owner.
        //

        // ═══════════════════════════════════════════════════════════════
        //  STEP 4: Update Registry pointer (requires registry owner)
        // ═══════════════════════════════════════════════════════════════
        //
        //  The registry is owned by a different address. This step must
        //  be executed manually by the registry owner after deployment:
        //
        //    cast send 0x888506B92181c57A2fD06516FFFb6F375b7A4626 \
        //      "setLotteryManager(uint16,address)" 8453 <NEW_LOTTERY_MANAGER> \
        //      --rpc-url base --private-key <REGISTRY_OWNER_PK>
        //
        console.log(unicode"── Registry Update (manual step) ──");
        console.log("  Registry owner must call:");
        console.log("  registry.setLotteryManager(8453, newLotteryManager)");
        console.log("");

        console.log("");

        vm.stopBroadcast();

        // ═══════════════════════════════════════════════════════════════
        //                         SUMMARY
        // ═══════════════════════════════════════════════════════════════

        console.log(
            unicode"╔════════════════════════════════════════════════════════════════╗"
        );
        console.log(unicode"║                    DEPLOYMENT COMPLETE                         ║");
        console.log(
            unicode"╚════════════════════════════════════════════════════════════════╝"
        );
        console.log("");
        console.log(
            unicode"┌─────────────────────────────────────────────────────────────────┐"
        );
        console.log(unicode"│  NEW CONTRACTS                                                  │");
        console.log(
            unicode"├─────────────────────────────────────────────────────────────────┤"
        );
        console.log("  CreatorLotteryManager: ", address(newLotteryManager));
        console.log("  VaultActivationBatcher:", address(newBatcher));
        console.log(
            unicode"└─────────────────────────────────────────────────────────────────┘"
        );
        console.log("");
        console.log(
            unicode"┌─────────────────────────────────────────────────────────────────┐"
        );
        console.log(unicode"│  REMAINING MANUAL STEPS                                         │");
        console.log(
            unicode"├─────────────────────────────────────────────────────────────────┤"
        );
        console.log(unicode"│                                                                 │");
        console.log(unicode"│  1. VRF Consumer: authorize new LotteryManager as caller        │");
        console.log(unicode"│     vrfConsumer.setAuthorizedCaller(newLotteryManager, true)     │");
        console.log(unicode"│                                                                 │");
        console.log(unicode"│  2. VRF Consumer: set subscriptionId + keyHash                  │");
        console.log(unicode"│     vrfConsumer.setVRFConfig(subId, keyHash, cbGas, confirms)    │");
        console.log(unicode"│                                                                 │");
        console.log(unicode"│  3. Chainlink: add VRF Consumer as subscription consumer        │");
        console.log(unicode"│     (off-chain via vrf.chain.link dashboard)                    │");
        console.log(unicode"│                                                                 │");
        console.log(unicode"│  4. Fund VRF Consumer with ETH for LZ cross-chain responses     │");
        console.log(unicode"│                                                                 │");
        console.log(unicode"│  5. Fund LotteryManager with bounded ETH sponsorship budget      │");
        console.log(unicode"│                                                                 │");
        console.log(unicode"│  6. Update frontend/backend to reference new contract addresses │");
        console.log(unicode"│                                                                 │");
        console.log(unicode"│  7. (Optional) Pause old LotteryManager                        │");
        console.log(unicode"│     oldLotteryManager.pause()                                   │");
        console.log(unicode"│                                                                 │");
        console.log(
            unicode"└─────────────────────────────────────────────────────────────────┘"
        );
        console.log("");
        console.log(
            unicode"┌─────────────────────────────────────────────────────────────────┐"
        );
        console.log(unicode"│  ENVIRONMENT VARIABLES                                          │");
        console.log(
            unicode"├─────────────────────────────────────────────────────────────────┤"
        );
        console.log("  LOTTERY_MANAGER=", address(newLotteryManager));
        console.log("  VAULT_ACTIVATION_BATCHER=", address(newBatcher));
        console.log(
            unicode"└─────────────────────────────────────────────────────────────────┘"
        );
    }
}
