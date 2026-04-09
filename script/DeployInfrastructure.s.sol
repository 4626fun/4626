// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";

// Core Infrastructure
import {CreatorRegistry} from "../contracts/core/CreatorRegistry.sol";
import {CreatorOVaultFactory} from "../contracts/factories/CreatorOVaultFactory.sol";

// Shared Services
import {CreatorLotteryManager} from "../contracts/utilities/lottery/CreatorLotteryManager.sol";
import {CreatorVRFConsumerV2_5} from "../contracts/utilities/lottery/vrf/CreatorVRFConsumerV2_5.sol";

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
 *      │  2. CreatorOVaultFactory    - Deploys per-creator contracts    │
 *      │  3. CreatorLotteryManager   - Shared lottery service           │
 *      │  4. CreatorVRFConsumerV2_5  - Chainlink VRF hub                │
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

    // ═══════════════════════════════════════════════════════════════════
    //                              MAIN
    // ═══════════════════════════════════════════════════════════════════

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

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
        console.log("\n[1/4] Deploying CreatorRegistry...");
        registry = new CreatorRegistry(deployer);
        console.log("       Address:", address(registry));

        // 2. CreatorOVaultFactory
        console.log("\n[2/4] Deploying CreatorOVaultFactory...");
        vaultFactory = new CreatorOVaultFactory(address(registry), deployer);
        console.log("       Address:", address(vaultFactory));

        // 3. CreatorLotteryManager (shared service)
        console.log("\n[3/4] Deploying CreatorLotteryManager...");
        lotteryManager = new CreatorLotteryManager(address(registry), deployer);
        console.log("       Address:", address(lotteryManager));

        // 4. CreatorVRFConsumerV2_5 (VRF hub)
        console.log("\n[4/4] Deploying CreatorVRFConsumerV2_5...");
        vrfConsumer = new CreatorVRFConsumerV2_5(address(registry), deployer);
        console.log("       Address:", address(vrfConsumer));

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

        // Authorize factories
        console.log("[Config] Authorizing vault factory...");
        registry.setAuthorizedFactory(address(vaultFactory), true);

        // Set hub chain (Base is the hub)
        console.log("[Config] Setting Base as hub chain...");
        registry.setHubChain(BASE_CHAIN_ID, BASE_EID);

        // Set VRF coordinator in VRF consumer
        console.log("[Config] Setting VRF coordinator...");
        vrfConsumer.setVRFCoordinator(VRF_COORDINATOR);

        vm.stopBroadcast();

        // ═══════════════════════════════════════════════════════════════
        //                         SUMMARY
        // ═══════════════════════════════════════════════════════════════

        _printSummary(deployer);
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

    function _printSummary(address deployer) internal view {
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
        console.log("   CreatorOVaultFactory:   ", address(vaultFactory));
        console.log("   CreatorLotteryManager:  ", address(lotteryManager));
        console.log("   CreatorVRFConsumerV2_5: ", address(vrfConsumer));
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
        console.log("   CREATOR_FACTORY=", address(vaultFactory));
        console.log("   CREATOR_REGISTRY=", address(registry));
        console.log("   LOTTERY_MANAGER=", address(lotteryManager));
        console.log(unicode"│                                                                 │");
        console.log(
            unicode"└─────────────────────────────────────────────────────────────────┘"
        );

        console.log("\n");
        console.log(
            unicode"┌─────────────────────────────────────────────────────────────────┐"
        );
        console.log(unicode"│  COINBASE PAYMASTER - CONTRACT ALLOWLIST                        │");
        console.log(
            unicode"├─────────────────────────────────────────────────────────────────┤"
        );
        console.log(unicode"│  Add these contracts to your Coinbase Developer Portal:         │");
        console.log(unicode"│                                                                 │");
        console.log("   1. CreatorOVaultFactory:    ", address(vaultFactory));
        console.log("      Function: deploy(address)");
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
        console.log(unicode"║  2. Add contracts to Coinbase Paymaster allowlist              ║");
        console.log(unicode"║  3. Create & fund VRF subscription on Chainlink                ║");
        console.log(unicode"║  4. Launch creator vaults via app deploy-session flow (/deploy) ║");
        console.log(unicode"║                                                                ║");
        console.log(
            unicode"╚════════════════════════════════════════════════════════════════╝"
        );
    }
}

/**
 * @title DeployVaultStack
 * @notice Retired legacy per-creator script path.
 * @dev Kept only to fail fast with an explicit message if invoked by stale ops docs/tooling.
 */
contract DeployVaultStack is Script {
    function run() external {
        revert(
            "DeployVaultStack retired: use app deploy-session flow (/deploy) with DeploymentBatcher phases"
        );
    }
}
