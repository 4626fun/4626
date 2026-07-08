// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";

import {OVaultImpairmentClaims} from "@4626/shared/vault/recovery/OVaultImpairmentClaims.sol";
import {OVaultRecoveryEscrow} from "@4626/shared/vault/recovery/OVaultRecoveryEscrow.sol";

/// @notice Deploy shared impairment-v1 auxiliary contracts.
/// @dev These are configured per-vault after deployment via `setVault(...)`.
contract DeployImpairmentAuxContracts is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address broadcaster = vm.addr(pk);
        address owner = vm.envOr("IMPAIRMENT_CONTRACT_OWNER", broadcaster);

        console2.log("Broadcaster:", broadcaster);
        console2.log("Owner:", owner);

        vm.startBroadcast(pk);
        OVaultImpairmentClaims claims = new OVaultImpairmentClaims(owner);
        OVaultRecoveryEscrow escrow = new OVaultRecoveryEscrow(owner);
        vm.stopBroadcast();

        console2.log("HANDOFF:IMPAIRMENT_CLAIMS=", address(claims));
        console2.log("HANDOFF:IMPAIRMENT_RECOVERY_ESCROW=", address(escrow));
        console2.log("NEXT_STEP: setVault(vaultAddress) on both contracts for each vault");
    }
}

