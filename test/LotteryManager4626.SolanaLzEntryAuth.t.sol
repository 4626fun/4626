// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";

/// @notice Solana LZ-era remote-entry auth gates (Twin permanently retired).
/// @dev Harness mirrors LM `receiveRemoteLotteryEntry` / `authorizedRemoteOFTs` checks
///      without depending on full LM deploy for unit auth proofs.
contract MockLmForSolanaAuth {
    uint16 public constant MSG_TYPE_LOTTERY_ENTRY = 3;
    mapping(address => bool) public authorizedHubShareOftForwarders;
    mapping(uint32 => mapping(bytes32 => bool)) public authorizedRemoteOFTs;

    uint256 public remoteEntriesHandled;
    uint256 public invalidPayloadCount;
    address public lastBuyer;
    uint256 public lastCoverage;

    error Unauthorized();

    function setAuthorizedHubShareOftForwarder(address shareOft, bool authorized) external {
        authorizedHubShareOftForwarders[shareOft] = authorized;
    }

    function setAuthorizedRemoteOFT(uint32 srcEid, bytes32 sender, bool authorized) external {
        authorizedRemoteOFTs[srcEid][sender] = authorized;
    }

    function receiveRemoteLotteryEntry(uint32 srcEid, bytes32 originSender, bytes calldata payload) external {
        if (!authorizedHubShareOftForwarders[msg.sender]) revert Unauthorized();
        _handle(srcEid, originSender, payload);
    }

    function lzReceiveAsRemoteOFT(uint32 srcEid, bytes32 sender, bytes calldata payload) external {
        if (!authorizedRemoteOFTs[srcEid][sender]) revert Unauthorized();
        uint16 msgType = abi.decode(payload, (uint16));
        require(msgType == MSG_TYPE_LOTTERY_ENTRY, "bad msg");
        _handle(srcEid, sender, payload);
    }

    function _handle(uint32, bytes32, bytes calldata payload) internal {
        if (payload.length != 192 && payload.length != 160) {
            invalidPayloadCount++;
            return;
        }
        address buyer;
        address tokenIn;
        uint256 amount;
        uint256 coverage;
        if (payload.length == 192) {
            (, buyer, tokenIn, amount,, coverage) =
                abi.decode(payload, (uint16, address, address, uint256, uint32, uint256));
        } else {
            (, buyer, tokenIn, amount,) = abi.decode(payload, (uint16, address, address, uint256, uint32));
            coverage = 0;
        }
        if (buyer == address(0) || tokenIn == address(0) || amount == 0) return;
        remoteEntriesHandled++;
        lastBuyer = buyer;
        lastCoverage = coverage;
    }
}

contract LotteryManager4626SolanaLzEntryAuthTest is Test {
    uint32 constant SOLANA_EID = 30168;
    MockLmForSolanaAuth lm;

    address hubForwarder = address(0xF00D);
    bytes32 solanaPeer = bytes32(uint256(0x51));
    address buyer = address(0xBEEF);
    address shareOft = address(0x51A6E);

    function setUp() public {
        lm = new MockLmForSolanaAuth();
    }

    function _v2Payload(uint256 coverage) internal view returns (bytes memory) {
        return abi.encode(uint16(3), buyer, shareOft, uint256(1 ether), uint32(0), coverage);
    }

    function test_unauthorizedHubForwarderReverts() public {
        bytes memory payload = _v2Payload(0);
        vm.expectRevert(MockLmForSolanaAuth.Unauthorized.selector);
        lm.receiveRemoteLotteryEntry(SOLANA_EID, solanaPeer, payload);
    }

    function test_unauthorizedSolanaRemoteOftReverts() public {
        bytes memory payload = _v2Payload(0);
        vm.expectRevert(MockLmForSolanaAuth.Unauthorized.selector);
        lm.lzReceiveAsRemoteOFT(SOLANA_EID, solanaPeer, payload);
    }

    function test_wrongSourceChainPeerRejected() public {
        lm.setAuthorizedRemoteOFT(SOLANA_EID, solanaPeer, true);
        bytes32 wrongPeer = bytes32(uint256(0x99));
        bytes memory payload = _v2Payload(0);
        vm.expectRevert(MockLmForSolanaAuth.Unauthorized.selector);
        lm.lzReceiveAsRemoteOFT(SOLANA_EID, wrongPeer, payload);
    }

    function test_malformedRemotePayloadSkippedNotBricked() public {
        lm.setAuthorizedHubShareOftForwarder(hubForwarder, true);
        vm.prank(hubForwarder);
        lm.receiveRemoteLotteryEntry(SOLANA_EID, solanaPeer, hex"deadbeef");
        assertEq(lm.invalidPayloadCount(), 1);
        assertEq(lm.remoteEntriesHandled(), 0);
    }

    function test_authorizedSolanaEntryBaseOddsCoverageZero() public {
        lm.setAuthorizedRemoteOFT(SOLANA_EID, solanaPeer, true);
        bytes memory payload = _v2Payload(0);
        lm.lzReceiveAsRemoteOFT(SOLANA_EID, solanaPeer, payload);
        assertEq(lm.remoteEntriesHandled(), 1);
        assertEq(lm.lastBuyer(), buyer);
        assertEq(lm.lastCoverage(), 0);
    }

    function test_hubForwarderPathAcceptsV2Payload() public {
        lm.setAuthorizedHubShareOftForwarder(hubForwarder, true);
        bytes memory payload = _v2Payload(0);
        vm.prank(hubForwarder);
        lm.receiveRemoteLotteryEntry(SOLANA_EID, solanaPeer, payload);
        assertEq(lm.remoteEntriesHandled(), 1);
        assertEq(lm.lastCoverage(), 0);
    }
}
