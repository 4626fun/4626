// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IRegistry4626} from "@4626/shared/interfaces/core/IRegistry4626.sol";

/**
 * @title IGaugeSurfaceRegistry
 * @notice Hermes-inspired registry of what may receive votes, bribes, and partner reward streams.
 * @dev A "surface" is typically a vault address (gauge id). Capabilities are explicit flags so
 *      bribes/streams can be gated independently of vote eligibility.
 */
interface IGaugeSurfaceRegistry {
    struct Surface {
        bool registered;
        bool votes; // eligible for ve4626GaugeVoting
        bool bribes; // eligible for BribeDepot4626 create/fund path
        bool streams; // eligible for RewardStream4626 create/fund path
        bool paused; // freezes all capabilities
        IRegistry4626.VaultKind kind;
        bytes32 laneId; // e.g. keccak256("creator") / keccak256("agent")
    }

    event SurfaceRegistered(
        address indexed surface, IRegistry4626.VaultKind kind, bytes32 laneId, bool votes, bool bribes, bool streams
    );
    event SurfaceCapabilitiesUpdated(
        address indexed surface, bool votes, bool bribes, bool streams, bool paused
    );
    event SurfaceRemoved(address indexed surface);
    event GlobalPaused(bool paused);
    event RegistrarUpdated(address indexed registrar, bool authorized);

    error ZeroAddress();
    error SurfaceNotRegistered(address surface);
    error SurfaceAlreadyRegistered(address surface);
    error NotRegistrar();
    error GlobalPauseActive();

    function globalPaused() external view returns (bool);

    function getSurface(address surface) external view returns (Surface memory);

    function isRegistered(address surface) external view returns (bool);

    /// @notice Drop-in for factories / voting that only need vote eligibility.
    function canReceiveVotes(address surface) external view returns (bool);

    function canReceiveBribes(address surface) external view returns (bool);

    function canReceiveStreams(address surface) external view returns (bool);

    function registerSurface(
        address surface,
        IRegistry4626.VaultKind kind,
        bytes32 laneId,
        bool votes,
        bool bribes,
        bool streams
    ) external;

    function setCapabilities(address surface, bool votes, bool bribes, bool streams, bool paused) external;

    function removeSurface(address surface) external;
}
