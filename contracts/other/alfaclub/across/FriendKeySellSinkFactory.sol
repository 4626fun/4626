// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {FriendKeySellSink} from "@4626/other/alfaclub/across/FriendKeySellSink.sol";

/**
 * @title FriendKeySellSinkFactory
 * @notice CREATE2 factory for per-user sell sinks (same address prediction off-chain / on RH).
 */
contract FriendKeySellSinkFactory {
    address public immutable executor;

    event SinkDeployed(address indexed user, address indexed sink);

    error ZeroAddress();
    error DeployFailed();

    constructor(address executor_) {
        if (executor_ == address(0)) revert ZeroAddress();
        executor = executor_;
    }

    function saltOf(address user) public pure returns (bytes32) {
        return bytes32(uint256(uint160(user)));
    }

    function sinkOf(address user) public view returns (address sink) {
        bytes32 salt = saltOf(user);
        bytes memory initCode = abi.encodePacked(type(FriendKeySellSink).creationCode, abi.encode(user, executor));
        bytes32 hash = keccak256(abi.encodePacked(bytes1(0xff), address(this), salt, keccak256(initCode)));
        sink = address(uint160(uint256(hash)));
    }

    /// @notice Permissionless deploy (idempotent).
    function deploySink(address user) external returns (address sink) {
        if (user == address(0)) revert ZeroAddress();
        sink = sinkOf(user);
        if (sink.code.length > 0) return sink;

        bytes32 salt = saltOf(user);
        FriendKeySellSink deployed = new FriendKeySellSink{salt: salt}(user, executor);
        if (address(deployed) != sink) revert DeployFailed();
        emit SinkDeployed(user, sink);
    }
}
