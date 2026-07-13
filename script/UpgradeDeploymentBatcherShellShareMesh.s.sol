// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";

import {
    DeploymentBatcher,
    DeploymentBatcherPhase1Module,
    DeploymentBatcherPhase2Module,
    DeploymentBatcherPhase3Helper,
    DeploymentBatcherShareMeshHelper,
    DeploymentBatcherUtilsHelper
} from "@4626/shared/deploy/batchers/DeploymentBatcher.sol";
import {UniversalCreate2DeployerFromStore} from "@4626/shared/deploy/factories/UniversalCreate2DeployerFromStore.sol";
import {Registry4626} from "@4626/shared/core/Registry4626.sol";

interface IGnosisSafe {
    enum Operation {
        Call,
        DelegateCall
    }

    function nonce() external view returns (uint256);

    function getTransactionHash(
        address to,
        uint256 value,
        bytes calldata data,
        Operation operation,
        uint256 safeTxGas,
        uint256 baseGas,
        uint256 gasPrice,
        address gasToken,
        address refundReceiver,
        uint256 _nonce
    ) external view returns (bytes32);

    function execTransaction(
        address to,
        uint256 value,
        bytes calldata data,
        Operation operation,
        uint256 safeTxGas,
        uint256 baseGas,
        uint256 gasPrice,
        address gasToken,
        address refundReceiver,
        bytes calldata signatures
    ) external payable returns (bool success);
}

/**
 * @title UpgradeDeploymentBatcherShellShareMesh
 * @notice Deploy a fresh DeploymentBatcher shell (CREATE2) with share-mesh support, wire helpers,
 *         copy runtime config from the previous shell, and authorize the new batcher on registry + create2.
 *
 * Live shell `0x17163e67…` lacks `shareMeshHelper()` storage — helper hot-swap alone cannot work.
 *
 * Required env:
 * - PRIVATE_KEY (Safe owner for wiring; create2 + registry owner for authorization)
 * - BASE_RPC_URL
 *
 * Optional:
 * - OLD_DEPLOYMENT_BATCHER (defaults to live shell)
 * - SHELL_UPGRADE_EPOCH_TAG (default `v1.16.1-share-mesh`)
 * - AGENT_VAULT_CORE_MODULE (default `0` → falls back to creator core module)
 * - REUSE_UTILS_HELPER=1 (default 1) — rewire existing utils helper instead of CREATE2 redeploy
 * - REVOKE_OLD_BATCHER=0 (default 0) — set `1` to de-authorize the previous shell on registry
 * - SKIP_SAFE_WIRING=0 — set `1` to deploy only (logs Safe calldata handoff)
 * - SKIP_AUTHORIZATION=0 — set `1` to skip create2 + registry authorization
 */
