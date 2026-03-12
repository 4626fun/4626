// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";

import {CreatorLotteryManager} from "../contracts/utilities/lottery/CreatorLotteryManager.sol";

contract MockCreatorOracleAmoe {
    int256 public price = 1e18;
    uint256 public updatedAt;

    constructor() {
        updatedAt = block.timestamp;
    }

    function getCreatorPrice() external view returns (int256, uint256) {
        return (price, updatedAt);
    }
}

contract MockLotteryRegistryAmoe {
    address public immutable endpoint;
    address public immutable creatorCoin;
    address public immutable shareOFT;
    address public immutable oracle;

    constructor(address _endpoint, address _creatorCoin, address _shareOFT, address _oracle) {
        endpoint = _endpoint;
        creatorCoin = _creatorCoin;
        shareOFT = _shareOFT;
        oracle = _oracle;
    }

    function getVaultForToken(address) external pure returns (address) {
        return address(0);
    }

    function getShareOFTForToken(address token) external view returns (address) {
        if (token == creatorCoin) return shareOFT;
        return address(0);
    }

    function getTokenForShareOFT(address _shareOFT) external view returns (address) {
        if (_shareOFT == shareOFT) return creatorCoin;
        return address(0);
    }

    function getOracleForToken(address token) external view returns (address) {
        if (token == creatorCoin) return oracle;
        return address(0);
    }

    function getGaugeControllerForToken(address) external pure returns (address) {
        return address(0);
    }

    function isCreatorCoinActive(address token) external view returns (bool) {
        return token == creatorCoin;
    }

    function getLayerZeroEndpoint(uint256) external view returns (address) {
        return endpoint;
    }

    function getAllCreatorCoins() external view returns (address[] memory coins) {
        coins = new address[](1);
        coins[0] = creatorCoin;
    }
}

contract MockLocalVrfConsumerAmoe {
    uint256 public nextRequestId = 1;

    function requestRandomWords() external returns (uint256 requestId) {
        requestId = nextRequestId++;
    }
}

