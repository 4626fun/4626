// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";

import {ChainlinkVRFIntegratorV2_5, IRandomWordsCallbackV2_5} from
    "../contracts/utilities/lottery/vrf/ChainlinkVRFIntegratorV2_5.sol";
import {MessagingFee, Origin} from "@layerzerolabs/oapp-evm/contracts/oapp/OApp.sol";
import {MessagingReceipt} from "@layerzerolabs/oapp-evm/contracts/oapp/OAppSender.sol";

contract MockRandomWordsCallback is IRandomWordsCallbackV2_5 {
    uint256 public calls;
    uint256 public lastRequestId;
    uint256 public lastRandomWord;

    function receiveRandomWords(uint256[] memory randomWords, uint256 requestId) external {
        calls += 1;
        lastRequestId = requestId;
        lastRandomWord = randomWords.length > 0 ? randomWords[0] : 0;
    }
}

contract ChainlinkVRFIntegratorHarness is ChainlinkVRFIntegratorV2_5 {
    uint256 public mockNativeFee = 0.01 ether;
    uint256 public lzSendCount;
    uint32 public lastDstEid;
    bytes public lastPayload;

    constructor(address endpoint, address owner, uint32 hubEid) ChainlinkVRFIntegratorV2_5(endpoint, owner, hubEid) {}

    function setMockNativeFee(uint256 fee) external {
        mockNativeFee = fee;
    }

    function exposedLzReceive(Origin calldata origin, bytes calldata payload, bytes calldata extraData) external {
        _lzReceive(origin, bytes32(0), payload, address(0), extraData);
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
        uint32 dstEid,
        bytes memory payload,
        bytes memory,
        MessagingFee memory fee,
        address
    ) internal override returns (MessagingReceipt memory receipt) {
        lzSendCount += 1;
        lastDstEid = dstEid;
        lastPayload = payload;
        receipt = MessagingReceipt({guid: bytes32(lzSendCount), nonce: uint64(lzSendCount), fee: fee});
    }
}

contract ChainlinkVRFIntegratorV2_5NonblockingLzReceiveTest is Test {
    uint32 internal constant HUB_EID = 30184;
    address internal constant LZ_ENDPOINT = 0x1a44076050125825900e736c501f859c50fE728c;

    bytes32 internal constant HUB_PEER = bytes32(uint256(0xBEEF));

    ChainlinkVRFIntegratorHarness internal integrator;
    MockRandomWordsCallback internal provider;

    function setUp() external {
        // OApp constructor calls into the endpoint; mock the minimal surface.
        vm.mockCall(LZ_ENDPOINT, abi.encodeWithSignature("setDelegate(address)"), abi.encode());
        vm.mockCall(LZ_ENDPOINT, abi.encodeWithSignature("delegate()"), abi.encode(address(this)));

        integrator = new ChainlinkVRFIntegratorHarness(LZ_ENDPOINT, address(this), HUB_EID);
        integrator.setPeer(HUB_EID, HUB_PEER);
        integrator.setMockNativeFee(0.02 ether);
        integrator.setRequestTimeout(10);

        provider = new MockRandomWordsCallback();
        // Requests (including payable) are permissioned to prevent hub VRF griefing.
        integrator.setSponsoredCallerAuthorization(address(provider), true);
        vm.deal(address(provider), 10 ether);
    }

    function _originFromHub() internal pure returns (Origin memory) {
        return Origin({srcEid: HUB_EID, sender: HUB_PEER, nonce: 1});
    }

    function _newFormatPayload(uint64 sequence, uint256 word) internal view returns (bytes memory) {
        // Matches the spoke decoder: (uint64,uint256,int256,uint256)
        return abi.encode(sequence, word, int256(0), block.timestamp);
    }

    function test_lateResponse_doesNotRevert_andCallbacks() external {
        vm.prank(address(provider));
        (, uint64 seq) = integrator.requestRandomWordsPayable{value: 0.02 ether}();

        vm.warp(block.timestamp + 11);

        integrator.exposedLzReceive(_originFromHub(), _newFormatPayload(seq, 123), hex"");

        (bool fulfilled, bool exists, address storedProvider, uint256 storedWord,, bool expired) = integrator
            .checkRequestStatus(seq);
        assertTrue(exists);
        assertTrue(fulfilled);
        assertEq(storedProvider, address(provider));
        assertEq(storedWord, 123);
        assertTrue(expired);

        assertEq(provider.calls(), 1);
        assertEq(provider.lastRequestId(), seq);
        assertEq(provider.lastRandomWord(), 123);
    }

    function test_cleanupExpiredRequests_cannotBurnInFlightResponse() external {
        vm.prank(address(provider));
        (, uint64 seq) = integrator.requestRandomWordsPayable{value: 0.02 ether}();

        vm.warp(block.timestamp + 11);

        uint64[] memory ids = new uint64[](1);
        ids[0] = seq;
        vm.prank(address(0xBAD));
        integrator.cleanupExpiredRequests(ids);

        integrator.exposedLzReceive(_originFromHub(), _newFormatPayload(seq, 999), hex"");

        (bool fulfilled, bool exists, address storedProvider, uint256 storedWord,,) = integrator.checkRequestStatus(seq);
        assertTrue(exists);
        assertTrue(fulfilled);
        assertEq(storedProvider, address(provider));
        assertEq(storedWord, 999);
        assertEq(provider.calls(), 1);
    }

    function test_duplicateResponse_isIgnoredWithoutRevert() external {
        vm.prank(address(provider));
        (, uint64 seq) = integrator.requestRandomWordsPayable{value: 0.02 ether}();

        integrator.exposedLzReceive(_originFromHub(), _newFormatPayload(seq, 111), hex"");
        integrator.exposedLzReceive(_originFromHub(), _newFormatPayload(seq, 222), hex"");

        (uint256 storedWord, bool fulfilled) = integrator.getRandomWord(seq);
        assertTrue(fulfilled);
        assertEq(storedWord, 111);
        assertEq(provider.calls(), 1);
    }

    function test_missingRequest_doesNotRevert() external {
        integrator.exposedLzReceive(_originFromHub(), _newFormatPayload(777, 555), hex"");

        (bool fulfilled, bool exists,, uint256 storedWord,,) = integrator.checkRequestStatus(777);
        assertFalse(exists);
        assertFalse(fulfilled);
        assertEq(storedWord, 0);
    }

    function test_invalidPayloadSize_doesNotRevert_andDoesNotFulfill() external {
        vm.prank(address(provider));
        (, uint64 seq) = integrator.requestRandomWordsPayable{value: 0.02 ether}();

        integrator.exposedLzReceive(_originFromHub(), hex"1234", hex"");

        (uint256 word, bool fulfilled) = integrator.getRandomWord(seq);
        assertFalse(fulfilled);
        assertEq(word, 0);
    }
}

