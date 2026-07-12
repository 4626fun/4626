// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title BribesFactory4626
 * @author 4626
 * @notice Deterministically deploys (CREATE2) a BribeDepot4626 per vault gauge.
 *
 * Vault address is treated as the gauge id / surface.
 * Create eligibility always uses ve4626GaugeVoting.canReceiveBribes (single policy surface
 * with fund path on BribeDepot4626).
 */

import {BribeDepot4626} from "@4626/shared/governance/bribes/BribeDepot4626.sol";

interface Ive4626GaugeVotingForBribesFactory4626 {
    function canReceiveBribes(address vault) external view returns (bool);
}

contract BribesFactory4626 {
    address public immutable gaugeVoting;
    /// @notice Ownable admin for every CREATE2 depot (rollover / grace).
    address public immutable depotOwner;

    mapping(address vault => address depot) public bribeDepot4626Of;

    event BribeDepot4626Created(address indexed vault, address indexed depot, address indexed owner);

    error ZeroAddress();
    error DepotAlreadyExists(address vault, address depot);
    error VaultNotWhitelisted(address vault);

    constructor(address _gaugeVoting, address _depotOwner) {
        if (_gaugeVoting == address(0) || _depotOwner == address(0)) revert ZeroAddress();
        gaugeVoting = _gaugeVoting;
        depotOwner = _depotOwner;
    }

    function createBribeDepot4626(address vault) public returns (address depot) {
        if (vault == address(0)) revert ZeroAddress();

        address existing = bribeDepot4626Of[vault];
        if (existing != address(0)) revert DepotAlreadyExists(vault, existing);

        if (!Ive4626GaugeVotingForBribesFactory4626(gaugeVoting).canReceiveBribes(vault)) {
            revert VaultNotWhitelisted(vault);
        }

        bytes32 salt = bytes32(uint256(uint160(vault)));
        depot = address(new BribeDepot4626{salt: salt}(vault, gaugeVoting, depotOwner));

        bribeDepot4626Of[vault] = depot;
        emit BribeDepot4626Created(vault, depot, depotOwner);
    }

    function getOrCreateBribeDepot4626(address vault) external returns (address depot) {
        depot = bribeDepot4626Of[vault];
        if (depot != address(0)) return depot;
        return createBribeDepot4626(vault);
    }
}