contract CreatorLotteryManagerAmoeTest is Test {
    CreatorLotteryManager internal lotteryManager;
    MockLotteryRegistryAmoe internal registry;
    MockCreatorOracleAmoe internal oracle;
    MockLocalVrfConsumerAmoe internal localConsumer;

    address internal owner = address(0xA11CE);
    address internal buyer = address(0xCAFE);
    address internal creatorCoin = address(0x1001);
    address internal shareOFT = address(0x1002);

    uint256 internal amoeSignerPk = 0xB0B;
    address internal amoeSigner;

    address internal constant LZ_ENDPOINT = 0x1a44076050125825900e736c501f859c50fE728c;

    function setUp() public {
        vm.mockCall(LZ_ENDPOINT, abi.encodeWithSignature("setDelegate(address)"), abi.encode());
        vm.mockCall(LZ_ENDPOINT, abi.encodeWithSignature("delegate()"), abi.encode(owner));

        amoeSigner = vm.addr(amoeSignerPk);

        oracle = new MockCreatorOracleAmoe();
        registry = new MockLotteryRegistryAmoe(LZ_ENDPOINT, creatorCoin, shareOFT, address(oracle));
        localConsumer = new MockLocalVrfConsumerAmoe();

        vm.prank(owner);
        lotteryManager = new CreatorLotteryManager(address(registry), owner);

        vm.startPrank(owner);
        lotteryManager.setLocalVRFConsumer(address(localConsumer));
        lotteryManager.setUseLocalVRF(true);
        lotteryManager.setAmoeSigner(amoeSigner);
        lotteryManager.setAmoeConfig(true, 1, 1 days);
        vm.stopPrank();
    }

    function test_submitAmoeEntry_createsEntryAtMinimumPaidOdds() public {
        bytes32 nonce = keccak256("n1");
        uint256 deadline = block.timestamp + 1 hours;
        bytes memory sig = _signAmoe(buyer, creatorCoin, nonce, deadline);

        uint256 entryId = lotteryManager.submitAmoeEntry(buyer, creatorCoin, nonce, deadline, sig);
        assertGt(entryId, 0, "entry should be created");
        assertEq(lotteryManager.totalAmoeEntries(), 1, "amoe counter should increment");
        assertTrue(lotteryManager.usedAmoeNonce(nonce), "nonce must be consumed");

        (
            address reqUser,
            address reqCreator,
            uint256 amountUSD,
            ,
            ,
            ,
            ,
            ,
            CreatorLotteryManager.EntrySource source
        ) = lotteryManager.vrfRequests(entryId);

        (uint256 minSwapAmount,,,,,) = lotteryManager.lotteryConfig();
        assertEq(reqUser, buyer, "request buyer mismatch");
        assertEq(reqCreator, creatorCoin, "request creator mismatch");
        assertEq(amountUSD, minSwapAmount, "amoe should use min paid entry amount");
        assertEq(uint8(source), uint8(CreatorLotteryManager.EntrySource.AMOE), "entry source should be AMOE");
    }

    function test_submitAmoeEntry_rejectsReplayNonce() public {
        bytes32 nonce = keccak256("n2");
        uint256 deadline = block.timestamp + 1 hours;
        bytes memory sig = _signAmoe(buyer, creatorCoin, nonce, deadline);

        lotteryManager.submitAmoeEntry(buyer, creatorCoin, nonce, deadline, sig);

        vm.expectRevert(CreatorLotteryManager.AmoeNonceUsed.selector);
        lotteryManager.submitAmoeEntry(buyer, creatorCoin, nonce, deadline, sig);
    }

    function test_submitAmoeEntry_rejectsExpiredAttestation() public {
        bytes32 nonce = keccak256("n3");
        uint256 deadline = block.timestamp - 1;
        bytes memory sig = _signAmoe(buyer, creatorCoin, nonce, deadline);

        vm.expectRevert(CreatorLotteryManager.AmoeExpired.selector);
        lotteryManager.submitAmoeEntry(buyer, creatorCoin, nonce, deadline, sig);
    }

    function test_submitAmoeEntry_rejectsInvalidSignature() public {
        bytes32 nonce = keccak256("n4");
        uint256 deadline = block.timestamp + 1 hours;

        uint256 wrongPk = 0xBAD;
        bytes32 digest = _ethSignedDigest(lotteryManager.getAmoeMessageHash(buyer, creatorCoin, nonce, deadline));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(wrongPk, digest);
        bytes memory sig = abi.encodePacked(r, s, v);

        vm.expectRevert(CreatorLotteryManager.AmoeInvalidSignature.selector);
        lotteryManager.submitAmoeEntry(buyer, creatorCoin, nonce, deadline, sig);
    }

    function test_submitAmoeEntry_enforcesPerWalletEpochCap() public {
        bytes32 nonce1 = keccak256("n5");
        uint256 deadline1 = block.timestamp + 1 hours;
        bytes memory sig1 = _signAmoe(buyer, creatorCoin, nonce1, deadline1);
        lotteryManager.submitAmoeEntry(buyer, creatorCoin, nonce1, deadline1, sig1);

        bytes32 nonce2 = keccak256("n6");
        uint256 deadline2 = block.timestamp + 1 hours;
        bytes memory sig2 = _signAmoe(buyer, creatorCoin, nonce2, deadline2);

        vm.expectRevert(CreatorLotteryManager.AmoeRateLimited.selector);
        lotteryManager.submitAmoeEntry(buyer, creatorCoin, nonce2, deadline2, sig2);

        uint256 warpedTs = 1 days + 2;
        vm.warp(warpedTs);

        bytes32 nonce3 = keccak256("n7");
        uint256 deadline3 = warpedTs + 1 hours;
        bytes memory sig3 = _signAmoe(buyer, creatorCoin, nonce3, deadline3);
        uint256 entryId = lotteryManager.submitAmoeEntry(buyer, creatorCoin, nonce3, deadline3, sig3);
        assertGt(entryId, 0, "entry should succeed in next epoch");
    }

    function _signAmoe(address _buyer, address _creatorCoin, bytes32 _nonce, uint256 _deadline)
        internal
        view
        returns (bytes memory)
    {
        bytes32 digest = _ethSignedDigest(lotteryManager.getAmoeMessageHash(_buyer, _creatorCoin, _nonce, _deadline));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(amoeSignerPk, digest);
        return abi.encodePacked(r, s, v);
    }

    function _ethSignedDigest(bytes32 hash) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", hash));
    }
}
