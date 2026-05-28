// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";

// Core Infrastructure
import {CreatorRegistry} from "../contracts/core/CreatorRegistry.sol";
import {CreatorOVaultFactory} from "../contracts/factories/CreatorOVaultFactory.sol";

// Shared Services
import {CreatorLotteryManager} from "../contracts/utilities/lottery/CreatorLotteryManager.sol";
import {CreatorVRFConsumerV2_5} from "../contracts/utilities/lottery/vrf/CreatorVRFConsumerV2_5.sol";
import {VaultActivationBatcher} from "../contracts/helpers/batchers/VaultActivationBatcher.sol";
import {SolanaBridgeAdapter} from "../contracts/utilities/bridge/SolanaBridgeAdapter.sol";

/**
 * @title DeployInfrastructure
 * @author 0xakita.eth (4626)
 * @notice Deploys all 4626 infrastructure contracts on Base
 *
 * @dev DEPLOYMENT ORDER:
 *      ┌─────────────────────────────────────────────────────────────────┐
 *      │  PHASE 1: Core Infrastructure (One-time deployment)             │
 *      │  ────────────────────────────────────────────────────────────   │
 *      │  1. CreatorRegistry         - Central registry for all data    │
 *      │  2. CreatorOVaultFactory    - Legacy registrar for script-deployed stacks │
 *      │  3. CreatorLotteryManager   - Shared lottery service           │
 *      │  4. CreatorVRFConsumerV2_5  - Chainlink VRF hub                │
 *      │  5. VaultActivationBatcher  - Shared activation launcher       │
 *      │  6. SolanaBridgeAdapter     - Shared Solana bridge adapter     │
 *      └─────────────────────────────────────────────────────────────────┘
 *
 *      ┌─────────────────────────────────────────────────────────────────┐
 *      │  PHASE 2: Configuration                                         │
 *      │  ────────────────────────────────────────────────────────────   │
 *      │  - Register Base chain in registry                              │
 *      │  - Set LayerZero endpoints                                      │
 *      │  - Authorize factories                                          │
 *      │  - Configure VRF subscription                                   │
 *      └─────────────────────────────────────────────────────────────────┘
 *
 * @dev RUN COMMAND:
 *      forge script script/DeployInfrastructure.s.sol:DeployInfrastructure \
 *          --rpc-url base \
 *          --broadcast \
 *          --verify \
 *          -vvvv
 *
 * @dev ENVIRONMENT VARIABLES:
 *      PRIVATE_KEY           - Deployer private key
 *      ETHERSCAN_API_KEY     - For contract verification
 *      VRF_SUBSCRIPTION_ID   - Chainlink VRF subscription (optional)
 *      PERMIT2               - Permit2 address for VaultActivationBatcher (optional)
 *      BASE_SHARED_GLOBAL_OUTPUT_PATH - Where to write the shared/global handoff artifact
 */
