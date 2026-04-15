// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {ICreatorOracle} from "../../interfaces/ICreatorOracle.sol";

contract CCALaunchStrategyEncodingHelper {
    uint24 public constant MPS = 1e7;
    uint256 public constant Q96 = 2 ** 96;
    uint256 public constant BPS_DENOMINATOR = 10_000;
    uint256 internal constant THURSDAY_EPOCH_SECONDS = 7 days;

    error LaunchOracleNotConfigured();
    error UnsupportedLaunchCurrency(address currency);
    error LaunchOracleInvalidPrice(int256 creatorUsdPrice, int256 ethUsdPrice);
    error LaunchOracleStale(uint256 creatorTimestamp, uint256 ethTimestamp, uint64 maxAge, uint256 currentTimestamp);
    error LaunchFloorTooLow(uint256 rawFloorPriceQ96, uint256 tickSpacingQ96);

    function taxHookCalldata(
        address taxHook,
        address auctionToken,
        address currency,
        address feeRecipient,
        uint256 taxRateBps
    ) external pure returns (address target, bytes memory data) {
        target = taxHook;
        data = abi.encodeWithSignature(
            "setTaxConfig(address,address,address,uint256,bool,bool,bool)",
            auctionToken,
            currency,
            feeRecipient,
            taxRateBps,
            currency == address(0),
            true,
            false
        );
    }

    function completeAuctionCalldata(
        address strategy,
        address taxHook,
        address auctionToken,
        address currency,
        address feeRecipient,
        uint256 taxRateBps
    ) external pure returns (address[] memory targets, bytes[] memory calldatas) {
        targets = new address[](3);
        calldatas = new bytes[](3);

        targets[0] = strategy;
        calldatas[0] = abi.encodeWithSignature("sweepCurrency()");

        targets[1] = strategy;
        calldatas[1] = abi.encodeWithSignature("migrate()");

        targets[2] = taxHook;
        calldatas[2] = abi.encodeWithSignature(
            "setTaxConfig(address,address,address,uint256,bool,bool,bool)",
            auctionToken,
            currency,
            feeRecipient,
            taxRateBps,
            currency == address(0),
            true,
            false
        );
    }

    function encodeAuctionParams(
        address currency,
        address tokensRecipient,
        address fundsRecipient,
        uint256 floorPrice,
        uint256 tickSpacingQ96,
        uint128 requiredRaise,
        uint64 startBlock,
        uint64 endBlock,
        uint64 claimBlock,
        bytes calldata auctionSteps
    ) external pure returns (bytes memory) {
        return abi.encode(
            currency,
            tokensRecipient,
            fundsRecipient,
            startBlock,
            endBlock,
            claimBlock,
            tickSpacingQ96,
            address(0),
            floorPrice,
            requiredRaise,
            auctionSteps
        );
    }

    function createLinearSteps(uint64 duration) external pure returns (bytes memory) {
        return _createLinearSteps(duration);
    }

    function createUniswapSafeDefaultSteps(uint64 duration) external pure returns (bytes memory) {
        if (duration <= 2) return _createLinearSteps(duration);

        uint64 lastBlock = 1;
        uint64 phase1Blocks = duration / 2;
        uint64 phase2Blocks = duration - phase1Blocks - lastBlock;
        if (phase1Blocks == 0 || phase2Blocks == 0) return _createLinearSteps(duration);

        uint24 phase1Total = 2_000_000;
        uint24 phase2Total = 4_500_000;

        uint24 mps1 = uint24(uint256(phase1Total) / uint256(phase1Blocks));
        uint24 mps2 = uint24(uint256(phase2Total) / uint256(phase2Blocks));

        uint256 issued1 = uint256(mps1) * uint256(phase1Blocks);
        uint256 issued2 = uint256(mps2) * uint256(phase2Blocks);
        uint24 mps3 = uint24(MPS - uint24(issued1 + issued2));

        bytes8 packed1 = bytes8((uint64(mps1) << 40) | uint64(phase1Blocks));
        bytes8 packed2 = bytes8((uint64(mps2) << 40) | uint64(phase2Blocks));
        bytes8 packed3 = bytes8((uint64(mps3) << 40) | uint64(lastBlock));

        return abi.encodePacked(packed1, packed2, packed3);
    }

    function deriveScheduledStartBlock(uint256 blockNumber, uint256 blockTimestamp, uint64 launchBlockTimeSeconds)
        external
        pure
        returns (uint64 startBlock)
    {
        uint256 nextThursdayStartTimestamp = _nextThursdayStartTimestamp(blockTimestamp);
        uint256 deltaBlocks;
        if (nextThursdayStartTimestamp > blockTimestamp) {
            deltaBlocks = Math.ceilDiv(nextThursdayStartTimestamp - blockTimestamp, uint256(launchBlockTimeSeconds));
        }
        if (deltaBlocks == 0) deltaBlocks = 1;
        startBlock = uint64(blockNumber + deltaBlocks);
    }

    function deriveLaunchPricing(
        address oracle,
        address currency,
        uint64 launchOracleMaxAge,
        uint16 launchDiscountBps,
        uint16 launchTickSpacingBps,
        uint256 blockTimestamp
    ) external view returns (uint256 floorPriceQ96, uint256 tickSpacingQ96, uint256 creatorUsdPrice, uint256 ethUsdPrice)
    {
        if (oracle == address(0)) revert LaunchOracleNotConfigured();
        if (currency != address(0)) revert UnsupportedLaunchCurrency(currency);

        (int256 creatorUsdSigned, uint256 creatorTimestamp) = ICreatorOracle(oracle).getCreatorPrice();
        (int256 ethUsdSigned, uint256 ethTimestamp) = ICreatorOracle(oracle).getEthPrice();

        if (creatorUsdSigned <= 0 || ethUsdSigned <= 0) {
            revert LaunchOracleInvalidPrice(creatorUsdSigned, ethUsdSigned);
        }

        if (
            creatorTimestamp == 0 || ethTimestamp == 0 || creatorTimestamp > blockTimestamp || ethTimestamp > blockTimestamp
                || blockTimestamp - creatorTimestamp > launchOracleMaxAge || blockTimestamp - ethTimestamp > launchOracleMaxAge
        ) {
            revert LaunchOracleStale(creatorTimestamp, ethTimestamp, launchOracleMaxAge, blockTimestamp);
        }

        creatorUsdPrice = uint256(creatorUsdSigned);
        ethUsdPrice = uint256(ethUsdSigned);

        uint256 discountedCreatorUsd = Math.mulDiv(creatorUsdPrice, uint256(launchDiscountBps), BPS_DENOMINATOR);
        uint256 rawFloorPriceQ96 = Math.mulDiv(discountedCreatorUsd, Q96, ethUsdPrice);

        tickSpacingQ96 = Math.mulDiv(rawFloorPriceQ96, uint256(launchTickSpacingBps), BPS_DENOMINATOR);
        if (tickSpacingQ96 < 2) tickSpacingQ96 = 2;
        floorPriceQ96 = (rawFloorPriceQ96 / tickSpacingQ96) * tickSpacingQ96;
        if (floorPriceQ96 == 0) revert LaunchFloorTooLow(rawFloorPriceQ96, tickSpacingQ96);
    }

    function _createLinearSteps(uint64 duration) internal pure returns (bytes memory) {
        uint24 mpsPerBlock = uint24(MPS / duration);
        bytes8 packed = bytes8((uint64(mpsPerBlock) << 40) | uint64(duration));
        return abi.encodePacked(packed);
    }

    function _nextThursdayStartTimestamp(uint256 currentTimestamp) internal pure returns (uint256) {
        uint256 remainder = currentTimestamp % THURSDAY_EPOCH_SECONDS;
        if (remainder == 0) return currentTimestamp;
        return currentTimestamp + (THURSDAY_EPOCH_SECONDS - remainder);
    }
}
