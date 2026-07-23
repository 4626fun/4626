// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IRandomnessSource} from "@4626/shared/interfaces/lottery/IRandomnessSource.sol";

/// @notice Minimal interface to call into the existing
///         `VRFConsumer4626` without importing the full file.
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
/// @notice Wraps `VRFConsumer4626` behind the `IRandomnessSource`
///         interface. This is the REQUEST-mode side of the new selector.
///
/// @dev    REQUEST entry is gated to `requester` (normally RandomnessRouter)
///         so unauthorized EOAs cannot spam the VRF subscription.
contract ChainlinkVRFAdapter is IRandomnessSource {
    IChainlinkVRFConsumerLike public immutable consumer;
    address public owner;
    address public requester;

    error UnauthorizedRequester();
    error Unauthorized();
    error ZeroAddress();

    event RequesterUpdated(address indexed requester);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    constructor(IChainlinkVRFConsumerLike _consumer, address _owner) {
        require(address(_consumer) != address(0), "zero consumer");
        require(_owner != address(0), "zero owner");
        consumer = _consumer;
        owner = _owner;
        emit OwnershipTransferred(address(0), _owner);
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    function setRequester(address _requester) external onlyOwner {
        if (_requester == address(0)) revert ZeroAddress();
        requester = _requester;
        emit RequesterUpdated(_requester);
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
        if (msg.sender != requester) revert UnauthorizedRequester();
        return consumer.requestRandomWords();
    }
}
