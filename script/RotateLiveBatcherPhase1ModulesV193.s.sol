// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";

import {AgentOVaultCoreModule} from "@4626/agent/vault/modules/AgentOVaultCoreModule.sol";
import {CreatorOVaultCoreModule} from "@4626/creator/vault/modules/CreatorOVaultCoreModule.sol";
import {
    DeploymentBatcher,
    DeploymentBatcherPhase1Module
} from "@4626/shared/deploy/batchers/DeploymentBatcher.sol";
import {UniversalCreate2DeployerFromStore} from "@4626/shared/deploy/factories/UniversalCreate2DeployerFromStore.sol";
import {IOVaultModuleIdentity} from "@4626/shared/interfaces/vault/IOVaultModuleIdentity.sol";
import {OVaultAdminModule} from "@4626/shared/vault/modules/OVaultAdminModule.sol";
import {OVaultStrategiesModule} from "@4626/shared/vault/modules/OVaultStrategiesModule.sol";

/// @notice Deploy the v1.19.3 OVaultModuleStorage.v5 modules and a replacement
///         Phase1Module for the live v1.19.1 greenfield batcher shell.
/// @dev Deployment is deterministic through the canonical EIP-2470 factory.
///      Safe approval/wiring is deliberately separate; use
///      frontend/scripts/ops/execute-set-phase1-module-safe.ts after verifying
///      the HANDOFF addresses emitted by this script.
contract RotateLiveBatcherPhase1ModulesV193 is Script {
    address constant EIP2470_CREATE2_FACTORY = 0x4e59b44847b379578588920cA78FbF26c0B4956C;
    address constant LIVE_BATCHER = 0xa18169caf37fa0347285B16aAFC2B09eCB43F145;

    string constant DEFAULT_DEPLOYMENT_EPOCH_TAG = "v1.19.3";
    string constant CREATOR_CORE_SALT_PREFIX = "base-release:CreatorOVaultCoreModule:";
    string constant AGENT_CORE_SALT_PREFIX = "base-release:AgentOVaultCoreModule:";
    string constant STRATEGIES_SALT_PREFIX = "base-release:OVaultStrategiesModule:";
    string constant ADMIN_SALT_PREFIX = "base-release:OVaultAdminModule:";
    string constant PHASE1_SALT_PREFIX = "base-release:DeploymentBatcherPhase1Module:";

    bytes32 constant MODULE_STORAGE_V5 = keccak256("OVaultModuleStorage.v5");

    function run() external {
        uint256 privateKey = vm.envUint("PRIVATE_KEY");
        address broadcaster = vm.addr(privateKey);
        address batcherAddress = vm.envOr("DEPLOYMENT_BATCHER", LIVE_BATCHER);
        string memory epoch = vm.envOr("DEPLOYMENT_EPOCH_TAG", DEFAULT_DEPLOYMENT_EPOCH_TAG);

        DeploymentBatcher batcher = DeploymentBatcher(batcherAddress);
        DeploymentBatcherPhase1Module previous = batcher.phase1Module();
        require(address(previous) != address(0), "live Phase1Module missing");
        require(previous.batcher() == batcherAddress, "previous Phase1 batcher mismatch");
        require(
            address(UniversalCreate2DeployerFromStore(address(previous.create2Deployer())).store())
                == address(previous.bytecodeStore()),
            "Phase1 create2/store mismatch"
        );

        bytes32 creatorCoreSalt = _salt(CREATOR_CORE_SALT_PREFIX, epoch);
        bytes32 agentCoreSalt = _salt(AGENT_CORE_SALT_PREFIX, epoch);
        bytes32 strategiesSalt = _salt(STRATEGIES_SALT_PREFIX, epoch);
        bytes32 adminSalt = _salt(ADMIN_SALT_PREFIX, epoch);
        bytes32 phase1Salt = keccak256(bytes(string.concat(PHASE1_SALT_PREFIX, epoch, "-live-batcher-store-aligned")));

        bytes memory creatorCoreInit = type(CreatorOVaultCoreModule).creationCode;
        bytes memory agentCoreInit = type(AgentOVaultCoreModule).creationCode;
        bytes memory strategiesInit = type(OVaultStrategiesModule).creationCode;
        bytes memory adminInit = type(OVaultAdminModule).creationCode;

        address creatorCore = _predict(creatorCoreSalt, creatorCoreInit);
        address agentCore = _predict(agentCoreSalt, agentCoreInit);
        address strategies = _predict(strategiesSalt, strategiesInit);
        address admin = _predict(adminSalt, adminInit);

        bytes memory phase1Init = abi.encodePacked(
            type(DeploymentBatcherPhase1Module).creationCode,
            abi.encode(
                address(previous.create2Deployer()),
                address(previous.bytecodeStore()),
                previous.registry(),
                creatorCore,
                agentCore,
                strategies,
                admin,
                previous.vaultActivationBatcher(),
                address(previous.utilsHelper()),
                batcherAddress
            )
        );
        address phase1 = _predict(phase1Salt, phase1Init);

        console2.log("Broadcaster:", broadcaster);
        console2.log("Deployment epoch:", epoch);
        console2.log("Live DeploymentBatcher:", batcherAddress);
        console2.log("Previous Phase1Module:", address(previous));
        console2.log("CreatorOVaultCoreModule (predicted):", creatorCore);
        console2.log("AgentOVaultCoreModule (predicted):", agentCore);
        console2.log("OVaultStrategiesModule (predicted):", strategies);
        console2.log("OVaultAdminModule (predicted):", admin);
        console2.log("DeploymentBatcherPhase1Module (predicted):", phase1);

        vm.startBroadcast(privateKey);
        _deployIfMissing(creatorCoreSalt, creatorCoreInit, "CreatorOVaultCoreModule");
        _deployIfMissing(agentCoreSalt, agentCoreInit, "AgentOVaultCoreModule");
        _deployIfMissing(strategiesSalt, strategiesInit, "OVaultStrategiesModule");
        _deployIfMissing(adminSalt, adminInit, "OVaultAdminModule");
        _deployIfMissing(phase1Salt, phase1Init, "DeploymentBatcherPhase1Module");
        vm.stopBroadcast();

        _assertStorageV5(creatorCore, "CreatorOVaultCoreModule");
        _assertStorageV5(agentCore, "AgentOVaultCoreModule");
        _assertStorageV5(strategies, "OVaultStrategiesModule");
        _assertStorageV5(admin, "OVaultAdminModule");

        DeploymentBatcherPhase1Module replacement = DeploymentBatcherPhase1Module(phase1);
        require(replacement.batcher() == batcherAddress, "replacement Phase1 batcher mismatch");
        require(replacement.vaultCoreModule() == creatorCore, "replacement creator core mismatch");
        require(replacement.agentVaultCoreModule() == agentCore, "replacement agent core mismatch");
        require(replacement.vaultStrategiesModule() == strategies, "replacement strategies mismatch");
        require(replacement.vaultAdminModule() == admin, "replacement admin mismatch");

        console2.log("SAFE_WIRING_REQUIRED: approve codehash + setPhase1Module", phase1);
        console2.log(string.concat("HANDOFF:OVAULT_CORE_MODULE=", vm.toString(creatorCore)));
        console2.log(string.concat("HANDOFF:AGENT_OVAULT_CORE_MODULE=", vm.toString(agentCore)));
        console2.log(string.concat("HANDOFF:OVAULT_STRATEGIES_MODULE=", vm.toString(strategies)));
        console2.log(string.concat("HANDOFF:OVAULT_ADMIN_MODULE=", vm.toString(admin)));
        console2.log(string.concat("HANDOFF:DEPLOYMENT_BATCHER_PHASE1_MODULE=", vm.toString(phase1)));
    }

    function _salt(string memory prefix, string memory epoch) internal pure returns (bytes32) {
        return keccak256(bytes(string.concat(prefix, epoch)));
    }

    function _predict(bytes32 salt, bytes memory initCode) internal pure returns (address) {
        return address(
            uint160(
                uint256(
                    keccak256(abi.encodePacked(bytes1(0xff), EIP2470_CREATE2_FACTORY, salt, keccak256(initCode)))
                )
            )
        );
    }

    function _deployIfMissing(bytes32 salt, bytes memory initCode, string memory label) internal {
        address predicted = _predict(salt, initCode);
        if (predicted.code.length == 0) {
            (bool ok,) = EIP2470_CREATE2_FACTORY.call(abi.encodePacked(salt, initCode));
            require(ok, string.concat(label, " CREATE2 deploy failed"));
            console2.log(label, "deployed:", predicted);
        } else {
            console2.log(label, "already deployed:", predicted);
        }
        require(predicted.code.length > 0, string.concat(label, " missing bytecode after deploy"));
    }

    function _assertStorageV5(address module, string memory label) internal view {
        bytes32 reported = IOVaultModuleIdentity(module).moduleStorageVersion();
        require(reported == MODULE_STORAGE_V5, string.concat(label, " is not OVaultModuleStorage.v5"));
    }
}
