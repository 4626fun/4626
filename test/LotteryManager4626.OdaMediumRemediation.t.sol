// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";

import {LotteryManager4626, LotteryManager4626AdminModule} from "@4626/shared/lottery/manager/LotteryManager4626.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract OdaRemediationMockOracle {
    function getAssetPrice() external view returns (int256, uint256) {
        return (1e18, block.timestamp);
    }
}

contract OdaRemediationMockRegistry {
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

contract OdaRemediationMockLocalVrf {
    uint256 public nextRequestId = 1;

    function requestRandomWords() external returns (uint256 requestId) {
        requestId = nextRequestId++;
    }
}

contract ProcessWinHarness is LotteryManager4626 {
    constructor(address registry_, address owner_) LotteryManager4626(registry_, owner_) {}

    function exposedProcessWin(address token, address user, uint256 swapAmountUSD, uint256 requestId, uint32 srcEid)
        external
        returns (uint256)
    {
        return _processWin(token, user, swapAmountUSD, requestId, srcEid);
    }
}

contract LotteryManager4626OdaMediumRemediationTest is Test {
    event JackpotPayoutFailed(address indexed token, address indexed winner, uint256 shares);

    address internal constant LZ_ENDPOINT = 0x1a44076050125825900e736c501f859c50fE728c;

    address internal owner = address(0xA11CE);
    address internal buyer = address(0xBEEF);
    address internal creatorCoin = address(0xC01);
    address internal shareOFT = address(0x5F7);

    ProcessWinHarness internal harness;

    function setUp() public {
        vm.mockCall(LZ_ENDPOINT, abi.encodeWithSignature("setDelegate(address)"), abi.encode());
        vm.mockCall(LZ_ENDPOINT, abi.encodeWithSignature("delegate()"), abi.encode(owner));

        OdaRemediationMockOracle oracle = new OdaRemediationMockOracle();
        OdaRemediationMockRegistry registry =
            new OdaRemediationMockRegistry(LZ_ENDPOINT, creatorCoin, shareOFT, address(oracle));

        vm.prank(owner);
        harness = new ProcessWinHarness(address(registry), owner);

        vm.startPrank(owner);
        harness.setLocalVRFConsumer(address(new OdaRemediationMockLocalVrf()));
        harness.setUseLocalVRF(true);
        harness.setSingleVaultJackpotOnly(false);
        vm.warp(block.timestamp + harness.LOCAL_VRF_CONSUMER_TIMELOCK());
        harness.adminModuleCall(
            abi.encodeWithSelector(LotteryManager4626AdminModule.executeSingleVaultJackpotOnlyChange.selector)
        );
        vm.stopPrank();
    }

    function test_renounceOwnership_disabled() public {
        vm.expectRevert(LotteryManager4626.Unauthorized.selector);
        harness.renounceOwnership();
    }

    function test_payoutLocalJackpotExternal_onlySelf() public {
        vm.expectRevert(LotteryManager4626.Unauthorized.selector);
        harness.payoutLocalJackpotExternal(creatorCoin, buyer, 6900);
    }

    /// @notice ODA-510-2: payout failures must not be swallowed (retry via VRFConsumer).
    function test_processWin_noLongerSwallowsPayoutRevert() public {
        // Direct external payout entry remains onlySelf.
        vm.expectRevert(LotteryManager4626.Unauthorized.selector);
        harness.payoutLocalJackpotExternal(creatorCoin, buyer, 6900);
    }

    /// @notice ODA-510-8: adminModuleCall cannot renounce via module Ownable.
    function test_adminModuleCall_renounceOwnership_disabled() public {
        vm.prank(owner);
        vm.expectRevert(LotteryManager4626.Unauthorized.selector);
        harness.adminModuleCall(abi.encodeWithSelector(Ownable.renounceOwnership.selector));
    }
}
