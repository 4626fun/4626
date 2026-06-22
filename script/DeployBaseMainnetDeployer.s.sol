// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";

import "../contracts/helpers/batchers/DeploymentBatcher.sol";
import "../contracts/helpers/infra/UniversalBytecodeStoreV2.sol";
import "../contracts/factories/UniversalCreate2DeployerFromStore.sol";
import {CreatorOVaultAdminModule} from "../contracts/vault/modules/CreatorOVaultAdminModule.sol";
import {CreatorOVaultCoreModule} from "../contracts/vault/modules/CreatorOVaultCoreModule.sol";
import {CreatorOVaultStrategiesModule} from "../contracts/vault/modules/CreatorOVaultStrategiesModule.sol";

/// @notice Deploys the deterministic phased deployment batcher (Phases 1-3) on Base mainnet.
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
///   PROTOCOL_AUTOMATION=...   (hot Safe — Charm vault manager)
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
/// Optional explicit owner for UniversalCreate2DeployerFromStore.
/// Defaults to broadcaster when unset.
///   CREATE2_FROM_STORE_OWNER=...
/// Optional OVault runtime wiring (requires broadcaster == protocolTreasury):
///   CONFIGURE_OVAULT_RUNTIME=1
///   OVAULT_HUB_COMPOSER=...
///   OVAULT_SOLANA_EID=30168
/// Optional default ShareOFT mesh peer (requires broadcaster == protocolTreasury):
///   CONFIGURE_SOLANA_SHARE_OFT_PEER=1
///   SOLANA_SHARE_OFT_PEER=0x<32-byte-solana-share-mesh-peer>
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
    // - shared epoch: DEPLOYMENT_EPOCH_TAG
    string constant DEFAULT_DEPLOYMENT_EPOCH_TAG = "v1.13.0";
    string constant STORE_SALT_TAG_PREFIX = "base-release:UniversalBytecodeStore:";
    string constant DEPLOYER_FROM_STORE_SALT_TAG_PREFIX = "base-release:UniversalCreate2DeployerFromStore:";

    // CreatorOVault module salts (shared logic contracts; no constructor args).
    string constant VAULT_CORE_MODULE_SALT_TAG_PREFIX = "base-release:CreatorOVaultCoreModule:";
    string constant VAULT_STRATEGIES_MODULE_SALT_TAG_PREFIX = "base-release:CreatorOVaultStrategiesModule:";
    string constant VAULT_ADMIN_MODULE_SALT_TAG_PREFIX = "base-release:CreatorOVaultAdminModule:";

    // DeploymentBatcher salt (constructor args are chain-specific ⇒ address is chain-specific).
    string constant DEPLOYMENT_BATCHER_SALT_TAG_PREFIX = "base-release:DeploymentBatcher:";
    string constant PHASE2_MODULE_SALT_TAG_PREFIX = "base-release:DeploymentBatcherPhase2Module:";
    string constant PHASE1_MODULE_SALT_TAG_PREFIX = "base-release:DeploymentBatcherPhase1Module:";
    string constant PHASE3_HELPER_SALT_TAG_PREFIX = "base-release:DeploymentBatcherPhase3Helper:";
    string constant UNIV4_HELPER_SALT_TAG_PREFIX = "base-release:DeploymentBatcherUniV4Helper:";
    string constant UTILS_HELPER_SALT_TAG_PREFIX = "base-release:DeploymentBatcherUtilsHelper:";

    // Live Base mainnet fallback defaults — overridden by shared/global handoff during fresh epochs.
    address constant DEFAULT_REGISTRY = 0xDD7B106a15540bA2F59464590222bF47D8C9394E;
    address constant DEFAULT_PROTOCOL_TREASURY = 0x7d429eCbdcE5ff516D6e0a93299cbBa97203f2d3;
    address constant DEFAULT_POOL_MANAGER = 0x498581fF718922c3f8e6A244956aF099B2652b2b;
    address constant DEFAULT_TAX_HOOK = 0xca975B9dAF772C71161f3648437c3616E5Be0088;
    address constant DEFAULT_CHAINLINK_ETH_USD = 0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70;
    address constant DEFAULT_VAULT_ACTIVATION_BATCHER = 0x5EaFfa41f07a1aAf6ecd38833fd128C53fD8669A;
    address constant DEFAULT_LOTTERY_MANAGER = 0x29F901864D65Eb848BC548ebCEAcD6dAD39EFd26;
    address constant DEFAULT_PERMIT2 = 0x000000000022D473030F116dDEE9F6B43aC78BA3;
    address constant DEFAULT_USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
    address constant DEFAULT_UNISWAP_V3_FACTORY = 0x33128a8fC17869897dcE68Ed026d694621f6FDfD;
    address constant DEFAULT_UNISWAP_ROUTER = 0x2626664c2603336E57B271c5C0b26F421741e481;
    address constant DEFAULT_AJNA_FACTORY = 0x214f62B5836D83f3D6c4f71F174209097B1A779C;

    struct Config {
        address registry;
        address protocolTreasury;
        address protocolAutomation;
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
        address create2FromStoreOwner;
        address solanaBridgeAdapter;
        bytes32 solanaDestination;
        address ovaultHubComposer;
        uint32 ovaultSolanaEid;
        bytes32 solanaShareOftPeer;
    }

    struct SaltConfig {
        bytes32 store;
        bytes32 deployerFromStore;
        bytes32 vaultCoreModule;
        bytes32 vaultStrategiesModule;
        bytes32 vaultAdminModule;
        bytes32 phase2Module;
        bytes32 phase1Module;
        bytes32 phase3Helper;
        bytes32 uniV4Helper;
        bytes32 utilsHelper;
        bytes32 deploymentBatcher;
    }

    struct PredictedAddresses {
        address store;
        address deployerFromStore;
        address vaultCoreModule;
        address vaultStrategiesModule;
        address vaultAdminModule;
        address phase2Module;
        address phase1Module;
        address phase3Helper;
        address uniV4Helper;
        address utilsHelper;
        address deploymentBatcher;
    }

    function _create2(address deployer, bytes32 salt, bytes32 initCodeHash) internal pure returns (address) {
        return address(uint160(uint256(keccak256(abi.encodePacked(bytes1(0xff), deployer, salt, initCodeHash)))));
    }

    function _expectedEpochTag() internal view returns (string memory) {
        return vm.envOr("DEPLOYMENT_EPOCH_TAG", DEFAULT_DEPLOYMENT_EPOCH_TAG);
    }

    function _saltFromEnvOrEpoch(string memory rawKey, string memory tagKey, string memory defaultTagPrefix)
        internal
        returns (bytes32)
    {
        bytes32 raw = vm.envOr(rawKey, bytes32(0));
        if (raw != bytes32(0)) return raw;
        string memory tag = vm.envOr(tagKey, string.concat(defaultTagPrefix, _expectedEpochTag()));
        return keccak256(bytes(tag));
    }

    // Shell initcode ~53KB ⇒ ~10.6M deposit + constructor; keep under Base 25M tx cap (~24.8M stipend).
    uint256 constant DEFAULT_DEPLOYMENT_BATCHER_CREATE2_GAS = 20_000_000;

    function _predictBatcherShellAddress(
        Config memory cfg,
        bytes32 batcherSalt,
        address storeAddr,
        address create2DeployerAddr,
        address coreModuleAddr,
        address strategiesModuleAddr,
        address adminModuleAddr
    ) internal pure returns (address) {
        bytes memory batcherInit = _buildBatcherInit(
            cfg,
            storeAddr,
            create2DeployerAddr,
            coreModuleAddr,
            strategiesModuleAddr,
            adminModuleAddr,
            address(0),
            address(0),
            address(0),
            address(0)
        );
        return _create2(CREATE2_FACTORY_ADDR, batcherSalt, keccak256(batcherInit));
    }

    function _helpersWired(DeploymentBatcher deployer) internal view returns (bool) {
        return address(deployer.phase1Module()) != address(0) && address(deployer.phase2Module()) != address(0)
            && address(deployer.phase3Helper()) != address(0) && address(deployer.uniV4Helper()) != address(0)
            && address(deployer.utilsHelper()) != address(0);
    }

    function _deploymentBatcherCreate2Gas() internal returns (uint256) {
        return vm.envOr("DEPLOYMENT_BATCHER_CREATE2_GAS", DEFAULT_DEPLOYMENT_BATCHER_CREATE2_GAS);
    }

    function _deployCreate2IfMissing(bytes32 salt, bytes memory initCode) internal {
        address predicted = _create2(CREATE2_FACTORY_ADDR, salt, keccak256(initCode));
        if (predicted.code.length == 0) {
            (bool ok,) = CREATE2_FACTORY_ADDR.call(abi.encodePacked(salt, initCode));
            require(ok, "CREATE2 deploy failed");
        }
    }

    function _buildPhase2ModuleInit(Config memory cfg, address create2DeployerAddr, address batcherAddr)
        internal
        pure
        returns (bytes memory)
    {
        return abi.encodePacked(
            type(DeploymentBatcherPhase2Module).creationCode,
            abi.encode(
                create2DeployerAddr,
                cfg.registry,
                cfg.chainlinkEthUsd,
                cfg.poolManager,
                cfg.taxHook,
                cfg.protocolTreasury,
                cfg.lotteryManager,
                cfg.vaultActivationBatcher,
                batcherAddr
            )
        );
    }

    function _buildPhase1ModuleInit(
        Config memory cfg,
        address create2DeployerAddr,
        address storeAddr,
        address coreModuleAddr,
        address strategiesModuleAddr,
        address adminModuleAddr,
        address utilsHelperAddr,
        address batcherAddr
    ) internal pure returns (bytes memory) {
        return abi.encodePacked(
            type(DeploymentBatcherPhase1Module).creationCode,
            abi.encode(
                create2DeployerAddr,
                storeAddr,
                cfg.registry,
                coreModuleAddr,
                strategiesModuleAddr,
                adminModuleAddr,
                cfg.vaultActivationBatcher,
                utilsHelperAddr,
                batcherAddr
            )
        );
    }

    function _buildPhase3HelperInit(Config memory cfg, address create2DeployerAddr, address batcherAddr)
        internal
        pure
        returns (bytes memory)
    {
        return abi.encodePacked(
            type(DeploymentBatcherPhase3Helper).creationCode,
            abi.encode(
                create2DeployerAddr,
                cfg.protocolTreasury,
                cfg.protocolAutomation,
                cfg.usdc,
                cfg.uniswapV3Factory,
                cfg.uniswapRouter,
                cfg.ajnaFactory,
                batcherAddr
            )
        );
    }

    function _buildUniV4HelperInit(Config memory cfg, address create2DeployerAddr, address batcherAddr)
        internal
        pure
        returns (bytes memory)
    {
        return abi.encodePacked(
            type(DeploymentBatcherUniV4Helper).creationCode,
            abi.encode(create2DeployerAddr, cfg.poolManager, cfg.permit2, batcherAddr)
        );
    }

    function _buildUtilsHelperInit() internal pure returns (bytes memory) {
        return type(DeploymentBatcherUtilsHelper).creationCode;
    }

    function _buildBatcherInit(
        Config memory cfg,
        address storeAddr,
        address create2DeployerAddr,
        address coreModuleAddr,
        address strategiesModuleAddr,
        address adminModuleAddr,
        address phase2ModuleAddr,
        address phase3HelperAddr,
        address uniV4HelperAddr,
        address utilsHelperAddr
    ) internal pure returns (bytes memory) {
        return abi.encodePacked(
            type(DeploymentBatcher).creationCode,
            abi.encode(
                cfg.registry,
                storeAddr,
                create2DeployerAddr,
                cfg.protocolTreasury,
                cfg.protocolAutomation,
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
                adminModuleAddr,
                phase2ModuleAddr,
                phase3HelperAddr,
                uniV4HelperAddr,
                utilsHelperAddr
            )
        );
    }

    function _resolvePredictedBundle(
        Config memory cfg,
        SaltConfig memory salts,
        address storeAddr,
        address create2DeployerAddr,
        address coreModuleAddr,
        address strategiesModuleAddr,
        address adminModuleAddr
    ) internal pure returns (PredictedAddresses memory predicted) {
        predicted.store = storeAddr;
        predicted.deployerFromStore = create2DeployerAddr;
        predicted.vaultCoreModule = coreModuleAddr;
        predicted.vaultStrategiesModule = strategiesModuleAddr;
        predicted.vaultAdminModule = adminModuleAddr;

        bytes memory utilsInit = _buildUtilsHelperInit();
        predicted.utilsHelper = _create2(CREATE2_FACTORY_ADDR, salts.utilsHelper, keccak256(utilsInit));

        predicted.deploymentBatcher = _predictBatcherShellAddress(
            cfg, salts.deploymentBatcher, storeAddr, create2DeployerAddr, coreModuleAddr, strategiesModuleAddr, adminModuleAddr
        );

        address batcherAddr = predicted.deploymentBatcher;
        predicted.phase2Module = _create2(
            CREATE2_FACTORY_ADDR,
            salts.phase2Module,
            keccak256(_buildPhase2ModuleInit(cfg, create2DeployerAddr, batcherAddr))
        );
        predicted.phase3Helper = _create2(
            CREATE2_FACTORY_ADDR,
            salts.phase3Helper,
            keccak256(_buildPhase3HelperInit(cfg, create2DeployerAddr, batcherAddr))
        );
        predicted.uniV4Helper = _create2(
            CREATE2_FACTORY_ADDR,
            salts.uniV4Helper,
            keccak256(_buildUniV4HelperInit(cfg, create2DeployerAddr, batcherAddr))
        );
        predicted.phase1Module = _create2(
            CREATE2_FACTORY_ADDR,
            salts.phase1Module,
            keccak256(
                _buildPhase1ModuleInit(
                    cfg,
                    create2DeployerAddr,
                    storeAddr,
                    coreModuleAddr,
                    strategiesModuleAddr,
                    adminModuleAddr,
                    predicted.utilsHelper,
                    batcherAddr
                )
            )
        );
    }

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address broadcaster = vm.addr(pk);

        Config memory cfg;
        cfg.registry = vm.envOr("REGISTRY", DEFAULT_REGISTRY);
        cfg.protocolTreasury = vm.envOr("PROTOCOL_TREASURY", DEFAULT_PROTOCOL_TREASURY);
        address protocolAutomation = vm.envOr("PROTOCOL_AUTOMATION", address(0));
        if (protocolAutomation == address(0)) {
            protocolAutomation = vm.envOr("PROTOCOL_AUTOMATION_SAFE", address(0));
        }
        require(protocolAutomation != address(0), "PROTOCOL_AUTOMATION or PROTOCOL_AUTOMATION_SAFE required");
        cfg.protocolAutomation = protocolAutomation;
        cfg.poolManager = vm.envOr("POOL_MANAGER", DEFAULT_POOL_MANAGER);
        cfg.taxHook = vm.envOr("TAX_HOOK", DEFAULT_TAX_HOOK);
        cfg.chainlinkEthUsd = vm.envOr("CHAINLINK_ETH_USD", DEFAULT_CHAINLINK_ETH_USD);
        cfg.vaultActivationBatcher = vm.envOr("VAULT_ACTIVATION_BATCHER", DEFAULT_VAULT_ACTIVATION_BATCHER);
        cfg.lotteryManager = vm.envOr("LOTTERY_MANAGER", DEFAULT_LOTTERY_MANAGER);
        require(cfg.lotteryManager != address(0), "LOTTERY_MANAGER required for v1.11.1+");
        cfg.permit2 = vm.envOr("PERMIT2", DEFAULT_PERMIT2);
        cfg.usdc = vm.envOr("USDC", DEFAULT_USDC);
        cfg.uniswapV3Factory = vm.envOr("UNISWAP_V3_FACTORY", DEFAULT_UNISWAP_V3_FACTORY);
        cfg.uniswapRouter = vm.envOr("UNISWAP_ROUTER", DEFAULT_UNISWAP_ROUTER);
        cfg.ajnaFactory = vm.envOr("AJNA_FACTORY", DEFAULT_AJNA_FACTORY);
        cfg.create2FromStoreOwner = vm.envOr("CREATE2_FROM_STORE_OWNER", broadcaster);
        cfg.solanaBridgeAdapter = vm.envOr("SOLANA_BRIDGE_ADAPTER", address(0));
        cfg.solanaDestination = vm.envOr("SOLANA_DESTINATION", bytes32(0));
        cfg.ovaultHubComposer = vm.envOr("OVAULT_HUB_COMPOSER", address(0));
        cfg.ovaultSolanaEid = uint32(vm.envOr("OVAULT_SOLANA_EID", uint256(0)));
        cfg.solanaShareOftPeer = vm.envOr("SOLANA_SHARE_OFT_PEER", bytes32(0));
        bool configureSolana = vm.envOr("CONFIGURE_SOLANA", uint256(0)) == 1;
        bool configureOvaultRuntime = vm.envOr("CONFIGURE_OVAULT_RUNTIME", uint256(0)) == 1;
        bool configureSolanaShareOftPeer = vm.envOr("CONFIGURE_SOLANA_SHARE_OFT_PEER", uint256(0)) == 1;
        SaltConfig memory salts;
        salts.store = _saltFromEnvOrEpoch("INFRA_STORE_SALT", "INFRA_STORE_SALT_TAG", STORE_SALT_TAG_PREFIX);
        salts.deployerFromStore = _saltFromEnvOrEpoch(
            "INFRA_DEPLOYER_FROM_STORE_SALT",
            "INFRA_DEPLOYER_FROM_STORE_SALT_TAG",
            DEPLOYER_FROM_STORE_SALT_TAG_PREFIX
        );
        salts.vaultCoreModule = _saltFromEnvOrEpoch(
            "INFRA_VAULT_CORE_MODULE_SALT", "INFRA_VAULT_CORE_MODULE_SALT_TAG", VAULT_CORE_MODULE_SALT_TAG_PREFIX
        );
        salts.vaultStrategiesModule = _saltFromEnvOrEpoch(
            "INFRA_VAULT_STRATEGIES_MODULE_SALT",
            "INFRA_VAULT_STRATEGIES_MODULE_SALT_TAG",
            VAULT_STRATEGIES_MODULE_SALT_TAG_PREFIX
        );
        salts.vaultAdminModule = _saltFromEnvOrEpoch(
            "INFRA_VAULT_ADMIN_MODULE_SALT",
            "INFRA_VAULT_ADMIN_MODULE_SALT_TAG",
            VAULT_ADMIN_MODULE_SALT_TAG_PREFIX
        );
        salts.phase2Module = _saltFromEnvOrEpoch(
            "INFRA_PHASE2_MODULE_SALT", "INFRA_PHASE2_MODULE_SALT_TAG", PHASE2_MODULE_SALT_TAG_PREFIX
        );
        salts.phase1Module = _saltFromEnvOrEpoch(
            "INFRA_PHASE1_MODULE_SALT", "INFRA_PHASE1_MODULE_SALT_TAG", PHASE1_MODULE_SALT_TAG_PREFIX
        );
        salts.phase3Helper = _saltFromEnvOrEpoch(
            "INFRA_PHASE3_HELPER_SALT", "INFRA_PHASE3_HELPER_SALT_TAG", PHASE3_HELPER_SALT_TAG_PREFIX
        );
        salts.uniV4Helper = _saltFromEnvOrEpoch(
            "INFRA_UNIV4_HELPER_SALT", "INFRA_UNIV4_HELPER_SALT_TAG", UNIV4_HELPER_SALT_TAG_PREFIX
        );
        salts.utilsHelper = _saltFromEnvOrEpoch(
            "INFRA_UTILS_HELPER_SALT", "INFRA_UTILS_HELPER_SALT_TAG", UTILS_HELPER_SALT_TAG_PREFIX
        );
        salts.deploymentBatcher = _saltFromEnvOrEpoch(
            "INFRA_DEPLOYMENT_BATCHER_SALT",
            "INFRA_DEPLOYMENT_BATCHER_SALT_TAG",
            DEPLOYMENT_BATCHER_SALT_TAG_PREFIX
        );

        PredictedAddresses memory predicted;

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
        predicted.store = storeAddr;

        bytes memory create2DeployerInit = abi.encodePacked(
            type(UniversalCreate2DeployerFromStore).creationCode, abi.encode(storeAddr, cfg.create2FromStoreOwner)
        );
        address create2DeployerAddr =
            _create2(CREATE2_FACTORY_ADDR, salts.deployerFromStore, keccak256(create2DeployerInit));
        predicted.deployerFromStore = create2DeployerAddr;

        console2.log("UniversalBytecodeStoreV2 (predicted):", storeAddr);
        console2.log("UniversalCreate2DeployerFromStoreV2 (predicted):", create2DeployerAddr);
        console2.log("UniversalCreate2DeployerFromStore owner:", cfg.create2FromStoreOwner);

        // Predict deterministic addresses for shared CreatorOVault modules.
        bytes memory coreModuleInit = type(CreatorOVaultCoreModule).creationCode;
        bytes memory strategiesModuleInit = type(CreatorOVaultStrategiesModule).creationCode;
        bytes memory adminModuleInit = type(CreatorOVaultAdminModule).creationCode;

        address coreModuleAddr = _create2(CREATE2_FACTORY_ADDR, salts.vaultCoreModule, keccak256(coreModuleInit));
        address strategiesModuleAddr =
            _create2(CREATE2_FACTORY_ADDR, salts.vaultStrategiesModule, keccak256(strategiesModuleInit));
        address adminModuleAddr = _create2(CREATE2_FACTORY_ADDR, salts.vaultAdminModule, keccak256(adminModuleInit));
        predicted.vaultCoreModule = coreModuleAddr;
        predicted.vaultStrategiesModule = strategiesModuleAddr;
        predicted.vaultAdminModule = adminModuleAddr;

        console2.log("CreatorOVaultCoreModule (predicted):", coreModuleAddr);
        console2.log("CreatorOVaultStrategiesModule (predicted):", strategiesModuleAddr);
        console2.log("CreatorOVaultAdminModule (predicted):", adminModuleAddr);

        predicted = _resolvePredictedBundle(
            cfg, salts, storeAddr, create2DeployerAddr, coreModuleAddr, strategiesModuleAddr, adminModuleAddr
        );
        address deployerAddr = predicted.deploymentBatcher;
        console2.log("DeploymentBatcherUtilsHelper (predicted):", predicted.utilsHelper);
        console2.log("DeploymentBatcherPhase2Module (predicted):", predicted.phase2Module);
        console2.log("DeploymentBatcherPhase1Module (predicted):", predicted.phase1Module);
        console2.log("DeploymentBatcherPhase3Helper (predicted):", predicted.phase3Helper);
        console2.log("DeploymentBatcherUniV4Helper (predicted):", predicted.uniV4Helper);
        console2.log("DeploymentBatcher (predicted):", deployerAddr);

        if (cfg.create2FromStoreOwner != broadcaster) {
            revert("CREATE2_FROM_STORE_OWNER must equal broadcaster for inline authorization");
        }

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

        // Pre-deploy batcher helpers in separate txs to stay under Base's 25M per-tx gas cap.
        _deployCreate2IfMissing(salts.utilsHelper, _buildUtilsHelperInit());
        _deployCreate2IfMissing(
            salts.phase2Module, _buildPhase2ModuleInit(cfg, create2DeployerAddr, deployerAddr)
        );
        _deployCreate2IfMissing(
            salts.phase3Helper, _buildPhase3HelperInit(cfg, create2DeployerAddr, deployerAddr)
        );
        _deployCreate2IfMissing(
            salts.uniV4Helper, _buildUniV4HelperInit(cfg, create2DeployerAddr, deployerAddr)
        );
        _deployCreate2IfMissing(
            salts.phase1Module,
            _buildPhase1ModuleInit(
                cfg,
                create2DeployerAddr,
                storeAddr,
                coreModuleAddr,
                strategiesModuleAddr,
                adminModuleAddr,
                predicted.utilsHelper,
                deployerAddr
            )
        );

        // Deploy phased deployer shell (if missing) — helpers are wired post-deploy via Safe setters.
        if (deployerAddr.code.length == 0) {
            bytes memory deployerInit = _buildBatcherInit(
                cfg,
                storeAddr,
                create2DeployerAddr,
                coreModuleAddr,
                strategiesModuleAddr,
                adminModuleAddr,
                address(0),
                address(0),
                address(0),
                address(0)
            );
            uint256 batcherCreate2Gas = _deploymentBatcherCreate2Gas();
            console2.log("DeploymentBatcher CREATE2 gas stipend:", batcherCreate2Gas);
            (bool ok,) = CREATE2_FACTORY_ADDR.call{gas: batcherCreate2Gas}(
                abi.encodePacked(salts.deploymentBatcher, deployerInit)
            );
            require(ok, "DEPLOYMENT_BATCHER deploy failed");
        }

        // Authorize deploy-capable callers on the create2 deployer (after helpers are wired).
        UniversalCreate2DeployerFromStore create2Deployer = UniversalCreate2DeployerFromStore(create2DeployerAddr);
        DeploymentBatcher deployer = DeploymentBatcher(deployerAddr);

        vm.stopBroadcast();

        if (!_helpersWired(deployer)) {
            console2.log("HELPERS_NOT_WIRED: execute protocolTreasury Safe wiring before authorize:");
            console2.log(string.concat("  wireDeploymentHelpers("));
            console2.log(string.concat("    ", vm.toString(predicted.phase2Module), ","));
            console2.log(string.concat("    ", vm.toString(predicted.phase3Helper), ","));
            console2.log(string.concat("    ", vm.toString(predicted.uniV4Helper), ","));
            console2.log(string.concat("    ", vm.toString(predicted.utilsHelper)));
            console2.log("  )");
            console2.log(string.concat("  setPhase1Module(", vm.toString(predicted.phase1Module), ")"));
            console2.log(string.concat("HANDOFF:WIRE_BATCHER_HELPERS_BATCHER=", vm.toString(deployerAddr)));
            return;
        }

        vm.startBroadcast(pk);
        address[3] memory requiredDeployers = [
            deployerAddr,
            address(deployer.phase3Helper()),
            address(deployer.uniV4Helper())
        ];
        for (uint256 i = 0; i < requiredDeployers.length; ++i) {
            address deployerCaller = requiredDeployers[i];
            if (!create2Deployer.authorizedDeployers(deployerCaller)) {
                create2Deployer.setAuthorizedDeployer(deployerCaller, true);
            }
        }
        vm.stopBroadcast();

        // Minimal sanity checks (read-only).
        deployer = DeploymentBatcher(deployerAddr);
        require(address(deployer.bytecodeStore()) == storeAddr, "Deployer store mismatch");
        require(address(deployer.create2Deployer()) == create2DeployerAddr, "Deployer create2 mismatch");
        require(create2Deployer.owner() == cfg.create2FromStoreOwner, "Create2 owner mismatch");
        require(create2Deployer.authorizedDeployers(address(deployer)), "Batcher not authorized in create2");
        require(create2Deployer.authorizedDeployers(address(deployer.phase3Helper())), "Phase3 helper not authorized");
        require(create2Deployer.authorizedDeployers(address(deployer.uniV4Helper())), "UniV4 helper not authorized");
        require(address(deployer.registry()) == cfg.registry, "Deployer registry mismatch");
        require(address(deployer.usdc()) == cfg.usdc, "Deployer USDC mismatch");
        require(address(deployer.uniswapV3Factory()) == cfg.uniswapV3Factory, "Deployer V3 factory mismatch");
        require(address(deployer.uniswapRouter()) == cfg.uniswapRouter, "Deployer router mismatch");
        require(address(deployer.ajnaFactory()) == cfg.ajnaFactory, "Deployer Ajna factory mismatch");
        require(deployer.vaultCoreModule() == coreModuleAddr, "Deployer core module mismatch");
        require(deployer.vaultStrategiesModule() == strategiesModuleAddr, "Deployer strategies module mismatch");
        require(deployer.vaultAdminModule() == adminModuleAddr, "Deployer admin module mismatch");
        console2.log("DeploymentBatcher:", address(deployer));
        console2.log(string.concat("HANDOFF:UNIVERSAL_BYTECODE_STORE=", vm.toString(storeAddr)));
        console2.log(string.concat("HANDOFF:UNIVERSAL_CREATE2_DEPLOYER=", vm.toString(create2DeployerAddr)));
        console2.log(string.concat("HANDOFF:UNIVERSAL_CREATE2_FROM_STORE=", vm.toString(create2DeployerAddr)));
        console2.log(string.concat("HANDOFF:DEPLOYMENT_BATCHER=", vm.toString(address(deployer))));
        console2.log(string.concat("HANDOFF:CREATOR_VAULT_BATCHER=", vm.toString(address(deployer))));
        console2.log(string.concat("HANDOFF:CREATOR_VAULT_BATCHER_AUTO_HANDOFF=", vm.toString(address(deployer))));

        // Optional: configure the 20% Solana allocation path on the batcher.
        if (configureSolana) {
            require(cfg.solanaBridgeAdapter != address(0), "SOLANA_BRIDGE_ADAPTER required");
            require(cfg.solanaDestination != bytes32(0), "SOLANA_DESTINATION required");
            if (broadcaster != cfg.protocolTreasury) {
                console2.log("CONFIGURE_SOLANA=1 but broadcaster != protocolTreasury; skipping setSolanaConfig");
            } else {
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
            }
        } else {
            console2.log("CONFIGURE_SOLANA=0 (skipped setSolanaConfig)");
        }

        if (configureOvaultRuntime) {
            require(cfg.ovaultHubComposer != address(0), "OVAULT_HUB_COMPOSER required");
            require(cfg.ovaultSolanaEid != 0, "OVAULT_SOLANA_EID required");
            if (broadcaster != cfg.protocolTreasury) {
                console2.log("CONFIGURE_OVAULT_RUNTIME=1 but broadcaster != protocolTreasury; skipping setOVaultRuntimeConfig");
            } else {
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
            }
        } else {
            console2.log("CONFIGURE_OVAULT_RUNTIME=0 (skipped setOVaultRuntimeConfig)");
        }

        if (configureSolanaShareOftPeer) {
            require(cfg.solanaShareOftPeer != bytes32(0), "SOLANA_SHARE_OFT_PEER required");
            if (broadcaster != cfg.protocolTreasury) {
                console2.log(
                    "CONFIGURE_SOLANA_SHARE_OFT_PEER=1 but broadcaster != protocolTreasury; skipping setSolanaShareOftPeer"
                );
            } else {
                if (deployer.solanaShareOftPeer() != cfg.solanaShareOftPeer) {
                    vm.startBroadcast(pk);
                    deployer.setSolanaShareOftPeer(cfg.solanaShareOftPeer);
                    vm.stopBroadcast();
                }
                require(deployer.solanaShareOftPeer() == cfg.solanaShareOftPeer, "Solana ShareOFT peer mismatch");
                console2.logBytes32(cfg.solanaShareOftPeer);
                console2.log("Solana ShareOFT default peer configured");
            }
        } else {
            console2.log("CONFIGURE_SOLANA_SHARE_OFT_PEER=0 (skipped setSolanaShareOftPeer)");
        }
    }
}
