// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {CCALaunchStrategy} from "../contracts/vault/strategies/CCALaunchStrategy.sol";

contract MockLaunchToken is ERC20 {
    constructor() ERC20("Launch Token", "LTKN") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract MockAuction {
    bool public tokensReceived;
    uint256 public onTokensReceivedCalls;
    uint128 public immutable auctionSupply;

    constructor(uint128 supply) {
        auctionSupply = supply;
    }

    function submitBid(uint256, uint128, address, uint256, bytes calldata) external payable returns (uint256 bidId) {
        bidId = 0;
    }

    function checkpoint() external {}
    function exitBid(uint256) external {}
    function claimTokens(uint256) external {}
    function isGraduated() external pure returns (bool) {
        return true;
    }
    function sweepCurrency() external {}
    function sweepUnsoldTokens() external {}
    function clearingPrice() external pure returns (uint256) {
        return 0;
    }
    function currencyRaised() external pure returns (uint256) {
        return 0;
    }
    function totalSupply() external view returns (uint128) {
        return auctionSupply;
    }

    function onTokensReceived() external {
        tokensReceived = true;
        onTokensReceivedCalls++;
    }
}

contract MockCcaFactory {
    address public lastToken;
    uint256 public lastAmount;
    bytes public lastConfigData;
    bytes32 public lastSalt;
    MockAuction public lastAuction;

    function initializeDistribution(address token, uint256 amount, bytes calldata configData, bytes32 salt)
        external
        returns (address)
    {
        lastToken = token;
        lastAmount = amount;
        lastConfigData = configData;
        lastSalt = salt;

        lastAuction = new MockAuction(uint128(amount));
        return address(lastAuction);
    }
}

contract CCALaunchStrategyLaunchHandshakeTest is Test {
    uint24 internal constant MPS = 10_000_000;

    struct EncodedAuctionParams {
        address currency;
        address tokensRecipient;
        address fundsRecipient;
        uint64 startBlock;
        uint64 endBlock;
        uint64 claimBlock;
        uint256 tickSpacing;
        address validationHook;
        uint256 floorPrice;
        uint128 requiredCurrencyRaised;
        bytes auctionStepsData;
    }

    MockLaunchToken internal token;
    CCALaunchStrategy internal strategy;
    MockCcaFactory internal factory;

    function setUp() external {
        token = new MockLaunchToken();
        strategy = new CCALaunchStrategy(address(token), address(0), address(this), address(this), address(this));
        factory = new MockCcaFactory();

        strategy.setCcaFactory(address(factory));

        token.mint(address(this), 1_000_000e18);
        token.approve(address(strategy), type(uint256).max);
    }

    function testLaunchAuctionUsesSafeScheduleAndFundsAuction() external {
        uint256 amount = 100_000e18;
        uint256 floorPrice = 1e15;
        uint128 requiredRaise = 1e18;
        bytes memory callerProvidedSteps = hex"1234";

        address auction = strategy.launchAuction(amount, floorPrice, requiredRaise, callerProvidedSteps);

        assertEq(auction, address(factory.lastAuction()), "auction address mismatch");
        assertEq(token.balanceOf(address(strategy)), 0, "strategy should not retain auction tokens");
        assertEq(token.balanceOf(auction), amount, "auction must be funded with full auction amount");

        MockAuction launchedAuction = MockAuction(auction);
        assertTrue(launchedAuction.tokensReceived(), "onTokensReceived should be called");
        assertEq(launchedAuction.onTokensReceivedCalls(), 1, "onTokensReceived should be called exactly once");

        EncodedAuctionParams memory params = abi.decode(factory.lastConfigData(), (EncodedAuctionParams));
        bytes memory expectedSafeSteps = _createUniswapSafeDefaultSteps(strategy.defaultDuration());

        assertEq(keccak256(params.auctionStepsData), keccak256(expectedSafeSteps), "strategy should enforce safe schedule");
        assertTrue(
            keccak256(params.auctionStepsData) != keccak256(callerProvidedSteps),
            "caller-provided auctionSteps must be ignored"
        );
        assertEq(params.auctionStepsData.length, 24, "safe schedule should contain exactly 3 steps");

        (uint24 finalMps, uint40 finalBlockDelta) = _parseStep(params.auctionStepsData, 2);
        assertEq(finalBlockDelta, 1, "final step should reserve the final block");
        assertGt(finalMps, 1_000_000, "final step should sell a significant amount");
    }

    function _parseStep(bytes memory packedSteps, uint256 stepIndex) internal pure returns (uint24 mps, uint40 blockDelta) {
        uint256 offset = stepIndex * 8;
        uint64 packed;
        for (uint256 i = 0; i < 8; i++) {
            packed = (packed << 8) | uint64(uint8(packedSteps[offset + i]));
        }
        mps = uint24(packed >> 40);
        blockDelta = uint40(packed);
    }

    function _createLinearSteps(uint64 duration) internal pure returns (bytes memory) {
        uint24 mpsPerBlock = uint24(uint256(MPS) / uint256(duration));
        bytes8 packed = bytes8((uint64(mpsPerBlock) << 40) | uint64(duration));
        return abi.encodePacked(packed);
    }

    function _createUniswapSafeDefaultSteps(uint64 duration) internal pure returns (bytes memory) {
        if (duration <= 2) return _createLinearSteps(duration);

        uint64 lastBlock = 1;
        uint64 phase1Blocks = duration / 2;
        uint64 phase2Blocks = duration - phase1Blocks - lastBlock;
        if (phase1Blocks == 0 || phase2Blocks == 0) return _createLinearSteps(duration);

        uint24 phase1Total = 1_000_000;
        uint24 phase2Total = 4_000_000;

        uint24 mps1 = uint24(uint256(phase1Total) / uint256(phase1Blocks));
        uint24 mps2 = uint24(uint256(phase2Total) / uint256(phase2Blocks));

        uint256 issued1 = uint256(mps1) * uint256(phase1Blocks);
        uint256 issued2 = uint256(mps2) * uint256(phase2Blocks);
        uint24 mps3 = uint24(uint256(MPS) - (issued1 + issued2));

        bytes8 packed1 = bytes8((uint64(mps1) << 40) | uint64(phase1Blocks));
        bytes8 packed2 = bytes8((uint64(mps2) << 40) | uint64(phase2Blocks));
        bytes8 packed3 = bytes8((uint64(mps3) << 40) | uint64(lastBlock));
        return abi.encodePacked(packed1, packed2, packed3);
    }
}
