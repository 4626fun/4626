// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {OVaultHubComposer} from "../../utilities/messaging/OVaultHubComposer.sol";

/**
 * @title CreatorOVaultComposerHub
 * @notice Canonical services path alias for the Base-side OVault composer.
 * @dev Keeps legacy imports working while exposing the new `services/ovault` location.
 */
contract CreatorOVaultComposerHub is OVaultHubComposer {
    constructor(address registry, address owner) OVaultHubComposer(registry, owner) {}
}
