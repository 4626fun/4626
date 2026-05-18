// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";

import {DeployAlfaCreatorKeyLPFactory} from "../../../alfaclub/contracts/script/DeployAlfaCreatorKeyLPFactory.s.sol";
import {AlfaCreatorKeyLPFactory} from "../../../contracts/alfaclub/AlfaCreatorKeyLPFactory.sol";

/// @notice Smoke test for the `AlfaCreatorKeyLPFactory` deploy script.
/// @dev    Runs the script in-process (no `--broadcast`) and asserts the
///         post-deploy invariants the script enforces, plus a couple of
///         conventional sanity checks.
contract DeployAlfaCreatorKeyLPFactoryTest is Test {
    DeployAlfaCreatorKeyLPFactory internal script;

    address internal constant OWNER = address(0xBEEF);
    uint256 internal constant DEPLOYER_KEY = uint256(0xA11CE);
    uint256 internal constant CHAIN_ID_BASE_SEPOLIA = 84532;

    function setUp() public {
        script = new DeployAlfaCreatorKeyLPFactory();
        vm.chainId(CHAIN_ID_BASE_SEPOLIA);
        vm.setEnv("PRIVATE_KEY", vm.toString(bytes32(DEPLOYER_KEY)));
        vm.setEnv("FACTORY_OWNER", vm.toString(OWNER));
        vm.setEnv("ALLOW_NON_BASE", "0");
    }

    function testDeploysWithExpectedOwnerAndFriendKey() public {
        AlfaCreatorKeyLPFactory factory = script.run();

        assertEq(factory.owner(), OWNER, "owner");
        assertEq(
            factory.friendKey(),
            factory.BASE_ALFA_CLUB_FRIEND_KEY(),
            "friendKey wired to Base mainnet constant"
        );
        assertEq(factory.TRADING_FEE_BPS(), 690, "trading fee");
        assertEq(factory.SOCIAL_FEE_BPS(), 3, "social fee");
        assertEq(factory.allPoolsLength(), 0, "no pools at deploy");
    }

    function testDeploysOnBaseMainnet() public {
        vm.chainId(8453);
        AlfaCreatorKeyLPFactory factory = script.run();
        assertEq(factory.owner(), OWNER, "owner");
    }

    function testAllowsNonBaseChainsWithOverride() public {
        vm.chainId(1);
        vm.setEnv("ALLOW_NON_BASE", "1");
        AlfaCreatorKeyLPFactory factory = script.run();
        assertEq(factory.owner(), OWNER, "owner");
    }
}
