// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {EnumerableSet} from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import {IRegistry4626} from "@4626/shared/interfaces/core/IRegistry4626.sol";
import {IGaugeSurfaceRegistry} from "@4626/shared/governance/surfaces/IGaugeSurfaceRegistry.sol";

/**
 * @title GaugeSurfaceRegistry4626
 * @notice Canonical allowlist of gauge surfaces (Hermes-inspired gauge lifecycle, 4626-native).
 * @dev Wire:
 *      - OVaultFactory4626 (registrar) on registerDeploymentWithKind
 *      - ve4626GaugeVoting.useSurfaceRegistry for vote eligibility
 *      - BribesFactory4626 / RewardStreamFactory4626 for create gates
 *
 *      Vote *weights* still live in ve4626GaugeVoting; this registry only answers
 *      "is this surface allowed to participate in X?"
 */
contract GaugeSurfaceRegistry4626 is IGaugeSurfaceRegistry, Ownable {
    using EnumerableSet for EnumerableSet.AddressSet;

    mapping(address => Surface) private _surfaces;
    EnumerableSet.AddressSet private _allSurfaces;

    /// @notice OVaultFactory / ops bots allowed to register surfaces.
    mapping(address => bool) public isRegistrar;

    bool public globalPaused;

    modifier onlyRegistrar() {
        if (!isRegistrar[msg.sender] && msg.sender != owner()) revert NotRegistrar();
        _;
    }

    constructor(address owner_) Ownable(owner_) {
        if (owner_ == address(0)) revert ZeroAddress();
        isRegistrar[owner_] = true;
    }

    // -------------------------------------------------------------------------
    // Admin
    // -------------------------------------------------------------------------

    function setRegistrar(address registrar, bool authorized) external onlyOwner {
        if (registrar == address(0)) revert ZeroAddress();
        isRegistrar[registrar] = authorized;
        emit RegistrarUpdated(registrar, authorized);
    }

    function setGlobalPaused(bool paused) external onlyOwner {
        globalPaused = paused;
        emit GlobalPaused(paused);
    }

    // -------------------------------------------------------------------------
    // Registration
    // -------------------------------------------------------------------------

    /// @inheritdoc IGaugeSurfaceRegistry
    function registerSurface(
        address surface,
        IRegistry4626.VaultKind kind,
        bytes32 laneId,
        bool votes,
        bool bribes,
        bool streams
    ) external onlyRegistrar {
        if (surface == address(0)) revert ZeroAddress();
        if (_surfaces[surface].registered) revert SurfaceAlreadyRegistered(surface);

        _surfaces[surface] = Surface({
            registered: true,
            votes: votes,
            bribes: bribes,
            streams: streams,
            paused: false,
            kind: kind,
            laneId: laneId
        });
        _allSurfaces.add(surface);

        emit SurfaceRegistered(surface, kind, laneId, votes, bribes, streams);
    }

    /// @inheritdoc IGaugeSurfaceRegistry
    function setCapabilities(address surface, bool votes, bool bribes, bool streams, bool paused)
        external
        onlyRegistrar
    {
        Surface storage s = _surfaces[surface];
        if (!s.registered) revert SurfaceNotRegistered(surface);
        s.votes = votes;
        s.bribes = bribes;
        s.streams = streams;
        s.paused = paused;
        emit SurfaceCapabilitiesUpdated(surface, votes, bribes, streams, paused);
    }

    /// @inheritdoc IGaugeSurfaceRegistry
    function removeSurface(address surface) external onlyRegistrar {
        Surface storage s = _surfaces[surface];
        if (!s.registered) revert SurfaceNotRegistered(surface);
        delete _surfaces[surface];
        _allSurfaces.remove(surface);
        emit SurfaceRemoved(surface);
    }

    // -------------------------------------------------------------------------
    // Views
    // -------------------------------------------------------------------------

    function getSurface(address surface) external view returns (Surface memory) {
        return _surfaces[surface];
    }

    function isRegistered(address surface) external view returns (bool) {
        return _surfaces[surface].registered;
    }

    function surfaceCount() external view returns (uint256) {
        return _allSurfaces.length();
    }

    function surfaceAt(uint256 index) external view returns (address) {
        return _allSurfaces.at(index);
    }

    function allSurfaces() external view returns (address[] memory) {
        return _allSurfaces.values();
    }

    function canReceiveVotes(address surface) public view returns (bool) {
        if (globalPaused) return false;
        Surface storage s = _surfaces[surface];
        return s.registered && s.votes && !s.paused;
    }

    function canReceiveBribes(address surface) public view returns (bool) {
        if (globalPaused) return false;
        Surface storage s = _surfaces[surface];
        return s.registered && s.bribes && !s.paused;
    }

    function canReceiveStreams(address surface) public view returns (bool) {
        if (globalPaused) return false;
        Surface storage s = _surfaces[surface];
        return s.registered && s.streams && !s.paused;
    }
}
