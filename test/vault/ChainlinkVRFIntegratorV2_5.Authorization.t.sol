// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";

import {MessagingFee} from "@layerzerolabs/oapp-evm/contracts/oapp/OApp.sol";
import {MessagingReceipt} from "@layerzerolabs/oapp-evm/contracts/oapp/OAppSender.sol";

import {ChainlinkVRFIntegratorV2_5} from "../../contracts/utilities/lottery/vrf/ChainlinkVRFIntegratorV2_5.sol";

contract MockEndpointV2_ForIntegrator {
    address public delegate;

    function setDelegate(address _delegate) external {
        delegate = _delegate;
    }
}

contract ChainlinkVRFIntegratorAuthorizationHarness is ChainlinkVRFIntegratorV2_5 {
    uint256 public mockNativeFee = 0.01 ether;
    uint256 public lzSendCount;
    uint32 public lastDstEid;
    uint256 public lastMsgValue;

    constructor(address _endpoint, address _owner, uint32 _hubEid) ChainlinkVRFIntegratorV2_5(_endpoint, _owner, _hubEid) {}

    function setMockNativeFee(uint256 _fee) external {
        mockNativeFee = _fee;
    }

    function _quote(
        uint32,
        bytes memory,
        bytes memory,
        bool
    ) internal view override returns (MessagingFee memory fee) {
        fee = MessagingFee({nativeFee: mockNativeFee, lzTokenFee: 0});
    }

    function _lzSend(
        uint32 _dstEid,
        bytes memory,
        bytes memory,
        MessagingFee memory _fee,
        address
    ) internal override returns (MessagingReceipt memory receipt) {
        lzSendCount += 1;
        lastDstEid = _dstEid;
        lastMsgValue = msg.value;
        receipt = MessagingReceipt({guid: bytes32(lzSendCount), nonce: uint64(lzSendCount), fee: _fee});
    }
}

contract ChainlinkVRFIntegratorV25AuthorizationTest is Test {
    uint32 internal constant HUB_EID = 30184;
    bytes32 internal constant HUB_PEER = bytes32(uint256(0xBEEF));

    address internal attacker = address(0x9999);

    ChainlinkVRFIntegratorAuthorizationHarness internal integrator;

    function setUp() external {
        MockEndpointV2_ForIntegrator endpoint = new MockEndpointV2_ForIntegrator();
        integrator = new ChainlinkVRFIntegratorAuthorizationHarness(address(endpoint), address(this), HUB_EID);
        integrator.setPeer(HUB_EID, HUB_PEER);
        integrator.setMockNativeFee(0.02 ether);

        vm.deal(attacker, 10 ether);
    }

    function test_unathorizedEOACannotCallPayableRequest() external {
        // Pre-fix: payable requests are public and this call succeeds (test FAILS).
        // Post-fix: payable requests are permissioned and must revert.
        MessagingFee memory fee = integrator.quoteFee();

        vm.prank(attacker);
        vm.expectRevert(ChainlinkVRFIntegratorV2_5.UnauthorizedSponsoredCaller.selector);
        integrator.requestRandomWordsPayable{value: fee.nativeFee}(HUB_EID);
    }

    function test_authorizedCallerCanCallPayableRequest() external {
        MessagingFee memory fee = integrator.quoteFee();
        integrator.requestRandomWordsPayable{value: fee.nativeFee}(HUB_EID);

        assertEq(integrator.lzSendCount(), 1);
        assertEq(integrator.lastDstEid(), HUB_EID);
        assertEq(integrator.lastMsgValue(), fee.nativeFee);
    }
}

