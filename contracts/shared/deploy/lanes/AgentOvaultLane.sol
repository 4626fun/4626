// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IRegistry4626} from "@4626/shared/interfaces/core/IRegistry4626.sol";
import {OvaultLaneBase} from "@4626/shared/deploy/lanes/OvaultLaneBase.sol";

/**
 * @title AgentOvaultLane
 * @notice AgentTokenV4 vault lane policy for OVaultFactory4626 (not XMTP/Keepr).
 * @dev Bytecode: AgentOVault / Wrapper / ShareOFT / AgentGaugeController / AgentOracle / …
 *      Salt labels match DeploymentBatcher agent branch ("agentVault", "agentWrapper", …).
 */
contract AgentOvaultLane is OvaultLaneBase {
    constructor(address owner_) OvaultLaneBase(owner_) {}

    function kind() external pure override returns (IRegistry4626.VaultKind) {
        return IRegistry4626.VaultKind.Agent;
    }

    function laneId() external pure override returns (string memory) {
        return "agent";
    }

    function saltLabel(string calldata part) external pure override returns (string memory) {
        bytes32 p = keccak256(bytes(part));
        if (p == keccak256("vault")) return "agentVault";
        if (p == keccak256("wrapper")) return "agentWrapper";
        if (p == keccak256("shareOFT")) return "agentShareOFT";
        if (p == keccak256("gauge")) return "agentGauge";
        if (p == keccak256("oracle")) return "agentOracle";
        if (p == keccak256("cca")) return "agentCca";
        return part;
    }
}
