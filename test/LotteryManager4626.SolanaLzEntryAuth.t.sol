// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {LotteryManager4626} from "@4626/shared/lottery/manager/LotteryManager4626.sol";
import {MessagingFee, Origin} from "@layerzerolabs/oapp-evm/contracts/oapp/OApp.sol";
import {MessagingReceipt} from "@layerzerolabs/lz-evm-protocol-v2/contracts/interfaces/ILayerZeroEndpointV2.sol";

contract SolanaLzMockOracle {
    function getAssetPrice() external view returns (int256, uint256) {
        return (1e18, block.timestamp);
    }
}

contract SolanaLzMockShareOFT {
    uint8 public constant decimals = 18;
    uint256 public constant totalSupply = 1_000_000 ether;

    function balanceOf(address) external pure returns (uint256) {
        return 0;
    }

    function balanceEligibleForLotteryCoverage(address) external pure returns (uint256) {
        return 0;
    }
}

contract SolanaLzMockRegistry {
    address public immutable endpoint;
    address public immutable creatorCoin;
    address public immutable shareOFT;
    address public immutable oracle;

    constructor(address endpoint_, address creatorCoin_, address shareOFT_, address oracle_) {
        endpoint = endpoint_;
        creatorCoin = creatorCoin_;
        shareOFT = shareOFT_;
        oracle = oracle_;
    }

    function getVaultForToken(address) external pure returns (address) {
        return address(0);
    }

    function getShareOFTForToken(address token) external view returns (address) {
        return token == creatorCoin ? shareOFT : address(0);
    }

    function getTokenForShareOFT(address candidate) external view returns (address) {
        return candidate == shareOFT ? creatorCoin : address(0);
    }

    function getOracleForToken(address token) external view returns (address) {
        return token == creatorCoin ? oracle : address(0);
    }

    function getGaugeControllerForToken(address) external pure returns (address) {
        return address(0);
    }

    function isTokenActive(address token) external view returns (bool) {
        return token == creatorCoin;
    }

    function getLayerZeroEndpoint(uint256) external view returns (address) {
        return endpoint;
    }

    function getAllTokens() external view returns (address[] memory tokens) {
        tokens = new address[](1);
        tokens[0] = creatorCoin;
    }
}

contract SolanaLzMockVrfIntegrator {
    uint64 public nextSequence = 1;
    uint256 public requestCount;
    uint256 public nativeFee;

    function setNativeFee(uint256 fee_) external {
        nativeFee = fee_;
    }

    function quoteFee() external view returns (MessagingFee memory fee) {
        return MessagingFee({nativeFee: nativeFee, lzTokenFee: 0});
    }

    function requestRandomWordsPayable(uint32)
        external
        payable
        returns (MessagingReceipt memory receipt, uint64 sequence)
    {
        requestCount++;
        sequence = nextSequence++;
        receipt = MessagingReceipt({
            guid: bytes32(uint256(sequence)),
            nonce: sequence,
            fee: MessagingFee({nativeFee: msg.value, lzTokenFee: 0})
        });
    }
}

contract SolanaLzLotteryManagerHarness is LotteryManager4626 {
    constructor(address registry_, address owner_) LotteryManager4626(registry_, owner_) {}

    function exposedLzReceive(Origin calldata origin, bytes calldata payload) external {
        _lzReceive(origin, bytes32(0), payload, address(0), payload[:0]);
    }
}

