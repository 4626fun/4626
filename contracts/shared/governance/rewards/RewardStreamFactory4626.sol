// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {RewardStream4626} from "./RewardStream4626.sol";

/**
 * @title RewardStreamFactory4626
 * @author 4626
 * @notice Deterministically deploys (CREATE2) a `RewardStream4626` per vault gauge.
 * @dev Vault address is the gauge id / surface (same convention as `BribesFactory4626`).
 *      Create eligibility always uses ve4626GaugeVoting.canReceiveStreams (aligned with fund).
 */
interface Ive4626GaugeVotingForStreamFactory {
    function canReceiveStreams(address vault) external view returns (bool);
}

contract RewardStreamFactory4626 {
    address public immutable gaugeVoting;
    address public immutable streamOwner;

    mapping(address vault => address stream) public streamOf;

    event RewardStreamCreated(address indexed vault, address indexed stream, address indexed owner);

    error ZeroAddress();
    error StreamAlreadyExists(address vault, address stream);
    error VaultNotWhitelisted(address vault);

    constructor(address gaugeVoting_, address streamOwner_) {
        if (gaugeVoting_ == address(0) || streamOwner_ == address(0)) revert ZeroAddress();
        gaugeVoting = gaugeVoting_;
        streamOwner = streamOwner_;
    }

    function createStream(address vault) public returns (address stream) {
        if (vault == address(0)) revert ZeroAddress();

        address existing = streamOf[vault];
        if (existing != address(0)) revert StreamAlreadyExists(vault, existing);

        if (!Ive4626GaugeVotingForStreamFactory(gaugeVoting).canReceiveStreams(vault)) {
            revert VaultNotWhitelisted(vault);
        }

        bytes32 salt = bytes32(uint256(uint160(vault)));
        stream = address(new RewardStream4626{salt: salt}(vault, gaugeVoting, streamOwner));

        streamOf[vault] = stream;
        emit RewardStreamCreated(vault, stream, streamOwner);
    }

    function getOrCreateStream(address vault) external returns (address stream) {
        stream = streamOf[vault];
        if (stream != address(0)) return stream;
        return createStream(vault);
    }
}
