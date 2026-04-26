// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IRandomnessSource} from "./IRandomnessSource.sol";

/// @notice Minimal interface to call into the existing
///         `CreatorVRFConsumerV2_5` without importing the full file.
interface IChainlinkVRFConsumerLike {
    function requestRandomWords() external returns (uint256 requestId);
    function getRequestStatus(uint256 requestId)
        external
        view
        returns (
            address requester,
            bool fulfilled,
            bool callbackSent,
            uint256 randomWord,
            uint256 timestamp
        );
}

/// @title ChainlinkVRFAdapter
/// @notice Wraps `CreatorVRFConsumerV2_5` behind the `IRandomnessSource`
///         interface. This is the REQUEST-mode side of the new selector.
///
/// @dev    No state of its own — every call passes through to the existing
///         consumer. That keeps the audited Chainlink path bit-identical to
///         what's deployed today; this adapter is a pure shape converter.
contract ChainlinkVRFAdapter is IRandomnessSource {
    IChainlinkVRFConsumerLike public immutable consumer;

    constructor(IChainlinkVRFConsumerLike _consumer) {
        require(address(_consumer) != address(0), "zero consumer");
        consumer = _consumer;
    }

    function mode() external pure returns (SourceMode) {
        return SourceMode.REQUEST;
    }

    function isReady(uint256 key) external view returns (bool) {
        (, bool fulfilled, , , ) = consumer.getRequestStatus(key);
        return fulfilled;
    }

    function randomWord(uint256 key) external view returns (uint256) {
        (, bool fulfilled, , uint256 word, ) = consumer.getRequestStatus(key);
        require(fulfilled, "not ready");
        return word;
    }

    /// @notice REQUEST-mode entrypoint. Returns the consumer's request id so
    ///         the caller can use it as the lookup key for `randomWord`.
    function request() external returns (uint256 requestId) {
        return consumer.requestRandomWords();
    }
}
