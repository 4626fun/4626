// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";

import "../contracts/helpers/batchers/DeploymentBatcher.sol";
import "../contracts/helpers/infra/UniversalBytecodeStoreV2.sol";
import "../contracts/factories/UniversalCreate2DeployerFromStore.sol";
import {CreatorOVaultAdminModule} from "../contracts/vault/modules/CreatorOVaultAdminModule.sol";
import {CreatorOVaultCoreModule} from "../contracts/vault/modules/CreatorOVaultCoreModule.sol";
import {CreatorOVaultStrategiesModule} from "../contracts/vault/modules/CreatorOVaultStrategiesModule.sol";

/// @notice Deploys the phased 4626 deployment batcher (Phases 1–3) on Base mainnet.
///
/// Why:
/// - The legacy one-tx deploy+launch flow no longer fits in a single Base tx due to code-deposit gas limits.
/// - This deployer splits deployment into multiple transactions while keeping the same infra (v2 store + deployer).
///
/// Run (broadcast):
///   export BASE_RPC_URL="https://mainnet.base.org"
///   forge script script/DeployBaseMainnetDeployer.s.sol:DeployBaseMainnetDeployer --rpc-url "$BASE_RPC_URL" --broadcast
///
/// Env:
///   PRIVATE_KEY=...
///   REGISTRY=...
///   PROTOCOL_TREASURY=...
///   POOL_MANAGER=...
///   TAX_HOOK=...
///   CHAINLINK_ETH_USD=...
///   VAULT_ACTIVATION_BATCHER=...
///   LOTTERY_MANAGER=...
///   PERMIT2=...
///   USDC=...
///   UNISWAP_V3_FACTORY=...
///   UNISWAP_ROUTER=...
///   AJNA_FACTORY=...
/// Optional Solana wiring (requires broadcaster == protocolTreasury):
///   CONFIGURE_SOLANA=1
///   SOLANA_BRIDGE_ADAPTER=...
///   SOLANA_DESTINATION=0x<32-byte-solana-pubkey>
/// Optional OVault runtime wiring (requires broadcaster == protocolTreasury):
///   CONFIGURE_OVAULT_RUNTIME=1
///   OVAULT_HUB_COMPOSER=...
///   OVAULT_SOLANA_EID=30168
///
/// Optional salt overrides (for fresh infra epochs):
///   INFRA_STORE_SALT or INFRA_STORE_SALT_TAG
///   INFRA_DEPLOYER_FROM_STORE_SALT or INFRA_DEPLOYER_FROM_STORE_SALT_TAG
///   INFRA_VAULT_CORE_MODULE_SALT or INFRA_VAULT_CORE_MODULE_SALT_TAG
///   INFRA_VAULT_STRATEGIES_MODULE_SALT or INFRA_VAULT_STRATEGIES_MODULE_SALT_TAG
///   INFRA_VAULT_ADMIN_MODULE_SALT or INFRA_VAULT_ADMIN_MODULE_SALT_TAG
///   INFRA_DEPLOYMENT_BATCHER_SALT or INFRA_DEPLOYMENT_BATCHER_SALT_TAG
contract DeployBaseMainnetDeployer is Script {
    // EIP-2470 universal CREATE2 factory.
    address constant CREATE2_FACTORY_ADDR = 0x4e59b44847b379578588920cA78FbF26c0B4956C;

    // Default salt tags. Scripts may override with:
    // - raw bytes32: INFRA_*_SALT
    // - string tag (hashed with keccak256): INFRA_*_SALT_TAG
    string constant DEFAULT_STORE_SALT_TAG = "4626:UniversalBytecodeStore:v1.7.1";
    string constant DEFAULT_DEPLOYER_FROM_STORE_SALT_TAG = "4626:UniversalCreate2DeployerFromStore:v1.7.1";

    // CreatorOVault module salts (shared logic contracts; no constructor args).
    string constant DEFAULT_VAULT_CORE_MODULE_SALT_TAG = "4626:CreatorOVaultCoreModule:v1.7.1";
    string constant DEFAULT_VAULT_STRATEGIES_MODULE_SALT_TAG = "4626:CreatorOVaultStrategiesModule:v1.7.1";
    string constant DEFAULT_VAULT_ADMIN_MODULE_SALT_TAG = "4626:CreatorOVaultAdminModule:v1.7.1";

    // DeploymentBatcher salt (constructor args are chain-specific ⇒ address is chain-specific).
    string constant DEFAULT_DEPLOYMENT_BATCHER_SALT_TAG = "4626:DeploymentBatcher:v1.7.1";

    // Defaults (Base mainnet) — can be overridden via env.
    address constant DEFAULT_REGISTRY = 0x888506B92181c57A2fD06516FFFb6F375b7A4626;
    address constant DEFAULT_PROTOCOL_TREASURY = 0x7d429eCbdcE5ff516D6e0a93299cbBa97203f2d3;
    address constant DEFAULT_POOL_MANAGER = 0x498581fF718922c3f8e6A244956aF099B2652b2b;
    address constant DEFAULT_TAX_HOOK = 0xca975B9dAF772C71161f3648437c3616E5Be0088;
    address constant DEFAULT_CHAINLINK_ETH_USD = 0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70;
    address constant DEFAULT_VAULT_ACTIVATION_BATCHER = 0xd17Ddf952Cc8614721b5F79E43E9c2562FaBcdeB;
    address constant DEFAULT_LOTTERY_MANAGER = 0x3F7AfD93824Ab25F73Bdca59aFDaB560F865b0C3;
    address constant DEFAULT_PERMIT2 = 0x000000000022D473030F116dDEE9F6B43aC78BA3;
    address constant DEFAULT_USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
    address constant DEFAULT_UNISWAP_V3_FACTORY = 0x33128a8fC17869897dcE68Ed026d694621f6FDfD;
    address constant DEFAULT_UNISWAP_ROUTER = 0x2626664c2603336E57B271c5C0b26F421741e481;
    address constant DEFAULT_AJNA_FACTORY = 0x214f62B5836D83f3D6c4f71F174209097B1A779C;

    struct Config {
        address registry;
        address protocolTreasury;
        address poolManager;
        address taxHook;
        address chainlinkEthUsd;
        address vaultActivationBatcher;
        address lotteryManager;
        address permit2;
        address usdc;
        address uniswapV3Factory;
        address uniswapRouter;
        address ajnaFactory;
        address solanaBridgeAdapter;
        bytes32 solanaDestination;
        address ovaultHubComposer;
        uint32 ovaultSolanaEid;
    }

    struct SaltConfig {
        bytes32 store;
        bytes32 deployerFromStore;
        bytes32 vaultCoreModule;
        bytes32 vaultStrategiesModule;
        bytes32 vaultAdminModule;
        bytes32 deploymentBatcher;
    }

    function _create2(address deployer, bytes32 salt, bytes32 initCodeHash) internal pure returns (address) {
        return address(uint160(uint256(keccak256(abi.encodePacked(bytes1(0xff), deployer, salt, initCodeHash)))));
    }

    function _saltFromEnv(string memory rawKey, string memory tagKey, string memory defaultTag)
        internal
        returns (bytes32)
    {
        bytes32 raw = vm.envOr(rawKey, bytes32(0));
        if (raw != bytes32(0)) return raw;
        string memory tag = vm.envOr(tagKey, defaultTag);
        return keccak256(bytes(tag));
    }

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address broadcaster = vm.addr(pk);

        Config memory cfg;
        cfg.registry = vm.envOr("REGISTRY", DEFAULT_REGISTRY);
        cfg.protocolTreasury = vm.envOr("PROTOCOL_TREASURY", DEFAULT_PROTOCOL_TREASURY);
        cfg.poolManager = vm.envOr("POOL_MANAGER", DEFAULT_POOL_MANAGER);
        cfg.taxHook = vm.envOr("TAX_HOOK", DEFAULT_TAX_HOOK);
        cfg.chainlinkEthUsd = vm.envOr("CHAINLINK_ETH_USD", DEFAULT_CHAINLINK_ETH_USD);
        cfg.vaultActivationBatcher = vm.envOr("VAULT_ACTIVATION_BATCHER", DEFAULT_VAULT_ACTIVATION_BATCHER);
        cfg.lotteryManager = vm.envOr("LOTTERY_MANAGER", DEFAULT_LOTTERY_MANAGER);
        cfg.permit2 = vm.envOr("PERMIT2", DEFAULT_PERMIT2);
        cfg.usdc = vm.envOr("USDC", DEFAULT_USDC);
        cfg.uniswapV3Factory = vm.envOr("UNISWAP_V3_FACTORY", DEFAULT_UNISWAP_V3_FACTORY);
        cfg.uniswapRouter = vm.envOr("UNISWAP_ROUTER", DEFAULT_UNISWAP_ROUTER);
        cfg.ajnaFactory = vm.envOr("AJNA_FACTORY", DEFAULT_AJNA_FACTORY);
        cfg.solanaBridgeAdapter = vm.envOr("SOLANA_BRIDGE_ADAPTER", address(0));
        cfg.solanaDestination = vm.envOr("SOLANA_DESTINATION", bytes32(0));
        cfg.ovaultHubComposer = vm.envOr("OVAULT_HUB_COMPOSER", address(0));
        cfg.ovaultSolanaEid = uint32(vm.envOr("OVAULT_SOLANA_EID", uint256(0)));
        bool configureSolana = vm.envOr("CONFIGURE_SOLANA", uint256(0)) == 1;
        bool configureOvaultRuntime = vm.envOr("CONFIGURE_OVAULT_RUNTIME", uint256(0)) == 1;
        SaltConfig memory salts;
        salts.store = _saltFromEnv("INFRA_STORE_SALT", "INFRA_STORE_SALT_TAG", DEFAULT_STORE_SALT_TAG);
        salts.deployerFromStore = _saltFromEnv(
            "INFRA_DEPLOYER_FROM_STORE_SALT",
            "INFRA_DEPLOYER_FROM_STORE_SALT_TAG",
            DEFAULT_DEPLOYER_FROM_STORE_SALT_TAG
        );
        salts.vaultCoreModule = _saltFromEnv(
            "INFRA_VAULT_CORE_MODULE_SALT", "INFRA_VAULT_CORE_MODULE_SALT_TAG", DEFAULT_VAULT_CORE_MODULE_SALT_TAG
        );
        salts.vaultStrategiesModule = _saltFromEnv(
            "INFRA_VAULT_STRATEGIES_MODULE_SALT",
            "INFRA_VAULT_STRATEGIES_MODULE_SALT_TAG",
            DEFAULT_VAULT_STRATEGIES_MODULE_SALT_TAG
        );
        salts.vaultAdminModule = _saltFromEnv(
            "INFRA_VAULT_ADMIN_MODULE_SALT",
            "INFRA_VAULT_ADMIN_MODULE_SALT_TAG",
            DEFAULT_VAULT_ADMIN_MODULE_SALT_TAG
        );
        salts.deploymentBatcher = _saltFromEnv(
            "INFRA_DEPLOYMENT_BATCHER_SALT",
            "INFRA_DEPLOYMENT_BATCHER_SALT_TAG",
            DEFAULT_DEPLOYMENT_BATCHER_SALT_TAG
        );

        console2.log("Broadcaster:", broadcaster);
        console2.log("Broadcaster balance (ETH):", broadcaster.balance);
        console2.log("Infra store salt:", uint256(salts.store));
        console2.log("Infra deployer-from-store salt:", uint256(salts.deployerFromStore));
        console2.log("Infra vault core module salt:", uint256(salts.vaultCoreModule));
        console2.log("Infra vault strategies module salt:", uint256(salts.vaultStrategiesModule));
        console2.log("Infra vault admin module salt:", uint256(salts.vaultAdminModule));
        console2.log("Infra deployment batcher salt:", uint256(salts.deploymentBatcher));

        // Predict deterministic addresses for v2 store + v2 deployer.
        bytes memory storeInit = type(UniversalBytecodeStoreV2).creationCode;
        address storeAddr = _create2(CREATE2_FACTORY_ADDR, salts.store, keccak256(storeInit));

        bytes memory create2DeployerInit =
            abi.encodePacked(type(UniversalCreate2DeployerFromStore).creationCode, abi.encode(storeAddr));
        address create2DeployerAddr =
            _create2(CREATE2_FACTORY_ADDR, salts.deployerFromStore, keccak256(create2DeployerInit));

        console2.log("UniversalBytecodeStoreV2 (predicted):", storeAddr);
        console2.log("UniversalCreate2DeployerFromStoreV2 (predicted):", create2DeployerAddr);

        // Predict deterministic addresses for shared CreatorOVault modules.
        bytes memory coreModuleInit = type(CreatorOVaultCoreModule).creationCode;
        bytes memory strategiesModuleInit = type(CreatorOVaultStrategiesModule).creationCode;
        bytes memory adminModuleInit = type(CreatorOVaultAdminModule).creationCode;

        address coreModuleAddr = _create2(CREATE2_FACTORY_ADDR, salts.vaultCoreModule, keccak256(coreModuleInit));
        address strategiesModuleAddr =
            _create2(CREATE2_FACTORY_ADDR, salts.vaultStrategiesModule, keccak256(strategiesModuleInit));
        address adminModuleAddr = _create2(CREATE2_FACTORY_ADDR, salts.vaultAdminModule, keccak256(adminModuleInit));

        console2.log("CreatorOVaultCoreModule (predicted):", coreModuleAddr);
        console2.log("CreatorOVaultStrategiesModule (predicted):", strategiesModuleAddr);
        console2.log("CreatorOVaultAdminModule (predicted):", adminModuleAddr);

        // Predict deterministic address for the phased deployer.
        bytes memory deployerArgs = abi.encode(
            cfg.registry,
            storeAddr,
            create2DeployerAddr,
            cfg.protocolTreasury,
            cfg.poolManager,
            cfg.taxHook,
            cfg.chainlinkEthUsd,
            cfg.vaultActivationBatcher,
            cfg.lotteryManager,
            cfg.permit2,
            cfg.usdc,
            cfg.uniswapV3Factory,
            cfg.uniswapRouter,
            cfg.ajnaFactory,
            coreModuleAddr,
            strategiesModuleAddr,
            adminModuleAddr
        );
        bytes memory deployerInit = abi.encodePacked(type(DeploymentBatcher).creationCode, deployerArgs);
        address deployerAddr = _create2(CREATE2_FACTORY_ADDR, salts.deploymentBatcher, keccak256(deployerInit));
        console2.log("DeploymentBatcher (predicted):", deployerAddr);

        vm.startBroadcast(pk);

        // Deploy v2 store (if missing).
        if (storeAddr.code.length == 0) {
            (bool ok,) = CREATE2_FACTORY_ADDR.call(abi.encodePacked(salts.store, storeInit));
            require(ok, "STORE_V2 deploy failed");
        }

        // Deploy v2 create2 deployer (if missing).
        if (create2DeployerAddr.code.length == 0) {
            (bool ok,) = CREATE2_FACTORY_ADDR.call(abi.encodePacked(salts.deployerFromStore, create2DeployerInit));
            require(ok, "DEPLOYER_V2 deploy failed");
        }

        // Deploy shared vault modules (if missing).
        if (coreModuleAddr.code.length == 0) {
            (bool ok,) = CREATE2_FACTORY_ADDR.call(abi.encodePacked(salts.vaultCoreModule, coreModuleInit));
            require(ok, "VAULT_CORE_MODULE deploy failed");
        }
        if (strategiesModuleAddr.code.length == 0) {
            (bool ok,) = CREATE2_FACTORY_ADDR.call(abi.encodePacked(salts.vaultStrategiesModule, strategiesModuleInit));
            require(ok, "VAULT_STRATEGIES_MODULE deploy failed");
        }
        if (adminModuleAddr.code.length == 0) {
            (bool ok,) = CREATE2_FACTORY_ADDR.call(abi.encodePacked(salts.vaultAdminModule, adminModuleInit));
            require(ok, "VAULT_ADMIN_MODULE deploy failed");
        }

        // Deploy phased deployer (if missing).
        if (deployerAddr.code.length == 0) {
            (bool ok,) = CREATE2_FACTORY_ADDR.call(abi.encodePacked(salts.deploymentBatcher, deployerInit));
            require(ok, "DEPLOYMENT_BATCHER deploy failed");
        }

        vm.stopBroadcast();

        // Minimal sanity checks (read-only).
        DeploymentBatcher deployer = DeploymentBatcher(deployerAddr);
        require(address(deployer.bytecodeStore()) == storeAddr, "Deployer store mismatch");
        require(address(deployer.create2Deployer()) == create2DeployerAddr, "Deployer create2 mismatch");
        require(address(deployer.registry()) == cfg.registry, "Deployer registry mismatch");
        require(address(deployer.usdc()) == cfg.usdc, "Deployer USDC mismatch");
        require(address(deployer.uniswapV3Factory()) == cfg.uniswapV3Factory, "Deployer V3 factory mismatch");
        require(address(deployer.uniswapRouter()) == cfg.uniswapRouter, "Deployer router mismatch");
        require(address(deployer.ajnaFactory()) == cfg.ajnaFactory, "Deployer Ajna factory mismatch");
        require(deployer.vaultCoreModule() == coreModuleAddr, "Deployer core module mismatch");
        require(deployer.vaultStrategiesModule() == strategiesModuleAddr, "Deployer strategies module mismatch");
        require(deployer.vaultAdminModule() == adminModuleAddr, "Deployer admin module mismatch");
        console2.log("DeploymentBatcher:", address(deployer));

        // Optional: configure the 20% Solana allocation path on the batcher.
        if (configureSolana) {
            require(cfg.solanaBridgeAdapter != address(0), "SOLANA_BRIDGE_ADAPTER required");
            require(cfg.solanaDestination != bytes32(0), "SOLANA_DESTINATION required");
            require(broadcaster == cfg.protocolTreasury, "broadcaster must equal protocolTreasury");

            address currentAdapter = deployer.solanaBridgeAdapter();
            bytes32 currentDestination = deployer.solanaDestination();

            if (currentAdapter != cfg.solanaBridgeAdapter || currentDestination != cfg.solanaDestination) {
                vm.startBroadcast(pk);
                deployer.setSolanaConfig(cfg.solanaBridgeAdapter, cfg.solanaDestination);
                vm.stopBroadcast();
            }

            require(deployer.solanaBridgeAdapter() == cfg.solanaBridgeAdapter, "Solana adapter mismatch");
            require(deployer.solanaDestination() == cfg.solanaDestination, "Solana destination mismatch");
            console2.log("Solana adapter configured:", cfg.solanaBridgeAdapter);
            console2.logBytes32(cfg.solanaDestination);
        } else {
            console2.log("CONFIGURE_SOLANA=0 (skipped setSolanaConfig)");
        }

        if (configureOvaultRuntime) {
            require(cfg.ovaultHubComposer != address(0), "OVAULT_HUB_COMPOSER required");
            require(cfg.ovaultSolanaEid != 0, "OVAULT_SOLANA_EID required");
            require(broadcaster == cfg.protocolTreasury, "broadcaster must equal protocolTreasury");

            DeploymentBatcher.OVaultRuntimeConfig memory currentRuntime = deployer.getOVaultRuntimeConfig();
            if (
                currentRuntime.hubComposer != cfg.ovaultHubComposer || currentRuntime.solanaEid != cfg.ovaultSolanaEid
                    || !currentRuntime.enabled
            ) {
                vm.startBroadcast(pk);
                deployer.setOVaultRuntimeConfig(cfg.ovaultHubComposer, cfg.ovaultSolanaEid, true);
                vm.stopBroadcast();
            }

            DeploymentBatcher.OVaultRuntimeConfig memory finalRuntime = deployer.getOVaultRuntimeConfig();
            require(finalRuntime.hubComposer == cfg.ovaultHubComposer, "OVault hub composer mismatch");
            require(finalRuntime.solanaEid == cfg.ovaultSolanaEid, "OVault Solana EID mismatch");
            require(finalRuntime.enabled, "OVault runtime not enabled");
            console2.log("OVault runtime composer configured:", cfg.ovaultHubComposer);
            console2.log("OVault runtime Solana EID:", cfg.ovaultSolanaEid);
        } else {
            console2.log("CONFIGURE_OVAULT_RUNTIME=0 (skipped setOVaultRuntimeConfig)");
        }
    }
}