contract UpgradeDeploymentBatcherShellShareMesh is Script {
    address constant CREATE2_FACTORY_ADDR = 0x4e59b44847b379578588920cA78FbF26c0B4956C;
    address constant DEFAULT_OLD_BATCHER = 0x17163e67dED6B45bd2A7E6a509A32fB7b0cB6D33;
    address constant DEFAULT_PROTOCOL_AUTOMATION_SAFE = 0x08f0875E40781578F902998b2b831cc48d838eBE;
    string constant DEFAULT_EPOCH_TAG = "v1.16.1-share-mesh";

    string constant DEPLOYMENT_BATCHER_SALT_TAG_PREFIX = "base-release:DeploymentBatcher:";
    string constant PHASE2_MODULE_SALT_TAG_PREFIX = "base-release:DeploymentBatcherPhase2Module:";
    string constant PHASE1_MODULE_SALT_TAG_PREFIX = "base-release:DeploymentBatcherPhase1Module:";
    string constant PHASE3_HELPER_SALT_TAG_PREFIX = "base-release:DeploymentBatcherPhase3Helper:";
    string constant SHARE_MESH_HELPER_SALT_TAG_PREFIX = "base-release:DeploymentBatcherShareMeshHelper:";
    string constant UTILS_HELPER_SALT_TAG_PREFIX = "base-release:DeploymentBatcherUtilsHelper:";

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
        address agentVaultCoreModule;
    }

    struct SaltConfig {
        bytes32 phase2Module;
        bytes32 phase1Module;
        bytes32 phase3Helper;
        bytes32 shareMeshHelper;
        bytes32 utilsHelper;
        bytes32 deploymentBatcher;
    }

    struct PredictedAddresses {
        address phase2Module;
        address phase1Module;
        address phase3Helper;
        address shareMeshHelper;
        address utilsHelper;
        address deploymentBatcher;
    }

    function _create2(address deployer, bytes32 salt, bytes32 initCodeHash) internal pure returns (address) {
        return address(uint160(uint256(keccak256(abi.encodePacked(bytes1(0xff), deployer, salt, initCodeHash)))));
    }

    function _saltFromEpoch(string memory tagPrefix, string memory epochTag) internal pure returns (bytes32) {
        return keccak256(bytes(string.concat(tagPrefix, epochTag)));
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
        address agentVaultCoreModuleAddr,
        address utilsHelperAddr,
        address batcherAddr
    ) internal pure returns (bytes memory) {
        address agentCore = agentVaultCoreModuleAddr == address(0) ? coreModuleAddr : agentVaultCoreModuleAddr;
        return abi.encodePacked(
            type(DeploymentBatcherPhase1Module).creationCode,
            abi.encode(
                create2DeployerAddr,
                storeAddr,
                cfg.registry,
                coreModuleAddr,
                agentCore,
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

    function _buildShareMeshHelperInit(Config memory cfg, address create2DeployerAddr, address batcherAddr)
        internal
        pure
        returns (bytes memory)
    {
        return abi.encodePacked(
            type(DeploymentBatcherShareMeshHelper).creationCode,
            abi.encode(create2DeployerAddr, cfg.poolManager, cfg.permit2, batcherAddr)
        );
    }

    function _buildUtilsHelperInit() internal pure returns (bytes memory) {
        return type(DeploymentBatcherUtilsHelper).creationCode;
    }

    function _buildBatcherShellInit(
        Config memory cfg,
        address storeAddr,
        address create2DeployerAddr,
        address coreModuleAddr,
        address strategiesModuleAddr,
        address adminModuleAddr
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
                address(0),
                address(0),
                address(0),
                address(0)
            )
        );
    }

    function _predictBundle(
        Config memory cfg,
        SaltConfig memory salts,
        address storeAddr,
        address create2DeployerAddr,
        address coreModuleAddr,
        address strategiesModuleAddr,
        address adminModuleAddr,
        address existingUtilsHelper,
        bool reuseUtilsHelper
    ) internal pure returns (PredictedAddresses memory predicted) {
        if (reuseUtilsHelper) {
            predicted.utilsHelper = existingUtilsHelper;
        } else {
            predicted.utilsHelper =
                _create2(CREATE2_FACTORY_ADDR, salts.utilsHelper, keccak256(_buildUtilsHelperInit()));
        }

        predicted.deploymentBatcher = _create2(
            CREATE2_FACTORY_ADDR,
            salts.deploymentBatcher,
            keccak256(
                _buildBatcherShellInit(
                    cfg, storeAddr, create2DeployerAddr, coreModuleAddr, strategiesModuleAddr, adminModuleAddr
                )
            )
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
        predicted.shareMeshHelper = _create2(
            CREATE2_FACTORY_ADDR,
            salts.shareMeshHelper,
            keccak256(_buildShareMeshHelperInit(cfg, create2DeployerAddr, batcherAddr))
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
                    cfg.agentVaultCoreModule,
                    predicted.utilsHelper,
                    batcherAddr
                )
            )
        );
    }

    function _safeExec(address treasurySafe, address target, bytes memory data, uint256 pk) internal {
        IGnosisSafe safe = IGnosisSafe(treasurySafe);
        bytes32 safeTxHash = safe.getTransactionHash(
            target, 0, data, IGnosisSafe.Operation.Call, 0, 0, 0, address(0), payable(address(0)), safe.nonce()
        );
        bytes32 digest = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", safeTxHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, digest);
        // Safe marks eth_sign-backed EOA signatures with v + 4 (27/28 -> 31/32).
        if (v <= 28) {
            v += 4;
        }
        bytes memory signature = abi.encodePacked(r, s, v);
        bool ok = safe.execTransaction(
            target, 0, data, IGnosisSafe.Operation.Call, 0, 0, 0, address(0), payable(address(0)), signature
        );
        require(ok, "Safe execTransaction failed");
    }

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address broadcaster = vm.addr(pk);
        address oldBatcherAddr = vm.envOr("OLD_DEPLOYMENT_BATCHER", DEFAULT_OLD_BATCHER);
        string memory epochTag = vm.envOr("SHELL_UPGRADE_EPOCH_TAG", DEFAULT_EPOCH_TAG);
        bool reuseUtilsHelper = vm.envOr("REUSE_UTILS_HELPER", uint256(1)) == 1;
        bool revokeOldBatcher = vm.envOr("REVOKE_OLD_BATCHER", uint256(0)) == 1;
        bool skipSafeWiring = vm.envOr("SKIP_SAFE_WIRING", uint256(0)) == 1;
        bool skipAuthorization = vm.envOr("SKIP_AUTHORIZATION", uint256(0)) == 1;

        DeploymentBatcher oldBatcher = DeploymentBatcher(oldBatcherAddr);
        DeploymentBatcherPhase3Helper oldPhase3 = DeploymentBatcherPhase3Helper(address(oldBatcher.phase3Helper()));

        Config memory cfg;
        cfg.registry = address(oldBatcher.registry());
        cfg.protocolTreasury = oldBatcher.protocolTreasury();
        cfg.protocolAutomation = vm.envOr("PROTOCOL_AUTOMATION_SAFE", DEFAULT_PROTOCOL_AUTOMATION_SAFE);
        address legacyAutomation = oldPhase3.protocolAutomation();
        if (legacyAutomation != cfg.protocolAutomation) {
            console2.log("Using protocol automation Safe override (legacy phase3 had wrong address):");
            console2.log("  legacy:", legacyAutomation);
            console2.log("  override:", cfg.protocolAutomation);
        }
        cfg.poolManager = oldBatcher.poolManager();
        cfg.taxHook = oldBatcher.taxHook();
        cfg.chainlinkEthUsd = oldBatcher.chainlinkEthUsd();
        cfg.vaultActivationBatcher = oldBatcher.vaultActivationBatcher();
        cfg.lotteryManager = oldBatcher.lotteryManager();
        cfg.permit2 = oldBatcher.permit2();
        cfg.usdc = oldBatcher.usdc();
        cfg.uniswapV3Factory = oldBatcher.uniswapV3Factory();
        cfg.uniswapRouter = oldBatcher.uniswapRouter();
        cfg.ajnaFactory = oldBatcher.ajnaFactory();
        cfg.agentVaultCoreModule = vm.envOr("AGENT_VAULT_CORE_MODULE", address(0));

        address storeAddr = address(oldBatcher.bytecodeStore());
        address create2DeployerAddr = address(oldBatcher.create2Deployer());
        address coreModuleAddr = oldBatcher.vaultCoreModule();
        address strategiesModuleAddr = oldBatcher.vaultStrategiesModule();
        address adminModuleAddr = oldBatcher.vaultAdminModule();
        address existingUtilsHelper = address(oldBatcher.utilsHelper());

        SaltConfig memory salts;
        salts.phase2Module = _saltFromEpoch(PHASE2_MODULE_SALT_TAG_PREFIX, epochTag);
        salts.phase1Module = _saltFromEpoch(PHASE1_MODULE_SALT_TAG_PREFIX, epochTag);
        salts.phase3Helper = _saltFromEpoch(PHASE3_HELPER_SALT_TAG_PREFIX, epochTag);
        salts.shareMeshHelper = _saltFromEpoch(SHARE_MESH_HELPER_SALT_TAG_PREFIX, epochTag);
        salts.utilsHelper = _saltFromEpoch(UTILS_HELPER_SALT_TAG_PREFIX, epochTag);
        salts.deploymentBatcher = _saltFromEpoch(DEPLOYMENT_BATCHER_SALT_TAG_PREFIX, epochTag);

        PredictedAddresses memory predicted = _predictBundle(
            cfg,
            salts,
            storeAddr,
            create2DeployerAddr,
            coreModuleAddr,
            strategiesModuleAddr,
            adminModuleAddr,
            existingUtilsHelper,
            reuseUtilsHelper
        );

        console2.log("Old deployment batcher:", oldBatcherAddr);
        console2.log("Protocol treasury Safe:", cfg.protocolTreasury);
        console2.log("Broadcaster:", broadcaster);
        console2.log("Epoch tag:", epochTag);
        console2.log("Predicted new batcher shell:", predicted.deploymentBatcher);
        console2.log("Predicted phase2 module:", predicted.phase2Module);
        console2.log("Predicted phase1 module:", predicted.phase1Module);
        console2.log("Predicted phase3 helper:", predicted.phase3Helper);
        console2.log("Predicted share mesh helper:", predicted.shareMeshHelper);
        console2.log("Predicted utils helper:", predicted.utilsHelper);

        vm.startBroadcast(pk);

        if (!reuseUtilsHelper) {
            _deployCreate2IfMissing(salts.utilsHelper, _buildUtilsHelperInit());
        }
        _deployCreate2IfMissing(
            salts.phase2Module, _buildPhase2ModuleInit(cfg, create2DeployerAddr, predicted.deploymentBatcher)
        );
        _deployCreate2IfMissing(
            salts.phase3Helper, _buildPhase3HelperInit(cfg, create2DeployerAddr, predicted.deploymentBatcher)
        );
        _deployCreate2IfMissing(
            salts.shareMeshHelper, _buildShareMeshHelperInit(cfg, create2DeployerAddr, predicted.deploymentBatcher)
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
                cfg.agentVaultCoreModule,
                predicted.utilsHelper,
                predicted.deploymentBatcher
            )
        );
        _deployCreate2IfMissing(
            salts.deploymentBatcher,
            _buildBatcherShellInit(
                cfg, storeAddr, create2DeployerAddr, coreModuleAddr, strategiesModuleAddr, adminModuleAddr
            )
        );

        vm.stopBroadcast();

        DeploymentBatcher newBatcher = DeploymentBatcher(predicted.deploymentBatcher);
        require(newBatcher.protocolTreasury() == cfg.protocolTreasury, "treasury mismatch");
        require(address(newBatcher.bytecodeStore()) == storeAddr, "store mismatch");
        require(address(newBatcher.create2Deployer()) == create2DeployerAddr, "create2 mismatch");

        if (skipSafeWiring) {
            console2.log("SKIP_SAFE_WIRING=1 - execute via protocol treasury Safe:");
            console2.log(string.concat("  wireDeploymentHelpers("));
            console2.log(string.concat("    ", vm.toString(predicted.phase2Module), ","));
            console2.log(string.concat("    ", vm.toString(predicted.phase3Helper), ","));
            console2.log(string.concat("    ", vm.toString(predicted.shareMeshHelper), ","));
            console2.log(string.concat("    ", vm.toString(predicted.utilsHelper), ")"));
            console2.log(string.concat("  setPhase1Module(", vm.toString(predicted.phase1Module), ")"));
            return;
        }

        vm.startBroadcast(pk);

        _safeExec(
            cfg.protocolTreasury,
            predicted.deploymentBatcher,
            abi.encodeWithSelector(
                DeploymentBatcher.wireDeploymentHelpers.selector,
                predicted.phase2Module,
                predicted.phase3Helper,
                predicted.shareMeshHelper,
                predicted.utilsHelper
            ),
            pk
        );
        console2.log("wireDeploymentHelpers executed via protocol treasury Safe");

        _safeExec(
            cfg.protocolTreasury,
            predicted.deploymentBatcher,
            abi.encodeWithSelector(DeploymentBatcher.setPhase1Module.selector, predicted.phase1Module),
            pk
        );
        console2.log("setPhase1Module executed via protocol treasury Safe");

        bytes32 solanaDestination = oldBatcher.solanaDestination();
        if (solanaDestination != bytes32(0)) {
            _safeExec(
                cfg.protocolTreasury,
                predicted.deploymentBatcher,
                abi.encodeWithSelector(DeploymentBatcher.setSolanaDestination.selector, solanaDestination),
                pk
            );
            console2.log("setSolanaDestination copied from old batcher");
        }

        DeploymentBatcher.OVaultRuntimeConfig memory runtime = oldBatcher.getOVaultRuntimeConfig();
        if (runtime.enabled) {
            _safeExec(
                cfg.protocolTreasury,
                predicted.deploymentBatcher,
                abi.encodeWithSelector(
                    DeploymentBatcher.setOVaultRuntimeConfig.selector, runtime.hubComposer, runtime.solanaEid, true
                ),
                pk
            );
            console2.log("setOVaultRuntimeConfig copied from old batcher");
        }

        address rolePolicyManager = oldBatcher.vaultRolePolicyManager();
        uint256 rolePolicyId = oldBatcher.vaultRolePolicyId();
        if (rolePolicyManager != address(0)) {
            _safeExec(
                cfg.protocolTreasury,
                predicted.deploymentBatcher,
                abi.encodeWithSelector(
                    DeploymentBatcher.setVaultRolePolicyConfig.selector, rolePolicyManager, rolePolicyId
                ),
                pk
            );
            console2.log("setVaultRolePolicyConfig copied from old batcher");
        }

        vm.stopBroadcast();

        require(address(newBatcher.phase2Module()) == predicted.phase2Module, "phase2 module mismatch");
        require(address(newBatcher.phase3Helper()) == predicted.phase3Helper, "phase3 helper mismatch");
        require(address(newBatcher.shareMeshHelper()) == predicted.shareMeshHelper, "share mesh helper mismatch");
        require(address(newBatcher.utilsHelper()) == predicted.utilsHelper, "utils helper mismatch");
        require(address(newBatcher.phase1Module()) == predicted.phase1Module, "phase1 module mismatch");
        require(
            DeploymentBatcherPhase2Module(predicted.phase2Module).batcher() == predicted.deploymentBatcher,
            "phase2 batcher mismatch"
        );
        require(
            DeploymentBatcherShareMeshHelper(predicted.shareMeshHelper).batcher() == predicted.deploymentBatcher,
            "share mesh batcher mismatch"
        );

        if (skipAuthorization) {
            console2.log("SKIP_AUTHORIZATION=1 - authorize manually on create2 deployer + registry");
            return;
        }

        UniversalCreate2DeployerFromStore create2Deployer = UniversalCreate2DeployerFromStore(create2DeployerAddr);
        Registry4626 registry = Registry4626(cfg.registry);
        require(create2Deployer.owner() == broadcaster, "PRIVATE_KEY must own create2 deployer");

        vm.startBroadcast(pk);
        if (!create2Deployer.authorizedDeployers(predicted.deploymentBatcher)) {
            create2Deployer.setAuthorizedDeployer(predicted.deploymentBatcher, true);
        }
        if (!create2Deployer.authorizedDeployers(predicted.phase3Helper)) {
            create2Deployer.setAuthorizedDeployer(predicted.phase3Helper, true);
        }
        if (!create2Deployer.authorizedDeployers(predicted.shareMeshHelper)) {
            create2Deployer.setAuthorizedDeployer(predicted.shareMeshHelper, true);
        }
        if (!registry.authorizedFactories(predicted.deploymentBatcher)) {
            registry.setAuthorizedFactory(predicted.deploymentBatcher, true);
        }
        if (revokeOldBatcher && registry.authorizedFactories(oldBatcherAddr)) {
            registry.setAuthorizedFactory(oldBatcherAddr, false);
            console2.log("Old batcher de-authorized on registry");
        }
        vm.stopBroadcast();

        console2.log(string.concat("HANDOFF:DEPLOYMENT_BATCHER=", vm.toString(predicted.deploymentBatcher)));
        console2.log(string.concat("HANDOFF:DEPLOYMENT_BATCHER=", vm.toString(predicted.deploymentBatcher)));
        console2.log(string.concat("HANDOFF:DEPLOYMENT_BATCHER_PHASE2_MODULE=", vm.toString(predicted.phase2Module)));
        console2.log(string.concat("HANDOFF:DEPLOYMENT_BATCHER_PHASE1_MODULE=", vm.toString(predicted.phase1Module)));
        console2.log(string.concat("HANDOFF:DEPLOYMENT_BATCHER_PHASE3_HELPER=", vm.toString(predicted.phase3Helper)));
        console2.log(
            string.concat("HANDOFF:DEPLOYMENT_BATCHER_SHARE_MESH_HELPER=", vm.toString(predicted.shareMeshHelper))
        );
        console2.log(string.concat("HANDOFF:OLD_DEPLOYMENT_BATCHER=", vm.toString(oldBatcherAddr)));
    }
}
