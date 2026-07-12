// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IRegistry4626} from "@4626/shared/interfaces/core/IRegistry4626.sol";
import {IOvaultLane} from "@4626/shared/deploy/lanes/IOvaultLane.sol";

/**
 * @title OvaultLaneBase
 * @notice Shared storage for lane codeIds; subclasses fix `kind` / salt labels.
 */
abstract contract OvaultLaneBase is IOvaultLane, Ownable {
    CodeIds private _codeIds;
    bool private _codeIdsSet;

    error CodeIdsNotConfigured();
    error ZeroCodeId(string field);

    event CodeIdsUpdated(CodeIds codeIds);

    constructor(address owner_) Ownable(owner_) {}

    /// @inheritdoc IOvaultLane
    function codeIds() public view override returns (CodeIds memory) {
        if (!_codeIdsSet) revert CodeIdsNotConfigured();
        return _codeIds;
    }

    /// @notice Owner configures bytecode store ids for this lane (ops after seed).
    function setCodeIds(CodeIds calldata ids) external onlyOwner {
        if (ids.vault == bytes32(0)) revert ZeroCodeId("vault");
        if (ids.wrapper == bytes32(0)) revert ZeroCodeId("wrapper");
        if (ids.shareOFT == bytes32(0)) revert ZeroCodeId("shareOFT");
        // gauge/cca/oracle may be zero on some experimental lanes; allow.
        _codeIds = ids;
        _codeIdsSet = true;
        emit CodeIdsUpdated(ids);
    }

    function codeIdsConfigured() external view returns (bool) {
        return _codeIdsSet;
    }

    /// @inheritdoc IOvaultLane
    function kind() external view virtual override returns (IRegistry4626.VaultKind);

    /// @inheritdoc IOvaultLane
    function laneId() external view virtual override returns (string memory);

    /// @inheritdoc IOvaultLane
    function saltLabel(string calldata part) external view virtual override returns (string memory);
}
