// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";

import {DeploymentBatcher, DeploymentBatcherShareMeshHelper} from "@4626/shared/deploy/batchers/DeploymentBatcher.sol";

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
 * @title UpgradeDeploymentBatcherShareMeshHelper
 * @notice Deploy a fresh `DeploymentBatcherShareMeshHelper` and hot-swap via protocol treasury Safe.
 *
 * Required env:
 * - PRIVATE_KEY (must be an owner on `batcher.protocolTreasury()` Safe)
 * - BASE_RPC_URL
 *
 * Optional:
 * - DEPLOYMENT_BATCHER (defaults to live shell in test/current-release-target-guard.sh)
 */
contract UpgradeDeploymentBatcherShareMeshHelper is Script {
    address constant DEFAULT_DEPLOYMENT_BATCHER = 0xa18169caf37fa0347285B16aAFC2B09eCB43F145;

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address broadcaster = vm.addr(pk);
        address batcherAddr = vm.envOr("DEPLOYMENT_BATCHER", DEFAULT_DEPLOYMENT_BATCHER);

        DeploymentBatcher batcher = DeploymentBatcher(batcherAddr);
        address treasurySafe = batcher.protocolTreasury();
        require(treasurySafe != address(0), "protocolTreasury missing");

        address previousHelper = address(batcher.shareMeshHelper());
        require(previousHelper != address(0), "share mesh helper missing");
        DeploymentBatcherShareMeshHelper previous = DeploymentBatcherShareMeshHelper(previousHelper);

        address phase2Module = address(batcher.phase2Module());
        address phase3Helper = address(batcher.phase3Helper());
        address utilsHelper = address(batcher.utilsHelper());

        console2.log("Deployment batcher:", batcherAddr);
        console2.log("Protocol treasury Safe:", treasurySafe);
        console2.log("Broadcaster:", broadcaster);
        console2.log("Previous share mesh helper:", previousHelper);

        vm.startBroadcast(pk);
        DeploymentBatcherShareMeshHelper helper = new DeploymentBatcherShareMeshHelper(
            address(previous.create2Deployer()),
            previous.poolManager(),
            previous.permit2(),
            batcherAddr
        );
        console2.log("New share mesh helper:", address(helper));

        bytes memory wireData = abi.encodeWithSelector(
            DeploymentBatcher.wireDeploymentHelpers.selector, phase2Module, phase3Helper, address(helper), utilsHelper
        );

        IGnosisSafe safe = IGnosisSafe(treasurySafe);
        bytes32 safeTxHash = safe.getTransactionHash(
            batcherAddr,
            0,
            wireData,
            IGnosisSafe.Operation.Call,
            0,
            0,
            0,
            address(0),
            payable(address(0)),
            safe.nonce()
        );

        bytes32 digest = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", safeTxHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, digest);
        if (v <= 28) {
            v += 4;
        }
        bytes memory signature = abi.encodePacked(r, s, v);

        bool ok = safe.execTransaction(
            batcherAddr,
            0,
            wireData,
            IGnosisSafe.Operation.Call,
            0,
            0,
            0,
            address(0),
            payable(address(0)),
            signature
        );
        require(ok, "Safe execTransaction failed");
        console2.log("wireDeploymentHelpers executed via protocol treasury Safe");
        vm.stopBroadcast();

        require(address(batcher.shareMeshHelper()) == address(helper), "share mesh helper mismatch");
        require(helper.batcher() == batcherAddr, "helper batcher mismatch");
    }
}
