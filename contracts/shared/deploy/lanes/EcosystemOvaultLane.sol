// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IRegistry4626} from "@4626/shared/interfaces/core/IRegistry4626.sol";
import {OvaultLaneBase} from "@4626/shared/deploy/lanes/OvaultLaneBase.sol";

/**
 * @title EcosystemOvaultLane
 * @notice Configurable lane descriptor for ecosystems added after the canonical
 * creator and agent lanes.
 * @dev Each ecosystem receives its own factory lane key and codeIds while
 * selecting one of the batcher's currently supported execution templates.
 * Adding a third execution template remains an explicit batcher/registry
 * upgrade rather than silently treating it as creator or agent behavior.
 */
contract EcosystemOvaultLane is OvaultLaneBase {
    IRegistry4626.VaultKind private immutable _executionKind;
    string private _ecosystemId;
    string private _saltPrefix;

    error EmptyEcosystemId();
    error EmptySaltPrefix();

    constructor(
        address owner_,
        string memory ecosystemId_,
        IRegistry4626.VaultKind executionKind_,
        string memory saltPrefix_
    ) OvaultLaneBase(owner_) {
        if (bytes(ecosystemId_).length == 0) revert EmptyEcosystemId();
        if (bytes(saltPrefix_).length == 0) revert EmptySaltPrefix();
        _ecosystemId = ecosystemId_;
        _executionKind = executionKind_;
        _saltPrefix = saltPrefix_;
    }

    function kind() external view override returns (IRegistry4626.VaultKind) {
        return _executionKind;
    }

    function laneId() external view override returns (string memory) {
        return _ecosystemId;
    }

    function saltLabel(string calldata part) external view override returns (string memory) {
        return string.concat(_saltPrefix, part);
    }
}