contract LotteryManager4626SolanaLzEntryAuthTest is Test {
    uint32 internal constant SOLANA_EID = 30168;
    address internal constant LZ_ENDPOINT = 0x1a44076050125825900e736c501f859c50fE728c;

    address internal owner = address(0xA11CE);
    address internal hubForwarder = address(0xF00D);
    address internal buyer = address(0xBEEF);
    address internal creatorCoin = address(0xC01);
    bytes32 internal solanaPeer = bytes32(uint256(0x51));

    SolanaLzLotteryManagerHarness internal lotteryManager;
    SolanaLzMockVrfIntegrator internal integrator;
    SolanaLzMockShareOFT internal shareOFT;

    function setUp() public {
        vm.mockCall(LZ_ENDPOINT, abi.encodeWithSignature("setDelegate(address)"), abi.encode());
        vm.mockCall(LZ_ENDPOINT, abi.encodeWithSignature("delegate()"), abi.encode(owner));

        shareOFT = new SolanaLzMockShareOFT();
        SolanaLzMockOracle oracle = new SolanaLzMockOracle();
        SolanaLzMockRegistry registry =
            new SolanaLzMockRegistry(LZ_ENDPOINT, creatorCoin, address(shareOFT), address(oracle));
        integrator = new SolanaLzMockVrfIntegrator();

        vm.prank(owner);
        lotteryManager = new SolanaLzLotteryManagerHarness(address(registry), owner);

        vm.startPrank(owner);
        lotteryManager.setVRFIntegrator(address(integrator));
        lotteryManager.setTargetEid(30184);
        lotteryManager.setUseLocalVRF(false);
        lotteryManager.setPeer(30184, bytes32(uint256(uint160(address(0x1234)))));
        lotteryManager.setAuthorizedRemoteOFT(SOLANA_EID, solanaPeer, true);
        lotteryManager.setAuthorizedHubShareOftForwarder(hubForwarder, true);
        vm.stopPrank();
    }

    function _v3Payload(bytes32 sourceEventId) internal view returns (bytes memory) {
        return abi.encode(
            uint16(lotteryManager.MSG_TYPE_LOTTERY_ENTRY()),
            buyer,
            address(shareOFT),
            uint256(1 ether),
            uint32(0),
            uint256(0),
            sourceEventId
        );
    }

    function _origin(bytes32 sender) internal pure returns (Origin memory) {
        return Origin({srcEid: SOLANA_EID, sender: sender, nonce: 1});
    }

    function test_unauthorizedSolanaRemoteOftSkippedNotBricked() public {
        // ODA-461-11: unauthorized inbound emits+returns (does not revert / brick LZ).
        bytes memory payload = _v3Payload(keccak256("event-1"));
        lotteryManager.exposedLzReceive(_origin(bytes32(uint256(0x99))), payload);
        assertEq(integrator.requestCount(), 0);
    }

    function test_unauthorizedHubForwarderReverts() public {
        bytes memory payload = _v3Payload(keccak256("event-1"));
        vm.expectRevert(LotteryManager4626.Unauthorized.selector);
        lotteryManager.receiveRemoteLotteryEntry(SOLANA_EID, solanaPeer, payload);
    }

    function test_solEntryRequiresV3ReplayKey() public {
        bytes memory v2Payload = abi.encode(
            uint16(lotteryManager.MSG_TYPE_LOTTERY_ENTRY()),
            buyer,
            address(shareOFT),
            uint256(1 ether),
            uint32(0),
            uint256(0)
        );

        lotteryManager.exposedLzReceive(_origin(solanaPeer), v2Payload);
        assertEq(integrator.requestCount(), 0, "Solana V2 must fail closed");
    }

    function test_solEntryRejectsZeroV3ReplayKey() public {
        lotteryManager.exposedLzReceive(_origin(solanaPeer), _v3Payload(bytes32(0)));
        assertEq(integrator.requestCount(), 0, "zero source event id must fail closed");
    }

    function test_authorizedSolanaV3EntryConsumesReplayKey() public {
        bytes32 sourceEventId = keccak256("event-1");
        lotteryManager.exposedLzReceive(_origin(solanaPeer), _v3Payload(sourceEventId));

        assertEq(integrator.requestCount(), 1);
    }

    function test_duplicateSolanaSourceEventDoesNotCreateSecondEntry() public {
        bytes32 sourceEventId = keccak256("event-1");
        bytes memory payload = _v3Payload(sourceEventId);

        lotteryManager.exposedLzReceive(_origin(solanaPeer), payload);
        lotteryManager.exposedLzReceive(_origin(solanaPeer), payload);

        assertEq(integrator.requestCount(), 1, "duplicate source event must be rejected");
    }

    function test_distinctSolanaSourceEventsCreateDistinctEntries() public {
        lotteryManager.exposedLzReceive(_origin(solanaPeer), _v3Payload(keccak256("event-1")));
        lotteryManager.exposedLzReceive(_origin(solanaPeer), _v3Payload(keccak256("event-2")));

        assertEq(integrator.requestCount(), 2);
    }

    function test_malformedRemotePayloadSkippedNotBricked() public {
        vm.prank(hubForwarder);
        lotteryManager.receiveRemoteLotteryEntry(SOLANA_EID, solanaPeer, hex"deadbeef");

        bytes memory payload = _v3Payload(keccak256("event-1"));
        vm.prank(hubForwarder);
        lotteryManager.receiveRemoteLotteryEntry(SOLANA_EID, solanaPeer, payload);
        assertEq(integrator.requestCount(), 1);
    }

    function test_solanaSourceEventConsumedEvenWhenVrfSkipped() public {
        bytes32 sourceEventId = keccak256("event-skip");
        bytes memory payload = _v3Payload(sourceEventId);

        // Non-zero LZ fee with empty sponsorship budget → entryId == 0 (skip).
        integrator.setNativeFee(1 ether);
        lotteryManager.exposedLzReceive(_origin(solanaPeer), payload);
        assertEq(integrator.requestCount(), 0, "sponsorship skip must not create VRF request");

        // Even after fees become free, the same digest must not create an entry.
        integrator.setNativeFee(0);
        lotteryManager.exposedLzReceive(_origin(solanaPeer), payload);
        assertEq(integrator.requestCount(), 0, "digest must remain consumed after VRF skip");
    }

    // --- ODA-426-F2: forwarder lane peer re-check + V3 replay ---

    function test_forwarderRejectsUnauthorizedOriginSender() public {
        bytes memory payload = _v3Payload(keccak256("event-1"));
        vm.prank(hubForwarder);
        vm.expectRevert(LotteryManager4626.Unauthorized.selector);
        lotteryManager.receiveRemoteLotteryEntry(SOLANA_EID, bytes32(uint256(0x99)), payload);
    }

    function test_forwarderRejectsZeroV3ReplayKey() public {
        // Build payload before prank — `_v3Payload` staticcalls the manager and would consume it.
        bytes memory payload = _v3Payload(bytes32(0));
        vm.prank(hubForwarder);
        lotteryManager.receiveRemoteLotteryEntry(SOLANA_EID, solanaPeer, payload);
        assertEq(integrator.requestCount(), 0, "forwarder zero sourceEventId must fail closed");
    }

    function test_forwarderRejectsV2PayloadMissingReplayKey() public {
        bytes memory v2Payload = abi.encode(
            uint16(lotteryManager.MSG_TYPE_LOTTERY_ENTRY()),
            buyer,
            address(shareOFT),
            uint256(1 ether),
            uint32(0),
            uint256(0)
        );
        assertEq(v2Payload.length, 192);

        vm.prank(hubForwarder);
        lotteryManager.receiveRemoteLotteryEntry(SOLANA_EID, solanaPeer, v2Payload);
        assertEq(integrator.requestCount(), 0, "forwarder V2 payload must be rejected");
    }

    function test_forwarderAuthorizedV3EntryCreatesRequest() public {
        bytes memory payload = _v3Payload(keccak256("forwarder-ok"));
        vm.prank(hubForwarder);
        lotteryManager.receiveRemoteLotteryEntry(SOLANA_EID, solanaPeer, payload);
        assertEq(integrator.requestCount(), 1);
    }

    /// @notice ODA-460-[2]: duplicate forwarder delivery must not assembly-return past
    ///         `nonReentrant`'s epilogue (permanent ENTERED brick).
    function test_forwarderDuplicateSourceEventDoesNotBrickNonReentrant() public {
        bytes memory payload = _v3Payload(keccak256("fwd-dup"));
        vm.prank(hubForwarder);
        lotteryManager.receiveRemoteLotteryEntry(SOLANA_EID, solanaPeer, payload);
        assertEq(integrator.requestCount(), 1);

        vm.prank(hubForwarder);
        lotteryManager.receiveRemoteLotteryEntry(SOLANA_EID, solanaPeer, payload);
        assertEq(integrator.requestCount(), 1, "duplicate must be a no-op");

        bytes memory payload2 = _v3Payload(keccak256("fwd-dup-2"));
        vm.prank(hubForwarder);
        lotteryManager.receiveRemoteLotteryEntry(SOLANA_EID, solanaPeer, payload2);
        assertEq(integrator.requestCount(), 2, "nonReentrant must not stay ENTERED after duplicate");
    }

    /// @notice ODA-460-6: replay key is namespaced by (srcEid, originSender, sourceEventId).
    function test_sameSourceEventIdDifferentOriginDoesNotCollide() public {
        bytes32 sourceEventId = keccak256("shared-id");
        bytes32 otherPeer = bytes32(uint256(0x52));

        vm.startPrank(owner);
        lotteryManager.setAuthorizedRemoteOFT(SOLANA_EID, otherPeer, true);
        vm.stopPrank();

        lotteryManager.exposedLzReceive(_origin(solanaPeer), _v3Payload(sourceEventId));
        assertEq(integrator.requestCount(), 1);

        lotteryManager.exposedLzReceive(
            Origin({srcEid: SOLANA_EID, sender: otherPeer, nonce: 2}), _v3Payload(sourceEventId)
        );
        assertEq(integrator.requestCount(), 2, "namespaced keys must not collide across peers");
    }
}
