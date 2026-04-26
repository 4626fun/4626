// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title IRandomnessSource
/// @notice Pluggable randomness interface for 4626.fun's lottery stack.
///         Lets `CreatorLotteryManager` consume Chainlink VRF, drand, or any
///         future source through a single shape.
///
/// @dev    Two flavors:
///         - `request` style (Chainlink VRF): caller asks for a future round
///         - `pull` style    (drand):         caller reads a sealed past round
///
///         A source MAY support either or both — the lottery manager picks
///         which one to use per creator coin.
interface IRandomnessSource {
    enum SourceMode {
        REQUEST, // VRF-style: callback after fulfillment
        PULL     // drand-style: read sealed historical randomness
    }

    /// @notice Returns the mode this source operates in.
    function mode() external view returns (SourceMode);

    /// @notice Returns true if the source has fulfilled randomness for `key`.
    /// @param key request id (REQUEST mode) or round number (PULL mode)
    function isReady(uint256 key) external view returns (bool);

    /// @notice Returns the random word for `key`. Reverts if not ready.
    function randomWord(uint256 key) external view returns (uint256);
}
