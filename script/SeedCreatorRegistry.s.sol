// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {CreatorRegistry} from "../contracts/core/CreatorRegistry.sol";
import {ICreatorRegistry} from "../contracts/interfaces/core/ICreatorRegistry.sol";

/**
 * @title SeedCreatorRegistry
 * @author 0xakita.eth
 * @notice Seeds the deployed CreatorRegistry with protocol-level configuration:
 *         chains, LayerZero endpoints, EIDs, DEX infrastructure, and hub chain.
 *
 * @dev This script does NOT register any creator-specific data (tokens, vaults, etc.).
 *      It only sets up the "global" config that every per-creator deployment relies on.
 *
 * @dev RUN COMMAND:
 *      forge script script/SeedCreatorRegistry.s.sol:SeedCreatorRegistry \
 *          --rpc-url base \
 *          --broadcast \
 *          -vvvv
 *
 * @dev DRY RUN (no broadcast):
 *      forge script script/SeedCreatorRegistry.s.sol:SeedCreatorRegistry \
 *          --rpc-url base \
 *          -vvvv
 */
contract SeedCreatorRegistry is Script {

    // ═══════════════════════════════════════════════════════════════════
    //                    DEPLOYED REGISTRY
    // ═══════════════════════════════════════════════════════════════════

    address constant REGISTRY = 0x888482d648D1fCa1A735268A9e579b44Bf644626;

    // ═══════════════════════════════════════════════════════════════════
    //                    CHAIN CONSTANTS
    // ═══════════════════════════════════════════════════════════════════

    // --- Base (Hub) ---
    uint16  constant BASE_CHAIN_ID   = 8453;
    uint32  constant BASE_EID        = 30184;
    address constant BASE_WETH       = 0x4200000000000000000000000000000000000006;
    address constant BASE_LZ_ENDPOINT = 0x1a44076050125825900e736c501f859c50fE728c;

    // --- Ethereum ---
    uint16  constant ETH_CHAIN_ID    = 1;
    uint32  constant ETH_EID         = 30101;
    address constant ETH_WETH        = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    address constant ETH_LZ_ENDPOINT = 0x1a44076050125825900e736c501f859c50fE728c;

    // --- Arbitrum ---
    uint16  constant ARB_CHAIN_ID    = 42161;
    uint32  constant ARB_EID         = 30110;
    address constant ARB_WETH        = 0x82aF49447D8a07e3bd95BD0d56f35241523fBab1;
    address constant ARB_LZ_ENDPOINT = 0x1a44076050125825900e736c501f859c50fE728c;

    // --- BSC ---
    uint16  constant BSC_CHAIN_ID    = 56;
    uint32  constant BSC_EID         = 30102;
    address constant BSC_WBNB        = 0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c;
    address constant BSC_LZ_ENDPOINT = 0x1a44076050125825900e736c501f859c50fE728c;

    // --- Avalanche ---
    uint16  constant AVAX_CHAIN_ID   = 43114;
    uint32  constant AVAX_EID        = 30106;
    address constant AVAX_WAVAX      = 0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7;
    address constant AVAX_LZ_ENDPOINT = 0x1a44076050125825900e736c501f859c50fE728c;

    // --- Monad ---
    uint16  constant MONAD_CHAIN_ID  = 10143;
    uint32  constant MONAD_EID       = 30390;
    address constant MONAD_WMON      = address(0); // TBD at launch
    address constant MONAD_LZ_ENDPOINT = 0x6F475642a6e85809B1c36Fa62763669b1b48DD5B;

    // ═══════════════════════════════════════════════════════════════════
    //                    BASE DEX INFRASTRUCTURE
    // ═══════════════════════════════════════════════════════════════════

    address constant POOL_MANAGER     = 0x498581fF718922c3f8e6A244956aF099B2652b2b;
    address constant SWAP_ROUTER      = 0x2626664c2603336E57B271c5C0b26F421741e481;
    address constant POSITION_MANAGER = address(0); // Set later if needed
    address constant QUOTER           = address(0); // Set later if needed

    // ═══════════════════════════════════════════════════════════════════
    //                    OTHER INFRA
    // ═══════════════════════════════════════════════════════════════════

    address constant CHAINLINK_ETH_USD   = 0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70;
    address constant CREATOR_FACTORY     = 0xcCa08f9b94dD478266D0D1D2e9B7758414280FfD;
    address constant LOTTERY_MANAGER     = 0x77740C44A3E1d8262e8bfAB6204A29B2cbeE4626;
    address constant VAULT_BATCHER       = 0xF80a991dF64207Ff9C7A04eD3339e404Bc11d1CE;
    address constant VAULT_ACT_BATCHER   = 0xd17Ddf952Cc8614721b5F79E43E9c2562FaBcdeB;

    // ═══════════════════════════════════════════════════════════════════
    //                              MAIN
    // ═══════════════════════════════════════════════════════════════════

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        CreatorRegistry registry = CreatorRegistry(REGISTRY);

        console.log("");
        console.log(unicode"╔════════════════════════════════════════════════════════════════╗");
        console.log(unicode"║       SeedCreatorRegistry — Protocol Config (no creators)      ║");
        console.log(unicode"╚════════════════════════════════════════════════════════════════╝");
        console.log("");
        console.log("Registry:    ", REGISTRY);
        console.log("Owner:       ", registry.owner());
        console.log("Deployer/Tx: ", deployer);
        console.log("Chain ID:    ", block.chainid);
        console.log("");

        require(registry.owner() == deployer, "Deployer is not registry owner");

        vm.startBroadcast(deployerPrivateKey);

        // ────────────────────────────────────────────────────────────────
        //  1. REGISTER CHAINS
        // ────────────────────────────────────────────────────────────────

        console.log("[1/5] Registering chains...");

        // Base (hub chain)
        _tryRegisterChain(registry, BASE_CHAIN_ID, "Base", BASE_WETH);

        // Ethereum
        _tryRegisterChain(registry, ETH_CHAIN_ID, "Ethereum", ETH_WETH);

        // Arbitrum
        _tryRegisterChain(registry, ARB_CHAIN_ID, "Arbitrum", ARB_WETH);

        // BSC
        _tryRegisterChain(registry, BSC_CHAIN_ID, "BSC", BSC_WBNB);

        // Avalanche
        _tryRegisterChain(registry, AVAX_CHAIN_ID, "Avalanche", AVAX_WAVAX);

        // Monad (only register if WMON address is set)
        if (MONAD_WMON != address(0)) {
            _tryRegisterChain(registry, MONAD_CHAIN_ID, "Monad", MONAD_WMON);
        } else {
            console.log(unicode"   [skip] Monad — WMON not set yet");
        }

        // ────────────────────────────────────────────────────────────────
        //  2. SET LAYERZERO ENDPOINTS
        // ────────────────────────────────────────────────────────────────

        console.log("\n[2/5] Setting LayerZero endpoints...");

        registry.setLayerZeroEndpoint(BASE_CHAIN_ID, BASE_LZ_ENDPOINT);
        console.log(unicode"   ✓ Base");

        registry.setLayerZeroEndpoint(ETH_CHAIN_ID, ETH_LZ_ENDPOINT);
        console.log(unicode"   ✓ Ethereum");

        registry.setLayerZeroEndpoint(ARB_CHAIN_ID, ARB_LZ_ENDPOINT);
        console.log(unicode"   ✓ Arbitrum");

        registry.setLayerZeroEndpoint(BSC_CHAIN_ID, BSC_LZ_ENDPOINT);
        console.log(unicode"   ✓ BSC");

        registry.setLayerZeroEndpoint(AVAX_CHAIN_ID, AVAX_LZ_ENDPOINT);
        console.log(unicode"   ✓ Avalanche");

        if (MONAD_WMON != address(0)) {
            registry.setLayerZeroEndpoint(MONAD_CHAIN_ID, MONAD_LZ_ENDPOINT);
            console.log(unicode"   ✓ Monad");
        }

        // ────────────────────────────────────────────────────────────────
        //  3. SET CHAIN ID ↔ EID MAPPINGS
        // ────────────────────────────────────────────────────────────────

        console.log("\n[3/5] Setting chainId <-> EID mappings...");

        registry.setChainIdToEid(BASE_CHAIN_ID, BASE_EID);
        console.log(unicode"   ✓ Base  8453 <-> 30184");

        registry.setChainIdToEid(ETH_CHAIN_ID, ETH_EID);
        console.log(unicode"   ✓ Ethereum  1 <-> 30101");

        registry.setChainIdToEid(ARB_CHAIN_ID, ARB_EID);
        console.log(unicode"   ✓ Arbitrum  42161 <-> 30110");

        registry.setChainIdToEid(BSC_CHAIN_ID, BSC_EID);
        console.log(unicode"   ✓ BSC  56 <-> 30102");

        registry.setChainIdToEid(AVAX_CHAIN_ID, AVAX_EID);
        console.log(unicode"   ✓ Avalanche  43114 <-> 30106");

        if (MONAD_WMON != address(0)) {
            registry.setChainIdToEid(MONAD_CHAIN_ID, MONAD_EID);
            console.log(unicode"   ✓ Monad  10143 <-> 30390");
        }

        // ────────────────────────────────────────────────────────────────
        //  4. SET BASE DEX INFRASTRUCTURE + HUB
        // ────────────────────────────────────────────────────────────────

        console.log("\n[4/5] Configuring Base DEX infrastructure & hub chain...");

        registry.setDexInfrastructure(
            BASE_CHAIN_ID,
            POOL_MANAGER,
            SWAP_ROUTER,
            POSITION_MANAGER,
            QUOTER
        );
        console.log(unicode"   ✓ DEX infra (PoolManager, SwapRouter)");

        registry.setHubChain(BASE_CHAIN_ID, BASE_EID);
        console.log(unicode"   ✓ Hub chain set to Base");

        // ────────────────────────────────────────────────────────────────
        //  5. AUTHORIZE FACTORIES & BATCHERS
        // ────────────────────────────────────────────────────────────────

        console.log("\n[5/5] Authorizing factories and batchers...");

        if (CREATOR_FACTORY != address(0)) {
            registry.setAuthorizedFactory(CREATOR_FACTORY, true);
            console.log(unicode"   ✓ CreatorOVaultFactory authorized");
        }

        if (VAULT_BATCHER != address(0)) {
            registry.setAuthorizedFactory(VAULT_BATCHER, true);
            console.log(unicode"   ✓ CreatorVaultBatcher authorized");
        }

        if (VAULT_ACT_BATCHER != address(0)) {
            registry.setAuthorizedFactory(VAULT_ACT_BATCHER, true);
            console.log(unicode"   ✓ VaultActivationBatcher authorized");
        }

        vm.stopBroadcast();

        // ────────────────────────────────────────────────────────────────
        //  SUMMARY
        // ────────────────────────────────────────────────────────────────

        console.log("");
        console.log(unicode"╔════════════════════════════════════════════════════════════════╗");
        console.log(unicode"║                    SEED COMPLETE                               ║");
        console.log(unicode"╚════════════════════════════════════════════════════════════════╝");
        console.log("");
        console.log(unicode"  ✓ Registry:          ", REGISTRY);
        console.log(unicode"  ✓ Chains registered:  Base, Ethereum, Arbitrum, BSC, Avalanche");
        console.log(unicode"  ✓ LZ endpoints set:   5 chains");
        console.log(unicode"  ✓ EID mappings set:   5 chains");
        console.log(unicode"  ✓ Hub chain:          Base (8453 / EID 30184)");
        console.log(unicode"  ✓ DEX infra:          PoolManager + SwapRouter on Base");
        console.log(unicode"  ✓ Factories auth'd:   CreatorOVaultFactory, Batcher, ActivationBatcher");
        console.log("");
        console.log("   No creator-specific data was registered.");
        console.log("   Creator tokens/vaults are registered per-deployment via DeployCreatorVault.");
        console.log("");
    }

    // ═══════════════════════════════════════════════════════════════════
    //                         HELPERS
    // ═══════════════════════════════════════════════════════════════════

    /**
     * @dev Attempts to register a chain. Checks if already registered first to avoid reverts.
     */
    function _tryRegisterChain(
        CreatorRegistry registry,
        uint16 chainId,
        string memory name,
        address wrappedNative
    ) internal {
        // Check if chain already exists by reading config
        ICreatorRegistry.ChainConfig memory cfg = registry.getChainConfig(chainId);
        if (cfg.chainId != 0) {
            console.log(unicode"   [skip]", name, unicode"— already registered");
            return;
        }
        registry.registerChain(chainId, name, wrappedNative, true);
        console.log(unicode"   ✓", name);
    }
}
