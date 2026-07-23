// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";

import {CreatorOVaultCoreModule} from "@4626/creator/vault/modules/CreatorOVaultCoreModule.sol";
import {DeploymentBatcher, DeploymentBatcherPhase1Module} from "@4626/shared/deploy/batchers/DeploymentBatcher.sol";
import {UniversalCreate2DeployerFromStore} from "@4626/shared/deploy/factories/UniversalCreate2DeployerFromStore.sol";
import {IOVaultModuleIdentity} from "@4626/shared/interfaces/vault/IOVaultModuleIdentity.sol";

/// @notice Deploys a reproducible CreatorOVaultCoreModule and a replacement
///         Phase1Module for new creator-vault launches on the live Base batcher.
/// @dev This deliberately reuses the live Agent core, Strategies, Admin,
///      activation batcher, utilities, registry, and bytecode store. It does not
///      touch Phase2 or LotteryManager. Safe approval/wiring remains a separate
///      transaction through execute-set-phase1-module-safe.ts.
contract RotateLiveBatcherCreatorCoreV194 is Script {
    address constant EIP2470_CREATE2_FACTORY = 0x4e59b44847b379578588920cA78FbF26c0B4956C;
    address constant LIVE_BATCHER = 0xa18169caf37fa0347285B16aAFC2B09eCB43F145;

    string constant DEFAULT_DEPLOYMENT_EPOCH_TAG = "v1.19.4";
    string constant CREATOR_CORE_SALT_PREFIX = "base-release:CreatorOVaultCoreModule:";
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

        bytes32 creatorCoreSalt = keccak256(bytes(string.concat(CREATOR_CORE_SALT_PREFIX, epoch)));
        bytes32 phase1Salt =
            keccak256(bytes(string.concat(PHASE1_SALT_PREFIX, epoch, "-creator-core-only-live-batcher-store-aligned")));

        bytes memory creatorCoreInit = type(CreatorOVaultCoreModule).creationCode;
        address creatorCore = _predict(creatorCoreSalt, creatorCoreInit);

        bytes memory phase1Init = abi.encodePacked(
            type(DeploymentBatcherPhase1Module).creationCode,
            abi.encode(
                address(previous.create2Deployer()),
                address(previous.bytecodeStore()),
                previous.registry(),
                creatorCore,
                previous.agentVaultCoreModule(),
                previous.vaultStrategiesModule(),
                previous.vaultAdminModule(),
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
        console2.log("DeploymentBatcherPhase1Module (predicted):", phase1);
        console2.log("Reusing AgentOVaultCoreModule:", previous.agentVaultCoreModule());
        console2.log("Reusing OVaultStrategiesModule:", previous.vaultStrategiesModule());
        console2.log("Reusing OVaultAdminModule:", previous.vaultAdminModule());
        console2.log("Preserving Phase2Module:", address(batcher.phase2Module()));
        console2.log("Preserving LotteryManager:", batcher.lotteryManager());

        vm.startBroadcast(privateKey);
        _deployIfMissing(creatorCoreSalt, creatorCoreInit, "CreatorOVaultCoreModule");
        _deployIfMissing(phase1Salt, phase1Init, "DeploymentBatcherPhase1Module");
        vm.stopBroadcast();

        _assertStorageV5(creatorCore, "CreatorOVaultCoreModule");
        _assertStorageV5(previous.agentVaultCoreModule(), "reused AgentOVaultCoreModule");
        _assertStorageV5(previous.vaultStrategiesModule(), "reused OVaultStrategiesModule");
        _assertStorageV5(previous.vaultAdminModule(), "reused OVaultAdminModule");

        DeploymentBatcherPhase1Module replacement = DeploymentBatcherPhase1Module(phase1);
        require(replacement.batcher() == batcherAddress, "replacement Phase1 batcher mismatch");
        require(replacement.vaultCoreModule() == creatorCore, "replacement creator core mismatch");
        require(replacement.agentVaultCoreModule() == previous.agentVaultCoreModule(), "replacement agent core changed");
        require(
            replacement.vaultStrategiesModule() == previous.vaultStrategiesModule(), "replacement strategies changed"
        );
        require(replacement.vaultAdminModule() == previous.vaultAdminModule(), "replacement admin changed");
        require(address(batcher.phase1Module()) == address(previous), "script must not wire Phase1Module");

        console2.log("SAFE_WIRING_REQUIRED: approve codehash + setPhase1Module", phase1);
        console2.log(string.concat("HANDOFF:OVAULT_CORE_MODULE=", vm.toString(creatorCore)));
        console2.log(string.concat("HANDOFF:DEPLOYMENT_BATCHER_PHASE1_MODULE=", vm.toString(phase1)));
    }

    function _predict(bytes32 salt, bytes memory initCode) internal pure returns (address) {
        return address(
            uint160(
                uint256(keccak256(abi.encodePacked(bytes1(0xff), EIP2470_CREATE2_FACTORY, salt, keccak256(initCode))))
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
