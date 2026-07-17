// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";

import {DeploymentBatcher, DeploymentBatcherPhase3Helper} from "@4626/shared/deploy/batchers/DeploymentBatcher.sol";

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
 * @title UpgradeDeploymentBatcherPhase3Automation
 * @notice Hot-swap `DeploymentBatcherPhase3Helper` when its immutable `protocolAutomation`
 *         was wired to the cold treasury Safe instead of the hot automation Safe.
 *
 * Required env:
 * - PRIVATE_KEY (must be an owner on `batcher.protocolTreasury()` Safe)
 * - BASE_RPC_URL
 *
 * Optional:
 * - DEPLOYMENT_BATCHER (defaults to v1.16.1-share-mesh shell)
 * - PROTOCOL_AUTOMATION_SAFE (defaults to `0x08f0875E40781578F902998b2b831cc48d838eBE`)
 */
contract UpgradeDeploymentBatcherPhase3Automation is Script {
    address constant DEFAULT_DEPLOYMENT_BATCHER = 0xa18169caf37fa0347285B16aAFC2B09eCB43F145;
    address constant DEFAULT_PROTOCOL_AUTOMATION_SAFE = 0x08f0875E40781578F902998b2b831cc48d838eBE;

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address broadcaster = vm.addr(pk);
        address batcherAddr = vm.envOr("DEPLOYMENT_BATCHER", DEFAULT_DEPLOYMENT_BATCHER);
        address automationSafe = vm.envOr("PROTOCOL_AUTOMATION_SAFE", DEFAULT_PROTOCOL_AUTOMATION_SAFE);
        require(automationSafe != address(0), "protocol automation missing");

        DeploymentBatcher batcher = DeploymentBatcher(batcherAddr);
        address treasurySafe = batcher.protocolTreasury();
        require(treasurySafe != address(0), "protocolTreasury missing");
        require(automationSafe != treasurySafe, "automation must differ from treasury");

        address previousHelper = address(batcher.phase3Helper());
        require(previousHelper != address(0), "phase3 helper missing");
        DeploymentBatcherPhase3Helper previous = DeploymentBatcherPhase3Helper(previousHelper);

        address phase2Module = address(batcher.phase2Module());
        address shareMeshHelper = address(batcher.shareMeshHelper());
        address utilsHelper = address(batcher.utilsHelper());
        require(phase2Module != address(0), "phase2 module missing");
        require(shareMeshHelper != address(0), "share mesh helper missing");
        require(utilsHelper != address(0), "utils helper missing");

        console2.log("Deployment batcher:", batcherAddr);
        console2.log("Protocol treasury Safe:", treasurySafe);
        console2.log("Protocol automation Safe:", automationSafe);
        console2.log("Broadcaster:", broadcaster);
        console2.log("Previous phase3 helper:", previousHelper);
        console2.log("Previous phase3 protocolAutomation:", previous.protocolAutomation());

        if (previous.protocolAutomation() == automationSafe) {
            console2.log("Phase3 helper already uses the correct protocol automation Safe; no-op.");
            return;
        }

        vm.startBroadcast(pk);
        DeploymentBatcherPhase3Helper helper = new DeploymentBatcherPhase3Helper(
            address(previous.create2Deployer()),
            treasurySafe,
            automationSafe,
            previous.usdc(),
            previous.uniswapV3Factory(),
            previous.uniswapRouter(),
            previous.ajnaFactory(),
            batcherAddr
        );
        console2.log("New phase3 helper:", address(helper));
        require(helper.protocolAutomation() == automationSafe, "new helper automation mismatch");
        require(helper.protocolTreasury() == treasurySafe, "new helper treasury mismatch");

        bytes memory wireData = abi.encodeWithSelector(
            DeploymentBatcher.wireDeploymentHelpers.selector, phase2Module, address(helper), shareMeshHelper, utilsHelper
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

        require(address(batcher.phase3Helper()) == address(helper), "phase3 helper mismatch");
        require(helper.batcher() == batcherAddr, "helper batcher mismatch");
        require(DeploymentBatcherPhase3Helper(address(batcher.phase3Helper())).protocolAutomation() == automationSafe, "wired automation mismatch");
    }
}
