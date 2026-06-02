// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";

import {DeploymentBatcher, DeploymentBatcherPhase1Module} from "../contracts/helpers/batchers/DeploymentBatcher.sol";
import {UniversalCreate2DeployerFromStore} from "../contracts/factories/UniversalCreate2DeployerFromStore.sol";
import {CreatorOVaultAdminModule} from "../contracts/vault/modules/CreatorOVaultAdminModule.sol";
import {CreatorOVaultCoreModule} from "../contracts/vault/modules/CreatorOVaultCoreModule.sol";
import {CreatorOVaultStrategiesModule} from "../contracts/vault/modules/CreatorOVaultStrategiesModule.sol";
import {ICreatorOVaultModuleIdentity} from "../contracts/vault/modules/ICreatorOVaultModuleIdentity.sol";

/// @notice Deploy v3 CreatorOVault modules + a Phase1Module wired to the live split batcher shell.
/// @dev Does not deploy a new DeploymentBatcher shell.
contract RotateLiveBatcherPhase1ModulesV130Impairment is Script {
    address constant CREATE2_FACTORY_ADDR = 0x4e59b44847b379578588920cA78FbF26c0B4956C;

    address constant LIVE_BATCHER = 0xa99058f424FB3ACC639F59355C65C40149030651;
    address constant LIVE_STORE = 0x8B51E6784A0C6681F5de25bAC4f9B2fDCEDE72b4;
    address constant LIVE_CREATE2_DEPLOYER = 0x4760216AFd59B843671E0FdFCe6498Ec8CFf38a7;
    address constant LIVE_UTILS_HELPER = 0xD71C4910C7bB38FB1089Cca42b0883F1BFFfa28D;
    address constant DEFAULT_REGISTRY = 0x3f64087dc361Ad52300409E5873b26941D6418B6;
    address constant DEFAULT_VAULT_ACTIVATION_BATCHER = 0x5036FB536f53b15307825eB2006B21E22f0F3193;

    string constant DEFAULT_DEPLOYMENT_EPOCH_TAG = "v1.13.0-impairment-v1";
    string constant VAULT_CORE_MODULE_SALT_TAG_PREFIX = "base-release:CreatorOVaultCoreModule:";
    string constant VAULT_STRATEGIES_MODULE_SALT_TAG_PREFIX = "base-release:CreatorOVaultStrategiesModule:";
    string constant VAULT_ADMIN_MODULE_SALT_TAG_PREFIX = "base-release:CreatorOVaultAdminModule:";
    string constant LIVE_PHASE1_MODULE_SALT_TAG_PREFIX = "base-release:DeploymentBatcherPhase1Module:";

    bytes32 constant MODULE_STORAGE_V3 = keccak256("CreatorOVaultModuleStorage.v3");

    function _create2(address deployer, bytes32 salt, bytes32 initCodeHash) internal pure returns (address) {
        return address(uint160(uint256(keccak256(abi.encodePacked(bytes1(0xff), deployer, salt, initCodeHash)))));
    }

    function _epochTag() internal view returns (string memory) {
        return vm.envOr("DEPLOYMENT_EPOCH_TAG", DEFAULT_DEPLOYMENT_EPOCH_TAG);
    }

    function _moduleSalt(string memory prefix) internal view returns (bytes32) {
        return keccak256(bytes(string.concat(prefix, _epochTag())));
    }

    function _phase1Salt() internal view returns (bytes32) {
        string memory overrideTag = vm.envOr("PHASE1_MODULE_SALT_TAG", string(""));
        if (bytes(overrideTag).length > 0) return keccak256(bytes(overrideTag));
        return keccak256(bytes(string.concat(LIVE_PHASE1_MODULE_SALT_TAG_PREFIX, _epochTag(), "-live-batcher-store-aligned")));
    }

    function _deployCreate2IfMissing(bytes32 salt, bytes memory initCode, string memory label) internal {
        address predicted = _create2(CREATE2_FACTORY_ADDR, salt, keccak256(initCode));
        if (predicted.code.length == 0) {
            (bool ok,) = CREATE2_FACTORY_ADDR.call(abi.encodePacked(salt, initCode));
            require(ok, string.concat(label, " CREATE2 deploy failed"));
            console2.log(label, "deployed:", predicted);
        } else {
            console2.log(label, "already deployed:", predicted);
        }
        require(predicted.code.length > 0, string.concat(label, " missing bytecode after deploy"));
    }

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address broadcaster = vm.addr(pk);

        address batcher = vm.envOr("LIVE_DEPLOYMENT_BATCHER", LIVE_BATCHER);
        address storeAddr = vm.envOr("UNIVERSAL_BYTECODE_STORE", LIVE_STORE);
        address create2DeployerAddr = vm.envOr("UNIVERSAL_CREATE2_DEPLOYER", LIVE_CREATE2_DEPLOYER);
        address utilsHelperAddr = vm.envOr("LIVE_UTILS_HELPER", LIVE_UTILS_HELPER);
        address registry = vm.envOr("REGISTRY", DEFAULT_REGISTRY);
        address vaultActivation = vm.envOr("VAULT_ACTIVATION_BATCHER", DEFAULT_VAULT_ACTIVATION_BATCHER);

        require(
            address(UniversalCreate2DeployerFromStore(create2DeployerAddr).store()) == storeAddr,
            "create2Deployer.store must match UNIVERSAL_BYTECODE_STORE"
        );

        bytes32 coreSalt = _moduleSalt(VAULT_CORE_MODULE_SALT_TAG_PREFIX);
        bytes32 strategiesSalt = _moduleSalt(VAULT_STRATEGIES_MODULE_SALT_TAG_PREFIX);
        bytes32 adminSalt = _moduleSalt(VAULT_ADMIN_MODULE_SALT_TAG_PREFIX);
        bytes32 phase1Salt = _phase1Salt();

        bytes memory coreInit = type(CreatorOVaultCoreModule).creationCode;
        bytes memory strategiesInit = type(CreatorOVaultStrategiesModule).creationCode;
        bytes memory adminInit = type(CreatorOVaultAdminModule).creationCode;

        address coreModuleAddr = _create2(CREATE2_FACTORY_ADDR, coreSalt, keccak256(coreInit));
        address strategiesModuleAddr = _create2(CREATE2_FACTORY_ADDR, strategiesSalt, keccak256(strategiesInit));
        address adminModuleAddr = _create2(CREATE2_FACTORY_ADDR, adminSalt, keccak256(adminInit));

        bytes memory phase1Init = abi.encodePacked(
            type(DeploymentBatcherPhase1Module).creationCode,
            abi.encode(
                create2DeployerAddr,
                storeAddr,
                registry,
                coreModuleAddr,
                strategiesModuleAddr,
                adminModuleAddr,
                vaultActivation,
                utilsHelperAddr,
                batcher
            )
        );
        address phase1ModuleAddr = _create2(CREATE2_FACTORY_ADDR, phase1Salt, keccak256(phase1Init));

        console2.log("Broadcaster:", broadcaster);
        console2.log("Live DeploymentBatcher:", batcher);
        console2.log("CreatorOVaultCoreModule (predicted):", coreModuleAddr);
        console2.log("CreatorOVaultStrategiesModule (predicted):", strategiesModuleAddr);
        console2.log("CreatorOVaultAdminModule (predicted):", adminModuleAddr);
        console2.log("DeploymentBatcherPhase1Module (predicted):", phase1ModuleAddr);

        vm.startBroadcast(pk);
        _deployCreate2IfMissing(coreSalt, coreInit, "CreatorOVaultCoreModule");
        _deployCreate2IfMissing(strategiesSalt, strategiesInit, "CreatorOVaultStrategiesModule");
        _deployCreate2IfMissing(adminSalt, adminInit, "CreatorOVaultAdminModule");
        _deployCreate2IfMissing(phase1Salt, phase1Init, "DeploymentBatcherPhase1Module");
        vm.stopBroadcast();

        _assertModuleStorageV3(coreModuleAddr, "CreatorOVaultCoreModule");
        _assertModuleStorageV3(strategiesModuleAddr, "CreatorOVaultStrategiesModule");
        _assertModuleStorageV3(adminModuleAddr, "CreatorOVaultAdminModule");

        require(
            DeploymentBatcherPhase1Module(phase1ModuleAddr).batcher() == batcher,
            "phase1Module batcher mismatch"
        );

        console2.log("SAFE_WIRING_REQUIRED: setPhase1Module(", phase1ModuleAddr, ") on batcher", batcher);
        console2.log("HANDOFF:CREATOR_OVAULT_CORE_MODULE=", coreModuleAddr);
        console2.log("HANDOFF:CREATOR_OVAULT_STRATEGIES_MODULE=", strategiesModuleAddr);
        console2.log("HANDOFF:CREATOR_OVAULT_ADMIN_MODULE=", adminModuleAddr);
        console2.log("HANDOFF:SPLIT_PHASE1_PHASE1_MODULE=", phase1ModuleAddr);
    }

    function _assertModuleStorageV3(address moduleAddr, string memory label) internal view {
        bytes32 reported = ICreatorOVaultModuleIdentity(moduleAddr).moduleStorageVersion();
        require(reported == MODULE_STORAGE_V3, string.concat(label, " not v3 fingerprint"));
    }
}

