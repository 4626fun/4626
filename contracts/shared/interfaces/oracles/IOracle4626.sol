// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";

/**
 * @title IOracle4626
 * @author 0xakita.eth
 * @notice Lane-neutral oracle interface for 4626 vault asset price feeds.
 * @dev Implemented by both lane oracles (CreatorOracle prices the creator coin,
 *      AgentOracle prices the agent token). "Asset" always means the vault's
 *      underlying asset token for the lane in question. Shared consumers
 *      (strategies, lottery manager, gauge controllers, boost manager) must
 *      type against this interface rather than a lane-specific one.
 */
interface IOracle4626 {
    // ================================
    // CONFIGURATION
    // ================================

    function setV4Pool(address _poolManager, PoolKey calldata _poolKey, bool _assetIsToken0) external;

    function setV3Pool(address _pool, address _assetToken, address _usdToken, uint32 _twapDuration) external;

    // ================================
    // PRICE READING
    // ================================

    function getEthPrice() external view returns (int256 price, uint256 timestamp);

    /// @notice Vault asset price in USD (1e18), plus the timestamp it was set.
    function getAssetPrice() external view returns (int256 price, uint256 timestamp);

    /// @notice Asset/ETH TWAP over `duration` seconds (asset tokens per 1 ETH, 1e18).
    function getAssetEthTWAP(uint32 duration) external view returns (uint256 price);

    function getTWAPTick(uint32 duration) external view returns (int24 twapTick);

    function tickToPrice(int24 tick) external view returns (uint256 price);

    function getCurrentTick() external view returns (int24 tick);

    function isPriceFresh() external view returns (bool);

    // ================================
    // AJNA BUCKET HELPERS
    // ================================

    /**
     * @notice Convert a Uniswap tick to an Ajna bucket index (approx)
     */
    function tickToAjnaBucket(int24 tick) external pure returns (uint256 bucketIndex);

    /**
     * @notice Suggested Ajna bucket from the configured ASSET/USDC V3 TWAP tick
     */
    function getAjnaBucketFromV3TWAP(uint32 duration) external view returns (uint256 bucketIndex);

    // ================================
    // PRICE UPDATING
    // ================================

    function updateAssetPrice(int256 _price) external;

    /**
     * @notice Chainlink-style update: V4 TWAP (Asset/ETH) × Chainlink (ETH/USD)
     */
    function updateAssetPriceFromTWAP(uint32 twapDuration) external;

    /**
     * @notice Optional: direct stablecoin update (ASSET/USDC V3 TWAP)
     */
    function updateAssetPriceFromV3TWAP(uint32 twapDuration) external;

    function recordSwapObservation() external;

    // ================================
    // STATE HELPERS
    // ================================

    function getObservationState()
        external
        view
        returns (uint16 index, uint16 cardinality, uint16 cardinalityNext, uint32 lastTimestamp);

    function getTickCapState() external view returns (int24 currentCap, uint64 capFrequency, bool autoTunePaused);

    function assetSymbol() external view returns (string memory);

    function assetPriceUSD() external view returns (int256);

    function assetPriceTimestamp() external view returns (uint256);

    function v4PoolConfigured() external view returns (bool);

    function maxTicksPerObservation() external view returns (int24);
}