contract DeployInfrastructure is Script {
    // ═══════════════════════════════════════════════════════════════════
    //                         BASE MAINNET CONFIG
    // ═══════════════════════════════════════════════════════════════════

    /// @notice LayerZero V2 Endpoint on Base
    address constant LZ_ENDPOINT = 0x1a44076050125825900e736c501f859c50fE728c;

    /// @notice Chainlink ETH/USD Price Feed on Base
    address constant CHAINLINK_ETH_USD = 0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70;

    /// @notice Chainlink VRF Coordinator V2.5 on Base
    address constant VRF_COORDINATOR = 0xd5D517aBE5cF79B7e95eC98dB0f0277788aFF634;

    /// @notice Existing Tax Hook on Base (6.9% sell fees)
    address constant TAX_HOOK = 0xca975B9dAF772C71161f3648437c3616E5Be0088;

    /// @notice WETH on Base
    address constant WETH = 0x4200000000000000000000000000000000000006;

    /// @notice Base Chain ID
    uint256 constant BASE_CHAIN_ID = 8453;

    /// @notice Base LayerZero EID
    uint32 constant BASE_EID = 30184;

    /// @notice EntryPoint v0.6 (ERC-4337)
    address constant ENTRY_POINT = 0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789;

    // ═══════════════════════════════════════════════════════════════════
    //                         DEPLOYED CONTRACTS
    // ═══════════════════════════════════════════════════════════════════

    CreatorRegistry public registry;
    CreatorOVaultFactory public vaultFactory;
    CreatorLotteryManager public lotteryManager;
    CreatorVRFConsumerV2_5 public vrfConsumer;
    VaultActivationBatcher public vaultActivationBatcher;
    SolanaBridgeAdapter public solanaBridgeAdapter;

    // ═══════════════════════════════════════════════════════════════════
    //                              MAIN
    // ═══════════════════════════════════════════════════════════════════

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        string memory releaseTag = vm.envOr("DEPLOYMENT_EPOCH_TAG", string("v1.12.0"));
        string memory outputPath = vm.envOr(
            "BASE_SHARED_GLOBAL_OUTPUT_PATH", string.concat("./tmp/base-", releaseTag, "-shared-global.json")
        );

        _printHeader(deployer);

        vm.startBroadcast(deployerPrivateKey);

        // ═══════════════════════════════════════════════════════════════
        //                    PHASE 1: CORE CONTRACTS
        // ═══════════════════════════════════════════════════════════════

        console.log("\n");
        console.log(
            unicode"╔════════════════════════════════════════════════════════════════╗"
        );
        console.log(unicode"║              PHASE 1: Core Infrastructure                      ║");
        console.log(
            unicode"╚════════════════════════════════════════════════════════════════╝"
        );

        // 1. CreatorRegistry
        console.log("\n[1/6] Deploying CreatorRegistry...");
        registry = new CreatorRegistry(deployer);
        console.log("       Address:", address(registry));

        // 2. CreatorOVaultFactory (legacy deployment registrar)
        console.log("\n[2/6] Deploying CreatorOVaultFactory (legacy registrar)...");
        vaultFactory = new CreatorOVaultFactory(address(registry), deployer);
        console.log("       Address:", address(vaultFactory));

        // 3. VaultActivationBatcher (shared activation launcher)
        console.log("\n[3/6] Deploying VaultActivationBatcher...");
        address permit2 = vm.envOr("PERMIT2", address(0x000000000022D473030F116dDEE9F6B43aC78BA3));
        vaultActivationBatcher = new VaultActivationBatcher(permit2, address(registry));
        console.log("       Address:", address(vaultActivationBatcher));

        // 4. CreatorLotteryManager (shared service)
        console.log("\n[4/6] Deploying CreatorLotteryManager...");
        lotteryManager = new CreatorLotteryManager(address(registry), deployer);
        console.log("       Address:", address(lotteryManager));

        // 5. CreatorVRFConsumerV2_5 (VRF hub)
        console.log("\n[5/6] Deploying CreatorVRFConsumerV2_5...");
        vrfConsumer = new CreatorVRFConsumerV2_5(address(registry), deployer);
        console.log("       Address:", address(vrfConsumer));

        // 6. SolanaBridgeAdapter (shared bridge adapter)
        console.log("\n[6/6] Deploying SolanaBridgeAdapter...");
        solanaBridgeAdapter = new SolanaBridgeAdapter(address(registry), deployer);
        console.log("       Address:", address(solanaBridgeAdapter));

        // ═══════════════════════════════════════════════════════════════
        //                    PHASE 2: CONFIGURATION
        // ═══════════════════════════════════════════════════════════════

        console.log("\n");
        console.log(
            unicode"╔════════════════════════════════════════════════════════════════╗"
        );
        console.log(unicode"║              PHASE 2: Configuration                            ║");
        console.log(
            unicode"╚════════════════════════════════════════════════════════════════╝"
        );

        // Register Base chain
        console.log("\n[Config] Registering Base chain...");
        registry.registerChain(BASE_CHAIN_ID, "Base", WETH, true);

        // Configure DEX infra (optional but recommended for downstream tooling)
        // NOTE: PoolManager is known on Base; other periphery addresses can be set via envs.
        address poolManager = vm.envOr("POOL_MANAGER", address(0x498581fF718922c3f8e6A244956aF099B2652b2b));
        address swapRouter = vm.envOr("SWAP_ROUTER", address(0x2626664c2603336E57B271c5C0b26F421741e481)); // Uniswap router on Base
        address positionManager = vm.envOr("POSITION_MANAGER", address(0));
        address quoter = vm.envOr("QUOTER", address(0));
        registry.setDexInfrastructure(BASE_CHAIN_ID, poolManager, swapRouter, positionManager, quoter);
        console.log("[Config] Setting DEX infrastructure (poolManager/swapRouter/positionManager/quoter)...");

        // Set LayerZero endpoint
        console.log("[Config] Setting LayerZero endpoint...");
        registry.setLayerZeroEndpoint(BASE_CHAIN_ID, LZ_ENDPOINT);

        // Set chain ID to EID mapping
        console.log("[Config] Setting chain ID to EID mapping...");
        registry.setChainIdToEid(BASE_CHAIN_ID, BASE_EID);

        // Authorize legacy registrar/factory surface for downstream operations
        console.log("[Config] Authorizing legacy vault registrar...");
        registry.setAuthorizedFactory(address(vaultFactory), true);

        console.log("[Config] Authorizing VaultActivationBatcher...");
        registry.setAuthorizedFactory(address(vaultActivationBatcher), true);

        // Set hub chain (Base is the hub)
        console.log("[Config] Setting Base as hub chain...");
        registry.setHubChain(BASE_CHAIN_ID, BASE_EID);

        console.log("[Config] Setting Base lottery manager...");
        registry.setLotteryManager(BASE_CHAIN_ID, address(lotteryManager));

        // Set VRF coordinator in VRF consumer
        console.log("[Config] Setting VRF coordinator...");
        vrfConsumer.setVRFCoordinator(VRF_COORDINATOR);

        console.log("[Config] Authorizing LotteryManager on VRF consumer...");
        vrfConsumer.setLocalCallerAuthorization(address(lotteryManager), true);

        console.log("[Config] Wiring LotteryManager to local VRF consumer...");
        lotteryManager.setLocalVRFConsumer(address(vrfConsumer));
        lotteryManager.setUseLocalVRF(true);

        console.log("[Config] Wiring Solana bridge adapter to LotteryManager...");
        solanaBridgeAdapter.setLotteryManager(address(lotteryManager));
        lotteryManager.setAuthorizedSwapContract(address(solanaBridgeAdapter), true);

        vm.stopBroadcast();

        // ═══════════════════════════════════════════════════════════════
        //                         SUMMARY
        // ═══════════════════════════════════════════════════════════════

        _writeSharedGlobalArtifact(outputPath, releaseTag);
        _printSummary();
    }

    // ═══════════════════════════════════════════════════════════════════
    //                         HELPERS
    // ═══════════════════════════════════════════════════════════════════

    function _printHeader(address deployer) internal view {
        console.log("\n");
        console.log(
            unicode"╔════════════════════════════════════════════════════════════════╗"
        );
        console.log(unicode"║                                                                ║");
        console.log(
            unicode"║     ██████╗██████╗ ███████╗ █████╗ ████████╗ ██████╗ ██████╗   ║"
        );
        console.log(
            unicode"║    ██╔════╝██╔══██╗██╔════╝██╔══██╗╚══██╔══╝██╔═══██╗██╔══██╗  ║"
        );
        console.log(
            unicode"║    ██║     ██████╔╝█████╗  ███████║   ██║   ██║   ██║██████╔╝  ║"
        );
        console.log(
            unicode"║    ██║     ██╔══██╗██╔══╝  ██╔══██║   ██║   ██║   ██║██╔══██╗  ║"
        );
        console.log(
            unicode"║    ╚██████╗██║  ██║███████╗██║  ██║   ██║   ╚██████╔╝██║  ██║  ║"
        );
        console.log(
            unicode"║     ╚═════╝╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝   ╚═╝    ╚═════╝ ╚═╝  ╚═╝  ║"
        );
        console.log(unicode"║                         VAULT                                  ║");
        console.log(unicode"║                                                                ║");
        console.log(unicode"║            Infrastructure Deployment on Base                   ║");
        console.log(unicode"║                                                                ║");
        console.log(
            unicode"╚════════════════════════════════════════════════════════════════╝"
        );
        console.log("\n");
        console.log("Deployer:", deployer);
        console.log("Chain ID:", block.chainid);
        console.log("Network:  Base Mainnet");
    }

    function _printSummary() internal view {
        console.log("\n");
        console.log(
            unicode"╔════════════════════════════════════════════════════════════════╗"
        );
        console.log(unicode"║                    DEPLOYMENT COMPLETE                         ║");
        console.log(
            unicode"╚════════════════════════════════════════════════════════════════╝"
        );
        console.log("\n");
        console.log(
            unicode"┌─────────────────────────────────────────────────────────────────┐"
        );
        console.log(unicode"│  DEPLOYED CONTRACTS                                             │");
        console.log(
            unicode"├─────────────────────────────────────────────────────────────────┤"
        );
        console.log(unicode"│                                                                 │");
        console.log("   CreatorRegistry:        ", address(registry));
        console.log("   CreatorOVaultFactory (legacy registrar):", address(vaultFactory));
        console.log("   VaultActivationBatcher: ", address(vaultActivationBatcher));
        console.log("   CreatorLotteryManager:  ", address(lotteryManager));
        console.log("   CreatorVRFConsumerV2_5: ", address(vrfConsumer));
        console.log("   SolanaBridgeAdapter:    ", address(solanaBridgeAdapter));
        console.log(unicode"│                                                                 │");
        console.log(
            unicode"└─────────────────────────────────────────────────────────────────┘"
        );

        console.log("\n");
        console.log(
            unicode"┌─────────────────────────────────────────────────────────────────┐"
        );
        console.log(unicode"│  EXTERNAL CONTRACTS (Pre-deployed)                              │");
        console.log(
            unicode"├─────────────────────────────────────────────────────────────────┤"
        );
        console.log("   Tax Hook (6.9%):        ", TAX_HOOK);
        console.log("   EntryPoint v0.6:        ", ENTRY_POINT);
        console.log("   LayerZero Endpoint:     ", LZ_ENDPOINT);
        console.log("   VRF Coordinator:        ", VRF_COORDINATOR);
        console.log(
            unicode"└─────────────────────────────────────────────────────────────────┘"
        );

        console.log("\n");
        console.log(
            unicode"┌─────────────────────────────────────────────────────────────────┐"
        );
        console.log(unicode"│  ENVIRONMENT VARIABLES FOR AA DEPLOYMENT                        │");
        console.log(
            unicode"├─────────────────────────────────────────────────────────────────┤"
        );
        console.log(unicode"│                                                                 │");
        console.log("   # Add to your .env file:");
        console.log("   CREATOR_FACTORY=", address(vaultFactory), "   # legacy registrar");
        console.log("   CREATOR_REGISTRY=", address(registry));
        console.log("   LOTTERY_MANAGER=", address(lotteryManager));
        console.log("   CREATOR_LOTTERY_MANAGER=", address(lotteryManager));
        console.log("   CREATOR_VRF_CONSUMER=", address(vrfConsumer));
        console.log("   VAULT_ACTIVATION_BATCHER=", address(vaultActivationBatcher));
        console.log("   SOLANA_BRIDGE_ADAPTER=", address(solanaBridgeAdapter));
        console.log(unicode"│                                                                 │");
        console.log(
            unicode"└─────────────────────────────────────────────────────────────────┘"
        );

        console.log("\n");
        console.log(
            unicode"┌─────────────────────────────────────────────────────────────────┐"
        );
        console.log(unicode"│  LEGACY FACTORY NOTE                                             │");
        console.log(
            unicode"├─────────────────────────────────────────────────────────────────┤"
        );
        console.log(unicode"│  CreatorOVaultFactory is a legacy registrar, not the current    │");
        console.log(unicode"│  deployment engine. Do not build new paymaster allowlist        │");
        console.log(unicode"│  assumptions around it. Use the app deploy-session flow and     │");
        console.log(unicode"│  DeploymentBatcher for current deployments.                     │");
        console.log(unicode"│                                                                 │");
        console.log("   Legacy registrar:", address(vaultFactory));
        console.log(unicode"│                                                                 │");
        console.log(
            unicode"└─────────────────────────────────────────────────────────────────┘"
        );

        console.log("\n");
        console.log(
            unicode"╔════════════════════════════════════════════════════════════════╗"
        );
        console.log(unicode"║                        NEXT STEPS                              ║");
        console.log(
            unicode"╠════════════════════════════════════════════════════════════════╣"
        );
        console.log(unicode"║                                                                ║");
        console.log(unicode"║  1. Copy contract addresses to .env file                       ║");
        console.log(unicode"║  2. Hand off the emitted shared/global artifact into infra-v2   ║");
        console.log(unicode"║  3. Create & fund VRF subscription on Chainlink                ║");
        console.log(unicode"║  4. Launch creator vaults via app deploy-session flow (/deploy) ║");
        console.log(unicode"║  5. Treat CreatorOVaultFactory as legacy registry-only infra    ║");
        console.log(unicode"║                                                                ║");
        console.log(
            unicode"╚════════════════════════════════════════════════════════════════╝"
        );

        console.log("");
        console.log("Handoff env for downstream rollout:");
        console.log(string.concat("HANDOFF:REGISTRY=", vm.toString(address(registry))));
        console.log(string.concat("HANDOFF:CREATOR_REGISTRY=", vm.toString(address(registry))));
        console.log(string.concat("HANDOFF:CREATOR_FACTORY=", vm.toString(address(vaultFactory))));
        console.log(string.concat("HANDOFF:LOTTERY_MANAGER=", vm.toString(address(lotteryManager))));
        console.log(string.concat("HANDOFF:CREATOR_LOTTERY_MANAGER=", vm.toString(address(lotteryManager))));
        console.log(string.concat("HANDOFF:VRF_CONSUMER=", vm.toString(address(vrfConsumer))));
        console.log(string.concat("HANDOFF:CREATOR_VRF_CONSUMER=", vm.toString(address(vrfConsumer))));
        console.log(
            string.concat("HANDOFF:VAULT_ACTIVATION_BATCHER=", vm.toString(address(vaultActivationBatcher)))
        );
        console.log(string.concat("HANDOFF:SOLANA_BRIDGE_ADAPTER=", vm.toString(address(solanaBridgeAdapter))));
    }

    function _writeSharedGlobalArtifact(string memory outputPath, string memory releaseTag) internal {
        string memory artifactKey = "baseSharedGlobal";
        vm.serializeString(artifactKey, "releaseTag", releaseTag);
        vm.serializeUint(artifactKey, "chainId", block.chainid);
        vm.serializeAddress(artifactKey, "creatorRegistry", address(registry));
        vm.serializeAddress(artifactKey, "creatorVaultFactory", address(vaultFactory));
        vm.serializeAddress(artifactKey, "creatorLotteryManager", address(lotteryManager));
        vm.serializeAddress(artifactKey, "creatorVrfConsumerV2_5", address(vrfConsumer));
        vm.serializeAddress(artifactKey, "vaultActivationBatcher", address(vaultActivationBatcher));
        string memory json =
            vm.serializeAddress(artifactKey, "solanaBridgeAdapter", address(solanaBridgeAdapter));
        vm.writeJson(json, outputPath);
        console.log(string.concat("HANDOFF:BASE_SHARED_GLOBAL_OUTPUT_PATH=", outputPath));
    }
}

/**
 * @title DeployVaultStack
 * @notice Retired legacy per-creator script path.
 * @dev Kept only to fail fast with an explicit message if invoked by stale ops docs/tooling.
 */
contract DeployVaultStack is Script {
    function run() external pure {
        revert(
            "DeployVaultStack retired: use app deploy-session flow (/deploy) with DeploymentBatcher phases"
        );
    }
}
