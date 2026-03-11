// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/utilities/lottery/vrf/ChainlinkVRFIntegratorV2_5.sol";

contract ChainlinkVRFIntegratorV2_5SecurityTest is Test {
    ChainlinkVRFIntegratorV2_5 internal integrator;

    address internal owner = address(0xA11CE);
    address internal authorizedCaller = address(0xBEEF);
    address internal attacker = address(0xBAD);

    uint32 internal constant HUB_EID = 30184;
    address internal constant LZ_ENDPOINT = 0x1a44076050125825900e736c501f859c50fE728c;

    function setUp() public {
        vm.mockCall(LZ_ENDPOINT, abi.encodeWithSignature("setDelegate(address)"), abi.encode());
        vm.mockCall(LZ_ENDPOINT, abi.encodeWithSignature("delegate()"), abi.encode(owner));

        vm.prank(owner);
        integrator = new ChainlinkVRFIntegratorV2_5(LZ_ENDPOINT, owner, HUB_EID);
    }

    function test_RequestRandomWords_RevertsForUnauthorizedCaller() public {
        vm.prank(attacker);
        vm.expectRevert(ChainlinkVRFIntegratorV2_5.UnauthorizedSponsoredCaller.selector);
        integrator.requestRandomWords();
    }

    function test_RequestRandomWords_OwnerPassesSponsoredGateByDefault() public {
        vm.prank(owner);
        vm.expectRevert(bytes("Hub peer not set"));
        integrator.requestRandomWords();
    }

    function test_RequestRandomWords_AuthorizedCallerPassesSponsoredGate() public {
        vm.prank(owner);
        integrator.setSponsoredCallerAuthorization(authorizedCaller, true);

        vm.prank(authorizedCaller);
        vm.expectRevert(bytes("Hub peer not set"));
        integrator.requestRandomWords();
    }

    function test_RequestRandomWordsPayable_WithTargetEidRejectsInvalidDestination() public {
        uint32 invalidEid = HUB_EID + 1;
        // Must pass the sponsored-caller gate to reach destination validation.
        vm.deal(owner, 1);

        vm.prank(owner);
        vm.expectRevert(bytes("Invalid destination"));
        integrator.requestRandomWordsPayable{value: 1}(invalidEid);
    }

    function test_RequestRandomWordsPayable_NoArgWrapperUsesHubPath() public {
        // Must pass the sponsored-caller gate to reach hub-path validation.
        vm.deal(owner, 1);

        vm.prank(owner);
        vm.expectRevert(bytes("Hub peer not set"));
        integrator.requestRandomWordsPayable{value: 1}();
    }
}
