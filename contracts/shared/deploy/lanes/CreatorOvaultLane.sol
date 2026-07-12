// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IRegistry4626} from "@4626/shared/interfaces/core/IRegistry4626.sol";
import {OvaultLaneBase} from "@4626/shared/deploy/lanes/OvaultLaneBase.sol";

/**
 * @title CreatorOvaultLane
 * @notice Creator-coin vault lane policy for OVaultFactory4626.
 * @dev Bytecode: CreatorOVault / Wrapper / ShareOFT / CreatorGaugeController / CreatorOracle / CCA.
 *      Salt labels match DeploymentBatcher creator branch ("vault", "wrapper", …).
 */
contract CreatorOvaultLane is OvaultLaneBase {
    constructor(address owner_) OvaultLaneBase(owner_) {}

    function kind() external pure override returns (IRegistry4626.VaultKind) {
        return IRegistry4626.VaultKind.Creator;
    }

    function laneId() external pure override returns (string memory) {
        return "creator";
    }

    function saltLabel(string calldata part) external pure override returns (string memory) {
        // Creator branch uses unprefixed part names in DeploymentBatcher.
        bytes32 p = keccak256(bytes(part));
        if (p == keccak256("vault")) return "vault";
        if (p == keccak256("wrapper")) return "wrapper";
        if (p == keccak256("shareOFT")) return "shareOFT";
        if (p == keccak256("gauge")) return "gauge";
        if (p == keccak256("oracle")) return "oracle";
        if (p == keccak256("cca")) return "cca";
        return part;
    }
}
