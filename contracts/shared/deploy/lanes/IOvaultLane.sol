// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IRegistry4626} from "@4626/shared/interfaces/core/IRegistry4626.sol";

/**
 * @title IOvaultLane
 * @notice Pluggable ecosystem / vault-lane policy for OVaultFactory4626.
 * @dev Phase A/B: lanes supply kind + CREATE2 codeIds + salt domain labels used by
 *      OVaultFactory4626 for phase-1 and phase-2 core. Future: afterPhase hooks
 *      (tax adapter, CCA defaults, eco-specific wiring).
 *
 *      Creator / Agent / FutureEco are lanes — not separate top-level factories.
 */
interface IOvaultLane {
    /// @notice CREATE2 bytecode ids for this lane's stack (matches DeploymentBatcher.CodeIds layout).
    struct CodeIds {
        bytes32 vault;
        bytes32 wrapper;
        bytes32 shareOFT;
        bytes32 gauge;
        bytes32 cca;
        bytes32 oracle;
        bytes32 oftBootstrap;
    }

    /// @notice Canonical registry vault kind for this lane.
    function kind() external view returns (IRegistry4626.VaultKind);

    /// @notice Human-readable lane id (e.g. "creator", "agent").
    function laneId() external view returns (string memory);

    /// @notice Bytecode ids used for phased CREATE2 deploys.
    function codeIds() external view returns (CodeIds memory);

    /**
     * @notice Salt domain label for a stack part.
     * @dev DeploymentBatcher already branches some labels on VaultKind; lanes expose
     *      the canonical part name for tooling/docs (e.g. "vault" vs "agentVault").
     * @param part Generic part: "vault" | "wrapper" | "shareOFT" | "gauge" | "oracle" | "cca"
     */
    function saltLabel(string calldata part) external view returns (string memory);
}
