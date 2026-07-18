// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";

import {DeployAlfaCreatorKeyLPFactory} from "alfaclub/contracts/script/DeployAlfaCreatorKeyLPFactory.s.sol";

/// @notice Ensures the retired custom AlfaClub AMM cannot be deployed again.
contract DeployAlfaCreatorKeyLPFactoryRetirementTest is Test {
    function testLegacyCustomAmmDeployPathFailsClosed() public {
        DeployAlfaCreatorKeyLPFactory script = new DeployAlfaCreatorKeyLPFactory();

        vm.expectRevert(DeployAlfaCreatorKeyLPFactory.CustomAlfaClubAmmRetired.selector);
        script.run();
    }
}
