// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Script, console2} from "forge-std/Script.sol";

import {Registry4626} from "@4626/shared/core/Registry4626.sol";
import {DeploymentBatcher} from "@4626/shared/deploy/batchers/DeploymentBatcher.sol";

contract V1190RehearsalCreatorToken is ERC20 {
    constructor(address owner, uint256 amount) ERC20("v1.19 Rehearsal Creator Coin", "V119R") {
        _mint(owner, amount);
    }
}

interface IGaugeLotteryPointer {
    function lotteryManager() external view returns (address);
}

/**
 * @notice Fork-only proof that the deployed registration plane can execute the
 * canonical direct-batcher Phase1 + Phase2 registration lifecycle with current
 * v1.19 store codeIds.
 */
contract RehearseV1190GreenfieldLifecycle is Script {
    uint256 internal constant DEPOSIT_AMOUNT = 50_000_000e18;
    string internal constant VERSION = "v1.19.0-registration-plane-fork";

    function _codeIds() internal view returns (DeploymentBatcher.CodeIds memory ids) {
        ids = DeploymentBatcher.CodeIds({
            vault: vm.envBytes32("CREATOR_VAULT_CODE_ID"),
            wrapper: vm.envBytes32("CREATOR_WRAPPER_CODE_ID"),
            shareOFT: vm.envBytes32("CREATOR_SHARE_OFT_CODE_ID"),
            gauge: vm.envBytes32("CREATOR_GAUGE_CODE_ID"),
            cca: vm.envBytes32("CREATOR_CCA_CODE_ID"),
            oracle: vm.envBytes32("CREATOR_ORACLE_CODE_ID"),
            oftBootstrap: vm.envBytes32("OFT_BOOTSTRAP_CODE_ID")
        });
    }

    function run() external {
        require(block.chainid == 8453, "Base only");
        uint256 privateKey = vm.envUint("PRIVATE_KEY");
        address owner = vm.addr(privateKey);
        DeploymentBatcher batcher = DeploymentBatcher(payable(vm.envAddress("DEPLOYMENT_BATCHER")));
        Registry4626 registry = Registry4626(vm.envAddress("REGISTRY_4626"));
        address lotteryManager = vm.envAddress("LOTTERY_MANAGER");
        DeploymentBatcher.CodeIds memory ids = _codeIds();

        vm.startBroadcast(privateKey);
        V1190RehearsalCreatorToken creatorToken = new V1190RehearsalCreatorToken(owner, DEPOSIT_AMOUNT);

        DeploymentBatcher.Phase1Params memory phase1 = DeploymentBatcher.Phase1Params({
            creatorToken: address(creatorToken),
            owner: owner,
            vaultName: "v1.19 Rehearsal OVault",
            vaultSymbol: "ovV119R",
            shareName: "v1.19 Rehearsal Share",
            shareSymbol: "sV119R",
            version: VERSION,
            vaultKind: DeploymentBatcher.VaultKind.Creator
        });
        batcher.deployPhase1CoreWithSalt(phase1, ids, bytes32(0));
        DeploymentBatcher.Phase1Result memory phase1Result = batcher.finalizePhase1WithSalt(phase1, ids, bytes32(0));

        DeploymentBatcher.Phase2CoreParams memory phase2Core = DeploymentBatcher.Phase2CoreParams({
            creatorToken: address(creatorToken),
            owner: owner,
            creatorTreasury: address(0),
            payoutRecipient: address(0),
            vault: phase1Result.vault,
            wrapper: phase1Result.wrapper,
            shareOFT: phase1Result.shareOFT,
            shareSymbol: "sV119R",
            version: VERSION,
            floorPriceQ96: 0,
            gaugeInitCodeHash: bytes32(0),
            ccaInitCodeHash: bytes32(0),
            oracleInitCodeHash: bytes32(0)
        });
        DeploymentBatcher.Phase2Result memory phase2Result = batcher.deployPhase2Core(phase2Core, ids);

        DeploymentBatcher.OVaultRuntimeConfig memory runtime = batcher.getOVaultRuntimeConfig();
        require(runtime.enabled && runtime.solanaEid != 0, "Solana ShareOFT runtime not configured");
        registry.registerToken(address(creatorToken), "v1.19 Rehearsal Creator Coin", "V119R", owner, address(0), 0);
        registry.setRemoteOFTPeerBytes32(
            address(creatorToken), runtime.solanaEid, vm.envBytes32("REHEARSAL_SOLANA_SHARE_OFT_PEER")
        );

        creatorToken.approve(address(batcher), DEPOSIT_AMOUNT);
        DeploymentBatcher.Phase2FinalizeParams memory finalizeParams = DeploymentBatcher.Phase2FinalizeParams({
            creatorToken: address(creatorToken),
            owner: owner,
            vault: phase1Result.vault,
            wrapper: phase1Result.wrapper,
            shareOFT: phase1Result.shareOFT,
            gaugeController: phase2Result.gaugeController,
            ccaLaunchArm: phase2Result.ccaLaunchArm,
            oracle: phase2Result.oracle,
            version: VERSION,
            depositAmount: DEPOSIT_AMOUNT,
            requiredRaise: 1,
            floorPriceQ96: 0,
            auctionSteps: bytes("")
        });
        batcher.finalizePhase2{value: 0.1 ether}(finalizeParams);
        vm.stopBroadcast();

        require(registry.getVaultForToken(address(creatorToken)) == phase1Result.vault, "registry vault mismatch");
        require(registry.getShareOFTForToken(address(creatorToken)) == phase1Result.shareOFT, "registry share mismatch");
        require(
            registry.getGaugeControllerForToken(address(creatorToken)) == phase2Result.gaugeController,
            "registry gauge mismatch"
        );
        require(
            IGaugeLotteryPointer(phase2Result.gaugeController).lotteryManager() == lotteryManager,
            "gauge lottery mismatch"
        );

        console2.log(string.concat("LIFECYCLE:CREATOR_TOKEN=", vm.toString(address(creatorToken))));
        console2.log(string.concat("LIFECYCLE:VAULT=", vm.toString(phase1Result.vault)));
        console2.log(string.concat("LIFECYCLE:WRAPPER=", vm.toString(phase1Result.wrapper)));
        console2.log(string.concat("LIFECYCLE:SHARE_OFT=", vm.toString(phase1Result.shareOFT)));
        console2.log(string.concat("LIFECYCLE:GAUGE=", vm.toString(phase2Result.gaugeController)));
        console2.log(string.concat("LIFECYCLE:CCA=", vm.toString(phase2Result.ccaLaunchArm)));
        console2.log(string.concat("LIFECYCLE:ORACLE=", vm.toString(phase2Result.oracle)));
    }
}
